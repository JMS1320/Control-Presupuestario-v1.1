/**
 * 🔎 **¿Hay que traer la cuenta ENTERA para filtrar?** — A-BUG-1404 (recaída de A-BUG-162 y A-BUG-189).
 *
 * Nota 🌙 de JMS 2026-10-27 (Extracto → Movimientos): *«está filtrando sólo sobre los 200 movimientos
 * default. Esto ya lo habíamos hablado mucho, hay que arreglarlo»*.
 *
 * ## Por qué volvió (las dos causas, las dos medidas en el código)
 * 1. **La carga completa era de UNA sola vez** (un `ref` que quedaba en `true`). Después, cualquier chip
 *    (Pendientes, Auditar, Conciliados…) o «Filtrar» volvía a traer con el límite de 200, y el buscador
 *    seguía creyendo que tenía la cuenta entera → buscaba en 200 sin decirlo.
 * 2. **Los chips de CATEG filtran en memoria** y nunca estuvieron en la lista. Y el filtro de contraparte
 *    se evaluaba como `!!filtroProveedor`, que es un objeto: siempre verdadero.
 *
 * ## La regla, en un solo lugar
 * Todo filtro que trabaja sobre lo CARGADO (texto, contraparte, categorías, «OK masivo de auditar»)
 * entra en `filtrosEnMemoria`. Si alguno está puesto:
 * - toda carga se pide con `LIMITE_TODO` (`limiteParaCargar`), y
 * - si la última carga fue con menos y vino llena (o sea, recortada), se vuelve a traer (`hayQueTraerTodo`).
 * 🔑 **Cualquier filtro en memoria nuevo tiene que entrar acá**, o repite el bug por sexta vez.
 */
export const LIMITE_TODO = 5000

export interface FiltrosEnMemoria {
  busqueda?: string
  proveedor?: { cuit?: string; nombre?: string } | null
  categs?: Set<string> | null
  okAuditar?: boolean
  /** 🔗 A-FEAT-1430: sólo estos movimientos (los pidió un link desde el balance). */
  ids?: Set<string> | null
  /** 🔽 A-FEAT-1456: los filtros por columna (tipo Excel) del encabezado de la tabla. */
  columnas?: Record<string, Set<string> | null> | null
}

export function filtrosEnMemoria(f: FiltrosEnMemoria): boolean {
  return !!(f.busqueda || "").trim()
    || !!((f.proveedor?.cuit || "").trim() || (f.proveedor?.nombre || "").trim())
    || !!f.categs // null = sin filtro; un conjunto (aunque sea vacío) filtra lo cargado
    || !!f.okAuditar
    || !!(f.ids && f.ids.size)
    || Object.values(f.columnas ?? {}).some(s => s != null)
}

/** El límite con que se pide una carga: si hay filtros en memoria, la cuenta entera. */
export const limiteParaCargar = (limiteElegido: number, f: FiltrosEnMemoria) =>
  filtrosEnMemoria(f) ? Math.max(limiteElegido, LIMITE_TODO) : limiteElegido

/**
 * ¿Hace falta volver a traer? Sí, si hay filtros en memoria y lo cargado está RECORTADO: la última
 * carga fue con un límite menor al de «todo» y trajo tantas filas como ese límite.
 */
export function hayQueTraerTodo(f: FiltrosEnMemoria, ultimoLimite: number | undefined, cargados: number): boolean {
  if (!filtrosEnMemoria(f)) return false
  const lim = ultimoLimite ?? 0
  if (lim >= LIMITE_TODO) return false
  return cargados >= lim
}

/**
 * 🧷 A-BUG-1460 — ¿una fila PEGADA de la corrida sigue a la vista? Se salta los filtros que ya estaban al conciliar (la
 * corrida le cambió el estado o la categ y no tiene que irse antes de revisarla), pero respeta CATEG y fechas si el
 * usuario los cambió DESPUÉS. JMS 31/10: «si refresco sí filtra por categs, pero no luego de haber conciliado».
 */
export function pegadaSigueVisible(
  m: { categ?: string | null; fecha?: string | null },
  f: { categCambio: boolean; categs: Set<string> | null; fechasCambio: boolean; usarFechas: boolean; desde?: string; hasta?: string },
): boolean {
  if (f.categCambio && f.categs && !f.categs.has(m.categ || "(sin categ)")) return false
  if (f.fechasCambio && f.usarFechas) {
    const d = String(m.fecha ?? "")
    if ((f.desde && d < f.desde) || (f.hasta && d > f.hasta)) return false
  }
  return true
}
