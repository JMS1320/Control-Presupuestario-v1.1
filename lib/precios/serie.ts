// Resolución de series mensuales con ARRASTRE HACIA ADELANTE.
//
// Regla única para todas las series del presupuesto — precios de granos, precios de
// hacienda, tipo de cambio, IPC:
//
//   "cargo algunos precios en ciertos meses y quiero que los otros se propaguen hasta
//    el próximo input"
//
// Es decir: el valor de un mes es el **último cargado hasta ese mes**. Así alcanza con
// cargar los puntos donde el precio cambia, y si algo se mueve de fecha ya tiene precio.
//
//     ene  feb  mar  abr  may  jun
//     100   ·    ·   120   ·    ·
//     100  100  100  120  120  120     ← lo que devuelve
//
// Si el mes pedido es ANTERIOR a todo lo cargado no hay nada que arrastrar, y ahí sí se
// toma el primero hacia adelante: es mejor que devolver cero y que la celda desaparezca.

export interface PuntoSerie {
  anio: number
  mes: number
  valor: number
}

export type OrigenValor = 'exacto' | 'arrastrado' | 'anticipado' | 'sin_dato'

export interface ValorSerie {
  valor: number
  origen: OrigenValor
  /** Mes del que salió el valor, cuando no es exacto. */
  desde: { anio: number; mes: number } | null
}

const clave = (anio: number, mes: number) => anio * 12 + (mes - 1)

/**
 * Valor de la serie en (anio, mes):
 *  1. el del mes exacto, si está cargado
 *  2. el ÚLTIMO cargado antes de ese mes (arrastre hacia adelante) ← el caso normal
 *  3. el PRIMERO cargado después (sólo si el mes es previo a toda la serie)
 */
export function resolverSerie(puntos: PuntoSerie[], anio: number, mes: number): ValorSerie {
  const objetivo = clave(anio, mes)
  // Un 0 NO es un precio: si se propagara, mataría todos los meses siguientes. Se
  // ignora igual que un mes sin cargar.
  const validos = puntos.filter(p => Number.isFinite(Number(p.valor)) && Number(p.valor) > 0)

  let exacto: PuntoSerie | undefined
  let anterior: PuntoSerie | undefined
  let posterior: PuntoSerie | undefined

  for (const p of validos) {
    const k = clave(p.anio, p.mes)
    if (k === objetivo) { exacto = p; break }
    if (k < objetivo) {
      if (!anterior || k > clave(anterior.anio, anterior.mes)) anterior = p
    } else {
      if (!posterior || k < clave(posterior.anio, posterior.mes)) posterior = p
    }
  }

  if (exacto) return { valor: Number(exacto.valor), origen: 'exacto', desde: null }
  if (anterior) {
    return { valor: Number(anterior.valor), origen: 'arrastrado', desde: { anio: anterior.anio, mes: anterior.mes } }
  }
  if (posterior) {
    return { valor: Number(posterior.valor), origen: 'anticipado', desde: { anio: posterior.anio, mes: posterior.mes } }
  }
  return { valor: 0, origen: 'sin_dato', desde: null }
}

/** true si el valor no salió del mes pedido — la UI lo marca para que se note. */
export function esEstimado(v: ValorSerie): boolean {
  return v.origen !== 'exacto'
}

/** "arrastrado de nov 25" — para tooltips. */
export function explicarOrigen(v: ValorSerie): string {
  if (v.origen === 'exacto') return 'cargado en ese mes'
  if (v.origen === 'sin_dato') return 'sin precio cargado'
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const d = v.desde!
  const etiqueta = `${MESES[d.mes - 1]} ${String(d.anio).slice(-2)}`
  return v.origen === 'arrastrado'
    ? `arrastrado de ${etiqueta}`
    : `tomado de ${etiqueta} (no hay nada cargado antes)`
}
