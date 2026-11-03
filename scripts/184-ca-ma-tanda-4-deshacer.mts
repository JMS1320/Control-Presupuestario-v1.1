/**
 * ↩️ Deshacer del script 184 — restaura movimientos, facturas (MA y MSA) y la propagación desde `scripts/184-foto-antes.json`,
 * y borra SÓLO las cuotas que creó (`scripts/184-hecho.json`).
 *
 *     npx tsx scripts/184-ca-ma-tanda-4-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/184-ca-ma-tanda-4-deshacer.mts --escribir   ← deshace (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const foto = JSON.parse(readFileSync("scripts/184-foto-antes.json", "utf8"))
const hecho = JSON.parse(readFileSync("scripts/184-hecho.json", "utf8")) as { cuotas: string[] }
const de = (k: string) => { const [s, t] = k.split("."); return s === "public" ? sb.from(t) : sb.schema(s).from(t) }
const MOV = ["estado", "categ", "nro_cuenta", "detalle", "contable", "template_id", "template_cuota_id", "comprobantes_pagados", "motivo_revision", "nota_operador", "comprobante_arca_id"]
const FC = ["estado", "cuenta_contable", "nro_cuenta", "fecha_pago"]
const lotes: [string, any[], string[]][] = [["ma.ma_galicia", foto["ma.ma_galicia"], MOV], ["ma.comprobantes_arca", foto["ma.comprobantes_arca"] ?? [], FC],
  ["msa.comprobantes_arca", foto["msa.comprobantes_arca"] ?? [], FC],
  ...Object.entries(foto.propagacion as Record<string, any[]>).map(([k, f]) => [k, f, ["categ", "nro_cuenta"]] as [string, any[], string[]])]
const ids = new Set(foto["ma.ma_galicia"].map((m: any) => m.id))
const { data: usan } = hecho.cuotas.length ? await sb.schema("ma").from("ma_galicia").select("id").in("template_cuota_id", hecho.cuotas) : { data: [] }
const ajenos = (usan ?? []).filter((u: any) => !ids.has(u.id))
console.log(`Restaura ${lotes.reduce((t, l) => t + l[1].length, 0)} filas · borra ${hecho.cuotas.length} cuotas`)
if (ajenos.length) { console.log(`🛑 FRENA: ${ajenos.length} movimientos que el 184 no tocó usan sus cuotas`); process.exit(1) }
if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
for (const [k, filas, cols] of lotes) for (const f of filas) {
  const { error } = await de(k).update(Object.fromEntries(cols.map(c => [c, f[c]]))).eq("id", f.id); if (error) throw new Error(`${k} ${f.id}: ${error.message}`)
}
if (hecho.cuotas.length) { const { error } = await sb.from("cuotas_egresos_sin_factura").delete().in("id", hecho.cuotas); if (error) throw error }
console.log("✅ Deshecho.")
