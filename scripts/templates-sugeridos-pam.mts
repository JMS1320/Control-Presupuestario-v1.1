/**
 * 🧩 **PAM — los extractos históricos de la Caja de Ahorro y la Cuenta Corriente, segmentados, con sus
 * controles y el template que corresponde a cada movimiento.** A-DAT-68 · 2026-10-04.
 *
 * Pedido del usuario: *«te dejé extractos de PAM cta cte y CA para ver su histórico y poder también así
 * ver cómo llenar el histórico de templates. Fijate y hacé el mismo trabajo de proponer templates»* —
 * el mismo que `templates-sugeridos-2025.mts` hizo para MSA.
 *
 * ## Lo que cambia para PAM
 * - **Dos cuentas**: la CA (su planilla, con su CATEG; abril 2023 → enero 2026) y la CC (formato del
 *   banco, con leyendas; 24/09/2025 → 30/01/2026).
 * - **PAM cierra el 31/12**, y sus templates arrancan en la campaña 2026: **no hay ni una cuota de 2025**.
 *   El período a llenar es **enero 2025 → enero 2026** (el ejercicio 2025 entero + el enero que la app
 *   no tiene).
 * - La app concilió poco de PAM, así que se aprende de **todas** las cuentas y se lleva al template de
 *   PAM **del mismo nombre** (los de comisiones, impuestos bancarios, etc. existen en las dos).
 *
 * ## Cómo se sugiere (de más a menos segura)
 *   1. **descripción + leyenda** que en lo conciliado fue siempre el mismo template (`alta`);
 *   2. **descripción sola** unívoca (`alta`);
 *   3. su **CATEG / Observaciones / leyenda** se parece al nombre de un template de PAM (`media`).
 * Lo que no es gasto (financiero, distribución) se marca **NO cargar** con `resolverTipo`.
 *
 * ```
 * npx tsx scripts/templates-sugeridos-pam.mts
 * ```
 * 🔴 **SÓLO LEE.** Su Excel no se toca; se escribe uno nuevo en la carpeta de comunicación.
 */
