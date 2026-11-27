/**
 * ⚙️ **A-FEAT-1661 paso 2 — guardar CÓMO se presupuesta un template o una cuenta, en un solo lugar.**
 *
 * Hasta el 25/11 cada pantalla tenía su propio `upsert` (la sección «Cómo se completan los templates» y el panel «Cuentas
 * contables»). Ahora se suma la columna de configuración de la grilla (JMS 25/11: «la línea que presupuesta podría ser donde
 * se configura cómo se presupuesta»), así que las tres usan ESTAS funciones (CLAUDE.md § ♻️ centralizar): si mañana cambia
 * cómo se guarda, cambia para todas.
 */
import { supabase } from '@/lib/supabase'
import type { MetodoTemplate } from './templates'
import type { ConfigCuenta } from './modos'

/** El método elegido a mano para un template (gana sobre el automático). */
export async function guardarMetodoTemplate(templateId: string, cfg: { metodo: MetodoTemplate; monto_manual?: number | null }, empresa: string = 'MSA') {
  const { error } = await supabase.from('presupuesto_template_config').upsert({
    empresa, template_id: templateId, metodo: cfg.metodo,
    monto_manual: cfg.monto_manual ?? null, updated_at: new Date().toISOString(),
  }, { onConflict: 'empresa,template_id' })
  return error
}

/** Vuelve el template al método automático (borra la elección a mano). */
export async function quitarMetodoTemplate(templateId: string, empresa: string = 'MSA') {
  const { error } = await supabase.from('presupuesto_template_config').delete().eq('empresa', empresa).eq('template_id', templateId)
  return error
}

/** La configuración completa de una cuenta (se guarda entera: no se pierden los demás parámetros). */
export async function guardarConfigCuenta(v: ConfigCuenta & { notas?: string | null }) {
  const { error } = await supabase.from('presupuesto_cuenta_config').upsert({
    empresa: 'MSA', nro_cuenta: v.nro_cuenta, modo: v.modo,
    meses_promedio: v.meses_promedio ?? null,
    monto_manual: v.monto_manual ?? null,
    cabezas_referencia: v.cabezas_referencia ?? null,
    cabezas_proyectadas: v.cabezas_proyectadas ?? null,
    inflacion_mensual: v.inflacion_mensual ?? null,
    cuits_excluidos: v.cuits_excluidos ?? [],
    motivo_exclusion: v.motivo_exclusion ?? null,
    notas: v.notas ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'empresa,nro_cuenta' })
  return error
}

/** Vuelve la cuenta al modo sugerido (borra la configuración guardada). */
export async function quitarConfigCuenta(nro: string) {
  const { error } = await supabase.from('presupuesto_cuenta_config').delete().eq('empresa', 'MSA').eq('nro_cuenta', nro)
  return error
}
