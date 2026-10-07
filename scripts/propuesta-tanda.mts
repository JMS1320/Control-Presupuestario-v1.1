/**
 * 🧾 **Propuesta de carga de una TANDA del histórico jul-25 → ene-26** (A-DAT-68, 2026-10-07).
 *
 * Lee las marcas «tanda» que el usuario deja en el libro de templates sugeridos (solapas 01 y 03) y arma
 * un Excel APARTE con cómo se cargaría cada template — cuota por cuota, con los movimientos que la forman y
 * su detalle — para que él decida antes de escribir nada. **No escribe en la base.**
 *
 *     npx tsx scripts/propuesta-tanda.mts 1
 *
 * Modo por template (propuesta, lo decide el usuario):
 *   · «una cuota por pago»: pagos discretos (cargas sociales, UATRE, IIBB mensual, CZ Ganadera) — cada
 *     movimiento es una cuota, con su detalle;
 *   · «total del mes»: gastos del banco de muchos movimientos chicos (comisiones, impuestos bancarios) — una
 *     cuota por mes, neta de las devoluciones del mes.
 * Todas en estado «anterior».
 *
 * 🧮 Control (como lo pide el usuario, en el resumen): débitos y créditos de los movimientos de la tanda
 * contra la suma de las cuotas propuestas, por separado, con fórmulas a los subtotales — cierra en 0.
 */
import { createRequire } from "node:module"
import { readFileSync, writeFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx") as typeof import("xlsx")

const TANDA = process.argv[2] || "1"
const DIR = "- Comunicacion JMS Claude - Archivos/Balance/"
const LIBRO = DIR + "Extracto_2025-07_a_2026-01_TEMPLATES_SUGERIDOS.xlsx"
const SALIDA = DIR + `Tanda ${TANDA} - propuesta de carga.xlsx`

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)
const r2 = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown) => typeof v === "number" ? v : (parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")) || 0)
const tx = (v: unknown) => String(v ?? "").trim()
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const nombreMes = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
const ultimoDia = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }
const dmy = (iso: string) => iso.split("-").reverse().join("/")

// ── El libro del usuario ──
const wbIn = XLSX.read(readFileSync(LIBRO), { type: "buffer" })
const filas = (hoja: string) => XLSX.utils.sheet_to_json<unknown[]>(wbIn.Sheets[hoja], { header: 1, raw: true, defval: "" })
const h01 = filas("01 Por template y mes"), h02 = filas("02 Movimientos"), h03 = filas("03 Sin sugerencia")
const colTanda = (hdr: unknown[]) => hdr.findIndex(h => /tanda/i.test(tx(h)))
const esDeLaTanda = (v: unknown) => tx(v).startsWith(TANDA + " ") || tx(v).startsWith(TANDA + "-")

/** Los templates de la tanda (solapa 01) y qué dijo el usuario de cada uno. */
const iT01 = colTanda(h01[0] as unknown[])
const templates = new Map<string, string>()
for (const r of h01.slice(1) as unknown[][]) if (tx(r[0]) && esDeLaTanda(r[iT01])) templates.set(tx(r[0]), tx(r[iT01]))

/** Movimientos desde 03 que el usuario manda a un template («1 - agregar a …»). */
const ALIAS: [RegExp, string][] = [
  [/debitos\s*\/\s*creditos/i, "Debitos / Creditos"], [/\bIVA\b/i, "Iva Bancario"],
  [/comision transferencias/i, "Comision Transferencias"], [/cargas sociales/i, "Cargas Sociales"],
  [/CZ Ganader/i, "CZ Ganadera"],
]
interface Mov { fecha: string; desc: string; detalle: string; deb: number; cre: number; template: string; origen: string; aviso: string }
const movs: Mov[] = []
const iT03 = colTanda(h03[0] as unknown[])
for (const r of h03.slice(1) as unknown[][]) {
  if (!esDeLaTanda(r[iT03]) || !/^\d{4}-\d{2}-\d{2}$/.test(tx(r[0]))) continue
  const destino = ALIAS.find(([re]) => re.test(tx(r[iT03])))?.[1]
  if (!destino) continue
  movs.push({ fecha: tx(r[0]), desc: tx(r[1]), detalle: tx(r[5]), deb: num(r[2]), cre: num(r[3]), template: destino, origen: "03 · " + tx(r[iT03]), aviso: "" })
}
for (const r of h02.slice(1) as unknown[][]) {
  const t = tx(r[6])
  if (!templates.has(t) || !tx(r[10]).toLowerCase().startsWith("s") || !/^\d{4}-\d{2}-\d{2}$/.test(tx(r[0]))) continue
  // ⚠️ UATRE: la sugerencia por importe se llevó compras con débito que no son UATRE.
  const aviso = t === "UATRE" && !/uatre/i.test(tx(r[5])) ? "⚠ NO es UATRE (compra con débito): no se carga en esta tanda" : ""
  movs.push({ fecha: tx(r[0]), desc: tx(r[1]), detalle: tx(r[5]), deb: num(r[2]), cre: num(r[3]), template: t, origen: "02 · " + tx(r[8]), aviso })
}
movs.sort((a, b) => a.template.localeCompare(b.template) || a.fecha.localeCompare(b.fecha))

