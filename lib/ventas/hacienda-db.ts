/**
 * 🐂 Lectura de ventas de hacienda y de su liquidación — en UN solo lugar (§ ♻️ de CLAUDE.md).
 *
 * La usan la solapa Ventas (la lista) y la liquidación de hacienda (cuando se abre desde
 * Comprobantes y tiene que encontrar su venta para comparar). Si cada una leyera por su cuenta, el
 * día que cambie una cuenta —el desbaste, la categoría— las dos dejarían de coincidir.
 */

import { categoriaDeVenta } from "./hacienda"

type Cliente = { from: (t: string) => any; schema: (s: string) => any }

/** Una venta de hacienda tal como la ve Ingresos. */
export interface VentaHaciendaDatos {
  id: string
  fecha: string
  cliente: string
  cuit: string
  categoria: string | null
  cabezas: number
  kgTotales: number
  /** FRACCIÓN (0.03 = 3 %), como la guarda Productivo. */
  pctDesbaste: number
  /** Kilos de CARNE: sólo en ventas al gancho. Si está, son los kilos que se cobran. */
  kgCarne: number | null
  precioKg: number
  /** El neto que guardó Productivo — se lee, no se recalcula. */
  neto: number
  plazo: string | null
  /** Lo ya vinculado a comprobantes (ventas_facturas). */
  liquidado: number
  /** % de CZ de la venta, FRACCIÓN. */
  pctCz: number | null
  centroCosto: string | null
  /** A-FEAT-1226 — venta anterior al stock de la app, guardada sin movimiento de stock a propósito. */
  historica: boolean
}

/**
 * Las ventas de hacienda de MSA (todas, o las de `ids`). Lee `ventas_unificadas` —la vista que
 * junta todas las ventas— y completa kilos, desbaste, plazo y categoría de `stock_ventas`.
 * Tira el error si falla: quien la llama decide cómo mostrarlo (nunca se calla).
 */
export async function cargarVentasHacienda(supabase: Cliente, ids?: string[]): Promise<VentaHaciendaDatos[]> {
  let q = supabase.from('ventas_unificadas')
    .select('venta_id, cliente_nombre, cliente_cuit, fecha_venta, cantidad, precio_pesos, monto_pesos, facturado, centro_costo')
    .eq('venta_tipo', 'ganaderia').eq('empresa', 'MSA')
  if (ids) q = q.in('venta_id', ids)
  const { data: base, error: eBase } = await q.order('fecha_venta', { ascending: false })
  if (eBase) throw eBase
  const lista = (base || []) as any[]
  if (!lista.length) return []
  const { data: det, error: eDet } = await supabase.schema('productivo').from('stock_ventas')
    .select('id, historica, kg_totales, kg_carne, pct_desbaste, plazo_cobro, pct_cz, lote:stock_lotes(categoria), cat:categorias_hacienda(nombre)')
    .in('id', lista.map(b => b.venta_id))
  if (eDet) throw eDet
  const detPorId = new Map(((det || []) as any[]).map(d => [d.id, d]))
  return lista.map(b => {
    const d: any = detPorId.get(b.venta_id) || {}
    return {
      id: b.venta_id,
      fecha: b.fecha_venta,
      cliente: b.cliente_nombre || '—',
      cuit: b.cliente_cuit || '',
      categoria: categoriaDeVenta(d.lote?.categoria, d.cat?.nombre),
      cabezas: Number(b.cantidad) || 0,
      kgTotales: Number(d.kg_totales) || 0,
      pctDesbaste: Number(d.pct_desbaste) || 0,
      kgCarne: Number(d.kg_carne) || null,
      precioKg: Number(b.precio_pesos) || 0,
      neto: Number(b.monto_pesos) || 0,
      plazo: d.plazo_cobro || null,
      liquidado: Number(b.facturado) || 0,
      pctCz: d.pct_cz === null || d.pct_cz === undefined ? null : Number(d.pct_cz),
      centroCosto: b.centro_costo || null,
      historica: !!d.historica,
    }
  })
}

/**
 * 🔑 La liquidación que ya tiene una venta, si la tiene. Es lo que evita la duplicada: *Liquidar*
 * sobre una venta liquidada abre ESA liquidación para editarla, en vez de crear otra.
 */
export async function liquidacionDeVenta(supabase: Cliente, ventaId: string): Promise<string | null> {
  const { data, error } = await supabase.from('ventas_facturas')
    .select('comprobante_id, created_at')
    .eq('venta_tipo', 'ganaderia').eq('venta_id', ventaId).eq('vinculado', true)
    .order('created_at', { ascending: true })
  if (error) throw error
  return ((data || []) as any[])[0]?.comprobante_id ?? null
}

/** Y al revés: la venta de una liquidación (para abrirla desde Comprobantes). */
export async function ventaDeLiquidacion(supabase: Cliente, comprobanteId: string): Promise<string | null> {
  const { data, error } = await supabase.from('ventas_facturas')
    .select('venta_id').eq('venta_tipo', 'ganaderia').eq('comprobante_id', comprobanteId).eq('vinculado', true)
  if (error) throw error
  return ((data || []) as any[])[0]?.venta_id ?? null
}
