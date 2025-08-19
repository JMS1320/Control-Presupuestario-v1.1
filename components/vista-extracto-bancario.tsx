"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { CategCombobox } from "@/components/ui/categ-combobox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Banknote, 
  Settings, 
  Play, 
  FileSpreadsheet, 
  Upload, 
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Edit,
  Save,
  X,
  Search,
  Check,
  ChevronsUpDown,
  Filter
} from "lucide-react"
import { ConfiguradorReglas } from "./configurador-reglas"
import { useMotorConciliacion, CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"
import { useMovimientosBancarios } from "@/hooks/useMovimientosBancarios"
import { supabase } from "@/lib/supabase"

export function VistaExtractoBancario() {
  const [configuradorAbierto, setConfiguradorAbierto] = useState(false)
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string>("")
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | 'Conciliado' | 'Pendiente' | 'Auditar'>('Todos')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState("")
  const [editData, setEditData] = useState({
    categ: '',
    centro_de_costo: '',
    estado: '',
    contable: '',
    interno: ''
  })
  const [facturasDisponibles, setFacturasDisponibles] = useState<any[]>([])
  const [vinculaciones, setVinculaciones] = useState<{[key: string]: string}>({}) // movimiento_id -> factura_id
  
  // Estados para Combobox avanzado
  const [comboboxAbierto, setComboboxAbierto] = useState<{[key: string]: boolean}>({})
  const [busquedaCombobox, setBusquedaCombobox] = useState<{[key: string]: string}>({})
  
  // Estados para filtros avanzados extracto bancario
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false)
  const [fechaMovDesde, setFechaMovDesde] = useState('')
  const [fechaMovHasta, setFechaMovHasta] = useState('')
  const [montoDesde, setMontoDesde] = useState('')
  const [montoHasta, setMontoHasta] = useState('')
  const [busquedaCateg, setBusquedaCategExtracto] = useState('')
  const [busquedaDetalle, setBusquedaDetalleExtracto] = useState('')

  const { procesoEnCurso, error, resultados, ejecutarConciliacion, cuentasDisponibles } = useMotorConciliacion()
  const { movimientos, estadisticas, loading, cargarMovimientos, actualizarMasivo, recargar } = useMovimientosBancarios()

  // Cargar facturas cuando se activa modo edición
  useEffect(() => {
    if (modoEdicion) {
      cargarFacturasDisponibles()
    }
  }, [modoEdicion])

  // Iniciar proceso de conciliación
  const iniciarConciliacion = () => {
    if (!cuentaSeleccionada) {
      setSelectorAbierto(true)
      return
    }
    
    const cuenta = cuentasDisponibles.find(c => c.id === cuentaSeleccionada)
    if (cuenta) {
      ejecutarConciliacion(cuenta)
    }
  }

  // Ejecutar conciliación con cuenta seleccionada
  const ejecutarConCuenta = async (cuentaId: string) => {
    const cuenta = cuentasDisponibles.find(c => c.id === cuentaId)
    if (!cuenta) return
    
    setCuentaSeleccionada(cuentaId)
    setSelectorAbierto(false)
    
    try {
      await ejecutarConciliacion(cuenta)
      // Recargar movimientos después de conciliación
      recargar()
    } catch (error) {
      console.error('Error en conciliación:', error)
    }
  }

  // Aplicar filtros
  const aplicarFiltros = () => {
    cargarMovimientos({
      estado: filtroEstado,
      busqueda: busqueda.trim() || undefined,
      limite: 200
    })
  }

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount)
  }

  // Manejar selección de movimientos
  const toggleSeleccion = (id: string) => {
    const nuevaSeleccion = new Set(seleccionados)
    if (nuevaSeleccion.has(id)) {
      nuevaSeleccion.delete(id)
    } else {
      nuevaSeleccion.add(id)
    }
    setSeleccionados(nuevaSeleccion)
  }

  // Seleccionar todos los movimientos visibles
  const seleccionarTodos = () => {
    if (seleccionados.size === movimientos.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(movimientos.map(m => m.id)))
    }
  }

  // Aplicar ediciones masivas
  const aplicarEdicionMasiva = async () => {
    if (seleccionados.size === 0) return
    
    try {
      const ids = Array.from(seleccionados)
      const exito = await actualizarMasivo(ids, editData)
      
      if (exito) {
        // Si se marcaron como "Conciliado", actualizar facturas vinculadas y limpiar motivo_revision
        if (editData.estado === 'Conciliado') {
          // Limpiar motivo_revision para movimientos marcados como Conciliado
          const { error: errorLimpiar } = await supabase
            .from('msa_galicia')
            .update({ motivo_revision: null })
            .in('id', ids)
          
          if (errorLimpiar) {
            console.error('Error limpiando motivo_revision:', errorLimpiar)
          }
          
          // Actualizar facturas ARCA y templates vinculados
          for (const movimientoId of ids) {
            const opcionId = vinculaciones[movimientoId]
            if (opcionId) {
              // Encontrar la opción vinculada para saber si es ARCA o Template
              const opcionVinculada = facturasDisponibles.find(opt => opt.id === opcionId)
              if (!opcionVinculada) {
                console.warn(`No se encontró opción vinculada con ID: ${opcionId}`)
                continue
              }

              if (opcionVinculada.tipo === 'ARCA') {
                console.log(`Actualizando factura ARCA ${opcionId} a estado conciliado`)
                
                const { error } = await supabase
                  .schema('msa')
                  .from('comprobantes_arca')
                  .update({ estado: 'conciliado' })
                  .eq('id', opcionId)
                
                if (error) {
                  console.error('Error actualizando factura ARCA:', error)
                } else {
                  console.log(`✅ Factura ARCA ${opcionId} marcada como conciliada`)
                }
              } else if (opcionVinculada.tipo === 'TEMPLATE') {
                console.log(`Actualizando template ${opcionId} a estado conciliado`)
                
                const { error } = await supabase
                  .from('cuotas_egresos_sin_factura')
                  .update({ estado: 'conciliado' })
                  .eq('id', opcionId)
                
                if (error) {
                  console.error('Error actualizando template:', error)
                } else {
                  console.log(`✅ Template ${opcionId} marcado como conciliado`)
                }
              }
            }
          }
        }
        
        // Resetear después de aplicar exitosamente
        setSeleccionados(new Set())
        setModoEdicion(false)
        setVinculaciones({})
        setEditData({
          categ: '',
          centro_de_costo: '',
          estado: '',
          contable: '',
          interno: ''
        })
        recargar()
      }
    } catch (error) {
      console.error('Error aplicando edición masiva:', error)
    }
  }

  // Cargar facturas y templates disponibles para vincular
  const cargarFacturasDisponibles = async () => {
    try {
      // Cargar facturas ARCA NO conciliadas (cualquier estado excepto conciliado)
      const { data: facturasArca, error: errorArca } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('id, tipo_comprobante, numero_desde, denominacion_emisor, monto_a_abonar, fecha_estimada, cuit, estado')
        .neq('estado', 'conciliado')
        .order('fecha_estimada', { ascending: false })

      if (errorArca) {
        console.error('Error cargando facturas ARCA:', errorArca)
        return
      }

      // Cargar templates egresos NO conciliados (cualquier estado excepto conciliado)
      const { data: templatesEgresos, error: errorTemplates } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select(`
          id,
          monto,
          descripcion,
          fecha_estimada,
          estado,
          egreso:egresos_sin_factura(
            nombre_referencia,
            nombre_quien_cobra,
            cuit_quien_cobra,
            responsable
          )
        `)
        .neq('estado', 'conciliado')
        .order('fecha_estimada', { ascending: false })

      if (errorTemplates) {
        console.error('Error cargando templates egresos:', errorTemplates)
        return
      }

      console.log('🔍 DEBUG Templates cargados:', templatesEgresos?.length || 0)
      console.log('🔍 DEBUG Templates raw data:', templatesEgresos)

      // Combinar facturas ARCA y templates en formato unificado
      const facturasFormateadas = (facturasArca || []).map(f => ({
        id: f.id,
        tipo: 'ARCA' as const,
        origen_tabla: 'msa.comprobantes_arca' as const,
        tipo_comprobante: f.tipo_comprobante,
        numero_desde: f.numero_desde,
        denominacion_emisor: f.denominacion_emisor,
        monto_a_abonar: f.monto_a_abonar,
        fecha_estimada: f.fecha_estimada,
        cuit: f.cuit,
        // Campos para mostrar en UI
        display_nombre: f.denominacion_emisor,
        display_referencia: `${f.tipo_comprobante}-${f.numero_desde}`,
        display_monto: f.monto_a_abonar
      }))

      const templatesFormateados = (templatesEgresos || []).map(t => ({
        id: t.id,
        tipo: 'TEMPLATE' as const,
        origen_tabla: 'cuotas_egresos_sin_factura' as const,
        descripcion: t.descripcion,
        denominacion_emisor: t.egreso?.nombre_quien_cobra || t.egreso?.responsable || 'Template Sin Factura',
        monto_a_abonar: t.monto,
        fecha_estimada: t.fecha_estimada,
        cuit: t.egreso?.cuit_quien_cobra || '',
        // Campos para mostrar en UI
        display_nombre: t.egreso?.nombre_quien_cobra || t.egreso?.responsable || 'Template Sin Factura',
        display_referencia: t.egreso?.nombre_referencia || t.descripcion || 'Template',
        display_monto: t.monto
      }))

      // Combinar y ordenar por fecha
      const todasLasOpciones = [...facturasFormateadas, ...templatesFormateados]
        .sort((a, b) => new Date(b.fecha_estimada).getTime() - new Date(a.fecha_estimada).getTime())

      setFacturasDisponibles(todasLasOpciones)
      
      console.log(`✅ Cargadas ${facturasFormateadas.length} facturas ARCA + ${templatesFormateados.length} templates = ${todasLasOpciones.length} total`)
      console.log('📄 Facturas ARCA (NO conciliadas):', facturasArca?.map(f => `${f.denominacion_emisor} - ${f.monto_a_abonar} [${f.estado}]`) || [])
      console.log('📋 Templates (NO conciliados):', templatesEgresos?.map(t => `${t.egreso?.nombre_quien_cobra || t.egreso?.responsable} - ${t.monto} [${t.estado}]`) || [])
    } catch (error) {
      console.error('Error cargando facturas y templates:', error)
    }
  }

  // Generar propuestas inteligentes para un movimiento (funciona con ARCA y Templates)
  const generarPropuestasInteligentes = (movimiento: any) => {
    const opcionesDisponibles = facturasDisponibles
    const propuestas = []
    
    // 1. Mismo monto exacto (cualquier fecha)
    const mismoMonto = opcionesDisponibles.filter(f => 
      Math.abs(f.display_monto - movimiento.debitos) < 0.01
    )
    propuestas.push(...mismoMonto.map(f => ({
      ...f, 
      tipo_match: f.tipo === 'ARCA' ? 'factura_mismo_monto' : 'template_mismo_monto', 
      prioridad: f.tipo === 'ARCA' ? 1 : 2 // Priorizar facturas ARCA
    })))
    
    // 2. Monto similar ±10% + mismo proveedor (buscar en descripción)
    const montoSimilar = opcionesDisponibles.filter(f => {
      const diferenciaMonto = Math.abs(f.display_monto - movimiento.debitos) / movimiento.debitos
      const proveedorEnDescripcion = movimiento.descripcion.toLowerCase().includes(f.display_nombre.toLowerCase().split(' ')[0])
      return diferenciaMonto <= 0.10 && proveedorEnDescripcion && !propuestas.find(p => p.id === f.id)
    })
    propuestas.push(...montoSimilar.map(f => ({
      ...f, 
      tipo_match: f.tipo === 'ARCA' ? 'factura_similar_proveedor' : 'template_similar_proveedor', 
      prioridad: f.tipo === 'ARCA' ? 3 : 4
    })))
    
    // 3. Mismo proveedor (cualquier monto)
    const mismoProveedor = opcionesDisponibles.filter(f => {
      const proveedorEnDescripcion = movimiento.descripcion.toLowerCase().includes(f.display_nombre.toLowerCase().split(' ')[0])
      return proveedorEnDescripcion && !propuestas.find(p => p.id === f.id)
    })
    propuestas.push(...mismoProveedor.map(f => ({
      ...f, 
      tipo_match: f.tipo === 'ARCA' ? 'factura_mismo_proveedor' : 'template_mismo_proveedor', 
      prioridad: f.tipo === 'ARCA' ? 5 : 6
    })))
    
    // Ordenar por prioridad (facturas ARCA primero, luego templates)
    return propuestas.sort((a, b) => a.prioridad - b.prioridad)
  }

  // Filtrar facturas con búsqueda avanzada
  const filtrarFacturasConBusqueda = (opciones: any[], termino: string) => {
    if (!termino.trim()) return opciones
    
    const busqueda = termino.toLowerCase()
    return opciones.filter(opcion => {
      // Buscar en múltiples campos - compatible con ARCA y Templates
      const campos = [
        opcion.display_nombre?.toLowerCase() || '',
        opcion.display_referencia?.toLowerCase() || '',
        opcion.cuit || '',
        opcion.display_monto?.toString() || '',
        opcion.tipo?.toLowerCase() || '', // 'arca' o 'template'
        // Campos específicos ARCA (retrocompatibilidad)
        opcion.denominacion_emisor?.toLowerCase() || '',
        opcion.tipo_comprobante?.toString() || '',
        opcion.numero_desde?.toString() || '',
        // Campos específicos Templates
        opcion.descripcion?.toLowerCase() || '',
        // Formatear fecha para búsqueda
        opcion.fecha_estimada ? new Date(opcion.fecha_estimada + 'T12:00:00').toLocaleDateString('es-AR') : ''
      ]
      
      return campos.some(campo => campo.includes(busqueda))
    })
  }

  // Aplicar filtros avanzados extracto bancario
  const aplicarFiltrosAvanzados = () => {
    const filtros: any = {
      estado: filtroEstado,
      busqueda: busqueda.trim() || undefined,
      limite: 200
    }

    // Agregar filtros adicionales
    if (fechaMovDesde) filtros.fechaDesde = fechaMovDesde
    if (fechaMovHasta) filtros.fechaHasta = fechaMovHasta
    if (montoDesde) filtros.montoDesde = parseFloat(montoDesde)
    if (montoHasta) filtros.montoHasta = parseFloat(montoHasta)
    if (busquedaCateg.trim()) filtros.categ = busquedaCateg.trim()
    if (busquedaDetalle.trim()) filtros.detalle = busquedaDetalle.trim()

    cargarMovimientos(filtros)
  }

  // Limpiar filtros avanzados
  const limpiarFiltrosAvanzados = () => {
    setFechaMovDesde('')
    setFechaMovHasta('')
    setMontoDesde('')
    setMontoHasta('')
    setBusquedaCategExtracto('')
    setBusquedaDetalleExtracto('')
    setBusqueda('')
    setFiltroEstado('Todos')
    
    cargarMovimientos({
      estado: 'Todos',
      limite: 200
    })
  }

  // Cancelar modo edición
  const cancelarEdicion = () => {
    setModoEdicion(false)
    setSeleccionados(new Set())
    setVinculaciones({})
    setComboboxAbierto({})
    setBusquedaCombobox({})
    setEditData({
      categ: '',
      centro_de_costo: '',
      estado: '',
      contable: '',
      interno: ''
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6" />
            Extracto Bancario
            {cuentaSeleccionada && (
              <Badge variant="outline" className="ml-2">
                {cuentasDisponibles.find(c => c.id === cuentaSeleccionada)?.nombre}
              </Badge>
            )}
          </h2>
          <p className="text-gray-600">Conciliación automática de movimientos bancarios</p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setConfiguradorAbierto(true)}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Configuración
          </Button>
          
          <Button 
            onClick={iniciarConciliacion}
            disabled={procesoEnCurso}
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
          >
            {procesoEnCurso ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Conciliación Bancaria
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Estado del Proceso */}
      {procesoEnCurso && (
        <Alert>
          <RotateCcw className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Procesando conciliación bancaria automática...
          </AlertDescription>
        </Alert>
      )}

      {/* Error del Proceso */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Error en conciliación: {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Resultados del Proceso */}
      {resultados && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Conciliación Completada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {resultados.automaticos}
                </div>
                <div className="text-sm text-gray-600">Automáticos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {resultados.revision_manual}
                </div>
                <div className="text-sm text-gray-600">Revisión Manual</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {resultados.sin_match}
                </div>
                <div className="text-sm text-gray-600">Sin Match</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {resultados.total_movimientos}
                </div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs del contenido */}
      <Tabs defaultValue="movimientos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="movimientos" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Movimientos
          </TabsTrigger>
          <TabsTrigger value="importar" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar
          </TabsTrigger>
          <TabsTrigger value="reportes" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Reportes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movimientos" className="space-y-4">
          {/* Estadísticas */}
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{estadisticas.total}</div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  Total Movimientos
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{estadisticas.conciliados}</div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Conciliados
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">{estadisticas.auditar || 0}</div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Para Auditar
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600">{estadisticas.pendientes}</div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Pendientes
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{estadisticas.sin_categ}</div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Sin CATEG
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <Input
                    placeholder="Buscar por descripción..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                  />
                </div>
                <Select value={filtroEstado} onValueChange={(value: any) => setFiltroEstado(value)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos los estados</SelectItem>
                    <SelectItem value="Conciliado">Conciliados</SelectItem>
                    <SelectItem value="Pendiente">Pendientes</SelectItem>
                    <SelectItem value="Auditar">Para Auditar</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={aplicarFiltros} variant="outline">
                  Filtrar
                </Button>
                <Button 
                  onClick={() => setMostrarFiltrosAvanzados(!mostrarFiltrosAvanzados)}
                  variant={mostrarFiltrosAvanzados ? "default" : "outline"}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros Avanzados
                </Button>
                <Button 
                  onClick={() => setModoEdicion(!modoEdicion)} 
                  variant={modoEdicion ? "destructive" : "outline"}
                  className="flex items-center gap-2"
                >
                  {modoEdicion ? (
                    <>
                      <X className="h-4 w-4" />
                      Cancelar
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4" />
                      Editar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Panel de Filtros Avanzados */}
          {mostrarFiltrosAvanzados && (
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="text-purple-800 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    🔍 Filtros Avanzados Extracto Bancario
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMostrarFiltrosAvanzados(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  {/* Filtros de fecha de movimiento */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-purple-700">📅 Rango de Fechas Movimiento</label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        placeholder="Desde"
                        value={fechaMovDesde}
                        onChange={(e) => setFechaMovDesde(e.target.value)}
                        className="text-xs"
                      />
                      <Input
                        type="date"
                        placeholder="Hasta"
                        value={fechaMovHasta}
                        onChange={(e) => setFechaMovHasta(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                  
                  {/* Filtros de monto */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-purple-700">💵 Rango de Montos</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Monto desde"
                        value={montoDesde}
                        onChange={(e) => setMontoDesde(e.target.value)}
                        className="text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Monto hasta"
                        value={montoHasta}
                        onChange={(e) => setMontoHasta(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>
                  
                  {/* Búsqueda por CATEG */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-purple-700">💰 CATEG</label>
                    <CategCombobox
                      value={busquedaCateg}
                      onValueChange={setBusquedaCategExtracto}
                      placeholder="Buscar por CATEG..."
                      className="text-xs"
                    />
                  </div>
                  
                  {/* Búsqueda por detalle */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-purple-700">📝 Detalle Movimiento</label>
                    <Input
                      placeholder="Buscar en detalle..."
                      value={busquedaDetalle}
                      onChange={(e) => setBusquedaDetalleExtracto(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  
                  {/* Estadísticas */}
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <label className="text-sm font-medium text-purple-700">📊 Info de Filtrado</label>
                    <div className="text-xs text-gray-600">
                      Mostrando {movimientos.length} movimientos
                      {(fechaMovDesde || fechaMovHasta || montoDesde || montoHasta || busquedaCateg || busquedaDetalle) && (
                        <span className="text-purple-600"> (filtros aplicados)</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={aplicarFiltrosAvanzados}
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Aplicar Filtros Avanzados
                  </Button>
                  <Button
                    onClick={limpiarFiltrosAvanzados}
                    variant="outline"
                    size="sm"
                  >
                    Limpiar Todos
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Panel de Edición Masiva */}
          {modoEdicion && seleccionados.size > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-800 flex items-center gap-2">
                  <Edit className="h-5 w-5" />
                  Edición Masiva - {seleccionados.size} seleccionados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-4 mb-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">CATEG</label>
                    <CategCombobox
                      value={editData.categ}
                      onValueChange={(value) => setEditData({...editData, categ: value})}
                      placeholder="Seleccionar cuenta contable..."
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Centro de Costo</label>
                    <Input
                      placeholder="Centro de costo"
                      value={editData.centro_de_costo}
                      onChange={(e) => setEditData({...editData, centro_de_costo: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Estado</label>
                    <Select value={editData.estado} onValueChange={(value) => setEditData({...editData, estado: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Conciliado">Conciliado</SelectItem>
                        <SelectItem value="Auditar">Auditar</SelectItem>
                        <SelectItem value="Pendiente">Pendiente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Contable</label>
                    <Input
                      placeholder="Código contable"
                      value={editData.contable}
                      onChange={(e) => setEditData({...editData, contable: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Interno</label>
                    <Input
                      placeholder="Código interno"
                      value={editData.interno}
                      onChange={(e) => setEditData({...editData, interno: e.target.value})}
                    />
                  </div>
                </div>
                
                {/* Sección de Vinculación con Facturas */}
                {editData.estado === 'Conciliado' && (
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-lg font-medium mb-3 text-blue-800">
                      💡 Vincular con Facturas ARCA (Opcional)
                    </h4>
                    <div className="space-y-3">
                      {Array.from(seleccionados).map(movimientoId => {
                        const movimiento = movimientos.find(m => m.id === movimientoId)
                        if (!movimiento) return null
                        
                        const propuestasInteligentes = generarPropuestasInteligentes(movimiento)
                        const todasLasFacturas = facturasDisponibles.filter(f => 
                          !propuestasInteligentes.find(p => p.id === f.id)
                        )
                        
                        return (
                          <div key={movimientoId} className="border rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">
                                {formatCurrency(movimiento.debitos)} - {movimiento.descripcion}
                              </span>
                            </div>
                            <Popover 
                              open={comboboxAbierto[movimientoId] || false} 
                              onOpenChange={(open) => setComboboxAbierto({...comboboxAbierto, [movimientoId]: open})}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={comboboxAbierto[movimientoId] || false}
                                  className="w-full justify-between"
                                >
                                  {vinculaciones[movimientoId] ? (
                                    (() => {
                                      const opcionSeleccionada = facturasDisponibles.find(f => f.id === vinculaciones[movimientoId])
                                      if (!opcionSeleccionada) return "Sin vincular"
                                      
                                      const tipoIcon = opcionSeleccionada.tipo === 'ARCA' ? '📄' : '📋'
                                      return `${tipoIcon} ${opcionSeleccionada.display_nombre} - ${formatCurrency(opcionSeleccionada.display_monto)}`
                                    })()
                                  ) : "Sin vincular"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0">
                                <Command>
                                  <div className="flex items-center border-b px-3">
                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                    <CommandInput 
                                      placeholder="Buscar por empresa, monto, CUIT, fecha..." 
                                      value={busquedaCombobox[movimientoId] || ''}
                                      onValueChange={(value) => setBusquedaCombobox({...busquedaCombobox, [movimientoId]: value})}
                                    />
                                  </div>
                                  <CommandList>
                                    <CommandEmpty>No se encontraron facturas.</CommandEmpty>
                                    
                                    {/* Opción Sin vincular */}
                                    <CommandGroup>
                                      <CommandItem
                                        value="sin_vincular"
                                        onSelect={() => {
                                          setVinculaciones({...vinculaciones, [movimientoId]: ''})
                                          setComboboxAbierto({...comboboxAbierto, [movimientoId]: false})
                                          setBusquedaCombobox({...busquedaCombobox, [movimientoId]: ''})
                                        }}
                                      >
                                        <Check className={`mr-2 h-4 w-4 ${!vinculaciones[movimientoId] ? "opacity-100" : "opacity-0"}`} />
                                        Sin vincular
                                      </CommandItem>
                                    </CommandGroup>
                                    
                                    {/* Propuestas inteligentes filtradas */}
                                    {(() => {
                                      const propuestasFiltradas = filtrarFacturasConBusqueda(propuestasInteligentes, busquedaCombobox[movimientoId] || '')
                                      return propuestasFiltradas.length > 0 && (
                                        <CommandGroup heading="⭐ PROPUESTAS INTELIGENTES">
                                          {propuestasFiltradas.map(opcion => (
                                            <CommandItem
                                              key={opcion.id}
                                              value={`${opcion.display_nombre} ${opcion.cuit} ${opcion.display_monto} ${opcion.display_referencia || ''}`}
                                              onSelect={() => {
                                                setVinculaciones({...vinculaciones, [movimientoId]: opcion.id})
                                                setComboboxAbierto({...comboboxAbierto, [movimientoId]: false})
                                                setBusquedaCombobox({...busquedaCombobox, [movimientoId]: ''})
                                              }}
                                            >
                                              <Check className={`mr-2 h-4 w-4 ${vinculaciones[movimientoId] === opcion.id ? "opacity-100" : "opacity-0"}`} />
                                              <div className="flex flex-col">
                                                <span className="font-medium">
                                                  ⭐ {opcion.tipo === 'ARCA' ? '📄' : '📋'} {opcion.display_nombre} - {formatCurrency(opcion.display_monto)}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                  {new Date(opcion.fecha_estimada + 'T12:00:00').toLocaleDateString('es-AR')} • 
                                                  {opcion.tipo === 'ARCA' ? 'Factura ARCA' : 'Template'} • 
                                                  {opcion.display_referencia} • CUIT: {opcion.cuit}
                                                </span>
                                              </div>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      )
                                    })()}
                                    
                                    {/* Todas las facturas filtradas */}
                                    {(() => {
                                      const todasFiltradas = filtrarFacturasConBusqueda(todasLasFacturas, busquedaCombobox[movimientoId] || '')
                                      return todasFiltradas.length > 0 && (
                                        <CommandGroup heading="📋 TODAS LAS OPCIONES">
                                          {todasFiltradas.slice(0, 20).map(opcion => ( // Limitar a 20 para performance
                                            <CommandItem
                                              key={opcion.id}
                                              value={`${opcion.display_nombre} ${opcion.cuit} ${opcion.display_monto} ${opcion.display_referencia || ''}`}
                                              onSelect={() => {
                                                setVinculaciones({...vinculaciones, [movimientoId]: opcion.id})
                                                setComboboxAbierto({...comboboxAbierto, [movimientoId]: false})
                                                setBusquedaCombobox({...busquedaCombobox, [movimientoId]: ''})
                                              }}
                                            >
                                              <Check className={`mr-2 h-4 w-4 ${vinculaciones[movimientoId] === opcion.id ? "opacity-100" : "opacity-0"}`} />
                                              <div className="flex flex-col">
                                                <span className="font-medium">
                                                  {opcion.tipo === 'ARCA' ? '📄' : '📋'} {opcion.display_nombre} - {formatCurrency(opcion.display_monto)}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                  {new Date(opcion.fecha_estimada + 'T12:00:00').toLocaleDateString('es-AR')} • 
                                                  {opcion.tipo === 'ARCA' ? 'Factura ARCA' : 'Template'} • 
                                                  {opcion.display_referencia} • CUIT: {opcion.cuit}
                                                </span>
                                              </div>
                                            </CommandItem>
                                          ))}
                                          {todasFiltradas.length > 20 && (
                                            <div className="px-2 py-1 text-xs text-gray-500 text-center">
                                              ... y {todasFiltradas.length - 20} más. Refina tu búsqueda.
                                            </div>
                                          )}
                                        </CommandGroup>
                                      )
                                    })()}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={aplicarEdicionMasiva} className="bg-green-600 hover:bg-green-700">
                    <Save className="h-4 w-4 mr-2" />
                    Aplicar Cambios
                  </Button>
                  <Button onClick={cancelarEdicion} variant="outline">
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabla de Movimientos */}
          <Card>
            <CardHeader>
              <CardTitle>Movimientos Bancarios</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center text-gray-500 py-8">
                  <RotateCcw className="h-8 w-8 mx-auto mb-4 animate-spin text-gray-300" />
                  <p>Cargando movimientos...</p>
                </div>
              ) : movimientos.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg mb-2">No se encontraron movimientos</p>
                  <p className="text-sm">
                    Ajusta los filtros o importa datos de extracto bancario.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {modoEdicion && (
                          <TableHead className="w-12">
                            <Checkbox
                              checked={seleccionados.size === movimientos.length && movimientos.length > 0}
                              onCheckedChange={seleccionarTodos}
                            />
                          </TableHead>
                        )}
                        <TableHead>Fecha</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Débitos</TableHead>
                        <TableHead className="text-right">Créditos</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead>CATEG</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Detalle</TableHead>
                        <TableHead>Motivo Revisión</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimientos.map((movimiento) => (
                        <TableRow key={movimiento.id}>
                          {modoEdicion && (
                            <TableCell>
                              <Checkbox
                                checked={seleccionados.has(movimiento.id)}
                                onCheckedChange={() => toggleSeleccion(movimiento.id)}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-mono text-sm">
                            {new Date(movimiento.fecha + 'T12:00:00').toLocaleDateString('es-AR')}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {movimiento.descripcion}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {movimiento.debitos > 0 ? formatCurrency(movimiento.debitos) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {movimiento.creditos > 0 ? formatCurrency(movimiento.creditos) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(movimiento.saldo)}
                          </TableCell>
                          <TableCell>
                            {movimiento.categ ? (
                              <Badge variant={movimiento.categ.startsWith('INVALIDA:') ? 'destructive' : 'default'}>
                                {movimiento.categ}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Sin CATEG</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              movimiento.estado === 'Conciliado' ? 'default' : 
                              movimiento.estado === 'Auditar' ? 'secondary' : 
                              'outline'
                            }>
                              {movimiento.estado}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-gray-600">
                            {movimiento.detalle || '-'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-orange-600">
                            {movimiento.motivo_revision || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar Extracto Bancario</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg mb-2">Importador de Extractos</p>
                <p className="text-sm mb-4">
                  Arrastra y suelta tu archivo CSV del extracto bancario MSA Galicia
                </p>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar Archivo
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reportes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reportes de Conciliación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg mb-2">Reportes y Análisis</p>
                <p className="text-sm">
                  Genera reportes detallados del proceso de conciliación y análisis de movimientos.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Configurador */}
      <Dialog open={configuradorAbierto} onOpenChange={setConfiguradorAbierto}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configuración de Reglas de Conciliación</DialogTitle>
          </DialogHeader>
          <ConfiguradorReglas />
        </DialogContent>
      </Dialog>

      {/* Modal Selector de Cuenta */}
      <Dialog open={selectorAbierto} onOpenChange={setSelectorAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar Cuenta Bancaria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Selecciona la cuenta bancaria que deseas conciliar:
            </p>
            <div className="space-y-2">
              {cuentasDisponibles.map((cuenta) => (
                <Button
                  key={cuenta.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => ejecutarConCuenta(cuenta.id)}
                >
                  <div className="flex items-center gap-3">
                    <Banknote className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium">{cuenta.nombre}</div>
                      <div className="text-sm text-gray-500">{cuenta.empresa}</div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}