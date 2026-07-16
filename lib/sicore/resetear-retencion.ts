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

// Anula la retención v2 (conserva nro_comprobante/certificado) + limpia los campos SICORE de la FC + estado=pendiente.
// monto_a_abonar vuelve a imp_total (en moneda original), que la función busca sola. Lanza Error si falla el update.
export async function resetearRetencionFactura(schema: string, facturaId: string): Promise<void> {
  // 0. imp_total en moneda original (para restaurar monto_a_abonar)
  const { data: fc } = await supabase.schema(schema).from('comprobantes_arca')
    .select('imp_total').eq('id', facturaId).single()
  const impTotal = (fc?.imp_total as number | undefined) ?? 0

  // 1. Anular registro v2 (si hay)
  const { error: errAnul } = await supabase.schema(schema).from('sicore_retenciones')
    .update({ anulado: true, fecha_anulacion: new Date().toISOString(), motivo_anulacion: `Reset FC ${facturaId}` })
    .eq('factura_id', facturaId).eq('anulado', false)
  if (errAnul) console.error('Error anulando sicore_retenciones:', errAnul)

  // 2. Limpiar la FC
  const { error: errUpd } = await supabase.schema(schema).from('comprobantes_arca')
    .update({ estado: 'pendiente', sicore: null, monto_sicore: null, tipo_sicore: null, descuento_aplicado: null, tc_pago: null, monto_a_abonar: impTotal })
    .eq('id', facturaId)
  if (errUpd) throw errUpd
}
