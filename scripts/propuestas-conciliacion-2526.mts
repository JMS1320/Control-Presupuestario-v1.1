/**
 * 🔎 PROPUESTAS DE CONCILIACIÓN 25/26 — MSA, PAM y MA (Camino 1, 2026-10-30). **SOLO LEE LA BASE.**
 *
 * ⚠️ cambió 30/10 (A-FEAT-1430 paso 4): la lógica se mudó a `lib/conciliacion/propuestas-ejercicio.ts`, que es la que
 * usa el recorrido del balance en la app. Este script es sólo un envoltorio: misma lectura, mismo cálculo, salida JSON
 * y un resumen por consola. Una sola implementación: si el script y la pantalla dijeran distinto, uno mentiría.
 *
 * Uso (desde la carpeta que tiene `.env.local`):
 *   npx tsx <ruta>/scripts/propuestas-conciliacion-2526.mts [salida.json] [EMPRESA ...]
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "node:fs"
import { leerDatosConciliacion, proponerConciliaciones, TIPOS_PROPUESTA } from "../lib/conciliacion/propuestas-ejercicio"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const SALIDA = process.argv[2] ?? "propuestas-conciliacion-2526.json"
const EMPRESAS = process.argv.slice(3).length ? process.argv.slice(3) : ["MSA", "PAM", "MA"]
const DESDE = "2025-07-01", HASTA = "2026-06-30"
const plata = (x: number) => x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

async function main() {
  const salida: Record<string, unknown> = { generado: new Date().toISOString() }
  for (const emp of EMPRESAS) {
    const datos = await leerDatosConciliacion(sb, emp, DESDE, HASTA, t => process.stderr.write(`${emp}: ${t}\n`))
    const r = proponerConciliaciones(datos, emp, DESDE, HASTA)
    salida[emp] = r
    console.log(`\n${emp} — MOVIMIENTOS SIN CONCILIAR ${DESDE} → ${HASTA}`)
    const porTipo = new Map<string, { n: number; m: number }>()
    for (const p of r.movimientos) { const k = `${p.mov.cuenta.nombre} · ${TIPOS_PROPUESTA[p.tipo]}`; const v = porTipo.get(k) ?? { n: 0, m: 0 }; v.n++; v.m += p.mov.importe; porTipo.set(k, v) }
    for (const [k, v] of [...porTipo].sort()) console.log(`  ${k.padEnd(58)} ${String(v.n).padStart(4)}  ${plata(v.m).padStart(18)}`)
    console.log(`  deudas del ejercicio sin pago: ${r.deudas.length} (con movimiento candidato: ${r.deudas.filter(d => d.candidatos.length).length})`)
    if (datos.avisos.length) console.log(`  ⚠️ no se pudo leer: ${datos.avisos.join(" · ")}`)
  }
  writeFileSync(SALIDA, JSON.stringify(salida, null, 1))
  console.log(`\n→ ${SALIDA}`)
}
main().catch(e => { console.error(e); process.exit(1) })
