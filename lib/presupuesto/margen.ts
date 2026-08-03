// Margen por actividad — Fase 0: leer, no duplicar.
//
// El Excel MARGENES está casi entero en la app, repartido. Esta fase NO crea tablas: arma el
// margen leyendo de donde el dato ya vive.
//
//   hectáreas          → campo_campana_actividad     (lo cargamos el 2026-08-02)
//   cabezas y % rodeo  → productivo.stock_ciclos     (vacas_apertura, pct_destete, pct_reposicion…)
//   ventas             → productivo.stock_lotes      (categoría, cabezas, peso, desbaste, fecha)
//   precios            → public.precios_hacienda
//   costos directos    → productivo.actividad_insumos
//
// ── La lógica es la del Excel ────────────────────────────────────────────────
//   INGRESO NETO  = ventas (cabezas × peso neto × $/kg) − gastos de venta
//   MARGEN BRUTO  = ingreso neto − costos directos − mantenimiento
//   y todo se mira POR UNIDAD y en TOTAL: por ha, por cabeza, y el total.
//
// ── En PESOS ─────────────────────────────────────────────────────────────────
// El Excel está en U$S porque se hizo así; acá se trabaja en pesos y el dólar queda como una
// vista aparte, con TC promedio. Convertir de entrada obligaría a elegir un TC antes de tener
// el número, que es al revés de como se decide.

export interface ActividadRef { id: string; nombre: string }

export interface LoteVenta {
  categoria: string
  /** Cabezas. `cantidad_calculada` si está, si no `cantidad`. */
  cabezas: number
  peso_base_kg: number
  ganancia_diaria_kg: number
  fecha_disponible: string | null
  fecha_venta_estimada: string | null
  precio_kg_override: number | null
  pct_desbaste: number
  campania: string | null
  /** A qué actividad pertenece, resuelto desde la categoría. */
  actividad: string | null
}

export interface CostoDirecto {
  actividad: string
  concepto: string
  /** Ya resuelto a pesos del período por quien llama. `null` = no se pudo calcular. */
  monto: number | null
  motivo: string
}

export interface DatosMargen {
  campana: string
  /** has netas por actividad. */
  hasPorActividad: Record<string, number>
  lotes: LoteVenta[]
  costos: CostoDirecto[]
  /** Precios de mercado, por categoría y rango de peso. */
  precios: PrecioHacienda[]
  /** % de gastos de venta por categoría (3 % liviano, 9 % vaca/toro en el Excel). */
  pctGastoVenta: (categoria: string) => number
}

export interface LineaMargen {
  concepto: string
  /** Unidades físicas: cabezas, kg, ha. */
  unidades: number | null
  etiquetaUnidad: string
  /** Total en pesos. */
  total: number
  /** Por hectárea. */
  porHa: number | null
  /** Por cabeza, cuando tiene sentido. */
  porCabeza: number | null
  detalle: string
  /** `false` cuando el número está incompleto y no hay que confiar en él. */
  confiable: boolean
}

