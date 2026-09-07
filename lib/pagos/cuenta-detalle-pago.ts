/**
 * 🧮 La CUENTA del mail de Detalle de pago — lógica pura, sin base de datos.
 *
 * ## Por qué está separada
 * Acá vivían **tres bugs** (`A-BUG-102/104/105`) enterrados adentro de `encolarMailDetalle`, que
 * consulta Supabase y arma un PDF: para probarlos había que hablar con la base. Separada, se puede
 * verificar con números escritos a mano — que es lo que un cálculo necesita.
 *
 * 🔴 **Y lo que se calcula acá sale de la empresa**: es lo que un proveedor lee y con lo que concilia
 * su cuenta corriente. Un error no queda adentro.
 *
 * ## La identidad que tiene que cerrar
 * ```
 * suma(medios) + retención + descuento = importe de la(s) factura(s)
 * ```
 * La **retención suma** aunque se le muestre al proveedor en negativo: él no la cobra, pero **le
 * cancela deuda igual** porque va a AFIP a su nombre. Lo mismo el descuento.
 *
 * ⚠️ **Si no cierra, avisa — no bloquea.** Corrección del usuario: *«puede ser que se haya pagado de
 * más o de menos a propósito»*. Un bloqueo duro convertiría una decisión suya en un error del
 * sistema; salir en silencio deja que el error llegue al proveedor. Se pregunta una vez.
 */

import type { MedioPago } from "./medios-pago"

export interface ItemPago {
  comprobante: string
  imp_total: number
  monto_sicore?: number | null
  descuento_aplicado?: number | null
  monto_a_abonar: number
  /** `ARCA` | `ANTICIPO` | `TEMPLATE`. Un ANTICIPO **no es una factura**: es un medio de pago. */
  origen?: string
}

export interface Cuenta {
  /** Los ítems que forman el bruto: **sin los anticipos** cuando hay alguna factura. */
  itemsBruto: ItemPago[]
  bruto: number
  retencion: number
  descuento: number
  /** Suma de `monto_a_abonar`. Sólo se usa cuando no hay desglose de medios. */
  pagado: number
  sumaMedios: number
  /** `medios + retención + descuento` — lo que efectivamente salda la factura. */
  totalCancelado: number
  /** `bruto − totalCancelado`. **>0** quedó saldo · **<0** se pagó de más. */
  dif: number
  /** ¿La diferencia supera la tolerancia de $1 por redondeo? */
  desviado: boolean
  rotuloBruto: string
}

export const money = (n: number) => `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`

export const esAnticipo = (i: ItemPago) => i.origen === "ANTICIPO"

/**
 * La cuenta del pago.
 *
 * 🐞 **A-BUG-105** — un anticipo aplicado a una factura **no es otra factura**: es un MEDIO de pago
 * de ella, y sumarlo al bruto lo contaba dos veces. El mail con la FC y el anticipo juntos decía
 * *«Importe facturas: $6.008.000»* cuando la factura era de $3.554.000. Por eso, **si hay al menos
 * una factura, los anticipos salen del bruto**; si el mail va sólo por anticipos, ellos son el bruto.
 */
export function calcularCuenta(items: ItemPago[], medios: MedioPago[], tipo: "arca" | "template"): Cuenta {
  const hayFactura = items.some(i => !esAnticipo(i))
  const itemsBruto = hayFactura ? items.filter(i => !esAnticipo(i)) : items

  const bruto = itemsBruto.reduce((s, i) => s + (i.imp_total || 0), 0)
  const retencion = itemsBruto.reduce((s, i) => s + (i.monto_sicore || 0), 0)
  const descuento = itemsBruto.reduce((s, i) => s + (i.descuento_aplicado || 0), 0)
  const pagado = items.reduce((s, i) => s + (i.monto_a_abonar || 0), 0)

  const sumaMedios = medios.reduce((s, md) => s + (md.monto || 0), 0)
  const totalCancelado = sumaMedios + retencion + descuento
  const dif = bruto - totalCancelado

  return {
    itemsBruto, bruto, retencion, descuento, pagado, sumaMedios, totalCancelado, dif,
    // Tolerancia $1: los emisores redondean, y un centavo no es un problema a resolver.
    desviado: medios.length > 0 && Math.abs(dif) > 1,
    // Un ANTICIPO no tiene facturas: decir «Importe facturas» en un mail al proveedor confunde.
    rotuloBruto: tipo === "arca" ? "Importe facturas" : "Importe",
  }
}

