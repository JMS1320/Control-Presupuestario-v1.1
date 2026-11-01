/**
 * Deshace el script 167 (parseo de Santander):
 *  1. vuelve cada fila de msa.santander a su foto (`167-parseo-santander-foto.json`, por id: concepto y las columnas del desglose);
 *  2. borra las reglas de parseo de msa_santander marcadas «[script 167]» y la regla de conciliación marcada igual.
 * ⚠️ No deshace lo que ya se haya CONCILIADO con la regla nueva (eso se revisa a mano).
 *
 *     npx tsx scripts/167-parseo-santander-deshacer.mts              ← SIMULA
 *     npx tsx scripts/167-parseo-santander-deshacer.mts --escribir   ← deshace (🛑 con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "node:fs"
const ESCRIBIR = process.argv.includes("--escribir")
const FOTO = "scripts/167-parseo-santander-foto.json"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
if (!existsSync(FOTO)) { console.error(`🛑 no está ${FOTO}: el 167 no corrió`); process.exit(1) }
const foto: { id: string; antes: Record<string, unknown> }[] = JSON.parse(readFileSync(FOTO, "utf8"))
const { count: nP } = await sb.from("config_parseo_extracto").select("id", { count: "exact", head: true }).eq("cuenta_bancaria_id", "msa_santander").like("descripcion_campo", "[script 167]%")
const { count: nC } = await sb.from("reglas_conciliacion").select("id", { count: "exact", head: true }).eq("cuenta_bancaria_id", "msa_santander").like("detalle", "[script 167]%")
console.log(`Vuelven a su foto ${foto.length} filas · se borran ${nP} reglas de parseo y ${nC} de conciliación`)
if (!ESCRIBIR) { console.log("(simulación: con --escribir deshace)"); process.exit(0) }
for (const f of foto) { const { error } = await sb.schema("msa").from("santander").update(f.antes).eq("id", f.id); if (error) { console.error(f.id, error.message); process.exit(1) } }
await sb.from("config_parseo_extracto").delete().eq("cuenta_bancaria_id", "msa_santander").like("descripcion_campo", "[script 167]%")
await sb.from("reglas_conciliacion").delete().eq("cuenta_bancaria_id", "msa_santander").like("detalle", "[script 167]%")
console.log("✅ deshecho")
