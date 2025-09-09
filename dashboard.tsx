"use client"

import { useState } from "react"
import { FiltrosFinancieros } from "./components/filtros-financieros"
import { TablaResumenFinanciero } from "./components/tabla-resumen-financiero"
import { ImportadorExcel } from "./components/importador-excel"
import { CorrectorCategorias } from "./components/corrector-categorias"
import { CorrectorInterno } from "./components/corrector-interno"
import { ReporteDetallado } from "./components/reporte-detallado"
import { useFinancialData } from "./hooks/useFinancialData"
import { useDistribucionSociosData } from "./hooks/useDistribucionSociosData"
import { TablaDistribucionSocios } from "./components/tabla-distribucion-socios"
import { VistaEgresos } from "./components/vista-egresos"
import { WizardTemplatesEgresos } from "./components/wizard-templates-egresos"
import { VistaCashFlow } from "./components/vista-cash-flow"
import { VistaExtractoBancario } from "./components/vista-extracto-bancario"
import { VistaPrincipal } from "./components/vista-principal"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Loader2, BarChart3, Upload, Users, Settings, UserCheck, FileText, Receipt, Calendar, TrendingUp, Banknote, Home } from "lucide-react"

interface ControlPresupuestarioProps {
  userRole?: 'admin' | 'contable'
}

