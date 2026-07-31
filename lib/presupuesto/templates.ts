// Cómo el presupuesto completa los meses donde un template NO tiene cuota cargada.
//
// ── El problema ──────────────────────────────────────────────────────────────
// Las cuotas de `cuotas_egresos_sin_factura` son un dato firme, pero se cargan hasta donde
// llega la campaña y después se cortan (hoy en dic-2026, y de forma despareja). Un presupuesto
// a 24 meses mostraba el segundo año casi vacío, que no es lo mismo que no tener gasto.
//
// La regla acordada: **la estimación no va en el template** —que guarda compromisos reales—
// **sino en el Presupuesto**. Acá se proyecta sin escribir nada del otro lado.
//
// ── La jerarquía, de más firme a más blando ─────────────────────────────────
//
//   1. CUOTA CARGADA          → manda siempre. Dato firme.
//   2. MÉTODO ELEGIDO A MANO  → `presupuesto_template_config`. La decisión del usuario gana.
//   3. `cuotas` DECLARADO     → cuántos pagos al año lo dice el template; en qué meses, la
//                               historia. Está bien cargado en 64 de 66.
//   4. PATRÓN POR DENSIDAD    → sólo si no hay nada declarado. Último recurso.
//
// ── Por qué la densidad NO puede ir primero ─────────────────────────────────
// La primera versión de esto infería la periodicidad de la historia: si los meses con cuota
// eran ≥ 80 % del tramo, "mensual". Con **un solo mes** cargado eso da 1,00 → mensual.
//
//   Imp. Ganancias MSA          1 cuota/año declarada · $5.000.123 → proyectado 12 veces
//   Acciones y Participaciones  1 cuota/año declarada · $2.500.123 → proyectado 12 veces
//
// ~$87 M anuales de egreso fantasma en cuatro filas, sobre un gasto real de ~$23 M/mes.
// El dato declarado tiene que ganarle siempre a lo inferido: inferir es para cuando no hay dato.

import { resolverSerie, type PuntoSerie } from '../precios/serie'

export type MetodoTemplate =
  /** N pagos al año según `cuotas`, en los meses que muestra la historia. */
  | 'declaradas'
  /** Todos los meses. */
  | 'mensual'
  /** Sólo los meses en que pagó históricamente (se infiere de la historia). */
  | 'patron'
  /** Sin periodicidad fija: se reparte el promedio mensual en todos los meses. */
  | 'promedio'
  /** Un monto fijo por mes, puesto a mano. */
  | 'manual'
  /** No completar nada. */
  | 'no_proyectar'

export const ETIQUETA_METODO: Record<MetodoTemplate, string> = {
  declaradas: 'Las cuotas que declara el template',
  mensual: 'Todos los meses',
  patron: 'Los meses en que pagó (inferido)',
  promedio: 'Promedio mensual (sin periodicidad fija)',
  manual: 'Monto fijo a mano',
  no_proyectar: 'No proyectar',
}

export interface TemplateInfo {
  id: string
  nombre: string
  /** Cuotas al año declaradas en el template. 0 = sin número fijo. */
  cuotas: number | null
  tipo_recurrencia: string | null
  periodicidad: string | null
  aplica_generacion: boolean | null
}

export interface ConfigTemplate {
  metodo: MetodoTemplate
  monto_manual?: number | null
}

/** Una cuota ya agrupada por mes. */
export interface CuotaMes {
  egreso_id: string
  /** `YYYY-MM` */
  mes: string
  monto: number
}

export type OrigenCelda = 'cuota' | 'proyectado' | 'vacio'

export interface CeldaTemplate {
  mes: string
  monto: number
  origen: OrigenCelda
  explicacion: string
  /** Proyectado en un template que el usuario carga a mano → falta generar la campaña. */
  faltaGenerar: boolean
}

const km = (a: number, m: number) => a * 12 + (m - 1)
const partes = (clave: string) => {
  const [a, m] = clave.split('-').map(Number)
  return { anio: a!, mes: m! }
}
const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
const MESES_TXT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const nombresMeses = (s: Iterable<number>) =>
  [...s].sort((a, b) => a - b).map(x => MESES_TXT[x - 1]).join(', ')

/** Cuánto multiplica el IPC entre dos meses, arrastrando el último valor cargado. */
function factorIpc(ipc: PuntoSerie[] | undefined, desdeKm: number, hastaKm: number): number {
  if (hastaKm <= desdeKm || !ipc || ipc.length === 0) return 1
  let f = 1
  for (let k = desdeKm + 1; k <= hastaKm; k++) {
    const v = resolverSerie(ipc, Math.floor(k / 12), (k % 12) + 1)
    if (v.origen !== 'sin_dato') f *= 1 + v.valor / 100
  }
  return f
}

// ── Nivel 3 de la jerarquía: heredar de `cuotas` ─────────────────────────────

