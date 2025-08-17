"use client"

import { useState, useRef } from "react"
import { useMultiCashFlowData, type CashFlowRow, type CashFlowFilters } from "@/hooks/useMultiCashFlowData"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  
  const { data, loading, error, estadisticas, cargarDatos, actualizarRegistro } = useMultiCashFlowData(filtros)

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
    // Solo activar con Ctrl+Click y si la columna es editable
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
          const esNegativo = (valor as number) < 0
          return (
            <span className={`font-mono ${esNegativo ? 'text-red-600' : 'text-green-600'}`}>
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

          {/* Tabla Cash Flow */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                {/* Header */}
                <thead className="bg-gray-50 border-b">
                  <tr>
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
                      <td colSpan={columnasDefinicion.length} className="p-8 text-center text-gray-500">
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
                        className={`group hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}
                      >
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
              💡 PASO 4 ✅ Edición Ctrl+Click activa | PASO 5 🔄 Próximo: modo PAGOS
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}