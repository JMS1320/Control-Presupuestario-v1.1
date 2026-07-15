// Capa compartida (UI-agnóstica): deshacer un grupo de pago.
// Espejo de la lógica del Modal (desagruparPago/desagruparTemplates). En el Cash Flow un grupo
// se ve como UNA fila consolidada → se deshace TODO el grupo (no hay desagrupar parcial).
// Quita grupo_pago_id de todos los miembros + borra el registro en {schema}.grupos_pago.
// Ver MANUAL-USO § Pagos.

import { supabase } from "@/lib/supabase"

/**
 * Deshace el grupo `grupoId` completo.
 * FC → {schema}.comprobantes_arca · template → public.cuotas_egresos_sin_factura.
 * Lanza Error si falla (el llamador muestra el toast).
 */
export async function desagruparPago(schema: string, origen: 'ARCA' | 'TEMPLATE', grupoId: string): Promise<void> {
  // 1. Quitar grupo_pago_id de TODOS los miembros del grupo (robusto ante filas fuera de la selección)
  const q = origen === 'ARCA'
    ? supabase.schema(schema).from('comprobantes_arca')
    : supabase.from('cuotas_egresos_sin_factura')
  const { error: errUpd } = await q.update({ grupo_pago_id: null }).eq('grupo_pago_id', grupoId)
  if (errUpd) throw new Error('Error al desagrupar: ' + errUpd.message)

  // 2. Borrar el grupo
  const { error: errDel } = await supabase.schema(schema).from('grupos_pago').delete().eq('id', grupoId)
  if (errDel) throw new Error('Error al borrar grupo: ' + errDel.message)
}
