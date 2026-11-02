/**
 * ↩️ Deshacer del script 179 — restaura los movimientos y facturas desde `scripts/179-foto-antes.json`, y borra SÓLO las
 * cuotas, templates y cuentas que creó el 179 (ids en `scripts/179-hecho.json`). Frena si algo de lo creado ya lo usa
 * otra fila que el 179 no tocó.
 *
 *     npx tsx scripts/179-tarjeta-ma-lo-que-falta-deshacer.mts              ← dice qué haría
 *     npx tsx scripts/179-tarjeta-ma-lo-que-falta-deshacer.mts --escribir   ← deshace (con OK de JMS)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const foto = JSON.parse(readFileSync("scripts/179-foto-antes.json", "utf8"))
const hecho = JSON.parse(readFileSync("scripts/179-hecho.json", "utf8")) as { cuentas: string[]; templates: string[]; cuotas: string[] }
const TOCA = ["estado", "categ", "nro_cuenta", "detalle", "template_id", "template_cuota_id", "comprobantes_pagados", "motivo_revision", "nota_operador",
  "comprobante_arca_id", "contable", "cuenta_contable", "fecha_pago"]
const de = (k: string) => { const [s, t] = k.split("."); return s === "public" ? sb.from(t) : sb.schema(s).from(t) }
const restaurar: [string, any[]][] = [["ma.tarjeta_visa", foto["ma.tarjeta_visa"]], ["ma.comprobantes_arca", foto["ma.comprobantes_arca"]],
  ["msa.comprobantes_arca", foto["msa.comprobantes_arca"]], ...Object.entries(foto.propagacion as Record<string, any[]>)]
const idsMovFoto = new Set(foto["ma.tarjeta_visa"].map((m: any) => m.id))
const frenos: string[] = []
// ¿alguna cuota creada está atada a un movimiento que el 179 no tocó?
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const { data } = await de(`${t.schema}.${t.tabla}`).select("id,template_cuota_id").in("template_cuota_id", hecho.cuotas)
  for (const x of data ?? []) if (!(t.schema === "ma" && t.tabla === "tarjeta_visa" && idsMovFoto.has(x.id))) frenos.push(`${t.tabla} ${x.id} usa una cuota del 179`)
}
const { data: otrasCuotas } = await sb.from("cuotas_egresos_sin_factura").select("id").in("egreso_id", hecho.templates)
const ajenas = (otrasCuotas ?? []).filter((c: any) => !hecho.cuotas.includes(c.id))
if (ajenas.length) frenos.push(`${ajenas.length} cuotas de otro origen en los templates del 179`)
console.log(`Restaura ${restaurar.reduce((t, [, f]) => t + f.length, 0)} filas · borra ${hecho.cuotas.length} cuotas, ${hecho.templates.length} templates, ${hecho.cuentas.length} cuentas`)
if (frenos.length) { console.log("🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!process.argv.includes("--escribir")) { console.log("(simulación)"); process.exit(0) }
for (const [k, filas] of restaurar) for (const f of filas) {
  const upd = Object.fromEntries(Object.entries(f).filter(([c]) => TOCA.includes(c)))
  const { error } = await de(k).update(upd).eq("id", f.id); if (error) throw new Error(`${k} ${f.id}: ${error.message}`)
}
for (const [tabla, ids] of [["cuotas_egresos_sin_factura", hecho.cuotas], ["egresos_sin_factura", hecho.templates], ["cuentas_contables", hecho.cuentas]] as const) {
  const { error } = await sb.from(tabla).delete().in("id", ids as string[]); if (error) throw new Error(`${tabla}: ${error.message}`)
}
console.log("✅ Deshecho.")
