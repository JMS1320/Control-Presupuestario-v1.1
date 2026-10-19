/**
 * 🏦 Qué pagos de sueldos van al ARCHIVO DEL BANCO desde *Sueldos → Pagos registrados* (A-FEAT-1273).
 *
 * Pedido del usuario 2026-10-13: *«yo debo poder exportar el excel para el banco desde sueldos y
 * decirle cuáles»*. El archivo del banco ya existía, pero sólo se abría desde el Cash Flow.
 *
 * Dos reglas, y las dos evitan transferir de más:
 * - **Sólo los TILDADOS que se ven.** Sin tilde no va ninguno: acá no hay un «todos» por default,
 *   porque el mes trae también los pagos viejos ya transferidos.
 * - **Sólo los pagados por BANCO.** Un pago en efectivo (caja) no se transfiere; se deja afuera y
 *   se dice cuántos fueron, no se descarta en silencio.
 */
export interface PagoParaBanco {
  id: string
  medio_pago?: string | null
}

export interface SeleccionParaBanco {
  /** Ids de `sueldos.pagos` que van al archivo. */
  ids: string[]
  /** Tildados que NO van porque se pagaron por caja. */
  fueraPorCaja: number
}

export function pagosParaElBanco(pagos: readonly PagoParaBanco[], elegidos: ReadonlySet<string>): SeleccionParaBanco {
  const tildados = pagos.filter(p => elegidos.has(p.id))
  // Sin medio cargado es banco: es el default de la pantalla.
  const porBanco = tildados.filter(p => (p.medio_pago ?? 'banco') === 'banco')
  return { ids: porBanco.map(p => p.id), fueraPorCaja: tildados.length - porBanco.length }
}
