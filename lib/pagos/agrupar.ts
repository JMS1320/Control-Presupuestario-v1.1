// Capa compartida (UI-agnóstica): agrupar pagos en un grupo_pago.
// Mirror de la lógica del Modal (agruparPagos/agruparTemplates): crea el registro
// en {schema}.grupos_pago y asigna grupo_pago_id a los items. Ver MANUAL-USO § Pagos.

import { supabase } from "@/lib/supabase"

export type OrigenAgrupable = 'ARCA' | 'TEMPLATE'

export interface AgruparInput {
  schema: string          // 'msa' | 'pam' | 'ma' — schema donde vive grupos_pago
  origen: OrigenAgrupable
  ids: string[]
  cuit: string | null
  proveedor: string
  monto_total: number
  estado: string
  observaciones?: string | null
}

/**
 * Crea el grupo de pago y asigna grupo_pago_id a los items seleccionados.
 * Devuelve el id del grupo creado. Lanza Error si falla (el llamador muestra el toast).
 * FC → {schema}.comprobantes_arca · template → public.cuotas_egresos_sin_factura.
 */
export async function agruparPagos(input: AgruparInput): Promise<string> {
  const { schema, origen, ids, cuit, proveedor, monto_total, estado, observaciones } = input

  // 1. Crear el grupo
  const { data: grupo, error: errGrupo } = await supabase
    .schema(schema)
    .from('grupos_pago')
    .insert({ cuit, proveedor, monto_total, estado, observaciones: observaciones ?? null })
    .select('id')
    .single()
  if (errGrupo || !grupo) throw new Error('Error al crear grupo: ' + (errGrupo?.message ?? ''))

  // 2. Asignar grupo_pago_id a los items
  const q = origen === 'ARCA'
    ? supabase.schema(schema).from('comprobantes_arca')
    : supabase.from('cuotas_egresos_sin_factura')
  const { error: errUpd } = await q.update({ grupo_pago_id: grupo.id }).in('id', ids)
  if (errUpd) throw new Error('Error al asignar grupo: ' + errUpd.message)

  return grupo.id as string
}
