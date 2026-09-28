/**
 * Vuelca UNA hoja de los papeles del balance, fila por fila — A-FEAT-09.
 *
 * El digesto (`leer-papeles-balance.mts`) muestra las primeras filas y los patrones de fórmula;
 * sirve para orientarse. Cuando una hoja **es** el dato —el borrador del balance, por ejemplo, que
 * es el plan de cuentas con su saldo— hace falta verla entera.
 *
 *     npx tsx scripts/volcar-hoja-balance.mts "<parte del archivo>" "<parte de la hoja>"
 */
import * as XLSX from "xlsx"
import { readdirSync, statSync, readFileSync } from "node:fs"
import { join } from "node:path"

const RAIZ = "- Comunicacion JMS Claude - Archivos/Balance"
const fArchivo = (process.argv[2] ?? "").toLowerCase()
const fHoja = (process.argv[3] ?? "").toLowerCase()

function archivos(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const ruta = join(dir, e)
    if (statSync(ruta).isDirectory()) { out.push(...archivos(ruta)); continue }
    if (/\.(xlsx|xls|xlsm)$/i.test(e) && !e.startsWith("~$")) out.push(ruta)
  }
  return out
}

for (const ruta of archivos(RAIZ)) {
  if (fArchivo && !ruta.toLowerCase().includes(fArchivo)) continue
  const wb = XLSX.read(readFileSync(ruta), { cellFormula: true, cellDates: true, cellNF: true })
  for (const hoja of wb.SheetNames) {
    if (fHoja && !hoja.toLowerCase().includes(fHoja)) continue
    const ws = wb.Sheets[hoja]
    if (!ws?.["!ref"]) continue
    const r = XLSX.utils.decode_range(ws["!ref"])
    console.log(`\n### ${ruta.split(/[\\/]/).pop()} → ${hoja}`)
    for (let fila = r.s.r; fila <= r.e.r; fila++) {
      const partes: string[] = []
      for (let col = r.s.c; col <= r.e.c; col++) {
        const c = ws[XLSX.utils.encode_cell({ r: fila, c: col })] as XLSX.CellObject | undefined
        if (!c) continue
        // Se muestra el valor y, si la celda es calculada, también la fórmula: el valor dice
        // cuánto y la fórmula dice de dónde sale.
        const v = c.t === "n" && typeof c.v === "number"
          ? (Number.isInteger(c.v) ? String(c.v) : c.v.toFixed(2))
          : String(c.w ?? c.v ?? "").trim()
        if (!v && !c.f) continue
        partes.push(`${XLSX.utils.encode_col(col)}=${v}${c.f ? ` {=${c.f}}` : ""}`)
      }
      if (partes.length) console.log(`${String(fila + 1).padStart(4)} | ${partes.join(" | ")}`)
    }
  }
}