const POR_PAGO = new Set(["Cargas Sociales", "UATRE", "IIBB Mensual MSA", "CZ Ganadera"])

// ── Los templates en la app (si hay dos de MSA con el mismo nombre, el que ya tiene cuotas en el período) ──
const { data: tpls } = await sb.from("egresos_sin_factura").select("id, nombre_referencia, categ, año, template_master_id")
  .eq("responsable", "MSA").eq("activo", true).in("nombre_referencia", [...templates.keys()])
const { data: cuotasApp } = await sb.from("cuotas_egresos_sin_factura").select("id, egreso_id, fecha_estimada, monto, estado")
  .in("egreso_id", (tpls || []).map((t: any) => t.id)).gte("fecha_estimada", "2025-07-01").lte("fecha_estimada", "2026-01-31")
const tplDe = (nombre: string) => {
  const c = (tpls || []).filter((t: any) => t.nombre_referencia === nombre)
  return c.sort((a: any, b: any) => (cuotasApp || []).filter((q: any) => q.egreso_id === b.id).length - (cuotasApp || []).filter((q: any) => q.egreso_id === a.id).length)[0] as any
}

// ── Las cuotas propuestas ──
interface Cuota { template: string; fecha: string; monto: number; tipo: string; descripcion: string; accion: string; nMovs: number; deb: number; cre: number }
const cuotas: Cuota[] = []
const usadas = new Set<string>()
const accionPara = (tpl: any, ym: string) => {
  const libre = (cuotasApp || []).find((q: any) => q.egreso_id === tpl?.id && String(q.fecha_estimada).startsWith(ym) && Number(q.monto) === 0 && !usadas.has(q.id))
  if (libre) { usadas.add(libre.id); return `actualizar la cuota en $0 del ${dmy(String(libre.fecha_estimada))}` }
  return "crear"
}
for (const nombre of templates.keys()) {
  const tpl = tplDe(nombre)
  const suyos = movs.filter(m => m.template === nombre && !m.aviso)
  if (POR_PAGO.has(nombre)) {
    for (const m of suyos) {
      const tipo = m.cre > 0 && !m.deb ? "ingreso" : "egreso"
      cuotas.push({ template: nombre, fecha: m.fecha, monto: r2(m.deb || m.cre), tipo,
        descripcion: `${m.detalle || m.desc}${tipo === "ingreso" ? " (devolución / anulación)" : ""} — histórico`,
        accion: tipo === "egreso" ? accionPara(tpl, m.fecha.slice(0, 7)) : "crear", nMovs: 1, deb: m.deb, cre: m.cre })
    }
  } else {
    const porMes = new Map<string, Mov[]>()
    for (const m of suyos) porMes.set(m.fecha.slice(0, 7), [...(porMes.get(m.fecha.slice(0, 7)) || []), m])
    for (const [ym, ms] of [...porMes.entries()].sort()) {
      const deb = r2(ms.reduce((s, m) => s + m.deb, 0)), cre = r2(ms.reduce((s, m) => s + m.cre, 0))
      const neto = r2(deb - cre)
      cuotas.push({ template: nombre, fecha: ultimoDia(ym), monto: Math.abs(neto), tipo: neto >= 0 ? "egreso" : "ingreso",
        descripcion: `${nombre} ${nombreMes(ym)} (${ms.length} mov.${cre ? `, neto de devoluciones ${cre.toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : ""}) — histórico`,
        accion: accionPara(tpl, ym), nMovs: ms.length, deb, cre })
    }
  }
}

// ── El Excel ──
const wb = XLSX.utils.book_new()
const fmtNum = (ws: XLSX.WorkSheet) => { for (const [a, c] of Object.entries(ws)) if (!a.startsWith("!") && typeof (c as any).v === "number") (c as any).z = "#,##0.00" }

// 02 · los movimientos, uno por uno (subtotales al pie)
const f02: unknown[][] = [["Template", "Fecha", "Descripción del banco", "Su detalle", "Débito", "Crédito", "De dónde viene", "Aviso"]]
for (const m of movs) f02.push([m.template, dmy(m.fecha), m.desc, m.detalle, m.deb || "", m.cre || "", m.origen, m.aviso])
const n02 = f02.length
f02.push([], ["TOTAL movimientos de la tanda", "", "", "", { f: `SUM(E2:E${n02})` }, { f: `SUM(F2:F${n02})` }])
f02.push(["  de esos, NO se cargan (avisos)", "", "", "", { f: `SUMIFS(E2:E${n02},H2:H${n02},"⚠*")` }, { f: `SUMIFS(F2:F${n02},H2:H${n02},"⚠*")` }])
const ws02 = XLSX.utils.aoa_to_sheet(f02); fmtNum(ws02)
ws02["!cols"] = [{ wch: 26 }, { wch: 11 }, { wch: 36 }, { wch: 44 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 52 }]

// 01 · las cuotas propuestas (subtotales al pie)
const f01: unknown[][] = [["Template", "Modo", "Fecha", "Tipo", "Monto", "Descripción de la cuota", "Qué se hace en la app", "Movimientos", "Débitos que la forman", "Créditos que la forman"]]
for (const c of cuotas) f01.push([c.template, POR_PAGO.has(c.template) ? "una cuota por pago" : "total del mes",
  dmy(c.fecha), c.tipo, c.monto, c.descripcion, c.accion, c.nMovs, c.deb, c.cre])
const n01 = f01.length
f01.push([], ["TOTAL cuotas propuestas", "", "", "", "", "", "", { f: `SUM(H2:H${n01})` }, { f: `SUM(I2:I${n01})` }, { f: `SUM(J2:J${n01})` }])
const ws01 = XLSX.utils.aoa_to_sheet(f01); fmtNum(ws01)
ws01["!cols"] = [{ wch: 26 }, { wch: 18 }, { wch: 11 }, { wch: 8 }, { wch: 15 }, { wch: 70 }, { wch: 36 }, { wch: 11 }, { wch: 18 }, { wch: 18 }]

// 00 · resumen por template + CONTROL (fórmulas a los subtotales)
const f00: unknown[][] = [
  [`TANDA ${TANDA} — propuesta de carga del histórico jul-2025 → ene-2026 en templates MSA (estado «anterior»). NO cargado: es para revisar.`],
  [],
  ["Template", "Lo que marcaste", "Modo propuesto", "Cuotas", "a crear", "a actualizar (la de $0 del mes)", "Débitos", "Créditos", "Neto", "Template en la app"],
]
for (const [nombre, marca] of templates) {
  const cs = cuotas.filter(c => c.template === nombre)
  const deb = r2(cs.reduce((s, c) => s + c.deb, 0)), cre = r2(cs.reduce((s, c) => s + c.cre, 0))
  const tpl = tplDe(nombre)
  f00.push([nombre, marca, POR_PAGO.has(nombre) ? "una cuota por pago" : "total del mes", cs.length,
    cs.filter(c => c.accion === "crear").length, cs.filter(c => c.accion !== "crear").length, deb, cre, r2(deb - cre),
    tpl ? `${tpl.categ} · año ${tpl.año}` : "⚠ NO EXISTE"])
}
const n00 = f00.length
f00.push([], ["CONTROL", "", "", "", "", "", "Débitos", "Créditos"])
const cBase = n00 + 2
f00.push(["Movimientos de la tanda (02)", "", "", "", "", "", { f: `'02 Movimientos'!E${n02 + 2}` }, { f: `'02 Movimientos'!F${n02 + 2}` }])
f00.push(["− los que no se cargan (avisos)", "", "", "", "", "", { f: `'02 Movimientos'!E${n02 + 3}` }, { f: `'02 Movimientos'!F${n02 + 3}` }])
f00.push(["= a cargar, por diferencia", "", "", "", "", "", { f: `G${cBase + 1}-G${cBase + 2}` }, { f: `H${cBase + 1}-H${cBase + 2}` }])
f00.push(["Cuotas propuestas (01)", "", "", "", "", "", { f: `'01 Cuotas propuestas'!I${n01 + 2}` }, { f: `'01 Cuotas propuestas'!J${n01 + 2}` }])
f00.push(["control (tiene que dar 0)", "", "", "", "", "", { f: `G${cBase + 3}-G${cBase + 4}` }, { f: `H${cBase + 3}-H${cBase + 4}` }])
const ws00 = XLSX.utils.aoa_to_sheet(f00); fmtNum(ws00)
ws00["!cols"] = [{ wch: 30 }, { wch: 46 }, { wch: 18 }, { wch: 8 }, { wch: 8 }, { wch: 28 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 40 }]

XLSX.utils.book_append_sheet(wb, ws00, "00 Resumen")
XLSX.utils.book_append_sheet(wb, ws01, "01 Cuotas propuestas")
XLSX.utils.book_append_sheet(wb, ws02, "02 Movimientos")
writeFileSync(SALIDA, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))

const totD = r2(movs.reduce((s, m) => s + m.deb, 0)), totC = r2(movs.reduce((s, m) => s + m.cre, 0))
const noD = r2(movs.filter(m => m.aviso).reduce((s, m) => s + m.deb, 0)), noC = r2(movs.filter(m => m.aviso).reduce((s, m) => s + m.cre, 0))
const cD = r2(cuotas.reduce((s, c) => s + c.deb, 0)), cC = r2(cuotas.reduce((s, c) => s + c.cre, 0))
console.log(`Excel: ${SALIDA}`)
console.log(`templates ${templates.size} · movimientos ${movs.length} · cuotas ${cuotas.length} (crear ${cuotas.filter(c => c.accion === "crear").length})`)
console.log(`control débitos ${r2(totD - noD - cD)} · créditos ${r2(totC - noC - cC)}`)
for (const [n] of templates) if (!tplDe(n)) console.log("⚠ template inexistente:", n)
