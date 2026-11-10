/**
 * 🔎 SEGUIMIENTO AUDITABLE del «H para auditar» (A-FEAT-1579). JMS 10/11: «ese archivo, que son todos los cortes, yo lo pueda también auditar…
 * están los saltos y tiene que estar la explicación, y esa explicación conformada por sus componentes, agrupados como ya vimos» · «archivo nuevo,
 * no quiero que modifiquemos ninguno de los datos que ya hemos terminado».
 *
 * SÓLO LEE los Excel del H ya generados (v1 … vN) y el «Seguimiento … hasta vN»; escribe un archivo NUEVO (versionado, no pisa nada).
 * Por cada salto de números entre una versión y la anterior: cada cuota que ENTRÓ, SALIÓ, CAMBIÓ DE IMPORTE o CAMBIÓ DE SOLAPA, más los cambios
 * sin plata (estado, código contable, interno, efecto), ordenados por responsable → agrupadora → template → fecha, con su ficha, y al pie el control:
 * la suma de los componentes = el salto del total. Y «De punta a punta»: la v1 contra la última.
 *
 * El H no guarda el id de la cuota: se empareja por responsable + agrupadora + template + fecha (+ importe). Lo que no se puede emparejar se
 * muestra como entró / salió (nunca se inventa un emparejamiento).
 *
 *   npx tsx scripts/seguimiento-auditable-h.mts
 */
import XLSX from "xlsx-js-style"
import { readdirSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { aplicarVistas } from "../lib/balance/formato-excel"
import { agregarHoja, vistasDe } from "../lib/balance/export-libro-diario"

const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const BASE_H = "H para auditar MSA 25-26 (2026-11-07)"
const DESCARTADAS = new Set([32])
const r2 = (n: number) => Math.round(n * 100) / 100
const MON = "#,##0.00"
const C = (v: string) => ({ t: "s", v, s: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, fill: { patternType: "solid", fgColor: { rgb: "FFEEF1F0" } } } })
const T = (v: string) => ({ t: "s", v, s: { font: { bold: true, sz: 13, color: { rgb: "FF1F4E3D" } } } })
const N = (v: string) => ({ t: "s", v, s: { alignment: { wrapText: true, vertical: "top" } } })
const SUB = (v: string) => ({ t: "s", v, s: { font: { bold: true, color: { rgb: "FF1F4E3D" } }, fill: { patternType: "solid", fgColor: { rgb: "FFDDEBF7" } } } })
const IMP = (v: number) => ({ t: "n", v: r2(v), z: MON })
const F = (f: string, v: number) => ({ t: "n", f, v: r2(v), z: MON })
const ORDEN_RESP = ["MSA", "MA", "PAM"]
const ordResp = (r: string) => { const i = ORDEN_RESP.indexOf(r); return i < 0 ? 9 : i }

// ── 1 · Las versiones del H que hay en la carpeta (la que no tiene número es la v1; las «(copia)» no cuentan)
const numDe = (f: string) => { const m = f.match(/ v(\d+)\.xlsx$/); return m ? Number(m[1]) : 1 }
const versiones = readdirSync(CARPETA).filter(f => f.startsWith(BASE_H) && f.endsWith(".xlsx") && !/copia/i.test(f)).map(f => ({ v: numDe(f), archivo: f })).sort((a, b) => a.v - b.v)

interface Cuota { resp: string; agrup: string; concepto: string; fecha: string; neto: number; estado: string; quien: string; codigo: string; interno: string; efecto: string; marca: string;
  cuenta: string; banco: string; proveedor: string; detalle: string; comprobante: string; descBanco: string; beneficiario: string }
