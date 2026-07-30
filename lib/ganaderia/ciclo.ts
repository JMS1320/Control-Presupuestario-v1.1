// Motor del CICLO GANADERO — evolución proyectada del rodeo (línea de tiempo).
// Modelo: solapa "ciclo ganadero" de `exports_app/- Desarrollo Presuesto..xlsx`.
// Capa UI-agnóstica: la consumen Productivo, Ventas y Presupuesto.
//
// Regla del módulo (igual que arrendamiento): el default se calcula solo, el dato real
// lo pisa, y lo pisado no se recalcula. Cada período se encadena con el anterior.

// ── Fechas del ciclo — DERIVADAS de la campaña ────────────────────────────────
//
// La campaña tiene siempre un servicio, una parición y un destete, a offsets fijos.
// Por eso NO se piden como input: pedirlas es ruido y además invita a que el dato
// tipeado se contradiga con el nombre de la campaña.
//
//   campaña 27/28  →  servicio  oct-2026   ← ojo: cae en la campaña ANTERIOR
//                     parición  jul-2027
//                     destete   mar-2028
//
// (una vaca servida en 10/26 pare en 7/27 y se desteta en 3/28)

/** Meses del ciclo. Si alguna vez se corren, se cambian acá y no en 20 lugares. */
export const MES_SERVICIO = 10
export const MES_PARICION = 7
export const MES_DESTETE  = 3

export interface FechasCiclo {
  servicio: string   // 'YYYY-MM-DD'
  paricion: string
  destete: string
}

/**
 * Deriva las tres fechas de la campaña `"27/28"`.
 * El servicio cae en octubre del año ANTERIOR al primero de la campaña.
 * Devuelve null si la campaña no tiene el formato AA/BB.
 */
export function fechasCampania(campania: string): FechasCiclo | null {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(campania ?? '').trim())
  if (!m) return null
  const anioA = 2000 + Number(m[1])   // 27 → 2027
  const anioB = 2000 + Number(m[2])   // 28 → 2028
  const d = (a: number, mes: number) => `${a}-${String(mes).padStart(2, '0')}-01`
  return {
    servicio: d(anioA - 1, MES_SERVICIO),
    paricion: d(anioA, MES_PARICION),
    destete:  d(anioB, MES_DESTETE),
  }
}

/** Etiqueta corta para mostrar en la columna: "serv 10/26 · pare 7/27 · dest 3/28". */
export function etiquetaFechas(campania: string): string {
  const f = fechasCampania(campania)
  if (!f) return 'campaña sin formato AA/BB'
  const mm = (s: string) => `${Number(s.slice(5, 7))}/${s.slice(2, 4)}`
  return `serv ${mm(f.servicio)} · pare ${mm(f.paricion)} · dest ${mm(f.destete)}`
}

export interface CicloStock {
  id: string
  empresa: string
  campania: string
  orden: number
  /**
   * Fechas REALES, cuando ya ocurrieron. Las proyectadas NO se guardan: se derivan de la
   * campaña con `fechasCampania()`. Usar `fechaDestete()` para obtener la que corresponda.
   */
  fecha_servicio: string | null
  fecha_destete: string | null
  /** NULL = hereda del cierre del período anterior. El primero se carga a mano. */
  vacas_apertura: number | null
  vaquillonas_apertura: number | null
  pct_destete: number
  pct_machos: number
  pct_descarte_falladas: number
  pct_reposicion: number
  peso_destete_kg: number
  /** Peso de venta de la vaca de descarte (refugo). */
  peso_descarte_kg: number
  /** Datos reales: si están, pisan el cálculo. */
  real_destetados: number | null
  real_machos: number | null
  real_hembras: number | null
  real_descarte: number | null
  /** Reposición en CABEZAS cuando el dato se sabe. Pisa a `pct_reposicion`. */
  real_retenidas: number | null
  notas: string | null
}

