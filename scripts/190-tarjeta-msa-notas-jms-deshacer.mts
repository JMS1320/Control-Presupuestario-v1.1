/**
 * ↩️ Deshacer del script 190 — restaura la tarjeta Business, los débitos de Galicia MSA y la factura de Medicus desde
 * `scripts/190-foto-antes.json`, y borra SÓLO las cuotas creadas (`scripts/190-hecho.json`).
 *
 *     npx tsx scripts/190-tarjeta-msa-notas-jms-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/190-tarjeta-msa-notas-jms-deshacer.mts --escribir   ← deshace (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const foto = JSON.parse(readFileSync("scripts/190-foto-antes.json", "utf8"))
const hecho = JSON.parse(readFileSync("scripts/190-hecho.json", "utf8")) as { cuotas: string[] }
const TJ = ["estado", "categ", "detalle", "contable", "template_id", "template_cuota_id", "comprobantes_pagados", "motivo_revision", "nota_operador", "comprobante_arca_id", "proveedor_nombre"]
const ids = new Set(foto["msa.tarjeta_visa_business"].map((m: any) => m.id))
const { data: usan } = hecho.cuotas.length ? await sb.schema("msa").from("tarjeta_visa_business").select("id").in("template_cuota_id", hecho.cuotas) : { data: [] }
console.log(`Restaura ${ids.size} renglones, ${foto["public.msa_galicia"].length} débitos y la factura de Medicus · borra ${hecho.cuotas.length} cuotas`)
if ((usan ?? []).some((u: any) => !ids.has(u.id))) { console.log("🛑 FRENA: otro renglón usa una cuota del 190"); process.exit(1) }
if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
for (const f of foto["msa.tarjeta_visa_business"]) { const { error } = await sb.schema("msa").from("tarjeta_visa_business").update(Object.fromEntries(TJ.map(c => [c, f[c]]))).eq("id", f.id); if (error) throw error }
for (const f of foto["public.msa_galicia"]) { const { error } = await sb.from("msa_galicia").update({ nro_resumen: f.nro_resumen, comprobantes_pagados: f.comprobantes_pagados }).eq("id", f.id); if (error) throw error }
for (const f of foto["msa.comprobantes_arca"]) { const { error } = await sb.schema("msa").from("comprobantes_arca").update({ monto_a_abonar: f.monto_a_abonar, observaciones_pago: f.observaciones_pago }).eq("id", f.id); if (error) throw error }
if (hecho.cuotas.length) { const { error } = await sb.from("cuotas_egresos_sin_factura").delete().in("id", hecho.cuotas); if (error) throw error }
console.log("✅ Deshecho.")