const txt = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim()
const fechaIso = (x: unknown) => typeof x === "number" ? new Date(Math.round((x - 25569) * 864e5)).toISOString().slice(0, 10) : txt(x).split("/").reverse().join("-")
/** Las cuotas de una versión: cada renglón del detalle de cada solapa de agrupadora (mismo criterio que la foto de números). */
function leer(archivo: string): Cuota[] {
  const wb = XLSX.readFile(join(CARPETA, archivo))
  const out: Cuota[] = []
  for (const n of wb.SheetNames) {
    if (n === "H · Retiros y aportes") continue
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })
    const hi = rows.findIndex(r => r && r[0] === "Nro" && r.includes("Marca")); if (hi < 0) continue
    const H: string[] = rows[hi].map((x: unknown) => txt(x)), col = (nombre: string) => H.indexOf(nombre)
    const [, resp = "?", agrup = n] = n.split(" · ")
    for (const r of rows.slice(hi + 1)) {
      if (!r || typeof r[0] !== "number") break
      const g = (nombre: string) => { const i = col(nombre); return i >= 0 ? r[i] : "" }
      out.push({ resp, agrup, concepto: txt(g("Concepto")), fecha: fechaIso(g("Fecha")), neto: r2((Number(g("Débito")) || 0) - (Number(g("Crédito")) || 0)),
        estado: txt(g("Estado")), quien: txt(g("Quién pagó")), codigo: txt(g("Código contable")), interno: txt(g("Interno")), efecto: txt(g("Efecto")), marca: txt(g("Marca")),
        cuenta: txt(g("Cuenta de la cuota")), banco: txt(g("Banco / cuenta")), proveedor: txt(g("Proveedor")), detalle: txt(g("Detalle")), comprobante: txt(g("Comprobante")),
        descBanco: txt(g("Descripción del banco")), beneficiario: txt(g("Beneficiario / CUIT")) })
    }
  }
  return out
}

type Tipo = "Entró" | "Salió" | "Cambió el importe" | "Cambió de solapa" | "Cambió sin plata"
interface Cambio { tipo: Tipo; antes?: Cuota; despues?: Cuota; que?: string }
/** Compara dos versiones cuota por cuota. Empareja por pasos, del más estricto al más laxo, y lo que sobra es entró / salió. */
function comparar(a: Cuota[], b: Cuota[], conEfecto = true): Cambio[] {
  const libresA = [...a], libresB = [...b], out: Cambio[] = []
  const emparejar = (clave: (c: Cuota) => string, hacer: (x: Cuota, y: Cuota) => void) => {
    const idx = new Map<string, number[]>()
    libresB.forEach((c, i) => { const k = clave(c); idx.set(k, [...(idx.get(k) ?? []), i]) })
    const usadosB = new Set<number>(), quedanA: Cuota[] = []
    for (const x of libresA) { const l = idx.get(clave(x)); const i = l?.shift(); if (i === undefined) { quedanA.push(x); continue } usadosB.add(i); hacer(x, libresB[i]) }
    const quedanB = libresB.filter((_, i) => !usadosB.has(i))
    libresA.splice(0, libresA.length, ...quedanA); libresB.splice(0, libresB.length, ...quedanB)
  }
  const sinPlata = (x: Cuota, y: Cuota) => {
    const d: string[] = []
    if (x.estado !== y.estado) d.push(`estado: ${x.estado || "—"} → ${y.estado || "—"}`)
    if (x.codigo !== y.codigo) d.push(`contable: ${x.codigo || "—"} → ${y.codigo || "—"}`)
    if (x.interno !== y.interno) d.push(`interno: ${x.interno || "—"} → ${y.interno || "—"}`)
    if (conEfecto && x.efecto !== y.efecto) d.push(`efecto: ${x.efecto || "—"} → ${y.efecto || "—"}`)
    if (d.length) out.push({ tipo: "Cambió sin plata", antes: x, despues: y, que: d.join(" · ") })
  }
  emparejar(c => `${c.resp}|${c.agrup}|${c.concepto}|${c.fecha}|${c.neto}`, sinPlata)
  emparejar(c => `${c.resp}|${c.agrup}|${c.concepto}|${c.fecha}`, (x, y) => out.push({ tipo: "Cambió el importe", antes: x, despues: y, que: `${x.neto} → ${y.neto}` }))
  emparejar(c => `${c.concepto}|${c.fecha}|${c.neto}`, (x, y) => out.push({ tipo: "Cambió de solapa", antes: x, despues: y, que: `${x.resp} · ${x.agrup} → ${y.resp} · ${y.agrup}` }))
  for (const x of libresA) out.push({ tipo: "Salió", antes: x })
  for (const y of libresB) out.push({ tipo: "Entró", despues: y })
  return out
}
const ref = (c: Cambio) => c.despues ?? c.antes!
const ordenar = (cs: Cambio[]) => cs.sort((x, y) => { const a = ref(x), b = ref(y); return ordResp(a.resp) - ordResp(b.resp) || a.resp.localeCompare(b.resp) || a.agrup.localeCompare(b.agrup) || a.concepto.localeCompare(b.concepto) || a.fecha.localeCompare(b.fecha) })

