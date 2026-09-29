/**
 * 💳 **CUENTAS A PAGAR y CUENTAS A COBRAR al cierre — papeles 03 y 04.**
 *
 * Pedido del usuario 2026-09-29, revisando qué faltaba del export:
 * > *«En función de los ítems que aún no desarrollaste, debés desarrollar todos los que estén a tu
 * > alcance. **Ejemplo cuentas a pagar y cobrar, ¿lo hiciste? Eso es súper básico.**»*
 *
 * Tenía razón: estaban en su carpeta `- Enviados/` de papeles del balance anterior y yo no los había
 * mirado. Son los papeles **«03 - CUENTAS A COBRAR»** y **«04 - CUENTAS A PAGAR»**, con el mismo
 * formato de fila del libro de IVA (fecha, tipo, punto de venta, número, CUIT, denominación y la
 * apertura de importes) más su TOTAL.
 *
 * ## 🔑 EL PUNTO ENTERO: el estado de HOY no sirve
 *
 * Una factura que **hoy** figura como pagada pudo haberse pagado **después del cierre** — y entonces
 * al 30/06 era una deuda, y va al papel. Mirar `estado` contesta *«¿está paga ahora?»*, que es otra
 * pregunta.
 *
 * 🧨 **Y no es teórico: medido sobre el ejercicio 25/26 de MSA, 4 facturas conciliadas se pagaron
 * después del 30/06.** Con el criterio ingenuo desaparecían del papel.
 *
 * Entonces la pregunta correcta es **¿cuándo se pagó?**, y se contesta con dos datos, en este orden:
 *
 * 1. **`fecha_pago`** del comprobante, si la tiene.
 * 2. **La fecha del movimiento bancario** al que está conciliado. Es el dato bueno: es el banco
 *    diciendo cuándo salió la plata, no alguien declarándolo.
 *
 * ## ⚠️ Y el tercer caso, que es el que hay que mostrar y no esconder
 *
 * Hay comprobantes marcados **conciliados que no tienen ninguno de los dos datos**: ni fecha de pago
 * ni movimiento bancario enganchado. **Sobre el 25/26 de MSA son 46, por $6.368.187,17.**
 *
 * De ésos **no se puede afirmar nada**: ni que estaban pagos al cierre ni que no. Van a una lista
 * aparte, `sinDatoDePago`, con su total — § 🧮 *nada se descarta en silencio*. Meterlos en el papel
 * sería inventar una deuda; dejarlos afuera sin decirlo sería esconderla. Se dicen.
 *
 * ## 📌 Lo que este módulo NO cubre todavía
 *
 * El papel 04 del usuario tiene además **cheques dados** (emitidos y no debitados al cierre) y
 * **anticipos a proveedores**; el 03 tiene **cheques en cartera** y **provisión de cobros**. Están
 * identificados y quedan registrados aparte — ver [A-FEAT-1195]. Acá está el cuerpo principal, que
 * es el listado de comprobantes impagos, y es el que mueve el número grande.
 */
import type { AsientoLibroDiario } from "./libro-diario"

/** Cómo se supo (o no) cuándo se pagó un comprobante. */
export type OrigenFechaPago =
  /** Lo dice el comprobante. */
  | "fecha_pago"
  /** Lo dice el banco: está conciliado contra un movimiento con fecha. Es el dato bueno. */
  | "movimiento bancario"
  /** No hay ninguno de los dos. */
  | "sin dato"

/** Un comprobante del ejercicio con lo que se sabe de su pago. */
export interface ComprobanteConPago {
  asiento: AsientoLibroDiario
  estado: string
  /** `fecha_pago` del comprobante, o la del movimiento bancario conciliado. `null` si no hay. */
  fechaPago: string | null
  origenFecha: OrigenFechaPago
}

/** Por qué un comprobante quedó (o no) en el papel. Se muestra: el criterio tiene que ser auditable. */
export type MotivoCuenta =
  | "no se pagó nunca"
  | "se pagó DESPUÉS del cierre"
  | "conciliado, pero sin saber cuándo"

