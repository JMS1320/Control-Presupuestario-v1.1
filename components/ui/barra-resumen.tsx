"use client"

/**
 * 📊 **LA BARRA DE ABAJO, COMO EN EXCEL** — el componente común (A-FEAT-1464). JMS 31/10: *«que la app siempre tenga abajo,
 * chico y discreto, lo mismo que Excel: tantas filas, tal sumatoria, tal promedio»*.
 *
 * Va al pie de cualquier tabla: filas · en cuántos meses (y cuántas por mes) · la suma de cada columna de importe · el
 * promedio — y la misma línea para lo tildado, si hay. El cálculo de meses está en `lib/ui/resumen-filas.ts`.
 */
import { resumenDeFilas } from "@/lib/ui/resumen-filas"

export interface ColumnaSuma<T> { rotulo: string; valor: (f: T) => unknown }

const pesos = (x: number) => x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r2 = (x: number) => Math.round(x * 100) / 100

export function BarraResumen<T>({ filas, elegidas, fecha, columnas, neto, className }: {
  filas: T[]
  /** Lo tildado (si la tabla tiene selección). */
  elegidas?: T[]
  fecha: (f: T) => string | null | undefined
  /** Las columnas de importe a sumar; el promedio es sobre la suma de todas. */
  columnas: ColumnaSuma<T>[]
  /** Si se muestra el neto = 2ª columna − 1ª (p. ej. créditos − débitos). */
  neto?: boolean
  className?: string
}) {
  const linea = (rot: string, xs: T[]) => {
    const r = resumenDeFilas(xs, fecha, () => 0, () => 0)
    const sumas = columnas.map(c => r2(xs.reduce((s, f) => s + (Number(c.valor(f)) || 0), 0)))
    const total = sumas.reduce((a, b) => a + b, 0)
    return (
      <span key={rot}>
        <b>{rot}</b> {r.filas} fila(s)
        {r.meses > 0 && <> · {r.meses} mes(es) ({r.porMes}/mes)</>}
        {columnas.map((c, i) => sumas[i] !== 0 && <span key={c.rotulo}> · {c.rotulo} $ {pesos(sumas[i])}</span>)}
        {neto && sumas.length >= 2 && sumas[0] !== 0 && sumas[1] !== 0 && <> · neto $ {pesos(r2(sumas[1] - sumas[0]))}</>}
        {r.filas > 0 && <> · promedio $ {pesos(r2(total / r.filas))}</>}
      </span>
    )
  }
  return (
    <div className={`sticky bottom-0 flex flex-wrap gap-x-4 gap-y-0.5 border-t bg-gray-50/95 px-3 py-1 text-[11px] text-gray-600 tabular-nums ${className ?? ""}`}
      data-test="barra-resumen">
      {linea("En la lista:", filas)}
      {!!elegidas?.length && linea("Tildadas:", elegidas)}
    </div>
  )
}
