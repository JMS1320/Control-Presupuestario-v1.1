// Cómo se presupuesta una cuenta contable.
//
// ── Por qué varios modos y no una fórmula ────────────────────────────────────
// Mirando los datos reales de MSA (13 meses: jul-2025 → jul-2026) las cuentas no se parecen
// entre sí, y forzarlas a un solo criterio da mal en la mitad de los casos:
//
//   ASESOR GANADERO      1 proveedor, 1 factura/mes, escalones crecientes
//                        1.427k → 1.563k×3 → 1.633k×3 → 1.748k → 1.896k×2 → 2.067k×2
//                        → propagar la ÚLTIMA es casi exacto; un promedio quedaría viejo.
//
//   INSUMOS VETERINARIOS 176k · 3.018k · 1.451k · −28k · 109k · 3.110k · — · 1.127k · 3.303k
//                        → propagar la última es una lotería; acá manda el PROMEDIO.
//
//   IATF                 sólo 3 meses en 13, y uno es una nota de crédito
//                        → no hay serie: o va a mano o va por cabezas.
//
//   AGROQUIMICOS         ya se presupuesta en Actividades y costos
//                        → si además entra por acá, se cuenta DOS VECES.
//
// De ahí los modos. La cuenta elige el suyo y se puede cambiar cuando se quiera.
//
// ── Dos trampas de los datos que el motor tiene que respetar ─────────────────
//
// 1. **El mes en curso está incompleto.** Al 30/7/2026 julio tenía 29 facturas contra ~45 de
//    promedio. Tomarlo como "último mes" o meterlo en un promedio subestima todo. Se excluye
//    del cálculo y se avisa.
//
// 2. **Un mes sin factura no es un mes sin gasto.** LUZ no tiene factura en feb-2026 y en
//    marzo aparece el doble: la factura se corrió. Por eso el promedio divide por los meses
//    de la VENTANA, no por los meses que tienen factura — si no, se sobrestima.

import { resolverSerie, type PuntoSerie } from '../precios/serie'

export type ModoPresupuesto =
  /** Propaga la última factura conocida. Para 1 proveedor, 1 factura por mes, monto estable. */
  | 'ultima_fc'
  /** Promedio de los últimos N meses. Para cuentas variadas y recurrentes. */
  | 'promedio_n'
  /** Mismo mes del año anterior + inflación. Para lo estacional. Necesita 12+ meses. */
  | 'estacional'
  /** $/cabeza histórico × cabezas proyectadas. Para sanidad y veterinaria. */
  | 'por_cabeza'
  /** Un monto fijo puesto a mano. */
  | 'manual'
  /** No se presupuesta acá a propósito (ya entra por otro lado). */
  | 'excluida'

export const ETIQUETA_MODO: Record<ModoPresupuesto, string> = {
  ultima_fc: 'Propagar última factura',
  promedio_n: 'Promedio últimos N meses',
  estacional: 'Mismo mes del año anterior',
  por_cabeza: 'Por cabeza',
  manual: 'Monto fijo a mano',
  excluida: 'No presupuestar',
}

export interface ConfigCuenta {
  nro_cuenta: string
  modo: ModoPresupuesto
  /** Ventana del promedio. Default 3. */
  meses_promedio?: number | null
  monto_manual?: number | null
  /** Cuántas cabezas había durante el histórico y cuántas se proyectan. */
  cabezas_referencia?: number | null
  cabezas_proyectadas?: number | null
  /** Fracción mensual. Si es null usa la global. */
  inflacion_mensual?: number | null
  /**
   * CUITs cuyo gasto NO se presupuesta en esta cuenta porque ya entra por otro lado
   * (un template, típicamente). El resto de la cuenta se presupuesta normal — excluir la
   * cuenta entera dejaría en cero a un proveedor nuevo sin que nadie se entere.
   */
  cuits_excluidos?: string[] | null
  motivo_exclusion?: string | null
  notas?: string | null
}

/** Un mes de historia de una cuenta, ya unificado entre ARCA e histórico. */
export interface PuntoHistorico {
  nro_cuenta: string
  anio: number
  mes: number
  monto: number
  facturas: number
  proveedores: number
}

