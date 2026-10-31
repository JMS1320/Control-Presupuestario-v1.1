/**
 * 📥 Script 150 — A-FEAT-1424: INTERCALA marzo 2026 en la caja de ahorro de Cotitulares en pesos (JMS 31/10: «te dejé
 * el extracto de marzo en la carpeta… después lo renombrás»).
 *
 *     npx tsx <ruta>/scripts/150-intercalar-cotitulares-pesos-26-03.mts              ← SIMULA: lee el PDF y la base, dice qué haría
 *     npx tsx <ruta>/scripts/150-intercalar-cotitulares-pesos-26-03.mts --escribir   ← escribe (🛑 con OK de JMS)
 *   (se corre con la carpeta principal como directorio actual: de ahí lee `.env.local`)
 *
 * Por qué intercalar: el 136 cargó 25-09 → 26-02 y 26-04 → 26-08 sin marzo (el PDF que había era el de la caja propia
 * de MA, 4003841-5). El importador descarta lo anterior al último cargado, así que marzo entra por acá:
 *   1. corre el `orden` de lo cargado DESPUÉS de febrero (+N, de atrás para adelante para no chocar),
 *   2. inserta los N movimientos de marzo en el hueco, con estado «pendiente».
 *
 * FRENA si: el PDF no es la cuenta 4003850-4 360-1 de MA · no cierra contra sí mismo · no empalma con lo cargado
 * (saldo de febrero = saldo inicial de marzo, y el siguiente movimiento cargado arranca del saldo final de marzo) ·
 * ya hay algo cargado en marzo.
 * Deja los ids insertados y los órdenes corridos en `150-…-ids.json`; el deshacer usa exactamente eso.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { leerResumenCajaAhorro, controlarResumen } from "../lib/extractos/pdf-caja-ahorro-galicia"
import { textosUbicadosPorPagina } from "../lib/polizas/renglones-pdf"

const ESCRIBIR = process.argv.includes("--escribir")
const AQUI = dirname(fileURLToPath(import.meta.url))
const PDF = join(process.cwd(), "- Comunicacion JMS Claude - Archivos", "Extractos", "Varias", "Cotit - CA - Pesos - 26-03.pdf")
const ARCHIVO_IDS = join(AQUI, "150-intercalar-cotitulares-pesos-26-03-ids.json")
const CUENTA = "4003850-4 360-1", CUIT_MA = "27066824611", TABLA = "cotitulares_ca_pesos"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const frenar = (m: string) => { console.log("🛑 NO SE ESCRIBE NADA — " + m); process.exit(1) }

// 1 · El PDF
const r = leerResumenCajaAhorro(await textosUbicadosPorPagina(new Uint8Array(readFileSync(PDF))))
if (r.numeroCuenta !== CUENTA || r.cuitTitular !== CUIT_MA) frenar(`el PDF es de la cuenta ${r.numeroCuenta} (CUIT ${r.cuitTitular}), se esperaba ${CUENTA} de MA`)
if (!controlarResumen(r).ok) frenar("el PDF no cierra contra sí mismo")
const movs = r.movimientos
const desde = movs[0]?.fecha, hasta = movs[movs.length - 1]?.fecha
if (!movs.length || !desde?.startsWith("2026-03") || !hasta?.startsWith("2026-03")) frenar(`se esperaban movimientos de marzo 2026 y van del ${desde} al ${hasta}`)

// 2 · La base: lo de antes, lo de después y que marzo esté vacío
const { data: todas, error } = await sb.from(TABLA).select("id, orden, fecha, debitos, creditos, saldo, estado").order("orden")
if (error) frenar(error.message)
const filas = (todas ?? []).map(f => ({ ...f, orden: Number(f.orden), debitos: Number(f.debitos), creditos: Number(f.creditos), saldo: Number(f.saldo) }))
if (filas.some(f => String(f.fecha).startsWith("2026-03"))) frenar("ya hay movimientos de marzo 2026 cargados")
const antes = filas.filter(f => f.fecha < "2026-03-01"), despues = filas.filter(f => f.fecha > "2026-03-31")
const ultimoAntes = antes[antes.length - 1], primeroDespues = despues[0]
if (!ultimoAntes) frenar("no hay nada cargado antes de marzo")
if (Math.abs(ultimoAntes.saldo - (r.saldoInicial ?? NaN)) > 0.01) frenar(`no empalma: lo cargado termina en ${fmt(ultimoAntes.saldo)} y marzo abre en ${fmt(r.saldoInicial ?? 0)}`)
if (primeroDespues) {
  const abre = primeroDespues.saldo - primeroDespues.creditos + primeroDespues.debitos
  if (Math.abs(abre - (r.saldoFinal ?? NaN)) > 0.01) frenar(`no empalma: marzo cierra en ${fmt(r.saldoFinal ?? 0)} y lo siguiente cargado arranca de ${fmt(abre)}`)
}
if (despues.some(f => f.orden <= ultimoAntes.orden)) frenar("el orden de lo cargado no sigue a las fechas")

const N = movs.length
const nuevas = movs.map((m, i) => ({
  fecha: m.fecha, descripcion: m.lineas.join(" · "), debitos: m.debito, creditos: m.credito, saldo: m.saldo, control: 0,
  orden: ultimoAntes.orden + 1 + i, estado: "pendiente", moneda: "ARS", cuenta: TABLA,
}))
console.log(`PDF ${CUENTA}: ${N} movimientos de marzo · ${fmt(r.saldoInicial ?? 0)} → ${fmt(r.saldoFinal ?? 0)} ✓ (empalma con febrero ${fmt(ultimoAntes.saldo)}${primeroDespues ? ` y con lo siguiente, del ${primeroDespues.fecha}` : ""})`)
for (const n of nuevas) console.log(`   + orden ${n.orden} · ${n.fecha} · deb ${fmt(n.debitos)} · cred ${fmt(n.creditos)} · saldo ${fmt(n.saldo)} · ${n.descripcion.slice(0, 50)}`)
console.log(`   ↷ se corren ${despues.length} movimientos posteriores: orden ${despues[0]?.orden ?? "-"}…${despues[despues.length - 1]?.orden ?? "-"} → +${N}`)
if (!ESCRIBIR) { console.log("\n(simulación: con --escribir hace exactamente esto)"); process.exit(0) }

// 3 · Escribir: primero correr (de atrás para adelante), después insertar
const corridos: { id: string; antes: number; despues: number }[] = []
for (const f of [...despues].reverse()) {
  const { error: e } = await sb.from(TABLA).update({ orden: f.orden + N }).eq("id", f.id)
  if (e) { writeFileSync(ARCHIVO_IDS, JSON.stringify({ insertados: [], corridos }, null, 2)); frenar(`al correr el orden de ${f.id}: ${e.message} (lo ya corrido quedó en el json)`) }
  corridos.push({ id: f.id, antes: f.orden, despues: f.orden + N })
}
const { data: ins, error: eI } = await sb.from(TABLA).insert(nuevas).select("id")
writeFileSync(ARCHIVO_IDS, JSON.stringify({ insertados: (ins ?? []).map(x => x.id), corridos }, null, 2))
if (eI) frenar(`al insertar: ${eI.message} (los órdenes ya se corrieron: el deshacer los vuelve)`)

// 4 · Control por el camino inverso: la cadena de saldos de TODA la tabla tiene que cerrar
const { data: fin } = await sb.from(TABLA).select("orden, debitos, creditos, saldo").order("orden")
let rotos = 0, prev: number | null = null
for (const f of fin ?? []) {
  const s = Number(f.saldo), esperado = prev === null ? s : prev + Number(f.creditos) - Number(f.debitos)
  if (Math.abs(esperado - s) > 0.01) rotos++
  prev = s
}
console.log(`\n✓ ${ins?.length ?? 0} insertados, ${corridos.length} corridos · cadena de saldos: ${rotos ? `⚠️ ${rotos} saltos` : "cierra de punta a punta"} (${fin?.length} movimientos)`)
