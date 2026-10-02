/**
 * 🧾 Lectura y escritura de los CHEQUES DE TERCEROS — A-FEAT-1229. La lógica, en `cheques-terceros.ts`.
 */

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
