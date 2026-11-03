/**
 * ↩️ Deshacer del script 192 — restaura los 2 débitos desde `scripts/192-hecho.json` y borra SÓLO las cuotas y el template creados.
 *
 *     npx tsx scripts/192-galicia-rural-msa-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/192-galicia-rural-msa-deshacer.mts --escribir   ← deshace (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const h = JSON.parse(readFileSync("scripts/192-hecho.json", "utf8"))
console.log(`Restaura ${h.foto.length} débitos · borra ${h.cuotas.length} cuotas y el template`)
if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
for (const m of h.foto) { const { error } = await sb.from("msa_galicia").update({ template_id: m.template_id, template_cuota_id: m.template_cuota_id, categ: m.categ, estado: m.estado,
  motivo_revision: m.motivo_revision, comprobantes_pagados: m.comprobantes_pagados, nota_operador: m.nota_operador }).eq("id", m.id); if (error) throw error }
if (h.cuotas.length) { const { error } = await sb.from("cuotas_egresos_sin_factura").delete().in("id", h.cuotas); if (error) throw error }
if (h.template) { const { error } = await sb.from("egresos_sin_factura").delete().eq("id", h.template); if (error) throw error }
console.log("✅ Deshecho.")
