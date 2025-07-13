"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ChevronDown, ChevronRight, Download } from "lucide-react"
import { formatNumber } from "@/lib/format"
import { useReporteDetallado } from "@/hooks/useReporteDetallado"
import { exportarReporteDetallado } from "@/lib/excel-export"

interface ReporteDetalladoProps {
  año: number
  semestre?: number
  mostrarDecimales: boolean
}

export function ReporteDetallado({ año, semestre, mostrarDecimales }: ReporteDetalladoProps) {
  const [tipoReporte, setTipoReporte] = useState<"distribucion" | "cuentas">("distribucion")
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Set<string>>(new Set())
  const [exportando, setExportando] = useState(false)

  const { reporteDistribucion, reporteCuentas, loading } = useReporteDetallado(año, semestre)

  const toggleSeccion = (seccion: string) => {
    const nuevasAbiertas = new Set(seccionesAbiertas)
    if (nuevasAbiertas.has(seccion)) {
      nuevasAbiertas.delete(seccion)
    } else {
      nuevasAbiertas.add(seccion)
    }
    setSeccionesAbiertas(nuevasAbiertas)
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString("es-AR")
  }

  const getColorClass = (value: number) => {
    if (value > 0) return "text-green-600"
    if (value < 0) return "text-red-600"
    return ""
  }

  const handleExportar = async () => {
    setExportando(true)
    try {
      if (tipoReporte === "distribucion") {
        await exportarReporteDetallado(reporteDistribucion, "distribucion", año, semestre, mostrarDecimales)
      } else {
        await exportarReporteDetallado(reporteCuentas, "cuentas", año, semestre, mostrarDecimales)
      }
    } catch (error) {
      console.error("Error al exportar:", error)
      alert("Error al exportar el reporte")
    } finally {
      setExportando(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-8 w-8 animate-spin" />
          <span>Cargando reporte detallado...</span>
        </CardContent>
      </Card>
    )
  }

  const hayDatos = tipoReporte === "distribucion" ? reporteDistribucion.length > 0 : reporteCuentas.length > 0

  return (
    <div className="space-y-6">
      {/* Configuración del reporte */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Configuración del Reporte</CardTitle>
            {hayDatos && (
              <Button onClick={handleExportar} disabled={exportando} className="flex items-center gap-2">
                {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exportando ? "Exportando..." : "Exportar a Excel"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Reporte</label>
              <Select value={tipoReporte} onValueChange={(value: "distribucion" | "cuentas") => setTipoReporte(value)}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="distribucion">Distribución Socios</SelectItem>
                  <SelectItem value="cuentas">Cuentas Contables General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reporte de Distribución de Socios */}
      {tipoReporte === "distribucion" && (
        <div className="space-y-4">
          {reporteDistribucion.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No hay datos de distribución para el período seleccionado</p>
              </CardContent>
            </Card>
          ) : (
            reporteDistribucion.map((concepto) => (
              <Card key={concepto.concepto}>
                <Collapsible
                  open={seccionesAbiertas.has(concepto.concepto)}
                  onOpenChange={() => toggleSeccion(concepto.concepto)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {seccionesAbiertas.has(concepto.concepto) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <CardTitle className="text-lg">{concepto.concepto}</CardTitle>
                          <Badge variant="secondary">{concepto.movimientos.length} movimientos</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-green-600">
                            Créditos: {formatNumber(concepto.totalCreditos, mostrarDecimales)}
                          </span>
                          <span className="text-red-600">
                            Débitos: {formatNumber(concepto.totalDebitos, mostrarDecimales)}
                          </span>
                          <span className={`font-semibold ${getColorClass(concepto.totalNeto)}`}>
                            Neto: {formatNumber(concepto.totalNeto, mostrarDecimales)}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Detalle</TableHead>
                              <TableHead className="text-right">Crédito</TableHead>
                              <TableHead className="text-right">Débito</TableHead>
                              <TableHead className="text-right">Neto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {concepto.movimientos.map((mov) => (
                              <TableRow key={mov.id}>
                                <TableCell className="font-mono text-sm">{formatearFecha(mov.fecha)}</TableCell>
                                <TableCell className="max-w-md truncate" title={mov.detalle}>
                                  {mov.detalle}
                                </TableCell>
                                <TableCell className="text-right">
                                  {mov.creditos > 0 ? (
                                    <span className="text-green-600">
                                      {formatNumber(mov.creditos, mostrarDecimales)}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {mov.debitos > 0 ? (
                                    <span className="text-red-600">{formatNumber(mov.debitos, mostrarDecimales)}</span>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={getColorClass(mov.neto)}>
                                    {formatNumber(mov.neto, mostrarDecimales)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Reporte de Cuentas Contables */}
      {tipoReporte === "cuentas" && (
        <div className="space-y-4">
          {reporteCuentas.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No hay datos de cuentas contables para el período seleccionado</p>
              </CardContent>
            </Card>
          ) : (
            reporteCuentas.map((tipo) => (
              <Card key={tipo.tipo}>
                <CardHeader>
                  <CardTitle className="text-xl capitalize">{tipo.tipo}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tipo.cuentas.map((cuenta) => (
                    <Card key={cuenta.cuenta} className="border-l-4 border-l-blue-500">
                      <Collapsible
                        open={seccionesAbiertas.has(`${tipo.tipo}-${cuenta.cuenta}`)}
                        onOpenChange={() => toggleSeccion(`${tipo.tipo}-${cuenta.cuenta}`)}
                      >
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-muted/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {seccionesAbiertas.has(`${tipo.tipo}-${cuenta.cuenta}`) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <CardTitle className="text-base">{cuenta.cuenta}</CardTitle>
                                <Badge variant="outline">{cuenta.movimientos.length} movimientos</Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-green-600">
                                  Créditos: {formatNumber(cuenta.totalCreditos, mostrarDecimales)}
                                </span>
                                <span className="text-red-600">
                                  Débitos: {formatNumber(cuenta.totalDebitos, mostrarDecimales)}
                                </span>
                                <span className={`font-semibold ${getColorClass(cuenta.totalNeto)}`}>
                                  Neto: {formatNumber(cuenta.totalNeto, mostrarDecimales)}
                                </span>
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Detalle</TableHead>
                                    <TableHead className="text-right">Crédito</TableHead>
                                    <TableHead className="text-right">Débito</TableHead>
                                    <TableHead className="text-right">Neto</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {cuenta.movimientos.map((mov) => (
                                    <TableRow key={mov.id}>
                                      <TableCell className="font-mono text-sm">{formatearFecha(mov.fecha)}</TableCell>
                                      <TableCell className="max-w-md truncate" title={mov.detalle}>
                                        {mov.detalle}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {mov.creditos > 0 ? (
                                          <span className="text-green-600">
                                            {formatNumber(mov.creditos, mostrarDecimales)}
                                          </span>
                                        ) : (
                                          "-"
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {mov.debitos > 0 ? (
                                          <span className="text-red-600">
                                            {formatNumber(mov.debitos, mostrarDecimales)}
                                          </span>
                                        ) : (
                                          "-"
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <span className={getColorClass(mov.neto)}>
                                          {formatNumber(mov.neto, mostrarDecimales)}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