// ── 2 · Lo que ya explica el seguimiento (qué cambió en cada versión y los saltos con sus partes): se COPIA, no se reescribe
const seg = readdirSync(CARPETA).filter(f => /^Seguimiento H para auditar - hasta v\d+/.test(f)).sort((a, b) => Number(a.match(/v(\d+)/)![1]) - Number(b.match(/v(\d+)/)![1])).pop()!
const wbSeg = XLSX.readFile(join(CARPETA, seg))
const filasVers = XLSX.utils.sheet_to_json(wbSeg.Sheets["Versiones"], { header: 1, raw: true, defval: "" }) as unknown[][]
const filasSaltos = XLSX.utils.sheet_to_json(wbSeg.Sheets["Los saltos"], { header: 1, raw: true, defval: "" }) as unknown[][]
const filasScripts = XLSX.utils.sheet_to_json(wbSeg.Sheets["Scripts de datos"], { header: 1, raw: true, defval: "" }) as unknown[][]
const queDe = new Map<number, { tipo: string; que: string; script: string }>()
{ const hv = filasVers.findIndex(r => r.includes("Versión") || r.includes("Tipo")); const H = (filasVers[hv] ?? []).map(x => txt(x))
  const iV = H.findIndex(h => /^Versi/.test(h)), iT = H.indexOf("Tipo"), iQ = H.findIndex(h => /Qué cambió/.test(h)), iS = H.findIndex(h => /Script/.test(h))
  for (const r of filasVers.slice(hv + 1)) { const v = Number(String(r[iV] ?? "").replace(/\D/g, "")); if (v) queDe.set(v, { tipo: txt(r[iT]), que: txt(r[iQ]), script: txt(r[iS]) }) } }
const partesDe = (v: number) => { const out: unknown[][] = []; let dentro = false
  for (const r of filasSaltos) { const c0 = txt(r[0]); if (/^v\d+$/.test(c0)) dentro = c0 === `v${v}`; else if (c0) dentro = false; if (dentro) out.push([txt(r[0]), txt(r[1]), typeof r[2] === "number" ? IMP(r[2]) : txt(r[2]), txt(r[3]), typeof r[4] === "number" ? IMP(r[4]) : txt(r[4]), txt(r[5])]) }
  return out }

// ── 3 · Leer todas las versiones y armar los saltos
const datos = versiones.map(x => ({ ...x, cuotas: leer(x.archivo) }))
const tot = (cs: Cuota[]) => r2(cs.reduce((t, c) => t + c.neto, 0))
const cadena = datos.filter(d => !DESCARTADAS.has(d.v))
const wb = XLSX.utils.book_new()
const indice: unknown[][] = []
const FICHA = ["Tipo de cambio", "Responsable", "Agrupadora", "Template", "Fecha", "Importe antes", "Importe después", "Diferencia", "Qué cambió", "Estado", "Quién pagó", "Código contable", "Interno", "Efecto", "Marca",
  "Cuenta de la cuota", "Proveedor", "Detalle", "Comprobante", "Banco / cuenta", "Descripción del banco", "Beneficiario / CUIT"]
const ANCHOS = [16, 16, 22, 30, 14, 14, 14, 14, 44, 12, 22, 16, 12, 30, 22, 20, 24, 44, 14, 18, 30, 26]
const fila = (c: Cambio): unknown[] => { const x = ref(c), a = c.antes?.neto ?? 0, b = c.despues?.neto ?? 0
  return [c.tipo, x.resp, c.tipo === "Cambió de solapa" ? `${c.antes!.agrup} → ${c.despues!.agrup}` : x.agrup, x.concepto, x.fecha ? { t: "d", v: new Date(x.fecha + "T12:00:00"), z: "dd/mm/yyyy" } : "",
    c.antes ? IMP(a) : "", c.despues ? IMP(b) : "", IMP(c.tipo === "Cambió de solapa" || c.tipo === "Cambió sin plata" ? 0 : b - a), c.que ?? "", x.estado, x.quien, x.codigo, x.interno, x.efecto, x.marca,
    x.cuenta, x.proveedor, x.detalle, x.comprobante, x.banco, x.descBanco, x.beneficiario] }
