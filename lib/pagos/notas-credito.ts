/**
 * 🧾 **Notas de crédito contra facturas — la DETECCIÓN, separada de la ejecución.**
 *
 * Pedido del usuario 2026-09-29:
 * > *«Tenemos que ver el enlace de cómo cancelar notas de crédito contra facturas. Lo tenemos
 * > desarrollado desde egresos / facturas / pagos. Para cash flow hasta podría haber un alert de
 * > si hay FC con NC equivalentes proponga cancelarlas con la función existente.»*
 *
 * ## Qué hay acá y qué NO
 *
 * Acá está **sólo la pregunta**: *«de estos comprobantes, ¿qué proveedor tiene facturas por pagar
 * y notas de crédito sin aplicar al mismo tiempo?»*. Es una función pura: entran comprobantes,
 * sale una lista. No toca la base, no cambia estados, no abre modales.
 *
 * **La EJECUCIÓN sigue donde está** — el modal de cancelación de «vista-facturas-arca», que ya
 * sabe aplicar una NC contra una FC en los dos sentidos. Este módulo no la copia ni la reemplaza.
 *
 * 🛑 **Y ésa es la decisión de diseño entera.** Lo fácil era escribir la detección de nuevo adentro
 * del Cash Flow: son treinta líneas. Pero entonces habría **dos lugares** que deciden qué NC
 * corresponde a qué FC, y el día que cambie el criterio —que va a cambiar: hoy es sólo el CUIT—
 * uno de los dos se va a quedar viejo **sin que nada lo señale**. Es § 🗺️ *«se arregló un camino
 * de los dos»* esperando a pasar. Por eso la detección se saca de la pantalla y se pone acá, donde
 * la pueden usar las dos.
 *
 * ## ⚠️ El criterio de hoy es el CUIT, y hay que saberlo
 *
 * Una NC se considera aplicable a una FC **porque son del mismo proveedor**, y nada más. No se
 * mira el número de comprobante asociado, ni la fecha, ni el importe. Es el criterio que ya usaba
 * la pantalla de Pagos y **se respeta a propósito**: cambiarlo de paso, mientras se mueve de lugar,
 * haría que el aviso nuevo y el flujo viejo propusieran cosas distintas.
 *
 * Por eso esto **propone, no decide**: la plata la aplica el usuario eligiendo en el modal.
 */

/**
 * Códigos de tipo de comprobante de ARCA.
 *
 * 🔁 **Esta lista estaba escrita a mano en SIETE lugares** (Facturas ARCA tres veces, el Cash
 * Flow, Liquidaciones, y los dos importadores). Siete copias de la misma verdad es una copia
 * que algún día se queda vieja. Acá están una vez.
 *
 * Los rangos son los de ARCA: 1-13 comprobantes clase A/B/C, 51-53 clase M, 201-213 los de
 * crédito electrónico MiPyME (FCE).
 */
export const CODIGOS_COMPROBANTE = {
  factura: [1, 6, 11, 51, 201, 206, 211],
  notaDebito: [2, 7, 12, 52, 202, 207, 212],
  notaCredito: [3, 8, 13, 53, 203, 208, 213],
} as const

/** ¿Es una nota de crédito? Se pregunta por el código de ARCA, no por el signo del importe. */
export function esNotaCredito(tipoComprobante: number | null | undefined): boolean {
  return tipoComprobante != null && CODIGOS_COMPROBANTE.notaCredito.includes(tipoComprobante as never)
}

/** ¿Es una nota de débito? */
export function esNotaDebito(tipoComprobante: number | null | undefined): boolean {
  return tipoComprobante != null && CODIGOS_COMPROBANTE.notaDebito.includes(tipoComprobante as never)
}

/**
 * Abreviatura para mostrar: `FC` · `ND` · `NC`.
 *
 * ⚠️ **Un código desconocido cae en `FC`**, que es lo que hacía el código anterior y se mantiene
 * para no cambiar lo que ve el usuario al mover esto de lugar. No es lo ideal —un comprobante
 * raro se muestra como factura— pero cambiarlo acá, de paso, mezclaría dos cosas.
 */
export function abreviaturaComprobante(tipoComprobante: number | null | undefined): "FC" | "ND" | "NC" {
  if (esNotaCredito(tipoComprobante)) return "NC"
  if (esNotaDebito(tipoComprobante)) return "ND"
  return "FC"
}

/** Lo mínimo que hace falta saber de un comprobante para decidir si hay algo que proponer. */
export interface ComprobanteParaNC {
  id: string
  cuit: string
  /** Como se muestra: «FC - 00001234». Se usa tal cual en el aviso. */
  display: string
  proveedor: string
  tipoComprobante: number | null | undefined
  estado: string | null | undefined
  /** Importe del comprobante. En una NC puede venir negativo; el aviso lo muestra en absoluto. */
  importe: number
}

