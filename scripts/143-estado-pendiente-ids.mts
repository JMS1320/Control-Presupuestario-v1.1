// 143 · Lee (sólo lee) los ids con estado «Pendiente» en mayúscula y escribe las sentencias del DESHACER del 143.
// Correr ANTES del 143: npx tsx <ruta>/scripts/143-estado-pendiente-ids.mts <archivo de salida>
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const TABLAS = [["msa","santander"],["public","cotitulares_ca_usd"],["public","cotitulares_ca_pesos"],["ma","anses_ca_pesos"],["msa","cc_usd"]]
const out: string[] = []
let total = 0
for (const [s, t] of TABLAS) {
  const q = s === "public" ? sb.from(t) : sb.schema(s).from(t)
  const { data, error } = await q.select("id").eq("estado", "Pendiente").limit(5000)
  if (error) throw error
  const ids = (data ?? []).map(r => `'${r.id}'`)
  total += ids.length
  if (ids.length) out.push(`update ${s}.${t} set estado = 'Pendiente' where estado = 'pendiente' and id in (${ids.join(",")});  -- ${ids.length}`)
}
writeFileSync(process.argv[2], out.join("\n") + "\n")
console.log("ids:", total)
