/**
 * 📥 Script 169 — A-FEAT-1503: la CUENTA CORRIENTE ESPECIAL EN DÓLARES de MSA (Galicia N° 9750271-0 360-3), desde sus
 * resúmenes PDF del ejercicio 25/26 (JMS 01/11: «te dejé los pdf de MSA dólares… dólares nos dará gastos de cta cte y
 * movimientos a conciliar también para balance»).
 *
 *     npx tsx scripts/169-cargar-cc-usd-msa.mts              ← SIMULA: lee los PDF y dice qué cargaría. No escribe.
 *     npx tsx scripts/169-cargar-cc-usd-msa.mts --escribir   ← escribe (🛑 sólo con OK de JMS en esta terminal)
 *
 * Lee con el MISMO lector que el importador de la app (`leerResumenCajaAhorro`), como el script 136.
 *
 * 🛑 FRENA (no escribe nada) si: un PDF no es de esa cuenta o de MSA · no cierra contra sí mismo · un mes no abre con el
 * saldo con que cerró el anterior · el primero no abre con el saldo de inicio ya cargado (script 128) · la tabla tiene
 * otras filas además de la del script 128.
 *
 * Deshacer: `169-cargar-cc-usd-msa-deshacer.mts`, que borra SÓLO los ids de `169-cargar-cc-usd-msa-ids.json`, y frena si
 * alguno ya se concilió o se editó.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { leerResumenCajaAhorro, controlarResumen } from "../lib/extractos/pdf-caja-ahorro-galicia"
import { textosUbicadosPorPagina } from "../lib/polizas/renglones-pdf"

const ESCRIBIR = process.argv.includes("--escribir")
const DIR = join("- Comunicacion JMS Claude - Archivos", "Extractos", "MSA dolares cta cte  e inversiones")
const ARCHIVO_IDS = "scripts/169-cargar-cc-usd-msa-ids.json"
const CUENTA = "9750271-0 360-3"
const CUIT_MSA = "30617786016"
const MARCA_128 = "[script 128] A-FEAT-1386"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r2 = (n: number) => Math.round(n * 100) / 100

const frenos: string[] = []
const filas: Record<string, unknown>[] = []
const notas: string[] = []

// La tabla: sólo puede estar la fila del saldo de inicio (script 128).
const { data: hay, error } = await sb.schema("msa").from("cc_usd").select("id, detalle, creditos, fecha")
if (error) frenos.push(`msa.cc_usd: no se pudo leer (${error.message})`)
const inicio = (hay ?? []).find(f => f.detalle === MARCA_128)
const otras = (hay ?? []).filter(f => f.detalle !== MARCA_128)
if (otras.length) frenos.push(`msa.cc_usd ya tiene ${otras.length} fila(s) además del saldo de inicio: este script carga sólo sobre la tabla limpia`)
if (!inicio) frenos.push("msa.cc_usd no tiene el saldo de inicio del script 128")

let saldoAnterior: number | null = inicio ? Number(inicio.creditos) : null
let orden = 1
let totDeb = 0, totCred = 0
const archivos = readdirSync(DIR).filter(f => f.startsWith("CA_dolar_") && f.endsWith(".pdf")).sort()
for (const f of archivos) {
  const r = leerResumenCajaAhorro(await textosUbicadosPorPagina(new Uint8Array(readFileSync(join(DIR, f)))))
  if (r.numeroCuenta !== CUENTA || r.cuitTitular !== CUIT_MSA) {
    frenos.push(`${f}: es de la cuenta ${r.numeroCuenta} (CUIT ${r.cuitTitular}), se esperaba ${CUENTA} de MSA`); continue
  }
  if (saldoAnterior !== null && r.saldoInicial !== null && Math.abs(saldoAnterior - r.saldoInicial) > 0.01) {
    frenos.push(`${f}: abre con ${fmt(r.saldoInicial)} y el mes anterior cerró con ${fmt(saldoAnterior)}`)
  }
  saldoAnterior = r.saldoFinal
  const c = controlarResumen(r)
  if (r.movimientos.length && !c.ok) { frenos.push(`${f}: no cierra contra el propio resumen`); continue }
  let d = 0, cr = 0
  for (const m of r.movimientos) {
    d += m.debito; cr += m.credito
    filas.push({ fecha: m.fecha, descripcion: m.lineas.join(" · "), debitos: m.debito, creditos: m.credito, saldo: m.saldo, control: 0,
      orden: orden++, estado: "pendiente", moneda: "USD", cuenta: "cc_usd", origen: m.origen ?? null, nro_resumen: f.replace(/\.pdf$/, "") })
  }
  totDeb += d; totCred += cr
  notas.push(`${f}: ${r.movimientos.length} movs · débitos ${fmt(r2(d))} · créditos ${fmt(r2(cr))} · ${fmt(r.saldoInicial ?? 0)} → ${fmt(r.saldoFinal ?? 0)} ✓`)
}

console.log(`══ msa.cc_usd: ${filas.length} movimiento(s) · débitos US$ ${fmt(r2(totDeb))} · créditos US$ ${fmt(r2(totCred))}`)
console.log(`   saldo de inicio (script 128): US$ ${inicio ? fmt(Number(inicio.creditos)) : "—"} · saldo al cierre según el último resumen: US$ ${saldoAnterior != null ? fmt(saldoAnterior) : "—"}`)
for (const n of notas) console.log("   " + n)
if (frenos.length) {
  console.log(`\n🛑 NO SE ESCRIBE NADA — ${frenos.length} problema(s):`)
  for (const f of frenos) console.log("   " + f)
  process.exit(1)
}
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada; con --escribir carga)"); process.exit(0) }

const ids: string[] = []
for (let i = 0; i < filas.length; i += 200) {
  const { data, error: e } = await sb.schema("msa").from("cc_usd").insert(filas.slice(i, i + 200)).select("id")
  if (e) {
    writeFileSync(ARCHIVO_IDS, JSON.stringify(ids, null, 2))
    console.error(`❌ ${e.message}. Lo cargado hasta acá quedó en ${ARCHIVO_IDS} (el deshacer lo borra).`)
    process.exit(1)
  }
  ids.push(...(data ?? []).map((x: { id: string }) => x.id))
  writeFileSync(ARCHIVO_IDS, JSON.stringify(ids, null, 2))
}
// Control: lo que quedó en la base es lo planeado (el mismo número por dos caminos).
const base: { debitos: number; creditos: number }[] = []
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await sb.schema("msa").from("cc_usd").select("debitos, creditos").in("id", ids.slice(i, i + 200))
  base.push(...(data ?? []))
}
const s = (k: "debitos" | "creditos") => r2(base.reduce((a, x) => a + Number(x[k] ?? 0), 0))
const ok = base.length === filas.length && s("debitos") === r2(totDeb) && s("creditos") === r2(totCred)
console.log(`${ok ? "✅" : "❌"} ${base.length}/${filas.length} filas · débitos ${fmt(s("debitos"))} · créditos ${fmt(s("creditos"))}`)
