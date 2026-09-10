/**
 * 🧭 LA MÁQUINA DEL RECORRIDO — ir, volver, seguir, y ver cuánto falta.
 *
 * ## Qué convierte una lista en un viaje
 * El tablero de huecos ya dice **qué falta**. Con eso solo, resolver cada uno es: tablero → entrar →
 * resolver → volver al tablero → buscar el siguiente → entrar. **Cinco pasos, y tres son navegación.**
 * Eso es exactamente los *«5 botones»* de la nota del usuario, con otra ropa.
 *
 * Con esto es: resolver → **siguiente** → resolver → siguiente. Su frase: *«5 botones son 1 botón
 * que te lleva por los 5 lugares»*.
 *
 * ## Por qué vive acá y no adentro del Presupuesto
 * 🔴 **Porque el viaje cruza pantallas.** La solapa del Presupuesto **se desmonta** cuando navegás a
 * Egresos, y con ella se iría el estado del recorrido — se perdería justo al dar el primer paso.
 * Un store a nivel módulo sobrevive a eso sin obligar a envolver la app en un provider.
 *
 * ## Lo que NO hace
 * ⚠️ No resuelve nada ni escribe el dato. **Lleva y trae.** Lo que se resuelve, se resuelve en la
 * pantalla dueña, con sus validaciones — *«no debemos tener que escribir scripts sino vínculos»*.
 */

import type { Hueco } from '../presupuesto/padron'

/** Las solapas de `dashboard.tsx`. Es el destino de un salto. */
export type Seccion =
  | 'principal' | 'dashboard' | 'distribucion' | 'reporte' | 'egresos' | 'ingresos'
  | 'cashflow' | 'extracto' | 'productivo' | 'sueldos' | 'presupuesto' | 'importar'

/**
 * A qué solapa lleva cada dominio.
 *
 * 📌 Está acá y no adentro de cada hueco a propósito: el padrón describe **qué falta**, no cómo está
 * organizada la app. Si mañana la hacienda se mueve de solapa, se cambia este mapa y nada más.
 */
const SECCION_POR_DOMINIO: Record<string, Seccion> = {
  hacienda: 'presupuesto',
  cuentas: 'presupuesto',
  templates: 'egresos',
  arrendamientos: 'ingresos',
  sueldos: 'sueldos',
}

export function seccionDe(h: Hueco): Seccion {
  return SECCION_POR_DOMINIO[h.dominio] ?? 'presupuesto'
}

/** El evento con el que cualquier pantalla pide ir a otra. Lo escucha `dashboard.tsx`. */
export const EVENTO_IR = 'recorrido:ir-a-seccion'

export function irASeccion(s: Seccion) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENTO_IR, { detail: s }))
}

/**
 * El evento que avisa **que se volvió de resolver algo**.
 *
 * 🔴 Es la parte delicada del viaje: al volver, el presupuesto tiene que **recalcularse**. Si no, se
 * carga la venta, se vuelve, y el hueco sigue ahí — y en ese momento es imposible saber si falló la
 * carga o si el tablero quedó viejo. **Esa duda es exactamente la que hace perder la tarde.**
 */
export const EVENTO_VOLVI = 'recorrido:volvi'

export function avisarQueVolvi() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENTO_VOLVI))
}

export interface EstadoRecorrido {
  activo: boolean
  huecos: Hueco[]
  /** En cuál está parado. `-1` = mirando el tablero, sin entrar a ninguno. */
  indice: number
  /** Claves ya visitadas. **Visitado no es resuelto**: se pasó por ahí, nada más. */
  visitados: string[]
  arrancoEn: string | null
}

const VACIO: EstadoRecorrido = { activo: false, huecos: [], indice: -1, visitados: [], arrancoEn: null }

let estado: EstadoRecorrido = VACIO
const oyentes = new Set<() => void>()

function cambiar(nuevo: EstadoRecorrido) {
  estado = nuevo
  for (const f of oyentes) f()
}

export function suscribir(f: () => void) {
  oyentes.add(f)
  return () => { oyentes.delete(f) }
}

/** La foto actual. Referencia estable mientras no cambie — lo que `useSyncExternalStore` necesita. */
export function mirar(): EstadoRecorrido { return estado }

/** Arranca el viaje con los huecos que se van a caminar, en el orden en que se van a caminar. */
export function arrancar(huecos: Hueco[]) {
  cambiar({
    activo: true, huecos, indice: -1, visitados: [],
    arrancoEn: new Date().toISOString(),
  })
}

