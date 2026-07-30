import { categoriaPrecio, resolverPrecioHacienda, type PrecioHacienda } from './calculo'

// Motor del CICLO GANADERO — evolución proyectada del rodeo (línea de tiempo).
// Modelo: solapa "ciclo ganadero" de `exports_app/- Desarrollo Presuesto..xlsx`.
// Capa UI-agnóstica: la consumen Productivo, Ventas y Presupuesto.
//
// Regla del módulo (igual que arrendamiento): el default se calcula solo, el dato real
// lo pisa, y lo pisado no se recalcula. Cada período se encadena con el anterior.

// ── Fechas del ciclo — DERIVADAS de la campaña ────────────────────────────────
//
// ⚠️ EL PERÍODO VA DE SERVICIO A SERVICIO (12 meses), no de un servicio a su propio
// destete (17 meses). Es la definición que hace que **el cierre de un período sea la
// apertura del siguiente**, sin desfasajes.
//
// La campaña es la COMERCIAL julio–junio, igual que en el resto de la app. Con ese
// calendario cada campaña contiene exactamente un servicio y un destete:
//
//   campaña 25/26 (jul-25 → jun-26)
//     · servicio            1/10/2025   ← abre el ciclo productivo
//     · destete EN la campaña  3/2026    ← ¡del servicio ANTERIOR (oct-2024)!
//     · parición del propio servicio 7/2026  (ya en la campaña siguiente)
//     · su propio destete      3/2027    ← cae en la campaña siguiente
//
// El único corrimiento del modelo está acá: el destete que ocurre durante un período
// es el producto del servicio del período anterior (16 meses antes). El stock, en
// cambio, encadena limpio: rodeo(N+1) = rodeo(N) − refugo(N) + retenidas(N).

/** Meses del ciclo. Si alguna vez se corren, se cambian acá y no en 20 lugares. */
export const MES_SERVICIO = 10
export const MES_PARICION = 7
export const MES_DESTETE  = 3

export interface FechasCiclo {
  servicio: string   // 'YYYY-MM-DD' — abre el período
  /** Destete que OCURRE durante el período. Es del servicio anterior. */
  destete: string
  paricion: string
  /** Destete del propio servicio de este período. Cae en la campaña siguiente. */
  destete_propio: string
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
    servicio:       d(anioA, MES_SERVICIO),       // 1/10/2025 para 25/26
    destete:        d(anioB, MES_DESTETE),        // 3/2026 — el que ocurre EN la campaña
    paricion:       d(anioB, MES_PARICION),       // 7/2026 — ya en la campaña siguiente
    destete_propio: d(anioB + 1, MES_DESTETE),    // 3/2027 — cae en la campaña siguiente
  }
}

