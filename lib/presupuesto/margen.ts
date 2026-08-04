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
// La cadena de ajustes es la MISMA que la del presupuesto. Una sola implementación, o el margen
// y el presupuesto terminan dando distinto sobre el mismo costo.
import { aplicarAjustes, type Ajuste, type Paso } from './variables'

export type { PrecioHacienda }
export type { Ajuste, Paso }

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
  /** El insumo del que salió, para poder editarlo desde la fila del margen. */
  insumoId?: string
  /** Cómo se llegó al número, paso a paso. Es lo que se ve al desplegar la fila. */
  pasos?: Paso[]
  /** Lo que escribió el usuario sobre por qué estima así. */
  fundamento?: string | null
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
  /** El insumo del que salió la línea, cuando es un costo editable desde el margen. */
  insumoId?: string
  /** La conformación del número, para desplegar debajo de la fila. */
  pasos?: Paso[]
  fundamento?: string | null
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
  id?: string
  actividad: string
  concepto: string
  modo: string
  valor: number
  unidad: string | null
  moneda: string
  /** Sobre cuántas hectáreas aplica ESTE costo. NULL = las de la actividad. */
  has_aplicacion: number | null
  /** En cuántos años se reparte. 4 → 25 % por año. NULL o 1 → entero. */
  amortiza_anios: number | null
  /** Sobre qué cabezas aplica: `rodeo` (default) · `vacas` · `destetados` · `toritos` · `manual`… */
  base_cabezas: string | null
  /** Cantidad fija, cuando `base_cabezas = 'manual'`. */
  cabezas_aplicacion: number | null
  /** Cantidad fija del modo `monto_unidad`: 136,41 ton de silo, 7000 lts de gas oil. */
  cantidad_aplicacion: number | null
  /** La cadena: `base × IPC × +30 %`. Vacía = el valor se toma tal cual. */
  ajustes?: Ajuste[]
  /** Por qué se estima así. Lo escribe el usuario. */
  fundamento: string | null
  notas: string | null
}

/**
 * Las cabezas del ciclo, por concepto. Es lo que permite que la sanidad de toros no se cobre
 * sobre las 260 vacas.
 */
export interface CabezasDelCiclo {
  rodeo: number
  vacas: number
  vaquillonas: number
  destetados: number
  terneros: number
  terneras: number
  retenidas: number
  toritos: number
}

export const ETIQUETA_BASE_CABEZAS: Record<string, string> = {
  rodeo: 'rodeo (vacas + vaquillonas)',
  vacas: 'vacas',
  vaquillonas: 'vaquillonas',
  destetados: 'terneros destetados',
  terneros: 'terneros',
  terneras: 'terneras',
  retenidas: 'terneras retenidas',
  toritos: 'toritos',
  manual: 'cantidad fija',
}

/**
 * Resuelve un costo directo a **pesos del período**, con su cadena a la vista.
 *
 * Tres modos, que son los que usa la cría: por hectárea, por cabeza y por unidad (toneladas de
 * silo, litros de gasoil). Los de ración (`pct_racion`, `kg_cabeza_dia`) necesitan la curva de
 * peso y los tramos, así que se informan como pendientes en vez de aproximarlos — un costo de
 * ración mal estimado mueve el margen entero.
 *
 * Sobre la base se aplica la **cadena de ajustes**, que es lo que permite decir *"lo de los
 * últimos 12 meses × IPC × el aumento de cabezas"* en vez de un número fijo. Los `pasos` no son
 * decoración: son lo que se despliega en la fila del margen para poder discutir el número.
 */
