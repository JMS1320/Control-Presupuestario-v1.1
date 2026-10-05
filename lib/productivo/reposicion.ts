/**
 * 🐄 **A-FEAT-1251 — confirmar la REPOSICIÓN desde un Excel.**
 *
 * El usuario tiene la lista de las hembras confirmadas para reposición (74 al 2026-10-05) y la única
 * forma razonable de decírselo al sistema es subir esa planilla: marcarlas una por una es tedioso y
 * es justo donde se cuela el error.
 *
 * Esta parte es **pura** (no lee ni escribe la base): de una hoja saca las caravanas y, contra las
 * hembras que hay, arma el **plan** — a marcar, a desmarcar, ya bien, no encontradas, ambiguas. La
 * pantalla lo muestra y recién al confirmar escribe. Nada se descarta en silencio (§ 🧮): lo que no
 * se pudo cruzar se lista.
 *
 * ## Cómo se cruza una caravana (plástico, § 📄)
 * - **Oficial** (`032 010012326428`): se comparan los dígitos **sin ceros de adelante** — Excel suele
 *   comerse el cero si la celda quedó como número. Si en la planilla viene sólo la cola (≥ 6 dígitos),
 *   alcanza con que sea la terminación de UNA sola caravana.
 * - **Interna** (`187`): número corto, se compara exacto.
 * - Si un dato coincide con más de un animal, **no se elige**: va a «ambiguas».
 */

export interface HembraRep {
  id: string
  caravana_oficial: string | null
  caravana_interna: string | null
  es_rep: boolean
}

export interface PlanReposicion {
  /** Están en la planilla y hoy NO tienen la marca. */
  marcar: HembraRep[]
  /** Tienen la marca y NO están en la planilla. */
  desmarcar: HembraRep[]
  /** Están en la planilla y ya tienen la marca. */
  yaBien: HembraRep[]
  /** Datos de la planilla que no coinciden con ninguna hembra. */
  noEncontradas: string[]
  /** Datos de la planilla que coinciden con más de una hembra. */
  ambiguas: { dato: string; candidatas: HembraRep[] }[]
  /** Datos que aparecen dos veces en la planilla (o dos datos que apuntan al mismo animal). */
  repetidas: string[]
  /**
   * ⚠️ Están en la planilla de hembras pero en el sistema son **MACHOS** (usuario 2026-10-05: *«por lo
   * menos la app me debería decir: estás marcando N caravanas a hembras reposición que son machos»*).
   * No se marcan: o la planilla está mal, o el sexo se cargó mal al destete — eso se corrige aparte.
   */
  sonMachos: { dato: string; animal: HembraRep }[]
}

const digitos = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '')
const sinCeros = (s: string) => s.replace(/^0+/, '')

/** Las hembras a las que puede referirse un dato de la planilla. */
export function candidatasDe(dato: string, hembras: HembraRep[]): HembraRep[] {
  const d = sinCeros(digitos(dato))
  if (!d) return []
  if (d.length < 6) {
    // corto = caravana interna
    return hembras.filter(h => sinCeros(digitos(h.caravana_interna)) === d)
  }
  const exactas = hembras.filter(h => sinCeros(digitos(h.caravana_oficial)) === d)
  if (exactas.length) return exactas
  return hembras.filter(h => sinCeros(digitos(h.caravana_oficial)).endsWith(d))
}

/**
 * Las caravanas de una hoja (filas × columnas, como las devuelve `sheet_to_json(..., { header: 1 })`).
 * Si alguna fila tiene un encabezado con «carav» o «IDV» (el número del lector), se usan sólo esas columnas (así un peso o una fecha
 * no se confunden con una caravana interna). Si no hay encabezado, se usa la primera columna.
 */
