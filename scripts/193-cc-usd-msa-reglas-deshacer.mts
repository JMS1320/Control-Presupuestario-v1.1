/** ↩️ Deshacer del script 193 — vuelve cada movimiento de msa.cc_usd a `scripts/193-foto-antes.json`. `--escribir` para aplicar. */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const foto = JSON.parse(readFileSync("scripts/193-foto-antes.json", "utf8"))
console.log(`Restaura ${foto.length} movimientos`); if (!process.argv.includes("--escribir")) process.exit(0)
for (const m of foto) { const { error } = await sb.schema("msa").from("cc_usd").update({ estado: m.estado, categ: m.categ, detalle: m.detalle, nota_operador: m.nota_operador }).eq("id", m.id); if (error) throw error }
console.log("✅ Deshecho.")
