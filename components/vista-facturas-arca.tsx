"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Settings2, Receipt, Info, Eye, EyeOff } from "lucide-react"
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
  numero_hasta: { label: "Número Hasta", visible: true, width: "140px" },
  codigo_autorizacion: { label: "Cód. Autorización", visible: true, width: "160px" },
  tipo_doc_emisor: { label: "Tipo Doc.", visible: true, width: "100px" },
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
  archivo_origen: { label: "Archivo Origen", visible: true, width: "200px" },
  fecha_importacion: { label: "Fecha Importación", visible: true, width: "150px" },
  fecha_modificacion: { label: "Fecha Modificación", visible: true, width: "150px" },
  fecha_estimada: { label: "Fecha Estimada", visible: true, width: "130px" },
  fecha_vencimiento: { label: "Fecha Vencimiento", visible: true, width: "150px" },
  monto_a_abonar: { label: "Monto a Abonar", visible: true, width: "140px" },
  created_at: { label: "Created At", visible: true, width: "150px" }
} as const

export function VistaFacturasArca() {
  const [facturas, setFacturas] = useState<FacturaArca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
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

      setFacturas(data || [])
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

  // Obtener columnas visibles
  const columnasVisiblesArray = Object.entries(columnasVisibles)
    .filter(([_, visible]) => visible)
    .map(([key]) => key as keyof FacturaArca)

  // Renderizar valor de celda según el tipo de columna
  const renderizarCelda = (factura: FacturaArca, columna: keyof FacturaArca) => {
    const valor = factura[columna]

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
        return formatearFecha(valor as string)
      
      case 'imp_neto_gravado':
      case 'imp_neto_no_gravado':
      case 'imp_op_exentas':
      case 'otros_tributos':
      case 'iva':
      case 'imp_total':
      case 'tipo_cambio':
      case 'monto_a_abonar':
        return formatearNumero(valor as number)
      
      case 'denominacion_emisor':
        return (
          <div className="max-w-xs truncate" title={valor as string}>
            {valor as string}
          </div>
        )
      
      case 'estado':
        return (
          <Badge variant={valor === 'pendiente' ? 'secondary' : 'default'}>
            {valor as string}
          </Badge>
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
          <h2 className="text-2xl font-bold tracking-tight">Facturas ARCA - MSA</h2>
          <p className="text-muted-foreground">
            Gestión de comprobantes recibidos importados desde ARCA
          </p>
        </div>
        
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