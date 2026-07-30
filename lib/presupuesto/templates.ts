// Proyección de templates donde no hay cuota cargada.
//
// ── El problema ──────────────────────────────────────────────────────────────
// El presupuesto lee las cuotas de `cuotas_egresos_sin_factura`, que son un dato firme. Pero
// las cuotas se cargan hasta donde llega la campaña y después se cortan — hoy, en dic-2026, y
// de forma despareja (ago-26 tiene 16 cuotas contra 54 de sep-26). Un presupuesto a 24 meses
// muestra el segundo año casi vacío, y eso no es que no haya gasto: es que no está cargado.
//
// La regla acordada con el usuario hace tiempo es que **la estimación no va en el template**
// (que guarda compromisos reales) **sino en el Presupuesto**. Así que acá se proyecta sin
// escribir nada del otro lado.
//
// ── Lo que NO se puede hacer: propagar la última cuota todos los meses ───────
// Sería lo obvio y convertiría un impuesto anual en un gasto mensual. "Inmobiliario Cuota
// Rojas" paga en cinco meses del año; propagarlo daría doce pagos.
//
// Por eso la proyección respeta **el patrón de meses**: de la historia se saca en qué meses
// del año paga ese template, y sólo se proyecta en esos. Un template mensual tiene los doce
// meses en el patrón y se proyecta siempre; uno anual, sólo en el suyo.
//
// ── Y el aviso, que es la mitad del punto ───────────────────────────────────
// El usuario distingue dos clases de template, y el dato ya existe en
// `egresos_sin_factura.aplica_generacion`:
//
//   · `true`  → los que él quiere cargar a mano porque le recuerdan el compromiso de pago
//               (Cargas Sociales, SICORE, UATRE, Ganancias…). Acá se proyecta **y se avisa**
//               que falta generar la campaña: el aviso ES el recordatorio.
//   · resto   → se proyecta en silencio, no hace falta cargar nada.

import { resolverSerie, type PuntoSerie } from '../precios/serie'

export interface TemplateInfo {
  id: string
  nombre: string
  periodicidad: string | null
  aplica_generacion: boolean | null
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

export interface OpcionesProyeccion {
  /** Serie de IPC (variación mensual en %). */
  ipc?: PuntoSerie[]
  /** Si no hay IPC, tasa mensual fija como fracción. */
  inflacionMensual?: number
}

/**
 * Completa los meses sin cuota de un template.
 *
 * `historia` son TODAS las cuotas conocidas del template (pasadas y futuras); `meses` son los
 * del presupuesto. Donde hay cuota manda la cuota.
 */
export function proyectarTemplate(
  info: TemplateInfo,
  historia: CuotaMes[],
  meses: { anio: number; mes: number }[],
  opts: OpcionesProyeccion = {},
): CeldaTemplate[] {
  const porMes = new Map<string, number>()
  for (const c of historia) porMes.set(c.mes, (porMes.get(c.mes) || 0) + c.monto)

  const conMonto = [...porMes.entries()]
    .filter(([, v]) => v !== 0)
    .map(([clave, monto]) => ({ ...partes(clave), clave, monto }))
    .sort((a, b) => km(a.anio, a.mes) - km(b.anio, b.mes))

  // ── ¿Mensual o de meses puntuales?
  //
  // La densidad lo dice: meses con cuota sobre meses del tramo. Un template mensual paga
  // (casi) todos los meses de su historia; un impuesto anual en cuotas se saltea la mitad.
  //
  // Hace falta mirar la densidad y no sólo en qué meses del año pagó, porque con menos de un
  // año de historia el patrón engaña: Cargas Sociales con seis meses cargados (ene-jun)
  // parecería no pagar de julio en adelante, y es mensual.
  const spanMeses = conMonto.length > 0
    ? km(conMonto[conMonto.length - 1]!.anio, conMonto[conMonto.length - 1]!.mes)
      - km(conMonto[0]!.anio, conMonto[0]!.mes) + 1
    : 0
  const densidad = spanMeses > 0 ? conMonto.length / spanMeses : 0
  const esMensual = densidad >= 0.8
  // Si es mensual paga todos los meses; si no, sólo en los del año en que pagó.
  const patron = esMensual
    ? new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    : new Set(conMonto.map(c => c.mes))
  const ultima = conMonto[conMonto.length - 1]
  const factor = (desdeKm: number, hastaKm: number) =>
    opts.ipc && opts.ipc.length > 0
      ? factorIpc(opts.ipc, desdeKm, hastaKm)
      : Math.pow(1 + (opts.inflacionMensual ?? 0), Math.max(0, hastaKm - desdeKm))

  return meses.map(m => {
    const clave = `${m.anio}-${String(m.mes).padStart(2, '0')}`
    const cargada = porMes.get(clave)

    if (cargada != null) {
      return {
        mes: clave, monto: cargada, origen: 'cuota' as const,
        explicacion: `Cuota cargada: ${pesos(cargada)}`,
        faltaGenerar: false,
      }
    }
    if (!ultima || !patron.has(m.mes)) {
      return {
        mes: clave, monto: 0, origen: 'vacio' as const,
        explicacion: conMonto.length === 0
          ? 'Sin cuotas cargadas: no hay de dónde proyectar'
          : `Este template no paga en ${MESES_TXT[m.mes - 1]} (paga en `
            + `${[...patron].sort((a, b) => a - b).map(x => MESES_TXT[x - 1]).join(', ')})`,
        faltaGenerar: false,
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