export interface MetodoResuelto {
  metodo: MetodoTemplate
  /** true si lo eligió el usuario; false si se heredó. */
  manual: boolean
  motivo: string
}

/**
 * Qué método le corresponde a un template si el usuario no eligió ninguno.
 *
 * Sale de `cuotas`, que es el número de pagos al año y está declarado en el template:
 *   12        → mensual
 *   1 … 11    → esas cuotas, en los meses que muestre la historia
 *   0 / null  → no tiene número fijo (comisiones bancarias, gastos abiertos) → promedio
 */
export function metodoHeredado(info: TemplateInfo, tieneHistoria: boolean): MetodoResuelto {
  if (!tieneHistoria) {
    return { metodo: 'no_proyectar', manual: false, motivo: 'Sin cuotas cargadas: no hay de dónde proyectar' }
  }
  if (info.tipo_recurrencia === 'abierto') {
    return { metodo: 'promedio', manual: false, motivo: 'Gasto abierto: no tiene periodicidad fija' }
  }
  const n = info.cuotas
  if (n == null || n === 0) {
    return { metodo: 'promedio', manual: false, motivo: 'El template no declara cuotas fijas' }
  }
  if (n >= 12) {
    return { metodo: 'mensual', manual: false, motivo: `El template declara ${n} cuotas al año` }
  }
  return {
    metodo: 'declaradas', manual: false,
    motivo: `El template declara ${n} ${n === 1 ? 'cuota' : 'cuotas'} al año`,
  }
}

export function resolverMetodo(
  info: TemplateInfo,
  cfg: ConfigTemplate | undefined,
  tieneHistoria: boolean,
): MetodoResuelto {
  const heredado = metodoHeredado(info, tieneHistoria)
  if (!cfg) return heredado
  return { metodo: cfg.metodo, manual: true, motivo: `Elegido a mano · sin eso sería: ${ETIQUETA_METODO[heredado.metodo].toLowerCase()}` }
}

// ── Proyección ────────────────────────────────────────────────────────────────

export interface OpcionesProyeccion {
  /** Serie de IPC (variación mensual en %). */
  ipc?: PuntoSerie[]
  /** Si no hay IPC, tasa mensual fija como fracción. */
  inflacionMensual?: number
  /** Método elegido a mano, si lo hay. */
  config?: ConfigTemplate
}

export interface ResultadoTemplate {
  celdas: CeldaTemplate[]
  metodo: MetodoResuelto
  /** El template declara más cuotas de las que muestra la historia: falta cargar campaña. */
  avisoCuotas: string | null
}

/**
 * Completa los meses sin cuota de un template.
 *
 * `historia` son TODAS las cuotas conocidas (pasadas y futuras); `meses` son los del
 * presupuesto. Donde hay cuota, manda la cuota.
 */
