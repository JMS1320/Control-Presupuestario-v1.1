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

import { categoriaPrecio, resolverPrecioHacienda, type PrecioHacienda } from '../ganaderia/calculo'
import { pesoEstimado, diasEntre } from '../ganaderia/ciclo'

export type { PrecioHacienda }

export interface ActividadRef { id: string; nombre: string }

export interface LoteVenta {
  categoria: string
  /** Cabezas. `cantidad_calculada` si está, si no `cantidad`. */
  cabezas: number
  peso_base_kg: number
  ganancia_diaria_kg: number
  fecha_disponible: string | null
  /** Desde acá se cuenta la ganancia diaria. Si se cuenta desde la disponibilidad se suma dos
   *  veces el engorde que ya está incluido en el peso cargado. */
  fecha_peso: string | null
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
  /** Las bandas sin precio cargado, para poder ir a cargarlas desde acá. */
  faltaPrecio: { banda: string; categoria: string; peso: number }[]
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
const num = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

/**
 * Compara nombres de actividad **sin acentos ni mayúsculas**.
 *
 * `centros_costo` dice `Cria` y `productivo.actividades` dice `Cría`: son la misma actividad y
 * comparar en crudo las daba por distintas, así que el margen decía "la actividad Cría no existe
 * en Productivo" con la actividad cargada delante. Es el mismo error que ya nos había costado
 * `No Lleva` / `No lleva`.
 */
export const claveActividad = (nombre: string) =>
  nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Modos de `actividad_insumos` que el margen sabe resolver hoy. */
export interface InsumoActividadMargen {
  actividad: string
  concepto: string
  modo: string
  valor: number
  unidad: string | null
  moneda: string
  notas: string | null
}

/**
 * Resuelve un costo directo a **pesos del período**.
 *
 * Sólo dos modos por ahora, que son los que usa la cría: por hectárea y por cabeza. Los de
 * ración (`pct_racion`, `kg_cabeza_dia`) necesitan la curva de peso y los tramos, así que se
 * informan como pendientes en vez de aproximarlos — un costo de ración mal estimado mueve el
 * margen entero.
 */
export function resolverCostoDirecto(
  i: InsumoActividadMargen,
  ctx: { has: number | null; cabezas: number | null; tc: number | null },
): { monto: number | null; motivo: string } {
  const enPesos = (v: number) => {
    if (i.moneda !== 'USD') return { factor: 1, txt: '' }
    if (ctx.tc == null) return { factor: null as number | null, txt: '' }
    return { factor: ctx.tc, txt: ` × TC ${num(ctx.tc)}` }
  }

  switch (i.modo) {
    case 'monto_ha': {
      if (ctx.has == null) return { monto: null, motivo: `${i.concepto}: faltan las hectáreas de la actividad` }
      const c = enPesos(i.valor)
      if (c.factor == null) return { monto: null, motivo: `${i.concepto}: está en U$S y falta el tipo de cambio` }
      return {
        monto: i.valor * ctx.has * c.factor,
        motivo: `${num(i.valor)} ${i.unidad ?? 'por ha'} × ${num(ctx.has)} ha${c.txt}`,
      }
    }
    case 'monto_cabeza': {
      if (ctx.cabezas == null) return { monto: null, motivo: `${i.concepto}: faltan las cabezas de la campaña` }
      const c = enPesos(i.valor)
      if (c.factor == null) return { monto: null, motivo: `${i.concepto}: está en U$S y falta el tipo de cambio` }
      return {
        monto: i.valor * ctx.cabezas * c.factor,
        motivo: `${num(i.valor)} ${i.unidad ?? 'por cabeza'} × ${num(ctx.cabezas)} cab${c.txt}`,
      }
    }
    default:
      return {
        monto: null,
        motivo: `${i.concepto}: el modo "${i.modo}" necesita la curva de peso y los tramos — todavía no se resuelve acá`,
      }
  }
}

// ⚠️ La lógica de precio y peso NO vive acá: vive en `lib/ganaderia/calculo.ts` y
// `lib/ganaderia/ciclo.ts`, que ya la usan Productivo y Presupuesto "para que den lo mismo".
// Acá se REUSA. Escribir una versión propia fue un error: la de allá tiene cosas que la mía no
// —las hembras no cotizan por peso, un macho joven que pasa 320 kg salta a invernada, el precio
// se arrastra al mes siguiente cargado, y el peso se cuenta desde `fecha_peso` y no desde la
// fecha de disponibilidad— y tener dos habría hecho que el margen y Productivo dieran distinto.

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
    const faltaPrecio: { banda: string; categoria: string; peso: number }[] = []
    let cabezasTotal = 0

    for (const l of misLotes) {
      // Peso a la fecha de venta (desde `fecha_peso`, no desde la disponibilidad) menos desbaste.
      const bruto = l.fecha_venta_estimada
        ? pesoEstimado({
            fecha_disponible: l.fecha_disponible ?? '', fecha_peso: l.fecha_peso,
            peso_base_kg: l.peso_base_kg, ganancia_diaria_kg: l.ganancia_diaria_kg,
          } as any, l.fecha_venta_estimada)
        : l.peso_base_kg
      const peso = bruto * (1 - (l.pct_desbaste || 0))

      // La BANDA sale del peso; la banda + el mes dan el precio, con arrastre.
      const banda = categoriaPrecio(l.categoria, bruto)
      const f = l.fecha_venta_estimada ? new Date(l.fecha_venta_estimada + 'T00:00:00') : null
      const r = resolverPrecioHacienda(
        d.precios, banda,
        f ? f.getFullYear() : new Date().getFullYear(),
        f ? f.getMonth() + 1 : new Date().getMonth() + 1,
        l.precio_kg_override)
      const precio = r.precio_pesos_kg > 0 ? r.precio_pesos_kg : null
      const segunPrecio = r.manual ? 'precio puesto en el lote'
        : r.arrastrado ? `${banda} (arrastrado)` : banda
      cabezasTotal += l.cabezas

      if (precio == null) {
        faltantes.push(`falta el precio de ${banda}`)
        faltaPrecio.push({ banda, categoria: l.categoria, peso: bruto })
        ingresos.push({
          concepto: `Venta ${l.categoria}`, unidades: l.cabezas, etiquetaUnidad: 'cab',
          total: 0, porHa: null, porCabeza: null,
          detalle: `${num(l.cabezas)} cab × ${num(peso)} kg — sin precio`,
          confiable: false,
        })
        continue
      }

      const ventaBruta = l.cabezas * peso * precio
      const gastoVenta = ventaBruta * d.pctGastoVenta(l.categoria)
      const neto = ventaBruta - gastoVenta

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
      faltantes, faltaPrecio,
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
