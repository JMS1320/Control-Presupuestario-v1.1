/**
 * 🏦 EL CONTROL CONTRA BANCOS de la vista «Por responsable» — A-FEAT-1637 (JMS 22/11: «a y b ok, avanzá con el control contra
 * bancos»). Puro (lo prueba `npm run probar`).
 *
 * La identidad, renglón por renglón:
 *   saldo inicial de sus cuentas en pesos
 *   + Ingresos propios + Recibido de los socios (neto) + Egresos (todos los suyos, con los retiros a caja y lo que pagó otro)
 *   + Financieros propios (FCI, pagos de la tarjeta, entre cuentas propias) + Distribuciones
 *   + lo que el Dashboard no muestra (movimientos sin categoría y los de tipo «NO»: se listan)
 *   = saldo final calculado  ⟷  saldo final de los bancos.
 * Si no cierra, alerta grande: la diferencia es lo que el sistema no tiene (un movimiento que falta en el extracto, un saldo del banco
 * que salta). Nada se descarta en silencio.
 *
 * 🧾 De dónde sale cada saldo (`saldoDeCanal`):
 *   · Banco con columna `saldo` (MA Galicia, MA ANSES): el saldo del banco después del último movimiento (orden: fecha y `orden`). Al
 *     inicio, el del último movimiento ANTES del período; si el canal arranca dentro del período, el del primer dato menos ese
 *     movimiento (= el saldo con que abrió), marcado «primer dato».
 *   · 💳 La TARJETA no trae saldo (`ma.tarjeta_visa.saldo` vacío). Su «saldo» es menos la deuda: lo que se pagó menos lo consumido,
 *     acumulado desde el primer dato (VISA MA: 29/09/2025, deuda 0 ahí, marcado). Los renglones «resumen» son el total de cada resumen
 *     (repiten consumos y pago) y NO se suman. Así lo consumido y no pagado al cierre queda como deuda y no rompe el control.
 *   · Un canal sin saldo del banco y que no es tarjeta: igual que la tarjeta, por sus movimientos (marcado).
 * 💵 Las cuentas en dólares no entran (pesos y dólares nunca mezclados): un pase pesos ↔ dólares queda como movimiento financiero y
 * se ve en su renglón.
 */
import type { VistaResponsable } from "./responsable"

const r2 = (n: number) => Math.round(n * 100) / 100

export interface FilaCanalCrudo { fecha: string; orden?: number | null; debitos?: number | null; creditos?: number | null; saldo?: number | null; categ?: string | null; tipo_fila?: string | null; descripcion?: string | null; id?: string }

export interface SaldoCanal {
  canal: string
  empresa: string
  tipo: string
  fuente: "banco" | "movimientos"
  inicial: number
  final: number
  /** El saldo inicial sale del primer dato (el canal arranca dentro del período o antes no hay nada). */
  inicialEstimado: boolean
  primerDato: string | null
  nota: string
  /** Créditos − débitos de TODOS sus movimientos del período (sin los renglones «resumen» de la tarjeta). */
  netoMovimientos: number
  /** Saldo final − inicial − movimientos: en un banco, lo que el extracto cargado no explica (0 si está completo). */
  diferenciaCanal: number
  sinCategoria: Array<{ fecha: string; descripcion: string; importe: number }>
}

const neto = (f: FilaCanalCrudo) => (Number(f.creditos) || 0) - (Number(f.debitos) || 0)
const ordenar = (a: FilaCanalCrudo, b: FilaCanalCrudo) => a.fecha.localeCompare(b.fecha) || (Number(a.orden) || 0) - (Number(b.orden) || 0) || String(a.id ?? "").localeCompare(String(b.id ?? ""))

