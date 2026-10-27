/**
 * 🧾 **COBRO AGRUPADO — lo que escribe en la base** (A-FEAT-167 etapa 2, 2026-10-27). La cuenta vive en
 * `grupo-cobro.ts`; acá sólo se lee y se escribe.
 *
 * Tres operaciones, las tres por un solo camino (§ ♻️ de CLAUDE.md):
 * - `agruparCobro` — desde Cobros: varias ventas del mismo cliente pasan a cobrarse juntas.
 * - `desagruparCobro` — el camino de vuelta. **Se frena si el grupo ya tiene cobros**: los movimientos
 *   quedan atados a UNA venta del grupo, y soltar el grupo dejaría esa venta cobrada de más y las otras
 *   de menos sin que nada lo diga. Primero se desasignan los cobros.
 * - `actualizarEstadoDelGrupo` — después de asignar un crédito al grupo (Extracto): si con eso el grupo
 *   quedó cobrado, **todas** sus ventas pasan a «conciliado» con sus cuotas cobradas (el Cash Flow deja
 *   de esperarlas); si no, el grupo queda «parcial» y las ventas siguen esperando lo que falta.
 */
import { cobroEsperado } from './cobro-esperado'
import { cargarFuentesCobro } from './detalle-cobro-db'
import type { PlazoCobro } from './hacienda'
import { faltaCobrarDelGrupo, validarAgrupacion, cuotasAlCerrarGrupo, cuotasAlReabrirGrupo, type VentaAgrupable } from './grupo-cobro'

type Cliente = { from: (t: string) => any; schema: (s: string) => any }

/** Menos de $1 es redondeo del emisor: el grupo cierra igual (mismo criterio que el Extracto). */
const TOLERANCIA = 1

/** Crea el grupo y le asigna las ventas. Devuelve el id del grupo. */
export async function agruparCobro(
  supabase: Cliente, schema: string,
  ventas: (VentaAgrupable & { denominacion_cliente?: string | null; esperado?: number })[],
  observaciones?: string | null,
): Promise<string> {
  const motivo = validarAgrupacion(ventas)
  if (motivo) throw new Error(motivo)
  const { data: grupo, error } = await supabase.schema(schema).from('grupos_cobro')
    .insert({
      cuit: String(ventas[0].cuit_cliente ?? '').replace(/\D/g, ''),
      cliente: ventas[0].denominacion_cliente ?? null,
      monto_total: Math.round(ventas.reduce((s, v) => s + (Number(v.esperado) || 0), 0) * 100) / 100,
      estado: 'cobrar',
      observaciones: observaciones ?? `Agrupadas desde Cobros: ${ventas.map(v => v.nro_comprobante || v.id).join(' + ')}`,
    })
    .select('id').single()
  if (error || !grupo) throw new Error('No se pudo crear el grupo: ' + (error?.message ?? ''))
  const { error: errUpd, count } = await supabase.schema(schema).from('comprobantes_venta')
    .update({ grupo_cobro_id: grupo.id }, { count: 'exact' }).in('id', ventas.map(v => v.id)).is('grupo_cobro_id', null)
  if (errUpd || count !== ventas.length) {
    // No queda un grupo a medias: si alguna venta no entró, se deshace todo.
    await supabase.schema(schema).from('comprobantes_venta').update({ grupo_cobro_id: null }).eq('grupo_cobro_id', grupo.id)
    await supabase.schema(schema).from('grupos_cobro').delete().eq('id', grupo.id)
    throw new Error(errUpd ? 'No se pudieron asignar las ventas: ' + errUpd.message : 'Alguna venta ya estaba en otro grupo: no se agrupó nada')
  }
  return grupo.id as string
}

/** Las ventas de un grupo, con todo lo que hace falta para saber cuánto le falta cobrar. */
async function ventasDelGrupo(supabase: Cliente, schema: string, grupoId: string) {
  const { data, error } = await supabase.schema(schema).from('comprobantes_venta')
    .select('id, nro_comprobante, cuit_cliente, estado, imp_total, iva, subtotal_neto, imp_neto_gravado, imp_neto_no_gravado, imp_op_exentas, comision_neto, comision_iva, almacenaje_neto, almacenaje_iva, ret_iva, ret_iibb, tipo_comprobante' + (schema === 'msa' ? ', plazos' : ''))
    .eq('grupo_cobro_id', grupoId).order('nro_comprobante')
  if (error) throw error
  return (data || []) as any[]
}

