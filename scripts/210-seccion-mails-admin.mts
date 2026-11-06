/**
 * Script 210 (A-FEAT-1548, 06/11): suma la sección «mails» (nueva, 13ª del menú) al rol ADMIN en `public.roles.secciones`.
 * Hasta acá Mails era una solapa de Egresos sólo para admin; ahora es sección propia y el rol decide quién la ve.
 * Ningún otro rol la recibe (tiene mails de la familia y de la sucesión). Aviso previo a Javier en ENTRE-DESARROLLADORES.md.
 *
 *   npx tsx scripts/210-seccion-mails-admin.mts             → foto en scripts/210-foto.json y aplica
 *   npx tsx scripts/210-seccion-mails-admin.mts --deshacer  → vuelve las secciones de admin a la foto
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const FOTO = "scripts/210-foto.json"

if (process.argv.includes("--deshacer")) {
  const f = JSON.parse(readFileSync(FOTO, "utf8"))
  const { error } = await sb.from("roles").update({ secciones: f.secciones }).eq("id", "admin")
  console.log(error ? "ERROR: " + error.message : "deshecho: admin con " + JSON.stringify(f.secciones))
  process.exit(0)
}
if (existsSync(FOTO)) throw new Error("ya hay una foto: el script ya corrió")
const { data, error } = await sb.from("roles").select("secciones").eq("id", "admin").single()
if (error) throw error
const antes = (data.secciones ?? []) as string[]
if (antes.includes("mails")) { console.log("admin ya tiene «mails»: nada que hacer"); process.exit(0) }
writeFileSync(FOTO, JSON.stringify({ secciones: antes }, null, 1))
const { error: e2 } = await sb.from("roles").update({ secciones: [...antes, "mails"] }).eq("id", "admin")
if (e2) throw e2
const { data: ctl } = await sb.from("roles").select("id, secciones").order("id")
console.log("control:", JSON.stringify(ctl))