export function proyectarTemplate(
  info: TemplateInfo,
  historia: CuotaMes[],
  meses: { anio: number; mes: number }[],
  opts: OpcionesProyeccion = {},
): ResultadoTemplate {
  const porMes = new Map<string, number>()
  for (const c of historia) porMes.set(c.mes, (porMes.get(c.mes) || 0) + c.monto)

  const conMonto = [...porMes.entries()]
    .filter(([, v]) => v !== 0)
    .map(([clave, monto]) => ({ ...partes(clave), clave, monto }))
    .sort((a, b) => km(a.anio, a.mes) - km(b.anio, b.mes))

  const metodo = resolverMetodo(info, opts.config, conMonto.length > 0)
  const ultima = conMonto[conMonto.length - 1]
  const factor = (desdeKm: number, hastaKm: number) =>
    opts.ipc && opts.ipc.length > 0
      ? factorIpc(opts.ipc, desdeKm, hastaKm)
      : Math.pow(1 + (opts.inflacionMensual ?? 0), Math.max(0, hastaKm - desdeKm))

  // ── En qué meses del año paga, según el método
  const mesesHistoria = new Set(conMonto.map(c => c.mes))
  let patron: Set<number>
  let avisoCuotas: string | null = null

  switch (metodo.metodo) {
    case 'mensual':
    case 'promedio':
      patron = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      break
    case 'declaradas': {
      const n = info.cuotas ?? mesesHistoria.size
      if (mesesHistoria.size > n) {
        // La historia muestra más meses que los declarados: se quedan los más recientes,
        // que son los que reflejan el régimen actual.
        const recientes = [...conMonto].reverse()
        const elegidos = new Set<number>()
        for (const c of recientes) { if (elegidos.size >= n) break; elegidos.add(c.mes) }
        patron = elegidos
        avisoCuotas = `Declara ${n} ${n === 1 ? 'cuota' : 'cuotas'} y la historia muestra `
          + `${mesesHistoria.size} meses: se toman los ${n} más recientes (${nombresMeses(elegidos)}).`
      } else {
        patron = mesesHistoria
        if (mesesHistoria.size < n) {
          avisoCuotas = `Declara ${n} cuotas y sólo hay ${mesesHistoria.size} `
            + `${mesesHistoria.size === 1 ? 'mes' : 'meses'} en la historia (${nombresMeses(mesesHistoria)}): `
            + `se proyectan esos. Si faltan cuotas por cargar, el presupuesto está corto.`
        }
      }
      break
    }
    case 'patron':
      patron = mesesHistoria
      break
    case 'manual':
      patron = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      break
    case 'no_proyectar':
    default:
      patron = new Set()
  }

  // El promedio reparte el gasto conocido entre los meses del tramo, incluidos los que no
  // tuvieron factura: un mes sin gasto es parte del promedio, no una excepción.
  const spanHistoria = conMonto.length > 0
    ? km(ultima!.anio, ultima!.mes) - km(conMonto[0]!.anio, conMonto[0]!.mes) + 1
    : 0
  const promedioMensual = spanHistoria > 0
    ? conMonto.reduce((s, c) => s + c.monto, 0) / spanHistoria
    : 0

  const celdas = meses.map(m => {
    const clave = `${m.anio}-${String(m.mes).padStart(2, '0')}`
    const cargada = porMes.get(clave)

    if (cargada != null) {
      return {
        mes: clave, monto: cargada, origen: 'cuota' as const,
        explicacion: `Cuota cargada: ${pesos(cargada)}`,
        faltaGenerar: false,
      }
    }

    if (metodo.metodo === 'manual') {
      const monto = Number(opts.config?.monto_manual) || 0
      return {
        mes: clave, monto, origen: 'proyectado' as const,
        explicacion: `Monto fijo a mano: ${pesos(monto)}`,
        faltaGenerar: info.aplica_generacion === true,
      }
    }

    if (metodo.metodo === 'no_proyectar' || !ultima || !patron.has(m.mes)) {
      return {
        mes: clave, monto: 0, origen: 'vacio' as const,
        explicacion: metodo.metodo === 'no_proyectar'
          ? metodo.motivo
          : `No paga en ${MESES_TXT[m.mes - 1]} (paga en ${nombresMeses(patron)})`,
        faltaGenerar: false,
      }
    }

    if (metodo.metodo === 'promedio') {
      const monto = promedioMensual * factor(km(ultima.anio, ultima.mes), km(m.anio, m.mes))
      return {
        mes: clave, monto, origen: 'proyectado' as const,
        explicacion: `Promedio mensual de la historia (${pesos(promedioMensual)}/mes sobre `
          + `${spanHistoria} ${spanHistoria === 1 ? 'mes' : 'meses'})`,
        faltaGenerar: info.aplica_generacion === true,
      }
    }

    // El mismo mes del año anterior es la mejor referencia para lo que no es mensual;
    // si no está, la última cuota conocida.
    const mismoMesAnioAnterior = conMonto
      .filter(c => c.mes === m.mes && km(c.anio, c.mes) < km(m.anio, m.mes))
      .pop()
    const base = mismoMesAnioAnterior ?? ultima
    const desdeKm = km(base.anio, base.mes)
    const hastaKm = km(m.anio, m.mes)
    const monto = base.monto * factor(desdeKm, hastaKm)
    const etiqueta = `${MESES_TXT[base.mes - 1]}-${String(base.anio).slice(-2)}`
    const n = hastaKm - desdeKm

    return {
      mes: clave, monto, origen: 'proyectado' as const,
      explicacion: (mismoMesAnioAnterior
        ? `Proyectado desde ${etiqueta} (mismo mes del año anterior): ${pesos(base.monto)}`
        : `Proyectado desde la última cuota (${etiqueta}): ${pesos(base.monto)}`)
        + (n > 0 && (opts.ipc?.length || opts.inflacionMensual)
          ? ` + inflación de ${n} ${n === 1 ? 'mes' : 'meses'}` : ''),
      faltaGenerar: info.aplica_generacion === true,
    }
  })

  return { celdas, metodo, avisoCuotas }
}

/** Resumen para avisar cuántos templates esperan que se genere la campaña. */
export interface AvisoGeneracion {
  templates: number
  meses: string[]
  monto: number
  nombres: string[]
}

export function avisoFaltaGenerar(
  porTemplate: Record<string, { info: TemplateInfo; celdas: CeldaTemplate[] }>,
): AvisoGeneracion {
  const meses = new Set<string>()
  const nombres: string[] = []
  let monto = 0
  for (const { info, celdas } of Object.values(porTemplate)) {
    const pendientes = celdas.filter(c => c.faltaGenerar && c.monto !== 0)
    if (pendientes.length === 0) continue
    nombres.push(info.nombre)
    for (const c of pendientes) { meses.add(c.mes); monto += c.monto }
  }
  return { templates: nombres.length, meses: [...meses].sort(), monto, nombres }
}
