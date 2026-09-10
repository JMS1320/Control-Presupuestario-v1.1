/**
 * 🧭 Si el tablero está abierto o no — **fuera del componente** (A-BUG-144).
 *
 * ## Por qué no es un `useState` adentro del panel
 * Porque el panel **se desmonta justo cuando hace falta que sobreviva**. La cadena, medida el
 * 2026-09-10:
 *
 * ```
 * ↩ Al tablero  →  alTablero()  →  EVENTO_VOLVI
 *                                    → tab-presupuesto recalcula → setCargando(true)
 *                                      → `if (cargando) return <spinner/>`
 *                                        → PanelHuecosPresupuesto DESMONTADO
 *                                          → el setAbierto(true) muere con él
 * ```
 *
 * El botón hacía todo bien y el tablero no aparecía. **El pedido de abrir y el recálculo que lo
 * borra viajan en el mismo evento**, así que no hay orden de listeners que lo salve: el estado
 * tiene que vivir donde el recálculo no llega.
 *
 * 🔑 **Es exactamente la razón por la que `recorrido.ts` es un store de módulo** —*«el viaje cruza
 * pantallas; si viviera dentro del Presupuesto desaparecería justo al dar el primer paso»*— y yo
 * la repetí una capa más abajo. Cuando un estado tiene que sobrevivir a un recálculo, **no puede
 * vivir en el componente que el recálculo desmonta**.
 *
 * Lo encontró Playwright la primera vez que se corrió, apretando el botón con el bug ya declarado
 * cerrado ([A-BUG-131](../../PENDIENTES.md#a-bug-131) → [A-BUG-144](../../PENDIENTES.md#a-bug-144)).
 */

let abierto = false
const oyentes = new Set<() => void>()

function avisar() {
  for (const o of oyentes) o()
}

export function suscribirTablero(f: () => void) {
  oyentes.add(f)
  return () => { oyentes.delete(f) }
}

/** Para `useSyncExternalStore`: devuelve un booleano, que es estable por valor. */
export function mirarTablero() {
  return abierto
}

export function abrirTablero() {
  if (abierto) return
  abierto = true
  avisar()
}

export function cerrarTablero() {
  if (!abierto) return
  abierto = false
  avisar()
}
