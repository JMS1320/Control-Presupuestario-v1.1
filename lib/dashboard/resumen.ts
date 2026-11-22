/**
 * 📊 EL CÁLCULO DEL DASHBOARD — puro (sin base), para que lo usen la pantalla, el Excel, el PDF y los casos de `npm run probar`.
 *
 * ⚠️ cambió 22/11/2026 (A-FEAT-1637): vivía adentro de `hooks/useFinancialData.ts`. Se mudó sin cambiar la lógica: el hook lo
 * importa de acá. Lo único nuevo es que además devuelve **lo que quedó afuera** (`fuera`): un movimiento con categoría pero sin
 * sección (cuenta contable con tipo «NO» o vacío) antes desaparecía del total sin que nada lo dijera (§ 🧮 «nada se descarta
 * en silencio»). Ahora el control del dashboard lo muestra.
 */
import type { CuentaContable } from "@/lib/supabase"
import { resolverTipo, type TipoCuenta } from "@/lib/presupuesto/templates"

export type ResumenFinanciero = {
  mes: number
  año: number
  /** Totales por agrupadora — claves son nombres de agrupadora (cuenta_agrupadora de template o nombre_totalizadora de cuenta contable). */
  ingresos: { [agrupadora: string]: number }
  egresos: { [agrupadora: string]: number }
  financieros: { [agrupadora: string]: number }
  distribuciones: { [agrupadora: string]: number }
  /** Desglose por detalle dentro de cada agrupadora. Para templates normales: nombre del template. Para cuentas contables: nombre de la cuenta. Para templates multi-cuenta: nombre de la cuenta de cada sub-movimiento. */
  subCategorias: { [agrupadora: string]: { [detalle: string]: number } }
  totalIngresos: number
  totalEgresos: number
  totalFinancieros: number
  totalDistribuciones: number
  saldoMensual: number
}

export type InfoTemplate = { nombre: string, agrupadora: string | null, esMulti: boolean, tipo: TipoCuenta | null }

/** Las 4 secciones de la tabla, en su orden. */
export type SeccionDashboard = "ingresos" | "egresos" | "financieros" | "distribuciones"
export const SECCIONES_DASHBOARD: { key: SeccionDashboard; titulo: string }[] = [
  { key: "ingresos", titulo: "Ingresos" },
  { key: "egresos", titulo: "Egresos" },
  { key: "financieros", titulo: "Financieros" },
  { key: "distribuciones", titulo: "Distribuciones" },
]

const AGRUPADORA_SIN_AGRUPAR = "(Sin agrupar)"
const AGRUPADORA_SIN_CLASIFICAR = "(Sin clasificar)"

/** Un movimiento clasificado: dónde va en la tabla. `seccion = null` = no entra en ninguna (queda afuera, y se muestra). */
export interface Clasificacion {
  seccion: SeccionDashboard | null
  agrupadora: string
  detalle: string
  /** El tipo que salió (`NO`, vacío…) cuando no entra. */
  tipo: string | undefined
  monto: number
}

/**
 * Normaliza un nombre de totalizadora a su forma canónica para evitar duplicados
 * por diferencias de mayúsculas (ej: "EGRESOS POR GANADERIA" vs "Egresos Por Ganaderia").
 */
