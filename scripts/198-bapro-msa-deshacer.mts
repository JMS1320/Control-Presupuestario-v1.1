/** ↩️ Deshacer del script 198 — borra SÓLO los movimientos de msa.provincia y las cuotas que creó (`scripts/198-hecho.json`) y restaura la cuota y el movimiento de Galicia del 03/12/25 de la foto. `--escribir` para aplicar. */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const h = JSON.parse(readFileSync("scripts/198-hecho.json", "utf8"))
console.log(`Borra ${h.movimientos.length} movimientos y ${h.cuotas.length} cuotas · restaura Galicia 03/12`)
if (!process.argv.includes("--escribir")) process.exit(0)
if (h.movimientos.length) { const { error } = await sb.schema("msa").from("provincia").delete().in("id", h.movimientos); if (error) throw error }
if (h.cuotas.length) { const { error } = await sb.from("cuotas_egresos_sin_factura").delete().in("id", h.cuotas); if (error) throw error }
if (h.fotoCuotaGalicia) { const { error } = await sb.from("cuotas_egresos_sin_factura").update({ egreso_id: h.fotoCuotaGalicia.egreso_id, detalle: h.fotoCuotaGalicia.detalle }).eq("id", h.fotoCuotaGalicia.id); if (error) throw error }
if (h.fotoGalicia) { const { error } = await sb.from("msa_galicia").update({ template_id: h.fotoGalicia.template_id, comprobantes_pagados: h.fotoGalicia.comprobantes_pagados, nota_operador: h.fotoGalicia.nota_operador }).eq("id", h.fotoGalicia.id); if (error) throw error }
console.log("✅ Deshecho.")
