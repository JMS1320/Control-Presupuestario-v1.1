/**
 * 🏦 Script 139 — A-FEAT-1424: CARGA de los resúmenes PDF de la cuenta corriente SANTANDER de MSA → msa.santander.
 * JMS 30/10: «dale, armá el lector de santander» (los 15 PDF jul-25 → sep-26 en `Extractos/Varias/`).
 *
 *     npx tsx scripts/139-cargar-santander-msa.mts              ← SIMULA
 *     npx tsx scripts/139-cargar-santander-msa.mts --escribir   ← escribe (🛑 sólo con OK de JMS en esta terminal)
 *
 * Lee con `leerResumenSantander` (lib/extractos/pdf-santander.ts). 🛑 FRENA si: un mes no cierra contra su propio
 * resumen · no es la cuenta 297-000736/0 de MSA · un mes no empalma con el anterior · julio no abre en el saldo de
 * la planilla al 30/06/2025 ($ 7.204,86) · la tabla ya tiene filas.
 * Las filas son las de una cuenta cargada a mano (como Cotitulares): fecha, descripción (con el comprobante),
 * débito, crédito, saldo, orden, estado «pendiente» (en minúscula: es lo que busca el motor; ver script 143), moneda ARS. El motor de conciliación no cambia.
 *
 * Deshacer: `139-cargar-santander-msa-deshacer.mts` — borra SÓLO los ids de `139-cargar-santander-msa-ids.json`.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { leerResumenSantander, controlarResumenSantander } from "../lib/extractos/pdf-santander"
import { textosUbicadosPorPagina } from "../lib/polizas/renglones-pdf"

const ESCRIBIR = process.argv.includes("--escribir")
const VARIAS = join("../Control-Presupuestario-v1.1", "- Comunicacion JMS Claude - Archivos", "Extractos", "Varias")
const IDS = "scripts/139-cargar-santander-msa-ids.json"
const CUENTA = "297-000736/0", CUIT_MSA = "30617786016", SALDO_30_06_2025 = 7204.86

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const tabla = () => sb.schema("msa").from("santander")
const fmt = (n: number | null) => n === null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r2 = (n: number) => Math.round(n * 100) / 100
const suma = (xs: any[], k: string) => r2(xs.reduce((a, f) => a + Number(f[k] ?? 0), 0))

const frenos: string[] = []
const { data: hay, error } = await tabla().select("id").limit(1)
if (error) frenos.push(`msa.santander: no se pudo leer (${error.message})`)
else if (hay?.length) frenos.push("msa.santander ya tiene filas: este script carga sólo sobre la tabla vacía")

const filas: Record<string, any>[] = []
let orden = 1
let saldoAnterior: number | null = SALDO_30_06_2025
for (const f of readdirSync(VARIAS).filter(x => x.startsWith("MSA - Santander - CC - Pesos") && x.endsWith(".pdf")).sort()) {
  const r = leerResumenSantander(await textosUbicadosPorPagina(new Uint8Array(readFileSync(join(VARIAS, f)))))
  const c = controlarResumenSantander(r)
  if (r.numeroCuenta !== CUENTA || r.cuitTitular !== CUIT_MSA) { frenos.push(`${f}: cuenta ${r.numeroCuenta} CUIT ${r.cuitTitular}, se esperaba ${CUENTA} de MSA`); continue }
  if (!c.ok) { frenos.push(`${f}: no cierra contra el propio resumen`); continue }
  if (saldoAnterior !== null && r.saldoInicial !== null && Math.abs(saldoAnterior - r.saldoInicial) > 0.01) {
    frenos.push(`${f}: abre en ${fmt(r.saldoInicial)} y el mes anterior cerró en ${fmt(saldoAnterior)}`)
  }
  saldoAnterior = r.saldoFinal
  for (const m of r.movimientos) {
    filas.push({
      fecha: m.fecha, descripcion: m.lineas.join(" · ") + (m.comprobante ? ` · Comp. ${m.comprobante}` : ""),
      debitos: m.debito, creditos: m.credito, saldo: m.saldo, control: 0, orden: orden++,
      estado: "pendiente", moneda: "ARS", cuenta: "santander",
    })
  }
  console.log(`✓ ${f}: ${r.movimientos.length} movs · ${fmt(r.saldoInicial)} → ${fmt(r.saldoFinal)}`)
}
console.log(`\nmsa.santander: ${filas.length} filas · débitos ${fmt(suma(filas, "debitos"))} · créditos ${fmt(suma(filas, "creditos"))} · ` +
  `${fmt(SALDO_30_06_2025)} + créditos − débitos = ${fmt(r2(SALDO_30_06_2025 + suma(filas, "creditos") - suma(filas, "debitos")))} (último saldo del PDF: ${fmt(saldoAnterior)})`)
if (frenos.length) { console.log(`\n🛑 NO SE ESCRIBE NADA:`); for (const f of frenos) console.log("   " + f); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: con --escribir carga)"); process.exit(0) }

const ids: string[] = []
for (let i = 0; i < filas.length; i += 200) {
  const { data, error: e } = await tabla().insert(filas.slice(i, i + 200)).select("id")
  if (e) { writeFileSync(IDS, JSON.stringify(ids, null, 2)); console.error(`❌ ${e.message} — lo cargado hasta acá está en ${IDS}`); process.exit(1) }
  ids.push(...(data ?? []).map((d: any) => d.id))
  writeFileSync(IDS, JSON.stringify(ids, null, 2))
}
// Control: lo que quedó en la base es lo planeado
let base: any[] = []
for (let i = 0; i < ids.length; i += 200) { const { data } = await tabla().select("debitos, creditos").in("id", ids.slice(i, i + 200)); base.push(...(data ?? [])) }
const ok = base.length === filas.length && suma(base, "debitos") === suma(filas, "debitos") && suma(base, "creditos") === suma(filas, "creditos")
console.log(ok ? `✅ Cargado y controlado: ${base.length} filas.` : "❌ Lo cargado no coincide con lo planeado: revisar.")