export interface CeldaPresupuesto {
  mes: string
  monto: number
  /** De dónde salió el número, en castellano. Va al tooltip. */
  explicacion: string
  confianza: 'alta' | 'media' | 'baja'
}

const clave = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}`
const km = (a: number, m: number) => a * 12 + (m - 1)

/**
 * Cuánto multiplica la inflación entre dos meses.
 *
 * Con serie de IPC compone mes a mes (cada uno con su propia tasa, arrastrada); sin serie
 * aplica la tasa fija elevada a los meses. Una cuenta puede pisar las dos con la suya.
 */
function factorInflacion(ctx: ContextoCalculo, desdeKm: number, hastaKm: number, fija: number | null): number {
  if (hastaKm <= desdeKm) return 1
  if (fija != null) return Math.pow(1 + fija, hastaKm - desdeKm)
  if (ctx.ipc && ctx.ipc.length > 0) {
    let f = 1
    for (let k = desdeKm + 1; k <= hastaKm; k++) {
      const v = resolverSerie(ctx.ipc, Math.floor(k / 12), (k % 12) + 1)
      if (v.origen !== 'sin_dato') f *= 1 + v.valor / 100
    }
    return f
  }
  return Math.pow(1 + ctx.inflacionMensual, hastaKm - desdeKm)
}

/** Texto corto que explica qué inflación se aplicó. */
function textoInflacion(ctx: ContextoCalculo, fija: number | null, n: number): string {
  if (n <= 0) return ''
  if (fija != null) return ` + ${(fija * 100).toFixed(1)} % mensual × ${n}`
  if (ctx.ipc && ctx.ipc.length > 0) return ` + IPC de ${n} ${n === 1 ? 'mes' : 'meses'}`
  if (ctx.inflacionMensual > 0) return ` + ${(ctx.inflacionMensual * 100).toFixed(1)} % mensual × ${n}`
  return ''
}
const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
const MESES_TXT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const etiquetaMes = (a: number, m: number) => `${MESES_TXT[m - 1]}-${String(a).slice(-2)}`

/**
 * Historia utilizable: ordenada y **sin el mes en curso**, que está a medio facturar.
 * `hasta` es el mes actual, exclusivo.
 */
export function historiaUtil(puntos: PuntoHistorico[], hoy = new Date()): PuntoHistorico[] {
  const tope = km(hoy.getFullYear(), hoy.getMonth() + 1)
  return puntos
    .filter(p => km(p.anio, p.mes) < tope)
    .sort((a, b) => km(a.anio, a.mes) - km(b.anio, b.mes))
}

/**
 * Último mes cerrado (el anterior al actual), en clave numérica.
 *
 * Las ventanas se cierran acá y NO en el último mes con factura. La diferencia importa: si
 * una cuenta dejó de facturar en mayo y estamos en julio, junio fue un mes de cero gasto y
 * tiene que pesar en el promedio. Cerrando la ventana en mayo, ese cero desaparece y el
 * promedio queda inflado.
 */
export function ultimoMesCerrado(hoy = new Date()): number {
  return km(hoy.getFullYear(), hoy.getMonth() + 1) - 1
}

// ── Sugerencia automática ─────────────────────────────────────────────────────

/**
 * Cuentas que NO se presupuestan acá porque ya entran por Actividades y costos, y sumarlas
 * dos veces infla el presupuesto.
 *
 *   421*     agricultura entera (insumos, labores, cosecha, seguro de cultivo)
 *   42305*   alimentación: maíz, rollos, sales → son la ración de las actividades
 *   42312 · 42315 · 42322 · 42323 · 42324   el verdeo (fertilizante, siembra forrajera,
 *           agroquímicos, pulverizaciones y labranzas de ganadería) → van por hectárea
 *
 * Veterinaria NO está en esta lista a propósito: no hay módulo de insumos para cría, así que
 * el único lugar donde se presupuesta es acá.
 */
export function esProduccion(nro: string): string | null {
  if (/^421/.test(nro)) return 'Agricultura: ya se presupuesta en Actividades y costos'
  if (/^42305/.test(nro)) return 'Alimentación: ya entra como ración en Actividades y costos'
  if (['42312', '42315', '42322', '42323', '42324'].includes(nro)) {
    return 'Verdeo: ya entra por hectárea en Actividades y costos'
  }
  return null
}

/** Cuentas cuyo gasto sigue al tamaño del rodeo. */
export function esPorCabeza(nro: string): boolean {
  return ['42307', '42301', '42316', '42320', '4230505'].includes(nro)
}

export interface Sugerencia {
  modo: ModoPresupuesto
  motivo: string
}

/**
 * Qué modo le conviene a una cuenta, mirando cómo se comportó.
 *
 * Es una sugerencia, no una imposición: el usuario la cambia y su elección manda. La idea es
 * que arranque razonable sin tener que configurar 70 cuentas a mano.
 */
export function sugerirModo(nro: string, historia: PuntoHistorico[]): Sugerencia {
  const excl = esProduccion(nro)
  if (excl) return { modo: 'excluida', motivo: excl }

  const h = historia.filter(p => p.nro_cuenta === nro)
  if (h.length === 0) return { modo: 'manual', motivo: 'Sin historia: no hay de dónde calcular' }

  if (esPorCabeza(nro)) {
    return { modo: 'por_cabeza', motivo: 'El gasto sigue al tamaño del rodeo' }
  }

  const montos = h.map(p => p.monto)
  const prom = montos.reduce((a, b) => a + b, 0) / montos.length
  const desvio = Math.sqrt(montos.reduce((a, b) => a + (b - prom) ** 2, 0) / Math.max(1, montos.length - 1))
  const cv = prom !== 0 ? Math.abs(desvio / prom) : 0
  const provs = Math.max(...h.map(p => p.proveedores))
  const fcProm = h.reduce((a, p) => a + p.facturas, 0) / h.length

  if (h.length < 3) {
    return { modo: 'manual', motivo: `Sólo ${h.length} ${h.length === 1 ? 'mes' : 'meses'} de historia` }
  }
  // Un proveedor, una factura por mes y monto parejo: la última es el mejor pronóstico,
  // porque los aumentos son escalones y el promedio queda siempre atrasado.
  if (provs === 1 && fcProm <= 2.5 && cv <= 0.4 && h.length >= 6) {
    return { modo: 'ultima_fc', motivo: `1 proveedor, monto parejo (variación ${Math.round(cv * 100)} %)` }
  }
  return {
    modo: 'promedio_n',
    motivo: `${provs} proveedores y variación ${Math.round(cv * 100)} %: conviene promediar`,
  }
}

/** Un mes de una cuenta abierto por proveedor. */
export interface PuntoProveedor {
  nro_cuenta: string
  cuit: string
  anio: number
  mes: number
  monto: number
}

/**
 * Descuenta de la historia el gasto de los proveedores excluidos.
 *
 * Sacar un proveedor NO es lo mismo que anular la cuenta. Federación Patronal se presupuesta
 * por template (factura semestral, se paga en cuotas), pero SEGUROS ESTRUCTURA tiene que
 * seguir viva: si mañana entra otra aseguradora, se presupuesta sola en vez de desaparecer
 * sin que nadie se entere. Ésa es toda la diferencia entre excluir el CUIT y excluir la cuenta.
 */
export function netearExcluidos(
  historia: PuntoHistorico[],
  porProveedor: PuntoProveedor[],
  excluidosPorCuenta: Record<string, string[]>,
): PuntoHistorico[] {
  const sets: Record<string, Set<string>> = {}
  for (const [nro, cuits] of Object.entries(excluidosPorCuenta)) {
    if (cuits.length > 0) sets[nro] = new Set(cuits)
  }
  if (Object.keys(sets).length === 0) return historia

  const restar: Record<string, number> = {}
  for (const f of porProveedor) {
    if (!sets[f.nro_cuenta]?.has(f.cuit)) continue
    const k = `${f.nro_cuenta}|${f.anio}-${f.mes}`
    restar[k] = (restar[k] || 0) + f.monto
  }
  return historia.map(p => {
    const r = restar[`${p.nro_cuenta}|${p.anio}-${p.mes}`]
    return r ? { ...p, monto: p.monto - r } : p
  })
}

// ── Cálculo ───────────────────────────────────────────────────────────────────

export interface ContextoCalculo {
  /** Meses a presupuestar, en orden. */
  meses: { anio: number; mes: number }[]
  /** Fracción mensual por defecto (0.02 = 2 %). Se usa si no hay serie de IPC. */
  inflacionMensual: number
  /**
   * Serie de IPC mensual (variación en %). Si está, MANDA sobre la tasa fija y se arrastra
   * hacia adelante: el usuario carga escalones — seis meses a un ritmo, seis a otro — y no
   * tiene que repetir el mismo número doce veces.
   */
  ipc?: PuntoSerie[]
  /** Cabezas proyectadas por mes, si se tienen. Si no, se usa `cabezas_proyectadas`. */
  cabezasPorMes?: Record<string, number>
  hoy?: Date
}

/**
 * Calcula los montos de una cuenta según su modo. Cada celda viene con su explicación:
 * el usuario tiene que poder pararse en un número y entender de dónde salió.
 */
export function calcularCuenta(
  cfg: ConfigCuenta,
  historia: PuntoHistorico[],
  ctx: ContextoCalculo,
): CeldaPresupuesto[] {
  const h = historiaUtil(historia.filter(p => p.nro_cuenta === cfg.nro_cuenta), ctx.hoy)
  // Una cuenta puede tener su propia tasa; si no, manda el IPC y en última instancia la global.
  const fija = cfg.inflacion_mensual ?? null
  const vacio = (motivo: string): CeldaPresupuesto[] =>
    ctx.meses.map(m => ({ mes: clave(m.anio, m.mes), monto: 0, explicacion: motivo, confianza: 'baja' as const }))

  switch (cfg.modo) {
    case 'excluida':
      return vacio(cfg.motivo_exclusion || 'No se presupuesta en cuentas contables')

    case 'manual': {
      const monto = Number(cfg.monto_manual) || 0
      return ctx.meses.map(m => ({
        mes: clave(m.anio, m.mes), monto,
        explicacion: `Monto fijo cargado a mano: ${pesos(monto)}`,
        confianza: 'media' as const,
      }))
    }

    case 'ultima_fc': {
      // El último mes CON factura, no el último mes del calendario: si la cuenta no facturó
      // en junio, la referencia sigue siendo mayo.
      const ultimo = [...h].reverse().find(p => p.monto !== 0)
      if (!ultimo) return vacio('No hay ninguna factura para propagar')
      const base = ultimo.monto
      const desde = km(ultimo.anio, ultimo.mes)
      return ctx.meses.map(m => {
        const n = Math.max(0, km(m.anio, m.mes) - desde)
        const monto = base * factorInflacion(ctx, desde, km(m.anio, m.mes), fija)
        return {
          mes: clave(m.anio, m.mes), monto,
          explicacion: `Última factura (${etiquetaMes(ultimo.anio, ultimo.mes)}): ${pesos(base)}`
            + textoInflacion(ctx, fija, n),
          confianza: n <= 6 ? 'alta' as const : 'media' as const,
        }
      })
    }

    case 'promedio_n': {
      const n = Math.max(1, Number(cfg.meses_promedio) || 3)
      if (h.length === 0) return vacio('Sin historia para promediar')
      // La ventana son los últimos n meses de CALENDARIO cerrados, no los últimos n con
      // factura. Un mes sin factura cuenta como cero: si no, se sobrestima (caso LUZ, que
      // no facturó en febrero y facturó doble en marzo).
      const ultimoKm = ultimoMesCerrado(ctx.hoy)
      const enVentana = h.filter(p => km(p.anio, p.mes) > ultimoKm - n && km(p.anio, p.mes) <= ultimoKm)
      const suma = enVentana.reduce((a, p) => a + p.monto, 0)
      const base = suma / n
      const conFactura = enVentana.filter(p => p.monto !== 0).length
      return ctx.meses.map(m => {
        const k = Math.max(0, km(m.anio, m.mes) - ultimoKm)
        const monto = base * factorInflacion(ctx, ultimoKm, km(m.anio, m.mes), fija)
        return {
          mes: clave(m.anio, m.mes), monto,
          explicacion: `Promedio de ${n} meses (${pesos(suma)} ÷ ${n} = ${pesos(base)})`
            + (conFactura < n ? ` · ${n - conFactura} sin factura, cuentan como cero` : '')
            + textoInflacion(ctx, fija, k),
          confianza: conFactura >= Math.ceil(n / 2) ? 'alta' as const : 'media' as const,
        }
      })
    }

    case 'estacional': {
      if (h.length < 12) {
        return vacio(`Necesita 12 meses de historia y hay ${h.length}`)
      }
      const porClave = new Map(h.map(p => [clave(p.anio, p.mes), p.monto]))
      return ctx.meses.map(m => {
        const kAnterior = clave(m.anio - 1, m.mes)
        const base = porClave.get(kAnterior)
        if (base == null) {
          return {
            mes: clave(m.anio, m.mes), monto: 0,
            explicacion: `Sin dato de ${etiquetaMes(m.anio - 1, m.mes)}`,
            confianza: 'baja' as const,
          }
        }
        const monto = base * factorInflacion(ctx, km(m.anio - 1, m.mes), km(m.anio, m.mes), fija)
        return {
          mes: clave(m.anio, m.mes), monto,
          explicacion: `${etiquetaMes(m.anio - 1, m.mes)}: ${pesos(base)}` + textoInflacion(ctx, fija, 12),
          confianza: 'media' as const,
        }
      })
    }

    case 'por_cabeza': {
      const ref = Number(cfg.cabezas_referencia) || 0
      if (h.length === 0 || ref <= 0) {
        return vacio('Falta la cantidad de cabezas de referencia')
      }
      // $/cabeza/mes del histórico: total ÷ meses del período ÷ cabezas de entonces.
      // El período va del primer dato al último mes CERRADO, así los meses sin factura del
      // final también cuentan.
      const finPeriodo = ultimoMesCerrado(ctx.hoy)
      const meses = Math.max(1, finPeriodo - km(h[0]!.anio, h[0]!.mes) + 1)
      const total = h.reduce((a, p) => a + p.monto, 0)
      const porCabezaMes = total / meses / ref
      return ctx.meses.map(m => {
        const k = clave(m.anio, m.mes)
        const cab = ctx.cabezasPorMes?.[k] ?? (Number(cfg.cabezas_proyectadas) || ref)
        const inflado = porCabezaMes * factorInflacion(ctx, finPeriodo, km(m.anio, m.mes), fija)
        return {
          mes: k, monto: inflado * cab,
          explicacion: `${pesos(porCabezaMes)}/cabeza/mes (${pesos(total)} ÷ ${meses} meses ÷ ${ref} cab) × ${Math.round(cab)} cabezas`,
          confianza: meses >= 6 ? 'media' as const : 'baja' as const,
        }
      })
    }
  }
}

// ── Control: que no se escape nada grande ─────────────────────────────────────

export interface Alerta {
  nivel: 'alta' | 'media'
  titulo: string
  detalle: string
  nro_cuenta?: string
}

export interface ResumenControl {
  /** Promedio mensual real de los últimos meses completos. */
  realPromedioMes: number
  mesesReales: number
  /** Promedio mensual presupuestado. */
  presupuestadoPromedioMes: number
  /** Variación del presupuesto contra la realidad reciente. */
  variacion: number
  alertas: Alerta[]
}

/**
 * Chequeo de cordura del presupuesto.
 *
 * No busca precisión: busca que **no se escape nada grande**. Los tres errores que de verdad
 * duelen son (a) el total se despegó de la realidad, (b) una cuenta que siempre gastó quedó
 * en cero, y (c) una cuenta se disparó respecto de su propia historia.
 */
export function controlarPresupuesto(
  historia: PuntoHistorico[],
  presupuesto: Record<string, CeldaPresupuesto[]>,
  cfgs: Record<string, ConfigCuenta>,
  nombres: Record<string, string>,
  opts: { mesesComparacion?: number; umbral?: number; hoy?: Date } = {},
): ResumenControl {
  const ventana = opts.mesesComparacion ?? 6
  const umbral = opts.umbral ?? 0.35
  const h = historiaUtil(historia, opts.hoy)
  const alertas: Alerta[] = []

  if (h.length === 0) {
    return { realPromedioMes: 0, mesesReales: 0, presupuestadoPromedioMes: 0, variacion: 0, alertas: [] }
  }

  const ultimoKm = km(h[h.length - 1]!.anio, h[h.length - 1]!.mes)
  const primerKm = Math.max(km(h[0]!.anio, h[0]!.mes), ultimoKm - ventana + 1)
  const mesesReales = ultimoKm - primerKm + 1

  const realPorCuenta: Record<string, number> = {}
  let realTotal = 0
  for (const p of h) {
    if (km(p.anio, p.mes) < primerKm) continue
    realPorCuenta[p.nro_cuenta] = (realPorCuenta[p.nro_cuenta] || 0) + p.monto
    realTotal += p.monto
  }

  // El presupuesto se compara sobre la misma cantidad de meses, si no no son comparables
  const presuPorCuenta: Record<string, number> = {}
  let presuTotal = 0
  for (const [nro, celdas] of Object.entries(presupuesto)) {
    const tramo = celdas.slice(0, mesesReales)
    const suma = tramo.reduce((a, c) => a + c.monto, 0)
    presuPorCuenta[nro] = suma
    presuTotal += suma
  }

  const realProm = realTotal / mesesReales
  const presuProm = presuTotal / mesesReales
  const variacion = realProm !== 0 ? (presuProm - realProm) / Math.abs(realProm) : 0

  if (Math.abs(variacion) > umbral) {
    alertas.push({
      nivel: 'alta',
      titulo: `El presupuesto total está ${variacion > 0 ? 'muy por encima' : 'muy por debajo'} de la realidad`,
      detalle: `Presupuestás ${pesos(presuProm)}/mes contra ${pesos(realProm)}/mes reales de los últimos `
        + `${mesesReales} meses (${variacion > 0 ? '+' : ''}${Math.round(variacion * 100)} %).`,
    })
  }

  // Cuentas que gastaron y quedaron sin presupuestar: el olvido que más duele
  for (const [nro, real] of Object.entries(realPorCuenta)) {
    if (real <= 0) continue
    const presu = presuPorCuenta[nro] ?? 0
    const nombre = nombres[nro] || nro
    const modo = cfgs[nro]?.modo
    if (presu === 0 && modo !== 'excluida') {
      alertas.push({
        nivel: real > realTotal * 0.03 ? 'alta' : 'media',
        titulo: `${nombre} gastó y no está presupuestada`,
        detalle: `${pesos(real)} en los últimos ${mesesReales} meses y $0 presupuestado.`,
        nro_cuenta: nro,
      })
      continue
    }
    const dif = real !== 0 ? (presu - real) / Math.abs(real) : 0
    // Sólo se avisa si además el monto pesa: una cuenta chica que se duplica no importa.
    if (Math.abs(dif) > 0.6 && Math.abs(presu - real) > realTotal * 0.03) {
      alertas.push({
        nivel: 'media',
        titulo: `${nombre} se despegó de su historia`,
        detalle: `${pesos(presu)} presupuestado contra ${pesos(real)} real `
          + `(${dif > 0 ? '+' : ''}${Math.round(dif * 100)} %).`,
        nro_cuenta: nro,
      })
    }
  }

  const orden = { alta: 0, media: 1 }
  alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel])

  return { realPromedioMes: realProm, mesesReales, presupuestadoPromedioMes: presuProm, variacion, alertas }
}

/** Serie de inflación mensual desde el IPC cargado, si se quiere usar en vez de un fijo. */
export function inflacionDeSerie(ipc: PuntoSerie[], anio: number, mes: number): number {
  const v = resolverSerie(ipc, anio, mes)
  return v.valor > 0 ? v.valor / 100 : 0
}
