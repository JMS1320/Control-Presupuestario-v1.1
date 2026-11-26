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
  /** Lotes de cría: cuándo nacieron y con cuánto (script 304). Con el peso del lote arman la curva del ternero al pie. */
  fecha_nacimiento?: string | null
  peso_nacimiento_kg?: number | string | null
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
        : gananciaDesdeNacimiento(lote, t) != null
          ? { ...act, ganancia_diaria_kg: gananciaDesdeNacimiento(lote, t)! }
          : act,
      insumos: insumos.filter(i => i.actividad_id === act.id),
      cabezas: cab,
      desde: t.fecha_desde,
      hasta: t.fecha_hasta,
      peso_inicial_kg: pesoInicialTramo(lote, tramos, actividades, t),
      hectareas: Number(t.hectareas ?? 0),
    })
  }
  return salida
}

/**
 * El peso con que arranca un tramo. Si el tramo es ANTERIOR a la pesada del lote (ej. el creep feeding de los terneros al pie,
 * nov→feb, cuando el lote dice «220 kg el 01/03»), la curva hacia adelante no sirve: devolvía el peso final para todo el tramo
 * y el creep salía calculado sobre 220 kg desde noviembre. Con la ganancia del tramo se va HACIA ATRÁS desde la pesada.
 * (JMS 25/11: «nacen con 30 kilos el 1/7 y se destetan con 200 el 28/2; el promedio da mucho menos».)
 */
export function pesoInicialTramo(lote: LoteCurva, tramos: TramoLote[], actividades: Actividad[], t: TramoLote): number {
  const base = lote.fecha_peso || lote.fecha_disponible
  // 🐣 Con el nacimiento del lote: la curva va de «nacimiento» a «peso del lote» (JMS 25/11: «el peso promedio es el promedio entre el
  // nacimiento y el destete»; si cambia los kg del lote, cambia el gasto). La ganancia sale de ahí, no se guarda.
  const gNac = gananciaDesdeNacimiento(lote, t)
  if (gNac != null && lote.fecha_nacimiento) {
    const d = Math.max(0, Math.round((Date.parse(t.fecha_desde) - Date.parse(lote.fecha_nacimiento)) / 86400000))
    return Number(lote.peso_nacimiento_kg) + gNac * d
  }
  const g = t.ganancia_diaria_kg != null ? Number(t.ganancia_diaria_kg) : null
  if (base && t.fecha_desde < base && g) {
    const dias = Math.round((Date.parse(base) - Date.parse(t.fecha_desde)) / 86400000)
    return Math.max(0, (Number(lote.peso_base_kg) || 0) - g * dias)
  }
  return pesoEnFecha(lote, tramos, actividades, t.fecha_desde)
}

/**
 * La ganancia diaria de un tramo ANTERIOR a la pesada del lote, cuando el lote dice cuándo y con cuánto nació:
 * (peso del lote − peso al nacer) / días entre el nacimiento y la pesada. null si no aplica (o si el tramo trae su propia ganancia).
 */
export function gananciaDesdeNacimiento(lote: LoteCurva, t: TramoLote): number | null {
  const base = lote.fecha_peso || lote.fecha_disponible
  if (t.ganancia_diaria_kg != null || !lote.fecha_nacimiento || lote.peso_nacimiento_kg == null || !base || t.fecha_desde >= base) return null
  const d = Math.round((Date.parse(base) - Date.parse(lote.fecha_nacimiento)) / 86400000)
  if (d <= 0) return null
  return ((Number(lote.peso_base_kg) || 0) - Number(lote.peso_nacimiento_kg)) / d
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

/**
 * 🐂 A-FEAT-1667 — Si la VENTA de un lote se corre, la ración sigue hasta la nueva fecha (JMS 26/11: «si eso implica seguir dando
 * ración, entonces se debe actualizar sólo el plan productivo del año: más días, más ración»). Devuelve qué tramo mover y a qué fecha:
 * el ÚLTIMO del lote, si terminaba cerca de la venta vieja (hasta 31 días antes o después) — es el que «llega a la venta». Si el
 * último terminaba mucho antes (ej. pasó a pastura sin ración), no se toca. null si no hay nada que mover o la fecha nueva cae antes
 * de que empiece el tramo (no se puede acortar a menos de un día).
 */
export function tramoHastaLaVenta(
  tramos: { id: string; fecha_desde: string; fecha_hasta: string }[],
  ventaVieja: string | null, ventaNueva: string,
): { id: string; hastaVieja: string; hastaNueva: string } | null {
  if (!tramos.length || !ventaNueva || ventaVieja === ventaNueva) return null
  const ult = [...tramos].sort((a, b) => b.fecha_hasta.localeCompare(a.fecha_hasta))[0]!
  if (ventaVieja) {
    const dif = Math.abs(Date.parse(ult.fecha_hasta) - Date.parse(ventaVieja)) / 86400000
    if (dif > 31) return null
  }
  if (ventaNueva <= ult.fecha_desde || ventaNueva === ult.fecha_hasta) return null
  return { id: ult.id, hastaVieja: ult.fecha_hasta, hastaNueva: ventaNueva }
}

/** Meses del creep feeding por receta (JMS 25/11, C11: «nov→feb»). Se usan si el renglón de la receta no trae sus meses. */
export const MESES_CREEP_RECETA = [11, 12, 1, 2]

/**
 * 🧭 A-FEAT-1665 (b) — El plan del año POR DEFECTO de un lote que no tiene ninguno, sacado de la receta (JMS 26/11: «cuando un lote
 * no tiene un período, la app se lo crea por default… si yo pongo que los terneros se venden a fin de febrero, significa que no hay
 * recría»). No escribe nada: propone; lo crea JMS con un clic.
 *  · Al pie → Cría (creep) desde el primer mes del creep antes del destete hasta el día anterior al destete; si no sabe cuándo nació,
 *    propone el 01/07 del año anterior al destete con 30 kg (como el lote 26/27).
 *  · Recría → desde que está disponible (destete) hasta la venta. Si se vende al destete (o no tiene venta posterior), no hay recría.
 */
export function planPorDefecto(
  lote: { categoria: string; fecha_disponible: string; fecha_venta_estimada?: string | null; fecha_nacimiento?: string | null },
  mesesCreep: number[] = MESES_CREEP_RECETA,
): { actividad: 'Cría' | 'Recría'; desde: string; hasta: string; nacimiento?: { fecha: string; kg: number } } | { motivo: string } | null {
  const cat = String(lote.categoria || '').toLowerCase()
  const disp = String(lote.fecha_disponible || '')
  if (!disp) return null
  const menosUnDia = (f: string) => new Date(Date.parse(f + 'T12:00:00') - 86400000).toISOString().slice(0, 10)
  if (/al pie/.test(cat)) {
    const [y, m] = disp.split('-').map(Number) as [number, number]
    const m0 = mesesCreep[0] ?? 11
    const anio = m0 >= m ? y - 1 : y
    const desde = `${anio}-${String(m0).padStart(2, '0')}-01`
    if (desde >= disp) return { motivo: 'el creep de la receta no cae antes del destete' }
    return { actividad: 'Cría', desde, hasta: menosUnDia(disp),
      ...(lote.fecha_nacimiento ? {} : { nacimiento: { fecha: `${y - 1}-07-01`, kg: 30 } }) }
  }
  if (/recr/.test(cat)) {
    const fv = lote.fecha_venta_estimada ? String(lote.fecha_venta_estimada) : null
    if (!fv || fv <= disp) return { motivo: 'se vende al destete: no hay recría' }
    return { actividad: 'Recría', desde: disp, hasta: fv }
  }
  return null
}
