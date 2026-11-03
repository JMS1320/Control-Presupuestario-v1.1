/**
 * ↩️ Deshacer del script 191 — restaura todo desde `scripts/191-foto-antes.json` y borra SÓLO las cuotas y los cheques creados
 * (`scripts/191-hecho.json`).
 *
 *     npx tsx scripts/191-cc-galicia-msa-notas-jms-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/191-cc-galicia-msa-notas-jms-deshacer.mts --escribir   ← deshace (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const T = (k: string) => { const [s, t] = k.split("."); return s === "public" ? sb.from(t) : sb.schema(s).from(t) }
const foto = JSON.parse(readFileSync("scripts/191-foto-antes.json", "utf8"))
const hecho = JSON.parse(readFileSync("scripts/191-hecho.json", "utf8")) as { cuotas: string[]; cheques: string[] }
const COLS: Record<string, string[]> = {
  "public.msa_galicia": ["estado", "categ", "contable", "detalle", "template_id", "template_cuota_id", "comprobante_arca_id", "sueldo_pago_id", "anticipo_id", "comprobantes_pagados", "motivo_revision", "nota_operador"],
  "msa.santander": ["estado", "categ", "template_id", "template_cuota_id", "comprobante_arca_id", "comprobantes_pagados", "motivo_revision", "nota_operador"],
  "msa.comprobantes_arca": ["estado", "fecha_pago", "monto_a_abonar", "observaciones_pago"], "ma.comprobantes_arca": ["estado", "fecha_pago", "observaciones_pago"],
  "ma.ma_galicia": ["comprobante_arca_id", "nota_operador"], "public.anticipos_proveedores": ["estado", "monto_restante", "descripcion"],
  "msa.cheques": ["estado", "fecha_cobro", "fecha_estado"], "sueldos.pagos": ["estado"], cuotas: ["estado", "monto", "fecha_pago"],
}
const total = Object.keys(COLS).reduce((t, k) => t + (foto[k]?.length ?? 0), 0)
console.log(`Restaura ${total} filas · borra ${hecho.cuotas.length} cuotas y ${hecho.cheques.length} cheques registrados`)
if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
for (const [k, cols] of Object.entries(COLS)) for (const f of foto[k] ?? []) {
  const { error } = await (k === "cuotas" ? sb.from("cuotas_egresos_sin_factura") : T(k)).update(Object.fromEntries(cols.map(c => [c, f[c]]))).eq("id", f.id); if (error) throw new Error(`${k} ${f.id}: ${error.message}`)
}
if (hecho.cheques.length) { const { error } = await sb.schema("msa").from("cheques").delete().in("id", hecho.cheques); if (error) throw error }
if (hecho.cuotas.length) { const { error } = await sb.from("cuotas_egresos_sin_factura").delete().in("id", hecho.cuotas); if (error) throw error }
console.log("✅ Deshecho.")
