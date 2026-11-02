/**
 * ↩️ Deshacer del script 181 — restaura los movimientos de Galicia MA, las cuotas que tocó (AySA, ABL, Metrogas) y las
 * facturas desde `scripts/181-foto-antes.json`, y borra SÓLO las cuotas que creó (`scripts/181-hecho.json`).
 *
 *     npx tsx scripts/181-ca-ma-tanda-1-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/181-ca-ma-tanda-1-deshacer.mts --escribir   ← deshace (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const foto = JSON.parse(readFileSync("scripts/181-foto-antes.json", "utf8"))
const hecho = JSON.parse(readFileSync("scripts/181-hecho.json", "utf8")) as { cuotas: string[] }
const de = (k: string) => { const [s, t] = k.split("."); return s === "public" ? sb.from(t) : sb.schema(s).from(t) }
const MOV = ["estado", "categ", "nro_cuenta", "detalle", "template_id", "template_cuota_id", "comprobantes_pagados", "motivo_revision", "nota_operador", "comprobante_arca_id", "contable"]
const FC = ["estado", "cuenta_contable", "nro_cuenta", "fecha_pago"], CU = ["monto", "estado", "fecha_pago"]
const lotes: [string, any[], string[]][] = [["ma.ma_galicia", foto["ma.ma_galicia"], MOV], ["ma.comprobantes_arca", foto["ma.comprobantes_arca"] ?? [], FC],
  ["public.cuotas_egresos_sin_factura", foto.cuotas ?? [], CU], ...Object.entries(foto.propagacion as Record<string, any[]>).map(([k, f]) => [k, f, ["categ", "nro_cuenta"]] as [string, any[], string[]])]
const { data: usan } = await sb.schema("ma").from("ma_galicia").select("id").in("template_cuota_id", hecho.cuotas)
const ids = new Set(foto["ma.ma_galicia"].map((m: any) => m.id))
const ajenos = (usan ?? []).filter((u: any) => !ids.has(u.id))
console.log(`Restaura ${lotes.reduce((t, l) => t + l[1].length, 0)} filas · borra ${hecho.cuotas.length} cuotas`)
if (ajenos.length) { console.log(`🛑 FRENA: ${ajenos.length} movimientos que el 181 no tocó usan sus cuotas`); process.exit(1) }
if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
for (const [k, filas, cols] of lotes) for (const f of filas) {
  const { error } = await de(k).update(Object.fromEntries(cols.map(c => [c, f[c]]))).eq("id", f.id); if (error) throw new Error(`${k} ${f.id}: ${error.message}`)
}
for (let i = 0; i < hecho.cuotas.length; i += 200) { const { error } = await sb.from("cuotas_egresos_sin_factura").delete().in("id", hecho.cuotas.slice(i, i + 200)); if (error) throw error }
console.log("✅ Deshecho.")