/** El aviso cuando la cuenta no cierra. Trae el número **y qué puede significar**, no sólo que falló. */
export function textoDesvio(c: Cuenta, medios: MedioPago[], proveedor: string): string {
  const detalle = medios.map(md => `${md.detalle || md.tipo} ${money(md.monto)}`).join(" + ")
  return `${proveedor}: la cuenta no cierra por ${money(Math.abs(c.dif))}.\n\n`
    + `${c.rotuloBruto}: ${money(c.bruto)}\nMedios: ${detalle}`
    + `${c.retencion > 0 ? `\nRetención: ${money(c.retencion)}` : ""}`
    + `${c.descuento > 0 ? `\nDescuento: ${money(c.descuento)}` : ""}`
    + `\nTotal cancelado: ${money(c.totalCancelado)}\n\n`
    + (c.dif > 0
      ? `Queda un saldo de ${money(c.dif)}. Puede ser a propósito (pago parcial) o puede faltar registrar un medio: un echeq sin cargar, una transferencia sin vincular.`
      : `Se pagó ${money(-c.dif)} de más. Puede ser a propósito (pago a cuenta) o algo está contado dos veces.`)
}

/** El desglose que ve el proveedor. Cierra en **Total cancelado**, y dice el saldo si lo hay. */
export function armarDesglose(c: Cuenta, medios: MedioPago[]): string {
  if (medios.length === 0) {
    // Sin desglose de medios no se puede afirmar cómo se pagó: se dice el total y listo.
    if (c.retencion <= 0 && c.descuento <= 0) return `\nTotal transferido: ${money(c.pagado)}`
    let t = `\n${c.rotuloBruto}: ${money(c.bruto)}`
    if (c.retencion > 0) t += `\nRetención Ganancias: -${money(c.retencion)}`
    if (c.descuento > 0) t += `\nDescuento: -${money(c.descuento)}`
    return t + `\nTotal transferido: ${money(c.pagado)}`
  }
  let t = `\n${c.rotuloBruto}: ${money(c.bruto)}`
  for (const md of medios) t += `\n${md.detalle || md.tipo}: ${money(md.monto)}`
  if (c.retencion > 0) t += `\nRetención Ganancias: -${money(c.retencion)}`
  if (c.descuento > 0) t += `\nDescuento: -${money(c.descuento)}`
  t += `\nTotal cancelado: ${money(c.totalCancelado)}`
  // Que el proveedor lo lea acá es mejor que se entere al conciliar su cuenta corriente.
  if (c.dif > 1) t += `\nSaldo pendiente: ${money(c.dif)}`
  else if (c.dif < -1) t += `\nPagado a cuenta: ${money(-c.dif)}`
  return t
}

/**
 * El renglón de cierre del mail.
 *
 * 🐞 **A-BUG-102** — el aviso del banco es de **transferencias**. Prometérselo a alguien a quien se
 * le libró un **echeq** lo deja esperando una acreditación que no va a llegar.
 */
export function textoCierre(medios: MedioPago[]): string {
  const hayTransfer = medios.length === 0 || medios.some(md => md.tipo === "transferencia" || md.tipo === "anticipo")
  if (hayTransfer) {
    return '\n\nLes llegará el comprobante de transferencia desde go@bancogalicia.com.ar con asunto "Aviso de transferencia".'
  }
  return medios.some(md => md.tipo === "echeq")
    ? "\n\nEl echeq queda a disposición en su cuenta según la fecha de cobro indicada."
    : ""
}
