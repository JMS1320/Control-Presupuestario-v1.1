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
import type { CeldaPresupuesto } from './modos'

export type { PrecioHacienda }
export type { Ajuste, Paso, CeldaPresupuesto }

export interface ActividadRef { id: string; nombre: string }

/**
 * Una venta que YA OCURRIÓ (`productivo.stock_ventas`).
 *
 * ⚠️ **Manda sobre la proyección del lote.** Es la regla `default del dato real, siempre editable`
 * de `CLAUDE.md`: el lote es el plan, esto es lo que pasó. El caso testigo: el lote de los 55
 * decía 275 kg y $5.876/kg (proyección) y la venta real fue **294,18 kg a $5.670** — el margen
 * facturaba la proyección teniendo el dato real cargado al lado.
 */
export interface VentaRealLote {
  loteId: string
  fecha: string
  cabezas: number
  /** Los kg que se facturaron (ya netos de desbaste). */
  kgTotales: number
  precioKg: number
  /** Lo que entró, ya neto de la comisión. Si falta se recalcula. */
  montoNeto: number | null
  pctCz: number
}

export interface LoteVenta {
  /** Para poder cruzarlo con sus ventas reales. */
  id?: string
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
  /**
   * A qué actividad PASA, cuando no se vende afuera (reposición, destete que va a recría).
   *
   * `null` = venta externa. Con valor, el lote deja de ser una venta y pasa a ser una
   * **transferencia interna**: ingreso para `actividad` y costo de entrada para ésta, con el
   * mismo número. Y sin comisión ni IVA, porque no hay mercado en el medio.
   */
  destinoActividad?: string | null
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
  /** Las facturas reales que entraron, cuando el arranque es histórico. */
  celdas?: CeldaPresupuesto[]
  historicoModo?: string | null
}

/**
 * Una transferencia interna entre dos actividades: la misma operación vista de los dos lados.
 *
 * El caso testigo es el ciclo ganadero, que tiene las dos puntas:
 *   · **cría → recría** — el destete. Cierra el resultado de cría y abre el de recría.
 *   · **recría → cría** — las vaquillonas de reposición, que no se venden afuera.
 *
 * ⚠️ **Un solo número para los dos lados.** No son dos hechos que hay que hacer coincidir: es
 * uno solo, y por eso se guarda una vez. Si se cargaran dos, en algún momento dejan de coincidir
 * y ninguno de los dos márgenes cierra.
 *
 * Sin esto los animales entran a costo cero: el que recibe muestra ganancia de más y el que
 * entrega, de menos. Es el mismo aviso que ya da el panel de ciclo de recría.
 */
export interface TransferenciaInterna {
  concepto: string
  /** La actividad que ENTREGA: le entra como ingreso. */
  actividadOrigen: string
  /** La actividad que RECIBE: le sale como costo. */
  actividadDestino: string
  cabezas: number
  /** Kg netos totales (ya con el desbaste aplicado). Es sobre lo que se paga. */
  kgNetos: number
  precioKg: number | null
  /** `null` mientras falte el precio. Nunca cero. */
  monto: number | null
  /** A qué campaña cae, resuelto por la FECHA del hecho. */
  campania: string | null
  detalle: string
}