export function caravanasDeHoja(filas: unknown[][]): { caravanas: string[]; columnas: string } {
  const txt = (v: unknown) => String(v ?? '').trim()
  let filaEnc = -1
  let cols: number[] = []
  for (let i = 0; i < Math.min(filas.length, 15) && filaEnc < 0; i++) {
    const c = (filas[i] || []).map((v, j) => /carav|^\s*idv\s*$/i.test(txt(v)) ? j : -1).filter(j => j >= 0)
    if (c.length) { filaEnc = i; cols = c }
  }
  const usar = filaEnc >= 0 ? cols : [0]
  const desde = filaEnc >= 0 ? filaEnc + 1 : 0
  const out: string[] = []
  for (let i = desde; i < filas.length; i++) {
    // Si hay oficial e interna en la misma fila, alcanza con una: se toma la primera que tenga dígitos.
    const v = usar.map(j => txt(filas[i]?.[j])).find(x => digitos(x).length > 0)
    if (v) out.push(v)
  }
  const nombres = filaEnc >= 0 ? cols.map(j => txt(filas[filaEnc][j])).join(' + ') : 'primera columna (sin encabezado «caravana»)'
  return { caravanas: out, columnas: nombres }
}

export function planReposicion(caravanas: string[], hembras: HembraRep[], machos: HembraRep[] = []): PlanReposicion {
  const sonMachos: PlanReposicion['sonMachos'] = []
  const enLista = new Map<string, HembraRep>()
  const noEncontradas: string[] = []
  const ambiguas: PlanReposicion['ambiguas'] = []
  const repetidas: string[] = []
  for (const dato of caravanas) {
    const c = candidatasDe(dato, hembras)
    if (c.length === 0) {
      const m = candidatasDe(dato, machos)
      if (m.length === 1) sonMachos.push({ dato, animal: m[0] })
      else noEncontradas.push(dato)
      continue
    }
    if (c.length > 1) { ambiguas.push({ dato, candidatas: c }); continue }
    if (enLista.has(c[0].id)) { repetidas.push(dato); continue }
    enLista.set(c[0].id, c[0])
  }
  const marcar = [...enLista.values()].filter(h => !h.es_rep)
  const yaBien = [...enLista.values()].filter(h => h.es_rep)
  // Una ambigua NO desmarca a sus candidatas: puede ser cualquiera de ellas, y desmarcar sería adivinar.
  const enDuda = new Set(ambiguas.flatMap(a => a.candidatas.map(h => h.id)))
  const desmarcar = hembras.filter(h => h.es_rep && !enLista.has(h.id) && !enDuda.has(h.id))
  return { marcar, desmarcar, yaBien, noEncontradas, ambiguas, repetidas, sonMachos }
}

/**
 * 🔁 Pieza 2 — al pasar de categoría «las de reposición», la selección final (con lo que el usuario
 * tildó o destildó a mano) **se vuelve la marca rep** antes de mover nada: así la planilla de recría y
 * el cambio de categoría no quedan diciendo cosas distintas.
 */
export function ajusteDeMarcas(
  hembras: { id: string; es_rep: boolean }[],
  seleccion: Set<string>,
): { marcar: string[]; desmarcar: string[] } {
  return {
    marcar: hembras.filter(h => seleccion.has(h.id) && !h.es_rep).map(h => h.id),
    desmarcar: hembras.filter(h => !seleccion.has(h.id) && h.es_rep).map(h => h.id),
  }
}

/**
 * 🧮 Control de integridad: cada caravana leída terminó en UN lugar — rep (ya o nueva), sin cruzar
 * (no encontrada / ambigua) o repetida. Si no suma lo leído, el plan se contradice: frena.
 */
export function cierraPlan(p: PlanReposicion, leidas: number): boolean {
  return p.yaBien.length + p.marcar.length + p.noEncontradas.length + p.ambiguas.length + p.repetidas.length + p.sonMachos.length === leidas
}

/**
 * 🧮 Destino de un cambio de categoría: cabezas (stock) contra individuos identificados, DESPUÉS de
 * guardar. `dif > 0` = cabezas sin identificar (se completan por diferencia); `dif < 0` = más
 * individuos que cabezas, que no tiene explicación: se avisa fuerte.
 *  · `soloIdentificar`: la cabeza ya se movió → el stock no cambia, sólo suman identificadas.
 */
export function descuadreDestino(a: {
  cabezasHoy: number; identificadasHoy: number; tildadas: number; sinIdentificar: number; soloIdentificar: boolean
}): { cabezas: number; identificadas: number; dif: number } {
  const cabezas = a.cabezasHoy + (a.soloIdentificar ? 0 : a.tildadas + a.sinIdentificar)
  const identificadas = a.identificadasHoy + a.tildadas
  return { cabezas, identificadas, dif: cabezas - identificadas }
}
