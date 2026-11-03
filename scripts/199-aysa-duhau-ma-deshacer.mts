/** ↩️ Deshacer del script 199 — restaura el movimiento de ma.ma_galicia de la foto y borra SÓLO la cuota y el template creados (`scripts/199-hecho.json`). `--escribir` para aplicar. */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const h = JSON.parse(readFileSync("scripts/199-hecho.json", "utf8"))
console.log(`Restaura el movimiento ${h.foto?.id} · borra cuota ${h.cuota} y template ${h.template}`)
if (!process.argv.includes("--escribir")) process.exit(0)
const f = h.foto
const { error } = await sb.schema("ma").from("ma_galicia").update({ estado: f.estado, categ: f.categ, template_id: f.template_id, template_cuota_id: f.template_cuota_id, detalle: f.detalle,
  motivo_revision: f.motivo_revision, comprobantes_pagados: f.comprobantes_pagados, nota_operador: f.nota_operador }).eq("id", f.id)
if (error) throw error
if (h.cuota) { const { error: e } = await sb.from("cuotas_egresos_sin_factura").delete().eq("id", h.cuota); if (e) throw e }
if (h.template) { const { error: e } = await sb.from("egresos_sin_factura").delete().eq("id", h.template); if (e) throw e }
console.log("✅ Deshecho.")
