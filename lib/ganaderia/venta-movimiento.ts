/**
 * 🐄 La venta cargada desde Productivo → Hacienda → Nuevo movimiento → Venta (A-FEAT-1671).
 *
 * JMS 27/11: «cuando quiero registrar una venta no me pide las caravanas… sí, que lo pida en el mismo paso y dar la opción de
 * precio por cabeza» · y después: «tenemos toros sin identificar por caravana, así que yo podría poner 2 con caravana y uno sin
 * caravana… además debería poder agregar renglones siempre: 2 toros a tanto y 1 toro a tanto».
 *  - Las caravanas se eligen EN el mismo paso para cualquier categoría con animales identificados (antes sólo la CUT); quedan
 *    vendidas y colgadas de la venta, igual que con «Completar venta».
 *  - Una cabeza SIN caravana se suma como «sin caravana» (con descripción si se tiene): va a `stock_ventas.animales_sueltos`,
 *    el mismo lugar que usa «Completar venta». El control es caravanas + sin caravana = cabezas.
 *  - El precio va en RENGLONES: cada uno con sus cabezas, **$ por kg** (con sus kilos) o **$ por cabeza**. La venta es una sola
 *    (un cliente, una factura): cabezas = Σ, kilos = Σ, importe = Σ. Si todos los renglones son por kg al mismo precio, ése es el
 *    $/kg de la venta; si no, no se inventa uno (queda el importe escrito y el detalle de los renglones en sus notas).
 */

export type ModoPrecio = 'kg' | 'cabeza'

export interface RenglonVenta { cabezas: string; modo: ModoPrecio; precio: string; kg: string }

export const renglonVacio = (): RenglonVenta => ({ cabezas: '', modo: 'kg', precio: '', kg: '' })

export const numAR = (v: string | number | null | undefined): number | null => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const fmt = (n: number, dec = 2) => n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

/** Pura: el importe de un renglón (null si le falta un dato). */
export function importeRenglon(r: RenglonVenta): number | null {
  const cab = numAR(r.cabezas), p = numAR(r.precio)
  if (p == null) return null
  if (r.modo === 'cabeza') return cab != null ? Math.round(p * cab * 100) / 100 : null
  const kg = numAR(r.kg)
  return kg != null ? Math.round(p * kg * 100) / 100 : null
}

/** Pura: la línea legible de un renglón («2 cab × $ 1.500.000,00 = $ 3.000.000,00» · «1 cab · 800 kg × $ 2.000,00/kg = …»). */
export function textoRenglon(r: RenglonVenta): string {
  const cab = numAR(r.cabezas) ?? 0, p = numAR(r.precio), imp = importeRenglon(r)
  if (r.modo === 'cabeza') return `${cab} cab × $ ${p != null ? fmt(p) : '?'}/cab = ${imp != null ? '$ ' + fmt(imp) : '?'}`
  const kg = numAR(r.kg)
  return `${cab} cab · ${kg != null ? fmt(kg, 0) : '?'} kg × $ ${p != null ? fmt(p) : '?'}/kg = ${imp != null ? '$ ' + fmt(imp) : '?'}`
}

/**
 * Pura: el total de la venta desde sus renglones. `completo` = todos los renglones tienen importe.
 * `precio_kg` sólo si TODOS son por kg al mismo precio. `nota` lista los renglones cuando hay más de uno o alguno es por cabeza.
 */
export function totalRenglones(rs: RenglonVenta[]): {
  cabezas: number; kg: number | null; monto: number | null; precio_kg: number | null; completo: boolean; nota: string | null
} {
  const usados = rs.filter(r => numAR(r.cabezas) || numAR(r.precio) || numAR(r.kg))
  const cabezas = usados.reduce((s, r) => s + (numAR(r.cabezas) ?? 0), 0)
  const kgs = usados.map(r => numAR(r.kg)).filter((k): k is number => k != null)
  const imps = usados.map(importeRenglon)
  const completo = usados.length > 0 && imps.every(i => i != null)
  const monto = imps.some(i => i != null) ? Math.round(imps.reduce((s: number, i) => s + (i ?? 0), 0) * 100) / 100 : null
  const porKg = usados.filter(r => r.modo === 'kg').map(r => numAR(r.precio))
  const precio_kg = usados.length > 0 && porKg.length === usados.length && porKg.every(p => p != null && p === porKg[0]) ? porKg[0]! : null
  const nota = usados.length > 1 || usados.some(r => r.modo === 'cabeza')
    ? `Renglones: ${usados.map(textoRenglon).join(' · ')}${monto != null ? ` → total $ ${fmt(monto)}` : ''}`
    : null
  // kilos totales sólo si TODOS los renglones los tienen: uno parcial daría un peso por cabeza falso (quedan en la nota)
  return { cabezas, kg: kgs.length > 0 && kgs.length === usados.length ? kgs.reduce((s, k) => s + k, 0) : null, monto, precio_kg, completo, nota }
}

/** Pura: el control caravanas + sin caravana = cabezas («✓» · «faltan N» · «sobran N»). */
export function controlCaravanas(tildadas: number, cabezas: number, sinCaravana = 0): { ok: boolean; texto: string } {
  const ident = tildadas + sinCaravana
  const detalle = sinCaravana > 0 ? `${tildadas} con caravana + ${sinCaravana} sin caravana` : `${tildadas} caravanas`
  if (ident === cabezas) return { ok: true, texto: `✓ ${detalle} = ${cabezas} cabezas` }
  const d = cabezas - ident
  return { ok: false, texto: d > 0 ? `faltan ${d}: ${detalle} de ${cabezas} cabezas` : `sobran ${-d}: ${detalle} para ${cabezas} cabezas` }
}
