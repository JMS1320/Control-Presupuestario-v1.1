"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Settings2, FileText, Info, Eye, EyeOff, Plus, X, Filter } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { WizardTemplatesEgresos } from "./wizard-templates-egresos"

interface CuotaEgresoSinFactura {
  id: string
  egreso_id: string
  mes: number
  fecha_estimada: string
  fecha_vencimiento: string | null
  monto: number
  descripcion: string | null
  estado: string
  created_at: string
  updated_at: string
  egreso?: {
    id: string
    template_master_id: string | null
    categ: string
    centro_costo: string | null
    nombre_referencia: string
    responsable: string | null
    cuit_quien_cobra: string | null
    nombre_quien_cobra: string | null
    tipo_recurrencia: string
    configuracion_reglas: any
    año: number
    activo: boolean
    created_at: string
    updated_at: string
  }
}

// Configuración de columnas disponibles - TODAS VISIBLES por defecto excepto algunas técnicas
const COLUMNAS_CONFIG = {
  fecha_estimada: { label: "Fecha Estimada", visible: true, width: "130px" },
  fecha_vencimiento: { label: "Fecha Vencimiento", visible: true, width: "150px" },
  mes: { label: "Mes", visible: true, width: "80px" },
  monto: { label: "Monto", visible: true, width: "130px" },
  descripcion: { label: "Descripción", visible: true, width: "200px" },
  estado: { label: "Estado", visible: true, width: "100px" },
  // Campos del egreso padre
  categ: { label: "CATEG", visible: true, width: "120px" },
  centro_costo: { label: "Centro Costo", visible: true, width: "120px" },
  nombre_referencia: { label: "Nombre Referencia", visible: true, width: "180px" },
  responsable: { label: "Responsable", visible: true, width: "150px" },
  cuit_quien_cobra: { label: "CUIT Quien Cobra", visible: true, width: "140px" },
  nombre_quien_cobra: { label: "Nombre Quien Cobra", visible: true, width: "180px" },
  tipo_recurrencia: { label: "Tipo Recurrencia", visible: true, width: "130px" },
  año: { label: "Año", visible: true, width: "80px" },
  activo: { label: "Activo", visible: true, width: "80px" },
  // Campos técnicos ocultos por defecto
  egreso_id: { label: "Egreso ID", visible: false, width: "120px" },
  template_master_id: { label: "Template Master ID", visible: false, width: "150px" },
  configuracion_reglas: { label: "Config. Reglas", visible: false, width: "150px" },
  created_at: { label: "Creado", visible: false, width: "150px" },
  updated_at: { label: "Actualizado", visible: false, width: "150px" }
} as const

