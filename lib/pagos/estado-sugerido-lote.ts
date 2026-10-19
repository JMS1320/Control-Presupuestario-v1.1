/**
 * ➡️ El estado que PROPONE el botón PAGOS, según en qué estado está lo tildado (A-FEAT-1272).
 *
 * Pedido del usuario 2026-10-13: *«que el botón pagos que ofrece pasar a pagado ofrezca: si está en
 * pendiente pasar a pagar, si está en pagar ofrezca pasar a pagado. Por default digamos»*.
 * Antes proponía siempre «pagado», así que el primer paso de un pago (pendiente → pagar) obligaba a
 * cambiar el desplegable todas las veces — y olvidarlo saltea SICORE.
 *
 * Es el paso SIGUIENTE del circuito, y sólo cuando lo tildado está todo en el mismo punto:
 *
 * | Lo tildado está en… | Propone |
 * |---|---|
 * | pendiente | pagar |
 * | pagar · preparado · programado | pagado |
 * | mezclado, o en otro estado | nada (`null`): queda lo que estaba |
 *
 * Es un DEFAULT, no una regla: el usuario lo puede cambiar, y una vez que lo cambió a mano no se le
 * vuelve a pisar mientras siga en el modo PAGOS.
 */
const SIGUIENTE: Record<string, string> = {
  pendiente: 'pagar',
  pagar: 'pagado',
  preparado: 'pagado',
  programado: 'pagado',
}

export function estadoSugeridoParaLote(estados: readonly (string | null | undefined)[]): string | null {
  if (estados.length === 0) return null
  const destinos = new Set(estados.map(e => SIGUIENTE[String(e ?? '').toLowerCase()] ?? ''))
  if (destinos.size !== 1) return null
  const unico = [...destinos][0]
  return unico || null
}