export function resolverCostoDirecto(
  i: InsumoActividadMargen,
  ctx: {
    has: number | null; cabezas: number | null
    cabezasCiclo?: CabezasDelCiclo | null; tc: number | null
    /** Para el ajuste por IPC. 0.87 = 87 %. */
    ipcAcumulado?: number | null
  },
): { monto: number | null; motivo: string; pasos: Paso[] } {
  const enPesos = () => {
    if (i.moneda !== 'USD') return { factor: 1, txt: '' }
    if (ctx.tc == null) return { factor: null as number | null, txt: '' }
    return { factor: ctx.tc, txt: ` × TC ${num(ctx.tc)}` }
  }
  const falta = (motivo: string) => ({ monto: null, motivo: `${i.concepto}: ${motivo}`, pasos: [] as Paso[] })

  /** La base ya en pesos, más la cadena encima. Una sola salida para los tres modos. */
  const conAjustes = (base: number, motivoBase: string): { monto: number; motivo: string; pasos: Paso[] } => {
    const pasos: Paso[] = [{ etiqueta: 'Base', detalle: motivoBase, acumulado: base }]
    const aj = aplicarAjustes(base, i.ajustes ?? [], { ipcAcumulado: ctx.ipcAcumulado })
    pasos.push(...aj.pasos)
    const motivo = aj.pasos.length === 0
      ? motivoBase
      : `${motivoBase} ${aj.pasos.map(p => `× ${p.detalle}`).join(' ')}`
    return { monto: aj.valor, motivo, pasos }
  }

  switch (i.modo) {
    case 'monto_ha': {
      // La superficie del COSTO, no la de la actividad: el mantenimiento de pasturas va sobre
      // las 15 has de pastura, no sobre las 175 del campo.
      const has = i.has_aplicacion ?? ctx.has
      if (has == null) return falta('faltan las hectáreas')
      const c = enPesos()
      if (c.factor == null) return falta('está en U$S y falta el tipo de cambio')
      // Amortización: una pastura que dura 4 años entra al 25 % por año.
      // ⚠️ Esto es del MARGEN. El presupuesto es caja y no amortiza: el año que se siembra
      // paga el 100 % y los siguientes cero.
      const anios = i.amortiza_anios && i.amortiza_anios > 1 ? i.amortiza_anios : 1
      const txtAmort = anios > 1 ? ` ÷ ${anios} años` : ''
      const propia = i.has_aplicacion != null && ctx.has != null && i.has_aplicacion !== ctx.has
      return conAjustes(
        (i.valor * has * c.factor) / anios,
        `${num(i.valor)} ${i.unidad ?? 'por ha'} × ${num(has)} ha`
          + (propia ? ' (superficie propia del costo)' : '') + txtAmort + c.txt,
      )
    }
    case 'monto_cabeza': {
      // Cada costo tiene SU base: la sanidad de toros no va sobre las 260 vacas.
      const base = i.base_cabezas ?? 'rodeo'
      const cab = base === 'manual'
        ? i.cabezas_aplicacion
        : ctx.cabezasCiclo?.[base as keyof CabezasDelCiclo] ?? ctx.cabezas
      if (cab == null) return falta(`faltan las cabezas (${ETIQUETA_BASE_CABEZAS[base] ?? base})`)
      const c = enPesos()
      if (c.factor == null) return falta('está en U$S y falta el tipo de cambio')
      return conAjustes(
        i.valor * cab * c.factor,
        `${num(i.valor)} ${i.unidad ?? 'por cabeza'} × ${num(cab)} ${ETIQUETA_BASE_CABEZAS[base] ?? base}${c.txt}`,
      )
    }
    case 'monto_unidad': {
      // Cantidad física por su precio: 136,41 ton de silo, 7000 lts de gasoil al año. No todo
      // costo se deja expresar por cabeza o por hectárea, y forzarlo fue lo que puso el silo
      // como `monto_ha` multiplicando por una superficie que no tenía nada que ver.
      const q = i.cantidad_aplicacion
      if (q == null) return falta(`falta la cantidad (${i.unidad ?? 'unidades'})`)
      const c = enPesos()
      if (c.factor == null) return falta('está en U$S y falta el tipo de cambio')
      const anios = i.amortiza_anios && i.amortiza_anios > 1 ? i.amortiza_anios : 1
      const txtAmort = anios > 1 ? ` ÷ ${anios} años` : ''
      return conAjustes(
        (q * i.valor * c.factor) / anios,
        `${num(q)} ${i.unidad ?? 'unidades'} × ${num(i.valor)}${c.txt}${txtAmort}`,
      )
    }
    default:
      return {
        monto: null, pasos: [],
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
      const comun = { insumoId: c.insumoId, pasos: c.pasos, fundamento: c.fundamento }
      if (c.monto == null) {
        faltantes.push(`${c.concepto}: ${c.motivo}`)
        return {
          concepto: c.concepto, unidades: null, etiquetaUnidad: '',
          total: 0, porHa: null, porCabeza: null, detalle: c.motivo, confiable: false,
          ...comun,
        }
      }
      return {
        concepto: c.concepto, unidades: null, etiquetaUnidad: '',
        total: c.monto,
        porHa: has ? c.monto / has : null,
        porCabeza: cabezasTotal > 0 ? c.monto / cabezasTotal : null,
        detalle: c.motivo, confiable: true,
        ...comun,
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