function construirMapaCanonizacionTotalizadoras(cuentas: CuentaContable[]): Map<string, string> {
  // Agrupar por key normalizada (lowercase trim) → tomar la versión más usada (la primera que aparezca con más cuentas)
  const conteo = new Map<string, Map<string, number>>()
  cuentas.forEach(c => {
    if (!c.nombre_totalizadora) return
    const key = c.nombre_totalizadora.toLowerCase().trim()
    if (!conteo.has(key)) conteo.set(key, new Map())
    const inner = conteo.get(key)!
    inner.set(c.nombre_totalizadora, (inner.get(c.nombre_totalizadora) || 0) + 1)
  })

  const canonical = new Map<string, string>()
  conteo.forEach((variantes, key) => {
    // Elegir la variante con mayor cuenta, o la "más limpia" (más mayúsculas) en empate
    let mejor = ''
    let mejorScore = -1
    variantes.forEach((cant, variante) => {
      const upperCount = (variante.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length
      const score = cant * 1000 + upperCount
      if (score > mejorScore) {
        mejorScore = score
        mejor = variante
      }
    })
    canonical.set(key, mejor)
  })

  return canonical
}

const SECCION_DE_TIPO: Record<string, SeccionDashboard> = {
  ingreso: "ingresos", egreso: "egresos", financiero: "financieros", distribucion: "distribuciones",
}

/** Arma el clasificador (una vez por lectura): dado un movimiento, en qué sección, agrupadora y detalle va. */
export function clasificadorDashboard(cuentas: CuentaContable[], templateMap: Map<string, InfoTemplate>) {
  const cuentasMap = new Map(cuentas.map((c) => [c.categ, c]))
  const canonicalTotalizadoras = construirMapaCanonizacionTotalizadoras(cuentas)
  const canonicalizar = (nombre: string | null | undefined): string | null => {
    if (!nombre) return null
    return canonicalTotalizadoras.get(nombre.toLowerCase().trim()) || nombre
  }

  return (mov: any): Clasificacion => {
    const cuentaInfo = cuentasMap.get(mov.categ)
    const templateInfo = mov.template_id ? templateMap.get(mov.template_id) : null
    const monto = (mov.creditos || 0) - (mov.debitos || 0)

    let agrupadora: string
    let detalle: string
    let tipo: string | undefined

    if (templateInfo && !templateInfo.esMulti) {
      // Template normal: la agrupadora viene del template, el detalle es el nombre del template.
      // El tipo lo declara el propio template; el plan de cuentas y el signo son sólo fallback
      // para templates nuevos sin clasificar (ver `resolverTipo`).
      agrupadora = canonicalizar(templateInfo.agrupadora) || AGRUPADORA_SIN_AGRUPAR
      detalle = templateInfo.nombre
      tipo = resolverTipo(templateInfo.tipo, cuentaInfo?.tipo as TipoCuenta | undefined, monto).tipo
    } else if (cuentaInfo) {
      // Sin template normal (multi-cuenta o sin template): usar la cuenta contable
      agrupadora = canonicalizar(cuentaInfo.nombre_totalizadora) || AGRUPADORA_SIN_AGRUPAR
      detalle = cuentaInfo.cuenta_contable || cuentaInfo.categ
      tipo = cuentaInfo.tipo
    } else {
      // Sin cuenta válida — pendiente de adjudicar
      agrupadora = AGRUPADORA_SIN_CLASIFICAR
      detalle = mov.categ || "(sin categ)"
      tipo = monto >= 0 ? "ingreso" : "egreso"
    }
    return { seccion: (tipo && SECCION_DE_TIPO[tipo]) || null, agrupadora, detalle, tipo, monto }
  }
}

/**
 * La tabla del dashboard (mes × sección × agrupadora × detalle) y lo que no entró en ninguna sección.
 * `fuera` lleva el movimiento y su clasificación: es lo que explica una diferencia del control.
 */
export function armarResumenFinanciero(
  movimientos: any[],
  cuentas: CuentaContable[],
  templateMap: Map<string, InfoTemplate>,
  /** Opcional (A-FEAT-1637, vista «Por responsable»): otro clasificador encima del de siempre — p. ej. para rotular «(pagó MSA)». */
  clasificarOtro?: (mov: any) => Clasificacion,
): { resumen: ResumenFinanciero[]; fuera: Array<{ mov: any; clasificacion: Clasificacion }> } {
  const clasificar = clasificarOtro ?? clasificadorDashboard(cuentas, templateMap)
  const resumenPorMes = new Map<string, ResumenFinanciero>()
  const fuera: Array<{ mov: any; clasificacion: Clasificacion }> = []

  movimientos.forEach((mov) => {
    const fechaParts = String(mov.fecha).split("-")
    const año = Number.parseInt(fechaParts[0])
    const mes = Number.parseInt(fechaParts[1])
    const key = `${año}-${mes}`

    const c = clasificar(mov)
    if (!c.seccion) fuera.push({ mov, clasificacion: c }) // sin sección: no sabemos dónde ponerlo → se muestra en el control
    // Como antes de la mudanza: un tipo que no es sección («NO») igual abre su mes (cuenta para el promedio); sin tipo, no.
    if (!c.tipo) return

    if (!resumenPorMes.has(key)) {
      resumenPorMes.set(key, {
        mes, año,
        ingresos: {}, egresos: {}, financieros: {}, distribuciones: {}, subCategorias: {},
        totalIngresos: 0, totalEgresos: 0, totalFinancieros: 0, totalDistribuciones: 0, saldoMensual: 0,
      })
    }
    const resumen = resumenPorMes.get(key)!
    if (!c.seccion) return
    const { agrupadora, detalle, monto } = c

    resumen[c.seccion][agrupadora] = (resumen[c.seccion][agrupadora] || 0) + monto
    if (c.seccion === "ingresos") resumen.totalIngresos += monto
    else if (c.seccion === "egresos") resumen.totalEgresos += monto
    else if (c.seccion === "financieros") resumen.totalFinancieros += monto
    else resumen.totalDistribuciones += monto
    if (!resumen.subCategorias[agrupadora]) resumen.subCategorias[agrupadora] = {}
    resumen.subCategorias[agrupadora][detalle] = (resumen.subCategorias[agrupadora][detalle] || 0) + monto

    resumen.saldoMensual =
      resumen.totalIngresos + resumen.totalEgresos + resumen.totalFinancieros + resumen.totalDistribuciones
  })

  const resumen = Array.from(resumenPorMes.values()).sort((a, b) => {
    if (a.año !== b.año) return a.año - b.año
    return a.mes - b.mes
  })
  return { resumen, fuera }
}

/** Lo de siempre: sólo la tabla. */
export function procesarResumenFinanciero(
  movimientos: any[],
  cuentas: CuentaContable[],
  templateMap: Map<string, InfoTemplate>,
): ResumenFinanciero[] {
  return armarResumenFinanciero(movimientos, cuentas, templateMap).resumen
}
