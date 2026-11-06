/**
 * Script 208 (A-FEAT-1565/1567, 05/11 — pedidos de JMS en esta terminal):
 *  A) «tema de 2 de complementario borrar si están duplicadas sí»: borra las 2 propuestas PROVISORIAS de los
 *     complementarios (`complementario:<archivo>`, sin template, sin aplicar). Las verdaderas (aplicadas) no se tocan.
 *  B) «a ERM deben venir los 2 x Quinta Rosello y el de El Relincho»: esos 3 templates llevan `responsable_interno = 'ERM'`
 *     (el registro sigue en PAM, que paga; la carpeta del Drive es la de ERM — como `polizas_responsables`).
 *  C) El template creado por el script 207 pasa a llamarse como en el Drive de JMS: «Inmobiliario Cuota El Relincho».
 *
 *   npx tsx scripts/208-arba-copias-y-erm.mts             → foto en scripts/208-foto.json y aplica
 *   npx tsx scripts/208-arba-copias-y-erm.mts --deshacer  → vuelve exactamente a la foto
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const FOTO = "scripts/208-foto.json"
const PARTIDAS_ERM = ["099-001854-5", "099-001846-4", "099-025089-8"]

if (process.argv.includes("--deshacer")) {
  const f = JSON.parse(readFileSync(FOTO, "utf8"))
  const { error } = await sb.from("boletas_arba").insert(f.copias)
  if (error) throw error
  for (const t of f.templates) {
    const { error: e } = await sb.from("egresos_sin_factura").update({ responsable_interno: t.responsable_interno, nombre_referencia: t.nombre_referencia, grupo_impuesto_id: t.grupo_impuesto_id }).eq("id", t.id)
    if (e) throw e
  }
  console.log(`deshecho: ${f.copias.length} copias restauradas, ${f.templates.length} templates como estaban`)
  process.exit(0)
}
if (existsSync(FOTO)) throw new Error("ya hay una foto: el script ya corrió")

const { data: copias, error: e1 } = await sb.from("boletas_arba").select("*").eq("anio", 2026).eq("cuota", "4")
  .like("partida", "complementario:%.pdf").eq("aplicada", false).is("egreso_id", null)
if (e1) throw e1
const { data: tps, error: e2 } = await sb.from("egresos_sin_factura").select("id, nombre_referencia, responsable, responsable_interno, grupo_impuesto_id, partida_arba").eq("activo", true).in("partida_arba", PARTIDAS_ERM)
if (e2) throw e2
console.log(`A) copias: ${copias!.length} · B) templates: ${tps!.map(t => t.nombre_referencia).join(", ")}`)
if (copias!.length !== 2 || tps!.length !== 3) throw new Error("se esperaban 2 copias y 3 templates — no se toca nada")
writeFileSync(FOTO, JSON.stringify({ copias, templates: tps }, null, 1))

const { error: e3 } = await sb.from("boletas_arba").delete().in("id", copias!.map(c => c.id))
if (e3) throw e3
for (const t of tps!) {
  const cambios: Record<string, unknown> = { responsable_interno: "ERM" }
  if (t.partida_arba === "099-025089-8") { cambios.nombre_referencia = "Inmobiliario Cuota El Relincho"; cambios.grupo_impuesto_id = "Inmobiliario El Relincho" }
  const { error } = await sb.from("egresos_sin_factura").update(cambios).eq("id", t.id)
  if (error) throw error
}
const { data: ctl } = await sb.from("egresos_sin_factura").select("nombre_referencia, responsable, responsable_interno").in("id", tps!.map(t => t.id))
const { count } = await sb.from("boletas_arba").select("id", { count: "exact", head: true }).eq("anio", 2026).eq("cuota", "4")
console.log("control:", JSON.stringify(ctl), `· boletas cuota 4 que quedan: ${count}`)
