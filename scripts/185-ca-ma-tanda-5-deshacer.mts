/**
 * ↩️ Deshacer del script 185 — restaura movimientos y la factura de Bolig desde `scripts/185-foto-antes.json`, y borra SÓLO las
 * cuotas y el template que creó (`scripts/185-hecho.json`).
 *
 *     npx tsx scripts/185-ca-ma-tanda-5-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/185-ca-ma-tanda-5-deshacer.mts --escribir   ← deshace (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const foto = JSON.parse(readFileSync("scripts/185-foto-antes.json", "utf8"))
const hecho = JSON.parse(readFileSync("scripts/185-hecho.json", "utf8")) as { template: string | null; cuotas: string[] }
const MOV = ["estado", "categ", "nro_cuenta", "detalle", "contable", "template_id", "template_cuota_id", "comprobantes_pagados", "motivo_revision", "nota_operador", "comprobante_arca_id"]
const ids = new Set(foto["ma.ma_galicia"].map((m: any) => m.id))
const { data: usan } = hecho.cuotas.length ? await sb.schema("ma").from("ma_galicia").select("id").in("template_cuota_id", hecho.cuotas) : { data: [] }
const { data: otras } = hecho.template ? await sb.from("cuotas_egresos_sin_factura").select("id").eq("egreso_id", hecho.template) : { data: [] }
const ajenos = (usan ?? []).filter((u: any) => !ids.has(u.id)), cuotasAjenas = (otras ?? []).filter((q: any) => !hecho.cuotas.includes(q.id))
console.log(`Restaura ${foto["ma.ma_galicia"].length} movimientos y ${foto["msa.comprobantes_arca"].length} factura · borra ${hecho.cuotas.length} cuotas y el template`)
if (ajenos.length || cuotasAjenas.length) { console.log(`🛑 FRENA: hay movimientos o cuotas que el 185 no creó usando lo suyo`); process.exit(1) }
if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
for (const f of foto["ma.ma_galicia"]) {
  const { error } = await sb.schema("ma").from("ma_galicia").update(Object.fromEntries(MOV.map(c => [c, f[c]]))).eq("id", f.id); if (error) throw error
}
for (const f of foto["msa.comprobantes_arca"]) {
  const { error } = await sb.schema("msa").from("comprobantes_arca").update({ estado: f.estado, fecha_pago: f.fecha_pago }).eq("id", f.id); if (error) throw error
}
if (hecho.cuotas.length) { const { error } = await sb.from("cuotas_egresos_sin_factura").delete().in("id", hecho.cuotas); if (error) throw error }
if (hecho.template) { const { error } = await sb.from("egresos_sin_factura").delete().eq("id", hecho.template); if (error) throw error }
console.log("✅ Deshecho.")
