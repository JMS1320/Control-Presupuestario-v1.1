/**
 * 🔽 FILTRO POR COLUMNA, tipo Excel — la lógica (A-FEAT-1441, JMS 31/10: «abro el filtro De/Para y veo la lista sin
 * repetir de los interlocutores; rápidamente veo si hay mail recibido de tal o no»).
 *
 * El componente es `components/ui/filtro-columna.tsx`. Se escribió para Mails; el de CATEG del Extracto
 * (`vista-extracto-bancario.tsx`) está hecho a mano adentro de la pantalla y tiene que pasar a éste (§ ♻️ Centralizar).
 *
 * Una selección `null` = sin filtro (todas). Un Set vacío = ninguna.
 */

export interface OpcionColumna { valor: string; etiqueta: string; cuenta: number }

/** Lo que muestra la lista para una fila sin valor. */
export const VACIO_COLUMNA = "(vacío)"

/** Pura: los valores SIN REPETIR de una columna, con cuántas filas tiene cada uno, ordenados por etiqueta. */
export function opcionesDeColumna<T>(filas: T[], valorDe: (f: T) => string | null | undefined, etiquetaDe?: (valor: string, f: T) => string): OpcionColumna[] {
  const m = new Map<string, OpcionColumna>()
  for (const f of filas) {
    const v = valorDe(f) || VACIO_COLUMNA
    const o = m.get(v)
    if (o) o.cuenta++
    else m.set(v, { valor: v, etiqueta: v === VACIO_COLUMNA ? VACIO_COLUMNA : (etiquetaDe ? etiquetaDe(v, f) : v), cuenta: 1 })
  }
  return [...m.values()].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es", { sensitivity: "base" }))
}

/** Pura: si una fila pasa el filtro de una columna. */
export function pasaColumna(valor: string | null | undefined, seleccion: Set<string> | null): boolean {
  return !seleccion || seleccion.has(valor || VACIO_COLUMNA)
}

/** Pura: filtra por varias columnas a la vez. `valores[col](fila)` da el valor de la fila en esa columna. */
export function filtrarPorColumnas<T>(filas: T[], filtros: Record<string, Set<string> | null>, valores: Record<string, (f: T) => string | null | undefined>): T[] {
  const activos = Object.entries(filtros).filter(([, s]) => s)
  if (!activos.length) return filas
  return filas.filter(f => activos.every(([col, s]) => pasaColumna(valores[col]?.(f), s)))
}

/**
 * Pura: lo que queda filtrado al aceptar CON TEXTO EN EL BUSCADOR, como Excel (nota 🌙 JMS 10/11 en el Extracto: «acá si
 * filtro por nombre por default desselecciona lo que no coincide; acá me dejó lo anterior más lo que seleccioné»).
 * Sólo cuentan los valores que coinciden con la búsqueda y están tildados; lo que no coincide sale del filtro.
 * `marcadas` null = todas las que coinciden (así arranca la lista al escribir).
 */
export function seleccionConBusqueda(todas: string[], visibles: string[], marcadas: Set<string> | null): Set<string> | null {
  const elegidas = visibles.filter(v => !marcadas || marcadas.has(v))
  return elegidas.length === todas.length ? null : new Set(elegidas)
}
