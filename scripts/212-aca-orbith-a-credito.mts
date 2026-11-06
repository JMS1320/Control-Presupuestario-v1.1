/**
 * Script 212 (A-FEAT-1570, 06/11 — OK de JMS en esta terminal: «sí, pasalas a crédito»): las cuotas PENDIENTES de dos
 * gastos que se pagan con TARJETA pasan a estado «credito» (A-DEC-1002: pagado con tarjeta → el Cash Flow no lo cuenta
 * como salida de banco y se concilia contra el resumen de la tarjeta):
 *  · «ACA» de PAM (Automóvil Club Argentino) — 6 cuotas de $ 28.600 (jul → dic 2026)
 *  · «Internet NZ» de MA (Orbith) — 5 cuotas de $ 91.300 (ago → dic 2026); la de julio está conciliada y no se toca
 *
 *   npx tsx scripts/212-aca-orbith-a-credito.mts             → foto en scripts/212-foto.json y aplica
 *   npx tsx scripts/212-aca-orbith-a-credito.mts --deshacer  → vuelve cada cuota a su estado de la foto
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const FOTO = "scripts/212-foto.json"

if (process.argv.includes("--deshacer")) {
  const f = JSON.parse(readFileSync(FOTO, "utf8")) as { id: string; estado: string }[]
  for (const c of f) {
    const { error } = await sb.from("cuotas_egresos_sin_factura").update({ estado: c.estado }).eq("id", c.id)
    if (error) throw error
  }
  console.log(`deshecho: ${f.length} cuotas a su estado anterior`)
  process.exit(0)
}
if (existsSync(FOTO)) throw new Error("ya hay una foto: el script ya corrió")

const { data: tps, error: e1 } = await sb.from("egresos_sin_factura").select("id, nombre_referencia, responsable").eq("activo", true)
  .or("and(nombre_referencia.eq.ACA,responsable.eq.PAM),and(nombre_referencia.eq.Internet NZ,responsable.eq.MA)")
if (e1) throw e1
if (tps!.length < 2) throw new Error(`se esperaban al menos 2 templates y hay ${tps!.length}`)
const { data: cs, error: e2 } = await sb.from("cuotas_egresos_sin_factura").select("id, egreso_id, estado, monto, fecha_estimada")
  .in("egreso_id", tps!.map(t => t.id)).eq("estado", "pendiente").gte("fecha_estimada", "2026-07-01")
if (e2) throw e2
console.log(`cuotas a pasar: ${cs!.length}`)
if (cs!.length !== 11) throw new Error("se esperaban 11 — no se toca nada")
writeFileSync(FOTO, JSON.stringify(cs!.map(c => ({ id: c.id, estado: c.estado })), null, 1))
const { error: e3, count } = await sb.from("cuotas_egresos_sin_factura").update({ estado: "credito" }, { count: "exact" }).in("id", cs!.map(c => c.id))
if (e3) throw e3
const { data: ctl } = await sb.from("cuotas_egresos_sin_factura").select("estado").in("id", cs!.map(c => c.id))
console.log(`actualizadas ${count} · control: ${ctl!.filter(c => c.estado === "credito").length} en crédito`)
