/** ↩️ Deshacer del script 196 — vuelve el movimiento de Santander y borra SÓLO la cuenta creada. `--escribir` para aplicar. */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const h = JSON.parse(readFileSync("scripts/196-hecho.json", "utf8")); if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
await sb.schema("msa").from("santander").update({ estado: h.mov.estado, nota_operador: h.mov.nota_operador }).eq("id", h.mov.id)
await sb.from("cuentas_contables").delete().eq("id", h.cuenta); console.log("✅ Deshecho.")
