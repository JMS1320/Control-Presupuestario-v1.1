/**
 * ↩️ Deshacer del script 189 — restaura los renglones de la tarjeta PAM y los 3 débitos de la CA PAM desde `scripts/189-foto-antes.json`,
 * y borra SÓLO las cuotas y el template creados (`scripts/189-hecho.json`).
 *
 *     npx tsx scripts/189-tarjeta-pam-notas-jms-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/189-tarjeta-pam-notas-jms-deshacer.mts --escribir   ← deshace (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const foto = JSON.parse(readFileSync("scripts/189-foto-antes.json", "utf8"))
const hecho = JSON.parse(readFileSync("scripts/189-hecho.json", "utf8")) as { templates: string[]; cuotas: string[] }
const TJ = ["estado", "categ", "template_id", "template_cuota_id", "comprobantes_pagados", "motivo_revision", "nota_operador", "contable", "proveedor_nombre", "detalle"]
const GAL = ["nro_resumen", "comprobantes_pagados"]
const ninguno = ["00000000-0000-0000-0000-000000000000"]
const ids = new Set(foto["pam.tarjeta_visa"].map((m: any) => m.id))
const { data: usan } = await sb.schema("pam").from("tarjeta_visa").select("id").in("template_cuota_id", hecho.cuotas.length ? hecho.cuotas : ninguno)
const { data: otras } = await sb.from("cuotas_egresos_sin_factura").select("id").in("egreso_id", hecho.templates.length ? hecho.templates : ninguno)
const ajenos = (usan ?? []).filter((u: any) => !ids.has(u.id)), cuotasAjenas = (otras ?? []).filter((q: any) => !hecho.cuotas.includes(q.id))
console.log(`Restaura ${ids.size} renglones de tarjeta y ${foto["public.pam_galicia"].length} débitos · borra ${hecho.cuotas.length} cuotas y ${hecho.templates.length} template`)
if (ajenos.length || cuotasAjenas.length) { console.log("🛑 FRENA: hay renglones o cuotas que el 189 no creó usando lo suyo"); process.exit(1) }
if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
for (const f of foto["pam.tarjeta_visa"]) { const { error } = await sb.schema("pam").from("tarjeta_visa").update(Object.fromEntries(TJ.map(c => [c, f[c]]))).eq("id", f.id); if (error) throw error }
for (const f of foto["public.pam_galicia"]) { const { error } = await sb.from("pam_galicia").update(Object.fromEntries(GAL.map(c => [c, f[c]]))).eq("id", f.id); if (error) throw error }
if (hecho.cuotas.length) { const { error } = await sb.from("cuotas_egresos_sin_factura").delete().in("id", hecho.cuotas); if (error) throw error }
if (hecho.templates.length) { const { error } = await sb.from("egresos_sin_factura").delete().in("id", hecho.templates); if (error) throw error }
console.log("✅ Deshecho.")
