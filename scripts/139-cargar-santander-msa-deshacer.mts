/**
 * Deshace 139 · la carga de Santander MSA (A-FEAT-1424).
 *
 *     npx tsx scripts/139-cargar-santander-msa-deshacer.mts              ← dice qué borraría
 *     npx tsx scripts/139-cargar-santander-msa-deshacer.mts --escribir   ← borra (🛑 con OK de JMS)
 *
 * Borra SÓLO los ids de `139-cargar-santander-msa-ids.json`, y FRENA si alguno ya se trabajó (conciliado, con
 * cuenta contable, template, cuota, factura o par vinculado).
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const ESCRIBIR = process.argv.includes("--escribir")
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const tabla = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY).schema("msa").from("santander")
const ids: string[] = JSON.parse(readFileSync("scripts/139-cargar-santander-msa-ids.json", "utf8"))
const VINCULOS = ["categ", "nro_cuenta", "template_id", "template_cuota_id", "comprobante_arca_id", "par_id"]

const trabajadas: string[] = []
let n = 0
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await tabla().select("*").in("id", ids.slice(i, i + 200))
  if (error) throw error
  n += data?.length ?? 0
  for (const f of data ?? []) if (VINCULOS.some(k => f[k] !== null && f[k] !== "") || f.estado !== "Pendiente") trabajadas.push(`${f.fecha} «${String(f.descripcion).slice(0, 40)}» (${f.estado})`)
}
console.log(`msa.santander: ${n} de ${ids.length} siguen en la base`)
if (trabajadas.length) { console.log(`🛑 NO SE BORRA NADA — ${trabajadas.length} ya trabajadas:`); trabajadas.slice(0, 20).forEach(t => console.log("   " + t)); process.exit(1) }
if (!ESCRIBIR) { console.log("(simulación: con --escribir borra esos ids)"); process.exit(0) }
for (let i = 0; i < ids.length; i += 200) { const { error } = await tabla().delete().in("id", ids.slice(i, i + 200)); if (error) throw error }
console.log(`✓ borradas ${ids.length}`)
