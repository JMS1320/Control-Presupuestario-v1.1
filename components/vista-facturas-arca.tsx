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
import { Loader2, Settings2, Receipt, Info, Eye, EyeOff, Filter, X, Edit3, Save, Check } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface FacturaArca {
  id: string
  fecha_emision: string
  tipo_comprobante: number
  punto_venta: number | null
  numero_desde: number | null
  numero_hasta: number | null
  codigo_autorizacion: string | null
  tipo_doc_emisor: number | null
  cuit: string
  denominacion_emisor: string
  tipo_cambio: number
  moneda: string
  imp_neto_gravado: number
  imp_neto_no_gravado: number
  imp_op_exentas: number
  otros_tributos: number
  iva: number
  imp_total: number
  campana: string | null
  año_contable: number | null
  mes_contable: number | null
  fc: string | null
  cuenta_contable: string | null
  centro_costo: string | null
  estado: string
  observaciones_pago: string | null
  detalle: string | null
  archivo_origen: string | null
  fecha_importacion: string | null
  fecha_modificacion: string | null
  fecha_estimada: string | null
  fecha_vencimiento: string | null
  monto_a_abonar: number | null
  created_at: string
}

// Configuración de columnas disponibles - TODAS VISIBLES por defecto  
const COLUMNAS_CONFIG = {
  fecha_emision: { label: "Fecha Emisión", visible: true, width: "120px" },
  tipo_comprobante: { label: "Tipo Comp.", visible: true, width: "100px" },
  punto_venta: { label: "Punto Venta", visible: true, width: "120px" },
  numero_desde: { label: "Número Desde", visible: true, width: "140px" },
  numero_hasta: { label: "Número Hasta", visible: false, width: "140px" },
  codigo_autorizacion: { label: "Cód. Autorización", visible: false, width: "160px" },
  tipo_doc_emisor: { label: "Tipo Doc.", visible: false, width: "100px" },
  cuit: { label: "CUIT", visible: true, width: "120px" },
  denominacion_emisor: { label: "Proveedor", visible: true, width: "200px" },
  tipo_cambio: { label: "Tipo Cambio", visible: true, width: "120px" },
  moneda: { label: "Moneda", visible: true, width: "80px" },
  imp_neto_gravado: { label: "Neto Gravado", visible: true, width: "130px" },
  imp_neto_no_gravado: { label: "Neto No Gravado", visible: true, width: "140px" },
  imp_op_exentas: { label: "Op. Exentas", visible: true, width: "120px" },
  otros_tributos: { label: "Otros Tributos", visible: true, width: "130px" },
  iva: { label: "IVA", visible: true, width: "120px" },
  imp_total: { label: "Total", visible: true, width: "130px" },
  campana: { label: "Campaña", visible: true, width: "120px" },
  año_contable: { label: "Año Contable", visible: true, width: "120px" },
  mes_contable: { label: "Mes Contable", visible: true, width: "120px" },
  fc: { label: "FC", visible: true, width: "80px" },
  cuenta_contable: { label: "Cuenta Contable", visible: true, width: "150px" },
  centro_costo: { label: "Centro Costo", visible: true, width: "120px" },
  estado: { label: "Estado", visible: true, width: "100px" },
  observaciones_pago: { label: "Obs. Pago", visible: true, width: "150px" },
  detalle: { label: "Detalle", visible: true, width: "150px" },
  archivo_origen: { label: "Archivo Origen", visible: false, width: "200px" },
  fecha_importacion: { label: "Fecha Importación", visible: false, width: "150px" },
  fecha_modificacion: { label: "Fecha Modificación", visible: false, width: "150px" },
  fecha_estimada: { label: "Fecha Estimada", visible: true, width: "130px" },
  fecha_vencimiento: { label: "Fecha Vencimiento", visible: true, width: "150px" },
  monto_a_abonar: { label: "Monto a Abonar", visible: true, width: "140px" },
  created_at: { label: "Created At", visible: false, width: "150px" }
} as const

