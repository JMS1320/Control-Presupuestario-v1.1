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
          console.log("Movimientos obtenidos:", movimientosData.length)
          console.log("Primer movimiento:", movimientosData[0])

          setMovimientos(movimientosData)

          // Procesar resumen financiero
          const resumenPorMes = procesarResumenFinanciero(movimientosData, cuentasData || [])
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

function procesarResumenFinanciero(movimientos: any[], cuentas: CuentaContable[]): ResumenFinanciero[] {
  const cuentasMap = new Map(cuentas.map((c) => [c.categ, c]))
  const resumenPorMes = new Map<string, ResumenFinanciero>()

  console.log("Procesando", movimientos.length, "movimientos")

  movimientos.forEach((mov) => {
    // FIX: Parsing de fecha sin problemas de zona horaria
    // Extraer año, mes, día directamente del string YYYY-MM-DD
    const fechaParts = mov.fecha.split("-")
    const año = Number.parseInt(fechaParts[0])
    const mes = Number.parseInt(fechaParts[1]) // Ya viene en formato 1-12
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
        totalIngresos: 0,
        totalEgresos: 0,
        totalFinancieros: 0,
        totalDistribuciones: 0,
        saldoMensual: 0,
      })
    }

    const resumen = resumenPorMes.get(key)!
    // Calcular monto real: créditos - débitos (puede ser positivo o negativo)
    const monto = (mov.creditos || 0) - (mov.debitos || 0)
    const nombreCuenta = cuentaInfo.cuenta_contable || cuentaInfo.categ

    switch (cuentaInfo.tipo) {
      case "ingreso":
        resumen.ingresos[nombreCuenta] = (resumen.ingresos[nombreCuenta] || 0) + monto
        resumen.totalIngresos += monto
        break
      case "egreso":
        // Para egresos, mantener el signo real (negativos se muestran en rojo)
        resumen.egresos[nombreCuenta] = (resumen.egresos[nombreCuenta] || 0) + monto
        resumen.totalEgresos += monto
        break
      case "financiero":
        // Para financieros, mantener el signo real
        resumen.financieros[nombreCuenta] = (resumen.financieros[nombreCuenta] || 0) + monto
        resumen.totalFinancieros += monto
        break
      case "distribucion":
        // Para distribuciones, mantener el signo real
        resumen.distribuciones[nombreCuenta] = (resumen.distribuciones[nombreCuenta] || 0) + monto
        resumen.totalDistribuciones += monto
        break
    }

    // FIX: Saldo total es simplemente la suma de todos los subtotales
    // Ya que cada uno viene con su signo correcto
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