export default function ControlPresupuestario({ userRole = 'admin' }: ControlPresupuestarioProps) {
  // Obtener el año actual dinámicamente
  const añoActual = new Date().getFullYear()

  const [año, setAño] = useState(añoActual)
  const [semestre, setSemestre] = useState<number | undefined>(undefined)
  const [mostrarDecimales, setMostrarDecimales] = useState(true)

  const [showCategorias, setShowCategorias] = useState(false)
  const [showInterno, setShowInterno] = useState(false)

  const { resumen, loading } = useFinancialData(año, semestre)
  const { resumenPorSeccion, estadisticas, loading: loadingDistribucion } = useDistribucionSociosData(año, semestre)

  // Función para determinar si mostrar una pestaña según el rol
  const shouldShowTab = (tabName: string): boolean => {
    if (userRole === 'admin') return true
    if (userRole === 'contable') return tabName === 'egresos'
    return false
  }

  // Determinar valor por defecto del tab según rol
  const getDefaultTab = (): string => {
    if (userRole === 'admin') return 'principal'
    if (userRole === 'contable') return 'egresos'
    return 'principal'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* pestañas principales */}
        <Tabs defaultValue={getDefaultTab()} className="w-full">
          <TabsList className={`grid w-full ${userRole === 'contable' ? 'grid-cols-1' : 'grid-cols-8'}`}>
            {shouldShowTab('principal') && (
              <TabsTrigger value="principal" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Principal
              </TabsTrigger>
            )}
            {shouldShowTab('dashboard') && (
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
            )}
            {shouldShowTab('distribucion') && (
              <TabsTrigger value="distribucion" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Distribución Socios
              </TabsTrigger>
            )}
            {shouldShowTab('reporte') && (
              <TabsTrigger value="reporte" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Reporte Detallado
              </TabsTrigger>
            )}
            {shouldShowTab('egresos') && (
              <TabsTrigger value="egresos" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Egresos
              </TabsTrigger>
            )}
            {shouldShowTab('cashflow') && (
              <TabsTrigger value="cashflow" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Cash Flow
              </TabsTrigger>
            )}
            {shouldShowTab('extracto') && (
              <TabsTrigger value="extracto" className="flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Extracto Bancario
              </TabsTrigger>
            )}
            {shouldShowTab('importar') && (
              <TabsTrigger value="importar" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Importar Excel
              </TabsTrigger>
            )}
          </TabsList>

          {/* VISTA PRINCIPAL */}
          <TabsContent value="principal" className="space-y-6">
            <VistaPrincipal />
          </TabsContent>

          {/* DASHBOARD */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="flex items-center justify-between">
              <FiltrosFinancieros
                año={año}
                semestre={semestre}
                mostrarDecimales={mostrarDecimales}
                onAñoChange={setAño}
                onSemestreChange={setSemestre}
                onMostrarDecimalesChange={setMostrarDecimales}
              />

              {/* Botón para mostrar/ocultar Corrector Categorías */}
              <Button variant="secondary" className="shrink-0" onClick={() => setShowCategorias(!showCategorias)}>
                <Settings className="mr-2 h-4 w-4" />
                {showCategorias ? "Ocultar" : "Corregir categorías"}
              </Button>
            </div>

            {loading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                  <span>Cargando datos financieros…</span>
                </CardContent>
              </Card>
            ) : (
              <TablaResumenFinanciero resumen={resumen} mostrarDecimales={mostrarDecimales} />
            )}

            {showCategorias && <CorrectorCategorias />}
          </TabsContent>

          {/* DISTRIBUCIÓN */}
          <TabsContent value="distribucion" className="space-y-6">
            <div className="flex items-center justify-between">
              <FiltrosFinancieros
                año={año}
                semestre={semestre}
                mostrarDecimales={mostrarDecimales}
                onAñoChange={setAño}
                onSemestreChange={setSemestre}
                onMostrarDecimalesChange={setMostrarDecimales}
              />

              {/* Botón para mostrar/ocultar Corrector Interno */}
              <Button variant="secondary" className="shrink-0" onClick={() => setShowInterno(!showInterno)}>
                <UserCheck className="mr-2 h-4 w-4" />
                {showInterno ? "Ocultar" : "Corregir interno"}
              </Button>
            </div>

            {loadingDistribucion ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                  <span>Cargando datos de distribución…</span>
                </CardContent>
              </Card>
            ) : (
              <TablaDistribucionSocios
                resumenPorSeccion={resumenPorSeccion}
                estadisticas={estadisticas}
                mostrarDecimales={mostrarDecimales}
              />
            )}

            {showInterno && <CorrectorInterno />}
          </TabsContent>

          {/* REPORTE DETALLADO */}
          <TabsContent value="reporte" className="space-y-6">
            <FiltrosFinancieros
              año={año}
              semestre={semestre}
              mostrarDecimales={mostrarDecimales}
              onAñoChange={setAño}
              onSemestreChange={setSemestre}
              onMostrarDecimalesChange={setMostrarDecimales}
            />

            <ReporteDetallado año={año} semestre={semestre} mostrarDecimales={mostrarDecimales} />
          </TabsContent>

          {/* EGRESOS */}
          <TabsContent value="egresos" className="space-y-6">
            <VistaEgresos />
          </TabsContent>

          {/* CASH FLOW */}
          <TabsContent value="cashflow" className="space-y-6">
            <VistaCashFlow />
          </TabsContent>

          {/* EXTRACTO BANCARIO */}
          <TabsContent value="extracto" className="space-y-6">
            <VistaExtractoBancario />
          </TabsContent>

          {/* IMPORTAR */}
          <TabsContent value="importar" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ImportadorExcel />

              <Card>
                <CardHeader>
                  <CardTitle>Información del Importador</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="mb-2 font-semibold">Proceso de importación:</h4>
                    <ol className="list-inside list-decimal space-y-1 text-sm text-gray-600">
                      <li>Se lee el archivo Excel MSA Galicia</li>
                      <li>Se invierten las filas tal como vienen</li>
                      <li>Se filtran movimientos de hoy y anteriores</li>
                      <li>Se calcula orden_banco incremental</li>
                      <li>Se calcula control para validación</li>
                      <li>Se insertan los movimientos válidos</li>
                    </ol>
                  </div>

                  <div>
                    <h4 className="mb-2 font-semibold">Validaciones:</h4>
                    <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
                      <li>Conversión de números argentinos (coma decimal)</li>
                      <li>Números entre paréntesis = negativos</li>
                      <li>Control ≠ 0 genera advertencias</li>
                      <li>Fechas duplicadas se omiten</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Información general del sistema */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 text-sm text-gray-600 md:grid-cols-2">
              <div>
                <h4 className="mb-2 font-semibold">Funcionalidades:</h4>
                <ul className="space-y-1">
                  <li>• Resumen financiero mensual agrupado por tipo</li>
                  <li>• Filtros por año y semestre</li>
                  <li>• Formato numérico argentino</li>
                  <li>• Importación automática desde Excel</li>
                  <li>• Corrección de categorías inválidas</li>
                  <li>• Corrección de valores internos</li>
                  <li>• Reportes detallados línea por línea</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-2 font-semibold">Próximas mejoras:</h4>
                <ul className="space-y-1">
                  <li>• Exportación de reportes</li>
                  <li>• Gráficos interactivos</li>
                  <li>• Comparativas entre períodos</li>
                  <li>• Validaciones avanzadas</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
