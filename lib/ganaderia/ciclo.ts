// Motor del CICLO GANADERO — evolución proyectada del rodeo (línea de tiempo).
// Modelo: solapa "ciclo ganadero" de `exports_app/- Desarrollo Presuesto..xlsx`.
// Capa UI-agnóstica: la consumen Productivo, Ventas y Presupuesto.
//
// Regla del módulo (igual que arrendamiento): el default se calcula solo, el dato real
// lo pisa, y lo pisado no se recalcula. Cada período se encadena con el anterior.

export interface CicloStock {
  id: string
  empresa: string
  campania: string
  orden: number
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
  /** Datos reales: si están, pisan el cálculo. */
  real_destetados: number | null
  real_machos: number | null
  real_hembras: number | null
  real_descarte: number | null
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
  /** Terneras retenidas para reposición (no se venden). */
  retenidas: number
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

  // Reposición: se retienen terneras. Es decisión de estrategia y cambia año a año
  // (20% mantiene el rodeo; más que eso lo hace crecer).
  const retenidas = terneras * Number(ciclo.pct_reposicion)

  return {
    ciclo,
    vacas, vaquillonas, rodeo,
    destetados, terneros, terneras,
    falladas, descarte, retenidas,
    terneros_venta: terneros,
    terneras_venta: Math.max(0, terneras - retenidas),
    // Las vaquillonas paren y pasan a vaca; las retenidas de este año son las
    // vaquillonas del que viene.
    vacas_cierre: Math.max(0, vacas - descarte + vaquillonas),
    vaquillonas_cierre: retenidas,
    tiene_reales: ciclo.real_destetados != null || ciclo.real_machos != null
      || ciclo.real_hembras != null || ciclo.real_descarte != null,
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