/** Cuánto le falta cobrar al grupo en el banco, leído de la base. */
export async function faltaCobrarDelGrupoEnBase(supabase: Cliente, schema: string, grupoId: string, excluir: string[] = []) {
  const ventas = await ventasDelGrupo(supabase, schema, grupoId)
  const ids = ventas.map(v => v.id)
  const { data: rets, error } = ids.length
    ? await supabase.schema(schema).from('retenciones_recibidas').select('comprobante_venta_id, monto').in('comprobante_venta_id', ids)
    : { data: [], error: null }
  if (error) throw error
  const retPor = new Map<string, number>()
  for (const r of (rets || []) as any[]) retPor.set(r.comprobante_venta_id, (retPor.get(r.comprobante_venta_id) || 0) + (Number(r.monto) || 0))
  const fuentes = await cargarFuentesCobro(supabase, ventas.map(v => ({ id: v.id, cuit_cliente: v.cuit_cliente })), schema)
  const conEsperado = ventas.map(v => ({ id: v.id, pagoCondiciones: cobroEsperado(v, retPor.get(v.id) || 0).pagoCondiciones }))
  return { ventas, ...faltaCobrarDelGrupo(conEsperado, fuentes, excluir) }
}

/**
 * Después de asignar (o quitar) un cobro del grupo — **de ida y de vuelta**:
 * - Si quedó cobrado: todas sus ventas pasan a «conciliado» y sus cuotas abiertas a «cobrado», con la
 *   marca `por_grupo` (el Cash Flow deja de esperarlas). El grupo, a «cobrado».
 * - Si estaba cobrado y ya no (le quitaron un cobro): se reabren SÓLO las cuotas que cerró el grupo y
 *   sus ventas vuelven a «a cobrar». Lo marcado a mano no se toca.
 * - Si no: «parcial» (algo cobró) o «cobrar» (nada).
 * `excluir`: cobros que no cuentan (el movimiento que se está soltando, antes de soltarlo).
 */
export async function actualizarEstadoDelGrupo(
  supabase: Cliente, schema: string, grupoId: string, excluir: string[] = [],
): Promise<{ estado: 'cobrado' | 'parcial' | 'cobrar'; antes: string | null; falta: number }> {
  const { data: g } = await supabase.schema(schema).from('grupos_cobro').select('estado').eq('id', grupoId).maybeSingle()
  const antes: string | null = (g as any)?.estado ?? null
  const { ventas, cobrado, falta } = await faltaCobrarDelGrupoEnBase(supabase, schema, grupoId, excluir)
  const estado = falta <= TOLERANCIA ? 'cobrado' : cobrado > 0.005 ? 'parcial' : 'cobrar'
  for (const v of ventas) {
    const plazos = (Array.isArray(v.plazos) ? v.plazos : []) as PlazoCobro[]
    let cambio: Record<string, unknown> | null = null
    if (estado === 'cobrado') {
      const nuevos = cuotasAlCerrarGrupo(plazos, grupoId)
      cambio = { estado: 'conciliado', ...(schema === 'msa' && plazos.length ? { plazos: nuevos } : {}) }
    } else if (antes === 'cobrado') {
      const nuevos = cuotasAlReabrirGrupo(plazos, grupoId)
      cambio = { estado: 'a cobrar', ...(schema === 'msa' && plazos.length ? { plazos: nuevos } : {}) }
    }
    if (!cambio) continue
    const { error } = await supabase.schema(schema).from('comprobantes_venta').update(cambio).eq('id', v.id)
    if (error) throw error
  }
  const { error } = await supabase.schema(schema).from('grupos_cobro').update({ estado }).eq('id', grupoId)
  if (error) throw error
  return { estado, antes, falta }
}

/**
 * Suelta el grupo. **Se frena si tiene cobros** (movimientos, pagos a cuenta o compensaciones atados a
 * sus ventas): primero se desasignan desde el Extracto. Las retenciones no frenan: son de cada venta.
 */
export async function desagruparCobro(supabase: Cliente, schema: string, grupoId: string): Promise<void> {
  const { cobrado } = await faltaCobrarDelGrupoEnBase(supabase, schema, grupoId)
  if (cobrado > 0.005) {
    throw new Error('El grupo ya tiene cobros asignados: desasignalos desde el Extracto antes de desagrupar (si no, una venta quedaría cobrada de más y las otras de menos)')
  }
  const { error } = await supabase.schema(schema).from('comprobantes_venta').update({ grupo_cobro_id: null }).eq('grupo_cobro_id', grupoId)
  if (error) throw error
  const { error: errDel } = await supabase.schema(schema).from('grupos_cobro').delete().eq('id', grupoId)
  if (errDel) throw errDel
}
