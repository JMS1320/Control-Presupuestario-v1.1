/**
 * 📝 A-FEAT-1257 — regularizar el DETALLE de los cobros de venta ya conciliados: la cuota del
 * arrendamiento o las cabezas de hacienda. Pedido del usuario 2026-10-05: *«como aún no tenemos tantos
 * movimientos atrás, podamos regularizarlas»*.
 *
 *     npx tsx scripts/regularizar-detalle-cobros.mts            → LISTA lo que haría (no escribe)
 *     npx tsx scripts/regularizar-detalle-cobros.mts --aplicar  → lo escribe (con OK del usuario)
 *
 * Usa la MISMA función que la conciliación (`anotarQueSeCobro`), así que lo que propone es lo que habría
 * puesto la app. No pisa lo que escribió el usuario: lo agrega al final.
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { queSeCobroDe, anotarQueSeCobro } from "../lib/ventas/detalle-cobro-db"
import { textoQueSeCobro, detalleConQueSeCobro } from "../lib/ventas/que-se-cobro"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)
const aplicar = process.argv.includes("--aplicar")

const { data: movs, error } = await sb.from("msa_galicia")
  .select("id, fecha, creditos, detalle, estado, comprobante_venta_id")
  .not("comprobante_venta_id", "is", null).gt("creditos", 0).order("fecha")
if (error) throw error
const { data: vs } = await sb.schema("msa").from("comprobantes_venta").select("id, nro_comprobante, denominacion_cliente")
const nro = new Map((vs || []).map((v: any) => [v.id, `${v.nro_comprobante} ${v.denominacion_cliente}`]))

let cambian = 0, sinVinculo = 0
for (const m of (movs || []) as any[]) {
  const q = await queSeCobroDe(sb as any, m.comprobante_venta_id, m.fecha)
  const texto = q ? textoQueSeCobro(q) : null
  if (!texto) { sinVinculo++; console.log(`  —  ${m.fecha} $${m.creditos} ${nro.get(m.comprobante_venta_id)}: sin vínculo con la venta (no se sabe la cuota / cabezas)`); continue }
  const nuevo = detalleConQueSeCobro(m.detalle, texto)
  if (nuevo === (m.detalle || null)) continue
  cambian++
  console.log(`  ✎  ${m.fecha} $${m.creditos} ${nro.get(m.comprobante_venta_id)} [${m.estado}]\n       antes: ${m.detalle ?? "(vacío)"}\n       queda: ${nuevo}`)
  if (aplicar) await anotarQueSeCobro(sb as any, m.id, m.comprobante_venta_id)
}
console.log(`\n${cambian} movimiento(s) ${aplicar ? "actualizados" : "cambiarían"} · ${sinVinculo} sin vínculo factura↔venta`)
