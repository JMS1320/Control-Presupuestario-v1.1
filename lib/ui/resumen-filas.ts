/**
 * 📊 **LA BARRA DE ABAJO, COMO EN EXCEL** (A-FEAT-1464, JMS 31/10: *«que la app siempre tenga abajo, chico y discreto, lo
 * mismo que Excel: tantas filas, tal sumatoria, tal promedio. Si tengo "comisión cuenta bancaria" conciliado, para mí son
 * 4 meses → deben ser 8 débitos (cuenta y tarjeta). Me muestra 8 filas, veo que son 4 meses y digo está bien; si son 2
 * meses digo ¿qué pasa?»*).
 *
 * Pura: cuántas filas, en cuántos meses (y cuántas por mes), cuánto suman débitos y créditos, el neto y el promedio.
 * La usa el extracto; cualquier tabla con fecha e importes la puede usar igual (§ ♻️ Centralizar).
 */
export interface ResumenFilas {
  filas: number
  /** Meses distintos (AAAA-MM) entre las fechas. */
  meses: number
  /** Filas por mes, redondeado a 1 decimal (0 si no hay meses). */
  porMes: number
  debitos: number
  creditos: number
  neto: number
  /** Promedio por fila del importe (débito o crédito), 0 si no hay filas. */
  promedio: number
  desde: string | null
  hasta: string | null
}

const n = (x: unknown) => Number(x) || 0

export function resumenDeFilas<T>(filas: T[], fecha: (f: T) => string | null | undefined, debito: (f: T) => unknown, credito: (f: T) => unknown): ResumenFilas {
  const meses = new Set<string>()
  let debitos = 0, creditos = 0, desde: string | null = null, hasta: string | null = null
  for (const f of filas) {
    const d = String(fecha(f) ?? "").slice(0, 10)
    if (d) {
      meses.add(d.slice(0, 7))
      if (!desde || d < desde) desde = d
      if (!hasta || d > hasta) hasta = d
    }
    debitos += n(debito(f)); creditos += n(credito(f))
  }
  const r2 = (x: number) => Math.round(x * 100) / 100
  return {
    filas: filas.length, meses: meses.size, porMes: meses.size ? Math.round((filas.length / meses.size) * 10) / 10 : 0,
    debitos: r2(debitos), creditos: r2(creditos), neto: r2(creditos - debitos),
    promedio: filas.length ? r2((debitos + creditos) / filas.length) : 0, desde, hasta,
  }
}