/** El saldo de un canal al inicio y al final del período, de sus filas (todas las que haya hasta `hasta`). */
export function saldoDeCanal(canal: string, empresa: string, tipo: string, filas: FilaCanalCrudo[], desde: string, hasta: string): SaldoCanal {
  const fs = filas.filter(f => f.tipo_fila !== "resumen" && String(f.fecha).slice(0, 10) <= hasta).map(f => ({ ...f, fecha: String(f.fecha).slice(0, 10) })).sort(ordenar)
  const antes = fs.filter(f => f.fecha < desde), del = fs.filter(f => f.fecha >= desde)
  const netoMovimientos = r2(del.reduce((t, f) => t + neto(f), 0))
  const sinCategoria = del.filter(f => !String(f.categ ?? "").trim()).map(f => ({ fecha: f.fecha, descripcion: String(f.descripcion ?? ""), importe: r2(neto(f)) }))
  const primerDato = fs[0]?.fecha ?? null
  const conSaldo = tipo !== "tarjeta" && fs.some(f => f.saldo !== null && f.saldo !== undefined)
  if (conSaldo) {
    const ss = fs.filter(f => f.saldo !== null && f.saldo !== undefined)
    const ultAntes = ss.filter(f => f.fecha < desde).at(-1)
    const primero = ss[0]
    const inicial = ultAntes ? r2(Number(ultAntes.saldo)) : primero ? r2(Number(primero.saldo) - neto(primero)) : 0
    const final = ss.length ? r2(Number(ss.at(-1)!.saldo)) : inicial
    const est = !ultAntes
    return { canal, empresa, tipo, fuente: "banco", inicial, final, inicialEstimado: est, primerDato,
      nota: est ? `sin saldo antes del ${desde.split("-").reverse().join("/")}: el inicial es el del primer dato (${primerDato?.split("-").reverse().join("/") ?? "—"}) menos ese movimiento` : "saldo del banco",
      netoMovimientos, diferenciaCanal: r2(final - inicial - netoMovimientos), sinCategoria }
  }
  const inicial = r2(antes.reduce((t, f) => t + neto(f), 0))
  return { canal, empresa, tipo, fuente: "movimientos", inicial, final: r2(inicial + netoMovimientos), inicialEstimado: true, primerDato,
    nota: tipo === "tarjeta"
      ? `la tarjeta no trae saldo: es menos la deuda (pagos − consumos) acumulada desde el primer dato (${primerDato?.split("-").reverse().join("/") ?? "—"}, deuda 0 ahí); los renglones «resumen» no se suman`
      : `sin saldo del banco: se arma con sus movimientos desde el primer dato (${primerDato?.split("-").reverse().join("/") ?? "—"})`,
    netoMovimientos, diferenciaCanal: 0, sinCategoria }
}

export interface ControlBancos {
  canales: SaldoCanal[]
  saldoInicial: number
  ingresosPropios: number
  recibidoSocios: number
  egresos: number
  financieros: number
  distribuciones: number
  sinCategoria: number
  fuera: number
  saldoFinalCalculado: number
  saldoFinalBancos: number
  diferencia: number
  cierra: boolean
  avisos: string[]
}

/** La identidad. `fuera` = el neto de los movimientos de SUS canales con tipo «NO» (no entran a la vista). */
export function controlContraBancos(v: VistaResponsable, canales: SaldoCanal[], fuera: number): ControlBancos {
  const suma = (k: "totalIngresos" | "totalEgresos" | "totalFinancieros" | "totalDistribuciones") => r2(v.resumen.reduce((t, m) => t + m[k], 0))
  const ingresosPropios = suma("totalIngresos"), egresos = suma("totalEgresos"), financieros = suma("totalFinancieros"), distribuciones = suma("totalDistribuciones")
  const recibidoSocios = r2(v.financiado.total + v.porCuenta.total)
  const saldoInicial = r2(canales.reduce((t, c) => t + c.inicial, 0)), saldoFinalBancos = r2(canales.reduce((t, c) => t + c.final, 0))
  const sinCategoria = r2(canales.reduce((t, c) => t + c.sinCategoria.reduce((u, x) => u + x.importe, 0), 0))
  const saldoFinalCalculado = r2(saldoInicial + ingresosPropios + recibidoSocios + egresos + financieros + distribuciones + sinCategoria + fuera)
  const diferencia = r2(saldoFinalBancos - saldoFinalCalculado)
  const avisos: string[] = []
  for (const c of canales) {
    if (c.inicialEstimado) avisos.push(`${c.canal}: ${c.nota}.`)
    if (Math.abs(c.diferenciaCanal) >= 0.005) avisos.push(`${c.canal}: el saldo del banco se movió ${c.diferenciaCanal.toLocaleString("es-AR", { minimumFractionDigits: 2 })} más de lo que suman sus movimientos cargados (falta o sobra algo en el extracto).`)
  }
  if (sinCategoria) avisos.push(`Movimientos sin categoría en sus cuentas (no entran al Dashboard): ${canales.reduce((t, c) => t + c.sinCategoria.length, 0)}, neto ${sinCategoria.toLocaleString("es-AR", { minimumFractionDigits: 2 })} — se categorizan en Extracto bancario.`)
  if (fuera) avisos.push(`Movimientos con tipo «NO» (no entran a la vista): neto ${fuera.toLocaleString("es-AR", { minimumFractionDigits: 2 })}.`)
  // Lo que se explica solo: los movimientos internos (financieros) se ven en su renglón; el resto de la diferencia es del extracto.
  return { canales, saldoInicial, ingresosPropios, recibidoSocios, egresos, financieros, distribuciones, sinCategoria, fuera,
    saldoFinalCalculado, saldoFinalBancos, diferencia, cierra: Math.abs(diferencia) < 0.005, avisos }
}
