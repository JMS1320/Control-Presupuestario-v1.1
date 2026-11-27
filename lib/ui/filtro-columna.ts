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

// ── 📋 PEGAR UNA LISTA desde Excel (A-FEAT-1668, JMS 26/11: «copiar las 7 celdas del Excel, en vertical, pegarlas en el
// filtro y que el sistema reconozca que quiero ver esas 7, preseleccionadas, y con OK me las filtre») ───────────────────

/** Pura: la forma de comparar un valor pegado contra uno de la lista — sin espacios ni mayúsculas. */
export function compactar(s: string): string {
  return String(s ?? "").toLowerCase().replace(/\s+/g, "")
}

/**
 * Pura: si lo pegado es una LISTA (varias celdas: un renglón por celda, o separadas por tab), sus valores sin vacíos y sin
 * repetir. Un solo valor → null (se usa como búsqueda común).
 */
export function listaPegada(texto: string): string[] | null {
  const partes = String(texto ?? "").split(/[\r\n\t]+/).map(s => s.trim()).filter(Boolean)
  const unicas = [...new Set(partes)]
  return unicas.length >= 2 ? unicas : null
}

/** Pura: clave de cruce. Si es sólo número, sin los ceros de adelante (Excel come el 0 de `032 010012326481`). */
function claveCruce(s: string): string {
  const c = compactar(s)
  return /^\d+$/.test(c) ? c.replace(/^0+(?=\d)/, "") : c
}

/**
 * Pura: cruza lo pegado contra las opciones de la columna. Cada pegado matchea por valor o etiqueta, sin espacios, y si es
 * número también sin los ceros de adelante. Devuelve los valores encontrados y los pegados que no están (nunca se descartan
 * en silencio: la pantalla los muestra).
 */
export function cruzarPegadas(pegadas: string[], opciones: OpcionColumna[]): { encontradas: Set<string>; noEncontradas: string[] } {
  const indice = new Map<string, string[]>()
  for (const o of opciones) for (const k of new Set([claveCruce(o.valor), claveCruce(o.etiqueta)])) {
    const l = indice.get(k) ?? []; l.push(o.valor); indice.set(k, l)
  }
  const encontradas = new Set<string>()
  const noEncontradas: string[] = []
  for (const p of pegadas) {
    const vs = indice.get(claveCruce(p))
    if (vs) vs.forEach(v => encontradas.add(v)); else noEncontradas.push(p)
  }
  return { encontradas, noEncontradas }
}

/** Pura: si una opción coincide con lo escrito en el buscador — también sin espacios (escribir `32010012326` encuentra `032 010012326…`). */
export function coincideBusqueda(o: OpcionColumna, q: string): boolean {
  const t = q.trim().toLowerCase()
  if (!t) return true
  if (o.etiqueta.toLowerCase().includes(t) || o.valor.toLowerCase().includes(t)) return true
  const c = compactar(t)
  return !!c && (compactar(o.etiqueta).includes(c) || compactar(o.valor).includes(c))
}