/** Una solapa de salto: la explicación (copiada del seguimiento), el resumen por responsable / agrupadora con fórmulas y el detalle. */
function hojaSalto(nombre: string, titulo: string, de: { v: number; cuotas: Cuota[] }, a: { v: number; cuotas: Cuota[] }, explicacion: unknown[][], conEfecto = true) {
  // de punta a punta el texto del efecto cambió de redacción en las versiones de presentación: ahí sólo cuentan estado, contable e interno
  const cs = ordenar(comparar(de.cuotas, a.cuotas, conEfecto))
  const conPlata = cs.filter(c => c.tipo !== "Cambió sin plata"), sinPlata = cs.filter(c => c.tipo === "Cambió sin plata")
  const salto = r2(tot(a.cuotas) - tot(de.cuotas))
  const h: unknown[][] = [[{ t: "s", v: "⬅ Resumen", l: { Target: "#'Resumen'!A1" } }], [T(titulo)], [],
    ["Total de las cuotas", IMP(tot(de.cuotas)), "→", IMP(tot(a.cuotas)), "salto", IMP(salto)], ["Cantidad de cuotas", { t: "n", v: de.cuotas.length, z: "0" }, "→", { t: "n", v: a.cuotas.length, z: "0" }, "", { t: "n", v: a.cuotas.length - de.cuotas.length, z: "0" }], []]
  if (explicacion.length) { h.push([SUB("La explicación (del seguimiento)")], ["Versión", "Número", "Salto", "Parte", "Importe", "¿Cierra?"].map(C), ...explicacion, []) }
  // resumen por responsable → agrupadora (fórmulas sobre el detalle de abajo)
  const pares = [...new Set(conPlata.map(c => `${ref(c).resp}|${c.tipo === "Cambió de solapa" ? "" : ref(c).agrup}`))].filter(k => !k.endsWith("|"))
    .sort((x, y) => ordResp(x.split("|")[0]) - ordResp(y.split("|")[0]) || x.localeCompare(y))
  h.push([SUB("De qué se compone el salto — por responsable y agrupadora (fórmula sobre el detalle)")], ["Responsable", "Agrupadora", "Renglones", "Diferencia"].map(C))
  const iniRes = h.length + 1
  const iniDet = iniRes + pares.length + 3 + 2, finDet = iniDet + conPlata.length - 1
  for (const k of pares) { const [r, g] = k.split("|"); const v = conPlata.filter(c => ref(c).resp === r && ref(c).agrup === g && c.tipo !== "Cambió de solapa").reduce((t, c) => t + (c.despues?.neto ?? 0) - (c.antes?.neto ?? 0), 0)
    h.push([r, g, { t: "n", f: `COUNTIFS($B$${iniDet}:$B$${finDet},"${r}",$C$${iniDet}:$C$${finDet},"${g.replace(/"/g, '""')}")`, v: conPlata.filter(c => ref(c).resp === r && ref(c).agrup === g).length, z: "0" },
      F(`SUMIFS($H$${iniDet}:$H$${finDet},$B$${iniDet}:$B$${finDet},"${r}",$C$${iniDet}:$C$${finDet},"${g.replace(/"/g, '""')}")`, v)]) }
  const sumaComp = conPlata.reduce((t, c) => t + (c.tipo === "Cambió de solapa" ? 0 : (c.despues?.neto ?? 0) - (c.antes?.neto ?? 0)), 0)
  h.push(["", "SUMA DE LOS COMPONENTES", "", F(conPlata.length ? `SUM(H${iniDet}:H${finDet})` : "0", sumaComp)],
    ["", "¿Cierra con el salto?", "", { t: "s", f: `IF(ABS(D${h.length + 1}-F4)<0.01,"✓ cierra","⚠️ no cierra")`, v: Math.abs(sumaComp - salto) < 0.01 ? "✓ cierra" : "⚠️ no cierra" }], [])
  h.push([SUB(`Las cuotas que cambiaron de plata o de lugar (${conPlata.length}) — responsable → agrupadora → template → fecha`)])
  h.push(FICHA.map(C)); for (const c of conPlata) h.push(fila(c))
  if (sinPlata.length) { h.push([], [SUB(`Cambios sin plata (${sinPlata.length}): estado, contable, interno o efecto`)], FICHA.map(C)); for (const c of sinPlata) h.push(fila(c)) }
  agregarHoja(wb as any, nombre, h, ANCHOS.map(ancho => ({ ancho })) as any)
  const ws = wb.Sheets[nombre]; ws["!autofilter"] = { ref: `A${iniDet - 1}:${XLSX.utils.encode_col(FICHA.length - 1)}${Math.max(iniDet, finDet)}` }
  return { salto, n: conPlata.length, sinPlata: sinPlata.length, cierra: Math.abs(sumaComp - salto) < 0.01 }
}

