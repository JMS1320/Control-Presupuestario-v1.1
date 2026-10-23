/**
 * 🧾 EL ALTA DE UNA FACTURA DE COMPRA — lo que comparten los dos caminos que crean una en
 * `comprobantes_arca`: el importador del Excel de ARCA / No Informada (`/api/import-facturas-arca`) y
 * la carga desde el PDF (`/api/facturas/cargar-desde-pdf`, A-FEAT-1318).
 *
 * Están juntos para que una factura cargada a mano entre **igual** que una importada: misma regla por
 * CUIT (cuenta, estado, FC), mismo vencimiento estimado, mismo signo para las NC y mismo alta del
 * proveedor. Si cada camino lo hiciera a su manera, la misma factura valdría distinto según por dónde
 * entró (CLAUDE.md § ♻️).
 */
import type { SupabaseClient } from "@supabase/supabase-js"

/** Vencimiento estimado: emisión + 15 días. */
export function calcularFechaEstimada(fechaEmision: string | null): string | null {
  if (!fechaEmision) return null
  try {
    const fecha = new Date(fechaEmision)
    fecha.setDate(fecha.getDate() + 15)
    return fecha.toISOString().split('T')[0]
  } catch {
    return null
  }
}

/** Regla de asignación automática por CUIT: cuenta contable, estado y FC. */
export async function buscarReglaCuit(sb: SupabaseClient, cuit: string): Promise<{ cuenta_contable: string | null, estado: string, fc: string | null }> {
  try {
    const { data, error } = await sb
      .from('reglas_ctas_import_arca')
      .select('cuenta_contable, estado, fc')
      .eq('cuit', cuit)
      .eq('activo', true)
      .single()
    if (error || !data) return { cuenta_contable: null, estado: 'pendiente', fc: null }
    return { cuenta_contable: data.cuenta_contable, estado: data.estado, fc: data.fc ?? null }
  } catch (err) {
    console.error(`❌ Error buscando regla CUIT ${cuit}:`, err)
    return { cuenta_contable: null, estado: 'pendiente', fc: null }
  }
}

/** Descripción del tipo de comprobante y si resta (NC), desde la tabla de ARCA. */
export async function obtenerTipoComprobante(sb: SupabaseClient, codigo: number): Promise<{ descripcion: string, es_nota_credito: boolean }> {
  try {
    const { data, error } = await sb
      .from('tipos_comprobante_afip')
      .select('descripcion, es_nota_credito')
      .eq('codigo', codigo)
      .single()
    if (error) return { descripcion: `Código ${codigo}`, es_nota_credito: false }
    return data
  } catch {
    return { descripcion: `Código ${codigo}`, es_nota_credito: false }
  }
}

/** Todos los campos de plata de una factura: los que se dan vuelta en una nota de crédito. */
export const CAMPOS_MONETARIOS = [
  'imp_neto_gravado', 'imp_neto_no_gravado', 'imp_op_exentas',
  'imp_otros_tributos', 'imp_total_iva', 'imp_total',
  'otros_tributos', 'iva',
  'neto_grav_iva_0', 'iva_2_5', 'neto_grav_iva_2_5', 'iva_5', 'neto_grav_iva_5',
  'iva_10_5', 'neto_grav_iva_10_5', 'iva_21', 'neto_grav_iva_21',
  'iva_27', 'neto_grav_iva_27',
] as const

/** Una NC se guarda en negativo: pasa a negativo todo campo de plata positivo. */
export function aNegativoSiNC<T extends Record<string, unknown>>(campos: T, esNotaCredito: boolean): T {
  if (!esNotaCredito) return campos
  const r: Record<string, unknown> = { ...campos }
  for (const c of CAMPOS_MONETARIOS) {
    const v = r[c]
    if (typeof v === 'number' && v > 0) r[c] = -v
  }
  return r as T
}

/**
 * 👥 Contrapartes (CLAUDE.md § 👥): cada CUIT que entra queda en `proveedores`. Upsert, nunca sólo
 * UPDATE: los que faltan se crean y los que ya estaban como cliente puro pasan a ser también proveedor.
 * No rompe el alta si falla: devuelve cuántos creó y el error, para decirlo.
 */
