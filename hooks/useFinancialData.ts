"use client"

import { useState, useEffect } from "react"
import { supabase, type CuentaContable, type MovimientoMSA } from "@/lib/supabase"

export type ResumenFinanciero = {
  mes: number
  año: number
  ingresos: { [cuenta: string]: number }
  egresos: { [cuenta: string]: number }
  financieros: { [cuenta: string]: number }
  distribuciones: { [cuenta: string]: number }
  /** Sub-categorías de templates multi-cuenta: { "Otros Gastos": { "MAIZ": -335800, "GASOIL": -120000 } } */
  subCategorias: { [parentCuenta: string]: { [subCateg: string]: number } }
  totalIngresos: number
  totalEgresos: number
  totalFinancieros: number
  totalDistribuciones: number
  saldoMensual: number
}

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

        // Obtener TODOS los templates activos (para agrupar por nombre de template en dashboard)
        const { data: allTemplates } = await supabase
          .from("egresos_sin_factura")
          .select("id, nombre_referencia, es_multi_cuenta")
          .eq("activo", true)

        const templateMap = new Map<string, { nombre: string, esMulti: boolean }>()
        ;(allTemplates || []).forEach((t: any) => templateMap.set(t.id, { nombre: t.nombre_referencia, esMulti: !!t.es_multi_cuenta }))

        // Obtener movimientos SIN JOIN (relación se resuelve en el cliente)
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

          // Procesar resumen financiero
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

function procesarResumenFinanciero(movimientos: any[], cuentas: CuentaContable[], templateMap: Map<string, { nombre: string, esMulti: boolean }> = new Map()): ResumenFinanciero[] {
  const cuentasMap = new Map(cuentas.map((c) => [c.categ, c]))
  const resumenPorMes = new Map<string, ResumenFinanciero>()

  movimientos.forEach((mov) => {
    const fechaParts = mov.fecha.split("-")
    const año = Number.parseInt(fechaParts[0])
    const mes = Number.parseInt(fechaParts[1])
    const key = `${año}-${mes}`

    const cuentaInfo = cuentasMap.get(mov.categ)

    if (!cuentaInfo) {
      console.warn(`No se encontró información de cuenta para categ: ${mov.categ}`)
      return
    }

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
    const monto = (mov.creditos || 0) - (mov.debitos || 0)
    const nombreCuenta = cuentaInfo.cuenta_contable || cuentaInfo.categ

    // Detectar si el movimiento tiene template vinculado
    const templateInfo = mov.template_id ? templateMap.get(mov.template_id) : null

    // Determinar el nombre de agrupación:
    // - Con template → nombre del template
    // - Sin template → nombre de la cuenta contable
    const nombreAgrupacion = templateInfo ? templateInfo.nombre : nombreCuenta

    switch (cuentaInfo.tipo) {
      case "ingreso":
        resumen.ingresos[nombreAgrupacion] = (resumen.ingresos[nombreAgrupacion] || 0) + monto
        resumen.totalIngresos += monto
        break
      case "egreso":
        resumen.egresos[nombreAgrupacion] = (resumen.egresos[nombreAgrupacion] || 0) + monto
        // Si es multi-cuenta, guardar detalle por sub-categoría
        if (templateInfo?.esMulti) {
          if (!resumen.subCategorias[nombreAgrupacion]) resumen.subCategorias[nombreAgrupacion] = {}
          resumen.subCategorias[nombreAgrupacion][nombreCuenta] = (resumen.subCategorias[nombreAgrupacion][nombreCuenta] || 0) + monto
        }
        resumen.totalEgresos += monto
        break
      case "financiero":
        resumen.financieros[nombreAgrupacion] = (resumen.financieros[nombreAgrupacion] || 0) + monto
        resumen.totalFinancieros += monto
        break
      case "distribucion":
        resumen.distribuciones[nombreAgrupacion] = (resumen.distribuciones[nombreAgrupacion] || 0) + monto
        resumen.totalDistribuciones += monto
        break
    }

    resumen.saldoMensual =
      resumen.totalIngresos + resumen.totalEgresos + resumen.totalFinancieros + resumen.totalDistribuciones
  })

  const resultado = Array.from(resumenPorMes.values()).sort((a, b) => {
    if (a.año !== b.año) return a.año - b.año
    return a.mes - b.mes
  })

  console.log("Resumen procesado:", resultado)
  return resultado
}
