/**
 * 💵 **A-BUG-1307 — un consumo en DÓLARES de la tarjeta vale lo que se debitó en PESOS por él.**
 *
 * Caso (2026-10-20): «vthebestpdf USD 29,95» del resumen 29/01 tenía débito en pesos **0** (el importe
 * está en `debitos_usd`) y quedó conciliado contra una cuota de **$0**: el gasto no existía para el
 * presupuesto ni para el balance.
 *
 * Medido: el resumen siguiente trae «SU PAGO EN USD» por 29,95 y ese mismo día la cuenta corriente
 * tiene un «Pago Visa Empresa» **aparte** de **$43.128,00** (el de pesos es otro). Usuario: *«si debitó en
 * pesos, hay que tomar el TC real que se convirtió, que debería ser equivalente con el débito en sí»*.
 * → **TC = débito en pesos ÷ USD pagados** (1.440,00), y cada consumo vale USD × TC.
 *
 * 🔑 El débito del pago en USD se reconoce por descarte: mismo día que el «SU PAGO EN USD», un débito
 * de tarjeta que **no** es el del pago en pesos. Si hay más de uno (o ninguno), no se adivina: se avisa.
 * El último consumo absorbe el redondeo, así la suma da **exactamente** el débito (el mismo número por
 * dos caminos).
 *
 * Lógica pura, probada en `lib/pruebas/casos.ts`.
 */
import type { DebitoCtaCte } from './pago-tarjeta'

export interface ConsumoUsd { id: string; usd: number }

export type ResultadoUsd =
  | { ok: true; tc: number; debito: DebitoCtaCte; pesos: { id: string; pesos: number }[] }
  | { ok: false; aviso: string }

const r2 = (n: number) => Math.round(n * 100) / 100

export function pesosDeConsumosUsd(entrada: {
  consumos: ConsumoUsd[]
  /** Los USD que dice el «SU PAGO EN USD» del resumen siguiente. */
  usdPagado: number
  /** La fecha de ese «SU PAGO EN USD». */
  fechaPago: string
  /** Lo que se pagó en pesos ese día (el «SU PAGO EN PESOS»), para descartar ese débito. */
  pesosPagados: number
  debitos: DebitoCtaCte[]
}): ResultadoUsd {
  const { consumos, usdPagado, fechaPago, pesosPagados, debitos } = entrada
  if (!consumos.length) return { ok: false, aviso: 'No hay consumos en dólares en este resumen.' }
  if (!(usdPagado > 0)) return { ok: false, aviso: 'El resumen siguiente no trae «SU PAGO EN USD»: todavía no se sabe a qué cambio se pagó.' }
  const delDia = debitos.filter(d => d.fecha === fechaPago && Math.abs(d.debitos - pesosPagados) > 1)
  if (delDia.length !== 1) {
    return { ok: false, aviso: delDia.length
      ? `Hay ${delDia.length} débitos de tarjeta el ${fechaPago} además del pago en pesos: no se puede saber cuál pagó los dólares.`
      : `No aparece en la cuenta corriente el débito del pago en dólares del ${fechaPago}.` }
  }
  const debito = delDia[0]
  const tc = debito.debitos / usdPagado
  const totalUsd = consumos.reduce((a, c) => a + c.usd, 0)
  const pesos = consumos.map(c => ({ id: c.id, pesos: r2(c.usd * tc) }))
  // Si los dólares pagados son los de estos consumos, el último absorbe el redondeo: la suma = el débito.
  if (Math.abs(totalUsd - usdPagado) < 0.005) {
    const resto = r2(debito.debitos - pesos.slice(0, -1).reduce((a, p) => a + p.pesos, 0))
    pesos[pesos.length - 1].pesos = resto
  }
  return { ok: true, tc: r2(tc), debito, pesos }
}

/**
 * 💵 **A-FEAT-1312 — lo que se guarda en la CUOTA de un consumo en USD** (el extracto queda en dólares).
 * El TC es el de esa cuota (pesos ÷ USD, 4 decimales), así `monto_usd × tipo_cambio` da su `monto` también
 * en la que absorbió el redondeo del débito.
 */
export function cuotaDeConsumoUsd(pesos: number, usd: number) {
  return { monto: pesos, monto_usd: usd, tipo_cambio: usd > 0 ? Math.round((pesos / usd) * 10000) / 10000 : null }
}
