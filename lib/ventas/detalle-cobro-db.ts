/**
 * 💰 Lectura y escritura del DETALLE DEL COBRO — A-FEAT-1228. La cuenta vive en `detalle-cobro.ts`;
 * acá sólo se junta lo que está en la base y se escribe el vínculo de un pago a cuenta.
 *
 * ⚠️ Sólo MSA: `msa_galicia.comprobante_venta_id` y `retenciones_recibidas` existen sólo ahí
 * (ver A-FEAT-1219/1220 para PAM y MA).
 */

import type { FuentesCobro } from './detalle-cobro'

type Cliente = { from: (t: string) => any; schema: (s: string) => any }

const TIPO_CBTE: Record<number, string> = { 1: 'FC A', 6: 'FC B', 11: 'FC C', 2: 'ND A', 3: 'NC A', 180: 'liquidación' }

/** Las fuentes del detalle de cada comprobante. `comps` necesita el CUIT del cliente (para las compensaciones). */
export async function cargarFuentesCobro(
  supabase: Cliente, comps: { id: string; cuit_cliente: string | null }[],
): Promise<Map<string, FuentesCobro>> {
  const salida = new Map<string, FuentesCobro>()
  const ids = comps.map(c => c.id)
  comps.forEach(c => salida.set(c.id, { movimientos: [], anticipos: [], compensaciones: [], retenciones: [] }))
  if (!ids.length) return salida

  const [{ data: movs }, { data: ants }, { data: rets }] = await Promise.all([
    supabase.from('msa_galicia').select('id, fecha, creditos, anticipo_id, comprobante_venta_id').in('comprobante_venta_id', ids),
    supabase.from('anticipos_proveedores')
      .select('id, fecha_pago, monto, metodo_pago, estado_pago, descripcion, comprobante_venta_id')
      .eq('tipo', 'cobro').in('comprobante_venta_id', ids),
    supabase.schema('msa').from('retenciones_recibidas')
      .select('id, tipo, monto, fecha, nro_certificado, comprobante_venta_id').in('comprobante_venta_id', ids),
  ])
  for (const m of (movs || []) as any[]) salida.get(m.comprobante_venta_id)?.movimientos.push(m)
  for (const a of (ants || []) as any[]) salida.get(a.comprobante_venta_id)?.anticipos.push(a)
  for (const r of (rets || []) as any[]) salida.get(r.comprobante_venta_id)?.retenciones.push(r)

  // Compensaciones: lo que esos pagos a cuenta aplicaron a comprobantes DEL MISMO CLIENTE.
  const antIds = ((ants || []) as any[]).map(a => a.id)
  if (antIds.length) {
    const { data: apps } = await supabase.from('anticipos_facturas')
      .select('id, anticipo_id, factura_arca_id, monto_aplicado, fecha_aplicacion').in('anticipo_id', antIds)
    const facIds = [...new Set(((apps || []) as any[]).map(a => a.factura_arca_id).filter(Boolean))]
    const { data: facs } = facIds.length
      ? await supabase.schema('msa').from('comprobantes_arca')
          .select('id, cuit, tipo_comprobante, numero_desde, fecha_emision').in('id', facIds)
      : { data: [] }
    const facPorId = new Map(((facs || []) as any[]).map(f => [f.id, f]))
    const compDeAnticipo = new Map(((ants || []) as any[]).map(a => [a.id, a.comprobante_venta_id]))
    const cuitDeComp = new Map(comps.map(c => [c.id, String(c.cuit_cliente || '').replace(/\D/g, '')]))
    for (const ap of (apps || []) as any[]) {
      const compId = compDeAnticipo.get(ap.anticipo_id)
      const fac: any = facPorId.get(ap.factura_arca_id)
      if (!compId || !fac) continue
      // Sólo si la factura es del mismo cliente: eso es una compensación. Aplicada a otro, no es de esta venta.
      if (String(fac.cuit || '').replace(/\D/g, '') !== cuitDeComp.get(compId)) continue
      salida.get(compId)?.compensaciones.push({
        id: ap.id, anticipo_id: ap.anticipo_id, monto_aplicado: ap.monto_aplicado,
        fecha: fac.fecha_emision || (ap.fecha_aplicacion ? String(ap.fecha_aplicacion).slice(0, 10) : null),
        comprobante: `${TIPO_CBTE[Number(fac.tipo_comprobante)] || 'comprobante'} ${fac.numero_desde ?? ''}`.trim(),
      })
    }
  }
  return salida
}

