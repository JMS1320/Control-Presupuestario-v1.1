/**
 * 🔁 QUIEN TIENE CUENTA CORRIENTE NO VA COMPROBANTE POR COMPROBANTE — A-FEAT-1386 / papeles 03, 04 y 14.
 *
 * Regla de JMS (2026-10-29), a raíz de la NC 670821 de Federación Patronal que aparecía en el 04 Y en el 14:
 * *«el balance, si muestra saldo en cta cte, no debe mostrar aparte comprobantes individuales ni a cobrar ni a pagar»*.
 *
 * Entonces: los comprobantes de una contraparte que tiene cuenta corriente en el papel 14 SALEN de las cuentas a
 * pagar (04) y a cobrar (03). No se descartan en silencio (§ 🧮): quedan listados aparte, con su total, diciendo que
 * van por su cuenta corriente. Así la misma plata no se cuenta dos veces.
 */
import type { CuentasAlCierre, FilaCuenta } from "@/lib/balance/cuentas-al-cierre"
import { CONTRAPARTES_DEL_BALANCE } from "@/lib/balance/cuentas-corrientes"

/** Federación Patronal: su cuenta corriente al cierre va en el 14 (A-FEAT-1385, sólo MSA). */
export const CUIT_FEDERACION_PATRONAL = "33707366589"

/** CUIT → nombre de la cuenta corriente, para la empresa del balance. */
export function cuitsConCuentaCorriente(empresa: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const c of CONTRAPARTES_DEL_BALANCE) if (c.cuit) m.set(c.cuit, c.nombre)
  if (empresa.toUpperCase() === "MSA") m.set(CUIT_FEDERACION_PATRONAL, "Federación Patronal Seguros")
  return m
}

export type CuentasSinCuentaCorriente = CuentasAlCierre & {
  /** Los que salieron porque su contraparte va por cuenta corriente (papel 14). */
  enCuentaCorriente: (FilaCuenta & { cuentaCorriente: string })[]
  totalEnCuentaCorriente: number
}

const r2 = (n: number) => Math.round(n * 100) / 100
const sumar = (xs: FilaCuenta[]) => r2(xs.reduce((s, x) => s + x.importe, 0))

/** Saca de un papel 03/04 los comprobantes de quien tiene cuenta corriente. Pura. */
export function sacarLosDeCuentaCorriente(c: CuentasAlCierre, cuits: Map<string, string>): CuentasSinCuentaCorriente {
  const enCC: (FilaCuenta & { cuentaCorriente: string })[] = []
  const quedan = (xs: FilaCuenta[], cuentaComoDeuda: boolean) => xs.filter(x => {
    const cc = cuits.get(String(x.asiento.cuit ?? ""))
    if (!cc) return true
    if (cuentaComoDeuda) enCC.push({ ...x, cuentaCorriente: cc })
    return false
  })
  const filas = quedan(c.filas, true)
  const sinDatoDePago = quedan(c.sinDatoDePago, true)
  const estadoDesconocido = quedan(c.estadoDesconocido, true)
  // Estas dos son listas informativas (no suman al total, o ya están en `filas`): sólo se limpian.
  const sinVinculoPoliza = quedan(c.sinVinculoPoliza, false)
  const canceladasPorCuotas = quedan(c.canceladasPorCuotas, false)
  return {
    ...c,
    filas, total: sumar(filas),
    sinDatoDePago, totalSinDato: sumar(sinDatoDePago),
    estadoDesconocido, totalDesconocido: sumar(estadoDesconocido),
    sinVinculoPoliza, totalSinVinculoPoliza: sumar(sinVinculoPoliza),
    canceladasPorCuotas, totalCanceladasPorCuotas: sumar(canceladasPorCuotas),
    enCuentaCorriente: enCC, totalEnCuentaCorriente: sumar(enCC),
  }
}
