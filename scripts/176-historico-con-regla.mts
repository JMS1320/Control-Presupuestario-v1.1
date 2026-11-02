/**
 * 📜 Script 176 — el HISTÓRICO que ya tiene REGLA, atado a su template (A-FEAT-1523, JMS 02/11: «3 adelante»).
 *
 * Los movimientos del extracto histórico (jul-25 → ene-26) que una regla de conciliación activa reconoce: el motor no los toma
 * (sólo mira «pendiente»), así que se hace por script con la MISMA lógica del motor (`crearCuotaEnTemplate`), adaptada al
 * histórico (convención A-DEC-1009: el movimiento queda «historico», con template_id + template_cuota_id):
 *   1. si en el template (o su familia, aunque la campaña esté desactivada) ya hay una cuota de ese importe a ±15 días SIN
 *      movimiento atado → sólo se ATA (no se toca la cuota);
 *   2. si hay una cuota «pendiente»/«débito» del mes → se CONCILIA con el importe y la fecha del banco (como el motor);
 *   3. si no → se CREA la cuota conciliada (como el motor, y como el script 175).
 * Sin template para la fecha → no se hace nada y se lista.
 *
 * Uso:   npx tsx scripts/176-historico-con-regla.mts               → PLAN EN SECO (no escribe; deja 176-plan.json)
 *        npx tsx scripts/176-historico-con-regla.mts --aplicar     → aplica el plan (con OK de JMS) y deja 176-hecho.json
 * Deshacer: npx tsx scripts/176-historico-con-regla-deshacer.mts (lee 176-hecho.json: vuelve cada fila a su valor anterior).
 * Todo lo que toca lleva la marca [script 176].
 */
import { createClient } from "@supabase/supabase-js"
import { writeFileSync } from "node:fs"
import { templateParaFecha } from "../lib/conciliacion/template-de-regla"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"

const APLICAR = process.argv.includes("--aplicar")
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const MARCA = "[script 176]"
const CUENTAS: Array<{ id: string; schema: string; tabla: string; empresa: string }> = [
  { id: "msa_galicia", schema: "public", tabla: "msa_galicia", empresa: "MSA" },
  { id: "pam_galicia", schema: "public", tabla: "pam_galicia", empresa: "PAM" },
  { id: "pam_galicia_cc", schema: "public", tabla: "pam_galicia_cc", empresa: "PAM" },
]
const de = (s: string) => (s === "public" ? sb : sb.schema(s))
const dias = (a: string, b: string) => Math.abs(Date.parse(a.slice(0, 10)) - Date.parse(b.slice(0, 10))) / 86400000

const { data: reglas } = await sb.from("reglas_conciliacion").select("*").eq("activo", true).order("orden")
const { data: templates } = await sb.from("egresos_sin_factura").select("id, nombre_referencia, responsable, año, periodicidad, activo, solo_conciliacion, template_origen_id, categ")
const { data: cuotas } = await sb.from("cuotas_egresos_sin_factura").select("id, egreso_id, fecha_estimada, fecha_vencimiento, fecha_pago, monto, estado, detalle").gte("fecha_estimada", "2025-05-01").lte("fecha_estimada", "2026-03-31")
// Cuotas que ya tienen un movimiento atado (en cualquier cuenta): no se re-usan.
const atadas = new Set<string>()
for (const t of TABLAS_CON_VINCULO_ARCA) {
  for (let d = 0; ; d += 1000) {
    const { data } = await de(t.schema).from(t.tabla).select("template_cuota_id").not("template_cuota_id", "is", null).range(d, d + 999)
    for (const m of data ?? []) atadas.add(String(m.template_cuota_id))
    if (!data || data.length < 1000) break
  }
}
const texto = (m: any, col: string) => col === "descripcion" ? (m.descripcion ?? "") :
  ["descripcion", "concepto", "leyendas_adicionales_1", "leyendas_adicionales_2", "leyendas_adicionales_3", "leyendas_adicionales_4", "observaciones_cliente", "detalle"].map(k => m[k] ?? "").join(" ")
const reglaDe = (m: any, cuentaId: string) => (reglas ?? []).filter((r: any) => r.cuenta_bancaria_id === cuentaId).find((r: any) => {
  const t = texto(m, r.columna_busqueda).toLowerCase(), b = String(r.texto_buscar ?? "").toLowerCase().trim()
  if (!b) return false
  return r.tipo_match === "contiene" ? t.includes(b) : r.tipo_match === "exacto" ? t.trim() === b : t.trim().startsWith(b)
})

/** Los templates candidatos para la regla y la empresa de la cuenta (con las campañas desactivadas: es el histórico). */
function candidatos(r: any, empresa: string): any[] {
  const todos = (templates ?? []) as any[]
  if (r.template_id) {
    const elegido = todos.find(t => t.id === r.template_id)
    if (!elegido) return []
    const fam = todos.filter(t => t.nombre_referencia === elegido.nombre_referencia || t.template_origen_id === elegido.id || t.id === elegido.template_origen_id)
    return [elegido, ...fam.filter(t => t.id !== elegido.id)]
  }
  const porCateg = todos.filter(t => (t.categ ?? "") === r.categ)
  const deLaEmpresa = porCateg.filter(t => String(t.responsable ?? "").toLowerCase().includes(empresa.toLowerCase()))
  return deLaEmpresa.length ? deLaEmpresa : porCateg.filter(t => !t.solo_conciliacion)
}

