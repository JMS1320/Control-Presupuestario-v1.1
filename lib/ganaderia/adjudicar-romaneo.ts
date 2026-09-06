/**
 * 🐄 Adjudicar cada CABEZA del romaneo a una cabeza nuestra — A-FEAT-97.
 *
 * ## El método (del usuario, 2026-09-06)
 * No hay caravana en el romaneo: el frigorífico identifica por **garrón**. Lo único común entre las
 * dos listas es **el orden por peso**. Entonces:
 *
 * > Se ordenan las dos listas y se aparean por posición: **al más pesado nuestro, la res más
 * > pesada**; al del medio, la del medio; al más liviano, la más liviana.
 *
 * Ejemplo que dio, con 3 animales:
 * ```
 *   nuestro 900 → ajustado 918  →  res 487  (la mayor)
 *   nuestro 880 → ajustado 897  →  res 475  (la del medio)
 *   nuestro 850 → ajustado 867  →  res 460  (la menor)
 * ```
 *
 * ## Por qué el peso nuestro se AJUSTA antes de ordenar
 * *«ajustado por bza camión (el peso real que tomamos)»*. Nuestra balanza y la del camión no dan lo
 * mismo, y la del camión pesa el conjunto. Se escala cada peso individual por
 * `neto del camión ÷ suma de los nuestros`, de modo que **el total cierre con la balanza que pesó
 * todo junto**, sin perder la proporción entre animales — que es lo único que aporta la balanza de a
 * uno. Los dos números se conservan: el ajuste no pisa la pesada original (§ 18.5).
 *
 * ⚠️ **El orden no cambia con el ajuste** (es un factor constante), así que el apareo sería el mismo
 * sin ajustar. El ajuste importa para el **rinde**, no para el orden.
 *
 * ## Por qué esto es lo único que da un rinde por grupo de verdad
 * Con las cabezas apareadas, el rinde de cada animal es `kg gancho ÷ kg vivo` con **dos mediciones
 * reales e independientes**, y varía de animal en animal. Cualquier reparto proporcional —el que
 * hace el frigorífico en su columna *Vivo*, y el que yo mismo había puesto como precarga— se
 * simplifica algebraicamente y devuelve **el rinde global para todos los grupos**. A-FEAT-96.
 */

export interface CabezaNuestra {
  id: string
  caravana: string | null
  razon: string | null
  peso_kg: number
}

export interface CabezaRomaneo {
  garron: string
  tipo: string
  clase: string
  dientes: number | null
  contenido: string
  precio_kg: number | null
  kg_gancho: number
  medias: number      // cuántas medias reses se leyeron: debería ser 2
}

export interface Adjudicacion {
  nuestra: CabezaNuestra | null
  romaneo: CabezaRomaneo | null
  /** Peso nuestro escalado para que el total cierre con la balanza del camión. */
  peso_ajustado: number | null
  /** kg gancho ÷ peso ajustado. Sólo tiene sentido si están las dos puntas. */
  rinde: number | null
}

/**
 * Aparea por rango de peso. **Las dos listas se ordenan de mayor a menor y se casan por posición.**
 *
 * @param nuestras  las cabezas pesadas por nosotros, de ESTE tipo
 * @param delRomaneo las cabezas del romaneo (un garrón = una cabeza = 2 medias reses)
 * @param factor    el escalado, **calculado una sola vez para toda la carga** (ver `factorDeCarga`)
 *
 * 🐞 **El factor se recibe, no se calcula acá** (2026-09-06). Antes esta función lo derivaba de
 * `neto del camión ÷ suma de las cabezas que recibía`, y como se la llama **una vez por tipo**, cada
 * grupo terminaba escalado al camión ENTERO: los 3 toros pesaban `2.661 × (6500/2661) = 6.500`, y
 * las 7 vacas otro tanto. La carga entraba dos veces. El camión pesa **el conjunto**, así que el
 * factor es del conjunto.
 */
