"use client"

import { useState } from "react"
import { useMultiCashFlowData, type CashFlowRow, type CashFlowFilters } from "@/hooks/useMultiCashFlowData"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Receipt, Calendar, TrendingUp, TrendingDown, DollarSign, Filter } from "lucide-react"

// Definición de columnas Cash Flow
const columnasDefinicion = [
  { key: 'fecha_estimada', label: 'FECHA Estimada', type: 'date', width: 'w-32' },
  { key: 'fecha_vencimiento', label: 'Fecha Vencimiento', type: 'date', width: 'w-32' },
  { key: 'categ', label: 'CATEG', type: 'text', width: 'w-24' },
  { key: 'centro_costo', label: 'Centro Costo', type: 'text', width: 'w-28' },
  { key: 'cuit_proveedor', label: 'CUIT Proveedor', type: 'text', width: 'w-32' },
  { key: 'nombre_proveedor', label: 'Nombre Proveedor', type: 'text', width: 'w-48' },
  { key: 'detalle', label: 'Detalle', type: 'text', width: 'w-64' },
  { key: 'debitos', label: 'Débitos', type: 'currency', width: 'w-32', align: 'text-right' },
  { key: 'creditos', label: 'Créditos', type: 'currency', width: 'w-32', align: 'text-right' },
  { key: 'saldo_cta_cte', label: 'SALDO CTA CTE', type: 'currency', width: 'w-36', align: 'text-right' },
  { key: 'registro_contable', label: 'Reg. Contable', type: 'text', width: 'w-28' },
  { key: 'registro_interno', label: 'Reg. Interno', type: 'text', width: 'w-28' }
] as const

export function VistaCashFlow() {
  const [filtros, setFiltros] = useState<CashFlowFilters | undefined>(undefined)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  
  const { data, loading, error, estadisticas, cargarDatos } = useMultiCashFlowData(filtros)

  // Formatear moneda argentina
  const formatearMoneda = (valor: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(valor)
  }

  // Formatear fecha
  const formatearFecha = (fecha: string | null): string => {
    if (!fecha) return '-'
    try {
      return new Date(fecha).toLocaleDateString('es-AR')
    } catch {
      return fecha
    }
  }

  // Obtener badge de origen
  const BadgeOrigen = ({ fila }: { fila: CashFlowRow }) => {
    if (fila.origen === 'ARCA') {
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
          <Receipt className="w-3 h-3 mr-1" />
          ARCA
        </Badge>
      )
    } else {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200">
          <Calendar className="w-3 h-3 mr-1" />
          TEMPLATE
        </Badge>
      )
    }
  }

  // Obtener badge de estado
  const BadgeEstado = ({ estado }: { estado: string }) => {
    const estilos = {
      'pendiente': 'bg-yellow-100 text-yellow-800',
      'pagar': 'bg-orange-100 text-orange-800',
      'debito': 'bg-red-100 text-red-800',
      'pagado': 'bg-gray-100 text-gray-800',
      'credito': 'bg-purple-100 text-purple-800',
      'conciliado': 'bg-green-100 text-green-800'
    }

    return (
      <Badge 
        variant="outline" 
        className={estilos[estado as keyof typeof estilos] || 'bg-gray-100 text-gray-800'}
      >
        {estado}
      </Badge>
    )
  }

  // Renderizar celda según tipo
  const renderizarCelda = (fila: CashFlowRow, columna: typeof columnasDefinicion[number]) => {
    const valor = fila[columna.key as keyof CashFlowRow]

    switch (columna.type) {
      case 'date':
        return (
          <div className={`${columna.width} ${columna.align || ''}`}>
            {formatearFecha(valor as string)}
          </div>
        )
      
      case 'currency':
        const esNegativo = (valor as number) < 0
        return (
          <div className={`${columna.width} ${columna.align || ''} font-mono`}>
            <span className={esNegativo ? 'text-red-600' : 'text-green-600'}>
              {formatearMoneda(valor as number)}
            </span>
          </div>
        )
      
      case 'text':
      default:
        return (
          <div className={`${columna.width} ${columna.align || ''} truncate`} title={valor as string}>
            {valor || '-'}
          </div>
        )
    }
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
                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Origen
                    </th>
                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Estado
                    </th>
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
                      <td colSpan={columnasDefinicion.length + 2} className="p-8 text-center text-gray-500">
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
                        className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}
                      >
                        {/* Columna Origen */}
                        <td className="p-3">
                          <BadgeOrigen fila={fila} />
                        </td>

                        {/* Columna Estado */}
                        <td className="p-3">
                          <BadgeEstado estado={fila.estado} />
                        </td>

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
              💡 En PASO 4 se implementará edición con Ctrl+Click | En PASO 5 modo PAGOS
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}