/** Entra a uno puntual — desde el tablero, salteando el orden. */
export function irAlHueco(clave: string) {
  const i = estado.huecos.findIndex(h => h.clave === clave)
  if (i < 0) return
  cambiar({ ...estado, indice: i, visitados: [...new Set([...estado.visitados, clave])] })
  irASeccion(seccionDe(estado.huecos[i]))
}

/**
 * El siguiente **que todavía está abierto**.
 *
 * 🔑 Se saltean los que ya se resolvieron o se callaron mientras caminabas. Si el «siguiente» te
 * llevara a algo que ya arreglaste, el recorrido se sentiría roto — y con razón.
 */
export function siguiente(sigueAbierto: (h: Hueco) => boolean) {
  const desde = estado.indice + 1
  let i = estado.huecos.findIndex((h, k) => k >= desde && sigueAbierto(h))

  // 🔴 **Y si no hay más adelante, se vuelve al principio.**
  //
  // Sin esto, caminar hasta el final salteando cosas dejaba el recorrido diciendo «no queda ningún
  // hueco abierto» **con varios abiertos atrás** — lo detectó el propio test. Un recorrido que se
  // declara terminado con trabajo pendiente es peor que uno que no termina nunca: el primero miente.
  //
  // Da la vuelta en silencio: el que salteó algo lo hizo porque no podía resolverlo en ese momento,
  // no porque quisiera abandonarlo. Y si de verdad no va, se calla — que es la salida limpia.
  if (i < 0) i = estado.huecos.findIndex(sigueAbierto)

  if (i < 0) { cambiar({ ...estado, indice: estado.huecos.length }); return }
  cambiar({ ...estado, indice: i, visitados: [...new Set([...estado.visitados, estado.huecos[i].clave])] })
  irASeccion(seccionDe(estado.huecos[i]))
}

/** Vuelve al tablero sin cortar el viaje. Y avisa, para que el presupuesto se rehaga. */
export function alTablero() {
  cambiar({ ...estado, indice: -1 })
  irASeccion('presupuesto')
  avisarQueVolvi()
}

export function terminar() { cambiar(VACIO) }

/** Reemplaza los huecos manteniendo dónde estabas — para cuando el tablero se recalcula. */
export function refrescar(huecos: Hueco[]) {
  if (!estado.activo) return
  const actual = estado.huecos[estado.indice]?.clave
  const i = actual ? huecos.findIndex(h => h.clave === actual) : estado.indice
  cambiar({ ...estado, huecos, indice: i < 0 ? -1 : i })
}

export interface Avance {
  total: number
  /** Cuántos ya no están abiertos — resueltos o callados. Es **el avance real**. */
  hechos: number
  /** En cuál va, contando desde 1. `0` si está en el tablero. */
  posicion: number
  hueco: Hueco | null
  /** Plata que todavía falta cubrir. **Es un piso**: ver `sinValorizar`. */
  faltaPlata: number
  /**
   * Cuántos de los que faltan **no se pudieron valorizar** — A-BUG-136.
   *
   * Sin esto, `faltaPlata` en 0 es ambiguo entre *no falta plata* y *no se pudo medir ninguno*, y
   * la barra terminaba diciendo «falta cubrir $0» con 16 huecos abiertos delante.
   */
  sinValorizar: number
  terminado: boolean
}

/**
 * Cuánto se avanzó. Se calcula **contra el estado de hoy**, no contra un contador que se incrementa.
 *
 * ⚠️ Un contador propio se desincroniza en cuanto algo cambia por otro lado — el usuario carga la
 * venta desde otra pantalla y el recorrido sigue diciendo que falta. Derivarlo del dato hace que
 * eso sea imposible.
 */
export function avance(sigueAbierto: (h: Hueco) => boolean): Avance {
  const total = estado.huecos.length
  const abiertos = estado.huecos.filter(sigueAbierto)
  const hueco = estado.indice >= 0 && estado.indice < total ? estado.huecos[estado.indice] : null
  return {
    total,
    hechos: total - abiertos.length,
    posicion: estado.indice >= 0 ? Math.min(estado.indice + 1, total) : 0,
    hueco,
    faltaPlata: abiertos.reduce((s, h) => s + (h.plata ?? 0), 0),
    sinValorizar: abiertos.filter(h => h.plata == null).length,
    terminado: abiertos.length === 0,
  }
}
