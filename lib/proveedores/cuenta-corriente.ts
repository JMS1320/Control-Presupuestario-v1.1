/**
 * 🧾 **A-FEAT-141 — la cuenta corriente con una contraparte. Se ARMA, no se almacena.**
 *
 * Pedido del usuario 2026-09-13: *«sería bueno tener un visualizador de cuentas corrientes. Se
 * deberían poder armar digamos, no almacenar (…) si un caso de proveedor-cliente, justamente es
 * donde lo estoy precisando. Caso ejemplo AFA»*.
 *
 * ## Por qué no se almacena
 * El saldo con alguien es **la resta de lo que facturó contra lo que se le pagó**: un derivado puro.
 * Guardarlo lo condena a envejecer en la primera factura que entre (§ `MODULO_CONCILIACION.md`
 * 30.9: *lo derivado se genera*), y en este proyecto eso ya pasó con las etiquetas de las cuotas y
 * con el total de los grupos de pago — 30 de 42 quedaron mal.
 *
 * ## El caso que la hizo falta
 * **I.C.T. NET**: un pago de **$35.497,81** el 13/03 que **no corresponde a ninguna factura** — el
 * proveedor reclamaba comprobantes viejos como impagos y se pagó para no perder el servicio. Ese
 * pago no se puede conciliar contra nada **y está bien que así sea**; lo que hace es dejar un
 * **saldo a favor**, que después se descontó: el 10/04 se pagaron **$8.990,21** de una factura de
 * **$28.602,99**.
 *
 * 🧨 **Hoy eso no se ve en ninguna pantalla.** Hay que reconstruirlo a mano, sumando facturas y
 * pagos de a uno — que es exactamente lo que esta función hace.
 *
 * ## La convención de signos, y por qué UNA sola columna de saldo
 * El usuario lo pidió para el caso **proveedor-cliente** (AFA compra y vende), donde el canal de
 * pago es *factura de venta contra factura de compra* ([A-FEAT-140](../../PENDIENTES.md#a-feat-140)).
 * Con dos saldos separados esa compensación no se ve; con uno solo, sí:
 *
 * | | Efecto | Por qué |
 * |---|---|---|
 * | factura de **compra** | **+** | le debo más |
 * | **pago** que le hice | **−** | le debo menos |
 * | factura de **venta** | **−** | él me debe: compensa |
 *
 * **Saldo positivo = le debo. Saldo negativo = tengo saldo a favor.**
 */

export interface FacturaCC {
  id: string
  fecha: string | null
  numero: string
  total: number
  tipo: 'compra' | 'venta'
  descripcion?: string | null
}

export interface PagoCC {
  id: string
  fecha: string | null
  monto: number
  descripcion?: string | null
  detalle?: string | null
  comprobantes_pagados?: string | null
}

export interface AsientoCC {
  id: string
  fecha: string
  /** `compra` suma · `pago` y `venta` restan. */
  tipo: 'compra' | 'pago' | 'venta'
  concepto: string
  /** Con signo: lo que este renglón le hace al saldo. */
  importe: number
  /** El saldo **después** de este renglón. */
  saldo: number
  /** 🔴 `true` si es un pago que no dice contra qué comprobante fue. Es la señal a mirar. */
  sinReferencia?: boolean
}

export interface ResumenCC {
  asientos: AsientoCC[]
  totalComprado: number
  totalPagado: number
  totalVendido: number
  /** El saldo final. Positivo = le debo · negativo = saldo a favor. */
  saldo: number
  /** Cuántos pagos no dicen contra qué fueron. */
  pagosSinReferencia: number
}

/**
 * Arma la cuenta corriente: un solo listado por fecha, con el saldo acumulado.
 *
 * ⚠️ **Las filas sin fecha van al principio, no se descartan.** Un comprobante sin fecha sigue
 * siendo plata; esconderlo haría que el saldo final no cierre contra la suma de las partes, y un
 * total que no cierra con su detalle es exactamente lo que hace desconfiar de una pantalla.
 */
export function armarCuentaCorriente(facturas: FacturaCC[], pagos: PagoCC[]): ResumenCC {
  const filas: AsientoCC[] = []

  for (const f of facturas) {
    const esCompra = f.tipo !== 'venta'
    filas.push({
      id: f.id,
      fecha: (f.fecha || '').slice(0, 10),
      tipo: esCompra ? 'compra' : 'venta',
      concepto: [f.numero, f.descripcion].filter(Boolean).join(' · ') || (esCompra ? 'Compra' : 'Venta'),
      importe: esCompra ? Number(f.total) || 0 : -(Number(f.total) || 0),
      saldo: 0,
    })
  }

  for (const p of pagos) {
    // Un pago "sin referencia" es el que no dice contra qué comprobante fue. Ése es el que genera
    // saldo a favor sin que nadie lo note — el caso de ICT NET del 13/03.
    const sinRef = !String(p.comprobantes_pagados ?? '').trim()
    filas.push({
      id: p.id,
      fecha: (p.fecha || '').slice(0, 10),
      tipo: 'pago',
      concepto: [p.comprobantes_pagados, p.detalle || p.descripcion].filter(Boolean).join(' · ') || 'Pago',
      importe: -(Number(p.monto) || 0),
      saldo: 0,
      ...(sinRef ? { sinReferencia: true } : {}),
    })
  }

  // Por fecha. Y a igual fecha, **primero la factura y después el pago**: es el orden en que
  // ocurren de verdad, y así el saldo intermedio no muestra un negativo que nunca existió.
  const peso = { compra: 0, venta: 0, pago: 1 } as const
  filas.sort((a, b) =>
    a.fecha === b.fecha ? peso[a.tipo] - peso[b.tipo] : a.fecha.localeCompare(b.fecha))

  let acum = 0
  for (const f of filas) {
    acum += f.importe
    f.saldo = Math.round(acum * 100) / 100
  }

  const suma = (t: AsientoCC['tipo']) =>
    Math.round(filas.filter(f => f.tipo === t).reduce((s, f) => s + Math.abs(f.importe), 0) * 100) / 100

  return {
    asientos: filas,
    totalComprado: suma('compra'),
    totalPagado: suma('pago'),
    totalVendido: suma('venta'),
    saldo: Math.round(acum * 100) / 100,
    pagosSinReferencia: filas.filter(f => f.sinReferencia).length,
  }
}

/** `le debo` / `saldo a favor` / `al día`, para no hacer interpretar un signo. */
export function leyendaSaldo(saldo: number): string {
  if (Math.abs(saldo) < 0.005) return 'Al día'
  const n = Math.abs(saldo).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return saldo > 0 ? `Le debo $${n}` : `Saldo a favor $${n}`
}
