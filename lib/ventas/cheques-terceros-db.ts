/**
 * 🧾 Lectura y escritura de los CHEQUES DE TERCEROS — A-FEAT-1229. La lógica, en `cheques-terceros.ts`.
 */

import { filasExtractoEcheqs } from './extracto-echeqs'

type Cliente = { from: (t: string) => any; schema: (s: string) => any }

export interface ChequeTercero {
  id: string
  nombre_proveedor: string | null
  cuit_proveedor: string | null
  monto: number
  fecha_pago: string | null
  fecha_cobro_echeq: string | null
  estado_pago: string | null
  endosado_en_id: string | null
  descripcion: string | null
  comprobante_venta_id: string | null
  /** A quién se endosó (nombre del proveedor del pago destino), si se sabe. */
  endosadoA: string | null
}

/** Los cheques recibidos de clientes (anticipos de cobro con echeq) que están en cartera o endosados. */
export async function cargarChequesTerceros(supabase: Cliente): Promise<ChequeTercero[]> {
  const { data, error } = await supabase.from('anticipos_proveedores')
    .select('id, nombre_proveedor, cuit_proveedor, monto, fecha_pago, fecha_cobro_echeq, estado_pago, endosado_en_id, descripcion, comprobante_venta_id')
    .eq('tipo', 'cobro').eq('metodo_pago', 'echeq').in('estado_pago', ['en_cartera', 'endosado'])
    .order('fecha_pago', { ascending: false })
  if (error) throw error
  const lista = (data || []) as any[]
  const destinos = [...new Set(lista.map(c => c.endosado_en_id).filter(Boolean))]
  const { data: pagos } = destinos.length
    ? await supabase.from('anticipos_proveedores').select('id, nombre_proveedor').in('id', destinos)
    : { data: [] }
  const nombre = new Map(((pagos || []) as any[]).map(p => [p.id, p.nombre_proveedor]))
  return lista.map(c => ({ ...c, monto: Number(c.monto) || 0, endosadoA: c.endosado_en_id ? (nombre.get(c.endosado_en_id) || null) : null }))
}

/**
 * Los pagos a proveedores a los que se puede endosar: anticipos de PAGO que no pasaron por el banco
 * (no conciliados) y que no son ya el destino de otro cheque.
 */
export async function pagosParaEndosar(supabase: Cliente) {
  const [{ data: pagos, error }, { data: usados }] = await Promise.all([
    supabase.from('anticipos_proveedores')
      .select('id, nombre_proveedor, cuit_proveedor, monto, fecha_pago, descripcion, metodo_pago, estado_pago')
      .eq('tipo', 'pago').neq('estado_pago', 'conciliado')
      .order('fecha_pago', { ascending: false }).limit(300),
    supabase.from('anticipos_proveedores').select('endosado_en_id').not('endosado_en_id', 'is', null),
  ])
  if (error) throw error
  const ocupados = new Set(((usados || []) as any[]).map(u => u.endosado_en_id))
  return ((pagos || []) as any[]).filter(p => !ocupados.has(p.id))
}

/**
 * ✍️ **Endosa un cheque**: lo ata al pago que cancela. Si el pago no existe, lo crea (anticipo de
 * pago al proveedor, por el importe del cheque, a vincular después con su factura como cualquier
 * anticipo). Devuelve el id del pago.
 */