/** Etiqueta corta para mostrar en la columna: "serv 10/26 · pare 7/27 · dest 3/28". */
export function etiquetaFechas(campania: string): string {
  const f = fechasCampania(campania)
  if (!f) return 'campaña sin formato AA/BB'
  const mm = (s: string) => `${Number(s.slice(5, 7))}/${s.slice(2, 4)}`
  return `servicio ${mm(f.servicio)} · destete ${mm(f.destete)}`
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
  /** Promedio de la tropa. Fallback si no están los pesos por sexo. */
  peso_destete_kg: number
  /** Peso al destete por sexo — más preciso, se venden por separado (G-5). */
  peso_destete_macho_kg: number | null
  peso_destete_hembra_kg: number | null
  /** Peso de venta de la vaca de descarte (refugo). */
  peso_descarte_kg: number
  /** Machos retenidos como toritos: NO van a venta (G-4). */
  toritos_retenidos: number
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
  /** Machos retenidos como toritos (no se venden). */
  toritos: number
  /** No se pueden retener más terneras de las que se destetaron. */
  retencion_excede: boolean
  /** Lo que queda para vender. */
  terneros_venta: number
  terneras_venta: number
  /**
   * Apertura que este período le pasa al SIGUIENTE. La calcula `calcularLineaTiempo`,
   * no `calcularCiclo`, porque depende del período anterior: el descarte que resta y
   * las vaquillonas que entran se decidieron DOS períodos atrás.
   */
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
 *
 * ⚠️ El ENCADENAMIENTO no se resuelve acá: lo que se decide en el destete de un período
 * impacta DOS períodos después (ver `calcularLineaTiempo`). Este cálculo es local.
 */
export function calcularCiclo(
  ciclo: CicloStock,
  apertura?: { vacas: number; vaquillonas: number },
  /**
   * Rodeo del período ANTERIOR. Es la base del destete: los terneros que se destetan
   * durante este período son el producto del servicio anterior, no del propio.
   */
  rodeoPrev?: number,
): CicloCalculado {
  const aperturaManual = ciclo.vacas_apertura != null || ciclo.vaquillonas_apertura != null

  const vacas = Number(ciclo.vacas_apertura ?? apertura?.vacas ?? 0)
  const vaquillonas = Number(ciclo.vaquillonas_apertura ?? apertura?.vaquillonas ?? 0)
  const rodeo = vacas + vaquillonas

  // Destete que OCURRE durante este período. Sale del servicio ANTERIOR, así que se
  // proyecta sobre el rodeo del período anterior. El real pisa al proyectado.
  const base = rodeoPrev ?? 0
  const destetados = ciclo.real_destetados != null
    ? Number(ciclo.real_destetados)
    : base * Number(ciclo.pct_destete)

  const terneros = ciclo.real_machos != null
    ? Number(ciclo.real_machos)
    : destetados * Number(ciclo.pct_machos)
  const terneras = ciclo.real_hembras != null
    ? Number(ciclo.real_hembras)
    : destetados - terneros

  // Falladas = del rodeo que se sirvió (el ANTERIOR) cuántos no destetaron. Ojo: la
  // base es rodeoPrev, pero el refugo se descuenta del rodeo VIGENTE — son las mismas
  // vacas, un año después.
  const falladas = Math.max(0, base - destetados)
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
  // ⚠️ SÓLO aplica si el destete se CONOCE. Si no hay dato, `terneras` es desconocido,
  // no cero — topear contra 0 anulaba cualquier número que el usuario cargara a mano
  // (caso real: cargó 28 retenidas en el primer período y la app mostraba 0). Ver G-1.
  const desteteConocido = ciclo.real_destetados != null || base > 0
  const retenidas = desteteConocido ? Math.min(retenidasTeorica, terneras) : retenidasTeorica
  const retencionExcede = desteteConocido && retenidasTeorica > terneras + 0.01

  // Los toritos se retienen para servicio: no van a venta (G-4).
  const toritos = Math.min(Number(ciclo.toritos_retenidos ?? 0), terneros)

  return {
    ciclo,
    vacas, vaquillonas, rodeo,
    destetados, terneros, terneras,
    falladas, descarte, retenidas, toritos,
    retencion_excede: retencionExcede,
    terneros_venta: desteteConocido ? Math.max(0, terneros - toritos) : 0,
    // Si no se conoce el destete no hay nada que vender (no restar contra un 0 ficticio)
    terneras_venta: desteteConocido ? Math.max(0, terneras - retenidas) : 0,
    // Placeholders: los completa `calcularLineaTiempo`, que es la única que ve los
    // períodos vecinos y puede aplicar el desfasaje de dos.
    vacas_cierre: 0,
    vaquillonas_cierre: 0,
    tiene_reales: ciclo.real_destetados != null || ciclo.real_machos != null
      || ciclo.real_hembras != null || ciclo.real_descarte != null
      || ciclo.real_retenidas != null,
    apertura_manual: aperturaManual,
  }
}

/**
 * Orden cronológico de la línea de tiempo. Se deriva de la CAMPAÑA, no del campo
 * `orden`: la campaña ya dice cuándo va, y un número manual se desincroniza apenas se
 * agrega un período viejo (cargar 25/26 después de 26/27 lo mandaba al final).
 * `orden` queda sólo como desempate.
 */
/** Orden derivado de la campaña: "26/27" → 2026. No se pide como input. */
export function ordenDeCampania(campania: string): number {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(campania ?? '').trim())
  return m ? 2000 + Number(m[1]) : 0
}

export function ordenarPorCampania(a: CicloStock, b: CicloStock): number {
  const anio = (c: CicloStock) => {
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(c.campania ?? '').trim())
    return m ? 2000 + Number(m[1]) : Number.POSITIVE_INFINITY
  }
  const d = anio(a) - anio(b)
  return d !== 0 ? d : (a.orden - b.orden)
}