export function VistaFacturasArca() {
  const [facturas, setFacturas] = useState<FacturaArca[]>([])
  const [facturasOriginales, setFacturasOriginales] = useState<FacturaArca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estados para filtros
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [busquedaProveedor, setBusquedaProveedor] = useState('')
  const [busquedaCUIT, setBusquedaCUIT] = useState('')
  const [busquedaDetalle, setBusquedaDetalle] = useState('')
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('todos')
  const [montoMinimo, setMontoMinimo] = useState('')
  const [montoMaximo, setMontoMaximo] = useState('')
  const [busquedaCateg, setBusquedaCateg] = useState('')
  
  // Estados para edición inline
  const [modoEdicion, setModoEdicion] = useState(false)
  const [celdaEnEdicion, setCeldaEnEdicion] = useState<{facturaId: string, columna: string, valor: any} | null>(null)
  const [guardandoCambio, setGuardandoCambio] = useState(false)
  
  // Estado para columnas visibles con valores por defecto
  const [columnasVisibles, setColumnasVisibles] = useState<Record<string, boolean>>(() => {
    // Intentar cargar desde localStorage
    const saved = localStorage.getItem('facturas-arca-columnas-visibles')
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
    const saved = localStorage.getItem('facturas-arca-anchos-columnas')
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
    localStorage.setItem('facturas-arca-columnas-visibles', JSON.stringify(columnasVisibles))
  }, [columnasVisibles])

  // Guardar cambios de anchos en localStorage
  useEffect(() => {
    localStorage.setItem('facturas-arca-anchos-columnas', JSON.stringify(anchosColumnas))
  }, [anchosColumnas])

  // Cargar facturas ARCA desde Supabase
  const cargarFacturas = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error: supabaseError } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('*')
        .order('fecha_emision', { ascending: false })

      if (supabaseError) {
        console.error('Error al cargar facturas:', supabaseError)
        setError(`Error al cargar facturas: ${supabaseError.message}`)
        return
      }

      const facturasCargadas = data || []
      setFacturas(facturasCargadas)
      setFacturasOriginales(facturasCargadas)
    } catch (error) {
      console.error('Error inesperado:', error)
      setError('Error inesperado al cargar las facturas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarFacturas()
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
    let facturasFiltradas = [...facturasOriginales]
    
    // Filtro por fecha de emisión
    if (fechaDesde) {
      facturasFiltradas = facturasFiltradas.filter(f => f.fecha_emision >= fechaDesde)
    }
    if (fechaHasta) {
      facturasFiltradas = facturasFiltradas.filter(f => f.fecha_emision <= fechaHasta)
    }
    
    // Filtro por proveedor
    if (busquedaProveedor.trim()) {
      const busqueda = busquedaProveedor.toLowerCase()
      facturasFiltradas = facturasFiltradas.filter(f => 
        f.denominacion_emisor.toLowerCase().includes(busqueda)
      )
    }
    
    // Filtro por CUIT
    if (busquedaCUIT.trim()) {
      facturasFiltradas = facturasFiltradas.filter(f => 
        f.cuit.includes(busquedaCUIT)
      )
    }
    
    // Filtro por detalle
    if (busquedaDetalle.trim()) {
      const busqueda = busquedaDetalle.toLowerCase()
      facturasFiltradas = facturasFiltradas.filter(f => 
        f.detalle?.toLowerCase().includes(busqueda)
      )
    }
    
    // Filtro por estado
    if (estadoSeleccionado && estadoSeleccionado !== 'todos') {
      facturasFiltradas = facturasFiltradas.filter(f => f.estado === estadoSeleccionado)
    }
    
    // Filtro por rango de montos
    if (montoMinimo) {
      const minimo = parseFloat(montoMinimo)
      facturasFiltradas = facturasFiltradas.filter(f => f.imp_total >= minimo)
    }
    if (montoMaximo) {
      const maximo = parseFloat(montoMaximo)
      facturasFiltradas = facturasFiltradas.filter(f => f.imp_total <= maximo)
    }
    
    // Filtro por cuenta contable (CATEG)
    if (busquedaCateg.trim()) {
      const busqueda = busquedaCateg.toLowerCase()
      facturasFiltradas = facturasFiltradas.filter(f => 
        f.cuenta_contable?.toLowerCase().includes(busqueda)
      )
    }
    
    setFacturas(facturasFiltradas)
  }
  
  const limpiarFiltros = () => {
    setFechaDesde('')
    setFechaHasta('')
    setBusquedaProveedor('')
    setBusquedaCUIT('')
    setBusquedaDetalle('')
    setEstadoSeleccionado('todos')
    setMontoMinimo('')
    setMontoMaximo('')
    setBusquedaCateg('')
    setFacturas(facturasOriginales)
  }
  
  // Funciones para edición inline
  const iniciarEdicion = (facturaId: string, columna: string, valor: any, event: React.MouseEvent) => {
    if (!event.ctrlKey || !modoEdicion) return
    
    event.preventDefault()
    event.stopPropagation()
    
    setCeldaEnEdicion({
      facturaId,
      columna,
      valor: valor || ''
    })
  }

  const cancelarEdicion = () => {
    setCeldaEnEdicion(null)
  }

  const guardarCambio = async () => {
    if (!celdaEnEdicion) return
    
    setGuardandoCambio(true)
    
    try {
      let valorFinal: any = celdaEnEdicion.valor
      
      // Convertir valores según el tipo de campo
      if (['monto_a_abonar', 'imp_total', 'imp_neto_gravado', 'imp_neto_no_gravado', 'imp_op_exentas', 'otros_tributos', 'iva', 'tipo_cambio'].includes(celdaEnEdicion.columna)) {
        valorFinal = parseFloat(String(valorFinal)) || 0
      }
      
      const { error } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .update({ [celdaEnEdicion.columna]: valorFinal })
        .eq('id', celdaEnEdicion.facturaId)
      
      if (error) {
        console.error('Error actualizando factura:', error)
        alert('Error al guardar cambio: ' + error.message)
        return
      }
      
      // Actualizar estado local
      const nuevasFacturas = facturas.map(f => 
        f.id === celdaEnEdicion.facturaId 
          ? { ...f, [celdaEnEdicion.columna]: valorFinal }
          : f
      )
      setFacturas(nuevasFacturas)
      
      const nuevasFacturasOriginales = facturasOriginales.map(f => 
        f.id === celdaEnEdicion.facturaId 
          ? { ...f, [celdaEnEdicion.columna]: valorFinal }
          : f
      )
      setFacturasOriginales(nuevasFacturasOriginales)
      
      setCeldaEnEdicion(null)
      alert('Cambio guardado exitosamente')
      
    } catch (error) {
      console.error('Error guardando cambio:', error)
      alert('Error al guardar cambio')
    } finally {
      setGuardandoCambio(false)
    }
  }

  // Obtener estados únicos para el selector
  const estadosUnicos = [...new Set(facturasOriginales.map(f => f.estado))].filter(Boolean).sort()

  // Obtener columnas visibles
  const columnasVisiblesArray = Object.entries(columnasVisibles)
    .filter(([_, visible]) => visible)
    .map(([key]) => key as keyof FacturaArca)

  // Campos editables en ARCA
  const camposEditables = [
    'fecha_estimada', 'fecha_vencimiento', 'monto_a_abonar', 'cuenta_contable', 
    'centro_costo', 'estado', 'observaciones_pago', 'detalle', 'campana'
  ]

  // Renderizar valor de celda según el tipo de columna
  const renderizarCelda = (factura: FacturaArca, columna: keyof FacturaArca) => {
    const valor = factura[columna]
    const esEditable = camposEditables.includes(columna as string)
    const esCeldaEnEdicion = celdaEnEdicion?.facturaId === factura.id && celdaEnEdicion?.columna === columna

    // Si esta celda está en edición, mostrar input
    if (esCeldaEnEdicion) {
      return (
        <div className="flex items-center gap-1">
          {(['fecha_estimada', 'fecha_vencimiento'].includes(columna as string)) ? (
            <Input
              type="date"
              value={String(celdaEnEdicion.valor)}
              onChange={(e) => setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
              className="h-6 text-xs p-1 w-full"
              disabled={guardandoCambio}
            />
          ) : (['monto_a_abonar', 'imp_total'].includes(columna as string)) ? (
            <Input
              type="number"
              step="0.01"
              value={String(celdaEnEdicion.valor)}
              onChange={(e) => setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
              className="h-6 text-xs p-1 w-full text-right"
              disabled={guardandoCambio}
            />
          ) : (columna === 'estado') ? (
            <Select 
              value={String(celdaEnEdicion.valor)} 
              onValueChange={(value) => setCeldaEnEdicion(prev => prev ? { ...prev, valor: value } : null)}
              disabled={guardandoCambio}
            >
              <SelectTrigger className="h-6 text-xs p-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="pagado">Pagado</SelectItem>
                <SelectItem value="conciliado">Conciliado</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input
              type="text"
              value={String(celdaEnEdicion.valor)}
              onChange={(e) => setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
              className="h-6 text-xs p-1 w-full"
              disabled={guardandoCambio}
            />
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={guardarCambio}
            disabled={guardandoCambio}
            className="h-6 w-6 p-0"
          >
            {guardandoCambio ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3 text-green-600" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={cancelarEdicion}
            disabled={guardandoCambio}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3 text-red-600" />
          </Button>
        </div>
      )
    }

    if (valor === null || valor === undefined) {
      return <span className="text-gray-400">-</span>
    }

    switch (columna) {
      case 'fecha_emision':
      case 'fecha_importacion':
      case 'fecha_modificacion':
      case 'fecha_estimada':
      case 'fecha_vencimiento':
      case 'created_at':
        const contenidoFecha = formatearFecha(valor as string)
        return esEditable && modoEdicion ? (
          <div 
            className="cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors relative group"
            onClick={(e) => iniciarEdicion(factura.id, columna, valor, e)}
            title="Ctrl+Click para editar"
          >
            <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0" />
            {contenidoFecha}
          </div>
        ) : contenidoFecha
      
      case 'imp_neto_gravado':
      case 'imp_neto_no_gravado':
      case 'imp_op_exentas':
      case 'otros_tributos':
      case 'iva':
      case 'imp_total':
      case 'tipo_cambio':
      case 'monto_a_abonar':
        const contenidoNumero = formatearNumero(valor as number)
        return esEditable && modoEdicion ? (
          <div 
            className="cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors relative group"
            onClick={(e) => iniciarEdicion(factura.id, columna, valor, e)}
            title="Ctrl+Click para editar"
          >
            <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0" />
            {contenidoNumero}
          </div>
        ) : contenidoNumero
      
      case 'denominacion_emisor':
        const contenidoDenominacion = (
          <div className="max-w-xs truncate" title={valor as string}>
            {valor as string}
          </div>
        )
        return esEditable && modoEdicion ? (
          <div 
            className="cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors relative group"
            onClick={(e) => iniciarEdicion(factura.id, columna, valor, e)}
            title="Ctrl+Click para editar"
          >
            <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0" />
            {contenidoDenominacion}
          </div>
        ) : contenidoDenominacion
      
      case 'estado':
        const contenidoEstado = (
          <Badge variant={valor === 'pendiente' ? 'secondary' : 'default'}>
            {valor as string}
          </Badge>
        )
        return esEditable && modoEdicion ? (
          <div 
            className="cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors relative group"
            onClick={(e) => iniciarEdicion(factura.id, columna, valor, e)}
            title="Ctrl+Click para editar"
          >
            <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0" />
            {contenidoEstado}
          </div>
        ) : contenidoEstado
      
      default:
        const contenidoDefault = String(valor)
        return esEditable && modoEdicion ? (
          <div 
            className="cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors relative group"
            onClick={(e) => iniciarEdicion(factura.id, columna, valor, e)}
            title="Ctrl+Click para editar"
          >
            <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute top-0 right-0" />
            {contenidoDefault}
          </div>
        ) : contenidoDefault
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado con controles */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Facturas ARCA - MSA</h2>
          <p className="text-muted-foreground">
            Gestión de comprobantes recibidos importados desde ARCA
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Botón de filtros */}
          <Button 
            variant={mostrarFiltros ? "default" : "outline"}
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
          
          {/* Botón modo edición */}
          <Button 
            variant={modoEdicion ? "default" : "outline"}
            onClick={() => setModoEdicion(!modoEdicion)}
          >
            <Edit3 className="mr-2 h-4 w-4" />
            {modoEdicion ? 'Salir Edición' : 'Modo Edición'}
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
                🔍 Filtros de Búsqueda
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
                <Label className="text-sm font-medium">📅 Rango de Fechas de Emisión</Label>
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
              
              {/* Búsqueda de proveedor */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">🏢 Proveedor</Label>
                <Input
                  placeholder="Buscar por nombre proveedor..."
                  value={busquedaProveedor}
                  onChange={(e) => setBusquedaProveedor(e.target.value)}
                  className="text-xs"
                />
              </div>
              
              {/* Búsqueda por CUIT */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">🆔 CUIT</Label>
                <Input
                  placeholder="Buscar por CUIT..."
                  value={busquedaCUIT}
                  onChange={(e) => setBusquedaCUIT(e.target.value)}
                  className="text-xs"
                />
              </div>
              
              {/* Búsqueda por detalle */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">📝 Detalle</Label>
                <Input
                  placeholder="Buscar en detalle..."
                  value={busquedaDetalle}
                  onChange={(e) => setBusquedaDetalle(e.target.value)}
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
                    <SelectItem value="todos">Todos los estados</SelectItem>
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
                <Label className="text-sm font-medium">💰 Cuenta Contable</Label>
                <Input
                  placeholder="Buscar por cuenta contable..."
                  value={busquedaCateg}
                  onChange={(e) => setBusquedaCateg(e.target.value)}
                  className="text-xs"
                />
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
                  {facturas.length} de {facturasOriginales.length} facturas mostradas
                  {facturas.length !== facturasOriginales.length && (
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
            <span>Cargando facturas ARCA...</span>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabla de facturas */}
      {!loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {facturas.length} Facturas Encontradas
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
                            width: anchosColumnas[columna] || COLUMNAS_CONFIG[columna].width,
                            minWidth: anchosColumnas[columna] || COLUMNAS_CONFIG[columna].width
                          }}
                        >
                          {COLUMNAS_CONFIG[columna].label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facturas.length === 0 ? (
                      <TableRow>
                        <TableCell 
                          colSpan={columnasVisiblesArray.length} 
                          className="h-24 text-center text-muted-foreground"
                        >
                          No hay facturas para mostrar
                        </TableCell>
                      </TableRow>
                    ) : (
                      facturas.map(factura => (
                        <TableRow key={factura.id}>
                          {columnasVisiblesArray.map(columna => (
                            <TableCell 
                              key={columna}
                              style={{ 
                                width: anchosColumnas[columna] || COLUMNAS_CONFIG[columna].width,
                                minWidth: anchosColumnas[columna] || COLUMNAS_CONFIG[columna].width
                              }}
                            >
                              {renderizarCelda(factura, columna)}
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
    </div>
  )
}