/** Los pagos a cuenta del cliente que todavía no están vinculados a ningún comprobante de venta. */
export async function pagosACuentaSinVincular(supabase: Cliente, cuit: string) {
  const { data, error } = await supabase.from('anticipos_proveedores')
    .select('id, fecha_pago, monto, metodo_pago, estado_pago, descripcion, cuit_proveedor, nro_cuenta')
    .eq('tipo', 'cobro').eq('cuit_proveedor', cuit).is('comprobante_venta_id', null)
    .order('fecha_pago', { ascending: true })
  if (error) throw error
  return (data || []) as { id: string; fecha_pago: string | null; monto: number; metodo_pago: string | null; estado_pago: string | null; descripcion: string | null; cuit_proveedor: string; nro_cuenta: string | null }[]
}

const TABLAS_BANCARIAS: { tabla: string; schema?: string }[] = [
  { tabla: 'msa_galicia' }, { tabla: 'pam_galicia' }, { tabla: 'pam_galicia_cc' }, { tabla: 'ma_galicia', schema: 'ma' },
]

/**
 * 🔗 **Vincula un pago a cuenta (anticipo de cobro) a un comprobante de venta** — EL camino, usado
 * por el asistente de vinculación (Cash Flow, Principal) y por el detalle del cobro (Cobros).
 * Antes vivía sólo adentro del asistente (`useVinculacionAnticipo`); se sacó acá para que los dos
 * lugares escriban lo mismo (§ ♻️ de CLAUDE.md).
 *
 * 1. El comprobante: `cobrado` (o `conciliado` si el movimiento ya lo estaba) **sólo si queda
 *    saldado**; si no tiene cuenta contable y el anticipo sí, la hereda.
 * 2. El anticipo: `comprobante_venta_id` + `vinculado` / `parcial`.
 * 3. El movimiento del banco que lo trajo (si se encuentra): queda atado al comprobante. Un echeq
 *    endosado no tiene movimiento — no se busca.
 */
export async function vincularPagoACuenta(
  supabase: Cliente,
  anticipo: { id: string; monto: number; fecha_pago: string | null; cuit_proveedor: string; nro_cuenta?: string | null; estado_pago?: string | null },
  comp: { id: string; nro_cuenta?: string | null },
  opciones: { saldada: boolean; movimientoConciliado?: boolean },
): Promise<{ extractoActualizado: boolean }> {
  const updateComp: Record<string, any> = {}
  if (opciones.saldada) updateComp.estado = opciones.movimientoConciliado ? 'conciliado' : 'cobrado'
  if (!comp.nro_cuenta && anticipo.nro_cuenta) updateComp.nro_cuenta = anticipo.nro_cuenta
  if (Object.keys(updateComp).length) {
    const { error } = await supabase.schema('msa').from('comprobantes_venta').update(updateComp).eq('id', comp.id)
    if (error) throw error
  }

  const { error: errAnt, count } = await supabase.from('anticipos_proveedores')
    .update({ comprobante_venta_id: comp.id, estado: opciones.saldada ? 'vinculado' : 'parcial' }, { count: 'exact' })
    .eq('id', anticipo.id)
  if (errAnt) throw errAnt
  if (count === 0) throw new Error('No se encontró el pago a cuenta: el vínculo NO se guardó')

  if (anticipo.estado_pago === 'endosado') return { extractoActualizado: false }

  for (const { tabla, schema } of TABLAS_BANCARIAS) {
    const client = schema ? supabase.schema(schema) : supabase
    let { data: movs } = await client.from(tabla).select('id, creditos, estado').eq('anticipo_id', anticipo.id).limit(1)
    if (!movs || movs.length === 0) {
      const { data: porCuit } = await client.from(tabla)
        .select('id, creditos, estado, leyendas_adicionales_2')
        .eq('fecha', anticipo.fecha_pago).eq('leyendas_adicionales_2', anticipo.cuit_proveedor).limit(10)
      const match = ((porCuit || []) as any[]).find(m =>
        Math.abs((parseFloat(m.creditos) || 0) - anticipo.monto) < Math.max(1, anticipo.monto * 0.03))
      if (match) movs = [match]
    }
    if (movs && movs.length > 0) {
      // `comprobante_venta_id` existe sólo en `msa_galicia` (A-FEAT-24): en las otras se ata sólo el anticipo.
      const upd: Record<string, any> = { anticipo_id: anticipo.id, estado: 'conciliado', motivo_revision: null }
      if (tabla === 'msa_galicia') upd.comprobante_venta_id = comp.id
      await client.from(tabla).update(upd).eq('id', (movs[0] as any).id)
      return { extractoActualizado: true }
    }
  }
  return { extractoActualizado: false }
}
