/**
 * ↔️ El SENTIDO de la cuota que se crea al conciliar un movimiento: «egreso» si salió plata, «ingreso» si entró (A-BUG-1584).
 *
 * Una sola regla para los dos caminos que crean la cuota desde un movimiento: la asignación a mano en el Extracto
 * (`vista-extracto-bancario.tsx`) y el motor de conciliación (`useMotorConciliacion.ts`).
 *
 * 🧨 Por qué existe: los dos decían `debitos > 0 ? "egreso" : "ingreso"`. Una compra en DÓLARES con tarjeta tiene $ 0 en pesos (débito y
 * crédito) y el importe en `debitos_usd` → caía como «ingreso». Con la cuota en $ 0 no se notaba; al pasarla a pesos (script 241) 52 consumos
 * restaron en vez de sumar (corregidos por el script 242).
 */
export interface MovimientoConSentido { debitos?: number | string | null; creditos?: number | string | null; debitos_usd?: number | string | null; creditos_usd?: number | string | null }

export function sentidoDelMovimiento(m: MovimientoConSentido): "egreso" | "ingreso" {
  const d = Number(m.debitos) || 0, c = Number(m.creditos) || 0
  if (d > 0) return "egreso"
  if (c > 0) return "ingreso"
  // sin pesos: lo dicen los dólares (compra en US$ con tarjeta → egreso; devolución en US$ → ingreso)
  const usd = (Number(m.debitos_usd) || 0) - (Number(m.creditos_usd) || 0)
  return usd < 0 ? "ingreso" : "egreso"
}