export interface FilaCuenta {
  asiento: AsientoLibroDiario
  estado: string
  fechaPago: string | null
  motivo: MotivoCuenta
}

export interface CuentasAlCierre {
  /** Lo que se debe (o se tiene a cobrar) al cierre, con certeza. */
  filas: FilaCuenta[]
  total: number
  /**
   * Los que están marcados como cobrados/pagados pero **sin ninguna fecha**: no se puede decidir.
   * Se listan aparte con su total, nunca se descartan en silencio.
   */
  sinDatoDePago: FilaCuenta[]
  totalSinDato: number
  /** Cuántos se pagaron después del cierre — el caso que el criterio ingenuo perdía. */
  pagadosDespues: number
  /** Total de comprobantes mirados, para poder cerrar contra el libro. */
  mirados: number
}

/**
 * Los estados que significan **«esto no se pagó»**, y valen sólo cuando no hay ninguna fecha.
 *
 * ⚠️ `anterior` NO está: marca un comprobante de un ejercicio previo y su deuda, si la hay, es de
 * aquel balance, no de éste. Meterlo acá duplicaría la deuda entre dos ejercicios.
 */
const ESTADOS_IMPAGOS = ["pendiente", "pagar", "preparado", "programado", "echeq", "cuotas"]

/** Los estados que afirman que se pagó. Sin fecha, esa afirmación no se puede ubicar en el tiempo. */
const ESTADOS_PAGADOS = ["pagado", "conciliado"]

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Arma el papel de cuentas a pagar (o a cobrar: es el mismo cálculo del otro lado del mostrador).
 *
 * @param comprobantes  los del ejercicio, con lo que se sabe de su pago
 * @param fechaCierre   `AAAA-MM-DD`. Se compara como texto, que en ISO ordena igual que la fecha
 */
export function armarCuentasAlCierre(
  comprobantes: ComprobanteConPago[],
  fechaCierre: string,
): CuentasAlCierre {
  const filas: FilaCuenta[] = []
  const sinDatoDePago: FilaCuenta[] = []
  let pagadosDespues = 0

  for (const c of comprobantes) {
    const estado = (c.estado || "pendiente").toLowerCase()
    const base = { asiento: c.asiento, estado, fechaPago: c.fechaPago }

    if (c.fechaPago) {
      // Hay fecha: la pregunta se contesta sola y no depende del estado de hoy.
      if (c.fechaPago <= fechaCierre) continue          // pagado al cierre: no es deuda
      filas.push({ ...base, motivo: "se pagó DESPUÉS del cierre" })
      pagadosDespues += 1
      continue
    }

    // Sin fecha, manda el estado — y sólo alcanza para uno de los dos lados.
    if (ESTADOS_IMPAGOS.includes(estado)) {
      filas.push({ ...base, motivo: "no se pagó nunca" })
      continue
    }
    if (ESTADOS_PAGADOS.includes(estado)) {
      // 🔑 Acá está el hueco honesto: dice que se pagó, pero no cuándo.
      sinDatoDePago.push({ ...base, motivo: "conciliado, pero sin saber cuándo" })
      continue
    }
    // Cualquier otro estado (`anterior`, `credito`, `debito`) no es una deuda de este ejercicio.
  }

  const sumar = (f: FilaCuenta[]) => r2(f.reduce((s, x) => s + x.asiento.total, 0))

  return {
    filas: filas.sort((a, b) =>
      (a.asiento.denominacion || "").localeCompare(b.asiento.denominacion || "", "es")),
    total: sumar(filas),
    sinDatoDePago: sinDatoDePago.sort((a, b) => Math.abs(b.asiento.total) - Math.abs(a.asiento.total)),
    totalSinDato: sumar(sinDatoDePago),
    pagadosDespues,
    mirados: comprobantes.length,
  }
}
