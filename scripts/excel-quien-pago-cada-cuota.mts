/**
 * 👥 QUIÉN PAGÓ CADA CUOTA — de los templates que se pagaron por retiro aunque sea una vez (A-FEAT-1577 punto 13). SÓLO LEE.
 *
 *     npx tsx scripts/excel-quien-pago-cada-cuota.mts
 *
 * JMS 07/11: «las listas de las cosas que se pagaron vía retiros (aunque sea 1 cuota) y ver todas las cuotas de cada caso viendo quién pagó
 * cada cosa — ej. Libertad: las 3 primeras las pagó X, la 4ª ella, de la 5ª en adelante Y».
 *
 * Entra un template si en el ejercicio 25/26 alguna de sus cuotas se pagó (1) con código CTA / DIST / LIB, o (2) desde la cuenta de alguien que
 * no es su responsable. De ese template se listan TODAS sus cuotas (menos las desactivadas), cada una con quién la pagó (cuenta, fecha, código).
 * Avisos por cuota: marcada pagada sin movimiento en el banco · dos movimientos para la misma cuota · un bien pagado con un código que no respeta
 * la regla del corte (lib/balance/dueno-de-bienes.ts).
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"
import { duenoDelBien, codigoEsperado, type Empresa } from "../lib/balance/dueno-de-bienes"
import { agregarHoja } from "../lib/balance/export-libro-diario"
import { fechasReales } from "../lib/excel/fechas-reales"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const D = "2025-07-01", H = "2026-06-30", HOY = "2026-11-07"
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const r2 = (x: number) => Math.round(x * 100) / 100
async function todo(q: (d: number, h: number) => any): Promise<any[]> { const out: any[] = []; for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break } return out }
const desde = (s: string, t: string) => (s === "public" ? sb.from(t) : sb.schema(s).from(t))
const ES_RETIRO = /^\s*(CTA|DIST|LIB)\b/i

// ── Las cuotas con su template
const cuotas = await todo((d, h) => sb.from("cuotas_egresos_sin_factura")
  .select("id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, grupo_pago_id, egreso:egresos_sin_factura(id, nombre_referencia, responsable, cuenta_agrupadora, año)")
  .neq("estado", "desactivado").order("id").range(d, h))
const cuotaPorId = new Map(cuotas.map((c: any) => [c.id, c]))
const cuotasDeGrupo = new Map<string, any[]>()
for (const c of cuotas) if (c.grupo_pago_id) cuotasDeGrupo.set(c.grupo_pago_id, [...(cuotasDeGrupo.get(c.grupo_pago_id) ?? []), c])

// ── Todos los movimientos vinculados a una cuota o a un grupo de pago (sin filtro de fecha: una cuota puede haberse pagado antes del ejercicio)
type Pago = { cuotaId: string; tabla: string; cuenta: string; pagador: string; enDolares: boolean; id: string; fecha: string; imp: number; contable: string; interno: string; agrupado: number; desc: string }
const pagosDe = new Map<string, Pago[]>()
const sinLeer: string[] = []
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const q = (cols: string) => todo((d, h) => desde(t.schema, t.tabla).select(cols).not("template_cuota_id", "is", null).order("id").range(d, h))
  let movs: any[]
  try { movs = await q("id, fecha, debitos, creditos, descripcion, detalle, contable, interno, template_cuota_id") }
  catch { try { movs = await q("id, fecha, debitos, creditos, descripcion, detalle, contable, template_cuota_id") } catch (e: any) { sinLeer.push(`${t.schema}.${t.tabla}: ${e.message}`); continue } }
  for (const m of movs) {
    const directa = cuotaPorId.get(m.template_cuota_id)
    const delGrupo = cuotasDeGrupo.get(m.template_cuota_id) ?? []
    const destino = directa ? [directa] : delGrupo
    for (const c of destino) {
      const p: Pago = { cuotaId: c.id, tabla: `${t.schema}.${t.tabla}`, cuenta: t.cuenta ?? t.tabla, pagador: t.titular ?? "?", enDolares: !!t.enDolares, id: String(m.id),
        fecha: String(m.fecha).slice(0, 10), imp: r2(Number(m.debitos || 0) - Number(m.creditos || 0)), contable: String(m.contable ?? "").trim(), interno: String(m.interno ?? "").trim(),
        agrupado: directa ? 1 : delGrupo.length, desc: String(m.detalle ?? "").trim() || String(m.descripcion ?? "").trim() }
      pagosDe.set(c.id, [...(pagosDe.get(c.id) ?? []), p])
    }
  }
}

// ── Qué CASOS entran. Un caso = el mismo concepto aunque tenga un template por año o por responsable (ABL Libertad de PAM hasta dic y de MA
//    desde ene es UN caso). Entra si alguna cuota se pagó en el ejercicio con CTA/DIST/LIB o por alguien que no es su responsable.
//    No entran los templates que SON el retiro o el aporte («Retiro de MSA», «Aporte a MSA»): ahí no se pagó una cosa, se movió la plata.
const ES_EL_RETIRO = /^\s*(retiro|aporte)\b/i
const claveCaso = (n: string) => String(n ?? "").trim().toLowerCase().replace(/\s+/g, " ")
const responsables = (r: string) => String(r ?? "").toUpperCase().split("/").map(x => x.trim()).filter(Boolean)
const esRetiro = (p: Pago, resp: string) => ES_RETIRO.test(p.contable) || (p.imp > 0 && !responsables(resp).includes(p.pagador.toUpperCase()))
const casosQueEntran = new Set<string>()
const excluidos = new Set<string>()
for (const c of cuotas) {
  const tpl = c.egreso; if (!tpl) continue
  for (const p of pagosDe.get(c.id) ?? []) if (p.fecha >= D && p.fecha <= H && esRetiro(p, tpl.responsable)) {
    if (ES_EL_RETIRO.test(tpl.nombre_referencia)) excluidos.add(tpl.nombre_referencia); else casosQueEntran.add(claveCaso(tpl.nombre_referencia))
  }
}
const fechaRef = (c: any) => String(c.fecha_vencimiento ?? c.fecha_estimada ?? (pagosDe.get(c.id) ?? []).map(p => p.fecha).sort()[0] ?? "").slice(0, 10)
const enEjercicio = (c: any) => (fechaRef(c) >= D && fechaRef(c) <= H) || (pagosDe.get(c.id) ?? []).some(p => p.fecha >= D && p.fecha <= H)
const casos = [...casosQueEntran].map(k => {
  const suyas = cuotas.filter((c: any) => c.egreso && claveCaso(c.egreso.nombre_referencia) === k && enEjercicio(c))
    .sort((a: any, b: any) => fechaRef(a).localeCompare(fechaRef(b)) || (a.numero_cuota ?? 0) - (b.numero_cuota ?? 0))
  const tplsDelCaso = [...new Map(suyas.map((c: any) => [c.egreso.id, c.egreso])).values()]
  return { nombre: suyas[0]?.egreso.nombre_referencia ?? k, resp: [...new Set(tplsDelCaso.map((t: any) => t.responsable))].join(" → "),
    agrupadora: [...new Set(tplsDelCaso.map((t: any) => t.cuenta_agrupadora).filter(Boolean))].join(" / "), suyas }
}).filter(x => x.suyas.length).sort((a, b) => a.agrupadora.localeCompare(b.agrupadora) || a.nombre.localeCompare(b.nombre))

// ── El detalle: todas las cuotas del ejercicio de cada caso, una fila por pago (o una sola si no tiene)
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const mesCorto = (f: string) => (f ? `${MES[Number(f.slice(5, 7)) - 1]}-${f.slice(2, 4)}` : "s/f")
const detalle: unknown[][] = []
const resumen: Array<{ nro: number; caso: (typeof casos)[number]; secuencia: string; alertas: number; cuotas: number }> = []
let totAlertas = 0
casos.forEach((caso, i) => {
  const nro = i + 1
  const etiquetas: string[] = []
  let alertas = 0
  for (const c of caso.suyas) {
    const tpl = c.egreso
    const ps = (pagosDe.get(c.id) ?? []).sort((a, b) => a.fecha.localeCompare(b.fecha))
    const base = [nro, `${tpl.nombre_referencia} (${tpl.responsable}${tpl["año"] ? ` · ${tpl["año"]}` : ""})`, tpl.responsable, c.numero_cuota, fechaRef(c), r2(Number(c.monto) || 0), c.estado]
    if (!ps.length) {
      const aviso = ["pagado", "conciliado"].includes(c.estado) ? "🟡 marcada pagada pero sin movimiento en el banco (¿efectivo, otra cuenta, o falta conciliar?)" : ""
      if (aviso) alertas++
      etiquetas.push(["pagado", "conciliado"].includes(c.estado) ? "sin mov." : "pendiente")
      detalle.push([...base, "", "(sin movimiento)", "", "", "", "", "", "", aviso, ""]); continue
    }
    const debitos = ps.filter(p => p.imp > 0 && p.agrupado === 1)
    const pagadores = [...new Set(ps.filter(p => p.imp > 0).map(p => p.pagador))]
    etiquetas.push(pagadores.join("+") || ps[0].pagador)
    let conAviso = false
    for (const p of ps) {
      const avisos: string[] = []
      if (debitos.length > 1 && p.imp > 0 && p.agrupado === 1) avisos.push("🟡 la cuota tiene más de un pago (¿parcial o duplicado?)")
      const dueno = duenoDelBien({ nombre: tpl.nombre_referencia, responsable: tpl.responsable }, p.fecha)
      if (dueno && ["MSA", "PAM", "MA"].includes(p.pagador) && p.imp > 0) {
        const esp = codigoEsperado(p.pagador as Empresa, dueno)
        if ((esp ?? "").toUpperCase() !== p.contable.toUpperCase()) avisos.push(`🔴 bien de ${dueno} a esa fecha: el código tendría que ser «${esp ?? "vacío"}»`)
      }
      if (avisos.length) conAviso = true
      detalle.push([...base, p.pagador, p.cuenta + (p.enDolares ? " (USD)" : ""), p.fecha, p.imp, p.agrupado > 1 ? `pago agrupado de ${p.agrupado} cuotas` : "", p.contable || "(vacío)", p.interno || "(vacío)", p.desc, avisos.join(" · "), `${p.tabla}:${p.id}`])
    }
    if (conAviso) alertas++
  }
  // la secuencia comprimida por mes de vencimiento: «jul-25→sep-25 PAM · oct-25 MA · nov-25→jun-26 MSA»
  const tramos: string[] = []
  for (let k = 0; k < caso.suyas.length;) {
    let j = k; while (j + 1 < caso.suyas.length && etiquetas[j + 1] === etiquetas[k]) j++
    const a = mesCorto(fechaRef(caso.suyas[k])), b = mesCorto(fechaRef(caso.suyas[j]))
    const n = j - k + 1
    tramos.push(`${a === b ? a : `${a}→${b}`}${n > 1 ? ` (${n})` : ""} ${etiquetas[k]}`); k = j + 1
  }
  totAlertas += alertas
  resumen.push({ nro, caso, secuencia: tramos.join(" · "), alertas, cuotas: caso.suyas.length })
})

// ── El Excel: resumen (con fórmulas sobre el detalle) + detalle
const N = detalle.length, F0 = 6                      // el detalle arranca en la fila 6 de su solapa (encabezado en la 5)
const rango = (col: string) => `Detalle!$${col}$${F0}:$${col}$${F0 + N - 1}`
const PAGADORES = ["MSA", "PAM", "MA", "Cotitulares"]
const hojaR: unknown[][] = [
  ["QUIÉN PAGÓ CADA CUOTA — templates pagados por retiro al menos una vez (ejercicio 25/26)"],
  ["Entra un caso si alguna cuota se pagó en el ejercicio con código CTA / DIST / LIB, o desde la cuenta de alguien que no es su responsable. Un caso junta los templates del mismo concepto (por año o responsable). Se listan TODAS sus cuotas del ejercicio. No entran los templates que son el retiro mismo («Retiro…», «Aporte…»). Filtrá el detalle por Nro."],
  [`${casos.length} casos · ${N} renglones de detalle · ⚠️ ${totAlertas} cuotas con aviso${sinLeer.length ? ` · 🔴 no se pudo leer: ${sinLeer.join("; ")}` : ""}`],
  [],
  ["Nro", "Caso", "Responsable", "Agrupadora", "Cuotas del ejercicio", "Quién pagó cada cuota (por mes de vencimiento)", ...PAGADORES.map(p => `Pagó ${p} $`), "Sin movimiento (cuotas)", "Avisos"],
  ...resumen.map((r, i) => {
    const fila = F0 + i
    return [r.nro, r.caso.nombre, r.caso.resp, r.caso.agrupadora, r.cuotas, r.secuencia,
      ...PAGADORES.map(p => ({ t: "n", f: `SUMIFS(${rango("L")},${rango("A")},A${fila},${rango("H")},"${p}")`, v: r2(detalle.filter(d => d[0] === r.nro && d[7] === p).reduce((s, d) => s + Number(d[11] ? d[5] : d[10] || 0), 0)) })),
      { t: "n", f: `COUNTIFS(${rango("A")},A${fila},${rango("I")},"(sin movimiento)")`, v: detalle.filter(d => d[0] === r.nro && d[8] === "(sin movimiento)").length },
      { t: "n", f: `COUNTIFS(${rango("A")},A${fila},${rango("P")},"?*")`, v: r.alertas }]
  }),
]
// columnas del detalle: A Nro · B Template · C Resp · D Cuota · E Venc · F Monto · G Estado · H Pagó · I Cuenta · J Fecha · K Importe del movimiento ·
// L Importe para la cuota (en un pago agrupado, el monto de la cuota; si no, el del movimiento) · M Agrupado · N Contable · O Interno · P Aviso · Q Descripción · R Id
const hojaD: unknown[][] = [
  ["DETALLE — todas las cuotas de cada template, con quién pagó cada una"],
  ["Un renglón por pago (una cuota pagada en dos veces tiene dos). En un pago agrupado, «Importe para la cuota» toma el monto de la cuota (el movimiento paga varias)."],
  ["Código esperado de un bien: el dueño paga → vacío · MSA → CTA <dueño> · PAM por MA → DIST MA · MA por PAM → CTA PAM (corte PAM→MA 01/01/26)."],
  [],
  ["Nro", "Template", "Responsable", "Cuota", "Vencimiento (o fecha estimada)", "Monto cuota", "Estado cuota", "Pagó", "Cuenta", "Fecha del pago", "Importe del movimiento", "Importe para la cuota", "Agrupado", "Contable", "Interno", "Aviso", "Descripción", "Id"],
  ...detalle.map(r => [...r.slice(0, 11), r[10] === "" ? "" : (r[11] ? r[5] : r[10]), r[11], r[12], r[13], r[15], r[14], r[16]]),
]
const wb = XLSX.utils.book_new()
agregarHoja(wb, "Resumen", hojaR)
agregarHoja(wb, "Detalle", hojaD)
fechasReales(wb as any)
let p = join(CARPETA, `Quién pagó cada cuota 25-26 (${HOY}).xlsx`), v = 2
while (existsSync(p)) p = join(CARPETA, `Quién pagó cada cuota 25-26 (${HOY}) v${v++}.xlsx`)
XLSX.writeFile(wb, p)

console.log(`casos ${casos.length} · renglones ${N} · cuotas con aviso ${totAlertas}`)
if (sinLeer.length) console.log("NO LEÍDAS:", sinLeer)
console.log("excluidos (son el retiro mismo):", [...excluidos].join(" · "))
for (const r of resumen) console.log(`  ${String(r.nro).padStart(3)} [${r.caso.resp}] ${String(r.caso.nombre).slice(0, 40).padEnd(40)} ${r.secuencia}${r.alertas ? `  ⚠️${r.alertas}` : ""}`)
console.log(`📄 ${p}`)
