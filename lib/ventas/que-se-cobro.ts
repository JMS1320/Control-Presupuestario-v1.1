/**
 * 📝 **Qué se cobró — el texto del DETALLE de un cobro conciliado** (A-FEAT-1257, 2026-10-05).
 *
 * Pedido del usuario: *«que en detalle ponga la cuota que se cobró; si es un cobro parcial, lo ponga así
 * — para los cobros de arrendamiento en general… y para las ventas de ganadería, las cabezas vendidas»*.
 *
 *     arrendamiento   →  «Cuota 1/4»  ·  «Cobro parcial cuota 1/4 (falta $5.000,00)»
 *     hacienda        →  «3 Toro + 7 Vaca CUT = 10 cab.»
 *
 * El dato sale del vínculo factura ↔ venta (`public.ventas_facturas`): de la venta de arrendamiento a
 * su cuota del contrato; de la de hacienda a `productivo.stock_ventas` (cantidad y categoría). Sin
 * vínculo no hay nada que decir y devuelve `null` — no se inventa.
 *
 * La parte pura (`textoQueSeCobro`) se prueba con números; la de base la arma desde las tablas.
 */

export interface QueSeCobro {
  cuotas: { numero: number; de: number }[]
  cabezas: { cantidad: number; categoria: string }[]
  /** Lo que falta cobrar del comprobante después de este cobro (> 0 = cobro parcial). */
  falta: number
}

const pesos = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function textoQueSeCobro(q: QueSeCobro): string | null {
  const partes: string[] = []
  const parcial = q.falta > 0.01
  if (q.cuotas.length) {
    const cs = q.cuotas.map(c => `${c.numero}/${c.de}`).join(', ')
    const pal = q.cuotas.length > 1 ? 'cuotas' : 'cuota'
    partes.push(parcial ? `Cobro parcial ${pal} ${cs} (falta ${pesos(q.falta)})` : `${pal[0].toUpperCase()}${pal.slice(1)} ${cs}`)
  }
  if (q.cabezas.length) {
    // Se agrupan por categoría: dos ventas de Toro en la misma liquidación son «6 Toro».
    const porCat = new Map<string, number>()
    for (const c of q.cabezas) porCat.set(c.categoria, (porCat.get(c.categoria) || 0) + (Number(c.cantidad) || 0))
    const total = [...porCat.values()].reduce((s, n) => s + n, 0)
    const lista = [...porCat.entries()].map(([cat, n]) => cat ? `${n} ${cat}` : `${n} sin categoría`)
    const unica = [...porCat.keys()][0]
    partes.push(lista.length > 1 ? `${lista.join(' + ')} = ${total} cab.` : `${total} cab.${unica ? ' ' + unica : ''}`)
    if (parcial && !q.cuotas.length) partes.push(`cobro parcial (falta ${pesos(q.falta)})`)
  }
  return partes.length ? partes.join(' · ') : null
}

/**
 * Suma el texto al detalle que ya tiene el movimiento **sin pisar lo que escribió el usuario**: si está
 * vacío, va solo; si ya lo dice, no se repite; si tiene otra cosa, se agrega al final.
 */
export function detalleConQueSeCobro(actual: string | null | undefined, texto: string | null): string | null {
  const a = (actual || '').trim()
  if (!texto) return a || null
  if (!a) return texto
  if (a.includes(texto)) return a
  return `${a} · ${texto}`
}
