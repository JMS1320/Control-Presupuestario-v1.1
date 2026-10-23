/**
 * ✓ **A-BUG-1306 — conciliar es escribir en DOS lados: el movimiento y su origen.**
 *
 * Cuando un movimiento pasa a «conciliado», lo que tiene atado (la factura, la cuota del template o
 * el pago de sueldo) tiene que pasar también. Si queda sólo el movimiento, la misma plata figura
 * conciliada en el extracto y **sin pagar** del otro lado.
 *
 * 🧨 Caso que la originó (2026-10-20): el «✓ OK» de auditar cambiaba sólo el movimiento. En la
 * tarjeta VISA MSA quedaron **21 facturas** en «crédito»/«anterior», sin fecha de pago, con su
 * movimiento ya conciliado. Y el pase masivo a conciliado escribía la factura siempre en MSA, así
 * que una de PAM o MA quedaba igual.
 *
 * Esta función es la segunda mitad, para todos los caminos que confirman un movimiento ya atado:
 * el «✓ OK» de cada fila, el OK masivo de auditar y la edición masiva con estado Conciliado.
 * - La factura se busca **en el schema de su empresa** (puede no ser la de la cuenta).
 * - La fecha de pago es la del movimiento — **completa, no pisa** (A-BUG-191).
 * - Un pago de sueldo agrupado concilia todo el grupo (A-BUG-176).
 * - **No toca detalle, cuenta ni códigos**: eso ya lo escribió quien vinculó.
 */
import { completarFechaPago } from './fecha-pago'

type Cliente = { schema: (s: string) => any; from: (t: string) => any }

export const SCHEMAS_FACTURA = ['msa', 'pam', 'ma'] as const

export interface MovimientoAtado {
  fecha: string
  comprobante_arca_id?: string | null
  template_cuota_id?: string | null
  sueldo_pago_id?: string | null
}

export interface ResultadoOrigen {
  /** schema donde quedó conciliada la factura; null si no tenía; 'no-encontrada' si no apareció */
  factura: string | null
  cuota: boolean
  sueldo: boolean
  /** lo que no se pudo escribir — se muestra, no se calla */
  avisos: string[]
}

/** En qué schema vive una factura (msa / pam / ma), o null si no está en ninguno. */
export async function schemaDeFactura(cliente: Cliente, facturaId: string): Promise<string | null> {
  for (const s of SCHEMAS_FACTURA) {
    const { data } = await cliente.schema(s).from('comprobantes_arca').select('id').eq('id', facturaId).maybeSingle()
    if (data) return s
  }
  return null
}

export async function conciliarOrigenDelMovimiento(cliente: Cliente, mov: MovimientoAtado): Promise<ResultadoOrigen> {
  const r: ResultadoOrigen = { factura: null, cuota: false, sueldo: false, avisos: [] }

  if (mov.comprobante_arca_id) {
    const schema = await schemaDeFactura(cliente, mov.comprobante_arca_id)
    if (!schema) {
      r.factura = 'no-encontrada'
      r.avisos.push('la factura atada no se encontró en ninguna empresa')
    } else {
      const { error } = await cliente.schema(schema).from('comprobantes_arca')
        .update({ estado: 'conciliado' }).eq('id', mov.comprobante_arca_id)
      if (error) r.avisos.push(`la factura no pasó a conciliada: ${error.message}`)
      else {
        r.factura = schema
        await completarFechaPago(cliente, schema, [mov.comprobante_arca_id], mov.fecha)
      }
    }
  }

  if (mov.template_cuota_id) {
    const { error } = await cliente.from('cuotas_egresos_sin_factura')
      .update({ estado: 'conciliado' }).eq('id', mov.template_cuota_id)
    if (error) r.avisos.push(`la cuota no pasó a conciliada: ${error.message}`)
    else r.cuota = true
  }

  if (mov.sueldo_pago_id) {
    const { data: pago } = await cliente.from('sueldos_pagos').select('id, grupo_pago_id').eq('id', mov.sueldo_pago_id).maybeSingle()
    const q = cliente.from('sueldos_pagos').update({ estado: 'conciliado' })
    const { error } = pago?.grupo_pago_id ? await q.eq('grupo_pago_id', pago.grupo_pago_id) : await q.eq('id', mov.sueldo_pago_id)
    if (error) r.avisos.push(`el pago de sueldo no pasó a conciliado: ${error.message}`)
    else r.sueldo = true
  }

  return r
}
