/**
 * 🐄 A-FEAT-1636 — las SECCIONES DE PESO del segmentador, como dato de cada animal.
 *
 * JMS 22/11, en Recría/Engorde → Historial de pesadas: *«historial de pesadas no me muestra lo
 * segmentado, debería estar la opción»* · *«ideal que me muestre también según las segmentaciones de
 * peso»*. Hasta acá el segmentador sólo contaba cuántos caían en cada rango; la tabla de caravanas no
 * sabía en qué rango estaba cada uno, y entonces no se podía seguir la evolución de un grupo.
 *
 * Lógica pura (sin React ni base) para que la usen el segmentador y la tabla, y para probarla en
 * `lib/pruebas/casos.ts`.
 */

export interface PesadaSimple { fecha: string; peso_kg: number }

/** Etiqueta de un rango, igual que la tabla del segmentador: «< 180», «180 / 200», «> 260». */
export function etiquetaRango(lo: number, hi: number): string {
  if (lo === -Infinity) return `< ${Math.round(hi)}`
  if (hi === Infinity) return `> ${Math.round(lo)}`
  return `${Math.round(lo)} / ${Math.round(hi)}`
}

/**
 * Índice de la sección (0 = la más liviana) en que cae un peso, con los mismos bordes que la tabla
 * del segmentador: `[lo, hi)` — el corte pertenece a la sección de arriba.
 */
export function seccionDePeso(peso: number, cortes: number[]): number {
  const cs = [...cortes].sort((a, b) => a - b)
  let i = 0
  while (i < cs.length && peso >= cs[i]) i++
  return i
}

/**
 * Cortes uniformes centrados en el promedio: `nSecciones` secciones → `nSecciones − 1` cortes de
 * ancho `cada`. `desde` (si viene) fija el primer corte. Es lo que el segmentador hacía con 5 fijas.
 */
export function cortesUniformes(pesos: number[], nSecciones: number, cada: number, desde?: number | null): number[] {
  const nCortes = Math.max(0, Math.round(nSecciones) - 1)
  if (!pesos.length || nCortes === 0) return []
  const prom = pesos.reduce((s, p) => s + p, 0) / pesos.length
  const centro = Math.round(prom / 10) * 10
  const primero = desde ?? centro - ((nCortes - 1) / 2) * cada
  return Array.from({ length: nCortes }, (_, i) => Math.round(primero + i * cada))
}

/** Un solo corte en el promedio (redondeado a 10 kg): dos mitades. Es el «dejar 1, el del medio». */
export function corteDelMedio(pesos: number[]): number[] {
  if (!pesos.length) return []
  const prom = pesos.reduce((s, p) => s + p, 0) / pesos.length
  return [Math.round(prom / 10) * 10]
}

/**
 * La ganancia diaria REAL de un grupo: el promedio de la ganancia de cada animal entre sus DOS
 * últimas pesadas (hasta `asOf`, si se pide el estado a una fecha).
 *
 * JMS 22/11: *«en estimado, ¿podría aplicarse la ganancia que viene habiendo entre las dos últimas
 * pesadas? el tema es que si se pesaron pocas cabezas puede no ser representativo»*. Por eso devuelve
 * también **sobre cuántas cabezas** se calculó y sobre cuántas del grupo: la pantalla lo muestra para
 * que se vea cuánto confiar, y el valor se puede pisar a mano (§ Default del dato real).
 */
export function gananciaRealDelGrupo(
  animales: { pesadas: PesadaSimple[] }[],
  asOf?: string | null,
): { promedio: number | null; cabezas: number; delGrupo: number } {
  const dias = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
  const vals: number[] = []
  for (const a of animales) {
    const ps = (asOf ? a.pesadas.filter(p => p.fecha <= asOf) : a.pesadas)
      .slice().sort((x, y) => x.fecha.localeCompare(y.fecha))
    if (ps.length < 2) continue
    const u = ps[ps.length - 1], p = ps[ps.length - 2]
    const d = dias(p.fecha, u.fecha)
    if (d > 0) vals.push((u.peso_kg - p.peso_kg) / d)
  }
  return {
    promedio: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null,
    cabezas: vals.length,
    delGrupo: animales.length,
  }
}