// Los saltos con plata (entre versiones consecutivas de la cadena; la v32 descartada no entra)
const resumenSaltos: Array<{ de: number; a: number; solapa: string; salto: number; n: number; sinPlata: number; cierra: boolean; tipo: string; que: string }> = []
for (let i = 1; i < cadena.length; i++) {
  const de = cadena[i - 1], a = cadena[i]
  const cambia = tot(de.cuotas) !== tot(a.cuotas) || de.cuotas.length !== a.cuotas.length
  const q = queDe.get(a.v) ?? { tipo: "", que: "", script: "" }
  if (!cambia && !/Datos/i.test(q.tipo)) continue
  const solapa = `Salto v${de.v}→v${a.v}`
  const r = hojaSalto(solapa, `Salto de la v${de.v} a la v${a.v}${q.script ? ` (scripts ${q.script})` : ""} — ${q.que}`.slice(0, 250), de, a, partesDe(a.v))
  resumenSaltos.push({ de: de.v, a: a.v, solapa, ...r, tipo: q.tipo, que: q.que })
}
// De punta a punta
const pp = hojaSalto("De punta a punta", `DE PUNTA A PUNTA: la v${cadena[0].v} contra la v${cadena[cadena.length - 1].v} — todo lo que entró, salió o cambió en el recorrido`, cadena[0], cadena[cadena.length - 1], [], false)

// ── 4 · Resumen (índice) + Versiones + Scripts (copiados del seguimiento)
const r: unknown[][] = [[T("SEGUIMIENTO AUDITABLE — H para auditar MSA 25/26: de dónde empezamos y dónde terminamos")],
  [N("Cada salto de números entre una versión y la anterior tiene su solapa: arriba la explicación (la misma del seguimiento) y abajo CADA CUOTA que entró, salió, cambió de importe o de solapa, ordenada por responsable → agrupadora → template → fecha, con su contable e interno. Al pie de cada resumen, el control: la suma de los componentes tiene que dar el salto. Sólo lee los Excel ya generados: no cambia ningún dato.")], [],
  ["", "Primera versión", "Última versión", "Diferencia"].map(C),
  ["Total de las cuotas", IMP(tot(cadena[0].cuotas)), IMP(tot(cadena[cadena.length - 1].cuotas)), IMP(tot(cadena[cadena.length - 1].cuotas) - tot(cadena[0].cuotas))],
  ["Cantidad de cuotas", { t: "n", v: cadena[0].cuotas.length, z: "0" }, { t: "n", v: cadena[cadena.length - 1].cuotas.length, z: "0" }, { t: "n", v: cadena[cadena.length - 1].cuotas.length - cadena[0].cuotas.length, z: "0" }],
  ["", `v${cadena[0].v} (${cadena[0].archivo})`, `v${cadena[cadena.length - 1].v}`, { t: "s", v: `➜ De punta a punta (${pp.n} cuotas) — ${pp.cierra ? "✓ cierra" : "⚠️ no cierra"}`, l: { Target: "#'De punta a punta'!A1" } }], [],
  [SUB("Los saltos, en orden (clic para ir)")], ["Salto", "Ir a", "Qué cambió", "Diferencia en el total", "Cuotas que cambiaron de plata o lugar", "Cambios sin plata", "¿Cierra?"].map(C)]
