// Capa compartida (UI-agnóstica): resetear una FC a estado pendiente + anular su retención SICORE v2.
// Espejo de resetearFactura (vista-facturas-arca). Usado por el Modal y por el Cash Flow al revertir a pendiente.
// El chequeo estado_quincena (declarada→bloquear / cerrada→confirmar) lo hace el llamador con estadoQuincenaDeFactura.
// SICORE es SOLO MSA. Ver MANUAL-USO § Pagos.

import { supabase } from "@/lib/supabase"

// Estado de la quincena del registro v2 vigente de una factura ('declarada' | 'cerrada' | 'abierta' | null).
export async function estadoQuincenaDeFactura(schema: string, facturaId: string): Promise<string | null> {
  try {
    const { data } = await supabase.schema(schema).from('sicore_retenciones')
      .select('estado_quincena').eq('factura_id', facturaId).eq('anulado', false).limit(1)
    return (data?.[0]?.estado_quincena as string | undefined) ?? null
  } catch { return null }
}

export interface AnticipoVinculado { id: string; monto: number; nombre_proveedor: string | null; sicore: string | null; monto_sicore: number | null }

// Anticipos vinculados a una factura (para decidir el reset: mantener el saldo o eliminar el anticipo).
export async function anticiposVinculadosAFactura(facturaId: string): Promise<AnticipoVinculado[]> {
  const { data } = await supabase.from('anticipos_proveedores')
    .select('id, monto, nombre_proveedor, sicore, monto_sicore').eq('factura_id', facturaId)
  return (data ?? []) as AnticipoVinculado[]
}

export interface OpcionesReset {
  // 'mantener' → monto_a_abonar = imp_total − Σanticipos (la FC "recuerda" el anticipo, que sigue vinculado).
  // 'eliminar' → borra la fila de cada anticipo vinculado (+ sus dependencias) y monto_a_abonar = imp_total.
  // Sin anticipos vinculados el flag es indiferente.
  modoAnticipo?: 'mantener' | 'eliminar'
}

// Anula la retención v2 (conserva nro_comprobante/certificado) + limpia los campos SICORE de la FC + estado=pendiente.
// Maneja los anticipos vinculados según opts.modoAnticipo. Todo lo busca la función sola. Lanza Error si falla.
export async function resetearRetencionFactura(schema: string, facturaId: string, opts: OpcionesReset = {}): Promise<void> {
  const modo = opts.modoAnticipo ?? 'mantener'

  // 0. Datos para restaurar (imp_total en moneda original + vencimiento)
  const { data: fc } = await supabase.schema(schema).from('comprobantes_arca')
    .select('imp_total, fecha_vencimiento').eq('id', facturaId).single()
  const impTotal = (fc?.imp_total as number | undefined) ?? 0
  const fechaVenc = (fc?.fecha_vencimiento as string | null | undefined) ?? null

  // 0b. Anticipos vinculados (para decidir el monto a restaurar / eliminarlos)
  const anticipos = await anticiposVinculadosAFactura(facturaId)
  const sumaAnticipos = anticipos.reduce((s, a) => s + (a.monto || 0), 0)

  // 1. Anular registro v2 de la FACTURA (si hay)
  const { error: errAnul } = await supabase.schema(schema).from('sicore_retenciones')
    .update({ anulado: true, fecha_anulacion: new Date().toISOString(), motivo_anulacion: `Reset FC ${facturaId}` })
    .eq('factura_id', facturaId).eq('anulado', false)
  if (errAnul) console.error('Error anulando sicore_retenciones:', errAnul)

  // 2. Anticipos vinculados
  let montoRestaurar = impTotal
  if (anticipos.length > 0) {
    if (modo === 'eliminar') {
      const ids = anticipos.map(a => a.id)
      // Limpiar dependencias del anticipo antes de borrarlo: anular su SICORE v2 + borrar su cheque
      await supabase.schema(schema).from('sicore_retenciones')
        .update({ anulado: true, fecha_anulacion: new Date().toISOString(), motivo_anulacion: `Reset FC ${facturaId} (elimina anticipo)` })
        .in('anticipo_id', ids).eq('anulado', false)
      await supabase.schema(schema).from('cheques').delete().in('anticipo_id', ids)
      const { error: errDel } = await supabase.from('anticipos_proveedores').delete().in('id', ids)
      if (errDel) throw errDel
      montoRestaurar = impTotal // sin anticipos → total
    } else {
      // Mantener: la FC recuerda el anticipo → monto neto del anticipo (los anticipos siguen vinculados/pagados)
      montoRestaurar = impTotal - sumaAnticipos
    }
  }

  // 3. Limpiar la FC
  const updateData: Record<string, unknown> = {
    estado: 'pendiente', sicore: null, monto_sicore: null, tipo_sicore: null,
    descuento_aplicado: null, tc_pago: null, monto_a_abonar: montoRestaurar,
    fecha_pago: null,
  }
  if (fechaVenc) updateData.fecha_estimada = fechaVenc // si hay venc, el orden del Cash Flow vuelve a lo firme
  const { error: errUpd } = await supabase.schema(schema).from('comprobantes_arca')
    .update(updateData)
    .eq('id', facturaId)
  if (errUpd) throw errUpd
}