export interface CicloCalculado {
  ciclo: CicloStock
  /** Rodeo de cría al servicio = vacas + vaquillonas de reposición. */
  vacas: number
  vaquillonas: number
  rodeo: number
  /** Cabezas destetadas. */
  destetados: number
  terneros: number
  terneras: number
  /** Vientres que no destetaron (merma entre vaca entorada y vaca destetada). */
  falladas: number
  /** Vacas que se van del rodeo → venta. */
  descarte: number
  /** Terneras retenidas para reposición (no se venden). Se calcula sobre la BASE ENTORADA. */
  retenidas: number
  /** No se pueden retener más terneras de las que se destetaron. */
  retencion_excede: boolean
  /** Lo que queda para vender. */
  terneros_venta: number
  terneras_venta: number
  // Cierre → apertura del período siguiente
  vacas_cierre: number
  vaquillonas_cierre: number
  /** true si algún número vino de un dato real en vez del cálculo. */
  tiene_reales: boolean
  /** true si la apertura la escribió el usuario en vez de heredarla. */
  apertura_manual: boolean
}

/**
 * Calcula UN período. `apertura` es el cierre del anterior; si el ciclo trae
 * `vacas_apertura`/`vaquillonas_apertura` cargados a mano, esos ganan.
 *
 *   rodeo     = vacas + vaquillonas
 *   destete   = rodeo × pct_destete           → pct_machos / resto hembras
 *   falladas  = rodeo × (1 − pct_destete)     ← la merma
 *   descarte  = falladas × pct_descarte       ← sale de vaca Y vaquillona
 *   ─────────── cierre ───────────
 *   vacas(t+1)       = vacas − descarte + vaquillonas   (paren → pasan a vaca)
 *   vaquillonas(t+1) = terneras × pct_reposicion
 */
export function calcularCiclo(
  ciclo: CicloStock,
  apertura?: { vacas: number; vaquillonas: number },
): CicloCalculado {
  const aperturaManual = ciclo.vacas_apertura != null || ciclo.vaquillonas_apertura != null

  const vacas = Number(ciclo.vacas_apertura ?? apertura?.vacas ?? 0)
  const vaquillonas = Number(ciclo.vaquillonas_apertura ?? apertura?.vaquillonas ?? 0)
  const rodeo = vacas + vaquillonas

  // Destete: el real pisa al proyectado
  const destetados = ciclo.real_destetados != null
    ? Number(ciclo.real_destetados)
    : rodeo * Number(ciclo.pct_destete)

  const terneros = ciclo.real_machos != null
    ? Number(ciclo.real_machos)
    : destetados * Number(ciclo.pct_machos)
  const terneras = ciclo.real_hembras != null
    ? Number(ciclo.real_hembras)
    : destetados - terneros

  // Falladas = lo que no destetó. Se calcula contra el rodeo, no contra las vacas solas:
  // las vaquillonas que fallan también entran al descarte.
  const falladas = Math.max(0, rodeo - destetados)
  const descarte = ciclo.real_descarte != null
    ? Number(ciclo.real_descarte)
    : falladas * Number(ciclo.pct_descarte_falladas)

  // Reposición: se calcula sobre la BASE ENTORADA (el rodeo a servicio), no sobre las
  // terneras destetadas. El 20% "para mantener" es reponer una quinta parte del rodeo,
  // que es lo que compensa el descarte; sobre terneras daría ~16 y el rodeo se caería.
  // Es decisión de estrategia y cambia año a año: más de 20% hace crecer el rodeo.
  // Si se sabe el número exacto (están marcadas en la pesada), ese gana: es un dato
  // firme y no debe escalar si después cambia el rodeo.
  const retenidasTeorica = ciclo.real_retenidas != null
    ? Number(ciclo.real_retenidas)
    : rodeo * Number(ciclo.pct_reposicion)
  // Guardarraíl: no se puede retener más de lo que se destetó.
  const retenidas = Math.min(retenidasTeorica, terneras)
  const retencionExcede = retenidasTeorica > terneras + 0.01

  return {
    ciclo,
    vacas, vaquillonas, rodeo,
    destetados, terneros, terneras,
    falladas, descarte, retenidas,
    retencion_excede: retencionExcede,
    terneros_venta: terneros,
    terneras_venta: Math.max(0, terneras - retenidas),
    // Las vaquillonas paren y pasan a vaca; las retenidas de este año son las
    // vaquillonas del que viene.
    vacas_cierre: Math.max(0, vacas - descarte + vaquillonas),
    vaquillonas_cierre: retenidas,
    tiene_reales: ciclo.real_destetados != null || ciclo.real_machos != null
      || ciclo.real_hembras != null || ciclo.real_descarte != null
      || ciclo.real_retenidas != null,
    apertura_manual: aperturaManual,
  }
}