/** Un proveedor que tiene las dos puntas: facturas por pagar y notas de crédito sin aplicar. */
export interface ProveedorConNC {
  cuit: string
  proveedor: string
  facturas: ComprobanteParaNC[]
  notasCredito: ComprobanteParaNC[]
  /** Suma de las facturas por pagar. */
  totalFacturas: number
  /** Suma de las NC, **en positivo**: es lo que hay para descontar. */
  totalNotasCredito: number
  /**
   * Lo que quedaría a pagar si se aplicaran todas las NC.
   *
   * 🔑 **Puede dar negativo, y eso NO es un error**: significa que el proveedor debe más de lo que
   * se le está por pagar. Se muestra tal cual — § 🧮: el número raro es justamente el que hay que
   * ver, no el que hay que esconder.
   */
  saldo: number
}

/** Los estados en los que un comprobante todavía no se pagó y por lo tanto se le puede aplicar una NC. */
const ESTADOS_PENDIENTES = ["pendiente", "pagar", "preparado", "programado"]

function estaPendiente(estado: string | null | undefined): boolean {
  return ESTADOS_PENDIENTES.includes((estado || "pendiente").toLowerCase())
}

/**
 * Encuentra los proveedores que tienen **facturas por pagar y notas de crédito sin aplicar** a la vez.
 *
 * Es la pregunta que el aviso del Cash Flow tiene que contestar. Se le pasa todo lo que la pantalla
 * ya tiene cargado y devuelve sólo los casos donde hay algo que proponer.
 *
 * @param comprobantes  todo lo que la pantalla tiene a la vista, FC y NC mezcladas
 * @returns  un elemento por proveedor, ordenado por **lo que hay para descontar**, de mayor a menor:
 *           el proveedor con $2 M de notas de crédito importa más que el de $3.000
 */
export function detectarProveedoresConNC(
  comprobantes: ComprobanteParaNC[],
  /**
   * `incluirSinFacturas` (A-FEAT-1232, 2026-10-03): el cartel del Cash Flow muestra TODAS las notas
   * de crédito pendientes —también las que no tienen factura para cancelar, que pueden ir contra
   * descuentos—. Sin el parámetro, la cuenta de siempre (sólo las dos puntas): la usa el script.
   */
  opciones: { incluirSinFacturas?: boolean } = {},
): ProveedorConNC[] {
  const porCuit = new Map<string, { facturas: ComprobanteParaNC[]; notasCredito: ComprobanteParaNC[]; proveedor: string }>()

  for (const c of comprobantes) {
    // ⚠️ Sin CUIT no se puede agrupar por proveedor, y agrupar por nombre es peor: el mismo
    //    proveedor viene escrito de tres formas distintas según quién lo cargó.
    if (!c.cuit) continue
    if (!estaPendiente(c.estado)) continue

    const entrada = porCuit.get(c.cuit) ?? { facturas: [], notasCredito: [], proveedor: c.proveedor }
    if (esNotaCredito(c.tipoComprobante)) entrada.notasCredito.push(c)
    else entrada.facturas.push(c)
    // El nombre que se muestra es el primero que tenga uno: los grupos a veces vienen sin nombre.
    if (!entrada.proveedor && c.proveedor) entrada.proveedor = c.proveedor
    porCuit.set(c.cuit, entrada)
  }

  const resultado: ProveedorConNC[] = []
  for (const [cuit, e] of porCuit) {
    // Hace falta que haya **las dos puntas**: una NC sola no tiene contra qué aplicarse, y una
    // factura sola no tiene nada que descontar. Avisar de una sola punta sería ruido.
    if (e.notasCredito.length === 0) continue
    if (e.facturas.length === 0 && !opciones.incluirSinFacturas) continue

    const totalFacturas = redondear(e.facturas.reduce((s, f) => s + Math.abs(f.importe), 0))
    const totalNotasCredito = redondear(e.notasCredito.reduce((s, n) => s + Math.abs(n.importe), 0))
    resultado.push({
      cuit,
      proveedor: e.proveedor || cuit,
      facturas: e.facturas,
      notasCredito: e.notasCredito,
      totalFacturas,
      totalNotasCredito,
      saldo: redondear(totalFacturas - totalNotasCredito),
    })
  }

  return resultado.sort((a, b) => b.totalNotasCredito - a.totalNotasCredito)
}

/** Dos decimales. Sumar pesos en punto flotante deja colas de centavo que después no cierran. */
function redondear(n: number): number {
  return Math.round(n * 100) / 100
}
