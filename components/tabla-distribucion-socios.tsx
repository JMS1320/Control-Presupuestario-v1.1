"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Info } from "lucide-react"
import { formatNumber, getMonthName } from "@/lib/format"
import type { ResumenPorSeccion, EstadisticasDistribucion } from "@/hooks/useDistribucionSociosData"
import { supabase } from "@/lib/supabase"

interface TablaDistribucionSociosProps {
  resumenPorSeccion: ResumenPorSeccion[]
  estadisticas: EstadisticasDistribucion | null
  mostrarDecimales: boolean
}

export function TablaDistribucionSocios({
  resumenPorSeccion,
  estadisticas,
  mostrarDecimales,
}: TablaDistribucionSociosProps) {
  // Crear distribMap para ordenamiento (esto debería venir del hook, pero lo recreamos aquí)
  const [distribMap, setDistribMap] = useState<Map<string, { concepto: string; orden: number; seccion: number }>>(
    new Map(),
  )

  useEffect(() => {
    async function fetchDistribMap() {
      const { data: distribData } = await supabase
        .from("distribucion_socios")
        .select("interno, concepto, orden, seccion")
        .order("seccion", { ascending: true })
        .order("orden", { ascending: true })

      if (distribData) {
        const map = new Map(
          distribData.map((d) => [d.interno, { concepto: d.concepto, orden: d.orden ?? 999, seccion: d.seccion ?? 1 }]),
        )
        setDistribMap(map)
      }
    }
    fetchDistribMap()
  }, [])

  if (resumenPorSeccion.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Distribución Socios - Resumen Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No hay datos de distribución para mostrar</p>
        </CardContent>
      </Card>
    )
  }

  // Función para aplicar color según el signo del valor
  const getColorClass = (value: number) => {
    if (value > 0) return "text-green-600"
    if (value < 0) return "text-red-600"
    return ""
  }

  // Función para renderizar una tabla por sección
  const renderTablaSeccion = (
    seccionData: ResumenPorSeccion,
    index: number,
    distribMap: Map<string, { concepto: string; orden: number; seccion: number }>,
  ) => {
    const { resumenMensual } = seccionData

    if (resumenMensual.length === 0) return null

    // Obtener todos los conceptos únicos de esta sección
    const todosLosConceptos = new Set<string>()
    resumenMensual.forEach((mes) => {
      Object.keys(mes.distribuciones).forEach((concepto) => todosLosConceptos.add(concepto))
    })

    // Ordenar conceptos por número de orden (no alfabéticamente)
    const conceptosConOrden = Array.from(todosLosConceptos).map((concepto) => {
      // Buscar el orden de este concepto en distribMap
      let orden = 999 // valor por defecto si no se encuentra
      for (const [interno, info] of distribMap.entries()) {
        if (info.concepto === concepto && info.seccion === seccionData.seccion) {
          orden = info.orden
          break
        }
      }
      return { concepto, orden }
    })

    // Ordenar por número de orden
    const conceptosOrdenados = conceptosConOrden.sort((a, b) => a.orden - b.orden).map((item) => item.concepto)

    // Calcular totales del período para esta sección
    const totalesPeriodo = resumenMensual.reduce(
      (acc, mes) => ({
        totalGeneral: acc.totalGeneral + mes.totalMensual,
      }),
      { totalGeneral: 0 },
    )

    // Calcular promedios mensuales para esta sección
    const promedioMensual = totalesPeriodo.totalGeneral / resumenMensual.length

    return (
      <Card key={`seccion-${seccionData.seccion}`} className={index > 0 ? "mt-6" : ""}>
        <CardHeader>
          <CardTitle>{seccionData.seccion === 1 ? "Distribución Socios" : "Movimientos por Revisar"}</CardTitle>
          <p className="text-sm text-muted-foreground">Ingresos menos Egresos por concepto y mes</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table suppressHydrationWarning>
              <TableHeader>
                <TableRow suppressHydrationWarning>
                  <TableHead className="font-semibold">Concepto</TableHead>
                  {resumenMensual.map((mes) => (
                    <TableHead key={`${mes.año}-${mes.mes}`} className="text-center font-semibold">
                      {getMonthName(mes.mes)} {mes.año}
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-semibold bg-blue-50">Total Período</TableHead>
                  <TableHead className="text-center font-semibold bg-green-50">Promedio Mensual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Filas por concepto */}
                {conceptosOrdenados.map((concepto) => (
                  <TableRow key={concepto} suppressHydrationWarning>
                    <TableCell className="font-medium">{concepto}</TableCell>
                    {resumenMensual.map((mes) => {
                      const valor = mes.distribuciones[concepto] || 0
                      return (
                        <TableCell key={`${concepto}-${mes.año}-${mes.mes}`} className="text-center">
                          {valor !== 0 ? (
                            <span className={getColorClass(valor)}>{formatNumber(valor, mostrarDecimales)}</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center bg-blue-50">
                      {(() => {
                        const total = resumenMensual.reduce((sum, mes) => sum + (mes.distribuciones[concepto] || 0), 0)
                        return <span className={getColorClass(total)}>{formatNumber(total, mostrarDecimales)}</span>
                      })()}
                    </TableCell>
                    <TableCell className="text-center bg-green-50">
                      {(() => {
                        const promedio =
                          resumenMensual.reduce((sum, mes) => sum + (mes.distribuciones[concepto] || 0), 0) /
                          resumenMensual.length
                        return (
                          <span className={getColorClass(promedio)}>{formatNumber(promedio, mostrarDecimales)}</span>
                        )
                      })()}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Fila de TOTAL para esta sección */}
                <TableRow suppressHydrationWarning className="font-semibold bg-gray-100 border-t-2">
                  <TableCell>TOTAL</TableCell>
                  {resumenMensual.map((mes) => (
                    <TableCell key={`total-${mes.año}-${mes.mes}`} className="text-center">
                      <span className={getColorClass(mes.totalMensual)}>
                        {formatNumber(mes.totalMensual, mostrarDecimales)}
                      </span>
                    </TableCell>
                  ))}
                  <TableCell className="text-center bg-blue-50">
                    <span className={getColorClass(totalesPeriodo.totalGeneral)}>
                      {formatNumber(totalesPeriodo.totalGeneral, mostrarDecimales)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center bg-green-50">
                    <span className={getColorClass(promedioMensual)}>
                      {formatNumber(promedioMensual, mostrarDecimales)}
                    </span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* 🚨 ALERTA DE VALORES HUÉRFANOS */}
      {estadisticas && estadisticas.movimientosSinConcepto > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">
                ⚠️ Existen {estadisticas.movimientosSinConcepto} movimientos con valores de "interno" que no están en la
                tabla Distribución Socios.
              </p>
              <div className="text-sm">
                <p className="font-medium">Valores no encontrados:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {estadisticas.valoresHuerfanos.map((valor) => (
                    <span key={valor} className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                      {valor}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* 📊 INFORMACIÓN DE ESTADÍSTICAS */}
      {estadisticas && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                Total movimientos: <strong>{estadisticas.totalMovimientos}</strong>
              </div>
              <div>
                Con concepto: <strong>{estadisticas.movimientosConConcepto}</strong>
              </div>
              <div>
                Sin concepto: <strong>{estadisticas.movimientosSinConcepto}</strong>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* 📋 TABLAS POR SECCIÓN */}
      {resumenPorSeccion.map((seccionData, index) => renderTablaSeccion(seccionData, index, distribMap))}
    </div>
  )
}
