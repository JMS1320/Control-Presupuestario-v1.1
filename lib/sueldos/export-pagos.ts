/**
 * 📗 **EXPORTAR LOS PAGOS DE SUELDOS A EXCEL** (A-FEAT-1217).
 *
 * Pedido del usuario 2026-09-30: *«otro tema bueno sería poder exportar los pagos de sueldos vía
 * Excel desde Sueldos. Usar el mismo export que Cash Flow»*.
 *
 * ## ⚠️ Una precisión, porque cambia lo que se hizo
 *
 * **El Cash Flow NO tiene export a Excel** (verificado: no hay ningún botón ni función). Lo que sí
 * existe y es el formato **canónico de este sistema** es el de los papeles del balance —
 * `lib/balance/formato-excel.ts` —, que es el que ya se le manda al contador: formato **Contabilidad**
 * para los importes, anchos por columna y fórmulas donde corresponde.
 *
 * 🔑 **Entonces «el mismo export que Cash Flow» se resolvió así**: las **columnas son las de la grilla
 * del Cash Flow** —las que él ya lee: fecha, CATEG, centro de costo, CUIT, proveedor, detalle,
 * débitos, créditos— y el **formato es el canónico**. Así el Excel se parece a lo que ve en pantalla
 * y se ve como los demás papeles.
 *
 * 📌 Y queda **reusable**: el día que el Cash Flow quiera su export, sale de acá.
 *
 * ## 🧮 El control, que en un listado de pagos es la suma
 *
 * La última fila es el **TOTAL con fórmula** (no un número pegado), así que si se filtra o se corrige
 * algo en el Excel, el total se recalcula solo. Y el pie dice **cuántos pagos** se exportaron, para
 * poder cruzarlo contra la pantalla (§ 🧮 de `CLAUDE.md`).
 */
import * as XLSX from "xlsx"
import { formatearHoja, conFormula, MONEDA, type Columna } from "@/lib/balance/formato-excel"

/** Un pago de sueldo, con lo que hace falta para el listado. */
export interface PagoParaExportar {
  fecha: string | null
  /** `anticipo` · `sueldo`. */
  tipo: string | null
  empleado: string
  cuit?: string | null
  empresa?: string | null
  descripcion: string | null
  monto: number | null
  estado: string | null
  medio_pago: string | null
  /** El nombre de la cuenta destino, ya resuelto (banco · alias recortado). */
  cuentaDestino?: string | null
  /** El mes al que se imputó el pago, que **no** es la fecha del movimiento. */
  periodo?: string | null
}

/** Las columnas, en el orden de la grilla del Cash Flow. */
const COLUMNAS = [
  "Fecha", "Período", "Empresa", "Empleado", "CUIT", "Tipo",
  "Detalle", "Cuenta destino", "Medio", "Estado", "Importe",
]

const COLS: Columna[] = [
  { ancho: 11 },            // Fecha
  { ancho: 10 },            // Período
  { ancho: 9 },             // Empresa
  { ancho: 26 },            // Empleado
  { ancho: 13 },            // CUIT
  { ancho: 11 },            // Tipo
  { ancho: 38 },            // Detalle
  { ancho: 26 },            // Cuenta destino
  { ancho: 13 },            // Medio
  { ancho: 13 },            // Estado
  { ancho: 16, z: MONEDA }, // Importe
]

const money = (n: number) => Math.round(n * 100) / 100

/** Arma la hoja: título, cabecera, un pago por fila y el TOTAL con fórmula. */
export function hojaDePagos(pagos: PagoParaExportar[], etiqueta: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`PAGOS DE SUELDOS — ${etiqueta}`])
  f.push(["El Período es el mes al que se imputó el pago; la Fecha es la del movimiento real."])
  f.push([])
  f.push(COLUMNAS)

  const desde = f.length + 1
  for (const p of pagos) {
    f.push([
      p.fecha ? String(p.fecha).slice(0, 10) : "",
      p.periodo ?? "",
      p.empresa ?? "",
      p.empleado,
      p.cuit ?? "",
      p.tipo ?? "",
      p.descripcion ?? "",
      p.cuentaDestino ?? "",
      p.medio_pago ?? "",
      p.estado ?? "",
      money(p.monto ?? 0),
    ])
  }
  const hasta = f.length

  const total = money(pagos.reduce((s, p) => s + (p.monto ?? 0), 0))
  f.push([
    "", "", "", "", "", "", "", "", "", "TOTAL",
    // 🧮 Fórmula, no número pegado: si se filtra o se corrige, el total se recalcula solo.
    pagos.length > 0 ? conFormula(`SUM(K${desde}:K${hasta})`, total) : 0,
  ])
  f.push([])
  f.push([`${pagos.length} pago(s) exportados.`])
  return f
}

/** El nombre del archivo. Lleva la etiqueta del período para no pisar el anterior. */
export function nombreArchivoPagos(etiqueta: string): string {
  return `Pagos_sueldos_${etiqueta.replace(/[^\w-]+/g, "_")}.xlsx`
}

/** Arma el workbook. Separado de la descarga para poder probarlo sin navegador. */
export function armarWorkbookPagos(pagos: PagoParaExportar[], etiqueta: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(hojaDePagos(pagos, etiqueta))
  formatearHoja(ws, COLS)
  XLSX.utils.book_append_sheet(wb, ws, "Pagos de sueldos")
  return wb
}

/** Descarga el Excel en el navegador. */
export function descargarPagosDeSueldos(pagos: PagoParaExportar[], etiqueta: string): void {
  const out = XLSX.write(armarWorkbookPagos(pagos, etiqueta), { bookType: "xlsx", type: "array" })
  const url = URL.createObjectURL(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  )
  const a = document.createElement("a")
  a.href = url
  a.download = nombreArchivoPagos(etiqueta)
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 0)
}
