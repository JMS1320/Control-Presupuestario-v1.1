// A qué ACTIVIDAD pertenece cada ingreso.
//
// Es el eslabón que faltaba para el margen: los costos ya se pueden agrupar por actividad, pero
// ningún ingreso decía de cuál era. Un margen con costos clasificados e ingresos sin clasificar
// no cierra.
//
// ── El criterio ──────────────────────────────────────────────────────────────
// NO es carga manual: la actividad se DERIVA de lo que ya está cargado —el grano, la cuenta
// contable, la categoría de hacienda— y el usuario sólo corrige donde no acierta. La corrección
// manual manda sobre la derivación, igual que en `resolverTipo()` (C-27).
//
// Y toda derivación viaja con su MOTIVO. Un número clasificado por una regla que nadie ve es un
// número en el que no se puede confiar: si el margen de cría sale raro, hay que poder preguntar
// "¿por qué esta venta cayó acá?" y que haya respuesta.

export interface ActividadRef { id: string; nombre: string }

export interface OrigenActividad {
  centroCostoId: string | null
  nombre: string | null
  /** De dónde salió: `manual` gana siempre; el resto es derivación. */
  fuente: 'manual' | 'categoria' | 'grano' | 'cuenta' | 'centro_costo' | 'sin_resolver'
  motivo: string
}

const buscar = (acts: ActividadRef[], nombre: string) =>
  acts.find(a => a.nombre.toLowerCase() === nombre.toLowerCase()) ?? null

/** Palabras de la cuenta contable o del concepto que delatan la actividad. */
const PISTAS_CUENTA: { patron: RegExp; actividad: string }[] = [
  { patron: /arrendamiento/i, actividad: 'Arrendamiento' },
  { patron: /agr[ií]cola|granos?|soja|ma[ií]z|trigo|girasol/i, actividad: 'Agricultura' },
  { patron: /hacienda|novillo|ternero|invernada/i, actividad: 'Engorde' },
]

/**
 * La actividad de una venta (liquidación de granos, arrendamiento, etc.).
 *
 * Orden: lo cargado a mano → el grano → la cuenta contable → nada. Nunca inventa: si no puede
 * resolverlo devuelve `sin_resolver`, que es lo que después levanta el aviso. Adivinar acá sería
 * repartir plata entre actividades por una corazonada.
 */
export function actividadDeVenta(
  v: { centro_costo_id?: string | null; grano?: string | null; cuenta_contable?: string | null; centro_costo?: string | null },
  actividades: ActividadRef[],
): OrigenActividad {
  if (v.centro_costo_id) {
    const a = actividades.find(x => x.id === v.centro_costo_id)
    return {
      centroCostoId: v.centro_costo_id, nombre: a?.nombre ?? null,
      fuente: 'manual', motivo: 'asignada a mano',
    }
  }

  if (v.grano) {
    const a = buscar(actividades, 'Agricultura')
    if (a) return { centroCostoId: a.id, nombre: a.nombre, fuente: 'grano', motivo: `es una liquidación de ${v.grano}` }
  }

  const texto = `${v.cuenta_contable ?? ''} ${v.centro_costo ?? ''}`
  for (const p of PISTAS_CUENTA) {
    if (p.patron.test(texto)) {
      const a = buscar(actividades, p.actividad)
      if (a) return { centroCostoId: a.id, nombre: a.nombre, fuente: 'cuenta', motivo: `la cuenta dice "${v.cuenta_contable ?? v.centro_costo}"` }
    }
  }

  return {
    centroCostoId: null, nombre: null, fuente: 'sin_resolver',
    motivo: 'no hay grano ni cuenta que lo indique — hay que asignarla a mano',
  }
}

/**
 * La actividad de un movimiento de hacienda.
 *
 * Sale de la CATEGORÍA, que es el mapeo más estable del negocio: una vaca es de cría, un ternero
 * de recría es de recría. Se carga una vez en la categoría y sirve para todos los movimientos.
 * El movimiento puede pisarla para las excepciones reales (una vaca vendida desde el engorde).
 */
export function actividadDeHacienda(
  m: { centro_costo_id?: string | null; categoria_nombre?: string | null; categoria_centro_costo_id?: string | null },
  actividades: ActividadRef[],
): OrigenActividad {
  if (m.centro_costo_id) {
    const a = actividades.find(x => x.id === m.centro_costo_id)
    return {
      centroCostoId: m.centro_costo_id, nombre: a?.nombre ?? null,
      fuente: 'manual', motivo: 'asignada a mano en el movimiento',
    }
  }
  if (m.categoria_centro_costo_id) {
    const a = actividades.find(x => x.id === m.categoria_centro_costo_id)
    return {
      centroCostoId: m.categoria_centro_costo_id, nombre: a?.nombre ?? null,
      fuente: 'categoria', motivo: `${m.categoria_nombre ?? 'la categoría'} pertenece a ${a?.nombre ?? '—'}`,
    }
  }
  return {
    centroCostoId: null, nombre: null, fuente: 'sin_resolver',
    motivo: `la categoría ${m.categoria_nombre ?? '(sin categoría)'} todavía no tiene actividad asignada`,
  }
}

/** Cuánto ingreso quedó sin clasificar. Es lo que hace falta saber antes de mirar un margen. */
export function resumenCobertura(
  filas: { monto: number; origen: OrigenActividad }[],
): { total: number; clasificado: number; sinResolver: number; pctSinResolver: number } {
  const total = filas.reduce((s, f) => s + f.monto, 0)
  const sinResolver = filas
    .filter(f => f.origen.fuente === 'sin_resolver')
    .reduce((s, f) => s + f.monto, 0)
  return {
    total,
    clasificado: total - sinResolver,
    sinResolver,
    pctSinResolver: total > 0 ? (sinResolver / total) * 100 : 0,
  }
}