/**
 * Encadena toda la línea de tiempo: cada período abre con el cierre del anterior,
 * salvo que tenga apertura cargada a mano (el primero siempre la tiene: es la foto de hoy).
 */
export function calcularLineaTiempo(ciclos: CicloStock[]): CicloCalculado[] {
  const ordenados = [...ciclos].sort((a, b) => a.orden - b.orden)
  const out: CicloCalculado[] = []
  let apertura: { vacas: number; vaquillonas: number } | undefined

  for (const c of ordenados) {
    const calc = calcularCiclo(c, apertura)
    out.push(calc)
    apertura = { vacas: calc.vacas_cierre, vaquillonas: calc.vaquillonas_cierre }
  }
  return out
}

// ── Lotes vendibles ───────────────────────────────────────────────────────────

export interface LoteStock {
  id: string
  empresa: string
  ciclo_id: string | null
  categoria: string
  origen: 'destete' | 'descarte' | 'stock_inicial'
  cantidad: number
  fecha_disponible: string
  peso_base_kg: number
  /** Si no se vende al destete y se recría, engorda esto por día. */
  ganancia_diaria_kg: number
  /** Lo que dio el cálculo la última vez. Si difiere de `cantidad`, se editó a mano. */
  cantidad_calculada: number | null
  notas: string | null
}

export interface VentaStock {
  id: string
  lote_id: string
  fecha_venta: string
  cantidad: number
  peso_kg: number | null
  precio_kg: number | null
  monto_neto: number | null
}

/**
 * Fecha de destete del ciclo: la real si ya ocurrió, si no la derivada de la campaña.
 * Es la que manda para saber cuándo quedan disponibles las cabezas a vender.
 */
export function fechaDestete(ciclo: Pick<CicloStock, 'campania' | 'fecha_destete'>): string | null {
  return ciclo.fecha_destete ?? fechasCampania(ciclo.campania)?.destete ?? null
}

/** Ídem para el servicio: el rodeo se cuenta a servicio. */
export function fechaServicio(ciclo: Pick<CicloStock, 'campania' | 'fecha_servicio'>): string | null {
  return ciclo.fecha_servicio ?? fechasCampania(ciclo.campania)?.servicio ?? null
}

// ── Vínculo con los ciclos REALES de Productivo ───────────────────────────────
//
// `productivo.ciclos_cria` guarda lo que pasó de verdad, una fila por rodeo
// (Vaca / Vaquillona Preñada) y por año de servicio. La línea de tiempo del
// presupuesto se puede PROPONER desde ahí, y se va autocorrigiendo sola a medida
// que los ciclos avanzan y se cargan los datos reales.

export interface FilaCicloCria {
  anio_servicio: number
  rodeo: string | null
  cabezas_servicio: number | null
  cabezas_prenadas: number | null
  terneros_destetados: number | null
  machos_destetados: number | null
  hembras_destetados: number | null
  kg_promedio: number | null
  fecha_servicio: string | null
  fecha_destete: string | null
}

export interface PropuestaCiclo {
  campania: string
  anio_servicio: number
  /** Rodeo al servicio, separado por categoría. */
  vacas: number
  vaquillonas: number
  a_servicio: number
  prenadas: number
  /** Reales del destete, si el ciclo ya cerró. */
  destetados: number | null
  machos: number | null
  hembras: number | null
  kg_promedio: number | null
  /** %destete real medido contra el rodeo a servicio (sólo si cerró). */
  pct_destete_real: number | null
  pct_machos_real: number | null
  cerrado: boolean
  fecha_servicio: string | null
  fecha_destete: string | null
}

