// Tramos: la actividad aplicada a un lote entre dos fechas.
//
// ── Por qué el tramo maneja la CURVA DE PESO y no sólo el costo ──────────────
// Antes `stock_lotes.ganancia_diaria_kg` se tipeaba a mano, y la actividad trae su propia
// ganancia esperada. Son el mismo número. Si divergen, el peso con el que se factura la venta
// y los kilos de maíz que se compran describen **dos animales distintos** — y nada avisa.
//
// Así que la ganancia sale del tramo. El campo del lote queda para dos cosas:
//   · los días que no cubre ningún tramo (fallback);
//   · `ganancia_override = true`, que es el override manual explícito y se muestra marcado.
//
// El efecto secundario es el que pidió el usuario: cargar la actividad define el **ingreso**
// (por el peso a la venta) y el **costo** (por el consumo) de una sola vez, con dos puntas de
// input para el mismo dato.
//
// ── La curva es QUEBRADA, no una recta ───────────────────────────────────────
// Con recría a 0,5 kg/día hasta septiembre y engorde a 0,7 después, el peso ya no es
// `base + días × ganancia`: hay que integrar tramo por tramo. Ésa es toda la gracia de esto,
// y es lo que hace que estimar la venta de un animal que cambia de actividad deje de ser
// una cuenta a mano.

import type { Actividad, InsumoActividad, Tramo } from './actividades'

export interface TramoLote {
  id: string
  lote_id: string
  actividad_id: string
  orden: number
  fecha_desde: string
  fecha_hasta: string
  hectareas: number | null
  notas: string | null
  /**
   * La ganancia de ESTE tramo. `null` = la de la actividad.
   *
   * Existe porque un lote concreto puede no rendir como la norma de su actividad, y el único
   * escape que había —el checkbox del lote— vuelve la curva a una recta y **borra el quiebre**:
   * o usabas las normas, o perdías los tramos.
   */
  ganancia_diaria_kg?: number | null
}

/** Lo mínimo que hace falta del lote para armar la curva. */
export interface LoteCurva {
  cantidad: number | string
  peso_base_kg: number | string
  ganancia_diaria_kg: number | string
  fecha_disponible: string
  fecha_peso?: string | null
  ganancia_override?: boolean | null
}

const dias = (desde: string, hasta: string) => {
  const a = new Date(desde + 'T00:00:00').getTime()
  const b = new Date(hasta + 'T00:00:00').getTime()
  if (isNaN(a) || isNaN(b)) return 0
  return Math.round((b - a) / 86400000)
}
const maxF = (a: string, b: string) => (a > b ? a : b)
const minF = (a: string, b: string) => (a < b ? a : b)

/** Un pedazo de la curva con una ganancia constante. */
export interface SegmentoCurva {
  desde: string
  hasta: string
  dias: number
  ganancia_diaria_kg: number
  /** Nombre de la actividad, o null si son días sin tramo (fallback del lote). */
  actividad: string | null
  peso_inicio: number
  peso_fin: number
}

/**
 * Parte la curva de peso en segmentos de ganancia constante, desde la fecha del peso base
 * hasta `hasta`. Los días que no cubre ningún tramo usan la ganancia del lote.
 */
export function segmentosCurva(
  lote: LoteCurva,
  tramos: TramoLote[],
  actividades: Actividad[],
  hasta: string,
): SegmentoCurva[] {
  const base = lote.fecha_peso || lote.fecha_disponible
  const gLote = Number(lote.ganancia_diaria_kg) || 0
  let peso = Number(lote.peso_base_kg) || 0

  if (!base || !hasta || hasta <= base) return []

  // Override manual: la curva vuelve a ser una recta, como antes de los tramos.
  if (lote.ganancia_override) {
    const d = dias(base, hasta)
    return [{
      desde: base, hasta, dias: d, ganancia_diaria_kg: gLote, actividad: null,
      peso_inicio: peso, peso_fin: peso + d * gLote,
    }]
  }

  const actPorId = new Map(actividades.map(a => [a.id, a]))
  const ordenados = [...tramos]
    .filter(t => t.fecha_hasta > base && t.fecha_desde < hasta)
    .sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde) || a.orden - b.orden)

  const salida: SegmentoCurva[] = []
  let cursor = base

  const empujar = (desde: string, fin: string, g: number, nombre: string | null) => {
    const d = dias(desde, fin)
    if (d <= 0) return
    const pIni = peso
    peso = pIni + d * g
    salida.push({ desde, hasta: fin, dias: d, ganancia_diaria_kg: g, actividad: nombre, peso_inicio: pIni, peso_fin: peso })
  }

  for (const t of ordenados) {
    if (cursor >= hasta) break
    const ini = maxF(cursor, t.fecha_desde)
    const fin = minF(hasta, t.fecha_hasta)
    // Hueco antes del tramo: días sin actividad asignada
    if (ini > cursor) empujar(cursor, minF(ini, hasta), gLote, null)
    cursor = minF(maxF(cursor, ini), hasta)
    if (fin > cursor) {
      const act = actPorId.get(t.actividad_id)
      // El tramo manda sobre la actividad, y la actividad sobre el lote. Default del dato real.
      const g = t.ganancia_diaria_kg != null
        ? Number(t.ganancia_diaria_kg)
        : Number(act?.ganancia_diaria_kg ?? gLote)
      empujar(cursor, fin, g, act?.nombre ?? null)
      cursor = fin
    }
  }
  // Cola después del último tramo
  if (cursor < hasta) empujar(cursor, hasta, gLote, null)

  return salida
}

