/**
 * 🧾 Script 146 — A-FEAT-1439: CARGA de lo PRESENTADO a ARCA (libro IVA) de MSA 25/26 → public.ddjj_presentadas.
 * JMS 31/10: «ok arrancá, los zips están en Sesion Claude Estanco» (los 12 `libro_iva_periodo_AAAAMM_original.zip`,
 * 202507 → 202606, los mismos que se usaron para el Libro Diario y las Diferencias vs ARCA).
 *
 *     npx tsx scripts/146-cargar-ddjj-iva-msa-25-26.mts              ← SIMULA (sólo lee los zips y la base)
 *     npx tsx scripts/146-cargar-ddjj-iva-msa-25-26.mts --escribir   ← escribe (🛑 sólo con OK de JMS en esta terminal)
 *
 * Guarda cada mes con `armarYGuardarDdjj` — EL MISMO camino que «📥 Lo que devolvió el contador» en Subdiarios, así la
 * fila queda igual que si se hubiera subido a mano (compras, ventas, totales y la comparación contra el subdiario).
 * ⚠️ Pero SIN los efectos de la pantalla: no pasa compras a «DDJJ OK» ni deja avisos en la campanita. Es una carga
 * de lo que ya pasó, no una presentación nueva.
 * 🛑 FRENA si: falta el script 145 (no se guardarían las ventas) · un zip no es del ejercicio 25/26 · falta un mes ·
 * ya hay alguna DDJJ de IVA de MSA guardada para esos meses (así el deshacer sólo borra lo de este script).
 *
 * Deshacer: `146-cargar-ddjj-iva-msa-25-26-deshacer.sql` — borra SÓLO las filas con cargado_por = '[script 146]'.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { leerZipLibroIva } from "../lib/subdiarios/libro-presentado"
import { armarYGuardarDdjj } from "../lib/subdiarios/contador"

const ESCRIBIR = process.argv.includes("--escribir")
const CARPETA = "D:/Users/josem/Documents/Jose/- Desarrollo de Software/Sesion Claude Estanco"
const MARCA = "[script 146]"
const PERIODOS = ["202507", "202508", "202509", "202510", "202511", "202512", "202601", "202602", "202603", "202604", "202605", "202606"]

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const frenos: string[] = []
const col = await sb.from("ddjj_presentadas").select("ventas").limit(1)
if (col.error) frenos.push(`falta el script 145 (columna ventas): ${col.error.message}`)
const ya = await sb.from("ddjj_presentadas").select("periodo, secuencia, cargado_por").eq("empresa", "MSA").eq("impuesto", "IVA").in("periodo", PERIODOS)
if (ya.error) frenos.push(`no se pudo leer ddjj_presentadas: ${ya.error.message}`)
else if (ya.data?.length) frenos.push(`ya hay ${ya.data.length} DDJJ de IVA de MSA guardadas en esos meses (${ya.data.map(d => `${d.periodo}/${d.secuencia}`).join(", ")}): no se carga encima`)

const archivos = readdirSync(CARPETA).filter(f => /^libro_iva_periodo_\d{6}_original\.zip$/.test(f)).sort()
const leidos: { archivo: string; datos: Uint8Array; periodo: string }[] = []
console.log(`\n🧾 Lo presentado a ARCA — MSA 25/26 (${archivos.length} zips en Sesion Claude Estanco)\n`)
console.log("Mes      Sec  Código presentación         Compras  Ventas   Neto ventas        IVA ventas")
for (const archivo of archivos) {
  const datos = new Uint8Array(readFileSync(join(CARPETA, archivo)))
  const z = await leerZipLibroIva(datos)
  const p = z.totales?.periodo ?? ""
  if (!PERIODOS.includes(p)) { frenos.push(`${archivo}: período ${p || "(sin XML)"} fuera de 25/26`); continue }
  if (!archivo.includes(p)) frenos.push(`${archivo}: el nombre no coincide con el período del XML (${p})`)
  leidos.push({ archivo, datos, periodo: p })
  const neto = z.ventas.reduce((s, v) => s + (v.netoGravado ?? 0), 0), iva = z.ventas.reduce((s, v) => s + (v.iva ?? 0), 0)
  console.log(`${p.slice(4)}/${p.slice(0, 4)}  ${String(z.totales?.secuencia ?? "?").padStart(3)}  ${String(z.totales?.codigo ?? "—").padEnd(26)} ${String(z.compras.length).padStart(7)} ${String(z.ventas.length).padStart(7)}   ${fmt(neto).padStart(16)}  ${fmt(iva).padStart(16)}`)
}
const faltan = PERIODOS.filter(p => !leidos.some(l => l.periodo === p))
if (faltan.length) frenos.push(`faltan meses: ${faltan.join(", ")}`)

if (frenos.length) { console.log("\n🛑 NO se escribe:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("\n✅ Simulación OK: con --escribir se guardan estos 12 meses en public.ddjj_presentadas (marca [script 146])."); process.exit(0) }

for (const l of leidos) {
  const r = await armarYGuardarDdjj(sb, { empresa: "MSA", schema: "msa", datos: l.datos, archivo: l.archivo, origen: "subida", cargadoPor: MARCA })
  console.log(`✍️  ${l.periodo}: guardado · compras ${r.comparacion.ok ? "coinciden con el subdiario" : "NO coinciden con el subdiario (se ve en Subdiarios)"} · ${r.ventas} ventas`)
}
// 🧮 Control: lo guardado, leído de vuelta.
const v = await sb.from("ddjj_presentadas").select("periodo, ventas, comprobantes").eq("cargado_por", MARCA).eq("empresa", "MSA")
if (v.error) { console.log("⚠️ No se pudo leer de vuelta: " + v.error.message); process.exit(1) }
const ok = v.data!.length === 12 && v.data!.every(d => Array.isArray(d.ventas))
console.log(`\n${ok ? "✓" : "⚠️"} Control: ${v.data!.length} meses guardados, ${v.data!.reduce((s, d) => s + (d.ventas as unknown[]).length, 0)} ventas y ${v.data!.reduce((s, d) => s + (d.comprobantes as unknown[]).length, 0)} compras declaradas.`)
