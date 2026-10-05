/**
 * 💵 **Facturas en DÓLARES contra pagos en PESOS** — A-BUG-1236 (2026-10-02).
 *
 * La convención es la del Cash Flow (`useMultiCashFlowData`, `mapearFacturasArca`), y acá se escribe
 * una sola vez para que el asistente de vinculación la respete:
 *   · En una factura en moneda extranjera, `imp_total` y **`monto_a_abonar` están en ESA moneda**.
 *   · Se pasan a pesos con el **TC del pago** (`tc_pago`); si todavía no hay, con el de la factura
 *     (`tipo_cambio`) — que es sólo el default: el usuario lo corrige (A-TEST-141: *«convertido a
 *     pesos con ese TC, no con el tipo de cambio de la factura»*).
 *
 * 🧨 **El caso que lo destapó**: el echeq de Genta pagó la FC 2014 de Almacén Veterinario, que es
 * **USD 3.213,58** (× 1.390 = $4.466.876,20). El asistente comparaba los $4.466.876,20 del pago contra
 * «3.213,58» como si fueran pesos, y después guardó **pesos** (4.466.876,20) en el saldo en dólares
 * de la factura.
 */

const r2 = (n: number) => Math.round(n * 100) / 100

export function esMonedaExtranjera(moneda: string | null | undefined): boolean {
  return !!moneda && moneda !== 'PES' && moneda !== 'ARS'
}

/** El TC con que se pasa la factura a pesos: el del pago; si no hay, el de la factura. En pesos, 1. */
export function tcDeFactura(f: { moneda?: string | null; tc_pago?: number | string | null; tipo_cambio?: number | string | null }): number {
  if (!esMonedaExtranjera(f.moneda)) return 1
  return Number(f.tc_pago) || Number(f.tipo_cambio) || 1
}

export interface EntradaVinculacionPago {
  /** El pago a cuenta, en pesos. */
  anticipoMonto: number
  sicoreAnticipo: number
  descuento: number
  /** La factura, en SU moneda. */
  imp_total: number
  monto_a_abonar: number
  moneda: string | null | undefined
  /** TC del pago (sólo cuenta en moneda extranjera). */
  tc: number
  /** true = se trabaja sobre el saldo (la factura ya tiene SICORE propio, o es una venta). */
  sobreSaldo: boolean
}

export interface CalculoVinculacionPago {
  cubierto: boolean
  /** Lo que queda por pagar, en PESOS (para mostrar). */
  saldoPesos: number
  /** Lo que el pago cancela, en pesos. */
  netoPagadoPesos: number
  esExtranjera: boolean
  tc: number
  /** La factura en pesos: total y lo que tenía por pagar antes de este pago. */
  totalPesos: number
  aPagarPesos: number
  /** Lo que se GUARDA en `monto_a_abonar`, en la moneda de la factura (USD si es en dólares). */
  montoAAbonarSiCubre: number
  montoAAbonarSiQueda: number
}

/**
 * La cuenta del asistente, con la moneda en cuenta. Para una factura en pesos da exactamente lo
 * mismo que antes (tc = 1); para una en dólares compara en pesos y guarda en dólares.
 */
export function calcularVinculacionPago(e: EntradaVinculacionPago): CalculoVinculacionPago {
  const esExtranjera = esMonedaExtranjera(e.moneda)
  const tc = esExtranjera ? (Number(e.tc) || 1) : 1
  const totalPesos = r2((Number(e.imp_total) || 0) * tc)
  const aPagarPesos = r2((Number(e.monto_a_abonar) || 0) * tc)
  const neto = r2(e.anticipoMonto - (e.sicoreAnticipo || 0) - (e.descuento || 0))
  let cubierto: boolean
  let saldo: number
  if (e.sobreSaldo) {
    cubierto = e.anticipoMonto >= aPagarPesos - 0.01
    saldo = cubierto ? 0 : aPagarPesos - e.anticipoMonto - (e.descuento || 0)
  } else {
    cubierto = e.anticipoMonto >= totalPesos - 0.01
    saldo = cubierto ? 0 : totalPesos - e.anticipoMonto - (e.sicoreAnticipo || 0) - (e.descuento || 0)
  }
  const saldoPesos = r2(Math.max(0, saldo))
  return {
    cubierto, saldoPesos, netoPagadoPesos: neto, esExtranjera, tc, totalPesos, aPagarPesos,
    montoAAbonarSiCubre: esExtranjera ? r2(neto / tc) : neto,
    montoAAbonarSiQueda: esExtranjera ? r2(saldoPesos / tc) : saldoPesos,
  }
}