const plan: any[] = []
const usadas = new Set<string>()
for (const c of CUENTAS) {
  const { data: movs } = await de(c.schema).from(c.tabla).select("*").eq("estado", "historico").is("template_cuota_id", null).is("comprobante_arca_id", null)
    .is("sueldo_pago_id", null).is("comprobante_venta_id", null).is("anticipo_id", null).gte("fecha", "2025-07-01").lte("fecha", "2026-06-30")
  for (const m of movs ?? []) {
    const r = reglaDe(m, c.id)
    if (!r) continue
    const monto = Number(m.debitos) > 0 ? Number(m.debitos) : Number(m.creditos)
    const tipoMov = Number(m.debitos) > 0 ? "egreso" : "ingreso"
    if (!monto) continue
    const cand = candidatos(r, c.empresa)
    const ids = new Set(cand.map(t => t.id))
    const base = { cuenta: c.id, movId: m.id, fecha: m.fecha, descripcion: m.descripcion, monto, regla: r.texto_buscar, categ: r.categ, notaAntes: m.nota_operador ?? null }
    // 1 · una cuota del mismo importe, a ±15 días, sin movimiento atado → sólo atar
    const ya = (cuotas ?? []).find((q: any) => ids.has(q.egreso_id) && q.estado !== "desactivado" && !atadas.has(q.id) && !usadas.has(q.id)
      && Math.abs(Number(q.monto) - monto) <= 0.01 && dias(q.fecha_pago || q.fecha_estimada || q.fecha_vencimiento, m.fecha) <= 15)
    if (ya) { usadas.add(ya.id); plan.push({ ...base, accion: "ATAR", templateId: ya.egreso_id, template: cand.find(t => t.id === ya.egreso_id)?.nombre_referencia, cuotaId: ya.id }); continue }
    // el template de la campaña de la fecha (sin filtrar activos: es el histórico)
    const elegido = cand[0]
    const destino = elegido ? (templateParaFecha({ ...elegido, activo: true }, cand.map(t => ({ ...t, activo: true })), m.fecha) ?? elegido) : null
    if (!destino) { plan.push({ ...base, accion: "SIN TEMPLATE", template: null }); continue }
    // 2 · la cuota pendiente / débito del mes → conciliarla
    const pend = (cuotas ?? []).filter((q: any) => q.egreso_id === destino.id && ["pendiente", "debito"].includes(String(q.estado)) && !usadas.has(q.id)
      && dias(q.fecha_vencimiento || q.fecha_estimada, m.fecha) <= 15).sort((a: any, b: any) => Math.abs(Number(a.monto) - monto) - Math.abs(Number(b.monto) - monto))[0]
    if (pend) { usadas.add(pend.id); plan.push({ ...base, accion: "CONCILIAR PENDIENTE", templateId: destino.id, template: destino.nombre_referencia, cuotaId: pend.id, cuotaAntes: pend, tipoMov }); continue }
    // 3 · crear la cuota
    plan.push({ ...base, accion: "CREAR CUOTA", templateId: destino.id, template: destino.nombre_referencia, tipoMov, detalle: (r.detalle && r.detalle !== r.categ ? r.detalle : m.descripcion) })
  }
}

const resumen: Record<string, number> = {}
for (const p of plan) { const k = `${p.cuenta} · ${p.accion} · ${p.template ?? "—"}`; resumen[k] = (resumen[k] ?? 0) + 1 }
console.log(`\n${APLICAR ? "APLICANDO" : "PLAN EN SECO (no se escribió nada)"} — ${plan.length} movimientos`)
for (const [k, v] of Object.entries(resumen).sort()) console.log(String(v).padStart(4), k)
writeFileSync("scripts/176-plan.json", JSON.stringify(plan, null, 1))
if (!APLICAR) { console.log("\n→ scripts/176-plan.json. Para aplicar: --aplicar (con OK de JMS)."); process.exit(0) }

const hecho: any[] = []
for (const p of plan) {
  if (p.accion === "SIN TEMPLATE") continue
  let cuotaId = p.cuotaId
  if (p.accion === "CREAR CUOTA") {
    const { data, error } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: p.templateId, fecha_vencimiento: p.fecha, fecha_estimada: p.fecha, fecha_pago: p.fecha,
      monto: p.monto, estado: "conciliado", tipo_movimiento: p.tipoMov, detalle: `${p.detalle ?? ""} ${MARCA}`.trim() }).select("id").single()
    if (error) { console.error("✗ cuota", p.movId, error.message); continue }
    cuotaId = data.id
  } else if (p.accion === "CONCILIAR PENDIENTE") {
    const { error } = await sb.from("cuotas_egresos_sin_factura").update({ fecha_vencimiento: p.fecha, fecha_estimada: p.fecha, fecha_pago: p.fecha, monto: p.monto,
      estado: "conciliado", tipo_movimiento: p.tipoMov, detalle: `${p.cuotaAntes.detalle ?? ""} ${MARCA}`.trim() }).eq("id", cuotaId)
    if (error) { console.error("✗ pendiente", p.movId, error.message); continue }
  }
  const c = CUENTAS.find(x => x.id === p.cuenta)!
  const { error } = await de(c.schema).from(c.tabla).update({ template_id: p.templateId, template_cuota_id: cuotaId,
    nota_operador: `${p.notaAntes ? p.notaAntes + " · " : ""}${MARCA} atado a «${p.template}» por la regla «${p.regla}»` }).eq("id", p.movId).is("template_cuota_id", null)
  if (error) { console.error("✗ movimiento", p.movId, error.message); continue }
  hecho.push({ ...p, cuotaId })
}
writeFileSync("scripts/176-hecho.json", JSON.stringify(hecho, null, 1))
console.log(`✓ ${hecho.length} movimientos atados → scripts/176-hecho.json (lo usa el deshacer)`)
