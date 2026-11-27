/**
 * ✂️ LAS VENTAS PARCIALES de un lote — A-FEAT-1675 (JMS 27/11: «dividir la venta presupuestada de novillos y vaquillonas de feed lot en 2 ventas…
 * ahora 13 novillos + 9 vaquillonas y luego el resto… luego puedo convertirlo en una venta firme editando los datos reales»).
 *
 * Un lote tiene su venta principal (`fecha_venta_estimada`: lo que quede) y N ventas parciales presupuestadas (`productivo.lote_ventas_plan`).
 *  · **Valuación (A):** el lote se parte en piezas — cada parcial PENDIENTE es un «sub-lote» con sus cabezas a su fecha (peso / precio / plazo
 *    propios si se cargaron; si no, los del lote) y el resto queda a la fecha del lote. Una parcial CONFIRMADA (`venta_id`) ya no se proyecta:
 *    cuenta su venta firme (que además descuenta cabezas del lote, como siempre).
 *  · **Ración (C):** las cabezas que comen bajan desde la fecha de cada venta (parcial pendiente o firme): el tramo se corta en esas fechas.
 * Pura. Casos en `npm run probar`.
 */

export interface VentaParcial {
  id: string
  lote_id: string
  fecha_venta: string
  cabezas: number
  peso_kg: number | null
  precio_kg: number | null
  plazo_cobro: string | null
  venta_id: string | null
}

export interface PiezaDeLote<L> {
  lote: L
  /** Las ventas firmes a descontar de ESTA pieza (sólo el resto lleva las del lote). */
  ventas: { cantidad: number }[]
  /** null = el resto del lote; si no, la parcial que representa. */
  parcial: VentaParcial | null
  /** true si la pieza trae su propio peso a la fecha de venta (no hay que usar la curva del lote). */
  pesoPropio: boolean
}

type LoteMin = { id: string; cantidad: number | string; fecha_venta_estimada?: string | null; precio_kg_override?: number | string | null; plazo_cobro?: string | null; peso_base_kg?: number | string; fecha_peso?: string | null }

/** Las piezas de un lote para valuar su venta: el resto (a la fecha del lote) + una por cada parcial pendiente. */
export function piezasDeLote<L extends LoteMin>(lote: L, parciales: VentaParcial[], ventasFirmes: { cantidad: number }[]): PiezaDeLote<L>[] {
  const pend = parciales.filter(p => p.lote_id === lote.id && !p.venta_id && Number(p.cabezas) > 0)
  const enParciales = pend.reduce((t, p) => t + Number(p.cabezas), 0)
  const piezas: PiezaDeLote<L>[] = []
  const resto = (Number(lote.cantidad) || 0) - enParciales
  piezas.push({ lote: { ...lote, cantidad: Math.max(0, resto) }, ventas: ventasFirmes, parcial: null, pesoPropio: false })
  for (const p of pend) {
    const conPeso = p.peso_kg != null && Number(p.peso_kg) > 0
    piezas.push({
      lote: {
        ...lote, cantidad: Number(p.cabezas), fecha_venta_estimada: p.fecha_venta,
        precio_kg_override: p.precio_kg != null ? Number(p.precio_kg) : lote.precio_kg_override,
        plazo_cobro: p.plazo_cobro ?? lote.plazo_cobro,
        ...(conPeso ? { peso_base_kg: Number(p.peso_kg), fecha_peso: p.fecha_venta } : {}),
      },
      ventas: [], parcial: p, pesoPropio: conPeso,
    })
  }
  return piezas
}

/** Las fechas en que el lote pierde cabezas: cada parcial pendiente y cada venta firme del lote. */
export function cortesDeVenta(loteId: string, parciales: VentaParcial[], ventasFirmes: { lote_id: string | null; fecha_venta: string; cantidad: number }[]): { fecha: string; cabezas: number }[] {
  return [
    ...parciales.filter(p => p.lote_id === loteId && !p.venta_id).map(p => ({ fecha: p.fecha_venta, cabezas: Number(p.cabezas) || 0 })),
    ...ventasFirmes.filter(v => v.lote_id === loteId).map(v => ({ fecha: String(v.fecha_venta).slice(0, 10), cabezas: Number(v.cantidad) || 0 })),
  ].filter(c => c.cabezas > 0).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

const dias = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000)

/**
 * Corta un tramo de ración en las fechas de venta: cada segmento come con las cabezas que QUEDAN (las vendidas antes del segmento salen).
 * El peso inicial de cada segmento avanza con la ganancia diaria de la actividad (la misma que usa `consumoMensual`). Un corte el mismo día
 * que arranca el tramo ya descuenta desde el primer día (el día de la venta no comen).
 */
export function cortarTramoPorVentas<T extends { desde: string; hasta: string; cabezas: number; peso_inicial_kg: number; actividad: { ganancia_diaria_kg: number } }>(
  t: T, cortes: { fecha: string; cabezas: number }[],
): T[] {
  if (!cortes.length) return [t]
  const antes = cortes.filter(c => c.fecha <= t.desde).reduce((s, c) => s + c.cabezas, 0)
  const dentro = cortes.filter(c => c.fecha > t.desde && c.fecha < t.hasta)
  const g = Number(t.actividad?.ganancia_diaria_kg) || 0
  const out: T[] = []
  let ini = t.desde, cab = t.cabezas - antes
  for (const c of [...dentro, null]) {
    const fin = c ? c.fecha : t.hasta
    if (fin > ini && cab > 0.0001) out.push({ ...t, desde: ini, hasta: fin, cabezas: cab, peso_inicial_kg: t.peso_inicial_kg + g * dias(t.desde, ini) })
    if (c) { cab -= c.cabezas; ini = c.fecha }
  }
  return out
}
