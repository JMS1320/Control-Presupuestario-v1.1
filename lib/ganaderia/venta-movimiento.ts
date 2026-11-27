/**
 * 🐄 La venta cargada desde Productivo → Hacienda → Nuevo movimiento → Venta (A-FEAT-1671).
 *
 * JMS 27/11: «cuando quiero registrar una venta no me pide las caravanas… sí, que lo pida en el mismo paso y dar la opción de
 * precio por cabeza».
 *  - Las caravanas se eligen EN el mismo paso para cualquier categoría con animales identificados (antes sólo la CUT); quedan
 *    vendidas y colgadas de la venta, igual que con «Completar venta».
 *  - El precio puede ser **por kg** (como siempre) o **por cabeza** (toros, vacas de cría): el importe = precio × cabezas.
 *    Por cabeza NO se guarda un $/kg inventado: la venta queda con su importe escrito (así la abre «Completar venta») y el
 *    precio por cabeza en sus notas.
 */

export type ModoPrecio = 'kg' | 'cabeza'

const num = (v: string | number | null | undefined): number | null => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Pura: lo que se guarda de precio e importe.
 *  - por kg: precio_kg el escrito; importe el escrito o, si no hay, kg × precio.
 *  - por cabeza: precio_kg null; importe = precio por cabeza × cabezas; nota con el detalle.
 */
export function precioDeVenta(a: {
  modo: ModoPrecio; cabezas: number; kg?: string | number | null; precioKg?: string | number | null
  montoEscrito?: string | number | null; precioCabeza?: string | number | null
}): { precio_kg: number | null; monto: number | null; nota: string | null } {
  if (a.modo === 'cabeza') {
    const pc = num(a.precioCabeza)
    if (pc == null || !(a.cabezas > 0)) return { precio_kg: null, monto: num(a.montoEscrito), nota: null }
    const monto = Math.round(pc * a.cabezas * 100) / 100
    const f = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return { precio_kg: null, monto, nota: `Precio por cabeza: $ ${f(pc)} × ${a.cabezas} = $ ${f(monto)}` }
  }
  const pk = num(a.precioKg), kg = num(a.kg), m = num(a.montoEscrito)
  return { precio_kg: pk, monto: m ?? (pk != null && kg != null ? Math.round(pk * kg * 100) / 100 : null), nota: null }
}

/** Pura: el control caravanas tildadas = cabezas («ok» · «faltan N» · «sobran N»). */
export function controlCaravanas(tildadas: number, cabezas: number): { ok: boolean; texto: string } {
  if (tildadas === cabezas) return { ok: true, texto: `✓ ${tildadas} caravanas = ${cabezas} cabezas` }
  const d = cabezas - tildadas
  return { ok: false, texto: d > 0 ? `faltan ${d} caravana(s): tildaste ${tildadas} de ${cabezas} cabezas` : `sobran ${-d} caravana(s): tildaste ${tildadas} para ${cabezas} cabezas` }
}
