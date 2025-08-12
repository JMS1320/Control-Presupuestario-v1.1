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
  fc: string | null
  cuenta_contable: string | null
  centro_costo: string | null
  estado: string
  observaciones_pago: string | null
  detalle: string | null
  archivo_origen: string | null
  created_at: string
}

// Configuración de columnas disponibles
const COLUMNAS_CONFIG = {
  fecha_emision: { label: "Fecha Emisión", visible: true },
  tipo_comprobante: { label: "Tipo Comp.", visible: true },
  punto_venta: { label: "Punto Venta", visible: true },
  numero_desde: { label: "Número Desde", visible: true },
  numero_hasta: { label: "Número Hasta", visible: false }, // Oculta por defecto
  codigo_autorizacion: { label: "Cód. Autorización", visible: false }, // Oculta por defecto
  tipo_doc_emisor: { label: "Tipo Doc.", visible: true },
  cuit: { label: "CUIT", visible: true },
  denominacion_emisor: { label: "Proveedor", visible: true },
  tipo_cambio: { label: "Tipo Cambio", visible: false },
  moneda: { label: "Moneda", visible: false },
  imp_neto_gravado: { label: "Neto Gravado", visible: true },
  imp_neto_no_gravado: { label: "Neto No Gravado", visible: false },
  imp_op_exentas: { label: "Op. Exentas", visible: false },
  otros_tributos: { label: "Otros Tributos", visible: false },
  iva: { label: "IVA", visible: true },
  imp_total: { label: "Total", visible: true },
  campana: { label: "Campaña", visible: false },
  fc: { label: "FC", visible: false },
  cuenta_contable: { label: "Cuenta Contable", visible: false },
  centro_costo: { label: "Centro Costo", visible: false },
  estado: { label: "Estado", visible: true },
  observaciones_pago: { label: "Obs. Pago", visible: false },
  detalle: { label: "Detalle", visible: false },
  archivo_origen: { label: "Archivo Origen", visible: false },
  created_at: { label: "Fecha Importación", visible: false }
} as const

export function VistaFacturasArca() {
  const [facturas, setFacturas] = useState<FacturaArca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [columnasVisibles, setColumnasVisibles] = useState<Record<string, boolean>>(
    Object.fromEntries(
      Object.entries(COLUMNAS_CONFIG).map(([key, config]) => [key, config.visible])
    )
  )

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

  // Formatear fecha
  const formatearFecha = (fecha: string): string => {
    try {
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
      case 'created_at':
        return formatearFecha(valor as string)
      
      case 'imp_neto_gravado':
      case 'imp_neto_no_gravado':
      case 'imp_op_exentas':
      case 'otros_tributos':
      case 'iva':
      case 'imp_total':
      case 'tipo_cambio':
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columnasVisiblesArray.map(columna => (
                      <TableHead key={columna}>
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
                          <TableCell key={columna}>
                            {renderizarCelda(factura, columna)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}