/** La campaña (jul → jun) a la que pertenece una fecha. `"2026-02-23"` → `"25/26"`. */
export function campanaDeFecha(iso: string): string | null {
  const m = iso?.match(/^(\d{4})-(\d{2})/)
  if (!m) return null
  const anio = parseInt(m[1]!, 10)
  const mes = parseInt(m[2]!, 10)
  const ini = (mes >= 7 ? anio : anio - 1) % 100
  return `${String(ini).padStart(2, '0')}/${String((ini + 1) % 100).padStart(2, '0')}`
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
  /** Las transferencias entre actividades. Opcional: los datos viejos no las traen. */
  transferencias?: TransferenciaInterna[]
  /** Las ventas que ya ocurrieron. Mandan sobre la proyección del lote. */
  ventasReales?: VentaRealLote[]
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
  /** Las facturas reales que entraron, cuando el arranque es histórico. */
  celdas?: CeldaPresupuesto[]
  historicoModo?: string | null
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

// ── El modelo de TRES RANURAS ────────────────────────────────────────────────
//
//     CUÁNTO  ×  A CUÁNTO  ×  SOBRE QUÉ   →  ajustes  →  dónde cae
//
// Decidido con el usuario 2026-08-03 contra un constructor libre de fórmula (pasos con + − × ÷).
// La FORMA es fija; lo que se elige es **de dónde sale cada pieza**. Motivo: el constructor libre
// da versatilidad total y practicidad cero — es Excel adentro de la app.
//
// Los dos operadores que parecen faltar, no faltan:
//   · la SUMA ya existe → son dos filas, y el margen suma las filas;
//   · "vaca + vaquillona" no es una suma → es una BASE CON NOMBRE (`base_categorias`).

/** Sobre qué se aplica el costo. */
export type BaseTipo = 'cabezas' | 'hectareas' | 'cantidad' | 'ninguna'

/** De dónde sale el precio unitario. */
export type PrecioFuente = 'manual' | 'hacienda' | 'grano' | 'insumo' | 'historico'

export type DistribucionCosto = 'mensual' | 'un_mes' | 'calendario' | 'cupo_anual'

/** Un mes del período presupuestado. */
export interface MesPeriodo { anio: number; mes: number }

export const claveMes = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, '0')}`

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

  // ── El modelo de 3 ranuras. `base_tipo` presente = esta fila lo usa. ────────
  /** CUÁNTO: unidades por unidad de base. IATF: 9 kg de novillo por vaca. */
  cantidad?: number | null
  cantidad_unidad?: string | null
  /** A CUÁNTO: de dónde sale el precio unitario. */
  precio_fuente?: PrecioFuente | null
  /** La banda de hacienda ("Novillo") o el grano del que sale el precio. */
  precio_referencia?: string | null
  /** SOBRE QUÉ. */
  base_tipo?: BaseTipo | null
  /** Las categorías del rodeo que SUMAN. La suma sin operador. */
  base_categorias?: string[] | null
  /** El override a mano: IATF va sobre 240, porque no se inseminan todas. */
  base_manual?: number | null
  /** El arranque histórico, con los modos del panel de cuentas. */
  historico_modo?: string | null
  historico_meses?: number | null
  nro_cuentas?: string[] | null
  /** Dónde cae. */
  distribucion?: DistribucionCosto | null
  /** % del total por mes: `{ 3: 40, 4: 60 }`. */
  meses_pct?: Record<string, number> | null
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

/** Lo que el resolvedor necesita saber del mundo. */
export interface ContextoCosto {
  has: number | null
  cabezas: number | null
  cabezasCiclo?: CabezasDelCiclo | null
  /** ⚠️ TC de **cada mes**, con arrastre. No uno solo: ver `resolverCostoDirecto`. */
  tcPorMes?: Record<string, number>
  /** El TC de referencia, sólo para las filas viejas que todavía no dicen en qué meses caen. */
  tc: number | null
  /** Los meses del período, en orden de CAMPAÑA (jul → jun). */
  meses?: MesPeriodo[]
  /** Para saber qué meses ya pasaron. Inyectable para poder testear. */
  hoy?: Date
  /** Para el ajuste por IPC. 0.87 = 87 %. */
  ipcAcumulado?: number | null
  /** El precio de una referencia ("Novillo") en un mes. Lo resuelve quien llama. */
  precioDe?: (fuente: PrecioFuente, referencia: string, anio: number, mes: number) => number | null
  /**
   * El arranque histórico: lo gastado en esas cuentas, ya resuelto.
   *
   * Devuelve también las `celdas` para poder mostrar **la muestra** —qué facturas reales
   * entraron—, que es lo que el usuario ya tiene en cuentas contables y pidió acá.
   */
  historicoDe?: (cuentas: string[], modo: string, meses: number)
    => { monto: number; motivo: string; celdas?: CeldaPresupuesto[] } | null
}

/**
 * En qué meses cae el costo y con qué porcentaje.
 *
 * El usuario lo pidió explícito: *"debo poder seleccionar meses en los que cae y % del total de
 * costo a cada mes"*. El reparto parejo es el caso particular en que todos los % son iguales.
 */
export function repartoDelCosto(
  i: InsumoActividadMargen,
  meses: MesPeriodo[],
  hoy?: Date,
): { mes: MesPeriodo; pct: number }[] {
  if (meses.length === 0) return []

  /**
   * Un mes YA PASADO no se presupuesta: lo que se gastó, se gastó, y está en la contabilidad.
   *
   * El usuario lo planteó así: *"yo pondría que el 30 % se gasta en julio pero ya pasó, así que
   * no tiene dónde ponerlo (esto estaría ok), pero llena de agosto en adelante"*. Entonces ese
   * 30 % **no se redistribuye**: simplemente no se proyecta, y del costo anual queda el 70 %.
   * Repartirlo entre los meses que quedan sería inventar un gasto que ya no va a ocurrir.
   */
  const ref = hoy ?? new Date()
  const km = (m: MesPeriodo) => m.anio * 12 + (m.mes - 1)
  const kmHoy = ref.getFullYear() * 12 + ref.getMonth()
  const vigente = (m: MesPeriodo) => km(m) >= kmHoy

  // % explícito por mes: es el que manda.
  const pct = i.meses_pct ?? null
  if (pct && Object.keys(pct).length > 0) {
    const todos = meses
      .map(m => ({ mes: m, pct: Number(pct[String(m.mes)] ?? 0) }))
      .filter(x => x.pct > 0)
    // ⚠️ La normalización usa el total de TODOS los meses cargados, incluidos los que ya pasaron.
    // Así 40/60 y 4/6 dan lo mismo, y si julio ya pasó su parte se pierde en vez de engordar a
    // los que quedan.
    const suma = todos.reduce((s, x) => s + x.pct, 0)
    if (suma > 0) {
      return todos.filter(x => vigente(x.mes)).map(x => ({ mes: x.mes, pct: x.pct / suma }))
    }
  }

  switch (i.distribucion) {
    case 'un_mes':
    case 'cupo_anual': {
      const m = meses.find(vigente) ?? meses[meses.length - 1]!
      return [{ mes: m, pct: 1 }]
    }
    case 'mensual':
    default:
      // Mismo criterio: cada mes vale 1/12 del año y los que pasaron no se proyectan.
      return meses.filter(vigente).map(m => ({ mes: m, pct: 1 / meses.length }))
  }
}

/**
 * El costo por el modelo de **tres ranuras**: CUÁNTO × A CUÁNTO × SOBRE QUÉ.
 *
 * Devuelve el total del período **y el desglose por mes**, porque el dólar no vale lo mismo en
 * marzo que en octubre: cada mes usa **su** TC de la tabla. Antes el margen usaba un TC único
 * —el más reciente— para todo el año, que es exactamente el `1.450` fijo del Excel con otro
 * nombre. Lo marcó el usuario: *"cuando algo es en dólares se debe multiplicar por el TC de la
 * tabla, no 1.450 que estaba fijo en Excel"*.
 */
function resolverTresRanuras(
  i: InsumoActividadMargen,
  ctx: ContextoCosto,
): {
  monto: number | null; motivo: string; pasos: Paso[]
  porMes: Record<string, number>
  /** Las facturas reales que entraron, cuando el arranque es histórico. */
  celdas?: CeldaPresupuesto[]
} {
  const pasos: Paso[] = []
  const falta = (m: string) => ({ monto: null, motivo: `${i.concepto}: ${m}`, pasos: [], porMes: {} })

  // ── SOBRE QUÉ ──────────────────────────────────────────────────────────────
  let base: number
  let baseTxt: string
  if (i.base_manual != null) {
    base = i.base_manual
    baseTxt = `${num(base)} (a mano)`
  } else {
    switch (i.base_tipo) {
      case 'cabezas': {
        const cats = i.base_categorias ?? ['rodeo']
        const c = ctx.cabezasCiclo
        if (!c) return falta('faltan las cabezas del ciclo')
        // La SUMA de las categorías tildadas. Es "vaca + vaquillona" sin un operador a la vista.
        base = cats.reduce((s, k) => s + (c[k as keyof CabezasDelCiclo] ?? 0), 0)
        baseTxt = `${num(base)} (${cats.map(k => ETIQUETA_BASE_CABEZAS[k] ?? k).join(' + ')})`
        break
      }
      case 'hectareas': {
        const h = i.has_aplicacion ?? ctx.has
        if (h == null) return falta('faltan las hectáreas')
        base = h; baseTxt = `${num(h)} ha`
        break
      }
      case 'cantidad': {
        if (i.cantidad_aplicacion == null) return falta(`falta la cantidad (${i.unidad ?? 'unidades'})`)
        base = i.cantidad_aplicacion
        baseTxt = `${num(base)} ${i.unidad ?? 'unidades'}`
        break
      }
      default:
        base = 1; baseTxt = ''
    }
  }

  // ── CUÁNTO ─────────────────────────────────────────────────────────────────
  const cuanto = i.cantidad ?? 1
  const cuantoTxt = cuanto === 1 ? '' : `${num(cuanto)}${i.cantidad_unidad ? ' ' + i.cantidad_unidad : ''}`

  // ── A CUÁNTO ───────────────────────────────────────────────────────────────
  // El arranque histórico no es un precio unitario: es el monto del período, ya resuelto. Por eso
  // sale por un camino aparte y el CUÁNTO × SOBRE QUÉ no lo multiplica.
  if (i.precio_fuente === 'historico') {
    const cuentas = i.nro_cuentas ?? []
    if (cuentas.length === 0) return falta('falta elegir en qué cuentas contables basarse')
    const h = ctx.historicoDe?.(cuentas, i.historico_modo ?? 'promedio_n', i.historico_meses ?? 12)
    if (!h) return falta('no hay historia en esas cuentas para calcularlo')
    pasos.push({ etiqueta: 'Base (histórico)', detalle: h.motivo, acumulado: h.monto })
    const aj = aplicarAjustes(h.monto, i.ajustes ?? [], { ipcAcumulado: ctx.ipcAcumulado })
    pasos.push(...aj.pasos)
    return {
      monto: aj.valor,
      motivo: `${h.motivo}${aj.pasos.map(p => ` × ${p.detalle}`).join('')}`,
      pasos,
      porMes: repartirPorMes(i, aj.valor, ctx),
      celdas: h.celdas,
    }
  }

  const meses = ctx.meses ?? []
  const reparto = repartoDelCosto(i, meses, ctx.hoy)

  // El precio, mes a mes: una referencia de hacienda puede cambiar dentro del período.
  const precioEnMes = (m: MesPeriodo): number | null => {
    if (i.precio_fuente && i.precio_fuente !== 'manual' && i.precio_referencia) {
      return ctx.precioDe?.(i.precio_fuente, i.precio_referencia, m.anio, m.mes) ?? null
    }
    return i.valor
  }

  const anios = i.amortiza_anios && i.amortiza_anios > 1 ? i.amortiza_anios : 1
  const porMes: Record<string, number> = {}
  let total = 0
  let faltaPrecio = false
  let faltaTc = false

  for (const r of reparto) {
    const p = precioEnMes(r.mes)
    if (p == null) { faltaPrecio = true; continue }
    // ⚠️ El TC DE ESE MES, no uno solo para todo el año.
    let tc = 1
    if (i.moneda === 'USD') {
      const t = ctx.tcPorMes?.[claveMes(r.mes.anio, r.mes.mes)] ?? ctx.tc
      if (t == null) { faltaTc = true; continue }
      tc = t
    }
    const monto = (cuanto * p * base * tc * r.pct) / anios
    porMes[claveMes(r.mes.anio, r.mes.mes)] = monto
    total += monto
  }

  if (faltaPrecio) return falta(`falta el precio de ${i.precio_referencia ?? 'la referencia'}`)
  if (faltaTc) return falta('está en U$S y falta el tipo de cambio de algún mes')
  if (reparto.length === 0) return falta('no tiene meses asignados')

  const tcTxt = i.moneda === 'USD' ? ' × TC del mes' : ''
  const amortTxt = anios > 1 ? ` ÷ ${anios} años` : ''
  const partes = [cuantoTxt, `${num(i.valor)}${i.unidad ? ' ' + i.unidad : ''}`, baseTxt].filter(Boolean)
  const motivoBase = partes.join(' × ') + tcTxt + amortTxt

  pasos.push({ etiqueta: 'Base', detalle: motivoBase, acumulado: total })
  const aj = aplicarAjustes(total, i.ajustes ?? [], { ipcAcumulado: ctx.ipcAcumulado })
  pasos.push(...aj.pasos)
  if (aj.pasos.length > 0) {
    const f = total > 0 ? aj.valor / total : 1
    for (const k of Object.keys(porMes)) porMes[k] *= f
  }

  return {
    monto: aj.valor,
    motivo: motivoBase + aj.pasos.map(p => ` × ${p.detalle}`).join(''),
    pasos,
    porMes,
  }
}

/** Reparte un monto anual ya resuelto en los meses que le tocan. */
function repartirPorMes(
  i: InsumoActividadMargen, monto: number, ctx: ContextoCosto,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of repartoDelCosto(i, ctx.meses ?? [], ctx.hoy)) {
    out[claveMes(r.mes.anio, r.mes.mes)] = monto * r.pct
  }
  return out
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
  ctx: ContextoCosto,
): {
  monto: number | null; motivo: string; pasos: Paso[]
  porMes?: Record<string, number>; celdas?: CeldaPresupuesto[]
} {
  // El modelo de 3 ranuras manda cuando la fila lo declara. Las que no lo tienen —recría y
  // engorde, que van por ración— siguen por el camino de siempre.
  if (i.base_tipo) return resolverTresRanuras(i, ctx)

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
  // ── Los lotes que NO se venden afuera son transferencias, no ventas ──────────
  //
  // Un lote con destino a otra actividad deja de ser un ingreso de mercado y pasa a ser el
  // mismo hecho visto de los dos lados. Se arma acá —y no en el que llama— para que valga
  // igual venga de donde venga el lote.
  //
  // ⚠️ Sin IVA y sin comisión: no hay mercado en el medio. Lo que se traspasa es el animal.
  const lotesInternos = d.lotes.filter(l => l.destinoActividad && l.actividad)
  const transferDeLotes: TransferenciaInterna[] = lotesInternos.map(l => {
    const fecha = l.fecha_venta_estimada ?? l.fecha_disponible ?? ''
    const bruto = fecha
      ? pesoEstimado({
          fecha_disponible: l.fecha_disponible ?? '', fecha_peso: l.fecha_peso,
          peso_base_kg: l.peso_base_kg, ganancia_diaria_kg: l.ganancia_diaria_kg,
        } as any, fecha)
      : l.peso_base_kg
    const kgNetos = l.cabezas * bruto * (1 - (l.pct_desbaste || 0))
    const precio = l.precio_kg_override
    const monto = precio != null && kgNetos > 0 ? kgNetos * precio : null
    return {
      concepto: `${l.categoria} → ${l.destinoActividad}`,
      actividadOrigen: l.actividad!, actividadDestino: l.destinoActividad!,
      cabezas: l.cabezas, kgNetos, precioKg: precio, monto,
      campania: fecha ? campanaDeFecha(fecha) : l.campania,
      detalle: monto == null
        ? `${num(l.cabezas)} cab · ${num(kgNetos)} kg netos — falta el $/kg del traspaso`
        : `${num(l.cabezas)} cab × ${num(bruto * (1 - (l.pct_desbaste || 0)))} kg netos`
          + ` × ${pesos(precio!)}/kg · traspaso interno, sin comisión`,
    }
  })

  // Sólo las de ESTA campaña: una transferencia cae donde la pone su fecha.
  const transfer = [...(d.transferencias ?? []), ...transferDeLotes]
    .filter(t => t.campania === d.campana)

  const actividades = new Set<string>([
    ...Object.keys(d.hasPorActividad),
    ...d.lotes.map(l => l.actividad).filter(Boolean) as string[],
    ...d.costos.map(c => c.actividad),
    ...transfer.map(t => t.actividadOrigen),
    ...transfer.map(t => t.actividadDestino),
  ])

  return Array.from(actividades).sort().map(act => {
    const has = d.hasPorActividad[act] ?? null
    // Los internos ya salieron como transferencia: acá quedan sólo las ventas de mercado.
    const misLotes = d.lotes.filter(l =>
      l.actividad === act && !l.destinoActividad
      && (l.campania == null || l.campania === d.campana))
    const misCostos = d.costos.filter(c => c.actividad === act)
    const faltantes: string[] = []

    const ingresos: LineaMargen[] = []
    const faltaPrecio: { banda: string; categoria: string; peso: number }[] = []
    let cabezasTotal = 0

    // ── Las ventas que YA OCURRIERON ────────────────────────────────────────────
    //
    // Van primero y mandan: son el hecho, no el plan. Después el lote proyecta SÓLO las cabezas
    // que quedaron sin vender — si no, se contaría dos veces el mismo animal.
    //
    // Una venta real cae en la campaña de SU fecha, que puede no ser la del lote: un lote de la
    // campaña que viene puede haberse vendido antes de lo previsto.
    const ventasDelLote = (id?: string) =>
      id ? (d.ventasReales ?? []).filter(v => v.loteId === id) : []

    for (const l of misLotes) {
      for (const v of ventasDelLote(l.id)) {
        if (campanaDeFecha(v.fecha) !== d.campana) continue
        // `montoNeto` ya viene neto de comisión; si falta, se rehace la cuenta.
        const bruta = v.kgTotales * v.precioKg
        const neto = v.montoNeto != null ? v.montoNeto : bruta * (1 - (v.pctCz || 0))
        cabezasTotal += v.cabezas
        ingresos.push({
          concepto: `Venta ${l.categoria} — REAL`,
          unidades: v.cabezas, etiquetaUnidad: 'cab',
          total: neto,
          porHa: has ? neto / has : null,
          porCabeza: v.cabezas > 0 ? neto / v.cabezas : null,
          detalle: `${v.fecha.split('-').reverse().join('/')} · ${num(v.cabezas)} cab`
            + ` × ${num(v.kgTotales / (v.cabezas || 1))} kg × ${pesos(v.precioKg)}/kg`
            + ` − ${pesos(bruta - neto)} de comisión · venta registrada`,
          confiable: true,
        })
      }
    }

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
      // Sólo las cabezas que quedaron SIN vender. Es la misma cuenta que ya hace
      // `cantidadDisponible()` en el presupuesto — proyectar el lote entero teniendo la venta
      // cargada contaría dos veces el mismo animal.
      const vendidas = ventasDelLote(l.id).reduce((s, v) => s + v.cabezas, 0)
      const porVender = Math.max(0, l.cabezas - vendidas)
      if (vendidas > 0 && porVender === 0) continue

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
      cabezasTotal += porVender
      // Cuando parte del lote ya se vendió, se dice: si no, dos filas con la misma categoría
      // y distinta cantidad parecen un error de carga.
      const sufijo = vendidas > 0 ? ` (quedan ${num(porVender)} de ${num(l.cabezas)})` : ''

      if (precio == null) {
        faltantes.push(`falta el precio de ${banda}`)
        faltaPrecio.push({ banda, categoria: l.categoria, peso: bruto })
        ingresos.push({
          concepto: `Venta ${l.categoria}`, unidades: porVender, etiquetaUnidad: 'cab',
          total: 0, porHa: null, porCabeza: null,
          detalle: `${num(porVender)} cab × ${num(peso)} kg — sin precio${sufijo}`,
          confiable: false,
        })
        continue
      }

      const ventaBruta = porVender * peso * precio
      const gastoVenta = ventaBruta * d.pctGastoVenta(l.categoria)
      const neto = ventaBruta - gastoVenta

      ingresos.push({
        concepto: `Venta ${l.categoria}`,
        unidades: porVender, etiquetaUnidad: 'cab',
        total: neto,
        porHa: has ? neto / has : null,
        porCabeza: porVender > 0 ? neto / porVender : null,
        detalle: `${num(porVender)} cab × ${num(peso)} kg × ${pesos(precio)}/kg`
          + ` − ${pesos(gastoVenta)} de gastos de venta · ${segunPrecio} · proyectado${sufijo}`,
        confiable: true,
      })
    }

    // ── Las transferencias internas: la misma operación, los dos lados ──────────
    //
    // Se agregan DESPUÉS de las ventas y ANTES de los costos, así que el orden de las filas
    // cuenta la historia: primero lo que se vendió afuera, después lo que se le pasó al vecino.
    const cmp = claveActividad(act)
    for (const t of transfer.filter(x => claveActividad(x.actividadOrigen) === cmp)) {
      if (t.monto == null) faltantes.push(`${t.concepto}: falta el precio de la transferencia`)
      ingresos.push({
        concepto: t.concepto,
        unidades: t.cabezas, etiquetaUnidad: 'cab',
        total: t.monto ?? 0,
        porHa: has && t.monto != null ? t.monto / has : null,
        porCabeza: t.monto != null && t.cabezas > 0 ? t.monto / t.cabezas : null,
        detalle: t.detalle,
        confiable: t.monto != null,
      })
    }

    const transferCosto: LineaMargen[] = transfer
      .filter(x => claveActividad(x.actividadDestino) === cmp)
      .map(t => {
        if (t.monto == null) faltantes.push(`${t.concepto}: falta el precio de la transferencia`)
        return {
          concepto: t.concepto,
          unidades: t.cabezas, etiquetaUnidad: 'cab',
          total: t.monto ?? 0,
          porHa: has && t.monto != null ? t.monto / has : null,
          porCabeza: t.monto != null && t.cabezas > 0 ? t.monto / t.cabezas : null,
          detalle: t.detalle,
          confiable: t.monto != null,
        }
      })

    const costos: LineaMargen[] = misCostos.map(c => {
      const comun = {
        insumoId: c.insumoId, pasos: c.pasos, fundamento: c.fundamento,
        celdas: c.celdas, historicoModo: c.historicoModo,
      }
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

    // El costo de entrada va PRIMERO: es lo que el animal ya valía antes de que esta actividad
    // le hiciera nada, y sin él la ganancia sale de más.
    costos.unshift(...transferCosto)

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
