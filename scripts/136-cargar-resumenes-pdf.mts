/**
 * 📥 Script 136 — A-FEAT-1424: CARGA de la tanda de resúmenes PDF (JMS 29-30/10).
 *
 *     npx tsx scripts/136-cargar-resumenes-pdf.mts              ← SIMULA: lee los PDF y dice qué cargaría. No escribe.
 *     npx tsx scripts/136-cargar-resumenes-pdf.mts --escribir   ← escribe (🛑 sólo con OK de JMS en esta terminal)
 *
 * Qué carga (los PDF están en la carpeta de comunicación de la carpeta principal, `Extractos/`):
 *   · VISA MA        → ma.tarjeta_visa              13 resúmenes 25-09 → 26-09 (tabla vacía)
 *   · VISA PAM       → pam.tarjeta_visa             desde 01/01/2025; el que ya está (25-01) se saltea, 24-12 queda fuera
 *   · Cotitulares $  → public.cotitulares_ca_pesos  25-09 → 26-08 MENOS 26-03 (ese PDF es el de MA; JMS manda el bueno)
 *   · Cotitulares US$→ public.cotitulares_ca_usd    25-09 → 26-08
 *   · MA ANSES $     → ma.anses_ca_pesos            25-11 → 26-03 (tabla del script 135)
 *
 * Lee con los MISMOS lectores que la app, y las filas de tarjeta salen de `filasDeResumen` — la misma
 * función que usa el importador. Así lo cargado por script es lo que habría cargado la app.
 *
 * 🛑 FRENA (no escribe nada) si: un PDF con movimientos no cierra contra sí mismo · una caja no es de la
 * cuenta esperada · una tabla de caja ya tiene filas · un resumen de tarjeta a cargar ya está.
 *
 * Deshacer: `136-cargar-resumenes-pdf-deshacer.mts`, que borra SÓLO los ids que este script dejó en
 * `136-cargar-resumenes-pdf-ids.json`, y frena si alguno ya se concilió o se editó.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parsearResumen, calcularControl, normalizarTextoResumen, filasDeResumen } from "../lib/tarjetas/parseo-resumen-pdf"
import { leerResumenCajaAhorro, controlarResumen } from "../lib/extractos/pdf-caja-ahorro-galicia"
import { textosUbicadosPorPagina } from "../lib/polizas/renglones-pdf"

const ESCRIBIR = process.argv.includes("--escribir")
const PRINCIPAL = "../Control-Presupuestario-v1.1"
const EXTRACTOS = join(PRINCIPAL, "- Comunicacion JMS Claude - Archivos", "Extractos")
const VARIAS = join(EXTRACTOS, "Varias")
const VISA_PAM = join(EXTRACTOS, "Galicia Eminent PAM", "TJ VISA PAM")
const ARCHIVO_IDS = "scripts/136-cargar-resumenes-pdf-ids.json"
const DESDE = "2025-01-01"
const CUIT_MA = "27066824611"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const db = (schema: string) => (schema === "public" ? sb : sb.schema(schema))

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r2 = (n: number) => Math.round(n * 100) / 100
const pdfs = (dir: string, prefijo: string) => readdirSync(dir).filter(f => f.startsWith(prefijo) && f.toLowerCase().endsWith(".pdf")).sort()

interface Plan { schema: string; tabla: string; filas: Record<string, any>[]; nota: string[] }
const planes: Plan[] = []
const frenos: string[] = []

// ── Tarjetas ────────────────────────────────────────────────────────────────────────────────────
async function tarjeta(schema: string, tabla: string, dir: string, prefijo: string) {
  const plan: Plan = { schema, tabla, filas: [], nota: [] }
  const { data: maxOrden } = await db(schema).from(tabla).select("orden").order("orden", { ascending: false }).limit(1).maybeSingle()
  let orden = Number(maxOrden?.orden ?? 0) + 1
  for (const f of pdfs(dir, prefijo)) {
    const { extractText, getDocumentProxy } = await import("unpdf")
    const ex = await extractText(await getDocumentProxy(new Uint8Array(readFileSync(join(dir, f)))), { mergePages: true })
    const r = parsearResumen(normalizarTextoResumen(Array.isArray(ex.text) ? ex.text.join("\n") : (ex.text || "")))
    const c = calcularControl(r)
    if (!r.nro_resumen || !r.fecha_cierre) { frenos.push(`${f}: no se leyó el número o el cierre del resumen`); continue }
    if (r.fecha_cierre < DESDE) { plan.nota.push(`${f}: cierre ${r.fecha_cierre}, anterior al ${DESDE} → fuera`); continue }
    const { data: ya } = await db(schema).from(tabla).select("id").eq("nro_resumen", r.nro_resumen).limit(1)
    if (ya?.length) { plan.nota.push(`${f}: el resumen ${r.nro_resumen} ya está cargado → se saltea`); continue }
    if (!c.ok) { frenos.push(`${f}: no cierra contra el propio resumen (dif $ ${c.diferencia_pesos}, US$ ${c.diferencia_usd})`); continue }
    const filas = filasDeResumen(r, tabla, orden)
    orden += filas.length
    plan.filas.push(...filas)
    plan.nota.push(`${f}: ${r.movimientos.length} movs · cierre ${r.fecha_cierre} · total $ ${fmt(r.total_a_pagar_pesos)} / US$ ${fmt(r.total_a_pagar_usd)} ✓`)
  }
  planes.push(plan)
}

// ── Cajas de ahorro ─────────────────────────────────────────────────────────────────────────────
async function caja(schema: string, tabla: string, prefijo: string, cuentaEsperada: string, moneda: "ARS" | "USD", excluir: string[] = []) {
  const plan: Plan = { schema, tabla, filas: [], nota: [] }
  // (no con `head: true`: sobre una tabla que no existe devuelve count null y SIN error — se comprobó con ANSES)
  const { data: hay, error } = await db(schema).from(tabla).select("id").limit(1)
  if (error) { frenos.push(`${schema}.${tabla}: no se pudo leer (${error.message}) — ¿falta correr el script 135?`); planes.push(plan); return }
  if ((hay ?? []).length > 0) { frenos.push(`${schema}.${tabla} ya tiene filas: este script carga sólo sobre una tabla vacía`); planes.push(plan); return }
  let orden = 1
  let saldoAnterior: number | null = null
  for (const f of pdfs(VARIAS, prefijo)) {
    if (excluir.some(x => f.includes(x))) { plan.nota.push(`${f}: EXCLUIDO a propósito`); continue }
    const r = leerResumenCajaAhorro(await textosUbicadosPorPagina(new Uint8Array(readFileSync(join(VARIAS, f)))))
    if (r.numeroCuenta !== cuentaEsperada || r.cuitTitular !== CUIT_MA) {
      frenos.push(`${f}: es de la cuenta ${r.numeroCuenta} (CUIT ${r.cuitTitular}), se esperaba ${cuentaEsperada} de MA`); continue
    }
    const salto = saldoAnterior !== null && r.saldoInicial !== null && Math.abs(saldoAnterior - r.saldoInicial) > 0.01
      ? ` · ⚠️ SALTO: venía ${fmt(saldoAnterior)}, abre ${fmt(r.saldoInicial)}` : ""
    saldoAnterior = r.saldoFinal
    if (r.movimientos.length === 0) { plan.nota.push(`${f}: sin movimientos (saldo ${fmt(r.saldoFinal ?? 0)})${salto}`); continue }
    const c = controlarResumen(r)
    if (!c.ok) { frenos.push(`${f}: no cierra contra el propio resumen`); continue }
    for (const m of r.movimientos) {
      plan.filas.push({
        fecha: m.fecha, descripcion: m.lineas.join(" · "), debitos: m.debito, creditos: m.credito,
        saldo: m.saldo, control: 0, orden: orden++, estado: "Pendiente", moneda, cuenta: tabla,
      })
    }
    plan.nota.push(`${f}: ${r.movimientos.length} movs · ${fmt(r.saldoInicial ?? 0)} → ${fmt(r.saldoFinal ?? 0)} ✓${salto}`)
  }
  planes.push(plan)
}

await tarjeta("ma", "tarjeta_visa", VARIAS, "MA - VISA")
await tarjeta("pam", "tarjeta_visa", VISA_PAM, "VISA PAM")
await caja("public", "cotitulares_ca_pesos", "Cotit - CA - Pesos", "4003850-4 360-1", "ARS", ["26-03"])
await caja("public", "cotitulares_ca_usd", "Cotit - CA - Dolar", "4003655-2 360-2", "USD")
await caja("ma", "anses_ca_pesos", "MA ANSES", "4046077-1 018-6", "ARS")

// ── Lo que se cargaría ──────────────────────────────────────────────────────────────────────────
for (const p of planes) {
  const movs = p.filas.filter(f => f.tipo_fila !== "resumen")
  console.log(`\n══ ${p.schema}.${p.tabla}: ${p.filas.length} fila(s) · débitos ${fmt(r2(movs.reduce((a, f) => a + Number(f.debitos), 0)))} · créditos ${fmt(r2(movs.reduce((a, f) => a + Number(f.creditos), 0)))}`)
  for (const n of p.nota) console.log("   " + n)
}
if (frenos.length) {
  console.log(`\n🛑 NO SE ESCRIBE NADA — ${frenos.length} problema(s):`)
  for (const f of frenos) console.log("   " + f)
  process.exit(1)
}
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada; con --escribir carga)"); process.exit(0) }

// ── Escribir ────────────────────────────────────────────────────────────────────────────────────
const ids: Record<string, string[]> = {}
for (const p of planes) {
  const clave = `${p.schema}.${p.tabla}`
  ids[clave] = []
  for (let i = 0; i < p.filas.length; i += 200) {
    const { data, error } = await db(p.schema).from(p.tabla).insert(p.filas.slice(i, i + 200)).select("id")
    if (error) {
      writeFileSync(ARCHIVO_IDS, JSON.stringify(ids, null, 2))
      console.error(`❌ Error en ${clave}: ${error.message}. Lo cargado hasta acá quedó en ${ARCHIVO_IDS} (el deshacer lo borra).`)
      process.exit(1)
    }
    ids[clave].push(...(data ?? []).map((d: any) => d.id))
    writeFileSync(ARCHIVO_IDS, JSON.stringify(ids, null, 2))
  }
}

// ── Control: lo que quedó en la base es exactamente lo planeado (el mismo número por dos caminos) ──
let todoOk = true
for (const p of planes) {
  const clave = `${p.schema}.${p.tabla}`
  if (!ids[clave].length) continue
  let filasBase: any[] = []
  for (let i = 0; i < ids[clave].length; i += 200) {
    const { data } = await db(p.schema).from(p.tabla).select("debitos, creditos").in("id", ids[clave].slice(i, i + 200))
    filasBase.push(...(data ?? []))
  }
  const suma = (xs: any[], k: string) => r2(xs.reduce((a, f) => a + Number(f[k] ?? 0), 0))
  const ok = filasBase.length === p.filas.length && suma(filasBase, "debitos") === suma(p.filas, "debitos") && suma(filasBase, "creditos") === suma(p.filas, "creditos")
  todoOk &&= ok
  console.log(`${ok ? "✓" : "✗"} ${clave}: ${filasBase.length}/${p.filas.length} filas · débitos ${fmt(suma(filasBase, "debitos"))} · créditos ${fmt(suma(filasBase, "creditos"))}`)
}
console.log(todoOk ? "\n✅ Cargado y controlado." : "\n❌ El control no cierra: revisar antes de seguir.")
