/**
 * 💵 LAS CUENTAS EN DÓLARES Y LAS DE COTITULARES — A-FEAT-1398 (JMS 2026-10-28).
 *
 * *«Sería una rama entera de dólares… MSA tiene cta cte y caja física en dólares; MA tiene CA y física; Cotitulares:
 * dólares CA, pesos CA y física dólares.»* Las tablas las creó `scripts/126` con la misma forma que las cajas, más
 * `moneda`, `tipo_cambio`, `importe_pesos`, el `par_*` (el otro lado de una compra/venta) y `por_cuenta_de`.
 *
 * Esta lista es la ÚNICA: `CUENTAS_BANCARIAS` (Extracto + conciliación), los permisos por cuenta, la propagación de
 * la cuenta contable y el «pagado desde» la importan de acá.
 *
 * **Cotitulares** = MA, Manuel, Soledad, Mechi, Andrés y JMS: un titular propio, no una empresa. Cuando su plata
 * paga algo de una empresa (el caso del 28/10: pagó una factura de MSA), el movimiento lleva `por_cuenta_de` y arma
 * la **cuenta corriente Cotitulares ↔ esa empresa** (préstamo o aporte: lo decide JMS).
 */

export type Titular = "MSA" | "PAM" | "MA" | "Cotitulares"
export type Moneda = "USD" | "ARS"

export const COTITULARES = ["MA", "Manuel", "Soledad", "Mechi", "Andrés", "JMS"] as const

export interface CuentaManual {
  id: string
  nombre: string
  tabla_bd: string
  schema_bd: "public" | "msa" | "ma"
  empresa: Titular
  moneda: Moneda
  tipo: "banco" | "caja"
}

export const CUENTAS_DOLARES_Y_COTITULARES: CuentaManual[] = [
  { id: "msa_cc_usd", nombre: "MSA Cuenta Corriente USD", tabla_bd: "cc_usd", schema_bd: "msa", empresa: "MSA", moneda: "USD", tipo: "banco" },
  { id: "msa_caja_usd", nombre: "MSA Caja USD", tabla_bd: "caja_usd", schema_bd: "msa", empresa: "MSA", moneda: "USD", tipo: "caja" },
  { id: "ma_ca_usd", nombre: "MA Caja de Ahorro USD", tabla_bd: "ca_usd", schema_bd: "ma", empresa: "MA", moneda: "USD", tipo: "banco" },
  { id: "ma_caja_usd", nombre: "MA Caja USD", tabla_bd: "caja_usd", schema_bd: "ma", empresa: "MA", moneda: "USD", tipo: "caja" },
  { id: "cotitulares_ca_usd", nombre: "Cotitulares Caja de Ahorro USD", tabla_bd: "cotitulares_ca_usd", schema_bd: "public", empresa: "Cotitulares", moneda: "USD", tipo: "banco" },
  { id: "cotitulares_ca_pesos", nombre: "Cotitulares Caja de Ahorro Pesos", tabla_bd: "cotitulares_ca_pesos", schema_bd: "public", empresa: "Cotitulares", moneda: "ARS", tipo: "banco" },
  { id: "cotitulares_caja_usd", nombre: "Cotitulares Caja USD", tabla_bd: "cotitulares_caja_usd", schema_bd: "public", empresa: "Cotitulares", moneda: "USD", tipo: "caja" },
  // 🏦 A-FEAT-1386 (scripts/129, JMS 29/10): los otros bancos de MSA, en pesos y cargados a mano
  { id: "msa_santander", nombre: "MSA Banco Santander", tabla_bd: "santander", schema_bd: "msa", empresa: "MSA", moneda: "ARS", tipo: "banco" },
  { id: "msa_provincia", nombre: "MSA Banco Provincia", tabla_bd: "provincia", schema_bd: "msa", empresa: "MSA", moneda: "ARS", tipo: "banco" },
  // 🏦 A-FEAT-1424 (scripts/135, JMS 30/10): la caja de ahorro ANSES de MA, en pesos
  { id: "ma_anses_ca_pesos", nombre: "MA Caja de Ahorro ANSES", tabla_bd: "anses_ca_pesos", schema_bd: "ma", empresa: "MA", moneda: "ARS", tipo: "banco" },
]

/** ¿Es una de estas cuentas (que se cargan a mano y pueden estar en dólares)? */
export const esCuentaManual = (id: string | null | undefined) => CUENTAS_DOLARES_Y_COTITULARES.some(c => c.id === id)
export const cuentaManual = (id: string | null | undefined) => CUENTAS_DOLARES_Y_COTITULARES.find(c => c.id === id) ?? null

