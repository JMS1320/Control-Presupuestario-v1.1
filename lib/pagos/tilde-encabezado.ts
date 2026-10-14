/**
 * ☑️ El tilde del encabezado del modo PAGOS: «todo lo que se ve» (A-FEAT-1268).
 *
 * Nota del usuario 2026-10-13: *seleccionar todo lo filtrado en PAGOS*. El botón «Seleccionar todas»
 * ya tomaba sólo lo filtrado, pero vivía en la barra, lejos de la columna de tildes. El tilde del
 * encabezado es donde se lo busca, y como toda casilla de «todos» tiene tres estados.
 *
 * Se cuenta contra lo que SE VE: una fila tildada que dejó de verse no existe para esta casilla
 * (A-BUG-177 ya la suelta al filtrar).
 */
export type EstadoTildeTodas = 'todas' | 'algunas' | 'ninguna'

export function estadoTildeTodas(visibles: readonly string[], seleccionadas: ReadonlySet<string>): EstadoTildeTodas {
  if (visibles.length === 0) return 'ninguna'
  const tildadas = visibles.filter(id => seleccionadas.has(id)).length
  if (tildadas === 0) return 'ninguna'
  return tildadas === visibles.length ? 'todas' : 'algunas'
}

/** Click en la casilla: con todas tildadas, las suelta; si no, tilda todas las que se ven. */
export function seleccionTrasClickTodas(visibles: readonly string[], seleccionadas: ReadonlySet<string>): Set<string> {
  return estadoTildeTodas(visibles, seleccionadas) === 'todas' ? new Set() : new Set(visibles)
}
