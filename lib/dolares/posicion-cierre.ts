/**
 * 📒 LA POSICIÓN EN MONEDA EXTRANJERA AL CIERRE — A-FEAT-1398 etapa 4 (para los papeles del balance).
 *
 * Lo que el balance necesita de una cuenta en dólares: el **saldo en US$ a la fecha de cierre**, valuado al **TC de
 * cierre**, y la **diferencia de cambio** contra lo que costó en pesos (la suma de los pesos de cada movimiento,
 * a su TC). Si algún movimiento hasta el cierre no tiene TC, la diferencia NO se calcula: se dice cuántos faltan
 * (§ «nada se descarta en silencio»).
 *
 * Sólo las cuentas de una EMPRESA entran a su balance: las de Cotitulares no son de MSA/PAM/MA (lo que pagaron por
 * una empresa va por la cuenta corriente, no como disponibilidad).
 *
 * ⚠️ No está enganchado todavía al Excel del balance (`components/papeles-de-balance.tsx` lo estaba editando la
 * terminal del balance el 28/10). Para el ejercicio 25/26 no cambia nada: estas cuentas no tienen movimientos
 * antes del 30/06/2026.
 */
import { CUENTAS_DOLARES_Y_COTITULARES, importeConSigno, pesosDe, type MovimientoMoneda } from "@/lib/dolares/cuentas"

const r2 = (n: number) => Math.round(n * 100) / 100

/** Las cuentas en dólares de cada empresa, para su balance (sin las de Cotitulares). */
export const CUENTAS_EN_MONEDA_EXTRANJERA: Record<string, typeof CUENTAS_DOLARES_Y_COTITULARES> = {
  MSA: CUENTAS_DOLARES_Y_COTITULARES.filter(c => c.empresa === "MSA" && c.moneda === "USD"),
  PAM: CUENTAS_DOLARES_Y_COTITULARES.filter(c => c.empresa === "PAM" && c.moneda === "USD"),
  MA: CUENTAS_DOLARES_Y_COTITULARES.filter(c => c.empresa === "MA" && c.moneda === "USD"),
}

export interface PosicionCierre {
  usd: number
  /** valuado al TC de cierre (null si no se dio el TC) */
  pesosAlCierre: number | null
  /** lo que costó en pesos: suma de los pesos de cada movimiento (null si alguno no tiene TC) */
  pesosHistoricos: number | null
  /** pesosAlCierre − pesosHistoricos: ganancia (+) o pérdida (−) por diferencia de cambio */
  diferenciaDeCambio: number | null
  sinTC: number
  movimientos: number
}

export function posicionAlCierre(movs: MovimientoMoneda[], fechaCierre: string, tcCierre: number | null): PosicionCierre {
  const hasta = movs.filter(m => m.fecha && m.fecha <= fechaCierre)
  let usd = 0, hist = 0, sinTC = 0
  for (const m of hasta) {
    usd += importeConSigno(m)
    const p = pesosDe(m)
    if (p == null) sinTC++
    else hist += p
  }
  usd = r2(usd)
  const pesosAlCierre = tcCierre && tcCierre > 0 ? r2(usd * tcCierre) : null
  const pesosHistoricos = sinTC > 0 ? null : r2(hist)
  const diferenciaDeCambio = pesosAlCierre != null && pesosHistoricos != null ? r2(pesosAlCierre - pesosHistoricos) : null
  return { usd, pesosAlCierre, pesosHistoricos, diferenciaDeCambio, sinTC, movimientos: hasta.length }
}
