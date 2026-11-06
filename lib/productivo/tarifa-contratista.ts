/**
 * 💲 **La tarifa del contratista, en todos los índices — para poder comparar** (A-FEAT-1557 etapa 4 / A-FEAT-1556).
 *
 * JMS 06/11: *«acá por lo general es dólar, kg de soja, litros de gas oil, % de la cosecha; pero se debe calcular
 * desde las facturas o desde el valor que pongo acordado en la contratación o la compra»* · *«el tema es convertir la
 * tarifa en pesos de cada contratista a su equivalente en los otros índices para poder comparar»*.
 *
 * ## La cuenta
 * Toda tarifa se lleva primero a **pesos por hectárea**, y de ahí a cada índice con el precio **a la fecha de la
 * orden** (no el de hoy: una labor de marzo se compara con la soja de marzo):
 *
 *     $/ha          = la tarifa, si se pactó en pesos
 *     USD/ha        = $/ha ÷ dólar BNA divisas
 *     kg soja/ha    = $/ha ÷ (soja pizarra Rosario ÷ 1000)
 *     l gasoil/ha   = $/ha ÷ precio del litro
 *     % de cosecha  = $/ha ÷ (rinde kg/ha × precio del grano del lote por kg) × 100
 *
 * Si falta un precio, ese índice queda vacío (`null`) — **no se inventa**: se ve que falta y se carga.
 *
 * ## De dónde sale cada precio (§ Default del dato real)
 * - dólar y soja: las cotizaciones que la app ya guarda día por día (`public.cotizaciones`), la última hasta la fecha;
 * - gasoil: no hay serie; se escribe a mano (y queda en el navegador para la próxima);
 * - rinde: el que se pone en el comparador (vacío = sin % de cosecha).
 *
 * ## Desde la factura
 * Si la orden tiene su factura del contratista, la tarifa REAL es **neto de la factura ÷ ha de todas las órdenes que
 * cobra** — y se compara contra la pactada (ha × tarifa). Es el mismo número por dos caminos: **avisa, no frena**
 * (puede haber un extra que sólo JMS conoce).
 *
 * Pura: no lee ni escribe la base. Casos en `npm run probar`.
 */

export type UnidadTarifa = 'ars_ha' | 'usd_ha' | 'kg_soja_ha' | 'l_gasoil_ha' | 'pct_cosecha'

export const UNIDADES_TARIFA: { id: UnidadTarifa; etiqueta: string; corto: string }[] = [
  { id: 'ars_ha', etiqueta: 'Pesos por ha', corto: '$/ha' },
  { id: 'usd_ha', etiqueta: 'Dólares por ha', corto: 'USD/ha' },
  { id: 'kg_soja_ha', etiqueta: 'Kg de soja por ha', corto: 'kg soja/ha' },
  { id: 'l_gasoil_ha', etiqueta: 'Litros de gasoil por ha', corto: 'l gasoil/ha' },
  { id: 'pct_cosecha', etiqueta: '% de la cosecha', corto: '% cosecha' },
]

export const esUnidadTarifa = (u: unknown): u is UnidadTarifa => UNIDADES_TARIFA.some(x => x.id === u)

/** Los precios a la fecha de la orden, en pesos. `null` = no hay dato. */
export interface PreciosIndices {
  /** $ por dólar (BNA divisas, venta). */
  usd: number | null
  /** $ por kg de soja (pizarra Rosario ÷ 1000). */
  sojaKg: number | null
  /** $ por litro de gasoil. */
  gasoilL: number | null
  /** $ por kg del grano que se cosecha (el cultivo del lote; si no se sabe, la soja). */
  granoKg: number | null
  /** Rinde de referencia, kg por ha. */
  rindeKgHa: number | null
}

const pos = (n: number | null | undefined): n is number => n != null && Number.isFinite(Number(n)) && Number(n) > 0

/** Cuántos pesos vale UNA unidad del índice, por ha. `null` si falta el precio. */
function pesosPorUnidad(unidad: UnidadTarifa, p: PreciosIndices): number | null {
  switch (unidad) {
    case 'ars_ha': return 1
    case 'usd_ha': return pos(p.usd) ? p.usd : null
    case 'kg_soja_ha': return pos(p.sojaKg) ? p.sojaKg : null
    case 'l_gasoil_ha': return pos(p.gasoilL) ? p.gasoilL : null
    // 1 % de la cosecha = 1/100 de (rinde × precio del grano)
    case 'pct_cosecha': return pos(p.rindeKgHa) && pos(p.granoKg) ? (p.rindeKgHa * p.granoKg) / 100 : null
  }
}

