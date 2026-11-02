/**
 * ↩️ Deshacer del script 178 — vuelve CADA fila que tocó el 178 a como estaba, desde la foto `scripts/178-foto-antes.json`
 * (movimientos de la tarjeta y de Galicia MA, las facturas, y los movimientos a los que la cuenta se propagó).
 * No borra nada: el 178 no crea filas, sólo cambia columnas.
 *
 *     npx tsx scripts/178-tarjeta-ma-respuestas-jms-deshacer.mts              ← dice qué restauraría
 *     npx tsx scripts/178-tarjeta-ma-respuestas-jms-deshacer.mts --escribir   ← restaura (con OK de JMS)
 *
 * ⚠️ Si después del 178 alguien editó a mano una de esas filas, el deshacer la pisa con la foto: por eso primero lista
 * las filas que cambiaron en columnas que el 178 NO toca, y frena si hay alguna.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const foto = JSON.parse(readFileSync("scripts/178-foto-antes.json", "utf8"))
const TOCA = new Set(["estado", "motivo_revision", "nota_operador", "comprobante_arca_id", "contable", "categ", "nro_cuenta", "cuenta_contable",
  "fecha_pago", "nro_resumen", "comprobantes_pagados", "proveedor_nombre", "detalle", "updated_at"])
const tablas: [string, any[]][] = [["ma.tarjeta_visa", foto["ma.tarjeta_visa"]], ["ma.ma_galicia", foto["ma.ma_galicia"]], ["ma.comprobantes_arca", foto["ma.comprobantes_arca"]],
  ...Object.entries(foto.propagacion as Record<string, any[]>)]
const vistos = new Set<string>()
const ajenos: string[] = []
const trabajo: { tabla: string; fila: any }[] = []
for (const [tabla, filas] of tablas) {
  const [s, t] = tabla.split(".")
  const q = () => (s === "public" ? sb.from(t) : sb.schema(s).from(t))
  for (const f of filas) {
    const k = `${tabla}:${f.id}`; if (vistos.has(k)) continue; vistos.add(k)
    const { data: hoy } = await q().select("*").eq("id", f.id).maybeSingle()
    if (!hoy) { ajenos.push(`${k} ya no existe`); continue }
    const otras = Object.keys(f).filter(c => !TOCA.has(c) && JSON.stringify(f[c]) !== JSON.stringify(hoy[c]))
    if (otras.length) ajenos.push(`${k} cambió en ${otras.join(", ")}`)
    trabajo.push({ tabla, fila: f })
  }
}
console.log(`${trabajo.length} filas a restaurar`)
if (ajenos.length) { console.log("🛑 FRENA — cambios que no hizo el 178:\n - " + ajenos.join("\n - ")); process.exit(1) }
if (!process.argv.includes("--escribir")) { console.log("(simulación: no se restauró nada)"); process.exit(0) }
for (const { tabla, fila } of trabajo) {
  const [s, t] = tabla.split(".")
  const upd = Object.fromEntries(Object.entries(fila).filter(([c]) => TOCA.has(c) && c !== "updated_at"))
  const { error } = await (s === "public" ? sb.from(t) : sb.schema(s).from(t)).update(upd).eq("id", fila.id)
  if (error) throw new Error(`${tabla} ${fila.id}: ${error.message}`)
}
console.log(`✅ ${trabajo.length} filas restauradas.`)
