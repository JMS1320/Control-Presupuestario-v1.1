/**
 * 🏦 **EL «EXTRACTO» DE LOS ECHEQS DE TERCEROS** — A-FEAT-1230 (2026-10-02).
 *
 * Pedido del usuario: *«crear el extracto bancario de echeqs en conciliación, así ahí figura el echeq
 * que entra con su cuenta y el echeq que sale con su cuenta… mantenemos simple el panel de gestión
 * pero la estructura de conciliación queda completa sin reducir datos»*.
 *
 * Es una cuenta más del Extracto (`msa.echeqs_terceros`, forma de caja). Cada cheque de un cliente da:
 *   · **ENTRADA** (crédito) al recibirlo — con la cuenta de la VENTA que cobró.
 *   · **SALIDA** (débito) al endosarlo — con la cuenta de la FACTURA que pagó.
 * El saldo de la cuenta es lo que hay **en cartera**. Y como tiene categoría, **va al dashboard**:
 * antes un echeq endosado no aparecía en ninguna de sus dos patas (nunca pasa por el banco).
 *
 * Las filas se **derivan** de los cheques (una por anticipo: `anticipo_id` único), así que
 * sincronizar no duplica. Lo que el usuario imputó a mano en una fila **no se pisa**.
 */

export interface ChequeParaExtracto {
  id: string
  fecha_pago: string | null
  monto: number | string
  descripcion: string | null
  nombre_proveedor: string | null
  estado_pago: string | null
  endosado_en_id: string | null
  comprobante_venta_id: string | null
}

export interface Imputacion { categ: string | null; nro_cuenta: string | null; centro_costo?: string | null; referencia?: string | null }

export interface FilaExtractoEcheq {
  anticipo_id: string
  fecha: string
  descripcion: string
  creditos: number
  debitos: number
  categ: string | null
  nro_cuenta: string | null
  centro_de_costo: string | null
  comprobante_venta_id: string | null
  comprobante_arca_id: string | null
  estado: 'conciliado' | 'pendiente'
  cuenta: 'echeqs_terceros'
  detalle: string | null
  saldo: number
}

const nroDe = (desc: string | null) => (desc || '').match(/N[º°o]\s*(\S+)/)?.[1] || ''

/**
 * Arma las filas que tiene que tener el extracto. Sólo cheques de TERCEROS (los emitidos salen de la
 * cuenta corriente). Un cheque en cartera da sólo la entrada; uno endosado, entrada y salida.
 */
export function filasExtractoEcheqs(
  cheques: ChequeParaExtracto[],
  pagos: Map<string, { id: string; fecha_pago: string | null; nombre_proveedor: string | null; factura_id: string | null }>,
  imputacionVenta: Map<string, Imputacion>,
  imputacionFactura: Map<string, Imputacion>,
): FilaExtractoEcheq[] {
  const filas: Omit<FilaExtractoEcheq, 'saldo'>[] = []
  for (const c of cheques) {
    if (c.estado_pago !== 'en_cartera' && c.estado_pago !== 'endosado') continue
    const monto = Number(c.monto) || 0
    const nro = nroDe(c.descripcion)
    const iv = c.comprobante_venta_id ? imputacionVenta.get(c.comprobante_venta_id) : undefined
    filas.push({
      anticipo_id: c.id, fecha: c.fecha_pago || '', creditos: monto, debitos: 0,
      descripcion: `Echeq${nro ? ' Nº ' + nro : ''} recibido de ${c.nombre_proveedor || 'cliente'}`,
      categ: iv?.categ ?? null, nro_cuenta: iv?.nro_cuenta ?? null, centro_de_costo: iv?.centro_costo ?? null,
      comprobante_venta_id: c.comprobante_venta_id, comprobante_arca_id: null,
      estado: iv?.categ ? 'conciliado' : 'pendiente', cuenta: 'echeqs_terceros',
      detalle: iv?.referencia ? `Cobro de ${iv.referencia}` : null,
    })
    const p = c.endosado_en_id ? pagos.get(c.endosado_en_id) : undefined
    if (c.estado_pago === 'endosado' && p) {
      const ifac = p.factura_id ? imputacionFactura.get(p.factura_id) : undefined
      filas.push({
        anticipo_id: p.id, fecha: p.fecha_pago || c.fecha_pago || '', creditos: 0, debitos: monto,
        descripcion: `Echeq${nro ? ' Nº ' + nro : ''} endosado a ${p.nombre_proveedor || 'proveedor'}`,
        categ: ifac?.categ ?? null, nro_cuenta: ifac?.nro_cuenta ?? null, centro_de_costo: ifac?.centro_costo ?? null,
        comprobante_venta_id: null, comprobante_arca_id: p.factura_id,
        estado: ifac?.categ ? 'conciliado' : 'pendiente', cuenta: 'echeqs_terceros',
        detalle: ifac?.referencia ? `Pago de ${ifac.referencia}` : null,
      })
    }
  }
  // Por fecha; el mismo día, primero lo que entra. El saldo es lo que queda en cartera.
  filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || (b.creditos - a.creditos))
  let saldo = 0
  return filas.map(f => { saldo = Math.round((saldo + f.creditos - f.debitos) * 100) / 100; return { ...f, saldo } })
}
