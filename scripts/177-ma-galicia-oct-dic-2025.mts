/**
 * 📥 Script 177 — A-FEAT-1524: MA GALICIA oct–dic 2025, carga HACIA ATRÁS desde los resúmenes PDF (JMS 02/11).
 *
 *     npx tsx scripts/177-ma-galicia-oct-dic-2025.mts              ← SIMULA: lee los PDF y dice qué cargaría. No escribe.
 *     npx tsx scripts/177-ma-galicia-oct-dic-2025.mts --escribir   ← escribe (🛑 sólo con OK de JMS en esta terminal)
 *
 * Por qué script y no el importador: la app agrega sólo HACIA ADELANTE (descarta todo lo anterior a la última
 * fecha cargada), y la cuenta ya arranca el 06/01/26. La cuenta abrió el 12/09/25.
 *
 * Qué carga: los movimientos de los PDF «MA - CA - Pesos» 25-10, 25-11, 25-12 y los de 26-01 ANTERIORES al primer
 * día ya cargado (06/01/26). Usa el MISMO lector, el MISMO adaptador (PDF → texto del Excel) y las MISMAS reglas de
 * parseo que el importador (`app/api/import-excel-ca/route.ts`), y graba las mismas columnas con `origen = CA_GALICIA_PDF`.
 *
 * Orden: NEGATIVO (−N … −1), para quedar antes de lo cargado SIN tocar una sola fila existente.
 *
 * 🛑 FRENA (no escribe nada) si: un PDF no cierra contra sí mismo · la cuenta o el CUIT no son los de MA · el saldo
 * no encadena entre resúmenes · el último saldo cargado no empalma con el primero de la app · ya hay filas de la
 * app anteriores al 06/01/26 (o sea, alguien ya lo cargó).
 *
 * Deshacer: `177-ma-galicia-oct-dic-2025-deshacer.mts` borra SÓLO los ids de `177-hecho.json`, y frena si alguno
 * ya se concilió o se editó.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { leerResumenCajaAhorro, controlarResumen, armarConocido, resumenComoExcel } from "../lib/extractos/pdf-caja-ahorro-galicia"
import { parsearMovimiento, cargarReglasParseo } from "../lib/extractos/parseo-movimiento"
import { textosUbicadosPorPagina } from "../lib/polizas/renglones-pdf"

const ESCRIBIR = process.argv.includes("--escribir")
const VARIAS = join("- Comunicacion JMS Claude - Archivos", "Extractos", "Varias")
const ARCHIVOS = ["MA - CA - Pesos - 25-10.pdf", "MA - CA - Pesos - 25-11.pdf", "MA - CA - Pesos - 25-12.pdf", "MA - CA - Pesos - 26-01.pdf"]
const CUENTA = "4003841-5 360-8", CUIT_MA = "27066824611"
const HECHO = "scripts/177-hecho.json"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ma = sb.schema("ma")
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r2 = (n: number) => Math.round(n * 100) / 100
const frenos: string[] = []

// Lo ya cargado: primer día y saldo de apertura
const { data: primeras } = await ma.from("ma_galicia").select("fecha,debitos,creditos,saldo,orden").order("fecha").order("orden").limit(1)
const primera = primeras?.[0]
if (!primera) throw new Error("ma_galicia vacía: este script carga hacia atrás sobre una cuenta ya cargada")
const PRIMER_DIA = String(primera.fecha).slice(0, 10)
const saldoApertura = r2(Number(primera.saldo) + Number(primera.debitos) - Number(primera.creditos))
if (Number(primera.orden) < 1) frenos.push(`ya hay filas con orden ${primera.orden}: ¿ya se corrió?`)

// Lo conocido (para completar nombres y CBU cortados) y las reglas: igual que el importador
const { data: hist } = await ma.from("ma_galicia").select("concepto").order("orden", { ascending: false }).limit(1000)
const { data: prov } = await sb.from("proveedores").select("cuit, cbu").not("cbu", "is", null)
const conocido = armarConocido((hist ?? []).map((h: any) => h.concepto), prov ?? [])
const reglas = await cargarReglasParseo(sb, "ma_galicia")

const filas: Record<string, any>[] = []
let saldoAnterior: number | null = null
for (const a of ARCHIVOS) {
  const r = leerResumenCajaAhorro(await textosUbicadosPorPagina(new Uint8Array(readFileSync(join(VARIAS, a)))))
  if (r.numeroCuenta !== CUENTA || r.cuitTitular !== CUIT_MA) { frenos.push(`${a}: cuenta ${r.numeroCuenta} / CUIT ${r.cuitTitular}`); continue }
  if (!controlarResumen(r).ok) { frenos.push(`${a}: no cierra contra el propio resumen`); continue }
  if (saldoAnterior !== null && Math.abs(saldoAnterior - (r.saldoInicial ?? NaN)) > 0.01) frenos.push(`${a}: abre ${fmt(r.saldoInicial ?? 0)}, venía ${fmt(saldoAnterior)}`)
  saldoAnterior = r.saldoFinal
  const comoExcel = resumenComoExcel(r, conocido)
  let n = 0, cambios = 0
  for (const f of comoExcel) {
    if (f.fecha >= PRIMER_DIA) continue
    const parsed = parsearMovimiento(f.movimiento, reglas)
    filas.push({
      fecha: f.fecha, descripcion: parsed["descripcion"] || f.movimiento.substring(0, 200),
      debitos: f.debito, creditos: f.credito, saldo: f.saldo, control: 0,
      grupo_de_conceptos: parsed["grupo_de_conceptos"] ?? "", concepto: f.movimiento,
      tipo_de_movimiento: parsed["tipo_de_movimiento"] ?? "",
      leyendas_adicionales_1: parsed["leyendas_adicionales_1"] ?? "", leyendas_adicionales_2: parsed["leyendas_adicionales_2"] ?? "",
      leyendas_adicionales_3: parsed["leyendas_adicionales_3"] ?? "", leyendas_adicionales_4: parsed["leyendas_adicionales_4"] ?? "",
      numero_de_terminal: parsed["numero_de_terminal"] ?? "", numero_de_comprobante: parsed["numero_de_comprobante"] ?? "",
      observaciones_cliente: "", origen: "CA_GALICIA_PDF", cuenta: "ma_galicia",
      categ: parsed["categ"] || null, detalle: null, contable: null, interno: null, centro_de_costo: null, estado: "pendiente",
    })
    n++; cambios += f.cambios.length
  }
  console.log(`${a}: ${n} movimientos a cargar · ${fmt(r.saldoInicial ?? 0)} → ${fmt(r.saldoFinal ?? 0)} ✓${cambios ? ` · ${cambios} datos completados de lo conocido` : ""}`)
}

// Control de empalme: el saldo del último movimiento a cargar = el saldo de apertura de lo ya cargado
const ultimoSaldo = filas[filas.length - 1]?.saldo ?? null
console.log(`\nEmpalme: último a cargar ${fmt(ultimoSaldo ?? 0)} · apertura de la app el ${PRIMER_DIA} ${fmt(saldoApertura)}`)
if (ultimoSaldo === null || Math.abs(ultimoSaldo - saldoApertura) > 0.01) frenos.push("el saldo no empalma con lo ya cargado")
filas.forEach((f, i) => { f.orden = i - filas.length })   // −N … −1

const deb = r2(filas.reduce((a, f) => a + f.debitos, 0)), cred = r2(filas.reduce((a, f) => a + f.creditos, 0))
console.log(`Total: ${filas.length} movimientos · débitos ${fmt(deb)} · créditos ${fmt(cred)} · con categoría por regla: ${filas.filter(f => f.categ).length}`)
if (frenos.length) { console.log("\n🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada — correr con --escribir con OK de JMS)"); process.exit(0) }

const { data: ins, error } = await ma.from("ma_galicia").insert(filas).select("id")
if (error) throw error
writeFileSync(HECHO, JSON.stringify({ corrido: new Date().toISOString(), ids: ins!.map(x => x.id) }, null, 2))
console.log(`\n✅ ${ins!.length} movimientos cargados. Ids en ${HECHO}.`)
