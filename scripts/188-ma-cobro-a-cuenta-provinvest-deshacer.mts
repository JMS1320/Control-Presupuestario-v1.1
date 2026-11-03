/**
 * ↩️ Deshacer del script 188 — vuelve el crédito de MA a como estaba y borra SÓLO el cobro a cuenta creado (`scripts/188-hecho.json`),
 * si todavía no se vinculó a una factura.
 *
 *     npx tsx scripts/188-ma-cobro-a-cuenta-provinvest-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/188-ma-cobro-a-cuenta-provinvest-deshacer.mts --escribir   ← deshace (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const h = JSON.parse(readFileSync("scripts/188-hecho.json", "utf8"))
const { data: a } = await sb.from("anticipos_proveedores").select("estado,comprobante_venta_id").eq("id", h.anticipo).single()
console.log(`Borra el cobro a cuenta ${h.anticipo} (${a?.estado}) y restaura el crédito del 16/03`)
if (a?.comprobante_venta_id) { console.log("🛑 FRENA: ya está vinculado a una factura"); process.exit(1) }
if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
const { id, ...antes } = h.mov
{ const { error } = await sb.schema("ma").from("ma_galicia").update(antes).eq("id", id); if (error) throw error }
{ const { error } = await sb.from("anticipos_proveedores").delete().eq("id", h.anticipo); if (error) throw error }
console.log("✅ Deshecho.")
