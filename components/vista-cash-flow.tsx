"use client"

import { useState, useRef } from "react"
import { useMultiCashFlowData, type CashFlowRow, type CashFlowFilters } from "@/hooks/useMultiCashFlowData"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, Receipt, Calendar, TrendingUp, TrendingDown, DollarSign, Filter, Edit3, Save, X } from "lucide-react"
import { toast } from "sonner"

// Definición de columnas Cash Flow (10 columnas finales + editabilidad)
const columnasDefinicion = [
  { key: 'fecha_estimada', label: 'FECHA Estimada', type: 'date', width: 'w-32', editable: true },
  { key: 'fecha_vencimiento', label: 'Fecha Vencimiento', type: 'date', width: 'w-32', editable: true },
  { key: 'categ', label: 'CATEG', type: 'text', width: 'w-24', editable: true },
  { key: 'centro_costo', label: 'Centro Costo', type: 'text', width: 'w-28', editable: true },
  { key: 'cuit_proveedor', label: 'CUIT Proveedor', type: 'text', width: 'w-32', editable: false }, // Solo lectura (viene de fuente)
  { key: 'nombre_proveedor', label: 'Nombre Proveedor', type: 'text', width: 'w-48', editable: false }, // Solo lectura (viene de fuente)
  { key: 'detalle', label: 'Detalle', type: 'text', width: 'w-64', editable: true },
  { key: 'debitos', label: 'Débitos', type: 'currency', width: 'w-32', align: 'text-right', editable: true },
  { key: 'creditos', label: 'Créditos', type: 'currency', width: 'w-32', align: 'text-right', editable: true },
  { key: 'saldo_cta_cte', label: 'SALDO CTA CTE', type: 'currency', width: 'w-36', align: 'text-right', editable: false } // Calculado
] as const

// Estados disponibles para edición
const ESTADOS_DISPONIBLES = [
  { value: 'pendiente', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'debito', label: 'Débito', color: 'bg-blue-100 text-blue-800' },
  { value: 'pagar', label: 'Pagar', color: 'bg-orange-100 text-orange-800' },
  { value: 'pagado', label: 'Pagado', color: 'bg-green-100 text-green-800' },
  { value: 'credito', label: 'Crédito', color: 'bg-purple-100 text-purple-800' },
  { value: 'conciliado', label: 'Conciliado', color: 'bg-gray-100 text-gray-800' }
]

// Interface para celda en edición
interface CeldaEnEdicion {
  filaId: string
  columna: string
  valor: string | number
}