import { createRequire } from "node:module"
import { readFileSync, writeFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { resolverTipo } from "../lib/presupuesto/templates"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx") as typeof import("xlsx")

const ENTRADA = "- Comunicacion JMS Claude - Archivos/Balance/extractos PAM.xlsx"
const SALIDA = "- Comunicacion JMS Claude - Archivos/Balance/Extractos_PAM_TEMPLATES_SUGERIDOS.xlsx"
const DESDE = "2025-01-01", HASTA = "2026-01-31"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)
const r2 = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
const sinNumeros = (s: string) => norm(s).split(" ").filter(w => !/\d/.test(w)).join(" ")
const palabras = (s: string) => new Set(norm(s).split(" ").filter(w => w.length >= 3 && !/\d/.test(w)))
const num = (v: unknown) => typeof v === "number" ? v : (parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")) || 0)
const tx = (v: unknown) => String(v ?? "").trim()
function fechaISO(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const m = tx(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null
}

interface Mov {
  cuenta: "CA" | "CC"; fecha: string; mes: string; desc: string; desc1: string; leyenda: string
  deb: number; cre: number; saldo: number | null; categ: string; obs: string; orden: number
}

// ── Leer las dos hojas ─────────────────────────────────────────────────────────────────────
const wb = XLSX.read(readFileSync(ENTRADA), { type: "buffer", cellDates: true })
const leer = (hoja: string, filaEnc: number) => {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[hoja], { header: 1, raw: true, defval: "" })
  const col: Record<string, number> = {}
  ;(aoa[filaEnc] as unknown[]).forEach((h, i) => { if (tx(h)) col[tx(h)] = i })
  return { aoa, col }
}
const movs: Mov[] = []
{
  const { aoa, col } = leer("Extracto PAM CA Pesos", 6)
  aoa.slice(7).forEach((r, i) => {
    const f = fechaISO(r[col["Fecha"]]); if (!f) return
    const lineas = tx(r[col["Movimiento"]]).split(/\n/).map(x => x.trim()).filter(Boolean)
    movs.push({ cuenta: "CA", fecha: f, mes: f.slice(0, 7), desc: lineas.join(" · "), desc1: lineas[0] ?? "", leyenda: lineas[1] ?? "",
      deb: num(r[col["Débito"]]), cre: num(r[col["Crédito"]]), saldo: tx(r[col["Saldo"]]) === "" ? null : num(r[col["Saldo"]]),
      categ: tx(r[col["Categ"]]) || "(sin CATEG)", obs: tx(r[col["Observaciones"]]), orden: i })
  })
}
{
  const { aoa, col } = leer("Extracto SUC PAM CC", 2)
  aoa.slice(3).forEach((r, i) => {
    const f = fechaISO(r[col["Fecha"]]); if (!f) return
    movs.push({ cuenta: "CC", fecha: f, mes: f.slice(0, 7), desc: tx(r[col["Descripción"]]), desc1: tx(r[col["Descripción"]]),
      leyenda: tx(r[col["Leyendas Adicionales1"]]), deb: num(r[col["Débitos"]]), cre: num(r[col["Créditos"]]),
      saldo: tx(r[col["Saldo"]]) === "" ? null : num(r[col["Saldo"]]), categ: "(cta cte: sin CATEG)",
      obs: tx(r[col["Observaciones Cliente"]]), orden: i })
  })
}
// Las dos hojas van de la más nueva a la más vieja, y dentro del día también: se invierte entero.
movs.sort((a, b) => a.cuenta.localeCompare(b.cuenta) || a.fecha.localeCompare(b.fecha) || b.orden - a.orden)

// ── Controles ──────────────────────────────────────────────────────────────────────────────
const control: unknown[][] = [["CONTROLES"], []]
for (const cta of ["CA", "CC"] as const) {
  const ms = movs.filter(m => m.cuenta === cta && m.saldo != null)
  let rotos = 0
  for (let i = 1; i < ms.length; i++) if (Math.abs(r2(ms[i - 1].saldo! + ms[i].cre - ms[i].deb) - r2(ms[i].saldo!)) > 0.01) rotos++
  const ultimo = ms[ms.length - 1]
  const tabla = cta === "CA" ? "pam_galicia" : "pam_galicia_cc"
  const { data: primero } = await sb.from(tabla).select("fecha, debitos, creditos, saldo").order("fecha").order("orden").limit(1).maybeSingle()
  const previoApp = primero ? r2(Number(primero.saldo) - Number(primero.creditos || 0) + Number(primero.debitos || 0)) : null
  const { count: solapa } = await sb.from(tabla).select("id", { count: "exact", head: true }).lte("fecha", ultimo.fecha)
  control.push([`${cta === "CA" ? "Caja de ahorro" : "Cuenta corriente"}`],
    ["  movimientos", movs.filter(m => m.cuenta === cta).length, `${movs.find(m => m.cuenta === cta)?.fecha} → ${ultimo.fecha}`],
    ["  1. cadena de saldos (cada saldo = anterior + crédito − débito)", rotos === 0 ? "✓ cierra en todas las filas" : `✗ ${rotos} fila(s) no cierran`],
    ["  2. enganche con la app", previoApp != null && Math.abs(previoApp - ultimo.saldo!) < 0.01 ? "✓ al centavo" : "✗ NO engancha",
      `su último saldo ${fmt(ultimo.saldo!)} (${ultimo.fecha}) · la app arranca ${primero?.fecha} desde ${previoApp != null ? fmt(previoApp) : "—"}`],
    ["  3. solapamiento con la app", (solapa ?? 0) === 0 ? "✓ ninguna fila de la app antes de su último día" : `✗ ${solapa} fila(s) de la app se superponen`], [])
}

// ── Aprender de lo conciliado (todas las cuentas) y llevarlo a los templates de PAM ─────────
const tablasApp: Array<[string, string]> = [["public", "msa_galicia"], ["public", "pam_galicia"], ["public", "pam_galicia_cc"], ["ma", "ma_galicia"]]
const { data: tmpls } = await sb.from("egresos_sin_factura").select("id, nombre_referencia, categ, responsable, tipo, activo")
const { data: plan } = await sb.from("cuentas_contables").select("categ, tipo")
const tipoPlan = new Map(((plan ?? []) as any[]).map(c => [c.categ, c.tipo]))
const tmplPorId = new Map(((tmpls ?? []) as any[]).map(t => [t.id, t]))
const pam = ((tmpls ?? []) as any[]).filter(t => /PAM/i.test(t.responsable || "") && t.activo)
const pamPorNombre = new Map(pam.map(t => [norm(t.nombre_referencia), t]))
const porDesc = new Map<string, Map<string, number>>(), porDescLey = new Map<string, Map<string, number>>()
const sumar = (m: Map<string, Map<string, number>>, k: string, nombre: string) => {
  const x = m.get(k) ?? new Map<string, number>(); x.set(nombre, (x.get(nombre) ?? 0) + 1); m.set(k, x)
}
for (const [sch, t] of tablasApp) {
  const cli = sch === "public" ? sb : sb.schema(sch)
  const { data } = await cli.from(t).select("descripcion, leyendas_adicionales_1, template_id").not("template_id", "is", null)
  for (const r of (data ?? []) as any[]) {
    const tp = tmplPorId.get(r.template_id); if (!tp) continue
    const nombre = norm(tp.nombre_referencia)
    sumar(porDesc, sinNumeros(r.descripcion || ""), nombre)
    if (r.leyendas_adicionales_1) sumar(porDescLey, sinNumeros(r.descripcion || "") + " | " + sinNumeros(r.leyendas_adicionales_1), nombre)
  }
}
const unico = (m?: Map<string, number>) => m && m.size === 1 ? [...m.keys()][0] : null
interface Sug { t: any | null; conf: "alta" | "media" | ""; como: string }
function sugerir(m: Mov): Sug {
  /**
   * 🧨 Un CRÉDITO no va a un template de gasto. La primera corrida mandaba cobros de arrendamiento
   * (Rosello, Provinvest: $44,6 M) a «Inmobiliario Cuota Quinta Rosello 2» porque el nombre del campo
   * aparece en los dos, y el gasto sugerido daba NEGATIVO. Un ingreso sólo puede ir a un template
   * financiero o de distribución (que igual se marcan «no cargar»).
   */
  const esIngreso = m.cre > 0 && m.deb === 0
  const k1 = sinNumeros(m.desc1), k2 = k1 + " | " + sinNumeros(m.leyenda)
  for (const [nombre, como] of [[unico(porDescLey.get(k2)), "descripción + leyenda, siempre ese template en lo conciliado"], [unico(porDesc.get(k1)), "descripción, siempre ese template en lo conciliado"]] as const) {
    if (!nombre) continue
    const t = pamPorNombre.get(nombre)
    if (t && !(esIngreso && !noCargar(t))) return { t, conf: "alta", como }
  }
  if (esIngreso) return { t: null, conf: "", como: "es un ingreso (cobro): no va a un template de gasto" }
  /**
   * Parecido por palabras, con tres reglas que salieron de mirar los errores de la primera corrida:
   *  · la palabra del CONCEPTO (la primera del nombre: «inmobiliario», «abl», «expensas», «iibb»)
   *    tiene que estar en su texto — si no, «Inscripción Quinta Rosello» caía en el inmobiliario;
   *  · gana el MÁS parecido (palabras en común sobre palabras del nombre), no el primero;
   *  · si hay EMPATE arriba, no se sugiere: elegir sería adivinar.
   */
  const SINONIMOS: Record<string, string> = { consorcio: "expensas", gcba: "abl" }
  const suyas = new Set([...palabras(`${m.categ} ${m.obs} ${m.leyenda}`)].map(w => SINONIMOS[w] ?? w))
  // Un pago a ARBA de IIBB es la DDJJ mensual; «IIBB Bancario» es la percepción que hace el banco.
  if (suyas.has("arba") && suyas.has("iibb")) suyas.add("mensual")
  // «Complementario» en estos extractos es siempre el inmobiliario complementario de ARBA.
  if (suyas.has("complementario")) suyas.add("inmobiliario")
  /** Palabras que no dicen de qué es el template: el concepto es la primera que NO es una de éstas. */
  const GENERICAS = new Set(["imp", "cuota", "pago", "anual", "pam", "msa"])
  const puntaje = (t: any) => {
    const nombre = norm(t.nombre_referencia).split(" ").filter(w => w.length >= 3 && !/\d/.test(w))
    const concepto = nombre.find(w => !GENERICAS.has(w))
    if (!concepto || !suyas.has(concepto)) return 0
    return nombre.filter(w => suyas.has(w)).length / nombre.length
  }
  const ranking = pam.map(t => ({ t, p: puntaje(t) })).filter(x => x.p > 0).sort((a, b) => b.p - a.p)
  if (ranking.length && (ranking.length === 1 || ranking[0].p > ranking[1].p))
    return { t: ranking[0].t, conf: "media", como: `su CATEG/Observación/leyenda se parece al nombre (${Math.round(ranking[0].p * 100)} %)` }
  if (ranking.length > 1) return { t: null, conf: "", como: `ambigua: empatan ${ranking.filter(x => x.p === ranking[0].p).map(x => x.t.nombre_referencia).join(" / ")}` }
  return { t: null, conf: "", como: porDesc.get(k1) ? "esa descripción se concilió a templates que PAM no tiene" : "nunca conciliada" }
}
const noCargar = (t: any) => !!t && resolverTipo(t.tipo, tipoPlan.get(t.categ), -1).tipo !== "egreso"

// ── Cuotas que hoy existen en la app para esos meses ────────────────────────────────────────
const { data: cuotas } = await sb.from("cuotas_egresos_sin_factura").select("egreso_id, monto, fecha_estimada")
  .gte("fecha_estimada", DESDE).lte("fecha_estimada", HASTA)
const cuotaDe = new Map<string, number>()
for (const c of (cuotas ?? []) as any[]) cuotaDe.set(`${c.egreso_id}|${String(c.fecha_estimada).slice(0, 7)}`, Number(c.monto) || 0)

// ── Excel ──────────────────────────────────────────────────────────────────────────────────
const enPeriodo = (m: Mov) => m.fecha >= DESDE && m.fecha <= HASTA
const sugs = movs.map(m => ({ m, s: sugerir(m) }))
const meses: string[] = []; for (let d = new Date(DESDE + "T00:00:00Z"); d <= new Date(HASTA + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1)) meses.push(d.toISOString().slice(0, 7))

const movHoja: unknown[][] = [["Cuenta", "Fecha", "Descripción", "Leyenda", "Débitos", "Créditos", "Saldo", "Su CATEG", "Observaciones", "Template sugerido", "Confianza", "Cómo", "¿Cargar?", "¿En el período a llenar?"]]
for (const { m, s } of sugs) movHoja.push([m.cuenta, m.fecha, m.desc, m.leyenda, m.deb || "", m.cre || "", m.saldo ?? "", m.categ, m.obs,
  s.t?.nombre_referencia ?? "", s.conf, s.como, !s.t ? "" : noCargar(s.t) ? "NO — no es gasto" : "sí", enPeriodo(m) ? "sí" : "no (anterior)"])

const piv = new Map<string, { t: any; porMes: number[] }>()
for (const { m, s } of sugs) {
  if (!s.t || noCargar(s.t) || !enPeriodo(m)) continue
  const p = piv.get(s.t.id) ?? { t: s.t, porMes: meses.map(() => 0) }
  p.porMes[meses.indexOf(m.mes)] += m.deb - m.cre
  piv.set(s.t.id, p)
}
const pivHoja: unknown[][] = [["Template de PAM", "Cuenta contable", ...meses.map(x => `${x} a cargar`), "TOTAL", ...meses.map(x => `${x} hoy en la app`)]]
for (const { t, porMes } of [...piv.values()].sort((a, b) => a.t.nombre_referencia.localeCompare(b.t.nombre_referencia)))
  pivHoja.push([t.nombre_referencia, t.categ, ...porMes.map(r2), r2(porMes.reduce((a, b) => a + b, 0)),
    ...meses.map(x => cuotaDe.has(`${t.id}|${x}`) ? r2(cuotaDe.get(`${t.id}|${x}`)!) : "sin cuota")])

// Su CATEG × mes (sólo CA, que es la que la trae), para el período
const cats = [...new Set(movs.filter(m => m.cuenta === "CA" && enPeriodo(m)).map(m => m.categ))].sort()
const catHoja: unknown[][] = [["Su CATEG (CA)", ...meses, "TOTAL débitos − créditos"]]
for (const c of cats) {
  const fila = meses.map(x => r2(movs.filter(m => m.cuenta === "CA" && m.categ === c && m.mes === x).reduce((a, m) => a + m.deb - m.cre, 0)))
  catHoja.push([c, ...fila, r2(fila.reduce((a, b) => a + b, 0))])
}

const ps = sugs.filter(x => enPeriodo(x.m))
const total = r2(ps.filter(x => x.s.t && !noCargar(x.s.t)).reduce((a, x) => a + x.m.deb - x.m.cre, 0))
control.push(["SUGERENCIAS — período a llenar: enero 2025 → enero 2026 (PAM cierra el 31/12; la app arranca en febrero 2026)"],
  ["  movimientos en el período", ps.length],
  ["  confianza alta", ps.filter(x => x.s.conf === "alta").length],
  ["  confianza media", ps.filter(x => x.s.conf === "media").length],
  ["  sin sugerencia", ps.filter(x => !x.s.t).length],
  ["  marcados NO cargar (no son gasto)", ps.filter(x => noCargar(x.s.t)).length],
  ["  gasto sugerido para cargar en templates", total],
  [], ["⚠️ PAM no tiene cuotas de 2025 en ningún template: cargar el histórico de 2025 es crear esas cuotas (decisión del usuario)."],
  ["⚠️ Lo que queda sin sugerencia son sobre todo transferencias a personas (Mercedes Areco, José María, Plácido Andrés, Allende) y entre"],
  ["   cuentas propias: lo más probable es que sean RETIROS / distribuciones o pagos a proveedores con factura — no gasto de template."])

const out = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(control), "00 Control")
XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(pivHoja), "01 Template x mes")
XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(catHoja), "02 Su CATEG x mes (CA)")
XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(movHoja), "03 Movimientos")
XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet([movHoja[0], ...movHoja.slice(1).filter((_, i) => !sugs[i].s.t && enPeriodo(sugs[i].m))]), "04 Sin sugerencia (periodo)")
writeFileSync(SALIDA, XLSX.write(out, { type: "buffer", bookType: "xlsx" }))
for (const f of control) if (f.length) console.log(f.map(String).join("  "))
console.log("→", SALIDA)
