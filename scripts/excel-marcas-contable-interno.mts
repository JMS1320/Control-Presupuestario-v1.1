/**
 * 🏷️ Excel de trabajo — TODOS los movimientos con algo anotado en CONTABLE o en INTERNO, ejercicio 25/26. SÓLO LEE la base.
 *
 *     npx tsx scripts/excel-marcas-contable-interno.mts
 *
 * JMS 06/11: *«si hay información en contable o interno, es porque ahí yo tengo que ver algo… precisaría un Excel con todos los
 * movimientos en contable o en interno»*. Las preguntas de «Temas abiertos» salían de esas marcas; este Excel las muestra TODAS juntas,
 * para revisarlas de una vez.
 *
 * De dónde sale la marca: la columna `contable` / `interno` del movimiento, o —en el histórico jul-25 → ene-26, que se cargó sin esas
 * columnas— la NOTA del movimiento («📜 Histórico… tu planilla: … Contable X · Interno Y»). La columna «De dónde» lo dice.
 * Todas las cuentas de las tres empresas (bancos, tarjetas, cajas, dólares). Débito y crédito separados (regla de los Excel de control).
 * Solapas: por CONTABLE y por INTERNO (resumen por mes con los 2 semestres y Nro que filtra el detalle), y las COMBINACIONES.
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { fechasReales } from "../lib/excel/fechas-reales"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"
import { hojaResumenPorMes } from "../lib/balance/resumen-por-mes"
import { agregarHoja } from "../lib/balance/export-libro-diario"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DESDE = "2025-07-01", HASTA = "2026-06-30", HOY = "2026-11-06"
const MESES = ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]
const ROT = ["jul-25", "ago-25", "sep-25", "oct-25", "nov-25", "dic-25", "ene-26", "feb-26", "mar-26", "abr-26", "may-26", "jun-26"]
const meses = MESES.map((clave, i) => ({ clave, rotulo: ROT[i] }))
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const r2 = (x: number) => Math.round(x * 100) / 100
const dmy = (f: string) => f.split("-").reverse().join("/")

async function todo(q: (d: number, h: number) => any): Promise<any[]> {
  const out: any[] = []
  for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break }
  return out
}

// El template de cada movimiento (cuota o grupo de cuotas), para que se entienda qué pagó
const cuotas = await todo((d, h) => sb.from("cuotas_egresos_sin_factura").select("id, egreso_id, grupo_pago_id").order("id").range(d, h))
const egresos = new Map((await todo((d, h) => sb.from("egresos_sin_factura").select("id, nombre_referencia, responsable").order("id").range(d, h))).map((e: any) => [e.id, e]))
const tplDe = new Map<string, string>()
for (const c of cuotas) {
  const e: any = egresos.get(c.egreso_id); if (!e) continue
  const t = `${e.nombre_referencia}${e.responsable ? ` (${e.responsable})` : ""}`
  tplDe.set(c.id, t)
  if (c.grupo_pago_id) tplDe.set(c.grupo_pago_id, tplDe.has(c.grupo_pago_id) && tplDe.get(c.grupo_pago_id) !== t ? `${tplDe.get(c.grupo_pago_id)!.split(" + ")[0]} + otros (grupo)` : t)
}

type Fila = { fecha: string; mes: string; cuenta: string; titular: string; usd: boolean; desc: string; detalle: string; contra: string; deb: number; cred: number
  categ: string; tpl: string; estado: string; contable: string; interno: string; de: string; nota: string }
const filas: Fila[] = []
const fallaron: string[] = []
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const q = (d: number, h: number) => (t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)).select("*").gte("fecha", DESDE).lte("fecha", HASTA).order("id").range(d, h)
  let movs: any[] = []
  try { movs = await todo(q) } catch (e: any) { fallaron.push(`${t.cuenta}: ${e.message}`); continue }
  for (const m of movs) {
    const nTxt = String(m.nota_operador ?? "")
    const deNota = (k: string) => (/tu planilla/i.test(nTxt) ? new RegExp(`${k}\\s+([^·]+)`, "i").exec(nTxt)?.[1]?.trim() ?? "" : "")
    const cCol = String(m.contable ?? "").trim(), iCol = String(m.interno ?? "").trim()
    const contable = cCol || deNota("Contable"), interno = iCol || deNota("Interno")
    if (!contable && !interno) continue
    const de = cCol || iCol ? (deNota("Contable") || deNota("Interno") ? "columna (y la nota del histórico)" : "columna") : "nota del histórico (tu planilla)"
    const fecha = String(m.fecha).slice(0, 10)
    filas.push({ fecha, mes: fecha.slice(0, 7), cuenta: t.cuenta, titular: String(t.titular), usd: !!(t as any).enDolares,
      desc: String(m.descripcion ?? "").slice(0, 80), detalle: String(m.detalle ?? "").trim(),
      contra: String(m.leyendas_adicionales_1 ?? m.proveedor_nombre ?? "").trim(),
      deb: r2(Number(m.debitos) || 0), cred: r2(Number(m.creditos) || 0), categ: String(m.categ ?? ""),
      tpl: m.template_cuota_id ? tplDe.get(m.template_cuota_id) ?? "(cuota no encontrada)" : m.sueldo_pago_id ? "Sueldo" : m.comprobante_arca_id ? "Factura" : "",
      estado: String(m.estado ?? ""), contable, interno, de, nota: nTxt.slice(0, 220) })
  }
}
filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.cuenta.localeCompare(b.cuenta))

const ENC = ["Fecha", "Cuenta", "Empresa de la cuenta", "Descripción del banco", "Detalle", "Contraparte (leyendas)", "CATEG", "Template / vínculo", "Estado", "Contable", "Interno", "De dónde sale la marca", "Nota del movimiento"]
const item = (f: Fila, categoria: string) => ({ categoria, mes: f.mes, importe: r2(f.deb - f.cred), moneda: (f.usd ? "USD" : "ARS") as "ARS" | "USD",
  orden: `${f.fecha}|${f.cuenta}`,
  columnas: [dmy(f.fecha), f.cuenta, f.titular, f.desc, f.detalle, f.contra, f.categ, f.tpl, f.estado, f.contable || "(vacío)", f.interno || "(vacío)", f.de, f.nota] })
const notas = [
  "Todos los movimientos de las cuentas de MSA, PAM y MA (bancos, tarjetas, cajas y dólares) que tienen algo anotado en CONTABLE o en INTERNO.",
  "En el histórico (jul-25 → ene-26) la marca viene de la nota de tu planilla; la columna «De dónde sale la marca» lo dice. Débito = salió plata · crédito = entró.",
  "Filtrá el detalle por Nro para ver cómo se compone cada renglón del resumen. Pesos y dólares van en bloques separados.",
]
const porContable = hojaResumenPorMes(filas.filter(f => f.contable).map(f => item(f, f.contable)), {
  titulo: `MARCAS EN CONTABLE — ejercicio 25/26 (${filas.filter(f => f.contable).length} movimientos)`, notas, meses, encabezadoDetalle: ENC,
  rotuloImporte: "Neto (débito − crédito)", semestres: true, porMoneda: true })
const porInterno = hojaResumenPorMes(filas.filter(f => f.interno).map(f => item(f, f.interno)), {
  titulo: `MARCAS EN INTERNO — ejercicio 25/26 (${filas.filter(f => f.interno).length} movimientos)`, notas, meses, encabezadoDetalle: ENC,
  rotuloImporte: "Neto (débito − crédito)", semestres: true, porMoneda: true })
// Las combinaciones contable × interno: dónde las dos marcas dicen cosas distintas
const comb = new Map<string, { n: number; deb: number; cred: number; cuentas: Set<string>; de: Set<string> }>()
for (const f of filas) {
  const k = `${f.contable || "(vacío)"}\u0000${f.interno || "(vacío)"}\u0000${f.usd ? "USD" : "ARS"}`
  const x = comb.get(k) ?? { n: 0, deb: 0, cred: 0, cuentas: new Set(), de: new Set() }
  x.n++; x.deb = r2(x.deb + f.deb); x.cred = r2(x.cred + f.cred); x.cuentas.add(f.cuenta); x.de.add(f.de); comb.set(k, x)
}
const combinaciones: unknown[][] = [["COMBINACIONES CONTABLE × INTERNO — cuántos movimientos tiene cada par y por cuánto"],
  ["Sirve para ver dónde las dos marcas dicen cosas distintas (p. ej. contable vacío e interno «DIST MA»). El detalle, en las otras dos solapas."], [],
  ["Contable", "Interno", "Moneda", "Movimientos", "Débitos", "Créditos", "Neto", "Cuentas", "De dónde sale la marca"],
  ...[...comb].sort((a, b) => a[0].localeCompare(b[0])).map(([k, x]) => { const [c, i, mon] = k.split("\u0000")
    return [c, i, mon, x.n, x.deb, x.cred, r2(x.deb - x.cred), [...x.cuentas].join(", "), [...x.de].join(" · ")] }),
  [], ["TOTAL", "", "", filas.length, r2(filas.reduce((t, f) => t + f.deb, 0)), r2(filas.reduce((t, f) => t + f.cred, 0)), r2(filas.reduce((t, f) => t + f.deb - f.cred, 0))],
  ...(fallaron.length ? [[], ["⚠️ No se pudieron leer:", fallaron.join(" · ")]] : [])]

// 🏷️ JMS 06/11: «las marcas diferentes también me tenés que dejar todo en ese mismo Excel, para ver todas las marcas que dejé anotadas».
// Cada marca TAL COMO ESTÁ ESCRITA, con su columna (contable / interno); las que parecen la misma escrita distinto («AMS CTA» y «CTA AMS»,
// «X» y «x», «Desglosar» y «DESGLOSAR») comparten «Grupo» para que se vean juntas. No se unifica nada: eso lo decide JMS.
const claveGrupo = (m: string) => m.toUpperCase().replace(/\s+/g, " ").trim().split(" ").sort().join(" ")
type Marca = { donde: string; marca: string; n: number; deb: number; cred: number; cuentas: Set<string>; deNota: number }
const marcas = new Map<string, Marca>()
for (const f of filas) for (const [donde, marca] of [["Contable", f.contable], ["Interno", f.interno]] as const) {
  if (!marca) continue
  const k = `${donde}\u0000${marca}`
  const x = marcas.get(k) ?? { donde, marca, n: 0, deb: 0, cred: 0, cuentas: new Set<string>(), deNota: 0 }
  x.n++; x.deb = r2(x.deb + f.deb); x.cred = r2(x.cred + f.cred); x.cuentas.add(f.cuenta); if (f.de.startsWith("nota")) x.deNota++
  marcas.set(k, x)
}
const grupos = new Map<string, string[]>()
for (const m of marcas.values()) { const g = claveGrupo(m.marca); grupos.set(g, [...new Set([...(grupos.get(g) ?? []), m.marca])]) }
const listaMarcas = [...marcas.values()].sort((a, b) => claveGrupo(a.marca).localeCompare(claveGrupo(b.marca)) || a.donde.localeCompare(b.donde) || a.marca.localeCompare(b.marca))
const todasLasMarcas: unknown[][] = [["TODAS LAS MARCAS — cada una tal como está escrita, en contable y en interno (ejercicio 25/26)"],
  ["Ordenadas para que las que parecen la misma marca escrita distinto queden juntas (columna «Otras formas de escribirla»). Para ver sus movimientos: solapa «Por contable» o «Por interno», filtrando por la marca."],
  [`${listaMarcas.length} marcas distintas · ${[...grupos.values()].filter(v => v.length > 1).length} con más de una forma de escribirse · ${filas.filter(f => f.de.startsWith("nota")).length} movimientos con la marca sólo en la nota del histórico`], [],
  ["Columna", "Marca (tal como está)", "Otras formas de escribirla", "Movimientos", "de la nota del histórico", "Débitos", "Créditos", "Neto", "Cuentas", "Tu respuesta (qué es / con cuál unificar)"],
  ...listaMarcas.map(m => { const otras = (grupos.get(claveGrupo(m.marca)) ?? []).filter(x => x !== m.marca)
    return [m.donde, m.marca, otras.length ? `⚠️ ${otras.join(" · ")}` : "", m.n, m.deNota || "", m.deb, m.cred, r2(m.deb - m.cred), [...m.cuentas].join(", "), ""] })]

if (!existsSync(CARPETA)) mkdirSync(CARPETA, { recursive: true })
const nombre = (b: string) => { let p = join(CARPETA, `${b}.xlsx`), v = 2; while (existsSync(p)) p = join(CARPETA, `${b} v${v++}.xlsx`); return p }
const wb = XLSX.utils.book_new()
agregarHoja(wb, "Todas las marcas", todasLasMarcas); agregarHoja(wb, "Por contable", porContable); agregarHoja(wb, "Por interno", porInterno); agregarHoja(wb, "Combinaciones", combinaciones)
fechasReales(wb as any)
const p = nombre(`Marcas contable e interno 25-26 (${HOY})`); XLSX.writeFile(wb, p)

console.log(`movimientos con marca: ${filas.length} · con contable ${filas.filter(f => f.contable).length} · con interno ${filas.filter(f => f.interno).length} · de la nota del histórico ${filas.filter(f => f.de.startsWith("nota")).length}`)
const porC = new Map<string, number>(); for (const f of filas) if (f.contable) porC.set(f.contable, (porC.get(f.contable) ?? 0) + 1)
console.log("contable:", [...porC].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · "))
const porI = new Map<string, number>(); for (const f of filas) if (f.interno) porI.set(f.interno, (porI.get(f.interno) ?? 0) + 1)
console.log("interno:", [...porI].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · "))
if (fallaron.length) console.log("⚠️", fallaron.join(" · "))
console.log(`📄 ${p}`)