export async function asegurarProveedores(sb: SupabaseClient, vistos: ReadonlyMap<string, string>): Promise<{ creados: number; marcados: number; error?: string }> {
  const cuits = Array.from(vistos.keys()).filter(Boolean)
  if (cuits.length === 0) return { creados: 0, marcados: 0 }
  try {
    const { data: existentes, error: errLee } = await sb.from('proveedores').select('cuit, es_proveedor').in('cuit', cuits)
    if (errLee) return { creados: 0, marcados: 0, error: errLee.message }
    const setExistentes = new Set((existentes || []).map((p: any) => p.cuit))
    const nuevos = cuits
      .filter(c => !setExistentes.has(c))
      .map(c => ({ cuit: c, razon_social: vistos.get(c) || c, fc_modo: 'sin_config', es_proveedor: true }))
    let creados = 0
    if (nuevos.length > 0) {
      const { error } = await sb.from('proveedores').insert(nuevos)
      if (error) return { creados: 0, marcados: 0, error: error.message }
      creados = nuevos.length
    }
    const aMarcar = (existentes || []).filter((p: any) => p.es_proveedor === false).map((p: any) => p.cuit)
    if (aMarcar.length > 0) {
      const { error } = await sb.from('proveedores').update({ es_proveedor: true }).in('cuit', aMarcar)
      if (error) return { creados, marcados: 0, error: error.message }
    }
    return { creados, marcados: aMarcar.length }
  } catch (e) {
    return { creados: 0, marcados: 0, error: (e as Error).message }
  }
}

// ── La carga a mano desde el PDF (A-FEAT-1318) ──────────────────────────────────────────────────

/** Lo que el usuario deja en la pantalla de carga. Importes en positivo: el signo lo pone el tipo. */
export interface DatosCargaManual {
  cuit: string
  denominacion: string
  tipo: number
  puntoVenta: number
  numero: number
  fecha: string
  neto21: number
  iva21: number
  neto105: number
  iva105: number
  noGravado: number
  exento: number
  otrosTributos: number
  total: number
  cae: string | null
}

/**
 * 🧮 El control de la carga: las partes tienen que sumar el total que dice el mismo comprobante.
 * Es de INTEGRIDAD (CLAUDE.md § 🚦): una factura cuyas partes no suman su total se contradice, así que
 * **frena**. Tolerancia $1 (los emisores redondean). Sólo para A y M: en B y C ARCA guarda únicamente
 * el total, y así se guarda.
 */
export function controlDeLaCarga(d: Pick<DatosCargaManual, 'neto21' | 'iva21' | 'neto105' | 'iva105' | 'noGravado' | 'exento' | 'otrosTributos' | 'total'>, discrimina: boolean): { aplica: boolean; suma: number; diferencia: number; cierra: boolean } {
  if (!discrimina) return { aplica: false, suma: d.total, diferencia: 0, cierra: d.total > 0 }
  const suma = Math.round((d.neto21 + d.iva21 + d.neto105 + d.iva105 + d.noGravado + d.exento + d.otrosTributos) * 100) / 100
  const diferencia = Math.round((d.total - suma) * 100) / 100
  return { aplica: true, suma, diferencia, cierra: d.total > 0 && Math.abs(diferencia) <= 1 }
}

/** Los campos de la factura (sin los del sistema) a partir de la carga. En B y C sólo el total. */
export function camposDeLaCarga(d: DatosCargaManual, discrimina: boolean) {
  const n = (x: number) => (discrimina ? x : 0)
  return {
    fecha_emision: d.fecha,
    tipo_comprobante: d.tipo,
    punto_venta: d.puntoVenta,
    numero_desde: d.numero,
    numero_hasta: d.numero,
    codigo_autorizacion: d.cae || null,
    tipo_doc_emisor: 80,
    cuit: d.cuit,
    denominacion_emisor: d.denominacion,
    tipo_cambio: 1,
    moneda: 'PES',
    imp_neto_gravado: n(d.neto21 + d.neto105),
    imp_neto_no_gravado: n(d.noGravado),
    imp_op_exentas: n(d.exento),
    otros_tributos: n(d.otrosTributos),
    iva: n(d.iva21 + d.iva105),
    imp_total: d.total,
    neto_grav_iva_21: n(d.neto21),
    iva_21: n(d.iva21),
    neto_grav_iva_10_5: n(d.neto105),
    iva_10_5: n(d.iva105),
  }
}

/**
 * 👣 La HUELLA (CLAUDE.md § 📄 punto 4): por cada dato, lo que leyó el lector al lado de lo que dejó
 * el usuario — sólo los que cambió. Sin las dos puntas no sirve: saber que se corrigió el total no dice
 * nada; saber que se leyó 66.950,36 y quedó 69.950,36 dice dónde falla.
 */
export function huellaDeLaCarga(
  leido: Record<string, string | number | null | undefined>,
  cargado: Record<string, string | number | null | undefined>,
): Array<{ campo: string; leido: string | number | null; cargado: string | number | null }> {
  const igual = (a: unknown, b: unknown) =>
    (typeof a === 'number' || typeof b === 'number') ? Math.abs(Number(a ?? 0) - Number(b ?? 0)) < 0.005 : String(a ?? '').trim() === String(b ?? '').trim()
  return Object.keys(cargado)
    .filter(k => !igual(leido[k], cargado[k]))
    .map(k => ({ campo: k, leido: leido[k] ?? null, cargado: cargado[k] ?? null }))
}
