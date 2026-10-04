/**
 * 🧩 **QUÉ TEMPLATE ES CADA MOVIMIENTO DE JULIO 2025 A ENERO 2026 — sugerido, no cargado.** A-DAT-68.
 *
 * Pregunta del usuario 2026-10-03: *«tomando los datos del Excel, ¿vos podrías decirme qué llenar en el
 * template la parte histórica? ¿o hacer una columna más y llenarla con los templates que creés que son
 * los movimientos que identifiques?»* → **las dos**: una columna «template sugerido» por movimiento y
 * un cuadro template × mes con lo que habría que cargar en cada cuota.
 *
 * ## Cómo se sugiere — aprende de lo que YA está conciliado (feb–jun 2026)
 * La descripción del banco sola no alcanza («Trf Inmed Proveed» puede ser expensas, red vial o un
 * retiro). Tres pistas, de más a menos segura:
 *   1. **descripción unívoca** — en feb–jun esa descripción fue SIEMPRE el mismo template (`alta`);
 *   2. **su Detalle / CATEG** — las palabras de su planilla contra el nombre del template, entre los
 *      templates que usaron esa descripción (`media`);
 *   3. **importe parecido** — dentro de ±25 % del promedio de ese template en feb–jun (`baja`).
 * Lo que no es gasto (tarjeta, caja, SICORE, retiros, FCI, transferencias propias) se marca **«no
 * cargar»**: su cuenta no es `egreso`, y cargarlo duplica o mete patrimonio en el resultado (A-DAT-68).
 *
 * ```
 * npx tsx scripts/templates-sugeridos-2025.mts
 * ```
 * 🔴 **SÓLO LEE.** No escribe en la base; genera un Excel nuevo en la carpeta de comunicación.
 */
import { createRequire } from "node:module"
import { readFileSync, writeFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { MONEDA, formatearHoja, type Columna } from "../lib/balance/formato-excel"
import { resolverTipo } from "../lib/presupuesto/templates"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx") as typeof import("xlsx")

const ENTRADA = "- Comunicacion JMS Claude - Archivos/Balance/"
  + "extracto desde julio del 2025 hasta enero 26 parcial. galicia MSA cta cte pesos.xlsx"
const SALIDA = "- Comunicacion JMS Claude - Archivos/Balance/"
  + "Extracto_2025-07_a_2026-01_TEMPLATES_SUGERIDOS.xlsx"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)
const money = (n: number) => Math.round(n * 100) / 100
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
const palabras = (s: string) => new Set(norm(s).split(" ").filter(w => w.length >= 3 && !/^\d+$/.test(w)))

