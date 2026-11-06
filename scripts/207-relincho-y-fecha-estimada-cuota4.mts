/**
 * Script 207 (A-FEAT-1565, 05/11 — pedido de JMS en esta terminal):
 *  A) «si la fecha de venc pasa al 12/11 la estimada también debe pasar ahí»: en las cuotas 4 2026 a las que se les
 *     aplicó la boleta de ARBA, `fecha_estimada` = `fecha_vencimiento` (salvo pagadas/conciliadas).
 *  B) «crealo vos por favor»: template «Inmobiliario Cuota Relincho» (PAM, partida 099-025089-8) con su cuota 4 2026
 *     ($180.573,20, vence 12/11) y la boleta ya leída aplicada a esa cuota. Copia la forma de «Inmobiliario Cuota Tapera 2».
 *     Las cuotas 1-3 de 2026 se pagaron fuera del sistema (JMS: «sí se pagaron») — no se inventan sus importes.
 *
 *   npx tsx scripts/207-relincho-y-fecha-estimada-cuota4.mts             → foto en scripts/207-foto.json y aplica
 *   npx tsx scripts/207-relincho-y-fecha-estimada-cuota4.mts --deshacer  → vuelve exactamente a la foto
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { randomUUID } from "node:crypto"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const FOTO = "scripts/207-foto.json"
const MODELO = "727d949b-ce55-4832-8cb7-7edfdf566f54" // Inmobiliario Cuota Tapera 2 (PAM)
const PARTIDA = "099-025089-8"

if (process.argv.includes("--deshacer")) {
  const f = JSON.parse(readFileSync(FOTO, "utf8"))
  for (const c of f.fechas) {
    const { error } = await sb.from("cuotas_egresos_sin_factura").update({ fecha_estimada: c.fecha_estimada }).eq("id", c.id)
    if (error) throw error
  }
  const { error: eb } = await sb.from("boletas_arba").update({ egreso_id: f.boleta.egreso_id, cuota_id: f.boleta.cuota_id, aplicada: f.boleta.aplicada }).eq("id", f.boleta.id)
  if (eb) throw eb
  await sb.from("cuotas_egresos_sin_factura").delete().eq("id", f.cuotaId)
  await sb.from("egresos_sin_factura").delete().eq("id", f.templateId)
  console.log(`deshecho: ${f.fechas.length} fechas, template y cuota del Relincho borrados, boleta como estaba`)
  process.exit(0)
}

if (existsSync(FOTO)) throw new Error("ya hay una foto: el script ya corrió")

// A) las cuotas a corregir
const { data: bols, error: e1 } = await sb.from("boletas_arba").select("cuota_id").eq("anio", 2026).eq("cuota", "4").eq("aplicada", true).not("cuota_id", "is", null)
if (e1) throw e1
const { data: cuotas, error: e2 } = await sb.from("cuotas_egresos_sin_factura").select("id, fecha_estimada, fecha_vencimiento, estado").in("id", bols!.map(b => b.cuota_id))
if (e2) throw e2
const fechas = cuotas!.filter(c => c.fecha_vencimiento && c.fecha_estimada !== c.fecha_vencimiento && !["pagado", "conciliado"].includes(c.estado))
console.log(`A) cuotas con estimada ≠ vencimiento: ${fechas.length}`)
if (fechas.length !== 19) throw new Error("se esperaban 19 — no se toca nada")

// B) el Relincho
const { data: ya } = await sb.from("egresos_sin_factura").select("id").eq("partida_arba", PARTIDA)
if (ya?.length) throw new Error("ya hay un template con esa partida")
const { data: bol, error: e3 } = await sb.from("boletas_arba").select("id, egreso_id, cuota_id, aplicada, importe, vencimiento").eq("partida", PARTIDA).eq("anio", 2026).eq("cuota", "4").single()
if (e3) throw e3
const { data: modelo, error: e4 } = await sb.from("egresos_sin_factura").select("*").eq("id", MODELO).single()
if (e4) throw e4
const templateId = randomUUID(), cuotaId = randomUUID()
writeFileSync(FOTO, JSON.stringify({ fechas: fechas.map(c => ({ id: c.id, fecha_estimada: c.fecha_estimada })), boleta: bol, templateId, cuotaId }, null, 1))

for (const c of fechas) {
  const { error } = await sb.from("cuotas_egresos_sin_factura").update({ fecha_estimada: c.fecha_vencimiento }).eq("id", c.id)
  if (error) throw error
}
const { created_at: _c, updated_at: _u, id: _i, ...base } = modelo as Record<string, unknown>
const { error: e5 } = await sb.from("egresos_sin_factura").insert({
  ...base, id: templateId, nombre_referencia: "Inmobiliario Cuota Relincho", partida_arba: PARTIDA,
  grupo_impuesto_id: "Inmobiliario Relincho", centro_costo: null, responsable: "PAM",
  observaciones_template: "[script 207] creado 05/11/2026 a pedido de JMS. Relincho: de PAM junto con MEM y MMM. Cuotas 1-3 2026 pagadas fuera del sistema.",
})
if (e5) throw e5
const { error: e6 } = await sb.from("cuotas_egresos_sin_factura").insert({
  id: cuotaId, egreso_id: templateId, numero_cuota: 4, monto: Number(bol!.importe), estado: "pendiente", medio_pago: "banco",
  tipo_movimiento: "egreso", visible_contable: false, fecha_vencimiento: bol!.vencimiento, fecha_estimada: bol!.vencimiento,
  descripcion: "[script 207] boleta ARBA cuota 4 2026",
})
if (e6) throw e6
const { error: e7 } = await sb.from("boletas_arba").update({ egreso_id: templateId, cuota_id: cuotaId, aplicada: true }).eq("id", bol!.id)
if (e7) throw e7

// control
const { data: ctl } = await sb.from("cuotas_egresos_sin_factura").select("fecha_estimada, fecha_vencimiento").in("id", fechas.map(c => c.id))
console.log(`A) ahora estimada = vencimiento en ${ctl!.filter(c => c.fecha_estimada === c.fecha_vencimiento).length} de ${fechas.length}`)
const { data: rel } = await sb.from("cuotas_egresos_sin_factura").select("monto, fecha_vencimiento, egresos_sin_factura(nombre_referencia, responsable, partida_arba)").eq("id", cuotaId).single()
console.log("B)", JSON.stringify(rel))
