/**
 * Script 205 (A-FEAT-1565, 05/11, OK de JMS: «ok borralas»): borra las propuestas de boletas de ARBA 2026 que se guardaron
 * VACÍAS al leer del Drive (sin cuota ni importe: cuota «?», importe null, aplicada = false). No toca ninguna aplicada ni
 * ninguna cuota de los templates.
 *   npx tsx scripts/205-boletas-arba-propuestas-vacias.mts             → foto en scripts/205-foto.json y borra por id
 *   npx tsx scripts/205-boletas-arba-propuestas-vacias.mts --deshacer  → vuelve a insertar exactamente las filas de la foto
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const FOTO = "scripts/205-foto.json"

if (process.argv.includes("--deshacer")) {
  const filas = JSON.parse(readFileSync(FOTO, "utf8"))
  const { error } = await sb.from("boletas_arba").insert(filas)
  console.log(error ? "ERROR: " + error.message : `restauradas ${filas.length}`)
} else {
  if (existsSync(FOTO)) throw new Error("ya hay una foto: el script ya corrió")
  const { data, error } = await sb.from("boletas_arba").select("*")
    .eq("anio", 2026).eq("aplicada", false).eq("cuota", "?").is("importe", null)
  if (error) throw error
  console.log(`a borrar: ${data.length}`)
  if (data.length !== 26) throw new Error("se esperaban 26 — no se borra nada")
  writeFileSync(FOTO, JSON.stringify(data, null, 1))
  const { error: e2, count } = await sb.from("boletas_arba").delete({ count: "exact" }).in("id", data.map(d => d.id))
  console.log(e2 ? "ERROR: " + e2.message : `borradas ${count}`)
  const { count: quedan } = await sb.from("boletas_arba").select("id", { count: "exact", head: true }).eq("anio", 2026)
  console.log(`boletas_arba 2026 que quedan: ${quedan}`)
}
