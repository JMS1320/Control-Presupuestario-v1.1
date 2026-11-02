/**
 * ↩️ Deshacer del script 180 — borra SÓLO las reglas que creó (ids en `scripts/180-hecho.json`) y vuelve los dos pagos de
 * Trabucco y su factura a como estaban (foto en el mismo archivo).
 *
 *     npx tsx scripts/180-trabucco-y-reglas-tarjeta-ma-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/180-trabucco-y-reglas-tarjeta-ma-deshacer.mts --escribir   ← deshace (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const h = JSON.parse(readFileSync("scripts/180-hecho.json", "utf8"))
const COLS = ["comprobante_arca_id", "estado", "categ", "nro_cuenta", "motivo_revision", "nota_operador"]
console.log(`Borra ${h.reglas.length} reglas · restaura ${h.foto.ma_galicia.length} pagos de Galicia MA y la factura`)
if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
{ const { error } = await sb.from("reglas_conciliacion").delete().in("id", h.reglas); if (error) throw error }
for (const m of h.foto.ma_galicia) {
  const { error } = await sb.schema("ma").from("ma_galicia").update(Object.fromEntries(COLS.map(c => [c, m[c]]))).eq("id", m.id); if (error) throw error
}
{ const f = h.foto.factura; const { error } = await sb.schema("ma").from("comprobantes_arca").update({ estado: f.estado, fecha_pago: f.fecha_pago }).eq("id", f.id); if (error) throw error }
console.log("✅ Deshecho.")
