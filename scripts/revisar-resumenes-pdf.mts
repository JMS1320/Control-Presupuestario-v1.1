/**
 * 📥 A-FEAT-1424 — Revisa la tanda de resúmenes PDF ANTES de cargar nada. SÓLO LEE los PDF: no toca la base.
 *
 *     npx tsx scripts/revisar-resumenes-pdf.mts [carpeta-principal]
 *
 * Usa los MISMOS lectores que la app (así lo que se carga después es lo que habría cargado el importador):
 *   · tarjetas → `parsearResumen` / `calcularControl` (lib/tarjetas/parseo-resumen-pdf)
 *   · cajas de ahorro → `leerResumenCajaAhorro` / `controlarResumen` (lib/extractos/pdf-caja-ahorro-galicia)
 *
 * Por cada PDF dice: período, cantidad de movimientos, saldos y si cierra contra lo que imprime el propio
 * resumen. Y entre meses seguidos, si el saldo final de uno es el inicial del siguiente (el salto se ve).
 */
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { parsearResumen, calcularControl, normalizarTextoResumen } from "../lib/tarjetas/parseo-resumen-pdf"
import { leerResumenCajaAhorro, controlarResumen } from "../lib/extractos/pdf-caja-ahorro-galicia"
import { textosUbicadosPorPagina } from "../lib/polizas/renglones-pdf"
import { leerResumenSantander, controlarResumenSantander } from "../lib/extractos/pdf-santander"

const principal = process.argv[2] ?? "../Control-Presupuestario-v1.1"
const BASE = join(principal, "- Comunicacion JMS Claude - Archivos", "Extractos")
const VARIAS = join(BASE, "Varias")
const VISA_PAM = join(BASE, "Galicia Eminent PAM", "TJ VISA PAM")

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const pdfs = (dir: string, prefijo: string) =>
  readdirSync(dir).filter(f => f.startsWith(prefijo) && f.toLowerCase().endsWith(".pdf")).sort()

async function tarjetas(titulo: string, dir: string, prefijo: string) {
  console.log(`\n══ ${titulo} ══`)
  for (const f of pdfs(dir, prefijo)) {
    const data = new Uint8Array(readFileSync(join(dir, f)))
    const { extractText, getDocumentProxy } = await import("unpdf")
    const ex = await extractText(await getDocumentProxy(data), { mergePages: true })
    const texto = Array.isArray(ex.text) ? ex.text.join("\n") : (ex.text || "")
    const r = parsearResumen(normalizarTextoResumen(texto))
    const c = calcularControl(r)
    console.log(
      `${c.ok ? "✓" : "✗"} ${f.padEnd(26)} nro ${String(r.nro_resumen).padEnd(22)} cierre ${r.fecha_cierre} vto ${r.fecha_vencimiento}` +
      ` · ${String(r.movimientos.length).padStart(3)} movs · ant $ ${fmt(r.saldo_anterior_pesos)} → $ ${fmt(r.total_a_pagar_pesos)}` +
      ` · US$ ${fmt(r.saldo_anterior_usd)} → ${fmt(r.total_a_pagar_usd)}` +
      (c.ok ? "" : ` · DIF $ ${fmt(c.diferencia_pesos)} US$ ${fmt(c.diferencia_usd)}`),
    )
  }
}

async function cajas(titulo: string, prefijo: string) {
  console.log(`\n══ ${titulo} ══`)
  let finAnterior: number | null = null
  for (const f of pdfs(VARIAS, prefijo)) {
    const r = leerResumenCajaAhorro(await textosUbicadosPorPagina(new Uint8Array(readFileSync(join(VARIAS, f)))))
    const c = controlarResumen(r)
    const enlaza = finAnterior === null || r.saldoInicial === null ? "" : Math.abs(finAnterior - r.saldoInicial) <= 0.01 ? " · enlaza ✓" : ` · ⚠️ NO enlaza (venía $ ${fmt(finAnterior)})`
    console.log(
      `${c.ok ? "✓" : "✗"} ${f.padEnd(40)} cta ${r.numeroCuenta} cuit ${r.cuitTitular} ${r.desde}→${r.hasta}` +
      ` · ${String(r.movimientos.length).padStart(3)} movs · $ ${fmt(r.saldoInicial)} → $ ${fmt(r.saldoFinal)}${enlaza}`,
    )
    if (!c.ok) {
      for (const x of c.renglones.filter(x => !x.ok)) console.log(`     ✗ ${x.que}: resumen ${fmt(x.segunResumen)} · leído ${fmt(x.leido)}`)
      if (c.cadenaRota.length) console.log(`     ✗ cadena de saldos rota en ${c.cadenaRota.length} movimiento(s), el 1º el ${c.cadenaRota[0].fecha}`)
    }
    if (r.avisos.length) console.log(`     avisos: ${r.avisos.slice(0, 3).join(" | ")}${r.avisos.length > 3 ? ` (+${r.avisos.length - 3})` : ""}`)
    finAnterior = r.saldoFinal
  }
}

async function santander() {
  console.log(`
══ MSA Santander cta cte ══`)
  let finAnterior: number | null = null
  for (const f of pdfs(VARIAS, "MSA - Santander")) {
    const r = leerResumenSantander(await textosUbicadosPorPagina(new Uint8Array(readFileSync(join(VARIAS, f)))))
    const c = controlarResumenSantander(r)
    const enlaza = finAnterior === null || r.saldoInicial === null ? "" : Math.abs(finAnterior - r.saldoInicial) <= 0.01 ? " · enlaza ✓" : ` · ⚠️ NO enlaza (venía $ ${fmt(finAnterior)})`
    const deb = r.movimientos.reduce((a, m) => a + m.debito, 0), cred = r.movimientos.reduce((a, m) => a + m.credito, 0)
    console.log(`${c.ok ? "✓" : "✗"} ${f.padEnd(42)} cta ${r.numeroCuenta} cuit ${r.cuitTitular} ${r.desde}→${r.hasta} · ${String(r.movimientos.length).padStart(3)} movs · $ ${fmt(r.saldoInicial)} → $ ${fmt(r.saldoFinal)} · déb ${fmt(deb)} · cré ${fmt(cred)}${enlaza}`)
    for (const x of c.cadenaRota.slice(0, 3)) console.log(`     ✗ ${x.fecha} ${x.que}: esperado ${fmt(x.esperado)} · impreso ${fmt(x.impreso)}`)
    if (!c.saldoFinal.ok) console.log(`     ✗ saldo final: resumen ${fmt(c.saldoFinal.segunResumen)} · leído ${fmt(c.saldoFinal.leido)}`)
    if (r.avisos.length) console.log(`     avisos: ${r.avisos.slice(0, 3).join(" | ")}${r.avisos.length > 3 ? ` (+${r.avisos.length - 3})` : ""}`)
    finAnterior = r.saldoFinal
  }
}

if (process.argv.includes("--santander")) { await santander(); process.exit(0) }
await tarjetas("VISA MA", VARIAS, "MA - VISA")
await tarjetas("VISA PAM", VISA_PAM, "VISA PAM")
await cajas("Cotitulares CA pesos", "Cotit - CA - Pesos")
await cajas("Cotitulares CA dólares", "Cotit - CA - Dolar")
await cajas("MA ANSES CA pesos", "MA ANSES")
await santander()
