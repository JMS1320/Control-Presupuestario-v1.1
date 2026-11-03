/**
 * ↩️ Deshacer del script 182 — restaura movimientos, facturas y la venta de Provinvest desde `scripts/182-foto-antes.json`,
 * y borra SÓLO las cuotas y retenciones que creó (`scripts/182-hecho.json`).
 *
 *     npx tsx scripts/182-ca-ma-tanda-2-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/182-ca-ma-tanda-2-deshacer.mts --escribir   ← deshace (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ma = sb.schema("ma")
const foto = JSON.parse(readFileSync("scripts/182-foto-antes.json", "utf8"))
const hecho = JSON.parse(readFileSync("scripts/182-hecho.json", "utf8")) as { cuotas: string[]; retenciones: string[] }
const MOV = ["estado", "categ", "nro_cuenta", "detalle", "template_id", "template_cuota_id", "comprobantes_pagados", "motivo_revision", "nota_operador", "comprobante_arca_id", "comprobante_venta_id", "contable"]
const lotes: [string, any[], string[]][] = [
  ["ma_galicia", foto["ma.ma_galicia"], MOV],
  ["comprobantes_arca", foto["ma.comprobantes_arca"], ["estado", "fecha_pago"]],
  ["comprobantes_venta", foto["ma.comprobantes_venta"], ["estado", "cuenta_contable", "nro_cuenta"]],
]
const ids = new Set(foto["ma.ma_galicia"].map((m: any) => m.id))
const { data: usan } = await ma.from("ma_galicia").select("id").in("template_cuota_id", hecho.cuotas.length ? hecho.cuotas : ["00000000-0000-0000-0000-000000000000"])
const ajenos = (usan ?? []).filter((u: any) => !ids.has(u.id))
console.log(`Restaura ${lotes.reduce((t, l) => t + l[1].length, 0)} filas · borra ${hecho.cuotas.length} cuotas y ${hecho.retenciones.length} retenciones`)
if (ajenos.length) { console.log(`🛑 FRENA: ${ajenos.length} movimientos que el 182 no tocó usan sus cuotas`); process.exit(1) }
if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
for (const [t, filas, cols] of lotes) for (const f of filas) {
  const { error } = await ma.from(t).update(Object.fromEntries(cols.map(c => [c, f[c]]))).eq("id", f.id); if (error) throw new Error(`${t} ${f.id}: ${error.message}`)
}
if (hecho.retenciones.length) { const { error } = await ma.from("retenciones_recibidas").delete().in("id", hecho.retenciones); if (error) throw error }
if (hecho.cuotas.length) { const { error } = await sb.from("cuotas_egresos_sin_factura").delete().in("id", hecho.cuotas); if (error) throw error }
console.log("✅ Deshecho.")