/** La tarifa pactada, llevada a pesos por ha. */
export function aPesosHa(tarifa: number | null, unidad: UnidadTarifa | null, p: PreciosIndices): number | null {
  if (!pos(tarifa) || !unidad) return null
  const f = pesosPorUnidad(unidad, p)
  return f == null ? null : Math.round(tarifa * f * 100) / 100
}

/** Unos pesos por ha, expresados en los cinco índices. */
export function equivalencias(pesosHa: number | null, p: PreciosIndices): Record<UnidadTarifa, number | null> {
  const out = {} as Record<UnidadTarifa, number | null>
  for (const u of UNIDADES_TARIFA) {
    const f = pesosHa == null ? null : pesosPorUnidad(u.id, p)
    out[u.id] = f == null || pesosHa == null ? null : Math.round((pesosHa / f) * 100) / 100
  }
  return out
}

/**
 * El valor de una serie a una fecha: la última cotización hasta ese día; si la fecha es anterior a toda la serie,
 * la primera (y se marca). Los ceros no son precio.
 */
export function precioAFecha(serie: { fecha: string; valor: number }[], fecha: string): { valor: number; fecha: string; anticipado: boolean } | null {
  let antes: { fecha: string; valor: number } | null = null
  let despues: { fecha: string; valor: number } | null = null
  for (const s of serie) {
    if (!pos(s.valor)) continue
    if (s.fecha <= fecha) { if (!antes || s.fecha > antes.fecha) antes = s }
    else if (!despues || s.fecha < despues.fecha) despues = s
  }
  if (antes) return { valor: Number(antes.valor), fecha: antes.fecha, anticipado: false }
  if (despues) return { valor: Number(despues.valor), fecha: despues.fecha, anticipado: true }
  return null
}

/**
 * La tarifa de la última vez para esa labor con ese contratista (§ Default del dato real: la orden nueva arranca con
 * lo último pactado, y se cambia ahí).
 */
export function ultimaTarifa(
  historial: { fecha: string; contratista_cuit: string | null; labor_id: number; tarifa: number | null; tarifa_unidad: string | null }[],
  cuit: string | null, laborId: number,
): { tarifa: number; unidad: UnidadTarifa } | null {
  if (!cuit) return null
  const c = cuit.replace(/\D/g, '')
  const h = historial
    .filter(x => x.labor_id === laborId && (x.contratista_cuit || '').replace(/\D/g, '') === c && pos(x.tarifa) && esUnidadTarifa(x.tarifa_unidad))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  return h ? { tarifa: Number(h.tarifa), unidad: h.tarifa_unidad as UnidadTarifa } : null
}

/**
 * La factura del contratista contra lo pactado: la factura cobra varias órdenes; lo esperado es Σ ha × $/ha pactado de
 * cada una. `realPesosHa` = neto ÷ ha totales. Avisa (no frena) si la diferencia pasa del 1 %.
 */
export function controlFacturaContratista(
  netoPesos: number,
  ordenes: { ha: number; pesosHaPactado: number | null }[],
): { haTotales: number; realPesosHa: number | null; esperado: number | null; dif: number | null; cierra: boolean | null } {
  const haTotales = Math.round(ordenes.reduce((s, o) => s + (Number(o.ha) || 0), 0) * 100) / 100
  const realPesosHa = haTotales > 0 ? Math.round((netoPesos / haTotales) * 100) / 100 : null
  const sinPactar = ordenes.some(o => o.pesosHaPactado == null)
  const esperado = sinPactar ? null : Math.round(ordenes.reduce((s, o) => s + o.ha * (o.pesosHaPactado as number), 0) * 100) / 100
  const dif = esperado == null ? null : Math.round((netoPesos - esperado) * 100) / 100
  const cierra = dif == null || esperado == null ? null : Math.abs(dif) <= Math.max(1, Math.abs(esperado) * 0.01)
  return { haTotales, realPesosHa, esperado, dif, cierra }
}
