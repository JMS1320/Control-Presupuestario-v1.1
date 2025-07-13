"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

/* ──────────────────────────────────────────────────────────
 *  Tipos
 * ──────────────────────────────────────────────────────────*/
export type MovimientoDetallado = {
  id: number
  fecha: string
  detalle: string
  creditos: number
  debitos: number
  neto: number
  categ: string | null
  interno: string | null
  cuenta_contable?: string
  tipo_cuenta?: string
  concepto_distribucion?: string
}

export type ReporteDistribucionSocios = {
  concepto: string
  movimientos: MovimientoDetallado[]
  totalCreditos: number
  totalDebitos: number
  totalNeto: number
}

export type ReporteCuentasContables = {
  tipo: string
  cuentas: {
    cuenta: string
    movimientos: MovimientoDetallado[]
    totalCreditos: number
    totalDebitos: number
    totalNeto: number
  }[]
}

/* ──────────────────────────────────────────────────────────
 *  Hook
 * ──────────────────────────────────────────────────────────*/
export function useReporteDetallado(año: number, semestre?: 1 | 2) {
  const [reporteDistribucion, setReporteDistribucion] = useState<ReporteDistribucionSocios[]>([])
  const [reporteCuentas, setReporteCuentas] = useState<ReporteCuentasContables[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      try {
        /* 1. Rango de fechas ------------------------------------------------*/
        let fechaInicio = `${año}-01-01`
        let fechaFin = `${año}-12-31`

        if (semestre === 1) {
          fechaFin = `${año}-06-30`
        } else if (semestre === 2) {
          fechaInicio = `${año}-07-01`
        }

        /* 2. Movimientos ----------------------------------------------------*/
        const { data: movimientos, error: movErr } = await supabase
          .from("msa_galicia")
          .select("id, fecha, detalle, creditos, debitos, categ, interno")
          .gte("fecha", fechaInicio)
          .lte("fecha", fechaFin)
          .order("fecha", { ascending: true })
          .order("id", { ascending: true })

        if (movErr) throw movErr
        if (!movimientos) return

        /* 3. Cuentas contables ---------------------------------------------*/
        const { data: cuentas, error: ccErr } = await supabase
          .from("cuentas_contables")
          .select("categ, cuenta_contable, tipo")

        if (ccErr) throw ccErr

        const cuentasMap = new Map((cuentas || []).map((c) => [c.categ, { cuenta: c.cuenta_contable, tipo: c.tipo }]))

        /* 4. Distribución socios -------------------------------------------*/
        const { data: distribucion, error: distErr } = await supabase
          .from("distribucion_socios")
          .select("interno, concepto")

        if (distErr) throw distErr

        const distribucionMap = new Map((distribucion || []).map((d) => [d.interno, d.concepto]))

        /* 5. Enriquecer movimientos ----------------------------------------*/
        const movimientosDetallados: MovimientoDetallado[] = (movimientos || []).map((m) => {
          const cuentaInfo = m.categ ? cuentasMap.get(m.categ) : undefined
          const concepto = m.interno ? distribucionMap.get(m.interno) : undefined

          return {
            id: m.id,
            fecha: m.fecha,
            detalle: m.detalle || "",
            creditos: m.creditos || 0,
            debitos: m.debitos || 0,
            neto: (m.creditos || 0) - (m.debitos || 0),
            categ: m.categ,
            interno: m.interno,
            cuenta_contable: cuentaInfo?.cuenta,
            tipo_cuenta: cuentaInfo?.tipo,
            concepto_distribucion: concepto,
          }
        })

        /* 6-A. Reporte Distribución ----------------------------------------*/
        const distribucionAgrupada = new Map<string, MovimientoDetallado[]>()

        movimientosDetallados.forEach((mov) => {
          if (!mov.concepto_distribucion) return
          const key = mov.concepto_distribucion
          if (!distribucionAgrupada.has(key)) distribucionAgrupada.set(key, [])
          distribucionAgrupada.get(key)!.push(mov)
        })

        const reporteDistribucionFinal: ReporteDistribucionSocios[] = Array.from(distribucionAgrupada.entries()).map(
          ([concepto, movs]) => {
            const totalCreditos = movs.reduce((s, m) => s + m.creditos, 0)
            const totalDebitos = movs.reduce((s, m) => s + m.debitos, 0)
            return {
              concepto,
              movimientos: movs,
              totalCreditos,
              totalDebitos,
              totalNeto: totalCreditos - totalDebitos,
            }
          },
        )

        /* 6-B. Reporte Cuentas Contables -----------------------------------*/
        const cuentasPorTipo = new Map<
          string,
          Map<
            string,
            {
              movimientos: MovimientoDetallado[]
              totalCreditos: number
              totalDebitos: number
            }
          >
        >()

        movimientosDetallados.forEach((mov) => {
          if (!mov.tipo_cuenta || !mov.cuenta_contable) return

          if (!cuentasPorTipo.has(mov.tipo_cuenta)) {
            cuentasPorTipo.set(mov.tipo_cuenta, new Map())
          }
          const mapCuenta = cuentasPorTipo.get(mov.tipo_cuenta)!

          if (!mapCuenta.has(mov.cuenta_contable)) {
            mapCuenta.set(mov.cuenta_contable, {
              movimientos: [],
              totalCreditos: 0,
              totalDebitos: 0,
            })
          }
          const entry = mapCuenta.get(mov.cuenta_contable)!
          entry.movimientos.push(mov)
          entry.totalCreditos += mov.creditos
          entry.totalDebitos += mov.debitos
        })

        const reporteCuentasFinal: ReporteCuentasContables[] = Array.from(cuentasPorTipo.entries()).map(
          ([tipo, cuentasMapTipo]) => ({
            tipo,
            cuentas: Array.from(cuentasMapTipo.entries()).map(([cuenta, datos]) => ({
              cuenta,
              movimientos: datos.movimientos,
              totalCreditos: datos.totalCreditos,
              totalDebitos: datos.totalDebitos,
              totalNeto: datos.totalCreditos - datos.totalDebitos,
            })),
          }),
        )

        /* 7. Guardar estado -------------------------------------------------*/
        setReporteDistribucion(reporteDistribucionFinal)
        setReporteCuentas(reporteCuentasFinal)
      } catch (e) {
        console.error("Error en useReporteDetallado:", e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [año, semestre])

  return { reporteDistribucion, reporteCuentas, loading }
}