/** Peso por cabeza en una fecha, siguiendo la curva quebrada. */
export function pesoEnFecha(
  lote: LoteCurva,
  tramos: TramoLote[],
  actividades: Actividad[],
  fecha: string,
): number {
  const base = lote.fecha_peso || lote.fecha_disponible
  const pBase = Number(lote.peso_base_kg) || 0
  if (!fecha || !base || fecha <= base) return pBase
  const segs = segmentosCurva(lote, tramos, actividades, fecha)
  return segs.length ? segs[segs.length - 1]!.peso_fin : pBase
}

/**
 * Función de curva lista para pasarle a `pesoEstimado` / `valuarLote` de
 * `lib/ganaderia/ciclo.ts`. Se pasa como callback para no crear un import circular
 * entre los dos módulos.
 */
export function curvaDeLote(
  lote: LoteCurva,
  tramos: TramoLote[],
  actividades: Actividad[],
): (fecha: string) => number {
  return (fecha: string) => pesoEnFecha(lote, tramos, actividades, fecha)
}

/** true si la ganancia que se está usando NO sale de los tramos — para marcarlo en la UI. */
export function gananciaEsManual(lote: LoteCurva, tramos: TramoLote[]): boolean {
  return Boolean(lote.ganancia_override) || tramos.length === 0
}

// ── Puente hacia el cálculo de costos ─────────────────────────────────────────

/**
 * Convierte los tramos del lote en los `Tramo` que consume `consumoMensual()`.
 * El peso inicial de cada tramo sale de la curva, así que un tramo de engorde que arranca
 * después de seis meses de recría empieza con el peso que el animal realmente tiene.
 */
export function tramosParaCosto(
  lote: LoteCurva,
  tramos: TramoLote[],
  actividades: Actividad[],
  insumos: InsumoActividad[],
  cabezas?: number,
): Tramo[] {
  const actPorId = new Map(actividades.map(a => [a.id, a]))
  const cab = cabezas ?? (Number(lote.cantidad) || 0)
  const salida: Tramo[] = []

  for (const t of [...tramos].sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde) || a.orden - b.orden)) {
    const act = actPorId.get(t.actividad_id)
    if (!act) continue
    salida.push({
      // ⚠️ Con ganancia propia del tramo se pasa una COPIA de la actividad con ese número: si
      // no, el peso de la curva y el que usa el consumo describirían dos animales distintos.
      actividad: t.ganancia_diaria_kg != null
        ? { ...act, ganancia_diaria_kg: Number(t.ganancia_diaria_kg) }
        : act,
      insumos: insumos.filter(i => i.actividad_id === act.id),
      cabezas: cab,
      desde: t.fecha_desde,
      hasta: t.fecha_hasta,
      peso_inicial_kg: pesoEnFecha(lote, tramos, actividades, t.fecha_desde),
      hectareas: Number(t.hectareas ?? 0),
    })
  }
  return salida
}

/** Los tramos se pisan entre sí — la UI lo avisa en vez de calcular cualquier cosa. */
export function solapamientos(tramos: TramoLote[]): [TramoLote, TramoLote][] {
  const ord = [...tramos].sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde))
  const pares: [TramoLote, TramoLote][] = []
  for (let i = 0; i < ord.length - 1; i++) {
    if (ord[i + 1]!.fecha_desde < ord[i]!.fecha_hasta) pares.push([ord[i]!, ord[i + 1]!])
  }
  return pares
}
