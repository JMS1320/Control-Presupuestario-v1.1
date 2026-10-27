/**
 * 📸 **FOTO de la situación de MSA antes (o después) de cambiar imputaciones** — filas enteras de los comprobantes y
 * de TODAS las tablas que guardan un vínculo a una factura, una venta o un grupo (la lista sale de la base:
 * `information_schema.columns` con `comprobante_arca_id` / `comprobante_venta_id` / `grupo_pago_id` /
 * `grupo_cobro_id`, consultada el 27/10). Pedido de JMS 27/10, antes de pasar AFA a cuenta corriente: *«antes que
 * todo debemos tomar foto de la situación actual porque cambiaré imputaciones»*.
 *
 * Sirve para comparar después (`--comparar <foto-antes.json>`: qué filas cambiaron, campo por campo) y para volver
 * atrás a mano si hiciera falta. 🔴 **SÓLO LEE** la base; escribe un .json en `Balance/respaldos/`.
 *
 * ```
 * npx tsx scripts/foto-balance.mts antes-cta-cte-afa
 * npx tsx scripts/foto-balance.mts despues-cta-cte-afa --comparar "<ruta de la foto antes>"
 * ```
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { traerTodo } from "../lib/supabase-paginado"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const TABLAS: [schema: string, tabla: string][] = [
  ["msa", "comprobantes_arca"], ["msa", "comprobantes_venta"], ["msa", "comprobantes_historico"], ["msa", "grupos_cobro"],
  ["public", "msa_galicia"], ["public", "pam_galicia"], ["public", "pam_galicia_cc"],
  ["msa", "caja_ams"], ["msa", "caja_general"], ["msa", "caja_sigot"], ["msa", "echeqs_terceros"],
  ["msa", "retenciones_recibidas"], ["msa", "sicore_retenciones"], ["msa", "tarjeta_visa_business"],
  ["public", "anticipos_proveedores"], ["public", "cuotas_egresos_sin_factura"], ["public", "polizas_endosos"],
  ["public", "sueldos_pagos"],
]

const nombre = process.argv[2] || "foto"
const iComparar = process.argv.indexOf("--comparar")
const comparar = iComparar > 0 ? process.argv[iComparar + 1] : null
// Día y hora en Argentina (§ 🕐), para el nombre del archivo.
const ahora = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" })
  .format(new Date()).replace(" ", "_").replace(":", "")

const foto: { nombre: string; tomada: string; tablas: Record<string, { filas: number; datos: Record<string, unknown>[] }> } =
  { nombre, tomada: new Date().toISOString(), tablas: {} }
let problemas = 0
for (const [schema, tabla] of TABLAS) {
  const clave = `${schema}.${tabla}`
  const r = await traerTodo((d, h) => sb.schema(schema).from(tabla).select("*", { count: "exact" }).order("id").range(d, h))
  if (r.error) { console.log(`   ⚠️ ${clave}: ${r.error.message}`); problemas++; continue }
  if (r.esperadas != null && r.esperadas !== r.data.length) { console.log(`   🛑 ${clave}: llegaron ${r.data.length} de ${r.esperadas}`); problemas++ }
  foto.tablas[clave] = { filas: r.data.length, datos: r.data as Record<string, unknown>[] }
  console.log(`   ${clave.padEnd(34)} ${String(r.data.length).padStart(6)} filas`)
}
const ruta = join("- Comunicacion JMS Claude - Archivos", "Balance", "respaldos", `foto-${nombre}-${ahora}.json`)
writeFileSync(ruta, JSON.stringify(foto))
console.log(`📸 ${ruta} — ${Object.keys(foto.tablas).length} tablas${problemas ? ` · ⚠️ ${problemas} con problema` : " · todas completas"}`)

// 🔎 Contra una foto anterior: qué filas aparecieron, desaparecieron o cambiaron, y en qué campos.
if (comparar) {
  const antes = JSON.parse(readFileSync(comparar, "utf8")) as typeof foto
  for (const [clave, t] of Object.entries(foto.tablas)) {
    const a = new Map((antes.tablas[clave]?.datos ?? []).map(x => [String(x.id), x]))
    const d = new Map(t.datos.map(x => [String(x.id), x]))
    const nuevas = [...d.keys()].filter(k => !a.has(k)), idas = [...a.keys()].filter(k => !d.has(k))
    const cambiadas: string[] = []
    for (const [k, x] of d) {
      const y = a.get(k)
      if (!y) continue
      const campos = Object.keys(x).filter(c => c !== "updated_at" && JSON.stringify(x[c]) !== JSON.stringify(y[c]))
      if (campos.length) cambiadas.push(`${k}: ${campos.map(c => `${c} ${JSON.stringify(y[c])} → ${JSON.stringify(x[c])}`).join(" · ")}`)
    }
    if (!nuevas.length && !idas.length && !cambiadas.length) continue
    console.log(`\n── ${clave}: ${nuevas.length} nueva(s) · ${idas.length} borrada(s) · ${cambiadas.length} cambiada(s)`)
    cambiadas.slice(0, 40).forEach(x => console.log(`   ${x.slice(0, 300)}`))
    if (cambiadas.length > 40) console.log(`   … y ${cambiadas.length - 40} más`)
  }
}
