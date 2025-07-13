"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatNumber, getMonthName } from "@/lib/format"
import type { ResumenFinanciero } from "@/hooks/useFinancialData"

interface TablaResumenFinancieroProps {
  /** Listado de registros por mes; puede llegar como undefined */
  resumen?: ResumenFinanciero[]
  mostrarDecimales: boolean
}

export function TablaResumenFinanciero({ resumen, mostrarDecimales }: TablaResumenFinancieroProps) {
  if (!resumen || resumen.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumen Financiero Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No hay datos para mostrar</p>
        </CardContent>
      </Card>
    )
  }

  // Obtener todas las cuentas únicas
  const todasLasCuentas = new Set<string>()
  resumen.forEach((mes) => {
    Object.keys(mes.ingresos).forEach((cuenta) => todasLasCuentas.add(cuenta))
    Object.keys(mes.egresos).forEach((cuenta) => todasLasCuentas.add(cuenta))
    Object.keys(mes.financieros).forEach((cuenta) => todasLasCuentas.add(cuenta))
    Object.keys(mes.distribuciones).forEach((cuenta) => todasLasCuentas.add(cuenta))
  })

  // Calcular totales del período
  const totalesPeriodo = resumen.reduce(
    (acc, mes) => ({
      ingresos: acc.ingresos + mes.totalIngresos,
      egresos: acc.egresos + mes.totalEgresos,
      financieros: acc.financieros + mes.totalFinancieros,
      distribuciones: acc.distribuciones + mes.totalDistribuciones,
      saldo: acc.saldo + mes.saldoMensual,
    }),
    { ingresos: 0, egresos: 0, financieros: 0, distribuciones: 0, saldo: 0 },
  )

  // Calcular promedios mensuales
  const promedios = {
    ingresos: totalesPeriodo.ingresos / resumen.length,
    egresos: totalesPeriodo.egresos / resumen.length,
    financieros: totalesPeriodo.financieros / resumen.length,
    distribuciones: totalesPeriodo.distribuciones / resumen.length,
    saldo: totalesPeriodo.saldo / resumen.length,
  }

  // Calcular saldo acumulado
  let saldoAcumulado = 0

  // Función para aplicar color según el signo del valor
  const getColorClass = (value: number) => {
    if (value > 0) return "text-green-600"
    if (value < 0) return "text-red-600"
    return ""
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen Financiero Mensual</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table suppressHydrationWarning>
            <TableHeader>
              <TableRow suppressHydrationWarning>
                <TableHead className="font-semibold">Concepto</TableHead>
                {resumen.map((mes) => (
                  <TableHead key={`${mes.año}-${mes.mes}`} className="text-center font-semibold">
                    {getMonthName(mes.mes)} {mes.año}
                  </TableHead>
                ))}
                <TableHead className="text-center font-semibold bg-blue-50">Total Período</TableHead>
                <TableHead className="text-center font-semibold bg-green-50">Promedio Mensual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* INGRESOS */}
              <TableRow suppressHydrationWarning className="bg-green-50">
                <TableCell className="font-semibold text-green-800">INGRESOS</TableCell>
                {resumen.map((mes) => (
                  <TableCell key={`ingresos-${mes.año}-${mes.mes}`} className="text-center"></TableCell>
                ))}
                <TableCell className="text-center"></TableCell>
                <TableCell className="text-center"></TableCell>
              </TableRow>

              {Array.from(todasLasCuentas)
                .filter((cuenta) => resumen.some((mes) => mes.ingresos[cuenta] !== undefined))
                .map((cuenta) => (
                  <TableRow suppressHydrationWarning key={`ingreso-${cuenta}`}>
                    <TableCell className="pl-4">{cuenta}</TableCell>
                    {resumen.map((mes) => {
                      const valor = mes.ingresos[cuenta]
                      return (
                        <TableCell key={`${cuenta}-${mes.año}-${mes.mes}`} className="text-center">
                          {valor !== undefined ? (
                            <span className={getColorClass(valor)}>{formatNumber(valor, mostrarDecimales)}</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center bg-blue-50">
                      {(() => {
                        const total = resumen.reduce((sum, mes) => sum + (mes.ingresos[cuenta] || 0), 0)
                        return <span className={getColorClass(total)}>{formatNumber(total, mostrarDecimales)}</span>
                      })()}
                    </TableCell>
                    <TableCell className="text-center bg-green-50">
                      {(() => {
                        const promedio =
                          resumen.reduce((sum, mes) => sum + (mes.ingresos[cuenta] || 0), 0) / resumen.length
                        return (
                          <span className={getColorClass(promedio)}>{formatNumber(promedio, mostrarDecimales)}</span>
                        )
                      })()}
                    </TableCell>
                  </TableRow>
                ))}

              <TableRow suppressHydrationWarning className="font-semibold bg-green-100">
                <TableCell>Subtotal Ingresos</TableCell>
                {resumen.map((mes) => (
                  <TableCell key={`subtotal-ingresos-${mes.año}-${mes.mes}`} className="text-center">
                    <span className={getColorClass(mes.totalIngresos)}>
                      {formatNumber(mes.totalIngresos, mostrarDecimales)}
                    </span>
                  </TableCell>
                ))}
                <TableCell className="text-center bg-blue-50">
                  <span className={getColorClass(totalesPeriodo.ingresos)}>
                    {formatNumber(totalesPeriodo.ingresos, mostrarDecimales)}
                  </span>
                </TableCell>
                <TableCell className="text-center bg-green-50">
                  <span className={getColorClass(promedios.ingresos)}>
                    {formatNumber(promedios.ingresos, mostrarDecimales)}
                  </span>
                </TableCell>
              </TableRow>

              {/* EGRESOS */}
              <TableRow suppressHydrationWarning className="bg-red-50">
                <TableCell className="font-semibold text-red-800">EGRESOS</TableCell>
                {resumen.map((mes) => (
                  <TableCell key={`egresos-${mes.año}-${mes.mes}`} className="text-center"></TableCell>
                ))}
                <TableCell className="text-center"></TableCell>
                <TableCell className="text-center"></TableCell>
              </TableRow>

              {Array.from(todasLasCuentas)
                .filter((cuenta) => resumen.some((mes) => mes.egresos[cuenta] !== undefined))
                .map((cuenta) => (
                  <TableRow suppressHydrationWarning key={`egreso-${cuenta}`}>
                    <TableCell className="pl-4">{cuenta}</TableCell>
                    {resumen.map((mes) => {
                      const valor = mes.egresos[cuenta]
                      return (
                        <TableCell key={`${cuenta}-${mes.año}-${mes.mes}`} className="text-center">
                          {valor !== undefined ? (
                            <span className={getColorClass(valor)}>{formatNumber(valor, mostrarDecimales)}</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center bg-blue-50">
                      {(() => {
                        const total = resumen.reduce((sum, mes) => sum + (mes.egresos[cuenta] || 0), 0)
                        return <span className={getColorClass(total)}>{formatNumber(total, mostrarDecimales)}</span>
                      })()}
                    </TableCell>
                    <TableCell className="text-center bg-green-50">
                      {(() => {
                        const promedio =
                          resumen.reduce((sum, mes) => sum + (mes.egresos[cuenta] || 0), 0) / resumen.length
                        return (
                          <span className={getColorClass(promedio)}>{formatNumber(promedio, mostrarDecimales)}</span>
                        )
                      })()}
                    </TableCell>
                  </TableRow>
                ))}

              <TableRow suppressHydrationWarning className="font-semibold bg-red-100">
                <TableCell>Subtotal Egresos</TableCell>
                {resumen.map((mes) => (
                  <TableCell key={`subtotal-egresos-${mes.año}-${mes.mes}`} className="text-center">
                    <span className={getColorClass(mes.totalEgresos)}>
                      {formatNumber(mes.totalEgresos, mostrarDecimales)}
                    </span>
                  </TableCell>
                ))}
                <TableCell className="text-center bg-blue-50">
                  <span className={getColorClass(totalesPeriodo.egresos)}>
                    {formatNumber(totalesPeriodo.egresos, mostrarDecimales)}
                  </span>
                </TableCell>
                <TableCell className="text-center bg-green-50">
                  <span className={getColorClass(promedios.egresos)}>
                    {formatNumber(promedios.egresos, mostrarDecimales)}
                  </span>
                </TableCell>
              </TableRow>

              {/* FINANCIEROS */}
              <TableRow suppressHydrationWarning className="bg-yellow-50">
                <TableCell className="font-semibold text-yellow-800">FINANCIEROS</TableCell>
                {resumen.map((mes) => (
                  <TableCell key={`financieros-${mes.año}-${mes.mes}`} className="text-center"></TableCell>
                ))}
                <TableCell className="text-center"></TableCell>
                <TableCell className="text-center"></TableCell>
              </TableRow>

              {Array.from(todasLasCuentas)
                .filter((cuenta) => resumen.some((mes) => mes.financieros[cuenta] !== undefined))
                .map((cuenta) => (
                  <TableRow suppressHydrationWarning key={`financiero-${cuenta}`}>
                    <TableCell className="pl-4">{cuenta}</TableCell>
                    {resumen.map((mes) => {
                      const valor = mes.financieros[cuenta]
                      return (
                        <TableCell key={`${cuenta}-${mes.año}-${mes.mes}`} className="text-center">
                          {valor !== undefined ? (
                            <span className={getColorClass(valor)}>{formatNumber(valor, mostrarDecimales)}</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center bg-blue-50">
                      {(() => {
                        const total = resumen.reduce((sum, mes) => sum + (mes.financieros[cuenta] || 0), 0)
                        return <span className={getColorClass(total)}>{formatNumber(total, mostrarDecimales)}</span>
                      })()}
                    </TableCell>
                    <TableCell className="text-center bg-green-50">
                      {(() => {
                        const promedio =
                          resumen.reduce((sum, mes) => sum + (mes.financieros[cuenta] || 0), 0) / resumen.length
                        return (
                          <span className={getColorClass(promedio)}>{formatNumber(promedio, mostrarDecimales)}</span>
                        )
                      })()}
                    </TableCell>
                  </TableRow>
                ))}

              <TableRow suppressHydrationWarning className="font-semibold bg-yellow-100">
                <TableCell>Subtotal Financieros</TableCell>
                {resumen.map((mes) => (
                  <TableCell key={`subtotal-financieros-${mes.año}-${mes.mes}`} className="text-center">
                    <span className={getColorClass(mes.totalFinancieros)}>
                      {formatNumber(mes.totalFinancieros, mostrarDecimales)}
                    </span>
                  </TableCell>
                ))}
                <TableCell className="text-center bg-blue-50">
                  <span className={getColorClass(totalesPeriodo.financieros)}>
                    {formatNumber(totalesPeriodo.financieros, mostrarDecimales)}
                  </span>
                </TableCell>
                <TableCell className="text-center bg-green-50">
                  <span className={getColorClass(promedios.financieros)}>
                    {formatNumber(promedios.financieros, mostrarDecimales)}
                  </span>
                </TableCell>
              </TableRow>

              {/* DISTRIBUCIONES */}
              <TableRow suppressHydrationWarning className="bg-purple-50">
                <TableCell className="font-semibold text-purple-800">DISTRIBUCIONES</TableCell>
                {resumen.map((mes) => (
                  <TableCell key={`distribuciones-${mes.año}-${mes.mes}`} className="text-center"></TableCell>
                ))}
                <TableCell className="text-center"></TableCell>
                <TableCell className="text-center"></TableCell>
              </TableRow>

              {Array.from(todasLasCuentas)
                .filter((cuenta) => resumen.some((mes) => mes.distribuciones[cuenta] !== undefined))
                .map((cuenta) => (
                  <TableRow suppressHydrationWarning key={`distribucion-${cuenta}`}>
                    <TableCell className="pl-4">{cuenta}</TableCell>
                    {resumen.map((mes) => {
                      const valor = mes.distribuciones[cuenta]
                      return (
                        <TableCell key={`${cuenta}-${mes.año}-${mes.mes}`} className="text-center">
                          {valor !== undefined ? (
                            <span className={getColorClass(valor)}>{formatNumber(valor, mostrarDecimales)}</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center bg-blue-50">
                      {(() => {
                        const total = resumen.reduce((sum, mes) => sum + (mes.distribuciones[cuenta] || 0), 0)
                        return <span className={getColorClass(total)}>{formatNumber(total, mostrarDecimales)}</span>
                      })()}
                    </TableCell>
                    <TableCell className="text-center bg-green-50">
                      {(() => {
                        const promedio =
                          resumen.reduce((sum, mes) => sum + (mes.distribuciones[cuenta] || 0), 0) / resumen.length
                        return (
                          <span className={getColorClass(promedio)}>{formatNumber(promedio, mostrarDecimales)}</span>
                        )
                      })()}
                    </TableCell>
                  </TableRow>
                ))}

              <TableRow suppressHydrationWarning className="font-semibold bg-purple-100">
                <TableCell>Subtotal Distribuciones</TableCell>
                {resumen.map((mes) => (
                  <TableCell key={`subtotal-distribuciones-${mes.año}-${mes.mes}`} className="text-center">
                    <span className={getColorClass(mes.totalDistribuciones)}>
                      {formatNumber(mes.totalDistribuciones, mostrarDecimales)}
                    </span>
                  </TableCell>
                ))}
                <TableCell className="text-center bg-blue-50">
                  <span className={getColorClass(totalesPeriodo.distribuciones)}>
                    {formatNumber(totalesPeriodo.distribuciones, mostrarDecimales)}
                  </span>
                </TableCell>
                <TableCell className="text-center bg-green-50">
                  <span className={getColorClass(promedios.distribuciones)}>
                    {formatNumber(promedios.distribuciones, mostrarDecimales)}
                  </span>
                </TableCell>
              </TableRow>

              {/* CÁLCULOS FINALES */}
              <TableRow suppressHydrationWarning className="font-semibold bg-blue-100 border-t-2">
                <TableCell>Ingresos - Egresos</TableCell>
                {resumen.map((mes) => {
                  // FIX: Cálculo correcto para "Ingresos - Egresos"
                  // Como los egresos están negativos, necesitamos sumarlos (restar el negativo)
                  const valor = mes.totalIngresos + mes.totalEgresos
                  return (
                    <TableCell key={`ing-egr-${mes.año}-${mes.mes}`} className="text-center">
                      <span className={getColorClass(valor)}>{formatNumber(valor, mostrarDecimales)}</span>
                    </TableCell>
                  )
                })}
                <TableCell className="text-center bg-blue-50">
                  {(() => {
                    const valor = totalesPeriodo.ingresos + totalesPeriodo.egresos
                    return <span className={getColorClass(valor)}>{formatNumber(valor, mostrarDecimales)}</span>
                  })()}
                </TableCell>
                <TableCell className="text-center bg-green-50">
                  {(() => {
                    const valor = promedios.ingresos + promedios.egresos
                    return <span className={getColorClass(valor)}>{formatNumber(valor, mostrarDecimales)}</span>
                  })()}
                </TableCell>
              </TableRow>

              <TableRow suppressHydrationWarning className="font-semibold bg-gray-100">
                <TableCell>Saldo Total</TableCell>
                {resumen.map((mes) => (
                  <TableCell key={`saldo-${mes.año}-${mes.mes}`} className="text-center">
                    <span className={getColorClass(mes.saldoMensual)}>
                      {formatNumber(mes.saldoMensual, mostrarDecimales)}
                    </span>
                  </TableCell>
                ))}
                <TableCell className="text-center bg-blue-50">
                  <span className={getColorClass(totalesPeriodo.saldo)}>
                    {formatNumber(totalesPeriodo.saldo, mostrarDecimales)}
                  </span>
                </TableCell>
                <TableCell className="text-center bg-green-50">
                  <span className={getColorClass(promedios.saldo)}>
                    {formatNumber(promedios.saldo, mostrarDecimales)}
                  </span>
                </TableCell>
              </TableRow>

              <TableRow suppressHydrationWarning className="font-semibold bg-gray-200">
                <TableCell>Saldo Acumulado</TableCell>
                {resumen.map((mes) => {
                  saldoAcumulado += mes.saldoMensual
                  return (
                    <TableCell key={`acum-${mes.año}-${mes.mes}`} className="text-center">
                      <span className={getColorClass(saldoAcumulado)}>
                        {formatNumber(saldoAcumulado, mostrarDecimales)}
                      </span>
                    </TableCell>
                  )
                })}
                <TableCell className="text-center bg-blue-50">
                  <span className={getColorClass(saldoAcumulado)}>
                    {formatNumber(saldoAcumulado, mostrarDecimales)}
                  </span>
                </TableCell>
                <TableCell className="text-center bg-green-50">-</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