export function VistaTemplatesEgresos() {
  const [cuotas, setCuotas] = useState<CuotaEgresoSinFactura[]>([])
  const [cuotasOriginales, setCuotasOriginales] = useState<CuotaEgresoSinFactura[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarWizard, setMostrarWizard] = useState(false)
  
  // Estados para filtros
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [busquedaResponsable, setBusquedaResponsable] = useState('')
  const [busquedaNombreReferencia, setBusquedaNombreReferencia] = useState('')
  const [busquedaDescripcion, setBusquedaDescripcion] = useState('')
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('')
  const [montoMinimo, setMontoMinimo] = useState('')
  const [montoMaximo, setMontoMaximo] = useState('')
  const [busquedaCateg, setBusquedaCateg] = useState('')
  const [tipoRecurrenciaSeleccionado, setTipoRecurrenciaSeleccionado] = useState('')
  const [anoSeleccionado, setAnoSeleccionado] = useState('')
  const [soloActivos, setSoloActivos] = useState(false)
  
  // Estado para columnas visibles con valores por defecto
  const [columnasVisibles, setColumnasVisibles] = useState<Record<string, boolean>>(() => {
    // Intentar cargar desde localStorage
    const saved = localStorage.getItem('templates-egresos-columnas-visibles')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // Si hay error, usar valores por defecto
      }
    }
    return Object.fromEntries(
      Object.entries(COLUMNAS_CONFIG).map(([key, config]) => [key, config.visible])
    )
  })

  // Estado para anchos de columnas personalizables con persistencia
  const [anchosColumnas, setAnchosColumnas] = useState<Record<string, string>>(() => {
    // Intentar cargar desde localStorage
    const saved = localStorage.getItem('templates-egresos-anchos-columnas')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // Si hay error, usar valores por defecto
      }
    }
    return Object.fromEntries(
      Object.entries(COLUMNAS_CONFIG).map(([key, config]) => [key, config.width])
    )
  })

  // Guardar cambios de columnas visibles en localStorage
  useEffect(() => {
    localStorage.setItem('templates-egresos-columnas-visibles', JSON.stringify(columnasVisibles))
  }, [columnasVisibles])

  // Guardar cambios de anchos en localStorage
  useEffect(() => {
    localStorage.setItem('templates-egresos-anchos-columnas', JSON.stringify(anchosColumnas))
  }, [anchosColumnas])

  // Cargar cuotas de egresos sin factura desde Supabase
  const cargarCuotas = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error: supabaseError } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select(`
          *,
          egreso:egresos_sin_factura(*)
        `)
        .order('fecha_estimada', { ascending: false })

      if (supabaseError) {
        console.error('Error al cargar cuotas:', supabaseError)
        setError(`Error al cargar cuotas: ${supabaseError.message}`)
        return
      }

      const cuotasCargadas = data || []
      setCuotas(cuotasCargadas)
      setCuotasOriginales(cuotasCargadas)
    } catch (error) {
      console.error('Error inesperado:', error)
      setError('Error inesperado al cargar las cuotas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarCuotas()
  }, [])

  // Formatear valores numéricos
  const formatearNumero = (valor: number): string => {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor)
  }

  // Formatear fecha - enfoque directo sin conversión de zona horaria
  const formatearFecha = (fecha: string): string => {
    try {
      // Si viene en formato YYYY-MM-DD, parsearlo directamente
      if (fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [año, mes, dia] = fecha.split('-').map(Number)
        const fechaLocal = new Date(año, mes - 1, dia) // mes - 1 porque Date() usa 0-11
        return format(fechaLocal, 'dd/MM/yyyy', { locale: es })
      }
      // Fallback para otros formatos
      return format(new Date(fecha), 'dd/MM/yyyy', { locale: es })
    } catch {
      return fecha
    }
  }

  // Funciones para filtros
  const aplicarFiltros = () => {
    let cuotasFiltradas = [...cuotasOriginales]
    
    // Filtro por fecha estimada
    if (fechaDesde) {
      cuotasFiltradas = cuotasFiltradas.filter(c => c.fecha_estimada >= fechaDesde)
    }
    if (fechaHasta) {
      cuotasFiltradas = cuotasFiltradas.filter(c => c.fecha_estimada <= fechaHasta)
    }
    
    // Filtro por responsable
    if (busquedaResponsable.trim()) {
      const busqueda = busquedaResponsable.toLowerCase()
      cuotasFiltradas = cuotasFiltradas.filter(c => 
        c.egreso?.responsable?.toLowerCase().includes(busqueda)
      )
    }
    
    // Filtro por nombre de referencia
    if (busquedaNombreReferencia.trim()) {
      const busqueda = busquedaNombreReferencia.toLowerCase()
      cuotasFiltradas = cuotasFiltradas.filter(c => 
        c.egreso?.nombre_referencia?.toLowerCase().includes(busqueda)
      )
    }
    
    // Filtro por descripción
    if (busquedaDescripcion.trim()) {
      const busqueda = busquedaDescripcion.toLowerCase()
      cuotasFiltradas = cuotasFiltradas.filter(c => 
        c.descripcion?.toLowerCase().includes(busqueda)
      )
    }
    
    // Filtro por estado
    if (estadoSeleccionado) {
      cuotasFiltradas = cuotasFiltradas.filter(c => c.estado === estadoSeleccionado)
    }
    
    // Filtro por rango de montos
    if (montoMinimo) {
      const minimo = parseFloat(montoMinimo)
      cuotasFiltradas = cuotasFiltradas.filter(c => c.monto >= minimo)
    }
    if (montoMaximo) {
      const maximo = parseFloat(montoMaximo)
      cuotasFiltradas = cuotasFiltradas.filter(c => c.monto <= maximo)
    }
    
    // Filtro por CATEG
    if (busquedaCateg.trim()) {
      const busqueda = busquedaCateg.toLowerCase()
      cuotasFiltradas = cuotasFiltradas.filter(c => 
        c.egreso?.categ?.toLowerCase().includes(busqueda)
      )
    }
    
    // Filtro por tipo de recurrencia
    if (tipoRecurrenciaSeleccionado) {
      cuotasFiltradas = cuotasFiltradas.filter(c => 
        c.egreso?.tipo_recurrencia === tipoRecurrenciaSeleccionado
      )
    }
    
    // Filtro por año
    if (anoSeleccionado) {
      const ano = parseInt(anoSeleccionado)
      cuotasFiltradas = cuotasFiltradas.filter(c => c.egreso?.año === ano)
    }
    
    // Filtro solo activos
    if (soloActivos) {
      cuotasFiltradas = cuotasFiltradas.filter(c => c.egreso?.activo === true)
    }
    
    setCuotas(cuotasFiltradas)
  }
  
  const limpiarFiltros = () => {
    setFechaDesde('')
    setFechaHasta('')
    setBusquedaResponsable('')
    setBusquedaNombreReferencia('')
    setBusquedaDescripcion('')
    setEstadoSeleccionado('')
    setMontoMinimo('')
    setMontoMaximo('')
    setBusquedaCateg('')
    setTipoRecurrenciaSeleccionado('')
    setAnoSeleccionado('')
    setSoloActivos(false)
    setCuotas(cuotasOriginales)
  }
  
  // Obtener valores únicos para los selectores
  const estadosUnicos = [...new Set(cuotasOriginales.map(c => c.estado))].filter(Boolean).sort()
  const tiposRecurrenciaUnicos = [...new Set(cuotasOriginales.map(c => c.egreso?.tipo_recurrencia))].filter(Boolean).sort()
  const anosUnicos = [...new Set(cuotasOriginales.map(c => c.egreso?.año))].filter(Boolean).sort((a, b) => b - a)

  // Obtener columnas visibles
  const columnasVisiblesArray = Object.entries(columnasVisibles)
    .filter(([_, visible]) => visible)
    .map(([key]) => key)

  // Renderizar valor de celda según el tipo de columna
  const renderizarCelda = (cuota: CuotaEgresoSinFactura, columna: string) => {
    let valor: any

    // Obtener valor según la columna
    if (['fecha_estimada', 'fecha_vencimiento', 'mes', 'monto', 'descripcion', 'estado', 'created_at', 'updated_at', 'egreso_id'].includes(columna)) {
      valor = cuota[columna as keyof CuotaEgresoSinFactura]
    } else {
      // Campos del egreso padre
      valor = cuota.egreso?.[columna as keyof typeof cuota.egreso]
    }

    if (valor === null || valor === undefined) {
      return <span className="text-gray-400">-</span>
    }

    switch (columna) {
      case 'fecha_estimada':
      case 'fecha_vencimiento':
      case 'created_at':
      case 'updated_at':
        return formatearFecha(valor as string)
      
      case 'monto':
        return formatearNumero(valor as number)
      
      case 'estado':
        return (
          <Badge variant={valor === 'pendiente' ? 'secondary' : 'default'}>
            {valor as string}
          </Badge>
        )
      
      case 'activo':
        return (
          <Badge variant={valor ? 'default' : 'secondary'}>
            {valor ? 'Sí' : 'No'}
          </Badge>
        )
      
      case 'configuracion_reglas':
        return (
          <div className="max-w-xs truncate" title={JSON.stringify(valor)}>
            {JSON.stringify(valor)}
          </div>
        )
      
      case 'nombre_referencia':
      case 'nombre_quien_cobra':
      case 'descripcion':
        return (
          <div className="max-w-xs truncate" title={valor as string}>
            {valor as string}
          </div>
        )
      
      default:
        return String(valor)
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado con controles */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Egresos sin Factura</h2>
          <p className="text-muted-foreground">
            Cuotas y compromisos recurrentes generados desde templates
          </p>
        </div>
        
        {/* Controles */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setMostrarWizard(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Crear Template
          </Button>
          
          {/* Botón de filtros */}
          <Button 
            variant={mostrarFiltros ? "default" : "outline"}
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
          
          {/* Selector de columnas */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Settings2 className="mr-2 h-4 w-4" />
                Columnas ({columnasVisiblesArray.length})
              </Button>
            </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Seleccionar columnas</h4>
                <p className="text-sm text-muted-foreground">
                  Elige qué columnas mostrar en la tabla
                </p>
              </div>
              
              <ScrollArea className="h-72">
                <div className="space-y-2">
                  {Object.entries(COLUMNAS_CONFIG).map(([key, config]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={columnasVisibles[key]}
                        onCheckedChange={(checked) => {
                          setColumnasVisibles(prev => ({
                            ...prev,
                            [key]: !!checked
                          }))
                        }}
                      />
                      <Label htmlFor={key} className="text-sm">
                        {config.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setColumnasVisibles(
                    Object.fromEntries(Object.keys(COLUMNAS_CONFIG).map(key => [key, true]))
                  )}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  Todas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setColumnasVisibles(
                    Object.fromEntries(
                      Object.entries(COLUMNAS_CONFIG).map(([key, config]) => [key, config.visible])
                    )
                  )}
                >
                  <EyeOff className="mr-1 h-3 w-3" />
                  Por defecto
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAnchosColumnas(
                    Object.fromEntries(
                      Object.entries(COLUMNAS_CONFIG).map(([key, config]) => [key, config.width])
                    )
                  )}
                >
                  <Settings2 className="mr-1 h-3 w-3" />
                  Resetear anchos
                </Button>
              </div>
            </div>
          </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Panel de filtros */}
      {mostrarFiltros && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                🔍 Filtros de Búsqueda Templates
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMostrarFiltros(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Filtros de fecha */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📅 Rango de Fechas Estimadas</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    placeholder="Desde"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="text-xs"
                  />
                  <Input
                    type="date"
                    placeholder="Hasta"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
              
              {/* Búsqueda de responsable */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">👤 Responsable</Label>
                <Input
                  placeholder="Buscar por responsable..."
                  value={busquedaResponsable}
                  onChange={(e) => setBusquedaResponsable(e.target.value)}
                  className="text-xs"
                />
              </div>
              
              {/* Búsqueda por nombre referencia */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📝 Nombre Referencia</Label>
                <Input
                  placeholder="Buscar por nombre referencia..."
                  value={busquedaNombreReferencia}
                  onChange={(e) => setBusquedaNombreReferencia(e.target.value)}
                  className="text-xs"
                />
              </div>
              
              {/* Búsqueda por descripción */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📄 Descripción</Label>
                <Input
                  placeholder="Buscar en descripción..."
                  value={busquedaDescripcion}
                  onChange={(e) => setBusquedaDescripcion(e.target.value)}
                  className="text-xs"
                />
              </div>
              
              {/* Selector de estado */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">⚡ Estado</Label>
                <Select value={estadoSeleccionado} onValueChange={setEstadoSeleccionado}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los estados</SelectItem>
                    {estadosUnicos.map(estado => (
                      <SelectItem key={estado} value={estado}>
                        {estado}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Búsqueda por CATEG */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">💰 CATEG</Label>
                <Input
                  placeholder="Buscar por categ..."
                  value={busquedaCateg}
                  onChange={(e) => setBusquedaCateg(e.target.value)}
                  className="text-xs"
                />
              </div>
              
              {/* Selector de tipo de recurrencia */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">🔄 Tipo Recurrencia</Label>
                <Select value={tipoRecurrenciaSeleccionado} onValueChange={setTipoRecurrenciaSeleccionado}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los tipos</SelectItem>
                    {tiposRecurrenciaUnicos.map(tipo => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Selector de año */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📆 Año</Label>
                <Select value={anoSeleccionado} onValueChange={setAnoSeleccionado}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Todos los años" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los años</SelectItem>
                    {anosUnicos.map(ano => (
                      <SelectItem key={ano} value={ano.toString()}>
                        {ano}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Checkbox solo activos */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">✅ Filtro Estado</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="solo-activos"
                    checked={soloActivos}
                    onCheckedChange={setSoloActivos}
                  />
                  <Label htmlFor="solo-activos" className="text-sm cursor-pointer">
                    Solo templates activos
                  </Label>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Rango de montos */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">💵 Rango de Montos</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Monto mínimo"
                    value={montoMinimo}
                    onChange={(e) => setMontoMinimo(e.target.value)}
                    className="text-xs"
                  />
                  <Input
                    type="number"
                    placeholder="Monto máximo"
                    value={montoMaximo}
                    onChange={(e) => setMontoMaximo(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
              
              {/* Estadísticas de filtrado */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📊 Estadísticas</Label>
                <div className="text-xs text-gray-600">
                  {cuotas.length} de {cuotasOriginales.length} cuotas mostradas
                  {cuotas.length !== cuotasOriginales.length && (
                    <span className="text-blue-600"> (filtrado aplicado)</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={aplicarFiltros}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Filter className="h-4 w-4 mr-2" />
                Aplicar Filtros
              </Button>
              <Button
                onClick={limpiarFiltros}
                variant="outline"
                size="sm"
              >
                Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado de carga o error */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            <span>Cargando egresos sin factura...</span>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabla de cuotas */}
      {!loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {cuotas.length} Cuotas Encontradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Scroll horizontal simple */}
            <div className="w-full overflow-auto max-h-[600px] border rounded-md">
              <div style={{ minWidth: 'fit-content' }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columnasVisiblesArray.map(columna => (
                        <TableHead 
                          key={columna} 
                          style={{ 
                            width: anchosColumnas[columna] || COLUMNAS_CONFIG[columna as keyof typeof COLUMNAS_CONFIG].width,
                            minWidth: anchosColumnas[columna] || COLUMNAS_CONFIG[columna as keyof typeof COLUMNAS_CONFIG].width
                          }}
                        >
                          {COLUMNAS_CONFIG[columna as keyof typeof COLUMNAS_CONFIG].label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cuotas.length === 0 ? (
                      <TableRow>
                        <TableCell 
                          colSpan={columnasVisiblesArray.length} 
                          className="h-24 text-center text-muted-foreground"
                        >
                          No hay egresos sin factura para mostrar
                        </TableCell>
                      </TableRow>
                    ) : (
                      cuotas.map(cuota => (
                        <TableRow key={cuota.id}>
                          {columnasVisiblesArray.map(columna => (
                            <TableCell 
                              key={columna}
                              style={{ 
                                width: anchosColumnas[columna] || COLUMNAS_CONFIG[columna as keyof typeof COLUMNAS_CONFIG].width,
                                minWidth: anchosColumnas[columna] || COLUMNAS_CONFIG[columna as keyof typeof COLUMNAS_CONFIG].width
                              }}
                            >
                              {renderizarCelda(cuota, columna)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wizard para crear templates */}
      {mostrarWizard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Crear Template de Egreso</h2>
                <Button 
                  variant="outline" 
                  onClick={() => setMostrarWizard(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <WizardTemplatesEgresos />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}