export async function endosarCheque(
  supabase: Cliente,
  cheque: { id: string; monto: number; nombre_proveedor: string | null; descripcion: string | null },
  destino: { pagoId: string } | { nuevo: { cuit: string; nombre: string; fecha: string } },
): Promise<string> {
  const nro = (cheque.descripcion || '').match(/N[º°o]\s*(\S+)/)?.[1] || ''
  const deQuien = `Echeq de tercero${nro ? ' Nº ' + nro : ''} (de ${cheque.nombre_proveedor || 'cliente'})`
  let pagoId: string
  let proveedor: string
  if ('nuevo' in destino) {
    const { data, error } = await supabase.from('anticipos_proveedores').insert({
      tipo: 'pago', cuit_proveedor: destino.nuevo.cuit, nombre_proveedor: destino.nuevo.nombre,
      monto: cheque.monto, monto_restante: cheque.monto, fecha_pago: destino.nuevo.fecha,
      metodo_pago: 'echeq', estado_pago: 'endosado', estado: 'pendiente_vincular', empresa: 'MSA', descripcion: deQuien,
    }).select('id').single()
    if (error) throw error
    pagoId = (data as any).id
    proveedor = destino.nuevo.nombre
  } else {
    const { data: p, error: eL } = await supabase.from('anticipos_proveedores')
      .select('id, nombre_proveedor, descripcion').eq('id', destino.pagoId).single()
    if (eL) throw eL
    const desc = [String((p as any).descripcion || '').trim(), deQuien].filter(Boolean).join(' · ')
    const { error } = await supabase.from('anticipos_proveedores')
      .update({ metodo_pago: 'echeq', estado_pago: 'endosado', descripcion: desc }).eq('id', destino.pagoId)
    if (error) throw error
    pagoId = destino.pagoId
    proveedor = (p as any).nombre_proveedor || 'proveedor'
  }
  const { error: eC, count } = await supabase.from('anticipos_proveedores')
    .update({ estado_pago: 'endosado', endosado_en_id: pagoId, descripcion: `Echeq${nro ? ' Nº ' + nro : ''} endosado a ${proveedor}` }, { count: 'exact' })
    .eq('id', cheque.id)
  if (eC) throw eC
  if (count === 0) throw new Error('No se encontró el cheque: el endoso NO se guardó')
  return pagoId
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🏦 El «extracto» de los echeqs de terceros — A-FEAT-1230
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Trae las filas que tiene que tener `msa.echeqs_terceros` a partir de los cheques, y las escribe:
 * crea las que faltan y actualiza fecha, montos, descripción, vínculos y saldo de las que están.
 * 🔑 La imputación (cuenta, número, centro) **sólo se completa si la fila no la tiene**: lo que el
 * usuario eligió a mano en el Extracto no se pisa. Nunca borra. Devuelve cuántas creó y actualizó.
 */
export async function sincronizarExtractoEcheqs(supabase: Cliente): Promise<{ creadas: number; actualizadas: number }> {
  const { data: ch, error } = await supabase.from('anticipos_proveedores')
    .select('id, fecha_pago, monto, descripcion, nombre_proveedor, estado_pago, endosado_en_id, comprobante_venta_id')
    .eq('tipo', 'cobro').eq('metodo_pago', 'echeq').in('estado_pago', ['en_cartera', 'endosado'])
  if (error) throw error
  const cheques = (ch || []) as any[]

  const idsPago = [...new Set(cheques.map(c => c.endosado_en_id).filter(Boolean))]
  const { data: ps } = idsPago.length
    ? await supabase.from('anticipos_proveedores').select('id, fecha_pago, nombre_proveedor, factura_id').in('id', idsPago)
    : { data: [] }
  const pagos = new Map(((ps || []) as any[]).map(p => [p.id, { ...p }]))
  // La factura del pago: la de `factura_id`, o la primera a la que se aplicó.
  const sinFactura = [...pagos.values()].filter(p => !p.factura_id).map(p => p.id)
  if (sinFactura.length) {
    const { data: apps } = await supabase.from('anticipos_facturas').select('anticipo_id, factura_arca_id').in('anticipo_id', sinFactura)
    for (const a of (apps || []) as any[]) { const p = pagos.get(a.anticipo_id); if (p && !p.factura_id) p.factura_id = a.factura_arca_id }
  }

  const idsVenta = [...new Set(cheques.map(c => c.comprobante_venta_id).filter(Boolean))]
  const idsFac = [...new Set([...pagos.values()].map(p => p.factura_id).filter(Boolean))]
  const [{ data: vs }, { data: fs }] = await Promise.all([
    idsVenta.length ? supabase.schema('msa').from('comprobantes_venta').select('id, cuenta_contable, nro_cuenta, centro_costo, nro_comprobante').in('id', idsVenta) : Promise.resolve({ data: [] }),
    idsFac.length ? supabase.schema('msa').from('comprobantes_arca').select('id, cuenta_contable, nro_cuenta, centro_costo, numero_desde, denominacion_emisor').in('id', idsFac) : Promise.resolve({ data: [] }),
  ])
  const impVenta = new Map(((vs || []) as any[]).map(v => [v.id, { categ: v.cuenta_contable, nro_cuenta: v.nro_cuenta, centro_costo: v.centro_costo, referencia: v.nro_comprobante }]))
  const impFac = new Map(((fs || []) as any[]).map(f => [f.id, { categ: f.cuenta_contable, nro_cuenta: f.nro_cuenta, centro_costo: f.centro_costo, referencia: `FC ${f.numero_desde ?? ''} ${f.denominacion_emisor ?? ''}`.trim() }]))

  const deseadas = filasExtractoEcheqs(cheques, pagos as any, impVenta, impFac)
  const { data: ex, error: eEx } = await supabase.schema('msa').from('echeqs_terceros').select('id, anticipo_id, categ')
  if (eEx) throw eEx
  const existentes = new Map(((ex || []) as any[]).map(r => [r.anticipo_id, r]))
  let creadas = 0, actualizadas = 0
  for (const f of deseadas) {
    const e: any = existentes.get(f.anticipo_id)
    if (!e) {
      const { error: eI } = await supabase.schema('msa').from('echeqs_terceros').insert(f)
      if (eI) throw eI
      creadas++
    } else {
      const upd: Record<string, any> = {
        fecha: f.fecha, descripcion: f.descripcion, creditos: f.creditos, debitos: f.debitos, saldo: f.saldo,
        comprobante_venta_id: f.comprobante_venta_id, comprobante_arca_id: f.comprobante_arca_id,
      }
      if (!e.categ && f.categ) Object.assign(upd, { categ: f.categ, nro_cuenta: f.nro_cuenta, centro_de_costo: f.centro_de_costo, estado: 'conciliado' })
      const { error: eU } = await supabase.schema('msa').from('echeqs_terceros').update(upd).eq('id', e.id)
      if (eU) throw eU
      actualizadas++
    }
  }
  return { creadas, actualizadas }
}