/** Una factura tal como la traen el Cash Flow, el lote de Galicia y el detalle de pago. */
export interface FacturaConMoneda {
  moneda?: string | null
  tc_pago?: number | string | null
  tipo_cambio?: number | string | null
  imp_total?: number | string | null
  monto_a_abonar?: number | string | null
  monto_sicore?: number | string | null
  descuento_aplicado?: number | string | null
}

/**
 * 💵 **Lo que se TRANSFIERE, en pesos** — A-BUG-1245 (2026-10-05).
 *
 * 🧨 El caso: Agro Centros, FC USD 4.635,54 a TC 1.520 con retención de $111.983,01. El Cash Flow
 * decía **$6.934.037,79** (bien) pero el **lote de Galicia** decía **$4.561,87** —el saldo en
 * DÓLARES tomado como pesos— y el Detalle de pago mezclaba las dos monedas.
 *
 * En moneda extranjera la cuenta exacta es `total × TC − retención − descuento` (la retención y el
 * descuento ya están en pesos). Reconvertir `monto_a_abonar` (USD redondeado a 2 decimales) da
 * centavos de más ($4,61 en el caso testigo), así que se usa la exacta **siempre que el saldo
 * guardado coincida** con ella; si no coincide —hubo un pago a cuenta que bajó el saldo—, manda el
 * saldo guardado.
 */
export function aPagarEnPesos(f: FacturaConMoneda): number {
  const aAbonar = Number(f.monto_a_abonar ?? f.imp_total) || 0
  if (!esMonedaExtranjera(f.moneda)) return aAbonar
  const tc = tcDeFactura(f)
  const exacto = r2((Number(f.imp_total) || 0) * tc - (Number(f.monto_sicore) || 0) - (Number(f.descuento_aplicado) || 0))
  const viaSaldo = r2(aAbonar * tc)
  return Math.abs(exacto - viaSaldo) <= tc * 0.01 ? exacto : viaSaldo
}

/** El total de la factura en pesos (al TC del pago). */
export function totalEnPesos(f: FacturaConMoneda): number {
  return r2((Number(f.imp_total) || 0) * tcDeFactura(f))
}

/** Para mostrar la conversión en el detalle de pago (PDF y mail). `null` si la factura es en pesos. */
export interface ConversionMoneda {
  moneda: string
  tc: number
  totalOrig: number
  aPagarOrig: number
}

export function conversionDe(f: FacturaConMoneda): ConversionMoneda | null {
  if (!esMonedaExtranjera(f.moneda)) return null
  return {
    moneda: String(f.moneda),
    tc: tcDeFactura(f),
    totalOrig: Number(f.imp_total) || 0,
    aPagarOrig: Number(f.monto_a_abonar ?? f.imp_total) || 0,
  }
}

const nf = (n: number, d = 2) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d })

/**
 * El renglón que explica la conversión — **el mismo texto en el PDF y en el mail**.
 * Ej.: «FC 6447 en USD 4.635,54 · TC del pago 1.520,00 = $7.046.020,80».
 * ⚠️ Sin «→»: no existe en la fuente del PDF (WinAnsi) y rompe la línea entera (como el «⚠», A-BUG-150).
 */
export function textoConversion(items: Array<{ comprobante: string; conversion?: ConversionMoneda | null }>): string[] {
  return items
    .filter(i => i.conversion)
    .map(i => {
      const c = i.conversion!
      return `${i.comprobante} en ${c.moneda} ${nf(c.totalOrig)} · TC del pago ${nf(c.tc)} = $${nf(r2(c.totalOrig * c.tc))}`
    })
}
