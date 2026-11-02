/**
 * ↩️ Deshacer del script 177 — borra SÓLO los movimientos de MA Galicia que dejó en `scripts/177-hecho.json`.
 * Frena si alguno ya se concilió o se le cargó algo (categoría, detalle, cuota, factura, sueldo, anticipo).
 *
 *     npx tsx scripts/177-ma-galicia-oct-dic-2025-deshacer.mts              ← dice qué borraría
 *     npx tsx scripts/177-ma-galicia-oct-dic-2025-deshacer.mts --escribir   ← borra (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const { ids } = JSON.parse(readFileSync("scripts/177-hecho.json", "utf8")) as { ids: string[] }
const { data } = await sb.schema("ma").from("ma_galicia")
  .select("id,estado,detalle,template_cuota_id,comprobante_arca_id,sueldo_pago_id,anticipo_id,comprobante_venta_id,origen").in("id", ids)
const tocados = (data ?? []).filter(m => m.origen !== "CA_GALICIA_PDF" || m.estado !== "pendiente" || m.detalle || m.template_cuota_id
  || m.comprobante_arca_id || m.sueldo_pago_id || m.anticipo_id || m.comprobante_venta_id)
console.log(`${ids.length} ids en el registro · ${data?.length ?? 0} en la base · ${tocados.length} ya tocados`)
if (tocados.length) { console.log("🛑 FRENA: hay movimientos conciliados o editados:", tocados.map(t => t.id).join(", ")); process.exit(1) }
if (!process.argv.includes("--escribir")) { console.log("(simulación: no se borró nada)"); process.exit(0) }
const { error } = await sb.schema("ma").from("ma_galicia").delete().in("id", ids)
if (error) throw error
console.log(`✅ ${ids.length} movimientos borrados.`)