export function adjudicarPorPeso(
  nuestras: CabezaNuestra[],
  delRomaneo: CabezaRomaneo[],
  factor: number,
): { pares: Adjudicacion[]; factor: number; sinPareja: number } {
  const a = [...nuestras].sort((x, y) => y.peso_kg - x.peso_kg)
  const b = [...delRomaneo].sort((x, y) => y.kg_gancho - x.kg_gancho)
  const n = Math.max(a.length, b.length)

  const pares: Adjudicacion[] = []
  for (let i = 0; i < n; i++) {
    const nu = a[i] ?? null
    const ro = b[i] ?? null
    const ajustado = nu ? Math.round(nu.peso_kg * factor * 100) / 100 : null
    pares.push({
      nuestra: nu, romaneo: ro, peso_ajustado: ajustado,
      rinde: ro && ajustado && ajustado > 0 ? Math.round((ro.kg_gancho / ajustado) * 10000) / 100 : null,
    })
  }
  return { pares, factor, sinPareja: Math.abs(a.length - b.length) }
}

/**
 * El escalado de la carga: lleva **el total de nuestras pesadas** al neto del camión.
 *
 * Se calcula UNA VEZ con todos los animales del viaje, porque el camión pesó el conjunto. Sin
 * camión no se ajusta nada (`1`): inventar un factor sería peor que no tenerlo.
 */
export function factorDeCarga(todasNuestras: CabezaNuestra[], netoCamion: number | null): number {
  const suma = todasNuestras.reduce((s, c) => s + (c.peso_kg || 0), 0)
  return netoCamion && suma > 0 ? netoCamion / suma : 1
}

/**
 * Junta las medias reses en CABEZAS. El garrón se repite dos veces por animal y **eso no es un
 * duplicado**: son las dos mitades. Contar filas da el doble de animales.
 */
export function cabezasDeMedias(
  medias: { garron: string; tipo: string; clase: string; dientes: number | null; contenido: string; peso_kg: number; precio_kg: number | null }[],
): CabezaRomaneo[] {
  const g = new Map<string, CabezaRomaneo>()
  for (const m of medias) {
    const a = g.get(m.garron)
    if (a) { a.kg_gancho += m.peso_kg; a.medias++ }
    else g.set(m.garron, {
      garron: m.garron, tipo: m.tipo, clase: m.clase, dientes: m.dientes,
      contenido: m.contenido, precio_kg: m.precio_kg, kg_gancho: m.peso_kg, medias: 1,
    })
  }
  return [...g.values()]
}

/** El rinde REAL por grupo de precio: sale de las cabezas apareadas, no de un reparto proporcional. */
export function rindePorGrupo(pares: Adjudicacion[]) {
  const g = new Map<string, { tipo: string; precio: number; cabezas: number; kg_gancho: number; kg_vivo: number; clases: string[] }>()
  for (const p of pares) {
    if (!p.romaneo || !p.peso_ajustado) continue
    const precio = p.romaneo.precio_kg ?? 0
    const k = `${p.romaneo.tipo}|${precio}`
    const a = g.get(k) ?? { tipo: p.romaneo.tipo, precio, cabezas: 0, kg_gancho: 0, kg_vivo: 0, clases: [] }
    a.cabezas++
    a.kg_gancho += p.romaneo.kg_gancho
    a.kg_vivo += p.peso_ajustado
    const et = `${p.romaneo.clase}${p.romaneo.dientes ?? ""}`
    if (!a.clases.includes(et)) a.clases.push(et)
    g.set(k, a)
  }
  return [...g.entries()].map(([k, v]) => ({
    k, ...v,
    rinde: v.kg_vivo > 0 ? Math.round((v.kg_gancho / v.kg_vivo) * 10000) / 100 : null,
    importe: Math.round(v.kg_gancho * v.precio * 100) / 100,
  })).sort((x, y) => x.tipo.localeCompare(y.tipo) || y.precio - x.precio)
}