/**
 * Encadena la línea de tiempo. La apertura cargada a mano SIEMPRE gana; si está vacía,
 * se hereda del cierre del período anterior.
 *
 * EL STOCK ENCADENA LIMPIO, sin desfasajes — el cierre de un período ES la apertura del
 * siguiente:
 *
 *   vacas(N+1)       = vacas(N) + vaquillonas(N) − refugo(N)   ← las vaquillonas parieron
 *   vaquillonas(N+1) = retenidas(N)
 *   rodeo(N+1)       = rodeo(N) − refugo(N) + retenidas(N)
 *
 * Verificado con datos reales:
 *   1/10/24:  214 (160+54)  − 22 refugo + 28 vaquillonas = 220  ✓
 *   1/10/25:  220 (192+28)  − 16 refugo + 60 vaquillonas = 264  ✓
 *
 * El único corrimiento del modelo está en el DESTETE, no en el stock: los terneros que
 * se destetan durante el período N son el producto del servicio del período N−1. Por eso
 * `calcularCiclo` recibe `rodeoPrev` como base del destete y de las falladas.
 */
export function calcularLineaTiempo(ciclos: CicloStock[]): CicloCalculado[] {
  const ordenados = [...ciclos].sort(ordenarPorCampania)
  const out: CicloCalculado[] = []

  for (let i = 0; i < ordenados.length; i++) {
    const prev = out[i - 1]

    const apertura = prev
      ? {
          vacas: Math.max(0, prev.vacas + prev.vaquillonas - prev.descarte),
          vaquillonas: prev.retenidas,
        }
      : undefined

    const calc = calcularCiclo(ordenados[i]!, apertura, prev?.rodeo)

    // El cierre es literalmente la apertura del siguiente.
    calc.vacas_cierre = Math.max(0, calc.vacas + calc.vaquillonas - calc.descarte)
    calc.vaquillonas_cierre = calc.retenidas

    out.push(calc)
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
  /** A qué fecha corresponde `peso_base_kg`. NULL = `fecha_disponible`. */
  fecha_peso: string | null
  /** Si no se vende al destete y se recría, engorda esto por día. */
  ganancia_diaria_kg: number
  /** Lo que dio el cálculo la última vez. Si difiere de `cantidad`, se editó a mano. */
  cantidad_calculada: number | null
  /** Cuándo se piensa vender. NULL = disponible sin fecha, no es ingreso presupuestado. */
  fecha_venta_estimada: string | null
  /** Precio ARS/kg manual. NULL = sale de `precios_hacienda`. */
  precio_kg_override: number | null
  /** @deprecated usar `plazo_cobro`. */
  dias_cobro: number
  /** Días de cobro separados por "/" cuando hay cuotas: "0", "30", "30/60/90". */
  plazo_cobro: string
  /** Merma de kg al pesar en destino. El precio va sobre el kg NETO. */
  pct_desbaste: number
  /** Comercialización (comisión del consignatario) sobre el monto de la venta. */
  pct_cz: number
  alicuota_iva: number
  alicuota_iibb: number
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
 * `anio_servicio` → campaña COMERCIAL (julio–junio) que lo contiene.
 * Octubre de 2025 cae en jul-25/jun-26 → campaña 25/26.
 */
export function campaniaDeServicio(anioServicio: number): string {
  const a = anioServicio % 100
  const b = (anioServicio + 1) % 100
  return `${String(a).padStart(2, '0')}/${String(b).padStart(2, '0')}`
}

/**
 * Arma la propuesta por campaña desde `ciclos_cria`.
 *
 * ⚠️ Cada registro de `ciclos_cria` se REPARTE ENTRE DOS PERÍODOS, porque el servicio y
 * su destete ocurren en períodos distintos:
 *
 *   anio_servicio 2024 → servicio (214 cab) va al período que abre 1/10/2024  = camp. 25/26
 *                      → destete  (189 cab, feb-2026) ocurre durante          = camp. 26/27
 *
 * Meter las dos cosas en la misma fila era lo que rompía el encadenamiento.
 */
export function proponerDesdeCiclosCria(filas: FilaCicloCria[]): PropuestaCiclo[] {
  const porAnio = new Map<number, FilaCicloCria[]>()
  for (const f of filas) {
    if (!porAnio.has(f.anio_servicio)) porAnio.set(f.anio_servicio, [])
    porAnio.get(f.anio_servicio)!.push(f)
  }

  const num = (v: number | null | undefined) => Number(v) || 0
  const esVaquillona = (rodeo: string | null) => /vaquillona/i.test(rodeo ?? '')

  // campaña → propuesta en construcción
  const acc = new Map<string, PropuestaCiclo>()
  const vacia = (campania: string, anio: number): PropuestaCiclo => ({
    campania, anio_servicio: anio,
    vacas: 0, vaquillonas: 0, a_servicio: 0, prenadas: 0,
    destetados: null, machos: null, hembras: null, kg_promedio: null,
    pct_destete_real: null, pct_machos_real: null,
    cerrado: false, fecha_servicio: null, fecha_destete: null,
  })

  for (const [anio, fs] of Array.from(porAnio.entries()).sort((a, b) => a[0] - b[0])) {
    // ── El SERVICIO abre el período que empieza en octubre de ese año
    const campServicio = campaniaDeServicio(anio)
    const pS = acc.get(campServicio) ?? vacia(campServicio, anio)
    pS.vacas = fs.filter(f => !esVaquillona(f.rodeo)).reduce((s, f) => s + num(f.cabezas_servicio), 0)
    pS.vaquillonas = fs.filter(f => esVaquillona(f.rodeo)).reduce((s, f) => s + num(f.cabezas_servicio), 0)
    pS.a_servicio = pS.vacas + pS.vaquillonas
    pS.prenadas = fs.reduce((s, f) => s + num(f.cabezas_prenadas), 0)
    pS.fecha_servicio = fs.map(f => f.fecha_servicio).filter(Boolean)[0] ?? null
    acc.set(campServicio, pS)

    // ── El DESTETE de ese servicio ocurre durante el período SIGUIENTE
    const cerrado = fs.some(f => f.terneros_destetados != null)
    if (!cerrado) continue

    const campDestete = campaniaDeServicio(anio + 1)
    const pD = acc.get(campDestete) ?? vacia(campDestete, anio + 1)
    pD.destetados = fs.reduce((s, f) => s + num(f.terneros_destetados), 0)
    pD.machos = fs.reduce((s, f) => s + num(f.machos_destetados), 0)
    pD.hembras = fs.reduce((s, f) => s + num(f.hembras_destetados), 0)
    const kgs = fs.map(f => Number(f.kg_promedio)).filter(k => k > 0)
    pD.kg_promedio = kgs.length ? kgs.reduce((s, k) => s + k, 0) / kgs.length : null
    pD.fecha_destete = fs.map(f => f.fecha_destete).filter(Boolean)[0] ?? null
    pD.cerrado = true
    // El % de destete se mide contra el rodeo que se SIRVIÓ, o sea el del período anterior
    pD.pct_destete_real = pS.a_servicio > 0 ? pD.destetados / pS.a_servicio : null
    pD.pct_machos_real = pD.destetados > 0 ? pD.machos / pD.destetados : null
    acc.set(campDestete, pD)
  }

  return Array.from(acc.values()).sort((a, b) => a.campania.localeCompare(b.campania))
}

/** Peso al destete por sexo: el específico si está, si no el promedio de la tropa. */
export function pesoDestete(ciclo: CicloStock, sexo: 'macho' | 'hembra'): number {
  const esp = sexo === 'macho' ? ciclo.peso_destete_macho_kg : ciclo.peso_destete_hembra_kg
  return Number(esp ?? ciclo.peso_destete_kg ?? 0)
}

// ── Categorías vendibles ──────────────────────────────────────────────────────
//
// La categoría de un ternero depende de CUÁNDO se vende: si sale en el destete es
// "al Pie", si se retuvo y se vende después es "Recría". Los toritos y las terneras de
// reposición no se venden (van al rodeo). Los toros de refugo no salen del ciclo — el
// modelo no lleva toros — así que son lote manual.

export const CATEGORIAS_VENTA = [
  'Ternero al Pie', 'Ternera al Pie',
  'Ternero Recria', 'Ternera Recria',
  'Novillo', 'Vaquillona Engorde',
  'Vaca CUT/Descarte', 'Toro', 'Torito',
] as const

/**
 * Categoría que corresponde según cuándo se vende respecto del destete.
 * Dentro de la ventana se considera venta al pie; después, recría.
 */
export const DIAS_VENTA_AL_PIE = 45

export function categoriaSegunFecha(
  sexo: 'macho' | 'hembra',
  fechaDestete: string | null,
  fechaVenta: string | null,
): string {
  const esMacho = sexo === 'macho'
  if (!fechaDestete || !fechaVenta) return esMacho ? 'Ternero Recria' : 'Ternera Recria'
  const dias = diasEntre(fechaDestete, fechaVenta)
  return dias <= DIAS_VENTA_AL_PIE
    ? (esMacho ? 'Ternero al Pie' : 'Ternera al Pie')
    : (esMacho ? 'Ternero Recria' : 'Ternera Recria')
}

// ── Valuación del lote ────────────────────────────────────────────────────────

/** Una cuota del cobro: cuántos días y qué parte del monto. */
export interface CuotaCobro {
  dias: number
  mes: string      // 'YYYY-MM'
  monto: number
}

/**
 * Parsea "30/60/90" → [30, 60, 90]. Vacío o inválido → [0] (contado).
 * El monto se reparte en partes iguales entre las cuotas.
 */
export function parsearPlazo(plazo: string | null | undefined): number[] {
  const partes = String(plazo ?? '0')
    .split(/[\/,;\s]+/)
    .map(x => parseInt(x.trim(), 10))
    .filter(n => Number.isFinite(n) && n >= 0)
  return partes.length ? partes : [0]
}

export interface ValuacionLote {
  cabezas: number
  /** Peso vivo por cabeza a la fecha de venta (bruto, antes del desbaste). */
  peso_unitario: number
  kg_brutos: number
  kg_desbaste: number
  /** Kg sobre los que se cobra: el precio SIEMPRE va por el neto de desbaste. */
  kg_netos: number
  /** @deprecated usar kg_netos. Se mantiene por compatibilidad. */
  kg_totales: number
  precio_kg: number
  /** Lo que se factura: kg netos × precio. Es el neto gravado. */
  venta_neta: number
  iva: number
  total_factura: number
  /** Comisión de comercialización, sobre la venta neta. */
  cz: number
  /** Lo que efectivamente entra al banco = total factura − CZ. */
  monto: number
  /** IIBB sobre la venta neta, se paga el mes SIGUIENTE al cobro. */
  iibb: number
  mes_iibb: string | null
  /** Mes de la PRIMERA cuota 'YYYY-MM'. */
  mes_cobro: string | null
  /** Todas las cuotas del cobro, con su mes y su parte del monto. */
  cuotas: CuotaCobro[]
  /** El precio se arrastró de otro mes o no hay precio cargado. */
  estimado: boolean
  /** Hay fecha de venta → es ingreso presupuestado. Si no, es sólo stock. */
  proyectado: boolean
}

/**
 * Valúa lo que queda del lote a su fecha de venta estimada.
 * El peso crece con la ganancia diaria; el precio sale del override o de la tabla.
 */
export function valuarLote(
  lote: LoteStock,
  ventas: Pick<VentaStock, 'cantidad'>[],
  precioDeTabla: (categoria: string, anio: number, mes: number) => { precio: number; arrastrado: boolean },
): ValuacionLote {
  const cabezas = cantidadDisponible(lote, ventas)
  const fv = lote.fecha_venta_estimada

  const vacio = (peso: number): ValuacionLote => ({
    cabezas, peso_unitario: peso,
    kg_brutos: 0, kg_desbaste: 0, kg_netos: 0, kg_totales: 0,
    precio_kg: 0, venta_neta: 0, iva: 0, total_factura: 0, cz: 0, monto: 0,
    iibb: 0, mes_iibb: null, mes_cobro: null, cuotas: [], estimado: true, proyectado: false,
  })

  if (!fv) return vacio(Number(lote.peso_base_kg))

  const peso = pesoEstimado(lote, fv)
  const [anio, mes] = fv.split('-').map(Number)

  const p = lote.precio_kg_override != null
    ? { precio: Number(lote.precio_kg_override), arrastrado: false }
    : precioDeTabla(lote.categoria, anio!, mes!)

  // El precio va SIEMPRE por el kg neto de desbaste
  const kgBrutos = cabezas * peso
  const kgDesbaste = kgBrutos * Number(lote.pct_desbaste ?? 0)
  const kgNetos = kgBrutos - kgDesbaste

  const ventaNeta = kgNetos * p.precio          // neto gravado: lo que se factura
  const iva = ventaNeta * Number(lote.alicuota_iva ?? 0)
  const totalFactura = ventaNeta + iva
  const cz = ventaNeta * Number(lote.pct_cz ?? 0)   // comisión del consignatario

  const monto = totalFactura - cz   // lo que entra al banco

  // El cobro puede venir en varias cuotas: se reparte en partes iguales.
  const dias = parsearPlazo(lote.plazo_cobro ?? String(lote.dias_cobro ?? 0))
  const cuotas: CuotaCobro[] = dias.map(d => {
    const f = new Date(fv + 'T00:00:00')
    f.setDate(f.getDate() + d)
    return {
      dias: d,
      mes: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`,
      monto: monto / dias.length,
    }
  })
  const mesCobro = cuotas[0]?.mes ?? null

  // El IIBB se paga el mes siguiente a la PRIMERA cuota
  const primera = new Date(fv + 'T00:00:00')
  primera.setDate(primera.getDate() + (dias[0] ?? 0))
  const sig = new Date(primera.getFullYear(), primera.getMonth() + 1, 1)

  return {
    cabezas,
    peso_unitario: peso,
    kg_brutos: kgBrutos,
    kg_desbaste: kgDesbaste,
    kg_netos: kgNetos,
    kg_totales: kgNetos,
    precio_kg: p.precio,
    venta_neta: ventaNeta,
    iva,
    total_factura: totalFactura,
    cz,
    monto,
    iibb: ventaNeta * Number(lote.alicuota_iibb ?? 0),
    mes_iibb: `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2, '0')}`,
    mes_cobro: mesCobro,
    cuotas,
    estimado: p.arrastrado || p.precio === 0,
    proyectado: true,
  }
}

/**
 * Valúa el lote resolviendo el precio solo: el peso a la fecha de venta define la BANDA,
 * y la banda + el mes definen el precio (con arrastre hacia adelante).
 * Es la función que usan tanto Productivo como Presupuesto, para que den lo mismo.
 */
export function valuarLoteConPrecios(
  lote: LoteStock,
  ventas: Pick<VentaStock, 'cantidad'>[],
  precios: PrecioHacienda[],
): ValuacionLote & { banda: string | null } {
  const fv = lote.fecha_venta_estimada
  const peso = fv ? pesoEstimado(lote, fv) : Number(lote.peso_base_kg)
  const banda = categoriaPrecio(lote.categoria, peso)

  const v = valuarLote(lote, ventas, (_cat, anio, mes) => {
    const r = resolverPrecioHacienda(precios, banda, anio, mes, null)
    return { precio: r.precio_pesos_kg, arrastrado: r.arrastrado }
  })
  return { ...v, banda }
}

/** Días corridos entre dos fechas 'YYYY-MM-DD'. */
export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(desde + 'T00:00:00').getTime()
  const b = new Date(hasta + 'T00:00:00').getTime()
  return Math.max(0, Math.round((b - a) / 86400000))
}

/**
 * Peso estimado a una fecha: el peso base más la ganancia diaria por los días
 * transcurridos DESDE LA FECHA DEL PESO, no desde la de disponibilidad.
 *
 * ⚠️ La distinción importa: si se carga el peso de HOY y se contara desde el destete, se
 * le sumaría de nuevo el engorde que ya está incluido en ese peso.
 */
export function pesoEstimado(
  lote: Pick<LoteStock, 'fecha_disponible' | 'fecha_peso' | 'peso_base_kg' | 'ganancia_diaria_kg'>,
  fechaVenta: string,
): number {
  const desde = lote.fecha_peso ?? lote.fecha_disponible
  const dias = diasEntre(desde, fechaVenta)
  return Number(lote.peso_base_kg) + dias * Number(lote.ganancia_diaria_kg)
}

/** Cabezas del lote todavía sin vender. */
export function cantidadDisponible(lote: Pick<LoteStock, 'cantidad'>, ventas: Pick<VentaStock, 'cantidad'>[]): number {
  const vendidas = ventas.reduce((s, v) => s + Number(v.cantidad || 0), 0)
  return Math.max(0, Number(lote.cantidad) - vendidas)
}
