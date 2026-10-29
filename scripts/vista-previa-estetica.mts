/**
 * 🎨 Vista previa de la presentación del Excel de papeles (JMS 29/10/2026): toma un export YA bajado, lo vuelve a
 * armar solapa por solapa con `agregarHoja` (sólo valores y fórmulas) y lo escribe con su vista (inmovilizado y
 * color de solapa). Sirve para mirar la estética sin levantar la app.
 *
 * ```
 * npx tsx scripts/vista-previa-estetica.mts "C:\ruta\Papeles_balance_....xlsx" "C:\ruta\salida.xlsx"
 * ```
 */
import XLSX from "xlsx-js-style"
import { readFileSync, writeFileSync } from "node:fs"
import { agregarHoja, vistasDe } from "../lib/balance/export-libro-diario"
import { aplicarVistas } from "../lib/balance/formato-excel"

const [entrada, salida] = process.argv.slice(2)
const origen = XLSX.read(readFileSync(entrada), { cellFormula: true })
const wb = XLSX.utils.book_new()
for (const nombre of origen.SheetNames) {
  const ws = origen.Sheets[nombre]
  const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" })
  // Las fórmulas vuelven como fórmulas (con su valor), para que la vista previa se parezca al export.
  const r = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null
  if (r) for (let f = r.s.r; f <= r.e.r; f++) for (let c = r.s.c; c <= r.e.c; c++) {
    const x = ws[XLSX.utils.encode_cell({ r: f, c })]
    if (x?.f && filas[f]) filas[f][c] = { t: "n", f: x.f, v: x.v }
  }
  // Los anchos del export original (cuando los tenía) para no mezclar dos cambios.
  const cols = ws["!cols"]?.map(k => ({ ancho: Math.round(k.wch ?? (k.wpx ? k.wpx / 7 : 10)) }))
  agregarHoja(wb, nombre, filas, cols && cols.length ? cols : undefined)
}
const bytes = await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistasDe(wb))
writeFileSync(salida, bytes)
console.log(`listo: ${origen.SheetNames.length} solapas → ${salida}`)
