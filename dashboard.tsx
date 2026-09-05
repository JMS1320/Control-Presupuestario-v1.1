"use client"

import { useState } from "react"
import { FiltrosFinancieros } from "./components/filtros-financieros"
import { TablaResumenFinanciero } from "./components/tabla-resumen-financiero"
import { ImportadorExcel } from "./components/importador-excel"
import { ImportadorHistorico } from "./components/importador-historico"
import { CorrectorCategorias } from "./components/corrector-categorias"
import { CorrectorInterno } from "./components/corrector-interno"
import { ReporteDetallado } from "./components/reporte-detallado"
import { useFinancialData } from "./hooks/useFinancialData"
import { useDistribucionSociosData } from "./hooks/useDistribucionSociosData"
import { TablaDistribucionSocios } from "./components/tabla-distribucion-socios"
import { VistaEgresos } from "./components/vista-egresos"
import { VistaIngresos } from "./components/vista-ingresos"
import { WizardTemplatesEgresos } from "./components/wizard-templates-egresos"
import { VistaCashFlow } from "./components/vista-cash-flow"
import { VistaExtractoBancario } from "./components/vista-extracto-bancario"
import { VistaPrincipal } from "./components/vista-principal"
import { usePendientesPorPantalla } from "./hooks/usePendientesPorPantalla"
import { VistaSectorProductivo } from "./components/vista-sector-productivo"
import { TabSueldos } from "./components/tab-sueldos"
import { TabPresupuesto } from "./components/tab-presupuesto"
import { ConfiguradorPreciosTC } from "./components/configurador-precios-tc"
import { ConfiguradorActividades } from "./components/configurador-actividades"
import { ConfiguradorCampos } from "./components/configurador-campos"
import { ConfiguradorVariables } from "./components/configurador-variables"
import { ConfiguradorInversiones } from "./components/configurador-inversiones"
import { ConfiguradorSueldosPresupuesto } from "./components/configurador-sueldos-presupuesto"
import { ConfiguradorIngresosActividad } from "./components/configurador-ingresos-actividad"
import { PanelMargen } from "./components/panel-margen"
import { PanelPresupuestoCuentas } from "./components/panel-presupuesto-cuentas"
import { PanelControlProveedores } from "./components/panel-control-proveedores"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { LayoutApp, SOLAPAS } from "@/components/layout-app"
import { NotasParaClaude } from "@/components/notas-para-claude"
import { BarraSesion } from "@/components/barra-sesion"
import { Menu, Loader2, BarChart3, Upload, Users, Settings, UserCheck, FileText, Receipt, Calendar, TrendingUp, Banknote, Home, Tractor, Landmark, PieChart, ArrowUpRight, DollarSign, Sprout, BookOpen, MapPin, Calculator, Hammer, PieChart as PieIcon, Scale as ScaleIcon } from "lucide-react"

interface ControlPresupuestarioProps {
  userRole?: 'admin' | 'contable'
  /** Sección a abrir, si vino por `?seccion=` — así el menú lateral funciona desde otras rutas. */
  seccionInicial?: string
  /** Ids de las secciones que ve este usuario, de `public.roles`. */
  secciones?: string[]
}

