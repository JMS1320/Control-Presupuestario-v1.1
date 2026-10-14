/**
 * 📐 **El ancho y el orden de las columnas del Cash Flow, como los deja el usuario** (A-FEAT-1277).
 *
 * Pedido del usuario 2026-10-14: *«si yo achico o agrando las columnas en vivo, las cambio de
 * lugar, ¿la app recordaría mi seteo? Si es así esa sería la solución»*. Se guarda en las
 * preferencias de la cuenta (`user_metadata.preferencias.columnasCashFlow`), así que lo sigue en
 * cualquier computadora.
 *
 * Es la § 🎚️ *Default del dato real* aplicada a la vista: sin tocar nada, el orden y los anchos de
 * siempre; lo que el usuario mueve es un override **disperso** (sólo lo que tocó), para que una
 * columna nueva aparezca sola en su lugar en vez de quedar afuera de una lista congelada.
 */

export interface ColumnasUsuario {
  /** El orden que eligió, por clave de columna. Vacío = el de siempre. */
  orden: string[]
  /** Sólo las columnas a las que les cambió el ancho, en píxeles. */
  anchos: Record<string, number>
}

export const ANCHO_MIN = 40
export const ANCHO_MAX = 800

export const anchoValido = (px: number) => Math.round(Math.min(Math.max(px, ANCHO_MIN), ANCHO_MAX))

/**
 * Las columnas en el orden del usuario. Una clave guardada que ya no existe se ignora; una
 * columna nueva (que el usuario nunca vio) entra en su lugar de siempre.
 */
export function ordenarColumnas<T extends { key: string }>(columnas: readonly T[], orden: readonly string[]): T[] {
  const porClave = new Map(columnas.map(c => [c.key, c]))
  const resultado: T[] = []
  for (const k of orden) {
    const c = porClave.get(k)
    if (c && !resultado.includes(c)) resultado.push(c)
  }
  columnas.forEach((c, i) => {
    if (!resultado.includes(c)) resultado.splice(Math.min(i, resultado.length), 0, c)
  })
  return resultado
}

/** Mueve `clave` antes o después de `destino`. Devuelve el orden completo nuevo. */
export function moverColumna(ordenActual: readonly string[], clave: string, destino: string, lado: 'antes' | 'despues'): string[] {
  if (clave === destino) return [...ordenActual]
  const sin = ordenActual.filter(k => k !== clave)
  const i = sin.indexOf(destino)
  if (i < 0) return [...ordenActual]
  sin.splice(lado === 'antes' ? i : i + 1, 0, clave)
  return sin
}

/** Lee lo guardado sin confiar en la forma: es JSON que el propio usuario puede escribir. */
export function leerColumnasUsuario(crudo: unknown): ColumnasUsuario | null {
  if (!crudo || typeof crudo !== 'object') return null
  const c = crudo as Record<string, unknown>
  const orden = Array.isArray(c.orden) ? (c.orden as unknown[]).filter((k): k is string => typeof k === 'string') : []
  const anchos: Record<string, number> = {}
  if (c.anchos && typeof c.anchos === 'object') {
    for (const [k, v] of Object.entries(c.anchos as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) anchos[k] = anchoValido(v)
    }
  }
  if (orden.length === 0 && Object.keys(anchos).length === 0) return null
  return { orden, anchos }
}