/**
 * `anio_servicio` → campaña. El servicio de octubre de 2025 corresponde a la campaña
 * 26/27 (pare jul-26, desteta mar-27).
 */
export function campaniaDeServicio(anioServicio: number): string {
  const a = (anioServicio + 1) % 100
  const b = (anioServicio + 2) % 100
  return `${String(a).padStart(2, '0')}/${String(b).padStart(2, '0')}`
}

/** Agrupa `ciclos_cria` por año de servicio y arma la propuesta por campaña. */
export function proponerDesdeCiclosCria(filas: FilaCicloCria[]): PropuestaCiclo[] {
  const porAnio = new Map<number, FilaCicloCria[]>()
  for (const f of filas) {
    if (!porAnio.has(f.anio_servicio)) porAnio.set(f.anio_servicio, [])
    porAnio.get(f.anio_servicio)!.push(f)
  }

  const num = (v: number | null | undefined) => Number(v) || 0
  const esVaquillona = (rodeo: string | null) => /vaquillona/i.test(rodeo ?? '')

  return Array.from(porAnio.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([anio, fs]) => {
      const vacas = fs.filter(f => !esVaquillona(f.rodeo)).reduce((s, f) => s + num(f.cabezas_servicio), 0)
      const vaquillonas = fs.filter(f => esVaquillona(f.rodeo)).reduce((s, f) => s + num(f.cabezas_servicio), 0)
      const aServicio = vacas + vaquillonas
      const prenadas = fs.reduce((s, f) => s + num(f.cabezas_prenadas), 0)

      const cerrado = fs.some(f => f.terneros_destetados != null)
      const destetados = cerrado ? fs.reduce((s, f) => s + num(f.terneros_destetados), 0) : null
      const machos = cerrado ? fs.reduce((s, f) => s + num(f.machos_destetados), 0) : null
      const hembras = cerrado ? fs.reduce((s, f) => s + num(f.hembras_destetados), 0) : null

      const kgs = fs.map(f => Number(f.kg_promedio)).filter(k => k > 0)

      return {
        campania: campaniaDeServicio(anio),
        anio_servicio: anio,
        vacas, vaquillonas, a_servicio: aServicio, prenadas,
        destetados, machos, hembras,
        kg_promedio: kgs.length ? kgs.reduce((s, k) => s + k, 0) / kgs.length : null,
        pct_destete_real: cerrado && aServicio > 0 ? destetados! / aServicio : null,
        pct_machos_real: cerrado && destetados! > 0 ? machos! / destetados! : null,
        cerrado,
        fecha_servicio: fs.map(f => f.fecha_servicio).filter(Boolean)[0] ?? null,
        fecha_destete: fs.map(f => f.fecha_destete).filter(Boolean)[0] ?? null,
      }
    })
}

/** Días corridos entre dos fechas 'YYYY-MM-DD'. */
export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(desde + 'T00:00:00').getTime()
  const b = new Date(hasta + 'T00:00:00').getTime()
  return Math.max(0, Math.round((b - a) / 86400000))
}

/**
 * Peso estimado a una fecha. Si se vende al destete es el peso base; si se retuvo para
 * recriar, suma la ganancia diaria por los días transcurridos.
 */
export function pesoEstimado(lote: Pick<LoteStock, 'fecha_disponible' | 'peso_base_kg' | 'ganancia_diaria_kg'>, fechaVenta: string): number {
  const dias = diasEntre(lote.fecha_disponible, fechaVenta)
  return Number(lote.peso_base_kg) + dias * Number(lote.ganancia_diaria_kg)
}

/** Cabezas del lote todavía sin vender. */
export function cantidadDisponible(lote: Pick<LoteStock, 'cantidad'>, ventas: Pick<VentaStock, 'cantidad'>[]): number {
  const vendidas = ventas.reduce((s, v) => s + Number(v.cantidad || 0), 0)
  return Math.max(0, Number(lote.cantidad) - vendidas)
}