export default function ControlPresupuestario({ userRole = 'admin', seccionInicial, secciones }: ControlPresupuestarioProps) {
  // Cuántos pendientes vivos tiene cada solapa (P-46 etapa 4). Sólo admin: el endpoint lo exige
  // y el contable no trabaja los pendientes de desarrollo.
  const pendientesPorPantalla = usePendientesPorPantalla(userRole === 'admin')

  /**
   * El número al lado del nombre de la solapa: cuántos pendientes vivos tiene.
   *
   * El COLOR es proporcional a los urgentes, no binario. Con "rojo si hay ≥1 urgente" quedaban
   * **10 de 12 solapas en rojo** — y un indicador encendido en todos lados deja de comunicar.
   * Con tramos, el rojo señala dónde está el bulto de verdad (hoy: extracto, con 18).
   *
   * Devuelve null si no hay nada o si el fetch falló — la navegación no depende de esto.
   */
  const badgePendientes = (pantalla: string) => {
    const c = pendientesPorPantalla[pantalla]
    if (!c || c.total === 0) return null
    const color = c.urgentes >= 5 ? 'bg-red-100 text-red-700'
      : c.urgentes > 0 ? 'bg-amber-100 text-amber-700'
      : 'bg-gray-200 text-gray-600'
    return (
      <span
        // Fuera del contexto que capturan las notas: vive DENTRO del TabsTrigger, así que sin esto
        // el `textContent` de la solapa es «Sueldos11» en vez de «Sueldos» — y la pantalla deja de
        // servir para agrupar, porque cambia de nombre cada vez que cambia el contador.
        data-nota-ignorar
        title={`${c.total} pendiente(s)${c.urgentes ? ` · ${c.urgentes} urgente(s)` : ''} — se ven en Principal → Pendientes`}
        className={`ml-1 rounded-full px-1.5 text-[10px] leading-4 ${color}`}
      >
        {c.total}
      </span>
    )
  }

  // Obtener el año actual dinámicamente
  const añoActual = new Date().getFullYear()

  const [año, setAño] = useState(añoActual)
  const [semestre, setSemestre] = useState<number | undefined>(undefined)
  const [mostrarDecimales, setMostrarDecimales] = useState(true)

  const [showCategorias, setShowCategorias] = useState(false)
  const [showInterno, setShowInterno] = useState(false)
  const [showPreciosTC, setShowPreciosTC] = useState(false)
  const [showActividades, setShowActividades] = useState(false)
  const [showCampos, setShowCampos] = useState(false)
  const [showVariables, setShowVariables] = useState(false)
  const [showInversiones, setShowInversiones] = useState(false)
  const [showSueldosPre, setShowSueldosPre] = useState(false)
  const [showIngresosAct, setShowIngresosAct] = useState(false)
  const [showMargen, setShowMargen] = useState(false)
  const [showCuentas, setShowCuentas] = useState(false)
  /** Sube de a uno cuando el panel de cuentas cambia algo, para que la grilla del presupuesto
   *  vuelva a leer. Son componentes hermanos: sin esto había que salir y entrar a la pestaña. */
  const [tokenPresupuesto, setTokenPresupuesto] = useState(0)
  const [showProveedores, setShowProveedores] = useState(false)

  const { resumen, loading } = useFinancialData(año, semestre)
  const { resumenPorSeccion, estadisticas, loading: loadingDistribucion } = useDistribucionSociosData(año, semestre)

  /**
   * ¿Este usuario ve esta sección? Sale de `public.roles` (prop `secciones`); si la tabla todavía
   * no existe, del reparto de siempre.
   */
  const permitidas = new Set<string>(
    secciones ?? SOLAPAS.filter((s) => userRole === 'admin' || s.id === 'egresos').map((s) => s.id)
  )
  const shouldShowTab = (tabName: string): boolean => permitidas.has(tabName)

  /** La primera sección que ve este usuario. Si no ve ninguna, no hay a dónde ir. */
  const getDefaultTab = (): string =>
    SOLAPAS.find((s) => permitidas.has(s.id))?.id ?? 'principal' 

  /** Qué sección se está viendo. Pasó a ser estado controlado porque ahora la navegación la maneja
   *  el menú lateral, que vive fuera del `<Tabs>` y no puede usar `defaultValue`. */
  const [tab, setTab] = useState<string>(
    // ⚠️ Se valida contra las secciones PERMITIDAS, no sólo contra las que existen: si no,
    // un `contable` entraba a `/?seccion=sueldos` escribiéndolo a mano y veía Sueldos.
    seccionInicial && permitidas.has(seccionInicial) ? seccionInicial : getDefaultTab()
  )

  /** Cambiar de sección tampoco puede saltarse el permiso. */
  const irA = (id: string) => { if (permitidas.has(id)) setTab(id) }

  return (
    <LayoutApp userRole={userRole} secciones={[...permitidas]} seccionActiva={tab} onElegirSeccion={irA}>
      {/* 📝 Notas para Claude (P-34). A nivel app, fuera de las pestañas: la idea o el bug
          aparecen donde aparecen, y la nota tiene que poder empezar ahí mismo — incluso siguiendo
          entre pestañas, porque una nota es una grabación de varias capturas, no un evento. */}
      <NotasParaClaude />
        <Tabs value={tab} onValueChange={irA} className="w-full">
          {/* ⚠️ Montado pero INVISIBLE, no borrado: `notas-para-claude.tsx:114` averigua en qué
              pantalla estás con `document.querySelector('[role="tab"][data-state="active"]')`. Si
              se saca, cada nota se guarda con `pantalla: ""` y P-34 deja de agrupar. La navegación
              visible es el menú lateral; esto queda como fuente de ese dato y para lectores de
              pantalla. */}
          <TabsList className="sr-only">
            {shouldShowTab('principal') && (
              <TabsTrigger value="principal" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Principal
                {badgePendientes("principal")}
              </TabsTrigger>
            )}
            {shouldShowTab('dashboard') && (
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Dashboard
                {badgePendientes("dashboard")}
              </TabsTrigger>
            )}
            {shouldShowTab('distribucion') && (
              <TabsTrigger value="distribucion" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Distribución Socios
                {badgePendientes("distribucion")}
              </TabsTrigger>
            )}
            {shouldShowTab('reporte') && (
              <TabsTrigger value="reporte" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Reporte Detallado
                {badgePendientes("reporte")}
              </TabsTrigger>
            )}
            {shouldShowTab('egresos') && (
              <TabsTrigger value="egresos" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Egresos
                {badgePendientes("egresos")}
              </TabsTrigger>
            )}
            {shouldShowTab('ingresos') && (
              <TabsTrigger value="ingresos" className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4" />
                Ingresos
                {badgePendientes("ingresos")}
              </TabsTrigger>
            )}
            {shouldShowTab('cashflow') && (
              <TabsTrigger value="cashflow" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Cash Flow
                {badgePendientes("cashflow")}
              </TabsTrigger>
            )}
            {shouldShowTab('extracto') && (
              <TabsTrigger value="extracto" className="flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Extracto Bancario
                {badgePendientes("extracto")}
              </TabsTrigger>
            )}
            {shouldShowTab('productivo') && (
              <TabsTrigger value="productivo" className="flex items-center gap-2">
                <Tractor className="h-4 w-4" />
                Productivo
                {badgePendientes("productivo")}
              </TabsTrigger>
            )}
            {shouldShowTab('sueldos') && (
              <TabsTrigger value="sueldos" className="flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                Sueldos
                {badgePendientes("sueldos")}
              </TabsTrigger>
            )}
            {shouldShowTab('presupuesto') && (
              <TabsTrigger value="presupuesto" className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Presupuesto
                {badgePendientes("presupuesto")}
              </TabsTrigger>
            )}
            {shouldShowTab('importar') && (
              <TabsTrigger value="importar" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Importar Excel
                {badgePendientes("importar")}
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

            {showCategorias && <div className="entrada-suave"><CorrectorCategorias /></div>}
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

            {showInterno && <div className="entrada-suave"><CorrectorInterno /></div>}
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
            <VistaEgresos userRole={userRole} />
          </TabsContent>

          {/* INGRESOS */}
          <TabsContent value="ingresos" className="space-y-6">
            <VistaIngresos userRole={userRole} />
          </TabsContent>

          {/* CASH FLOW */}
          <TabsContent value="cashflow" className="space-y-6">
            <VistaCashFlow userRole={userRole} />
          </TabsContent>

          {/* EXTRACTO BANCARIO */}
          <TabsContent value="extracto" className="space-y-6">
            <VistaExtractoBancario />
          </TabsContent>

          {/* SECTOR PRODUCTIVO */}
          <TabsContent value="productivo" className="space-y-6">
            <VistaSectorProductivo />
          </TabsContent>

          {/* SUELDOS */}
          <TabsContent value="sueldos" className="space-y-6">
            <TabSueldos />
          </TabsContent>

          {/* PRESUPUESTO */}
          <TabsContent value="presupuesto" className="space-y-6">
            <div className="flex justify-end gap-2">
              <Button variant="secondary" className="shrink-0" onClick={() => setShowProveedores(!showProveedores)}>
                <TrendingUp className="mr-2 h-4 w-4" />
                {showProveedores ? "Ocultar proveedores" : "Subas de proveedores"}
              </Button>
              <Button variant="secondary" className="shrink-0" onClick={() => setShowCuentas(!showCuentas)}>
                <BookOpen className="mr-2 h-4 w-4" />
                {showCuentas ? "Ocultar cuentas" : "Cuentas contables"}
              </Button>
              <Button variant="secondary" className="shrink-0" onClick={() => setShowActividades(!showActividades)}>
                <Sprout className="mr-2 h-4 w-4" />
                {showActividades ? "Ocultar actividades" : "Actividades y costos"}
              </Button>
              <Button variant="secondary" className="shrink-0" onClick={() => setShowCampos(!showCampos)}>
                <MapPin className="mr-2 h-4 w-4" />
                {showCampos ? "Ocultar campos" : "Campos y hectáreas"}
              </Button>
              <Button variant="secondary" className="shrink-0" onClick={() => setShowVariables(!showVariables)}>
                <Calculator className="mr-2 h-4 w-4" />
                {showVariables ? "Ocultar variables" : "Variables de costo"}
              </Button>
              <Button variant="secondary" className="shrink-0" onClick={() => setShowInversiones(!showInversiones)}>
                <Hammer className="mr-2 h-4 w-4" />
                {showInversiones ? "Ocultar inversiones" : "Inversiones"}
              </Button>
              <Button variant="secondary" className="shrink-0" onClick={() => setShowSueldosPre(!showSueldosPre)}>
                <Users className="mr-2 h-4 w-4" />
                {showSueldosPre ? "Ocultar sueldos" : "Sueldos del presupuesto"}
              </Button>
              <Button variant="secondary" className="shrink-0" onClick={() => setShowIngresosAct(!showIngresosAct)}>
                <PieIcon className="mr-2 h-4 w-4" />
                {showIngresosAct ? "Ocultar ingresos" : "Ingresos por actividad"}
              </Button>
              <Button variant="secondary" className="shrink-0" onClick={() => setShowMargen(!showMargen)}>
                <ScaleIcon className="mr-2 h-4 w-4" />
                {showMargen ? "Ocultar margen" : "Margen por actividad"}
              </Button>
              <Button variant="secondary" className="shrink-0" onClick={() => setShowPreciosTC(!showPreciosTC)}>
                <DollarSign className="mr-2 h-4 w-4" />
                {showPreciosTC ? "Ocultar precios y TC" : "Precios y TC"}
              </Button>
            </div>

            {/* Los `<div className="entrada-suave">` son sólo para la animación de entrada: estos
                paneles aparecen y desaparecen de golpe y reacomodan la página entera. La clase está
                en `app/globals.css` (transición + `@starting-style`). El wrapper existe porque los
                paneles no reenvían `className`; si alguno empieza a hacerlo, se le pasa directo. */}
            {showPreciosTC && <div className="entrada-suave"><ConfiguradorPreciosTC onCambio={() => setTokenPresupuesto(t => t + 1)} /></div>}
            {showActividades && <div className="entrada-suave"><ConfiguradorActividades /></div>}
            {showCampos && <div className="entrada-suave"><ConfiguradorCampos onCambio={() => setTokenPresupuesto(t => t + 1)} /></div>}
            {showVariables && <div className="entrada-suave"><ConfiguradorVariables onCambio={() => setTokenPresupuesto(t => t + 1)} /></div>}
            {showInversiones && <div className="entrada-suave"><ConfiguradorInversiones onCambio={() => setTokenPresupuesto(t => t + 1)} /></div>}
            {showSueldosPre && <div className="entrada-suave"><ConfiguradorSueldosPresupuesto onCambio={() => setTokenPresupuesto(t => t + 1)} /></div>}
            {showIngresosAct && <div className="entrada-suave"><ConfiguradorIngresosActividad onCambio={() => setTokenPresupuesto(t => t + 1)} /></div>}
            {showMargen && (
              <div className="entrada-suave">
                <PanelMargen recargarToken={tokenPresupuesto}
                  onCargarPrecio={() => { setShowPreciosTC(true); setShowMargen(true) }} />
              </div>
            )}
            {showCuentas && <div className="entrada-suave"><PanelPresupuestoCuentas onCambio={() => setTokenPresupuesto(t => t + 1)} /></div>}
            {showProveedores && <div className="entrada-suave"><PanelControlProveedores /></div>}

            <TabPresupuesto recargarToken={tokenPresupuesto} />
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

            {/* Importador comprobantes históricos */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ImportadorHistorico />
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
    </LayoutApp>
  )
}
