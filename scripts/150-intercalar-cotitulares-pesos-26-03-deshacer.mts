/**
 * Deshace 150 · saca marzo 2026 de Cotitulares en pesos y vuelve el orden de lo corrido.
 *
 *     npx tsx <ruta>/scripts/150-intercalar-cotitulares-pesos-26-03-deshacer.mts              ← dice qué haría
 *     npx tsx <ruta>/scripts/150-intercalar-cotitulares-pesos-26-03-deshacer.mts --escribir   ← lo hace (🛑 con OK de JMS)
 *
 * Usa SÓLO los ids de `150-…-ids.json`. FRENA si algún insertado ya se trabajó (conciliado, con cuenta, template,
 * cuota, factura, anticipo, sueldo o par vinculado): eso se decide con JMS.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ESCRIBIR = process.argv.includes("--escribir")
const AQUI = dirname(fileURLToPath(import.meta.url))
const TABLA = "cotitulares_ca_pesos"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const { insertados, corridos } = JSON.parse(readFileSync(join(AQUI, "150-intercalar-cotitulares-pesos-26-03-ids.json"), "utf8")) as
  { insertados: string[]; corridos: { id: string; antes: number; despues: number }[] }
const VINCULOS = ["categ", "nro_cuenta", "template_id", "template_cuota_id", "comprobante_arca_id", "anticipo_id", "sueldo_pago_id", "par_id"]

const { data } = await sb.from(TABLA).select("*").in("id", insertados.length ? insertados : ["00000000-0000-0000-0000-000000000000"])
const trabajados = (data ?? []).filter(f => f.estado !== "pendiente" || VINCULOS.some(k => k in f && f[k] !== null && f[k] !== ""))
if (trabajados.length) { console.log(`🛑 NO SE TOCA NADA — ${trabajados.length} movimiento(s) de marzo ya trabajados: decidir con JMS`); process.exit(1) }
console.log(`Borraría ${data?.length ?? 0} de ${insertados.length} insertados y volvería ${corridos.length} órdenes.`)
if (!ESCRIBIR) { console.log("(simulación: con --escribir lo hace)"); process.exit(0) }
if (insertados.length) {
  const { error } = await sb.from(TABLA).delete().in("id", insertados)
  if (error) { console.error("❌ " + error.message); process.exit(1) }
}
for (const c of [...corridos].sort((a, b) => a.antes - b.antes)) {   // de adelante para atrás: el hueco ya está libre
  const { error } = await sb.from(TABLA).update({ orden: c.antes }).eq("id", c.id).eq("orden", c.despues)
  if (error) { console.error(`❌ ${c.id}: ${error.message}`); process.exit(1) }
}
console.log("✓ deshecho")