export function VistaCashFlow() {
  const [filtros, setFiltros] = useState<CashFlowFilters | undefined>(undefined)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  
  // Estado para edición inline
  const [celdaEnEdicion, setCeldaEnEdicion] = useState<CeldaEnEdicion | null>(null)
  const [guardandoCambio, setGuardandoCambio] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Estado para cambio de estado (Shift+Click en débitos/créditos)
  const [filaParaCambioEstado, setFilaParaCambioEstado] = useState<CashFlowRow | null>(null)
  
  // Estado para modo PAGOS (Ctrl+Click botón PAGOS)
  const [modoPagos, setModoPagos] = useState(false)
  const [filasSeleccionadas, setFilasSeleccionadas] = useState<Set<string>>(new Set())
  const [cambiarFechaVenc, setCambiarFechaVenc] = useState(false)
  const [cambiarEstado, setCambiarEstado] = useState(true)
  const [valorFechaLote, setValorFechaLote] = useState('')
  const [valorEstadoLote, setValorEstadoLote] = useState('pagado')
  const [procesandoLote, setProcesandoLote] = useState(false)
  
  const { data, loading, error, estadisticas, cargarDatos, actualizarRegistro, actualizarBatch } = useMultiCashFlowData(filtros)

  // Formatear moneda argentina
  const formatearMoneda = (valor: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(valor)
  }

  // Formatear fecha (evitar problemas de zona horaria)
  const formatearFecha = (fecha: string | null): string => {
    if (!fecha) return '-'
    try {
      // Parsear fecha como local para evitar conversión UTC que resta 1 día
      const [year, month, day] = fecha.split('-')
      const fechaLocal = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      return fechaLocal.toLocaleDateString('es-AR')
    } catch {
      return fecha
    }
  }

  // Funciones para edición inline
  const iniciarEdicion = (fila: CashFlowRow, columna: typeof columnasDefinicion[number], event: React.MouseEvent) => {
    // Shift+Click en débitos/créditos = cambiar estado
    if (event.shiftKey && (columna.key === 'debitos' || columna.key === 'creditos')) {
      event.preventDefault()
      event.stopPropagation()
      iniciarCambioEstado(fila)
      return
    }
    
    // Ctrl+Click normal = editar campo
    if (!event.ctrlKey || !columna.editable) return
    
    event.preventDefault()
    event.stopPropagation()
    
    const valor = fila[columna.key as keyof CashFlowRow]
    setCeldaEnEdicion({
      filaId: fila.id,
      columna: columna.key,
      valor: valor || ''
    })
    
    // Focus al input después de renderizar
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }, 0)
  }

  const cancelarEdicion = () => {
    setCeldaEnEdicion(null)
  }

  // Funciones para cambio de estado (Shift+Click)
  const iniciarCambioEstado = (fila: CashFlowRow) => {
    setFilaParaCambioEstado(fila)
  }

  const cambiarEstado = async (nuevoEstado: string) => {
    if (!filaParaCambioEstado) return
    
    try {
      setGuardandoCambio(true)
      
      const exito = await actualizarRegistro(
        filaParaCambioEstado.id,
        'estado',
        nuevoEstado,
        filaParaCambioEstado.origen
      )

      if (exito) {
        toast.success(`Estado cambiado a: ${nuevoEstado}`)
        setFilaParaCambioEstado(null)
      } else {
        toast.error('Error al cambiar estado')
      }
    } catch (error) {
      console.error('Error cambiando estado:', error)
      toast.error('Error al cambiar estado')
    } finally {
      setGuardandoCambio(false)
    }
  }

  const guardarCambio = async () => {
    if (!celdaEnEdicion) return
    
    setGuardandoCambio(true)
    
    try {
      // Encontrar la fila original para obtener el origen
      const filaOriginal = data.find(f => f.id === celdaEnEdicion.filaId)
      if (!filaOriginal) {
        toast.error('Error: No se encontró el registro')
        return
      }

      // Mapear campo del Cash Flow al campo real de BD
      let campoReal = celdaEnEdicion.columna
      
      if (filaOriginal.origen === 'ARCA') {
        // Mapeo para facturas ARCA
        if (celdaEnEdicion.columna === 'debitos') {
          campoReal = 'monto_a_abonar' // Permite editar monto a pagar diferente al original
        } else if (celdaEnEdicion.columna === 'categ') {
          campoReal = 'cuenta_contable' // En ARCA, 'categ' se guarda como 'cuenta_contable'
        }
        // Para ARCA, los demás campos coinciden: detalle, fecha_estimada, fecha_vencimiento, etc.
      } else if (filaOriginal.origen === 'TEMPLATE') {
        // Mapeo para templates
        if (celdaEnEdicion.columna === 'debitos') {
          campoReal = 'monto'
        } else if (celdaEnEdicion.columna === 'detalle') {
          campoReal = 'descripcion' // En templates, 'detalle' se guarda como 'descripcion'
        }
        // Para templates: fecha_estimada, fecha_vencimiento coinciden
      }

      // Validar y convertir valor según tipo
      let valorFinal: any = celdaEnEdicion.valor
      const columna = columnasDefinicion.find(c => c.key === celdaEnEdicion.columna)
      
      if (columna?.type === 'currency') {
        valorFinal = parseFloat(String(valorFinal)) || 0
      } else if (columna?.type === 'date') {
        // Validar formato de fecha
        if (valorFinal && !Date.parse(String(valorFinal))) {
          toast.error('Formato de fecha inválido')
          return
        }
      }

      // Actualizar en BD
      const exito = await actualizarRegistro(
        celdaEnEdicion.filaId,
        campoReal,
        valorFinal,
        filaOriginal.origen
      )

      if (exito) {
        toast.success(`${columna?.label} actualizado correctamente`)
        setCeldaEnEdicion(null)
      } else {
        toast.error('Error al guardar cambio')
      }
    } catch (error) {
      console.error('Error guardando cambio:', error)
      toast.error('Error al guardar cambio')
    } finally {
      setGuardandoCambio(false)
    }
  }

  const manejarKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      guardarCambio()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelarEdicion()
    }
  }

  // Funciones para modo PAGOS
  const activarModoPagos = (event: React.MouseEvent) => {
    if (!event.ctrlKey) return
    event.preventDefault()
    setModoPagos(true)
    setFilasSeleccionadas(new Set())
    toast.success("Modo PAGOS activado. Selecciona filas con checkboxes")
  }

  const desactivarModoPagos = () => {
    setModoPagos(false)
    setFilasSeleccionadas(new Set())
    setCambiarFechaVenc(false)
    setCambiarEstado(true)
    setValorFechaLote('')
    setValorEstadoLote('pagado')
  }

  const toggleFilaSeleccionada = (filaId: string) => {
    setFilasSeleccionadas(prev => {
      const nueva = new Set(prev)
      if (nueva.has(filaId)) {
        nueva.delete(filaId)
      } else {
        nueva.add(filaId)
      }
      return nueva
    })
  }

  const aplicarCambiosLote = async () => {
    if (filasSeleccionadas.size === 0) {
      toast.error("Selecciona al menos una fila")
      return
    }

    if (!cambiarFechaVenc && !cambiarEstado) {
      toast.error("Selecciona al menos una opción: fecha vencimiento o estado")
      return
    }

    if (cambiarFechaVenc && !valorFechaLote) {
      toast.error("Ingresa una fecha válida")
      return
    }

    setProcesandoLote(true)

    try {
      // Preparar actualizaciones para todas las filas seleccionadas
      const actualizaciones: Array<{id: string, origen: 'ARCA' | 'TEMPLATE', campo: string, valor: any}> = []
      
      Array.from(filasSeleccionadas).forEach(filaId => {
        const fila = data.find(f => f.id === filaId)!
        
        // Si cambiar fecha vencimiento
        if (cambiarFechaVenc && valorFechaLote) {
          actualizaciones.push({
            id: filaId,
            origen: fila.origen,
            campo: 'fecha_vencimiento',
            valor: valorFechaLote
          })
          
          // Auto-sync: también actualizar fecha_estimada
          actualizaciones.push({
            id: filaId,
            origen: fila.origen,
            campo: 'fecha_estimada',
            valor: valorFechaLote
          })
        }
        
        // Si cambiar estado
        if (cambiarEstado) {
          actualizaciones.push({
            id: filaId,
            origen: fila.origen,
            campo: 'estado',
            valor: valorEstadoLote
          })
        }
      })

      const exito = await actualizarBatch(actualizaciones)

      if (exito) {
        const cambiosTexto = []
        if (cambiarFechaVenc) cambiosTexto.push('fecha vencimiento')
        if (cambiarEstado) cambiosTexto.push('estado')
        
        toast.success(`${filasSeleccionadas.size} registros actualizados: ${cambiosTexto.join(' y ')}`)
        desactivarModoPagos()
      } else {
        toast.error('Error al aplicar cambios por lote')
      }
    } catch (error) {
      console.error('Error en aplicarCambiosLote:', error)
      toast.error('Error al aplicar cambios por lote')
    } finally {
      setProcesandoLote(false)
    }
  }

  // Renderizar celda según tipo (con soporte para edición inline)
  const renderizarCelda = (fila: CashFlowRow, columna: typeof columnasDefinicion[number]) => {
    const valor = fila[columna.key as keyof CashFlowRow]
    const esCeldaEnEdicion = celdaEnEdicion?.filaId === fila.id && celdaEnEdicion?.columna === columna.key
    
    // Si esta celda está en edición, mostrar input
    if (esCeldaEnEdicion) {
      return (
        <div className={`${columna.width} ${columna.align || ''} relative`}>
          <div className="flex items-center gap-1">
            {columna.type === 'date' ? (
              <Input
                ref={inputRef}
                type="date"
                value={String(celdaEnEdicion.valor)}
                onChange={(e) => setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
                onKeyDown={manejarKeyDown}
                onBlur={guardarCambio}
                className="h-6 text-xs p-1 w-full"
                disabled={guardandoCambio}
              />
            ) : columna.type === 'currency' ? (
              <Input
                ref={inputRef}
                type="number"
                step="0.01"
                value={String(celdaEnEdicion.valor)}
                onChange={(e) => setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
                onKeyDown={manejarKeyDown}
                onBlur={guardarCambio}
                className="h-6 text-xs p-1 w-full text-right"
                disabled={guardandoCambio}
              />
            ) : (
              <Input
                ref={inputRef}
                type="text"
                value={String(celdaEnEdicion.valor)}
                onChange={(e) => setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
                onKeyDown={manejarKeyDown}
                onBlur={guardarCambio}
                className="h-6 text-xs p-1 w-full"
                disabled={guardandoCambio}
              />
            )}
            
            {/* Botones de acción */}
            <div className="flex gap-1">
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
          </div>
        </div>
      )
    }

    // Celda normal con click handler
    const contenido = (() => {
      switch (columna.type) {
        case 'date':
          return formatearFecha(valor as string)
        
        case 'currency':
          // Colorización según estado para débitos/créditos
          let colorClase = 'text-black' // Por defecto números negros
          if (columna.key === 'debitos') {
            if (fila.estado === 'pagado') {
              colorClase = 'text-white bg-green-600 px-2 py-1 rounded'
            } else if (fila.estado === 'pagar') {
              colorClase = 'text-black bg-yellow-300 px-2 py-1 rounded'
            }
          }
          
          return (
            <span className={`font-mono ${colorClase}`}>
              {formatearMoneda(valor as number)}
            </span>
          )
        
        case 'text':
        default:
          return valor || '-'
      }
    })()

    return (
      <div 
        className={`
          ${columna.width} 
          ${columna.align || ''} 
          ${columna.editable ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'} 
          ${columna.editable ? 'border-l-2 border-l-transparent hover:border-l-blue-300' : ''}
          truncate p-1 transition-colors
        `}
        title={`${valor || '-'}${columna.editable ? ' (Ctrl+Click para editar)' : ''}`}
        onClick={(e) => iniciarEdicion(fila, columna, e)}
      >
        {columna.editable && (
          <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 float-right" />
        )}
        {contenido}
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-8 w-8 animate-spin" />
          <span>Cargando Cash Flow...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="text-red-600 mb-4">Error al cargar Cash Flow</div>
            <div className="text-sm text-gray-600 mb-4">{error}</div>
            <Button onClick={cargarDatos} variant="outline">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Registros</p>
                <p className="text-2xl font-bold">{estadisticas.total_registros}</p>
              </div>
              <DollarSign className="h-8 w-8 text-gray-400" />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {estadisticas.registros_arca} ARCA + {estadisticas.registros_templates} Templates
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Débitos</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatearMoneda(estadisticas.total_debitos)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Créditos</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatearMoneda(estadisticas.total_creditos)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Saldo Final</p>
                <p className={`text-2xl font-bold ${estadisticas.saldo_final >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatearMoneda(estadisticas.saldo_final)}
                </p>
              </div>
              <DollarSign className={`h-8 w-8 ${estadisticas.saldo_final >= 0 ? 'text-green-400' : 'text-red-400'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cash Flow - Vista en Tiempo Real
              <Badge variant="secondary" className="text-xs">
                <Edit3 className="h-3 w-3 mr-1" />
                Ctrl+Click para editar
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
              <Button 
                variant={modoPagos ? "default" : "outline"}
                size="sm"
                onClick={modoPagos ? desactivarModoPagos : activarModoPagos}
                title="Ctrl+Click para activar modo PAGOS"
              >
                <Receipt className="h-4 w-4 mr-2" />
                {modoPagos ? 'Cancelar PAGOS' : 'PAGOS'}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={cargarDatos}
              >
                Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filtros (placeholder para PASO 6) */}
          {mostrarFiltros && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">
                🔄 Filtros avanzados se implementarán en PASO 6
                <br />
                Por ahora muestra todos los registros con estado ≠ 'conciliado' AND estado ≠ 'credito'
              </div>
            </div>
          )}

          {/* Panel modo PAGOS */}
          {modoPagos && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-blue-800">
                    💰 Modo PAGOS - {filasSeleccionadas.size} filas seleccionadas
                  </h4>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Checkboxes independientes */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="cambiar-fecha"
                      checked={cambiarFechaVenc}
                      onCheckedChange={setCambiarFechaVenc}
                    />
                    <Label htmlFor="cambiar-fecha">Cambiar fecha vencimiento</Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="cambiar-estado"
                      checked={cambiarEstado}
                      onCheckedChange={setCambiarEstado}
                    />
                    <Label htmlFor="cambiar-estado">Cambiar estado</Label>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Inputs para ambas opciones */}
                  {cambiarFechaVenc && (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Fecha:</Label>
                      <Input
                        type="date"
                        value={valorFechaLote}
                        onChange={(e) => setValorFechaLote(e.target.value)}
                        placeholder="Nueva fecha vencimiento"
                        className="w-40"
                      />
                    </div>
                  )}
                  
                  {cambiarEstado && (
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Estado:</Label>
                      <Select value={valorEstadoLote} onValueChange={setValorEstadoLote}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ESTADOS_DISPONIBLES.map((estado) => (
                            <SelectItem key={estado.value} value={estado.value}>
                              {estado.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button
                    onClick={aplicarCambiosLote}
                    disabled={filasSeleccionadas.size === 0 || procesandoLote || (!cambiarFechaVenc && !cambiarEstado)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {procesandoLote ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Aplicando...
                      </>
                    ) : (
                      `Aplicar a ${filasSeleccionadas.size} filas`
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tabla Cash Flow */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                {/* Header */}
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {/* Columna checkbox solo en modo PAGOS */}
                    {modoPagos && (
                      <th className="p-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                        Sel.
                      </th>
                    )}
                    
                    {columnasDefinicion.map((col) => (
                      <th 
                        key={col.key} 
                        className={`p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.width}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Body */}
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan={columnasDefinicion.length + (modoPagos ? 1 : 0)} className="p-8 text-center text-gray-500">
                        No hay datos para mostrar en Cash Flow
                        <br />
                        <span className="text-xs">
                          Verifica que existan facturas ARCA o templates con estado pendiente/pagar/debito
                        </span>
                      </td>
                    </tr>
                  ) : (
                    data.map((fila, index) => (
                      <tr 
                        key={fila.id} 
                        className={`group hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'} ${filasSeleccionadas.has(fila.id) ? 'bg-blue-50' : ''}`}
                      >
                        {/* Checkbox solo en modo PAGOS */}
                        {modoPagos && (
                          <td className="p-3 text-center">
                            <Checkbox
                              checked={filasSeleccionadas.has(fila.id)}
                              onCheckedChange={() => toggleFilaSeleccionada(fila.id)}
                            />
                          </td>
                        )}
                        
                        {/* Columnas de datos */}
                        {columnasDefinicion.map((col) => (
                          <td key={col.key} className="p-3 text-sm">
                            {renderizarCelda(fila, col)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer con información */}
          {data.length > 0 && (
            <div className="mt-4 text-sm text-gray-500 text-center">
              Mostrando {data.length} registros ordenados por fecha estimada
              <br />
              💡 PASO 4 ✅ Edición Ctrl+Click | PASO 5 ✅ Modo PAGOS Ctrl+Click | Estados: 🟢 pagado, 🟡 pagar
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal cambio de estado (Shift+Click débitos/créditos) */}
      {filaParaCambioEstado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Cambiar Estado
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {filaParaCambioEstado.nombre_proveedor}
            </p>
            
            <div className="grid grid-cols-2 gap-2">
              {ESTADOS_DISPONIBLES.map((estado) => (
                <Button
                  key={estado.value}
                  variant={filaParaCambioEstado.estado === estado.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => cambiarEstado(estado.value)}
                  disabled={guardandoCambio}
                  className="justify-start"
                >
                  <Badge variant="outline" className={`mr-2 ${estado.color}`}>
                    {estado.label}
                  </Badge>
                </Button>
              ))}
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilaParaCambioEstado(null)}
                disabled={guardandoCambio}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}