/** Qué se le avisa a la tabla de caravanas por cada animal segmentado. */
export interface AsignacionSeccion {
  /** «A2»: letra del segmentador + número de sección (1 = la más liviana). */
  codigo: string
  /** «180 / 200». */
  rango: string
  /** Para ordenar: segmentador × 100 + sección. */
  orden: number
}

/**
 * Asigna cada animal a su sección. `letra` es la del segmentador (A, B…), `nSegmentador` su posición.
 * Devuelve un mapa id → asignación; los animales sin peso no aparecen.
 */
export function asignarSecciones(
  items: { id: string; peso: number }[],
  cortes: number[],
  letra: string,
  nSegmentador: number,
): Record<string, AsignacionSeccion> {
  const cs = [...cortes].sort((a, b) => a - b)
  const bordes = [-Infinity, ...cs, Infinity]
  const out: Record<string, AsignacionSeccion> = {}
  for (const it of items) {
    const i = seccionDePeso(it.peso, cs)
    out[it.id] = { codigo: `${letra}${i + 1}`, rango: etiquetaRango(bordes[i], bordes[i + 1]), orden: nSegmentador * 100 + i }
  }
  return out
}

/** Texto de la sección de un animal (puede estar en más de un segmentador): «A2 · 180 / 200». */
export function textoSeccion(asigs: AsignacionSeccion[]): string | null {
  if (!asigs.length) return null
  return [...asigs].sort((a, b) => a.orden - b.orden).map(a => `${a.codigo} · ${a.rango}`).join(" | ")
}

/** Días entre dos fechas ISO (YYYY-MM-DD), contados como días del calendario. */
function diasEntre(a: string, b: string): number {
  const ms = (f: string) => { const [y, m, d] = f.slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((ms(b) - ms(a)) / 86400000)
}

/**
 * 🐄 A-FEAT-1654 (JMS 25/11): *«una última [columna] con la ganancia diaria entre las últimas dos pesadas
 * (configurable para mostrar ganancia diaria entre cualquiera dos pesadas)»*.
 * Sin fechas → las 2 últimas de ESE animal (si faltó a una pesada, toma sus dos propias).
 * Con fechas → tiene que tener pesada en las dos; si no, null (no se inventa). El orden de las fechas no importa.
 */
export function gananciaEntre(
  pesadas: PesadaSimple[], desde: string | null = null, hasta: string | null = null,
): { kgDia: number; desde: string; hasta: string; dias: number } | null {
  let a: PesadaSimple | undefined, b: PesadaSimple | undefined
  if (!desde || !hasta) {
    const ps = pesadas.slice().sort((x, y) => x.fecha.localeCompare(y.fecha))
    if (ps.length < 2) return null
    a = ps[ps.length - 2]; b = ps[ps.length - 1]
  } else {
    const [d, h] = desde <= hasta ? [desde, hasta] : [hasta, desde]
    a = pesadas.find(p => p.fecha === d); b = pesadas.find(p => p.fecha === h)
  }
  if (!a || !b) return null
  const dias = diasEntre(a.fecha, b.fecha)
  if (dias <= 0) return null
  return { kgDia: (b.peso_kg - a.peso_kg) / dias, desde: a.fecha, hasta: b.fecha, dias }
}

/** Peso estimado a una fecha: la última pesada (hasta esa fecha) + ganancia × días desde ella. */
export function pesoEstimadoA(pesadas: PesadaSimple[], gananciaKgDia: number, fecha: string): number | null {
  const ps = pesadas.filter(p => p.fecha <= fecha).sort((x, y) => x.fecha.localeCompare(y.fecha))
  const u = ps[ps.length - 1]
  if (!u) return null
  return u.peso_kg + gananciaKgDia * diasEntre(u.fecha, fecha)
}
