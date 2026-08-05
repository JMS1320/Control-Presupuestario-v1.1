// La forma de una VENTA PRESUPUESTADA de hacienda (`productivo.stock_lotes`).
//
// ── Por qué vive acá y no en la pantalla ─────────────────────────────────────
// Ya hay **tres** caminos que crean lotes —el alta manual, la generación desde el rodeo y la
// carga desde una pesada—, y ahora un cuarto desde *Ingresos → Ganadería*. El principio del
// usuario (2026-08-05): *"se registra en un solo lugar y se accede desde varios, pero cualquier
// lugar desde donde se acceda debe tener los campos completos, si no no sirve de nada"*.
//
// La tabla ya es una sola. Lo que falta asegurar es que **ninguno de los cuatro caminos escriba
// un lote a medias**, porque un lote sin desbaste o sin plazo se proyecta mal y nadie se entera.
// Por eso la lista de campos y sus defaults viven acá, no repetidos en cada pantalla.

import { desbasteDe, type NormaDesbaste, type TipoHacienda } from './comercializacion'

/**
 * Defaults de una venta presupuestada.
 *
 * ⚠️ El desbaste NO está acá: sale de las **normas** según tipo y peso (invernada 3/4/5 % por
 * banda, gordo 8 %). El alta manual vieja usaba un 5 % fijo, que no corresponde a ninguna banda.
 */
export const DEFAULTS_LOTE = {
  pct_cz: 0.03,
  alicuota_iva: 0.105,
  alicuota_iibb: 0.01,
  plazo_cobro: '0',
  ganancia_diaria_kg: 0.5,
} as const

export interface DatosLoteVenta {
  empresa: string
  categoria: string
  cantidad: number
  /** Peso base y la fecha en que se midió: la ganancia diaria corre desde ahí. */
  peso_base_kg: number
  fecha_peso: string | null
  fecha_disponible: string | null
  fecha_venta_estimada: string | null
  ganancia_diaria_kg: number
  /** NULL = lo resuelve la tabla de precios por banda de peso. */
  precio_kg_override: number | null
  pct_desbaste: number
  pct_cz: number
  plazo_cobro: string
  alicuota_iva: number
  alicuota_iibb: number
  /** De qué ciclo cuelga: el de cría o el de recría. Sin uno de los dos NO tiene campaña. */
  ciclo_id: string | null
  ciclo_recria_id: string | null
  origen: string
  notas: string | null
}

/**
 * El desbaste que corresponde, desde las normas.
 *
 * Se expone aparte para que la pantalla pueda mostrarlo **precargado y editable**: el usuario
 * pidió verlo siempre — *"me lo debería pedir por las dudas"*— porque decide sobre cuántos kilos
 * se cobra.
 */
export function desbasteSugerido(
  normas: NormaDesbaste[], categoria: string, peso: number,
): number {
  const tipo: TipoHacienda = /gordo|novillo\b|vaquillona gorda/i.test(categoria) ? 'gordo' : 'invernada'
  const d = desbasteDe(normas, tipo, peso)
  return d > 0 ? d : 0.03
}

/** El registro completo, listo para insertar. Ningún campo queda afuera por olvido. */
export function payloadLoteVenta(d: DatosLoteVenta) {
  return {
    empresa: d.empresa,
    categoria: d.categoria,
    cantidad: d.cantidad,
    peso_base_kg: d.peso_base_kg,
    fecha_peso: d.fecha_peso,
    fecha_disponible: d.fecha_disponible,
    fecha_venta_estimada: d.fecha_venta_estimada,
    ganancia_diaria_kg: d.ganancia_diaria_kg,
    precio_kg_override: d.precio_kg_override,
    pct_desbaste: d.pct_desbaste,
    pct_cz: d.pct_cz,
    plazo_cobro: d.plazo_cobro,
    alicuota_iva: d.alicuota_iva,
    alicuota_iibb: d.alicuota_iibb,
    ciclo_id: d.ciclo_id,
    ciclo_recria_id: d.ciclo_recria_id,
    origen: d.origen,
    notas: d.notas,
    updated_at: new Date().toISOString(),
  }
}

/** Lo que le falta al lote para proyectarse bien. Vacío = está completo. */
export function faltantesDeLote(d: Partial<DatosLoteVenta>): string[] {
  const f: string[] = []
  if (!d.cantidad || d.cantidad <= 0) f.push('cuántas cabezas')
  if (!d.peso_base_kg || d.peso_base_kg <= 0) f.push('el peso')
  if (!d.fecha_venta_estimada) f.push('cuándo se vende')
  // Sin ciclo el lote no tiene campaña, y el presupuesto no sabe a qué año imputarlo.
  if (!d.ciclo_id && !d.ciclo_recria_id) f.push('de qué ciclo sale (sin eso no tiene campaña)')
  return f
}