// ── Su Excel (mismo formato que lee segmentar-extracto-2025.mts) ───────────────────────────
const wbIn = XLSX.read(readFileSync(ENTRADA), { type: "buffer", cellDates: true })
const aoa = XLSX.utils.sheet_to_json<unknown[]>(wbIn.Sheets[wbIn.SheetNames[0]], { header: 1, raw: true, defval: "" })
const col: Record<string, number> = {}
;(aoa[2] as unknown[]).forEach((h, i) => { if (String(h).trim()) col[String(h).trim()] = i })
const num = (v: unknown) => typeof v === "number" ? v : (parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")) || 0)
const tx = (v: unknown) => String(v ?? "").trim()
interface Mov { fecha: string; mes: string; desc: string; deb: number; cre: number; categ: string; detalle: string }
const movs: Mov[] = []
for (let i = 3; i < aoa.length; i++) {
  const r = aoa[i] as unknown[]
  const f = r[col["Fecha"]]
  if (!(f instanceof Date)) continue
  const fecha = f.toISOString().slice(0, 10)
  movs.push({ fecha, mes: fecha.slice(0, 7), desc: tx(r[col["Descripción"]]), deb: num(r[col["Débitos"]]), cre: num(r[col["Créditos"]]),
    categ: tx(r[col["CATEG"]]), detalle: tx(r[col["Detalle"]]) })
}
movs.sort((a, b) => a.fecha.localeCompare(b.fecha))
const meses = [...new Set(movs.map(m => m.mes))].sort()

// ── Lo que ya está conciliado en la app (feb–jun 2026): de ahí se aprende ──────────────────
const { data: conc, error: e1 } = await sb.from("msa_galicia")
  .select("descripcion, debitos, creditos, template_id").not("template_id", "is", null).gte("fecha", "2026-02-01")
if (e1) throw e1
const { data: tmpls, error: e2 } = await sb.from("egresos_sin_factura")
  .select("id, nombre_referencia, categ, responsable, activo, tipo")
if (e2) throw e2
const { data: plan } = await sb.from("cuentas_contables").select("categ, tipo")
const tipoDe = new Map(((plan ?? []) as any[]).map(c => [c.categ, c.tipo]))
const tmplDe = new Map(((tmpls ?? []) as any[]).map(t => [t.id, t]))

/** Por descripción normalizada: qué templates la usaron y con qué importes. */
const porDesc = new Map<string, Map<string, number[]>>()
for (const c of (conc ?? []) as any[]) {
  const k = norm(c.descripcion || "")
  const m = porDesc.get(k) ?? new Map<string, number[]>()
  const arr = m.get(c.template_id) ?? []
  arr.push(Number(c.debitos) || Number(c.creditos) || 0)
  m.set(c.template_id, arr)
  porDesc.set(k, m)
}
const prom = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

interface Sug { template: any | null; confianza: "alta" | "media" | "baja" | ""; como: string }
function sugerir(m: Mov): Sug {
  const cands = porDesc.get(norm(m.desc))
  if (!cands || cands.size === 0) return { template: null, confianza: "", como: "descripción nunca conciliada en feb–jun" }
  const ids = [...cands.keys()]
  if (ids.length === 1) return { template: tmplDe.get(ids[0]), confianza: "alta", como: "descripción unívoca en feb–jun" }
  const suyas = palabras(`${m.detalle} ${m.categ}`)
  let mejor: { id: string; puntos: number } | null = null
  for (const id of ids) {
    const t = tmplDe.get(id); if (!t) continue
    const comunes = [...palabras(t.nombre_referencia)].filter(w => suyas.has(w)).length
    if (comunes > 0 && (!mejor || comunes > mejor.puntos)) mejor = { id, puntos: comunes }
  }
  if (mejor) return { template: tmplDe.get(mejor.id), confianza: "media", como: `su Detalle/CATEG se parece al nombre del template (${mejor.puntos} palabra/s)` }
  const imp = m.deb || m.cre
  const cerca = ids.map(id => ({ id, p: prom(cands.get(id)!) })).filter(x => x.p > 0 && Math.abs(imp - x.p) / x.p <= 0.25)
    .sort((a, b) => Math.abs(imp - a.p) - Math.abs(imp - b.p))
  if (cerca.length === 1) return { template: tmplDe.get(cerca[0].id), confianza: "baja", como: `importe dentro del 25 % del promedio feb–jun ($${money(cerca[0].p)})` }
  return { template: null, confianza: "", como: `ambigua: ${ids.length} templates usaron esta descripción` }
}
/**
 * No es gasto del resultado: su naturaleza no es `egreso` — la misma cascada que el Presupuesto
 * (`resolverTipo`: el `tipo` del template manda, después el del plan de cuentas). Y SICORE, aunque el
 * template diga egreso, es retención de terceros que se ingresa, no gasto propio (A-DAT-68 (c)).
 */
const noCargar = (t: any) => !!t && (resolverTipo(t.tipo, tipoDe.get(t.categ), -1).tipo !== "egreso" || /sicore/i.test(t.nombre_referencia))

// ── Las cuotas que ya existen en la app para esos meses (hoy en $0) ─────────────────────────
const { data: cuotas } = await sb.from("cuotas_egresos_sin_factura")
  .select("egreso_id, monto, estado, fecha_estimada").gte("fecha_estimada", `${meses[0]}-01`).lte("fecha_estimada", `${meses[meses.length - 1]}-31`)
const cuotaDe = new Map<string, { monto: number; estado: string }>()
for (const c of (cuotas ?? []) as any[]) cuotaDe.set(`${c.egreso_id}|${String(c.fecha_estimada).slice(0, 7)}`, { monto: Number(c.monto) || 0, estado: c.estado })

// ── Armar el Excel ─────────────────────────────────────────────────────────────────────────
const sugs = movs.map(m => ({ m, s: sugerir(m) }))
const filasMov: unknown[][] = [["Fecha", "Descripción", "Débitos", "Créditos", "Su CATEG", "Su Detalle", "Template sugerido", "Cuenta", "Confianza", "Cómo se sugirió", "¿Cargar?"]]
for (const { m, s } of sugs) {
  filasMov.push([m.fecha, m.desc, m.deb || "", m.cre || "", m.categ, m.detalle,
    s.template?.nombre_referencia ?? "", s.template?.categ ?? "", s.confianza, s.como,
    !s.template ? "" : noCargar(s.template) ? "NO — no es gasto" : "sí"])
}
// Template × mes: lo que habría que cargar en cada cuota (sólo gasto), contra lo que hay hoy.
const pivot = new Map<string, { t: any; porMes: number[] }>()
for (const { m, s } of sugs) {
  if (!s.template || noCargar(s.template)) continue
  const p = pivot.get(s.template.id) ?? { t: s.template, porMes: meses.map(() => 0) }
  p.porMes[meses.indexOf(m.mes)] += (m.deb || 0) - (m.cre || 0)
  pivot.set(s.template.id, p)
}
const filasPiv: unknown[][] = [["Template", "Cuenta", ...meses.map(x => `${x} a cargar`), "TOTAL", ...meses.map(x => `${x} hoy en la app`)]]
for (const { t, porMes } of [...pivot.values()].sort((a, b) => a.t.nombre_referencia.localeCompare(b.t.nombre_referencia))) {
  filasPiv.push([t.nombre_referencia, t.categ, ...porMes.map(money), money(porMes.reduce((a, b) => a + b, 0)),
    ...meses.map(x => { const c = cuotaDe.get(`${t.id}|${x}`); return c ? money(c.monto) : "sin cuota" })])
}
const totalSug = sugs.filter(x => x.s.template && !noCargar(x.s.template)).reduce((a, x) => a + x.m.deb - x.m.cre, 0)
const resumen: unknown[][] = [
  ["TEMPLATES SUGERIDOS — extracto MSA Galicia cta cte, jul-2025 a ene-2026 (NO cargado: es para revisar)"],
  [],
  ["Movimientos", movs.length],
  ["Con sugerencia de confianza alta", sugs.filter(x => x.s.confianza === "alta").length],
  ["Con sugerencia media", sugs.filter(x => x.s.confianza === "media").length],
  ["Con sugerencia baja", sugs.filter(x => x.s.confianza === "baja").length],
  ["Sin sugerencia", sugs.filter(x => !x.s.template).length],
  ["Marcados NO cargar (no son gasto)", sugs.filter(x => noCargar(x.s.template)).length],
  ["Total de gasto sugerido para cargar en templates", money(totalSug)],
  [],
  ["Cómo leer: «alta» = esa descripción siempre fue ese template en feb–jun; «media» = tu Detalle/CATEG se parece al nombre;"],
  ["«baja» = sólo el importe se parece. Revisá sobre todo las medias y bajas antes de cargar nada."],
]
const wb = XLSX.utils.book_new()
const h = (nombre: string, filas: unknown[][], cols?: Columna[]) => {
  const ws = XLSX.utils.aoa_to_sheet(filas); if (cols) formatearHoja(ws, cols)
  XLSX.utils.book_append_sheet(wb, ws, nombre)
}
h("00 Resumen", resumen)
h("01 Por template y mes", filasPiv)
h("02 Movimientos", filasMov, [{ ancho: 11 }, { ancho: 34 }, { ancho: 14, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 14 }, { ancho: 28 }, { ancho: 30 }, { ancho: 22 }, { ancho: 9 }, { ancho: 44 }, { ancho: 16 }] as Columna[])
h("03 Sin sugerencia", [filasMov[0], ...filasMov.slice(1).filter((_, i) => !sugs[i].s.template)])
writeFileSync(SALIDA, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
console.log(resumen.filter(r => r.length === 2).map(r => `${r[0]}: ${r[1]}`).join("\n"))
console.log("→", SALIDA)
