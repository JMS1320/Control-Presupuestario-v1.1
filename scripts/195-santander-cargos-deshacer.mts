/** ↩️ Deshacer del script 195 — restaura los cargos de msa.santander y borra SÓLO las cuotas creadas. `--escribir` para aplicar. */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const h = JSON.parse(readFileSync("scripts/195-hecho.json", "utf8"))
console.log(`Restaura ${h.foto.length} · borra ${h.cuotas.length} cuotas`); if (!process.argv.includes("--escribir")) process.exit(0)
for (const m of h.foto) { const { error } = await sb.schema("msa").from("santander").update({ estado: m.estado, categ: m.categ, template_id: m.template_id, template_cuota_id: m.template_cuota_id,
  motivo_revision: m.motivo_revision, comprobantes_pagados: m.comprobantes_pagados, nota_operador: m.nota_operador }).eq("id", m.id); if (error) throw error }
if (h.cuotas.length) { const { error } = await sb.from("cuotas_egresos_sin_factura").delete().in("id", h.cuotas); if (error) throw error }
console.log("✅ Deshecho.")
