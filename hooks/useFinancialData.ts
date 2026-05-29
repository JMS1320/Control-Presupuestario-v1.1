"use client"

import { useState, useEffect } from "react"
import { supabase, type CuentaContable, type MovimientoMSA } from "@/lib/supabase"

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

const AGRUPADORA_SIN_AGRUPAR = "(Sin agrupar)"
const AGRUPADORA_SIN_CLASIFICAR = "(Sin clasificar)"

export function useFinancialData(año: number, semestre?: number) {
  const [cuentas, setCuentas] = useState<CuentaContable[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoMSA[]>([])
  const [resumen, setResumen] = useState<ResumenFinanciero[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      try {
        // Obtener cuentas contables
        const { data: cuentasData, error: cuentasError } = await supabase.from("cuentas_contables").select("*")

        if (cuentasError) {
          console.error("Error al obtener cuentas contables:", cuentasError)
          setLoading(false)
          return
        }

        if (cuentasData) setCuentas(cuentasData)

        // Construir filtro de fechas
        let fechaInicio = `${año}-01-01`
        let fechaFin = `${año}-12-31`

        if (semestre === 1) {
          fechaFin = `${año}-06-30`
        } else if (semestre === 2) {
          fechaInicio = `${año}-07-01`
        }

        // Templates activos con su agrupadora y flag multi-cuenta
        const { data: allTemplates } = await supabase
          .from("egresos_sin_factura")
          .select("id, nombre_referencia, cuenta_agrupadora, es_multi_cuenta")
          .eq("activo", true)

        const templateMap = new Map<string, { nombre: string, agrupadora: string | null, esMulti: boolean }>()
        ;(allTemplates || []).forEach((t: any) => templateMap.set(t.id, {
          nombre: t.nombre_referencia,
          agrupadora: t.cuenta_agrupadora || null,
          esMulti: !!t.es_multi_cuenta,
        }))

        // Movimientos del período
        const { data: movimientosData, error: movimientosError } = await supabase
          .from("msa_galicia")
          .select("*")
          .gte("fecha", fechaInicio)
          .lte("fecha", fechaFin)
          .not("categ", "is", null)

        if (movimientosError) {
          console.error("Error al obtener movimientos:", movimientosError)
          setLoading(false)
          return
        }

        if (movimientosData) {
          setMovimientos(movimientosData)
          const resumenPorMes = procesarResumenFinanciero(movimientosData, cuentasData || [], templateMap)
          setResumen(resumenPorMes)
        }
      } catch (error) {
        console.error("Error general en fetchData:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [año, semestre])

  return { cuentas, movimientos, resumen, loading }
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

function procesarResumenFinanciero(
  movimientos: any[],
  cuentas: CuentaContable[],
  templateMap: Map<string, { nombre: string, agrupadora: string | null, esMulti: boolean }>
): ResumenFinanciero[] {
  const cuentasMap = new Map(cuentas.map((c) => [c.categ, c]))
  const canonicalTotalizadoras = construirMapaCanonizacionTotalizadoras(cuentas)

  const canonicalizar = (nombre: string | null | undefined): string | null => {
    if (!nombre) return null
    return canonicalTotalizadoras.get(nombre.toLowerCase().trim()) || nombre
  }

  const resumenPorMes = new Map<string, ResumenFinanciero>()

  movimientos.forEach((mov) => {
    const fechaParts = mov.fecha.split("-")
    const año = Number.parseInt(fechaParts[0])
    const mes = Number.parseInt(fechaParts[1])
    const key = `${año}-${mes}`

    const cuentaInfo = cuentasMap.get(mov.categ)
    const templateInfo = mov.template_id ? templateMap.get(mov.template_id) : null
    const monto = (mov.creditos || 0) - (mov.debitos || 0)

    // ---- Determinar agrupadora, detalle y tipo ----
    let agrupadora: string
    let detalle: string
    let tipo: string | undefined

    if (templateInfo && !templateInfo.esMulti) {
      // Template normal: la agrupadora viene del template, el detalle es el nombre del template
      agrupadora = canonicalizar(templateInfo.agrupadora) || AGRUPADORA_SIN_AGRUPAR
      detalle = templateInfo.nombre
      tipo = cuentaInfo?.tipo || (monto >= 0 ? "ingreso" : "egreso")
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

    if (!tipo) return // Sin tipo válido, no sabemos en qué sección ponerlo

    // ---- Inicializar mes si no existe ----
    if (!resumenPorMes.has(key)) {
      resumenPorMes.set(key, {
        mes,
        año,
        ingresos: {},
        egresos: {},
        financieros: {},
        distribuciones: {},
        subCategorias: {},
        totalIngresos: 0,
        totalEgresos: 0,
        totalFinancieros: 0,
        totalDistribuciones: 0,
        saldoMensual: 0,
      })
    }

    const resumen = resumenPorMes.get(key)!

    // ---- Acumular en sección + subcategoría ----
    const sumarSubCateg = () => {
      if (!resumen.subCategorias[agrupadora]) resumen.subCategorias[agrupadora] = {}
      resumen.subCategorias[agrupadora][detalle] = (resumen.subCategorias[agrupadora][detalle] || 0) + monto
    }

    switch (tipo) {
      case "ingreso":
        resumen.ingresos[agrupadora] = (resumen.ingresos[agrupadora] || 0) + monto
        resumen.totalIngresos += monto
        sumarSubCateg()
        break
      case "egreso":
        resumen.egresos[agrupadora] = (resumen.egresos[agrupadora] || 0) + monto
        resumen.totalEgresos += monto
        sumarSubCateg()
        break
      case "financiero":
        resumen.financieros[agrupadora] = (resumen.financieros[agrupadora] || 0) + monto
        resumen.totalFinancieros += monto
        sumarSubCateg()
        break
      case "distribucion":
        resumen.distribuciones[agrupadora] = (resumen.distribuciones[agrupadora] || 0) + monto
        resumen.totalDistribuciones += monto
        sumarSubCateg()
        break
    }

    resumen.saldoMensual =
      resumen.totalIngresos + resumen.totalEgresos + resumen.totalFinancieros + resumen.totalDistribuciones
  })

  return Array.from(resumenPorMes.values()).sort((a, b) => {
    if (a.año !== b.año) return a.año - b.año
    return a.mes - b.mes
  })
}