/** El movimiento tal como lo guardan las 7 tablas (sólo lo que hace falta para las cuentas). */
export interface MovimientoMoneda {
  id?: string
  fecha: string | null
  descripcion?: string | null
  debitos: number | null
  creditos: number | null
  moneda: Moneda
  tipo_cambio: number | null
  importe_pesos: number | null
  por_cuenta_de?: string | null
  estado?: string | null
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** El importe del movimiento en la moneda de la cuenta, con signo: entra +, sale −. */
export const importeConSigno = (m: Pick<MovimientoMoneda, "debitos" | "creditos">) => (Number(m.creditos) || 0) - (Number(m.debitos) || 0)

/**
 * 🎚️ El equivalente en pesos, con signo. Default del dato real (§ CLAUDE.md): lo escrito a mano (`importe_pesos`)
 * manda; si no hay, importe × TC; en una cuenta en pesos es el importe. **null = no se puede saber** (USD sin TC):
 * no se inventa un cero, se muestra que falta.
 */
export function pesosDe(m: MovimientoMoneda): number | null {
  const imp = importeConSigno(m)
  if (m.importe_pesos != null) return Math.sign(imp || 1) * Math.abs(Number(m.importe_pesos))
  if (m.moneda === "ARS") return imp
  if (m.tipo_cambio != null && m.tipo_cambio > 0) return r2(imp * m.tipo_cambio)
  return null
}

/** El saldo de una cuenta: en su moneda, en pesos (de lo que tiene TC) y cuántos movimientos no tienen TC. */
export function saldoCuenta(movs: MovimientoMoneda[]): { moneda: number; pesos: number; sinTC: number; pendientes: number } {
  let moneda = 0, pesos = 0, sinTC = 0, pendientes = 0
  for (const m of movs) {
    moneda += importeConSigno(m)
    const p = pesosDe(m)
    if (p == null) sinTC++
    else pesos += p
    if ((m.estado ?? "Pendiente") === "Pendiente") pendientes++
  }
  return { moneda: r2(moneda), pesos: r2(pesos), sinTC, pendientes }
}

/** 📅 El flujo por mes (en la moneda de la cuenta): entradas, salidas, neto y saldo acumulado. */
export function flujoPorMes(movs: MovimientoMoneda[]): { mes: string; entradas: number; salidas: number; neto: number; saldo: number }[] {
  const porMes = new Map<string, { entradas: number; salidas: number }>()
  for (const m of movs) {
    if (!m.fecha) continue
    const mes = m.fecha.slice(0, 7)
    const x = porMes.get(mes) ?? { entradas: 0, salidas: 0 }
    x.entradas += Number(m.creditos) || 0
    x.salidas += Number(m.debitos) || 0
    porMes.set(mes, x)
  }
  let saldo = 0
  return [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, x]) => {
    const neto = r2(x.entradas - x.salidas)
    saldo = r2(saldo + neto)
    return { mes, entradas: r2(x.entradas), salidas: r2(x.salidas), neto, saldo }
  })
}

/**
 * 🤝 La cuenta corriente de un titular con cada empresa: lo que su plata pagó «por cuenta de» la empresa (sale de
 * su cuenta → la empresa le debe, +) menos lo que la empresa le devolvió (entra a su cuenta → −). En pesos.
 * Lo que está en USD sin TC se cuenta aparte: no se puede sumar sin inventar.
 */
export function cuentaCorriente(movs: MovimientoMoneda[]): { empresa: string; pesos: number; movimientos: number; sinTC: number }[] {
  const por = new Map<string, { pesos: number; movimientos: number; sinTC: number }>()
  for (const m of movs) {
    if (!m.por_cuenta_de) continue
    const x = por.get(m.por_cuenta_de) ?? { pesos: 0, movimientos: 0, sinTC: 0 }
    x.movimientos++
    const p = pesosDe(m)
    if (p == null) x.sinTC++
    else x.pesos += -p
    por.set(m.por_cuenta_de, x)
  }
  return [...por.entries()].map(([empresa, x]) => ({ empresa, ...x, pesos: r2(x.pesos) })).sort((a, b) => a.empresa.localeCompare(b.empresa))
}

/** Lee un número escrito en es-AR («1.234,56»). Vacío o basura → null. */
export function leerNumeroAR(s: string): number | null {
  const t = String(s ?? "").trim()
  if (!t) return null
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}

export interface CambioMoneda {
  fecha: string
  sentido: "venta" | "compra"   // venta = salen dólares, entran pesos
  usd: number
  tc: number
  descripcion: string
  categ: string
}

/**
 * 💱 Una compra/venta de dólares = DOS movimientos atados: el de la cuenta en USD y el de la cuenta en pesos.
 * Devuelve las dos filas (sin id ni par: los pone quien guarda). Venta: sale USD (débito), entran pesos (crédito);
 * compra al revés. Los pesos = USD × TC, redondeado al centavo, y quedan escritos en las dos filas.
 */
export function armarCambio(c: CambioMoneda) {
  const pesos = r2(c.usd * c.tc)
  const base = { fecha: c.fecha, categ: c.categ, estado: "Pendiente", tipo_cambio: c.tc, importe_pesos: pesos }
  const desc = c.descripcion || (c.sentido === "venta" ? `Venta de USD ${c.usd} a ${c.tc}` : `Compra de USD ${c.usd} a ${c.tc}`)
  const filaUsd = { ...base, descripcion: desc, moneda: "USD" as const,
    debitos: c.sentido === "venta" ? c.usd : 0, creditos: c.sentido === "compra" ? c.usd : 0 }
  const filaPesos = { ...base, descripcion: desc, moneda: "ARS" as const,
    debitos: c.sentido === "compra" ? pesos : 0, creditos: c.sentido === "venta" ? pesos : 0 }
  return { pesos, filaUsd, filaPesos }
}

/** Lo que impide guardar un cambio (lista vacía = se puede). */
export function erroresCambio(c: Partial<CambioMoneda>, cuentaUsd: string | null, cuentaPesos: string | null): string[] {
  const e: string[] = []
  if (!c.fecha) e.push("Falta la fecha")
  if (!(c.usd && c.usd > 0)) e.push("Falta el importe en dólares")
  if (!(c.tc && c.tc > 0)) e.push("Falta el tipo de cambio")
  if (!cuentaUsd) e.push("Falta la cuenta en dólares")
  if (!cuentaPesos) e.push("Falta la cuenta en pesos")
  return e
}
