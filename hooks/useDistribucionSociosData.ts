"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { traerTodo } from "@/lib/supabase-paginado"
import { avisarSiIncompleta } from "@/lib/ui/avisar-lectura"

export type ResumenDistribucionSocios = {
  mes: number
  año: number
  distribuciones: { [concepto: string]: number } // concepto -> monto neto (ingresos - egresos)
  totalMensual: number
}

export type ResumenPorSeccion = {
  seccion: number
  resumenMensual: ResumenDistribucionSocios[]
}

export type EstadisticasDistribucion = {
  totalMovimientos: number
  movimientosConConcepto: number
  movimientosSinConcepto: number
  valoresHuerfanos: string[]
}

export function useDistribucionSociosData(año: number, semestre?: number) {
  const [resumenPorSeccion, setResumenPorSeccion] = useState<ResumenPorSeccion[]>([])
  const [estadisticas, setEstadisticas] = useState<EstadisticasDistribucion | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      try {
        // Construir filtro de fechas
        let fechaInicio = `${año}-01-01`
        let fechaFin = `${año}-12-31`

        if (semestre === 1) {
          fechaFin = `${año}-06-30`
        } else if (semestre === 2) {
          fechaInicio = `${año}-07-01`
        }

        // 1) Traer catálogo de distribuciones CON SECCIÓN - SIN FILTROS
        const { data: distribData, error: distribError } = await supabase
          .from("distribucion_socios")
          .select("interno, concepto, orden, seccion")
          .order("seccion", { ascending: true })
          .order("orden", { ascending: true })

        if (distribError) {
          console.error("Error al obtener distribucion_socios:", distribError)
          setLoading(false)
          return
        }

        console.log("📋 Catálogo distribucion_socios completo:", distribData)

        // Verificar cuántos registros hay por sección
        const seccion1 = distribData?.filter((d) => d.seccion === 1) || []
        const seccion2 = distribData?.filter((d) => d.seccion === 2) || []

        console.log(`📊 Sección 1: ${seccion1.length} registros`)
        console.log(`📊 Sección 2: ${seccion2.length} registros`)
        console.log("🔍 Registros Sección 1:", seccion1)

        const distribMap = new Map(
          (distribData || []).map((d) => [
            d.interno,
            { concepto: d.concepto, orden: d.orden ?? 0, seccion: d.seccion ?? 1 },
          ]),
        )

        // 2) Traer movimientos MSA con el rango de fechas
        // ✅ FILTRAR: Solo movimientos que SÍ tienen valor en interno (no nulos ni vacíos)
        // ✂️ A-BUG-1379: de a tandas (defensivo: hoy son 112, pero la tabla ya pasó las 1.000).
        const rMov = await traerTodo<any>((d, h) => supabase
          .from("msa_galicia")
          .select("fecha, creditos, debitos, interno", { count: "exact" })
          .gte("fecha", fechaInicio)
          .lte("fecha", fechaFin)
          .not("interno", "is", null)
          .neq("interno", "") // ✅ Excluir campos vacíos
          .order("id").range(d, h))
        const movimientosData = rMov.data
        const movError = rMov.error
        avisarSiIncompleta("Distribución socios · movimientos", rMov)

        if (movError) {
          console.error("Error al obtener movimientos distribución:", movError)
          setLoading(false)
          return
        }

        console.log(`💰 Total movimientos MSA: ${movimientosData?.length || 0}`)

        // 3) Procesar datos por sección
        const { resumenPorSeccion, estadisticas } = procesarResumenPorSeccion(movimientosData || [], distribMap)
        setResumenPorSeccion(resumenPorSeccion)
        setEstadisticas(estadisticas)
      } catch (error) {
        console.error("Error general en fetchData distribución:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [año, semestre])

  return { resumenPorSeccion, estadisticas, loading }
}

function procesarResumenPorSeccion(
  movimientos: any[],
  distribMap: Map<string, { concepto: string; orden: number; seccion: number }>,
): { resumenPorSeccion: ResumenPorSeccion[]; estadisticas: EstadisticasDistribucion } {
  // Mapas separados por sección
  const resumenSeccion1 = new Map<string, ResumenDistribucionSocios>()
  const resumenSeccion2 = new Map<string, ResumenDistribucionSocios>()

  const valoresHuerfanos = new Set<string>()
  let movimientosConConcepto = 0
  let movimientosSinConcepto = 0

  // 🔍 OBTENER TODOS LOS CONCEPTOS DISPONIBLES POR SECCIÓN
  const conceptosSeccion1 = new Set<string>()
  const conceptosSeccion2 = new Set<string>()

  // Primero, identificar todos los conceptos disponibles
  for (const [interno, info] of distribMap.entries()) {
    if (info.seccion === 1) {
      conceptosSeccion1.add(info.concepto)
    } else if (info.seccion === 2) {
      conceptosSeccion2.add(info.concepto)
    }
  }

  console.log("🎯 Conceptos disponibles Sección 1:", Array.from(conceptosSeccion1))
  console.log("🎯 Conceptos disponibles Sección 2:", Array.from(conceptosSeccion2))

  console.log("Procesando", movimientos.length, "movimientos de distribución por sección")

  movimientos.forEach((mov) => {
    // ✅ VALIDACIÓN MEJORADA: Solo procesar si interno tiene valor real
    if (!mov.interno || mov.interno.trim() === "") {
      return // Saltar movimientos sin valor interno
    }

    const distribInfo = distribMap.get(mov.interno)
    const concepto = distribInfo?.concepto
    const seccion = distribInfo?.seccion ?? 1

    // Contar estadísticas
    if (concepto) {
      movimientosConConcepto++
    } else {
      movimientosSinConcepto++
      // ✅ Solo agregar a huérfanos si tiene valor real
      valoresHuerfanos.add(mov.interno)
    }

    // 🚫 FILTRAR: Solo procesar movimientos que SÍ tienen concepto
    if (!concepto) {
      return // Saltar este movimiento
    }

    // Extraer año, mes del string YYYY-MM-DD
    const fechaParts = mov.fecha.split("-")
    const año = Number.parseInt(fechaParts[0])
    const mes = Number.parseInt(fechaParts[1])
    const key = `${año}-${mes}`

    // Seleccionar el mapa correcto según la sección
    const resumenMap = seccion === 1 ? resumenSeccion1 : resumenSeccion2

    if (!resumenMap.has(key)) {
      resumenMap.set(key, {
        mes,
        año,
        distribuciones: {},
        totalMensual: 0,
      })
    }

    const resumen = resumenMap.get(key)!

    // Calcular monto neto: créditos - débitos (ingresos - egresos)
    const montoNeto = (mov.creditos || 0) - (mov.debitos || 0)

    // Acumular por concepto
    resumen.distribuciones[concepto] = (resumen.distribuciones[concepto] || 0) + montoNeto
    resumen.totalMensual += montoNeto
  })

  // 🔧 ASEGURAR QUE TODOS LOS CONCEPTOS APAREZCAN (incluso con valor 0)
  const inicializarConceptos = (
    resumenMap: Map<string, ResumenDistribucionSocios>,
    conceptosDisponibles: Set<string>,
  ) => {
    for (const [key, resumen] of resumenMap.entries()) {
      for (const concepto of conceptosDisponibles) {
        if (!(concepto in resumen.distribuciones)) {
          resumen.distribuciones[concepto] = 0
        }
      }
    }
  }

  inicializarConceptos(resumenSeccion1, conceptosSeccion1)
  inicializarConceptos(resumenSeccion2, conceptosSeccion2)

  // Convertir mapas a arrays ordenados
  const sortResumen = (resumenMap: Map<string, ResumenDistribucionSocios>) =>
    Array.from(resumenMap.values()).sort((a, b) => {
      if (a.año !== b.año) return a.año - b.año
      return a.mes - b.mes
    })

  const resumenPorSeccion: ResumenPorSeccion[] = [
    {
      seccion: 1,
      resumenMensual: sortResumen(resumenSeccion1),
    },
    {
      seccion: 2,
      resumenMensual: sortResumen(resumenSeccion2),
    },
  ].filter((seccion) => seccion.resumenMensual.length > 0) // Solo incluir secciones con datos

  const estadisticas: EstadisticasDistribucion = {
    totalMovimientos: movimientos.length,
    movimientosConConcepto,
    movimientosSinConcepto,
    valoresHuerfanos: Array.from(valoresHuerfanos).sort(),
  }

  console.log("📊 Resumen final por sección:", resumenPorSeccion)
  console.log("📈 Estadísticas distribución (sin campos vacíos):", estadisticas)

  // 🔍 Debug: Verificar conceptos en el resumen final
  resumenPorSeccion.forEach((seccion, index) => {
    if (seccion.resumenMensual.length > 0) {
      const conceptosEnResumen = Object.keys(seccion.resumenMensual[0].distribuciones)
      console.log(`🎯 Sección ${seccion.seccion} - Conceptos en resumen final:`, conceptosEnResumen)
    }
  })

  return { resumenPorSeccion, estadisticas }
}