for (const s of resumenSaltos) r.push([`v${s.de} → v${s.a}`, { t: "s", v: `➜ ${s.solapa}`, l: { Target: `#'${s.solapa}'!A1` }, s: { font: { color: { rgb: "FF0563C1" }, underline: true } } }, N(s.que),
  IMP(s.salto), { t: "n", v: s.n, z: "0" }, { t: "n", v: s.sinPlata, z: "0" }, s.cierra ? "✓ cierra" : "⚠️ no cierra"])
const iS = 11, fS = 10 + resumenSaltos.length
r.push(["", "", "SUMA DE LOS SALTOS", F(`SUM(D${iS}:D${fS})`, resumenSaltos.reduce((t, s) => t + s.salto, 0)), "", "", { t: "s", f: `IF(ABS(D${fS + 1}-D5)<0.01,"✓ = la diferencia de punta a punta","⚠️ no da la diferencia")`, v: Math.abs(resumenSaltos.reduce((t, s) => t + s.salto, 0) - (tot(cadena[cadena.length - 1].cuotas) - tot(cadena[0].cuotas))) < 0.01 ? "✓ = la diferencia de punta a punta" : "⚠️ no da la diferencia" }])
r.push([], [N(`Las versiones que no aparecen como salto no movieron ningún número (fueron de presentación). La v32 se descartó (salió con las compras en dólares restando) y no entra en la cadena. Todas las versiones con su descripción, en «Versiones»; los scripts de datos, en «Scripts de datos».`)])
agregarHoja(wb as any, "Resumen", r, [20, 30, 70, 18, 16, 14, 26].map(ancho => ({ ancho })) as any)
// 📐 JMS 11/11 (lo dejó así a mano en la v1): la explicación de la fila 2 ocupa A:F, con el alto para leerla entera
{ const ws = wb.Sheets["Resumen"]; ws["!merges"] = [...(ws["!merges"] ?? []), XLSX.utils.decode_range("A2:F2")]; const rs: any[] = (ws["!rows"] ??= []); rs[1] = { ...(rs[1] ?? {}), hpt: 61.5 } }
agregarHoja(wb as any, "Versiones", filasVers.map(row => row.map(x => (typeof x === "number" ? IMP(x) : x))) as unknown[][], [8, 9, 18, 20, 11, 16, 12, 18, 9, 14, 16, 14, 13, 90, 12].map(ancho => ({ ancho })) as any)
agregarHoja(wb as any, "Scripts de datos", filasScripts as unknown[][], [8, 12, 90, 55, 50, 12].map(ancho => ({ ancho })) as any)
wb.SheetNames = ["Resumen", "De punta a punta", ...wb.SheetNames.filter(n => !["Resumen", "De punta a punta", "Versiones", "Scripts de datos"].includes(n)), "Versiones", "Scripts de datos"]
const base = `Seguimiento auditable H para auditar (2026-11-10)`
const nv = (f: string) => Number(f.match(/ v(\d+)\.xlsx$/)?.[1] ?? 0)
const destino = join(CARPETA, `${base} v${Math.max(0, ...readdirSync(CARPETA).filter(f => f.startsWith(base)).map(nv)) + 1}.xlsx`)
if (existsSync(destino)) throw new Error("ya existe " + destino)
const vs = vistasDe(wb as any); const orden = ["Resumen", "De punta a punta"]
// las vistas van en el orden en que se agregaron las hojas; se reordenan igual que SheetNames
const agregadas = [...resumenSaltos.map(s => s.solapa), "De punta a punta", "Resumen", "Versiones", "Scripts de datos"]
const vistaDe = new Map(agregadas.map((n, i) => [n, vs[i]]))
writeFileSync(destino, Buffer.from(await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array", cellDates: true }) as ArrayBuffer, wb.SheetNames.map(n => vistaDe.get(n) ?? {}) as any)))
console.log("📄", destino); console.log(`versiones leídas: ${datos.length} · saltos: ${resumenSaltos.length} · punta a punta: ${pp.n} cuotas, ${pp.cierra ? "cierra" : "NO cierra"}`); void orden
for (const s of resumenSaltos) console.log(` v${s.de}→v${s.a}  ${s.salto.toFixed(2)}  ${s.n} renglones  ${s.sinPlata} sin plata  ${s.cierra ? "✓" : "⚠️"}`)