export interface MargenActividad {
  actividad: string
  has: number | null
  cabezas: number | null
  ingresos: LineaMargen[]
  costos: LineaMargen[]
  totalIngresos: number
  totalCostos: number
  margenBruto: number
  margenPorHa: number | null
  /** Lo que falta para que el margen sea confiable. Vacío = está completo. */
  faltantes: string[]
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
const num = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

/** Un precio de mercado, tal como está cargado: por categoría Y rango de peso. */
export interface PrecioHacienda {
  categoria: string
  peso_desde: number | null
  peso_hasta: number | null
  precio_pesos_kg: number
  anio: number
  mes: number
}

/**
 * El sexo/tipo base de una categoría, para casar el lote con el precio.
 *
 * `stock_lotes` dice "Ternero al Pie" y el precio dice "Ternero 180/200": son el mismo animal.
 * Y macho y hembra van SEPARADOS — un ternero y una ternera del mismo peso no valen lo mismo.
 */
export function tipoBase(categoria: string): string {
  const c = categoria.toLowerCase()
  if (c.startsWith('ternera')) return 'ternera'
  if (c.startsWith('ternero')) return 'ternero'
  if (c.startsWith('novillito')) return 'novillito'
  if (c.startsWith('novillo')) return 'novillo'
  if (c.startsWith('vaquillona')) return 'vaquillona'
  if (c.startsWith('vaca')) return 'vaca'
  if (c.startsWith('toro') || c.startsWith('torito')) return 'toro'
  return c.split(' ')[0] ?? c
}

/**
 * El precio de un animal: **por su tipo y por el peso al que se vende**.
 *
 * Lo explicó el usuario: *"el ternero de 180/200 kg es el ternero al pie que se desteta con la
 * venta misma. Pero si pesan 220, caerá por rango: finalmente es un ternero de tantos kg"*.
 * O sea que la categoría del rodeo no manda — manda **el peso de venta**.
 *
 * Devuelve `null` si no hay un rango que lo contenga. No se cae al precio más cercano: un
 * ternero de 260 kg no vale lo que uno de 200, y estirar el rango escondería que falta cargarlo.
 */
export function buscarPrecio(
  categoria: string, pesoKg: number, precios: PrecioHacienda[],
): { precio: number; segun: string } | null {
  const tipo = tipoBase(categoria)
  const candidatos = precios
    .filter(p => tipoBase(p.categoria) === tipo && p.precio_pesos_kg > 0)
    .filter(p => (p.peso_desde ?? -Infinity) <= pesoKg && pesoKg <= (p.peso_hasta ?? Infinity))
    // El más reciente manda.
    .sort((a, b) => (b.anio * 12 + b.mes) - (a.anio * 12 + a.mes))

  const p = candidatos[0]
  if (!p) return null
  return { precio: p.precio_pesos_kg, segun: `${p.categoria} (${p.mes}/${p.anio})` }
}

/** Peso de venta: el peso base + lo que gana hasta la fecha de venta, menos el desbaste. */
export function pesoNetoVenta(l: LoteVenta): number {
  let peso = l.peso_base_kg
  if (l.fecha_disponible && l.fecha_venta_estimada && l.ganancia_diaria_kg > 0) {
    const dias = Math.max(0, Math.round(
      (new Date(l.fecha_venta_estimada).getTime() - new Date(l.fecha_disponible).getTime()) / 86400000))
    peso += dias * l.ganancia_diaria_kg
  }
  // El desbaste es la merma de báscula: se vende menos kilos de los que pesa en el campo.
  return peso * (1 - (l.pct_desbaste || 0))
}

/**
 * El margen de cada actividad.
 *
 * Cuando falta un dato NO se completa con cero: la línea queda `confiable: false` y el faltante
 * sube a `faltantes`. Un margen que muestra un número redondo sobre datos incompletos es peor
 * que uno que dice qué le falta — sobre todo si se le presenta a los socios.
 */
export function calcularMargen(d: DatosMargen): MargenActividad[] {
  const actividades = new Set<string>([
    ...Object.keys(d.hasPorActividad),
    ...d.lotes.map(l => l.actividad).filter(Boolean) as string[],
    ...d.costos.map(c => c.actividad),
  ])

  return Array.from(actividades).sort().map(act => {
    const has = d.hasPorActividad[act] ?? null
    const misLotes = d.lotes.filter(l => l.actividad === act && (l.campania == null || l.campania === d.campana))
    const misCostos = d.costos.filter(c => c.actividad === act)
    const faltantes: string[] = []

    const ingresos: LineaMargen[] = []
    let cabezasTotal = 0

    for (const l of misLotes) {
      const peso = pesoNetoVenta(l)
      // El override del lote manda; si no, se busca por tipo y peso de venta.
      const delMercado = buscarPrecio(l.categoria, peso, d.precios)
      const precio = l.precio_kg_override ?? delMercado?.precio ?? null
      const segunPrecio = l.precio_kg_override != null
        ? "precio puesto en el lote"
        : delMercado?.segun ?? ""
      cabezasTotal += l.cabezas

      if (precio == null) {
        faltantes.push(`falta el precio de ${tipoBase(l.categoria)} para ${num(peso)} kg`)
        ingresos.push({
          concepto: `Venta ${l.categoria}`, unidades: l.cabezas, etiquetaUnidad: 'cab',
          total: 0, porHa: null, porCabeza: null,
          detalle: `${num(l.cabezas)} cab × ${num(peso)} kg — sin precio`,
          confiable: false,
        })
        continue
      }

      const bruto = l.cabezas * peso * precio
      const gastoVenta = bruto * d.pctGastoVenta(l.categoria)
      const neto = bruto - gastoVenta

      ingresos.push({
        concepto: `Venta ${l.categoria}`,
        unidades: l.cabezas, etiquetaUnidad: 'cab',
        total: neto,
        porHa: has ? neto / has : null,
        porCabeza: l.cabezas > 0 ? neto / l.cabezas : null,
        detalle: `${num(l.cabezas)} cab × ${num(peso)} kg × ${pesos(precio)}/kg`
          + ` − ${pesos(gastoVenta)} de gastos de venta · ${segunPrecio}`,
        confiable: true,
      })
    }

    const costos: LineaMargen[] = misCostos.map(c => {
      if (c.monto == null) {
        faltantes.push(`${c.concepto}: ${c.motivo}`)
        return {
          concepto: c.concepto, unidades: null, etiquetaUnidad: '',
          total: 0, porHa: null, porCabeza: null, detalle: c.motivo, confiable: false,
        }
      }
      return {
        concepto: c.concepto, unidades: null, etiquetaUnidad: '',
        total: c.monto,
        porHa: has ? c.monto / has : null,
        porCabeza: cabezasTotal > 0 ? c.monto / cabezasTotal : null,
        detalle: c.motivo, confiable: true,
      }
    })

    if (has == null) faltantes.push('no tiene hectáreas asignadas en esta campaña')
    if (misCostos.length === 0) faltantes.push('no tiene costos directos cargados')

    const totalIngresos = ingresos.filter(i => i.confiable).reduce((s, i) => s + i.total, 0)
    const totalCostos = costos.filter(c => c.confiable).reduce((s, c) => s + c.total, 0)
    const margenBruto = totalIngresos - totalCostos

    return {
      actividad: act,
      has, cabezas: cabezasTotal || null,
      ingresos, costos,
      totalIngresos, totalCostos, margenBruto,
      margenPorHa: has ? margenBruto / has : null,
      faltantes,
    }
  })
}

/**
 * Gastos de venta por categoría, con los % del Excel.
 *
 * 3 % la hacienda liviana (terneros), 9 % vacas y toros. Es una regla del negocio, no una
 * constante técnica: cuando haya dónde configurarla, sale de ahí.
 */
export function pctGastoVentaPorDefecto(categoria: string): number {
  const c = categoria.toLowerCase()
  if (c.includes('vaca') || c.includes('toro')) return 0.09
  return 0.03
}
