"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Plus, RefreshCw, Beef, Wheat, Package, Edit3, Syringe, ShoppingCart, Trash2, Download, CheckCircle2, Pencil } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import useInlineEditor from "@/hooks/useInlineEditor"

// ============================================================
// TIPOS
// ============================================================

interface CategoriaHacienda {
  id: string
  nombre: string
  activo: boolean
}

interface StockHacienda {
  id: string
  categoria_id: string
  cantidad: number
  peso_promedio_kg: number | null
  campo: string | null
  observaciones: string | null
  updated_at: string
  categorias_hacienda?: { nombre: string }
}

interface MovimientoHacienda {
  id: string
  fecha: string
  categoria_id: string
  tipo: string
  cantidad: number
  peso_total_kg: number | null
  precio_por_kg: number | null
  monto_total: number | null
  campo_origen: string | null
  campo_destino: string | null
  proveedor_cliente: string | null
  cuit: string | null
  observaciones: string | null
  created_at: string
  categorias_hacienda?: { nombre: string }
}

interface CategoriaInsumo {
  id: string
  nombre: string
  unidad_medida: string
  activo: boolean
}

interface StockInsumo {
  id: string
  categoria_id: number
  producto: string
  cantidad: number
  unidad_medida: string
  costo_unitario: number | null
  observaciones: string | null
  updated_at: string
  categorias_insumo?: { nombre: string; unidad_medida: string }
}

interface MovimientoInsumo {
  id: string
  fecha: string
  insumo_stock_id: string | null
  tipo: string
  cantidad: number
  costo_unitario: number | null
  monto_total: number | null
  destino_campo: string | null
  proveedor: string | null
  cuit: string | null
  observaciones: string | null
  created_at: string
  stock_insumos?: { producto: string; categorias_insumo?: { nombre: string } }
}

interface OrdenAplicacionRodeo {
  id: string
  orden_id: string
  categoria_hacienda_id: string
  cantidad_cabezas: number
  categorias_hacienda?: { nombre: string }
}

interface OrdenAplicacion {
  id: string
  fecha: string
  categoria_hacienda_id: string | null
  cantidad_cabezas: number
  peso_promedio_kg: number | null
  estado: string
  observaciones: string | null
  created_at: string
  categorias_hacienda?: { nombre: string }
  lineas?: LineaOrdenAplicacion[]
  rodeos?: OrdenAplicacionRodeo[]
  labores?: string[]
}

interface LineaOrdenAplicacion {
  id: string
  orden_id: string
  insumo_nombre: string
  insumo_stock_id: string | null
  tipo_dosis: string
  dosis_ml: number
  dosis_cada_kg: number | null
  peso_promedio_kg: number | null
  cantidad_total_ml: number
  unidad_medida: string
  observaciones: string | null
  recuento: boolean
  cantidad_recuento: number | null
  created_at: string
}

interface LineaFormulario {
  key: number
  insumo_nombre: string
  insumo_stock_id: string
  tipo_dosis: 'por_cabeza' | 'por_kilo' | 'por_dosis'
  dosis_ml: string
  dosis_cada_kg: string
}

interface LoteAgricola {
  id: string
  nombre_lote: string
  campo: string | null
  hectareas: number
  cultivo: string
  campaña: string | null
  fecha_siembra: string | null
  fecha_cosecha_estimada: string | null
  estado: string
  observaciones: string | null
  created_at: string
}

// ============================================================
// HELPERS
// ============================================================

const formatoMoneda = (valor: number | null): string => {
  if (valor === null || valor === undefined) return '-'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valor)
}

const formatoFecha = (fecha: string | null): string => {
  if (!fecha) return '-'
  const d = new Date(fecha + 'T00:00:00')
  return d.toLocaleDateString('es-AR')
}

const formatoNumero = (valor: number | null): string => {
  if (valor === null || valor === undefined) return '-'
  return new Intl.NumberFormat('es-AR').format(valor)
}

const formatoCantidad = (cantidad: number, unidad: string): string => {
  if (unidad === 'dosis') {
    return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(cantidad)} dosis`
  }
  if (cantidad >= 1000) {
    return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(cantidad / 1000)} L`
  }
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(cantidad)} ml`
}

const calcularTotal = (
  tipoDosis: string,
  dosis: number,
  cantidadCabezas: number,
  dosisCadaKg?: number | null,
  pesoPromedioKg?: number | null
): { total: number; unidad: string } => {
  if (tipoDosis === 'por_dosis') {
    // 1 dosis por cabeza (dosis = cantidad de dosis por animal, usualmente 1)
    return { total: dosis * cantidadCabezas, unidad: 'dosis' }
  }
  if (tipoDosis === 'por_cabeza') {
    return { total: dosis * cantidadCabezas, unidad: 'ml' }
  }
  // por_kilo: (peso_promedio / cada_kg) * dosis_ml * cantidad_cabezas
  if (dosisCadaKg && pesoPromedioKg) {
    return { total: (pesoPromedioKg / dosisCadaKg) * dosis * cantidadCabezas, unidad: 'ml' }
  }
  return { total: 0, unidad: 'ml' }
}

// Calcula la dosis individual que se aplica a cada animal
const dosisPorCabeza = (
  tipoDosis: string,
  dosis: number,
  dosisCadaKg?: number | null,
  pesoPromedioKg?: number | null
): { valor: number; texto: string } => {
  if (tipoDosis === 'por_dosis') {
    return { valor: dosis, texto: `${dosis} dosis` }
  }
  if (tipoDosis === 'por_cabeza') {
    return { valor: dosis, texto: `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(dosis)} ml` }
  }
  // por_kilo
  if (dosisCadaKg && pesoPromedioKg) {
    const mlPorCabeza = (pesoPromedioKg / dosisCadaKg) * dosis
    return { valor: mlPorCabeza, texto: `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(mlPorCabeza)} ml` }
  }
  return { valor: 0, texto: '-' }
}

// Wraps text on canvas, returns number of lines used
const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number => {
  const words = text.split(' ')
  let line = ''
  let linesUsed = 0
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' '
    if (ctx.measureText(testLine).width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), x, y + linesUsed * lineHeight)
      line = words[i] + ' '
      linesUsed++
    } else {
      line = testLine
    }
  }
  if (line.trim()) {
    ctx.fillText(line.trim(), x, y + linesUsed * lineHeight)
    linesUsed++
  }
  return linesUsed
}

// Genera imagen PNG de la orden para enviar por WhatsApp
// Dibujar marca/hierro NZ en canvas
const dibujarMarcaNZ = (ctx: CanvasRenderingContext2D, x: number, y: number, escala: number = 1) => {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(escala, escala)
  ctx.strokeStyle = '#2c1810'
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Parte izquierda: curva tipo "señal" (gancho/J invertida)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 28)
  ctx.quadraticCurveTo(0, 42, 14, 42)
  ctx.quadraticCurveTo(28, 42, 28, 28)
  ctx.lineTo(28, 18)
  ctx.stroke()

  // Parte inferior: L angular
  ctx.beginPath()
  ctx.moveTo(0, 56)
  ctx.lineTo(0, 48)
  ctx.lineTo(14, 48)
  ctx.stroke()

  // Asterisco/estrella (marca *)
  const cx = 38, cy = 10
  const r = 7
  for (let i = 0; i < 3; i++) {
    const angle = (i * 60) * Math.PI / 180
    ctx.beginPath()
    ctx.moveTo(cx - Math.cos(angle) * r, cy - Math.sin(angle) * r)
    ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r)
    ctx.stroke()
  }

  ctx.restore()
}

const exportarOrdenImagen = (orden: OrdenAplicacion) => {
  const lineas = orden.lineas || []
  const padding = 30
  const tableHeaderH = 32
  const rowH = 28
  const canvasW = 720
  const obsLineH = 17

  // Colores sobrios ganaderos
  const colPrimario = '#2c1810'    // Marrón oscuro
  const colSecundario = '#5a3a28'  // Marrón medio
  const colTerciario = '#8b7355'   // Marrón claro
  const colFondo = '#faf8f5'       // Crema
  const colLinea = '#c4a882'       // Dorado/arena
  const colTablaHeader = '#3d2b1f' // Marrón tabla header
  const colTablaAlt = '#f5f0ea'    // Crema alternado

  // Pre-calcular alto de observaciones
  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')
  let obsLines = 0
  if (tempCtx && orden.observaciones) {
    tempCtx.font = '12px Georgia'
    const words = orden.observaciones.split(' ')
    let line = ''
    const maxW = canvasW - padding * 2 - 30
    for (const word of words) {
      const test = line + word + ' '
      if (tempCtx.measureText(test).width > maxW && line !== '') {
        obsLines++
        line = word + ' '
      } else {
        line = test
      }
    }
    if (line.trim()) obsLines++
  }

  const laboresOrden = orden.labores || []
  const laboresH = laboresOrden.length > 0 ? 28 : 0

  const brandHeaderH = 85
  const infoH = 80
  const obsH = obsLines > 0 ? obsLines * obsLineH + 10 : 0
  const headerH = brandHeaderH + infoH + obsH + laboresH
  const tableH = lineas.length > 0 ? tableHeaderH + (lineas.length * rowH) : 0
  const canvasH = headerH + tableH + padding * 2 + 35

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Fondo crema
  ctx.fillStyle = colFondo
  ctx.fillRect(0, 0, canvasW, canvasH)

  // Linea superior decorativa
  ctx.fillStyle = colPrimario
  ctx.fillRect(0, 0, canvasW, 4)

  // === CABECERA CON MARCA ===
  // Marca/hierro NZ a la izquierda
  dibujarMarcaNZ(ctx, padding + 5, 18, 1.1)

  // Rótulo estancia
  ctx.fillStyle = colPrimario
  ctx.font = 'bold 11px Georgia'
  ctx.letterSpacing = '3px'
  ctx.fillText('E S T A N C I A', padding + 75, 30)
  ctx.letterSpacing = '0px'

  ctx.font = 'bold 26px Georgia'
  ctx.fillText('NAZARENAS', padding + 75, 56)

  ctx.font = 'italic 13px Georgia'
  ctx.fillStyle = colSecundario
  ctx.fillText('De Martinez Sobrado', padding + 77, 72)

  // Titulo orden - derecha
  ctx.textAlign = 'right'
  ctx.fillStyle = colPrimario
  ctx.font = 'bold 16px Georgia'
  ctx.fillText('ORDEN DE APLICACIÓN', canvasW - padding, 35)

  ctx.font = '13px Georgia'
  ctx.fillStyle = colSecundario
  ctx.fillText(`${formatoFecha(orden.fecha)}`, canvasW - padding, 55)

  ctx.font = '11px Georgia'
  ctx.fillStyle = colTerciario
  const estadoTexto = orden.estado === 'ejecutada' ? '● EJECUTADA' : orden.estado === 'eliminada' ? '✕ ELIMINADA' : '○ PLANIFICADA'
  ctx.fillText(estadoTexto, canvasW - padding, 72)
  ctx.textAlign = 'left'

  // Linea separadora bajo cabecera
  ctx.strokeStyle = colLinea
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padding, brandHeaderH)
  ctx.lineTo(canvasW - padding, brandHeaderH)
  ctx.stroke()

  // === INFO ORDEN ===
  const infoY = brandHeaderH + 8
  ctx.font = '13px Georgia'
  ctx.fillStyle = colPrimario

  const rodeoNombres = orden.rodeos && orden.rodeos.length > 0
    ? orden.rodeos.map(r => r.categorias_hacienda?.nombre || '-').join(', ')
    : orden.categorias_hacienda?.nombre || '-'

  // Fila 1
  ctx.font = 'bold 12px Georgia'
  ctx.fillText('Rodeo:', padding, infoY + 18)
  ctx.font = '13px Georgia'
  ctx.fillText(rodeoNombres, padding + 52, infoY + 18)

  // Fila 2
  ctx.font = 'bold 12px Georgia'
  ctx.fillText('Cabezas:', padding, infoY + 38)
  ctx.font = '13px Georgia'
  ctx.fillText(String(orden.cantidad_cabezas), padding + 62, infoY + 38)

  if (orden.peso_promedio_kg) {
    ctx.font = 'bold 12px Georgia'
    ctx.fillText('Peso prom.:', padding + 160, infoY + 38)
    ctx.font = '13px Georgia'
    ctx.fillText(`${orden.peso_promedio_kg} kg/cab`, padding + 240, infoY + 38)
  }

  // Observaciones
  let nextY = infoY + 55
  if (orden.observaciones) {
    ctx.font = 'bold 12px Georgia'
    ctx.fillStyle = colSecundario
    ctx.fillText('Obs:', padding, nextY)
    ctx.font = '12px Georgia'
    wrapText(ctx, orden.observaciones, padding + 35, nextY, canvasW - padding * 2 - 35, obsLineH)
    nextY += obsH
  }

  // Labores
  if (laboresOrden.length > 0) {
    const laboresY = brandHeaderH + infoH + obsH + 5
    ctx.font = 'bold 12px Georgia'
    ctx.fillStyle = colPrimario
    ctx.fillText('Labores:', padding, laboresY)
    ctx.font = '13px Georgia'
    ctx.fillStyle = colSecundario
    ctx.fillText(laboresOrden.join('  ·  '), padding + 60, laboresY)
  }

  // === TABLA INSUMOS ===
  if (lineas.length > 0) {
    const tableY = headerH + padding - 10

    // Header tabla
    ctx.fillStyle = colTablaHeader
    ctx.fillRect(padding, tableY, canvasW - padding * 2, tableHeaderH)
    ctx.fillStyle = '#f5f0ea'
    ctx.font = 'bold 11px Georgia'
    ctx.fillText('INSUMO', padding + 10, tableY + 21)
    ctx.fillText('DOSIS/CAB', 330, tableY + 21)
    ctx.fillText('TOTAL NECESARIO', 490, tableY + 21)

    // Filas
    lineas.forEach((l, i) => {
      const y = tableY + tableHeaderH + (i * rowH)
      ctx.fillStyle = i % 2 === 0 ? colTablaAlt : colFondo
      ctx.fillRect(padding, y, canvasW - padding * 2, rowH)

      ctx.fillStyle = colPrimario
      ctx.font = 'bold 13px Georgia'
      ctx.fillText(l.insumo_nombre, padding + 10, y + 19)
      ctx.font = '13px Georgia'
      ctx.fillStyle = colSecundario
      const dpc = dosisPorCabeza(l.tipo_dosis, l.dosis_ml, l.dosis_cada_kg, l.peso_promedio_kg || orden.peso_promedio_kg)
      ctx.fillText(dpc.texto, 330, y + 19)
      ctx.fillText(formatoCantidad(l.cantidad_total_ml, l.unidad_medida || 'ml'), 490, y + 19)
    })

    // Borde tabla
    const tableEndY = tableY + tableHeaderH + (lineas.length * rowH)
    ctx.strokeStyle = colLinea
    ctx.lineWidth = 0.5
    ctx.strokeRect(padding, tableY, canvasW - padding * 2, tableEndY - tableY)
  }

  // === FOOTER ===
  // Linea inferior decorativa
  ctx.strokeStyle = colLinea
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(padding, canvasH - 25)
  ctx.lineTo(canvasW - padding, canvasH - 25)
  ctx.stroke()

  ctx.fillStyle = colTerciario
  ctx.font = '10px Georgia'
  ctx.fillText(`Generado: ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`, padding, canvasH - 10)
  ctx.textAlign = 'right'
  ctx.font = 'italic 10px Georgia'
  ctx.fillText('Ea. Nazarenas — Martinez Sobrado Agro SRL', canvasW - padding, canvasH - 10)
  ctx.textAlign = 'left'

  // Linea inferior gruesa
  ctx.fillStyle = colPrimario
  ctx.fillRect(0, canvasH - 4, canvasW, 4)

  // Descargar
  const link = document.createElement('a')
  link.download = `Orden_Aplicacion_${orden.fecha}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function VistaSectorProductivo() {
  const [tabActiva, setTabActiva] = useState("hacienda")

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            Sector Productivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tabActiva} onValueChange={setTabActiva}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="hacienda" className="flex items-center gap-2">
                <Beef className="h-4 w-4" />
                Hacienda
              </TabsTrigger>
              <TabsTrigger value="insumos" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Insumos
              </TabsTrigger>
              <TabsTrigger value="lotes" className="flex items-center gap-2">
                <Wheat className="h-4 w-4" />
                Lotes Agricolas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hacienda">
              <TabHacienda />
            </TabsContent>
            <TabsContent value="insumos">
              <TabInsumos />
            </TabsContent>
            <TabsContent value="lotes">
              <TabLotesAgricolas />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// TAB HACIENDA
// ============================================================

const TIPOS_MOV_HACIENDA = [
  { value: 'compra', label: 'Compra' },
  { value: 'venta', label: 'Venta' },
  { value: 'nacimiento', label: 'Nacimiento' },
  { value: 'mortandad', label: 'Mortandad' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'ajuste_stock', label: 'Ajuste de Stock' },
]

function TabHacienda() {
  const [stock, setStock] = useState<StockHacienda[]>([])
  const [categorias, setCategorias] = useState<CategoriaHacienda[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoHacienda[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarModalMov, setMostrarModalMov] = useState(false)
  const [verMovimientos, setVerMovimientos] = useState(false)

  // Hook edición inline (mismo patrón que Cash Flow)
  const hookEditor = useInlineEditor({
    onLocalUpdate: (filaId, campo, valor, updateData) => {
      setMovimientos(prev => prev.map(m =>
        m.id === filaId ? { ...m, ...updateData, [campo]: valor } : m
      ))
    }
  })

  const iniciarEdicionMov = (mov: MovimientoHacienda, campo: string, event: React.MouseEvent) => {
    if (!event.ctrlKey) return
    event.preventDefault()
    event.stopPropagation()

    let valor: any = (mov as any)[campo] || ''

    hookEditor.iniciarEdicion({
      filaId: mov.id,
      columna: campo,
      valor,
      tableName: 'movimientos_hacienda',
      origen: 'PRODUCTIVO',
      campoReal: campo
    })
  }

  // Form nuevo movimiento
  const [nuevoMov, setNuevoMov] = useState({
    fecha: new Date().toISOString().split('T')[0],
    categoria_id: '',
    tipo: 'compra',
    cantidad: '',
    peso_total_kg: '',
    precio_por_kg: '',
    monto_total: '',
    campo_origen: '',
    campo_destino: '',
    proveedor_cliente: '',
    cuit: '',
    observaciones: ''
  })

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const [catRes, movRes] = await Promise.all([
        supabase.schema('productivo').from('categorias_hacienda').select('*').eq('activo', true).order('nombre'),
        supabase.schema('productivo').from('movimientos_hacienda').select('*, categorias_hacienda(nombre)').order('fecha', { ascending: false })
      ])
      if (catRes.data) setCategorias(catRes.data)
      if (movRes.data) {
        setMovimientos(movRes.data)
        // Calcular stock desde movimientos
        const stockMap: Record<string, { categoria_id: string, nombre: string, cantidad: number }> = {}
        for (const m of movRes.data) {
          const catId = m.categoria_id
          if (!stockMap[catId]) {
            stockMap[catId] = { categoria_id: catId, nombre: m.categorias_hacienda?.nombre || '-', cantidad: 0 }
          }
          if (m.tipo === 'compra' || m.tipo === 'nacimiento') {
            stockMap[catId].cantidad += m.cantidad
          } else if (m.tipo === 'venta' || m.tipo === 'mortandad') {
            stockMap[catId].cantidad -= m.cantidad
          } else if (m.tipo === 'ajuste_stock') {
            stockMap[catId].cantidad += m.cantidad // puede ser negativo
          }
          // transferencia: no cambia total (solo cambia ubicación)
        }
        const stockCalculado = Object.values(stockMap)
          .filter(s => s.cantidad !== 0)
          .sort((a, b) => a.nombre.localeCompare(b.nombre))
        setStock(stockCalculado as any)
      }
    } catch (err) {
      console.error('Error cargando hacienda:', err)
      toast.error('Error al cargar datos de hacienda')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const guardarMovimiento = async () => {
    if (!nuevoMov.categoria_id || !nuevoMov.cantidad) {
      toast.error('Categoria y cantidad son obligatorios')
      return
    }

    const datos: any = {
      fecha: nuevoMov.fecha,
      categoria_id: nuevoMov.categoria_id,
      tipo: nuevoMov.tipo,
      cantidad: parseInt(nuevoMov.cantidad),
    }
    if (nuevoMov.peso_total_kg) datos.peso_total_kg = parseFloat(nuevoMov.peso_total_kg)
    if (nuevoMov.precio_por_kg) datos.precio_por_kg = parseFloat(nuevoMov.precio_por_kg)
    if (nuevoMov.monto_total) datos.monto_total = parseFloat(nuevoMov.monto_total)
    if (nuevoMov.campo_origen) datos.campo_origen = nuevoMov.campo_origen
    if (nuevoMov.campo_destino) datos.campo_destino = nuevoMov.campo_destino
    if (nuevoMov.proveedor_cliente) datos.proveedor_cliente = nuevoMov.proveedor_cliente
    if (nuevoMov.cuit) datos.cuit = nuevoMov.cuit
    if (nuevoMov.observaciones) datos.observaciones = nuevoMov.observaciones

    const { error } = await supabase.schema('productivo').from('movimientos_hacienda').insert(datos)
    if (error) {
      console.error('Error guardando movimiento:', error)
      toast.error('Error al guardar movimiento')
      return
    }

    toast.success('Movimiento registrado')
    setMostrarModalMov(false)
    setNuevoMov({
      fecha: new Date().toISOString().split('T')[0],
      categoria_id: '', tipo: 'compra', cantidad: '', peso_total_kg: '',
      precio_por_kg: '', monto_total: '', campo_origen: '', campo_destino: '',
      proveedor_cliente: '', cuit: '', observaciones: ''
    })
    cargarDatos()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        <span>Cargando stock hacienda...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Stock de Hacienda</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setVerMovimientos(!verMovimientos)}>
            {verMovimientos ? 'Ver Stock' : 'Ver Movimientos'}
          </Button>
          <Button size="sm" onClick={() => setMostrarModalMov(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Nuevo Movimiento
          </Button>
          <Button variant="outline" size="sm" onClick={cargarDatos}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!verMovimientos ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                  Sin registros de stock. Registre movimientos para actualizar.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {stock.map((s: any) => (
                  <TableRow key={s.categoria_id}>
                    <TableCell className="font-medium">{s.nombre}</TableCell>
                    <TableCell className="text-right">{formatoNumero(s.cantidad)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">
                    {formatoNumero((stock as any[]).reduce((sum, s) => sum + s.cantidad, 0))}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Peso Total (kg)</TableHead>
              <TableHead className="text-right">Monto Total</TableHead>
              <TableHead>Proveedor/Cliente</TableHead>
              <TableHead>Obs.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movimientos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Sin movimientos registrados.
                </TableCell>
              </TableRow>
            ) : (
              movimientos.map(m => {
                const enEdicion = (campo: string) =>
                  hookEditor.celdaEnEdicion?.filaId === m.id && hookEditor.celdaEnEdicion?.columna === campo

                const celdaEditable = (campo: string, contenido: React.ReactNode, tipo: 'text' | 'date' | 'number' = 'text') => {
                  if (enEdicion(campo)) {
                    if (campo === 'categoria_id') {
                      return (
                        <Select
                          value={String(hookEditor.celdaEnEdicion?.valor || '')}
                          onValueChange={(v) => {
                            hookEditor.setCeldaEnEdicion(prev => prev ? { ...prev, valor: v } : null)
                            hookEditor.guardarCambio(v)
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent position="popper" className="z-[9999]">
                            {categorias.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )
                    }
                    if (campo === 'tipo') {
                      return (
                        <Select
                          value={String(hookEditor.celdaEnEdicion?.valor || '')}
                          onValueChange={(v) => {
                            hookEditor.setCeldaEnEdicion(prev => prev ? { ...prev, valor: v } : null)
                            hookEditor.guardarCambio(v)
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent position="popper" className="z-[9999]">
                            {TIPOS_MOV_HACIENDA.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )
                    }
                    return (
                      <Input
                        ref={hookEditor.inputRef}
                        type={tipo === 'date' ? 'date' : tipo === 'number' ? 'number' : 'text'}
                        step={tipo === 'number' ? '0.01' : undefined}
                        value={String(hookEditor.celdaEnEdicion?.valor || '')}
                        onChange={(e) => hookEditor.setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
                        onKeyDown={hookEditor.manejarKeyDown}
                        className="h-7 text-xs p-1 w-full"
                        disabled={hookEditor.guardandoCambio}
                      />
                    )
                  }
                  return (
                    <div
                      className="cursor-pointer hover:bg-blue-50 p-1 rounded group"
                      title="Ctrl+Click para editar"
                      onClick={(e) => iniciarEdicionMov(m, campo, e)}
                    >
                      <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 float-right" />
                      {contenido}
                    </div>
                  )
                }

                return (
                <TableRow key={m.id}>
                  <TableCell>{celdaEditable('fecha', formatoFecha(m.fecha), 'date')}</TableCell>
                  <TableCell>
                    {celdaEditable('tipo',
                      <Badge variant={m.tipo === 'compra' ? 'default' : m.tipo === 'venta' ? 'secondary' : 'outline'}>
                        {TIPOS_MOV_HACIENDA.find(t => t.value === m.tipo)?.label || m.tipo}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{celdaEditable('categoria_id', m.categorias_hacienda?.nombre || '-')}</TableCell>
                  <TableCell className="text-right">{celdaEditable('cantidad', formatoNumero(m.cantidad), 'number')}</TableCell>
                  <TableCell className="text-right">{celdaEditable('peso_total_kg', m.peso_total_kg ? formatoNumero(m.peso_total_kg) : '-', 'number')}</TableCell>
                  <TableCell className="text-right">{celdaEditable('monto_total', formatoMoneda(m.monto_total), 'number')}</TableCell>
                  <TableCell>{celdaEditable('proveedor_cliente', m.proveedor_cliente || '-')}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px]">{celdaEditable('observaciones', m.observaciones || '-')}</TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      )}

      {/* Modal Nuevo Movimiento Hacienda */}
      <Dialog open={mostrarModalMov} onOpenChange={setMostrarModalMov}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Movimiento Hacienda</DialogTitle>
            <DialogDescription>Registrar compra, venta, nacimiento, mortandad o transferencia.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha *</Label>
                <Input type="date" value={nuevoMov.fecha} onChange={e => setNuevoMov(p => ({ ...p, fecha: e.target.value }))} />
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={nuevoMov.tipo} onValueChange={v => setNuevoMov(p => ({ ...p, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" className="z-[9999]">
                    <SelectItem value="compra">Compra</SelectItem>
                    <SelectItem value="venta">Venta</SelectItem>
                    <SelectItem value="nacimiento">Nacimiento</SelectItem>
                    <SelectItem value="mortandad">Mortandad</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="ajuste_stock">Ajuste de Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria *</Label>
                <Select value={nuevoMov.categoria_id} onValueChange={v => setNuevoMov(p => ({ ...p, categoria_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent position="popper" className="z-[9999]">
                    {categorias.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad *</Label>
                <Input type="number" value={nuevoMov.cantidad} onChange={e => setNuevoMov(p => ({ ...p, cantidad: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Peso Total (kg)</Label>
                <Input type="number" value={nuevoMov.peso_total_kg} onChange={e => setNuevoMov(p => ({ ...p, peso_total_kg: e.target.value }))} />
              </div>
              <div>
                <Label>Precio por kg</Label>
                <Input type="number" value={nuevoMov.precio_por_kg} onChange={e => setNuevoMov(p => ({ ...p, precio_por_kg: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Monto Total</Label>
              <Input type="number" value={nuevoMov.monto_total} onChange={e => setNuevoMov(p => ({ ...p, monto_total: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Campo Origen</Label>
                <Input value={nuevoMov.campo_origen} onChange={e => setNuevoMov(p => ({ ...p, campo_origen: e.target.value }))} />
              </div>
              <div>
                <Label>Campo Destino</Label>
                <Input value={nuevoMov.campo_destino} onChange={e => setNuevoMov(p => ({ ...p, campo_destino: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Proveedor/Cliente</Label>
                <Input value={nuevoMov.proveedor_cliente} onChange={e => setNuevoMov(p => ({ ...p, proveedor_cliente: e.target.value }))} />
              </div>
              <div>
                <Label>CUIT</Label>
                <Input value={nuevoMov.cuit} onChange={e => setNuevoMov(p => ({ ...p, cuit: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Input value={nuevoMov.observaciones} onChange={e => setNuevoMov(p => ({ ...p, observaciones: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMostrarModalMov(false)}>Cancelar</Button>
            <Button onClick={guardarMovimiento}>Guardar Movimiento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// TAB INSUMOS (contenedor con sub-tabs)
// ============================================================

function TabInsumos() {
  const [subTab, setSubTab] = useState("stock")

  return (
    <div className="space-y-4 pt-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stock" className="flex items-center gap-1 text-xs">
            <Package className="h-3.5 w-3.5" />
            Stock & Movimientos
          </TabsTrigger>
          <TabsTrigger value="ordenes" className="flex items-center gap-1 text-xs">
            <Syringe className="h-3.5 w-3.5" />
            Ordenes Aplicacion
          </TabsTrigger>
          <TabsTrigger value="compras" className="flex items-center gap-1 text-xs">
            <ShoppingCart className="h-3.5 w-3.5" />
            Necesidad de Compra
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <SubTabStockInsumos />
        </TabsContent>
        <TabsContent value="ordenes">
          <SubTabOrdenesAplicacion />
        </TabsContent>
        <TabsContent value="compras">
          <SubTabNecesidadCompra />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// SUB-TAB: STOCK & MOVIMIENTOS INSUMOS
// ============================================================

interface LineaMovInsumo {
  key: number
  insumo_stock_id: string
  cantidad: string
  costo_unitario: string
  observaciones: string
}

function SubTabStockInsumos() {
  const [stock, setStock] = useState<StockInsumo[]>([])
  const [categorias, setCategorias] = useState<CategoriaInsumo[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoInsumo[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarModalMov, setMostrarModalMov] = useState(false)
  const [mostrarModalInsumo, setMostrarModalInsumo] = useState(false)
  const [verMovimientos, setVerMovimientos] = useState(false)
  const [guardandoMov, setGuardandoMov] = useState(false)

  // Recalcular stock de un insumo desde sus movimientos
  const recalcularStockInsumo = async (insumoStockId: string) => {
    const { data } = await supabase.schema('productivo').from('movimientos_insumos')
      .select('tipo, cantidad')
      .eq('insumo_stock_id', insumoStockId)
    if (data) {
      const total = data.reduce((sum, m) => {
        const cant = Number(m.cantidad)
        return sum + (m.tipo === 'compra' || m.tipo === 'ajuste' ? cant : -cant)
      }, 0)
      await supabase.schema('productivo').from('stock_insumos')
        .update({ cantidad: total })
        .eq('id', insumoStockId)
    }
  }

  // Inline editing movimientos
  const hookEditor = useInlineEditor({
    onLocalUpdate: async (filaId, campo, valor, updateData) => {
      setMovimientos(prev => prev.map(m =>
        m.id === filaId ? { ...m, ...updateData, [campo]: valor } : m
      ))
      // Si se editó cantidad, recalcular stock del insumo
      if (campo === 'cantidad') {
        const mov = movimientos.find(m => m.id === filaId)
        if (mov?.insumo_stock_id) {
          await recalcularStockInsumo(mov.insumo_stock_id)
          cargarDatos()
        }
      }
    }
  })

  const iniciarEdicionMov = (mov: MovimientoInsumo, campo: string, event: React.MouseEvent) => {
    if (!event.ctrlKey) return
    event.preventDefault()
    event.stopPropagation()
    hookEditor.iniciarEdicion({
      filaId: mov.id,
      columna: campo,
      valor: (mov as any)[campo] || '',
      tableName: 'movimientos_insumos',
      origen: 'PRODUCTIVO',
      campoReal: campo
    })
  }

  // Form nuevo insumo
  const [nuevoInsumo, setNuevoInsumo] = useState({
    producto: '',
    categoria_id: '',
    unidad_medida: 'ml',
    observaciones: ''
  })

  // Form movimiento multi-linea
  const [movCabecera, setMovCabecera] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'compra',
    proveedor: '',
    cuit: '',
    observaciones: ''
  })
  const [movLineas, setMovLineas] = useState<LineaMovInsumo[]>([])

  const agregarLineaMov = () => {
    setMovLineas(prev => [...prev, {
      key: Date.now(),
      insumo_stock_id: '',
      cantidad: '',
      costo_unitario: '',
      observaciones: ''
    }])
  }

  const actualizarLineaMov = (key: number, campo: string, valor: any) => {
    setMovLineas(prev => prev.map(l => l.key === key ? { ...l, [campo]: valor } : l))
  }

  const eliminarLineaMov = (key: number) => {
    setMovLineas(prev => prev.filter(l => l.key !== key))
  }

  const abrirModalMov = (tipo: string) => {
    setMovCabecera(p => ({ ...p, tipo, fecha: new Date().toISOString().split('T')[0], proveedor: '', cuit: '', observaciones: '' }))
    setMovLineas([])
    agregarLineaMov()
    setMostrarModalMov(true)
  }

  const cerrarModalMov = () => {
    setMostrarModalMov(false)
    setMovLineas([])
  }

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const [catRes, stockRes, movRes] = await Promise.all([
        supabase.schema('productivo').from('categorias_insumo').select('*').eq('activo', true).order('nombre'),
        supabase.schema('productivo').from('stock_insumos').select('*, categorias_insumo(nombre, unidad_medida)').order('producto'),
        supabase.schema('productivo').from('movimientos_insumos').select('*, stock_insumos(producto, categorias_insumo(nombre))').order('fecha', { ascending: false }).limit(100)
      ])
      if (catRes.data) setCategorias(catRes.data)
      if (stockRes.data) setStock(stockRes.data)
      if (movRes.data) setMovimientos(movRes.data)
    } catch (err) {
      console.error('Error cargando insumos:', err)
      toast.error('Error al cargar datos de insumos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const guardarMovimientos = async () => {
    if (movLineas.length === 0) {
      toast.error('Agregue al menos un insumo')
      return
    }
    for (const l of movLineas) {
      if (!l.insumo_stock_id) {
        toast.error('Seleccione un insumo en cada linea')
        return
      }
      if (!l.cantidad || parseFloat(l.cantidad) <= 0) {
        toast.error('Cada linea debe tener cantidad')
        return
      }
    }

    setGuardandoMov(true)
    try {
      const inserts = movLineas.map(l => {
        const datos: any = {
          fecha: movCabecera.fecha,
          tipo: movCabecera.tipo,
          insumo_stock_id: l.insumo_stock_id,
          cantidad: parseFloat(l.cantidad),
        }
        if (l.costo_unitario) datos.costo_unitario = parseFloat(l.costo_unitario)
        if (movCabecera.proveedor) datos.proveedor = movCabecera.proveedor
        if (movCabecera.cuit) datos.cuit = movCabecera.cuit
        const obs = [movCabecera.observaciones, l.observaciones].filter(Boolean).join(' - ')
        if (obs) datos.observaciones = obs
        return datos
      })

      const { error } = await supabase.schema('productivo').from('movimientos_insumos').insert(inserts)
      if (error) throw new Error(error.message)

      // Actualizar stock: compra/ajuste suman
      const stockUpdates: Record<string, number> = {}
      for (const l of movLineas) {
        const cant = parseFloat(l.cantidad)
        stockUpdates[l.insumo_stock_id] = (stockUpdates[l.insumo_stock_id] || 0) + cant
      }
      for (const [insumoId, delta] of Object.entries(stockUpdates)) {
        const insumo = stock.find(s => s.id === insumoId)
        if (insumo) {
          const nuevaCantidad = Number(insumo.cantidad) + delta
          await supabase.schema('productivo').from('stock_insumos')
            .update({ cantidad: nuevaCantidad })
            .eq('id', insumoId)
        }
      }

      toast.success(`${inserts.length} movimiento(s) registrado(s)`)
      cerrarModalMov()
      cargarDatos()
    } catch (err: any) {
      console.error('Error guardando movimientos:', err)
      toast.error(err.message || 'Error al guardar movimientos')
    } finally {
      setGuardandoMov(false)
    }
  }

  const guardarInsumo = async () => {
    if (!nuevoInsumo.producto.trim()) {
      toast.error('El nombre del producto es obligatorio')
      return
    }
    if (!nuevoInsumo.categoria_id) {
      toast.error('Seleccione una categoria')
      return
    }

    const { error } = await supabase.schema('productivo').from('stock_insumos').insert({
      producto: nuevoInsumo.producto.trim(),
      categoria_id: parseInt(nuevoInsumo.categoria_id),
      unidad_medida: nuevoInsumo.unidad_medida,
      cantidad: 0,
      observaciones: nuevoInsumo.observaciones || null
    })

    if (error) {
      console.error('Error creando insumo:', error)
      toast.error('Error al crear insumo')
      return
    }

    toast.success('Insumo creado')
    setMostrarModalInsumo(false)
    setNuevoInsumo({ producto: '', categoria_id: '', unidad_medida: 'ml', observaciones: '' })
    cargarDatos()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        <span>Cargando stock insumos...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Stock de Insumos</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setVerMovimientos(!verMovimientos)}>
            {verMovimientos ? 'Ver Stock' : 'Ver Movimientos'}
          </Button>
          <Button size="sm" onClick={() => abrirModalMov('compra')}>
            <Plus className="mr-1 h-4 w-4" />
            Compra
          </Button>
          <Button variant="outline" size="sm" onClick={() => abrirModalMov('ajuste')}>
            <Plus className="mr-1 h-4 w-4" />
            Ajuste
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setMostrarModalInsumo(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Nuevo Insumo
          </Button>
          <Button variant="outline" size="sm" onClick={cargarDatos}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!verMovimientos ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Costo Unit.</TableHead>
              <TableHead>Observaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Sin registros de stock de insumos.
                </TableCell>
              </TableRow>
            ) : (
              stock.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.producto}</TableCell>
                  <TableCell>{s.categorias_insumo?.nombre || '-'}</TableCell>
                  <TableCell className="text-right">{formatoCantidad(s.cantidad, s.unidad_medida || 'ml')}</TableCell>
                  <TableCell className="text-right">{formatoMoneda(s.costo_unitario)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.observaciones || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Costo Unit.</TableHead>
              <TableHead className="text-right">Monto Total</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Obs.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movimientos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Sin movimientos de insumos registrados.
                </TableCell>
              </TableRow>
            ) : (
              movimientos.map(m => {
                const esEditable = m.tipo === 'compra' || m.tipo === 'ajuste'
                const enEdicion = (campo: string) =>
                  hookEditor.celdaEnEdicion?.filaId === m.id && hookEditor.celdaEnEdicion?.columna === campo

                const celdaEditable = (campo: string, contenido: React.ReactNode, tipo: 'text' | 'date' | 'number' = 'text') => {
                  if (!esEditable) return contenido
                  if (enEdicion(campo)) {
                    return (
                      <Input
                        ref={hookEditor.inputRef}
                        type={tipo === 'date' ? 'date' : tipo === 'number' ? 'number' : 'text'}
                        step={tipo === 'number' ? '0.01' : undefined}
                        value={String(hookEditor.celdaEnEdicion?.valor || '')}
                        onChange={(e) => hookEditor.setCeldaEnEdicion(prev => prev ? { ...prev, valor: e.target.value } : null)}
                        onKeyDown={hookEditor.manejarKeyDown}
                        className="h-7 text-xs p-1 w-full"
                        disabled={hookEditor.guardandoCambio}
                      />
                    )
                  }
                  return (
                    <div
                      className="cursor-pointer hover:bg-blue-50 p-1 rounded group"
                      title="Ctrl+Click para editar"
                      onClick={(e) => iniciarEdicionMov(m, campo, e)}
                    >
                      <Edit3 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 float-right" />
                      {contenido}
                    </div>
                  )
                }

                return (
                <TableRow key={m.id}>
                  <TableCell>{celdaEditable('fecha', formatoFecha(m.fecha), 'date')}</TableCell>
                  <TableCell>
                    <Badge variant={m.tipo === 'compra' ? 'default' : m.tipo === 'uso' ? 'secondary' : 'outline'}>
                      {m.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.stock_insumos?.producto || '-'}</TableCell>
                  <TableCell className="text-right">{celdaEditable('cantidad', formatoNumero(m.cantidad), 'number')}</TableCell>
                  <TableCell className="text-right">{celdaEditable('costo_unitario', formatoMoneda(m.costo_unitario), 'number')}</TableCell>
                  <TableCell className="text-right">{celdaEditable('monto_total', formatoMoneda(m.monto_total), 'number')}</TableCell>
                  <TableCell>{celdaEditable('proveedor', m.proveedor || '-')}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px]">{celdaEditable('observaciones', m.observaciones || '-')}</TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      )}

      {/* Modal Movimiento Insumos Multi-linea */}
      <Dialog open={mostrarModalMov} onOpenChange={(open) => { if (!open) cerrarModalMov() }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{movCabecera.tipo === 'compra' ? 'Nueva Compra de Insumos' : 'Ajuste de Insumos'}</DialogTitle>
            <DialogDescription>
              {movCabecera.tipo === 'compra'
                ? 'Registrar compra de uno o varios insumos.'
                : 'Registrar ajuste de stock de uno o varios insumos.'}
            </DialogDescription>
          </DialogHeader>

          {/* Cabecera */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Fecha *</Label>
              <Input type="date" value={movCabecera.fecha}
                onChange={e => setMovCabecera(p => ({ ...p, fecha: e.target.value }))} />
            </div>
            <div>
              <Label>Proveedor</Label>
              <Input value={movCabecera.proveedor} placeholder="Nombre proveedor"
                onChange={e => setMovCabecera(p => ({ ...p, proveedor: e.target.value }))} />
            </div>
            <div>
              <Label>CUIT</Label>
              <Input value={movCabecera.cuit} placeholder="Ej: 30123456789"
                onChange={e => setMovCabecera(p => ({ ...p, cuit: e.target.value }))} />
            </div>
            <div>
              <Label>Observaciones</Label>
              <Input value={movCabecera.observaciones} placeholder="Obs. general"
                onChange={e => setMovCabecera(p => ({ ...p, observaciones: e.target.value }))} />
            </div>
          </div>

          {/* Tabla de lineas */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Insumo *</TableHead>
                  <TableHead className="w-[100px] text-right">Cantidad *</TableHead>
                  <TableHead className="w-[120px] text-right">Costo Unit.</TableHead>
                  <TableHead className="w-[180px]">Observaciones</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movLineas.map((linea, idx) => (
                  <TableRow key={linea.key}>
                    <TableCell>
                      <Select value={linea.insumo_stock_id} onValueChange={v => actualizarLineaMov(linea.key, 'insumo_stock_id', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent position="popper" className="z-[9999]">
                          {stock.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.producto} ({s.unidad_medida || 'ml'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" className="h-8 text-xs text-right"
                        value={linea.cantidad} placeholder="0"
                        onChange={e => actualizarLineaMov(linea.key, 'cantidad', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" className="h-8 text-xs text-right"
                        value={linea.costo_unitario} placeholder="$0"
                        onChange={e => actualizarLineaMov(linea.key, 'costo_unitario', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8 text-xs" value={linea.observaciones} placeholder="Obs. línea"
                        onChange={e => actualizarLineaMov(linea.key, 'observaciones', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      {movLineas.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => eliminarLineaMov(linea.key)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Button variant="outline" size="sm" onClick={agregarLineaMov}>
            <Plus className="mr-1 h-4 w-4" />
            Agregar Línea
          </Button>

          <DialogFooter>
            <Button variant="outline" onClick={cerrarModalMov}>Cancelar</Button>
            <Button onClick={guardarMovimientos} disabled={guardandoMov}>
              {guardandoMov && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar {movLineas.length > 1 ? `${movLineas.length} Movimientos` : 'Movimiento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nuevo Insumo */}
      <Dialog open={mostrarModalInsumo} onOpenChange={setMostrarModalInsumo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Insumo</DialogTitle>
            <DialogDescription>Crear un producto nuevo en el inventario.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Nombre del Producto *</Label>
              <Input value={nuevoInsumo.producto} placeholder="Ej: Ivermectina"
                onChange={e => setNuevoInsumo(p => ({ ...p, producto: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria *</Label>
                <Select value={nuevoInsumo.categoria_id} onValueChange={v => setNuevoInsumo(p => ({ ...p, categoria_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent position="popper" className="z-[9999]">
                    {categorias.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidad de Medida *</Label>
                <Select value={nuevoInsumo.unidad_medida} onValueChange={v => setNuevoInsumo(p => ({ ...p, unidad_medida: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" className="z-[9999]">
                    <SelectItem value="ml">ml (mililitros)</SelectItem>
                    <SelectItem value="dosis">dosis</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="unidad">unidad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Input value={nuevoInsumo.observaciones} onChange={e => setNuevoInsumo(p => ({ ...p, observaciones: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMostrarModalInsumo(false)}>Cancelar</Button>
            <Button onClick={guardarInsumo}>Crear Insumo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// SUB-TAB: ORDENES DE APLICACION VETERINARIA
// ============================================================

function SubTabOrdenesAplicacion() {
  const [ordenes, setOrdenes] = useState<OrdenAplicacion[]>([])
  const [categoriasHacienda, setCategoriasHacienda] = useState<CategoriaHacienda[]>([])
  const [insumosVet, setInsumosVet] = useState<StockInsumo[]>([])
  const [stockHaciendaMap, setStockHaciendaMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // Modo edicion: null = nueva orden, string = id de orden editando
  const [ordenEditandoId, setOrdenEditandoId] = useState<string | null>(null)

  // Modal confirmar/ejecutar orden
  const [mostrarModalConfirmar, setMostrarModalConfirmar] = useState(false)
  const [ordenConfirmando, setOrdenConfirmando] = useState<OrdenAplicacion | null>(null)
  const [recuentoLineas, setRecuentoLineas] = useState<Record<string, { checked: boolean, cantidad: string }>>({})

  // Form cabecera
  const [nuevaOrden, setNuevaOrden] = useState({
    fecha: new Date().toISOString().split('T')[0],
    peso_promedio_kg: '',
    observaciones: ''
  })

  // Rodeos seleccionados (multi-select)
  const [rodeosSeleccionados, setRodeosSeleccionados] = useState<Record<string, boolean>>({})

  // Labores
  const [laboresDisponibles, setLaboresDisponibles] = useState<{ id: number, nombre: string }[]>([])
  const [laboresSeleccionadas, setLaboresSeleccionadas] = useState<Record<number, boolean>>({})

  // Lineas de la orden
  const [lineas, setLineas] = useState<LineaFormulario[]>([])

  const agregarLinea = () => {
    setLineas(prev => [...prev, {
      key: Date.now(),
      insumo_nombre: '',
      insumo_stock_id: '',
      tipo_dosis: 'por_cabeza',
      dosis_ml: '',
      dosis_cada_kg: ''
    }])
  }

  const actualizarLinea = (key: number, campo: string, valor: any) => {
    setLineas(prev => prev.map(l => l.key === key ? { ...l, [campo]: valor } : l))
  }

  const eliminarLinea = (key: number) => {
    setLineas(prev => prev.filter(l => l.key !== key))
  }

  const toggleRodeo = (catId: string) => {
    setRodeosSeleccionados(prev => ({ ...prev, [catId]: !prev[catId] }))
  }

  // Total cabezas = suma de stock de todos los rodeos seleccionados
  const totalCabezas = Object.entries(rodeosSeleccionados)
    .filter(([_, sel]) => sel)
    .reduce((sum, [catId]) => sum + (stockHaciendaMap[catId] || 0), 0)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const [ordenesRes, catHacRes, insRes, movHacRes, laboresRes] = await Promise.all([
        supabase.schema('productivo').from('ordenes_aplicacion')
          .select('*, categorias_hacienda(nombre), lineas_orden_aplicacion(*), ordenes_aplicacion_rodeos(*, categorias_hacienda(nombre)), lineas_orden_labores(*, labores(nombre))')
          .order('fecha', { ascending: false }),
        supabase.schema('productivo').from('categorias_hacienda')
          .select('*').eq('activo', true).order('nombre'),
        supabase.schema('productivo').from('stock_insumos')
          .select('*, categorias_insumo(nombre, unidad_medida)')
          .order('producto'),
        supabase.schema('productivo').from('movimientos_hacienda')
          .select('categoria_id, tipo, cantidad'),
        supabase.schema('productivo').from('labores')
          .select('id, nombre').eq('activo', true).order('orden_display')
      ])

      if (ordenesRes.data) {
        setOrdenes(ordenesRes.data.map((o: any) => ({
          ...o,
          lineas: o.lineas_orden_aplicacion || [],
          rodeos: o.ordenes_aplicacion_rodeos || [],
          labores: (o.lineas_orden_labores || []).map((ll: any) => ll.labores?.nombre).filter(Boolean)
        })))
      }
      if (catHacRes.data) setCategoriasHacienda(catHacRes.data)
      if (insRes.data) setInsumosVet(insRes.data)
      if (laboresRes.data) setLaboresDisponibles(laboresRes.data)

      // Calcular stock hacienda desde movimientos
      if (movHacRes.data) {
        const map: Record<string, number> = {}
        for (const m of movHacRes.data) {
          if (!map[m.categoria_id]) map[m.categoria_id] = 0
          if (m.tipo === 'compra' || m.tipo === 'nacimiento') {
            map[m.categoria_id] += m.cantidad
          } else if (m.tipo === 'venta' || m.tipo === 'mortandad') {
            map[m.categoria_id] -= m.cantidad
          } else if (m.tipo === 'ajuste_stock') {
            map[m.categoria_id] += m.cantidad
          }
        }
        setStockHaciendaMap(map)
      }
    } catch (err) {
      console.error('Error cargando ordenes:', err)
      toast.error('Error al cargar ordenes de aplicacion')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // Abrir edicion de orden existente
  const abrirEdicion = (orden: OrdenAplicacion) => {
    setOrdenEditandoId(orden.id)
    setNuevaOrden({
      fecha: orden.fecha,
      peso_promedio_kg: orden.peso_promedio_kg ? String(orden.peso_promedio_kg) : '',
      observaciones: orden.observaciones || ''
    })
    // Restaurar rodeos seleccionados
    const rodeos: Record<string, boolean> = {}
    if (orden.rodeos && orden.rodeos.length > 0) {
      orden.rodeos.forEach(r => { rodeos[r.categoria_hacienda_id] = true })
    } else if (orden.categoria_hacienda_id) {
      rodeos[orden.categoria_hacienda_id] = true
    }
    setRodeosSeleccionados(rodeos)
    // Restaurar labores
    const labs: Record<number, boolean> = {}
    if (orden.labores) {
      for (const nombre of orden.labores) {
        const labor = laboresDisponibles.find(l => l.nombre === nombre)
        if (labor) labs[labor.id] = true
      }
    }
    setLaboresSeleccionadas(labs)
    // Restaurar lineas
    setLineas((orden.lineas || []).map(l => ({
      key: Date.now() + Math.random(),
      insumo_nombre: l.insumo_nombre,
      insumo_stock_id: l.insumo_stock_id || '',
      tipo_dosis: l.tipo_dosis as 'por_cabeza' | 'por_kilo' | 'por_dosis',
      dosis_ml: String(l.dosis_ml),
      dosis_cada_kg: l.dosis_cada_kg ? String(l.dosis_cada_kg) : ''
    })))
    setMostrarModal(true)
  }

  // Cerrar modal y limpiar estado
  const cerrarModal = () => {
    setMostrarModal(false)
    setOrdenEditandoId(null)
    setNuevaOrden({ fecha: new Date().toISOString().split('T')[0], peso_promedio_kg: '', observaciones: '' })
    setRodeosSeleccionados({})
    setLaboresSeleccionadas({})
    setLineas([])
  }

  // Abrir modal confirmar/ejecutar orden
  const abrirConfirmacion = (orden: OrdenAplicacion) => {
    setOrdenConfirmando(orden)
    const recuento: Record<string, { checked: boolean, cantidad: string }> = {}
    ;(orden.lineas || []).forEach(l => {
      recuento[l.id] = {
        checked: l.recuento || false,
        cantidad: l.cantidad_recuento !== null ? String(l.cantidad_recuento) : String(l.cantidad_total_ml)
      }
    })
    setRecuentoLineas(recuento)
    setMostrarModalConfirmar(true)
  }

  // Eliminar orden (soft delete)
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false)
  const [ordenEliminando, setOrdenEliminando] = useState<OrdenAplicacion | null>(null)
  const [motivoEliminacion, setMotivoEliminacion] = useState('')

  const abrirEliminacion = (orden: OrdenAplicacion) => {
    setOrdenEliminando(orden)
    setMotivoEliminacion('')
    setMostrarModalEliminar(true)
  }

  const eliminarOrden = async () => {
    if (!ordenEliminando) return
    if (!motivoEliminacion.trim()) {
      toast.error('Debe ingresar un motivo de eliminación')
      return
    }
    setGuardando(true)
    try {
      await supabase.schema('productivo').from('ordenes_aplicacion')
        .update({
          estado: 'eliminada',
          motivo_eliminacion: motivoEliminacion.trim(),
          observaciones: [ordenEliminando.observaciones, `[ELIMINADA] ${motivoEliminacion.trim()}`].filter(Boolean).join('\n')
        })
        .eq('id', ordenEliminando.id)

      // Si estaba ejecutada, recalcular stock (los movimientos de uso siguen existiendo pero la orden está eliminada)
      if (ordenEliminando.estado === 'ejecutada' && ordenEliminando.lineas) {
        const insumoIds = new Set(ordenEliminando.lineas.map(l => l.insumo_stock_id).filter(Boolean))
        for (const id of insumoIds) {
          if (id) {
            const { data: stockActual } = await supabase.schema('productivo').from('stock_insumos')
              .select('id, cantidad').eq('id', id).single()
            if (stockActual) {
              const devolver = ordenEliminando.lineas
                .filter(l => l.insumo_stock_id === id)
                .reduce((sum, l) => sum + l.cantidad_total_ml, 0)
              await supabase.schema('productivo').from('stock_insumos')
                .update({ cantidad: Number(stockActual.cantidad) + devolver })
                .eq('id', id)
            }
          }
        }
      }

      toast.success('Orden marcada como eliminada')
      setMostrarModalEliminar(false)
      setOrdenEliminando(null)
      cargarDatos()
    } catch (err: any) {
      console.error('Error eliminando orden:', err)
      toast.error(err.message || 'Error al eliminar orden')
    } finally {
      setGuardando(false)
    }
  }

  // Ejecutar/confirmar orden
  const ejecutarOrden = async () => {
    if (!ordenConfirmando) return
    setGuardando(true)
    try {
      // Actualizar recuento en cada linea
      for (const [lineaId, rec] of Object.entries(recuentoLineas)) {
        await supabase.schema('productivo').from('lineas_orden_aplicacion')
          .update({
            recuento: rec.checked,
            cantidad_recuento: rec.checked ? (parseFloat(rec.cantidad) || 0) : null
          })
          .eq('id', lineaId)
      }
      // Cambiar estado a ejecutada
      await supabase.schema('productivo').from('ordenes_aplicacion')
        .update({ estado: 'ejecutada' })
        .eq('id', ordenConfirmando.id)

      // Descontar stock por uso
      if (ordenConfirmando.lineas) {
        const descuentos: Record<string, number> = {}
        for (const l of ordenConfirmando.lineas) {
          if (l.insumo_stock_id) {
            descuentos[l.insumo_stock_id] = (descuentos[l.insumo_stock_id] || 0) + l.cantidad_total_ml
          }
        }
        // Leer stock actual y restar
        const { data: stockActual } = await supabase.schema('productivo').from('stock_insumos')
          .select('id, cantidad').in('id', Object.keys(descuentos))
        if (stockActual) {
          for (const s of stockActual) {
            const nuevaCantidad = s.cantidad - (descuentos[s.id] || 0)
            await supabase.schema('productivo').from('stock_insumos')
              .update({ cantidad: nuevaCantidad })
              .eq('id', s.id)
          }
        }
      }

      toast.success('Orden confirmada como ejecutada')
      setMostrarModalConfirmar(false)
      setOrdenConfirmando(null)
      cargarDatos()
    } catch (err: any) {
      console.error('Error ejecutando orden:', err)
      toast.error(err.message || 'Error al ejecutar orden')
    } finally {
      setGuardando(false)
    }
  }

  const guardarOrden = async () => {
    const rodeosIds = Object.entries(rodeosSeleccionados).filter(([_, sel]) => sel).map(([id]) => id)
    if (rodeosIds.length === 0) {
      toast.error('Seleccione al menos un rodeo')
      return
    }
    // Filtrar lineas vacías (sin insumo seleccionado)
    const lineasValidas = lineas.filter(l => l.insumo_nombre || l.insumo_stock_id)

    // Validar que haya al menos insumos o labores
    const laboresIds = Object.entries(laboresSeleccionadas).filter(([_, sel]) => sel).map(([id]) => parseInt(id))
    if (lineasValidas.length === 0 && laboresIds.length === 0) {
      toast.error('Agregue al menos un insumo o una labor')
      return
    }

    // Validar lineas con datos
    for (const l of lineasValidas) {
      if (!l.dosis_ml || parseFloat(l.dosis_ml) <= 0) {
        toast.error('Cada insumo debe tener dosis')
        return
      }
      if (l.tipo_dosis === 'por_kilo') {
        if (!l.dosis_cada_kg) {
          toast.error('Para dosis por kilo, complete "Cada X kg"')
          return
        }
        if (!nuevaOrden.peso_promedio_kg) {
          toast.error('Para dosis por kilo, complete "Peso Prom. kg/cab" en la cabecera')
          return
        }
      }
    }

    setGuardando(true)
    try {
      const pesoHeaderKg = nuevaOrden.peso_promedio_kg ? parseFloat(nuevaOrden.peso_promedio_kg) : null
      const cabeceraData = {
        fecha: nuevaOrden.fecha,
        categoria_hacienda_id: rodeosIds.length === 1 ? rodeosIds[0] : null,
        cantidad_cabezas: totalCabezas,
        peso_promedio_kg: pesoHeaderKg,
        observaciones: nuevaOrden.observaciones || null
      }

      let ordenId: string

      if (ordenEditandoId) {
        // === MODO EDICION ===
        const { error: updError } = await supabase.schema('productivo')
          .from('ordenes_aplicacion')
          .update(cabeceraData)
          .eq('id', ordenEditandoId)
        if (updError) throw new Error(updError.message)
        ordenId = ordenEditandoId

        // Borrar rodeos, labores y lineas anteriores
        await supabase.schema('productivo').from('ordenes_aplicacion_rodeos').delete().eq('orden_id', ordenId)
        await supabase.schema('productivo').from('lineas_orden_labores').delete().eq('orden_id', ordenId)
        await supabase.schema('productivo').from('lineas_orden_aplicacion').delete().eq('orden_id', ordenId)
      } else {
        // === MODO CREACION ===
        const { data: ordenData, error: ordenError } = await supabase.schema('productivo')
          .from('ordenes_aplicacion')
          .insert({ ...cabeceraData, estado: 'planificada' })
          .select('id')
          .single()
        if (ordenError || !ordenData) throw new Error(ordenError?.message || 'Error creando orden')
        ordenId = ordenData.id
      }

      // Crear registros de rodeos
      const rodeosData = rodeosIds.map(catId => ({
        orden_id: ordenId,
        categoria_hacienda_id: catId,
        cantidad_cabezas: stockHaciendaMap[catId] || 0
      }))
      await supabase.schema('productivo').from('ordenes_aplicacion_rodeos').insert(rodeosData)

      // Crear labores
      if (laboresIds.length > 0) {
        const laboresData = laboresIds.map(laborId => ({
          orden_id: ordenId,
          labor_id: laborId
        }))
        await supabase.schema('productivo').from('lineas_orden_labores').insert(laboresData)
      }

      // Crear lineas (solo las que tienen insumo)
      const lineasData = lineasValidas.map(l => {
        const dosis = parseFloat(l.dosis_ml)
        const dosisCadaKg = l.tipo_dosis === 'por_kilo' ? parseFloat(l.dosis_cada_kg) : null
        const pesoPromedio = l.tipo_dosis === 'por_kilo' ? pesoHeaderKg : null
        const { total } = calcularTotal(l.tipo_dosis, dosis, totalCabezas, dosisCadaKg, pesoPromedio)
        const insumoStock = l.insumo_stock_id ? insumosVet.find(i => i.id === l.insumo_stock_id) : null
        const nombre = insumoStock ? insumoStock.producto : l.insumo_nombre

        return {
          orden_id: ordenId,
          insumo_nombre: nombre,
          insumo_stock_id: l.insumo_stock_id || null,
          tipo_dosis: l.tipo_dosis,
          dosis_ml: dosis,
          dosis_cada_kg: dosisCadaKg,
          peso_promedio_kg: pesoPromedio,
          cantidad_total_ml: total,
          unidad_medida: insumoStock?.unidad_medida || (l.tipo_dosis === 'por_dosis' ? 'dosis' : 'ml')
        }
      })

      if (lineasData.length > 0) {
        const { error: lineasError } = await supabase.schema('productivo')
          .from('lineas_orden_aplicacion').insert(lineasData)
        if (lineasError) throw new Error(lineasError.message)
      }

      // Crear movimientos de uso (solo en creacion, en edicion los movimientos previos quedan)
      if (!ordenEditandoId && lineasData.length > 0) {
        const movimientosUso = lineasData
          .filter(l => l.insumo_stock_id)
          .map(l => ({
            fecha: nuevaOrden.fecha,
            insumo_stock_id: l.insumo_stock_id,
            tipo: 'uso',
            cantidad: l.cantidad_total_ml,
            observaciones: `Orden aplicacion - ${l.insumo_nombre}`
          }))
        if (movimientosUso.length > 0) {
          await supabase.schema('productivo').from('movimientos_insumos').insert(movimientosUso)
        }
      }

      toast.success(ordenEditandoId ? 'Orden actualizada' : 'Orden de aplicacion creada')
      cerrarModal()
      cargarDatos()
    } catch (err: any) {
      console.error('Error guardando orden:', err)
      toast.error(err.message || 'Error al guardar orden')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        <span>Cargando ordenes...</span>
      </div>
    )
  }

  // Helper para mostrar nombres de rodeos de una orden
  const getNombresRodeos = (o: OrdenAplicacion): string => {
    if (o.rodeos && o.rodeos.length > 0) {
      return o.rodeos.map(r => r.categorias_hacienda?.nombre || '-').join(', ')
    }
    return o.categorias_hacienda?.nombre || '-'
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Ordenes de Aplicacion Veterinaria</h3>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { setOrdenEditandoId(null); setMostrarModal(true); if (lineas.length === 0) agregarLinea() }}>
            <Plus className="mr-1 h-4 w-4" />
            Nueva Orden
          </Button>
          <Button variant="outline" size="sm" onClick={cargarDatos}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabla ordenes existentes */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Rodeo(s)</TableHead>
            <TableHead className="text-right">Cabezas</TableHead>
            <TableHead>Labores / Insumos</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="max-w-[300px]">Observaciones</TableHead>
            <TableHead className="w-[100px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordenes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Sin ordenes de aplicacion registradas.
              </TableCell>
            </TableRow>
          ) : (
            ordenes.map(o => (
              <TableRow key={o.id}>
                <TableCell>{formatoFecha(o.fecha)}</TableCell>
                <TableCell className="font-medium">{getNombresRodeos(o)}</TableCell>
                <TableCell className="text-right">{formatoNumero(o.cantidad_cabezas)}</TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {o.labores && o.labores.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {o.labores.map((nombre, i) => (
                          <Badge key={i} variant="secondary" className="text-xs py-0">{nombre}</Badge>
                        ))}
                      </div>
                    )}
                    {o.lineas && o.lineas.length > 0 ? o.lineas.map(l => {
                      const dpc = dosisPorCabeza(l.tipo_dosis, l.dosis_ml, l.dosis_cada_kg, l.peso_promedio_kg || o.peso_promedio_kg)
                      return (
                        <div key={l.id} className="text-xs">
                          <span className="font-medium">{l.insumo_nombre}</span>: {dpc.texto} → {formatoCantidad(l.cantidad_total_ml, l.unidad_medida || 'ml')}
                        </div>
                      )
                    }) : (!o.labores || o.labores.length === 0) && <span className="text-muted-foreground text-xs">-</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={o.estado === 'ejecutada' ? 'default' : o.estado === 'eliminada' ? 'destructive' : 'outline'}>
                    {o.estado}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[300px] whitespace-pre-wrap">
                  {o.observaciones || '-'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {o.estado === 'planificada' && (
                      <>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          title="Editar orden"
                          onClick={() => abrirEdicion(o)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600"
                          title="Confirmar como ejecutada"
                          onClick={() => abrirConfirmacion(o)}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {o.estado !== 'eliminada' && (
                      <>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          title="Exportar imagen para WhatsApp"
                          onClick={() => exportarOrdenImagen(o)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500"
                          title="Eliminar orden"
                          onClick={() => abrirEliminacion(o)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Modal Nueva/Editar Orden */}
      <Dialog open={mostrarModal} onOpenChange={(open) => { if (!open) cerrarModal() }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{ordenEditandoId ? 'Editar Orden de Aplicacion' : 'Nueva Orden de Aplicacion'}</DialogTitle>
            <DialogDescription>Seleccione rodeos, agregue insumos con dosis y el sistema calcula totales.</DialogDescription>
          </DialogHeader>

          {/* Cabecera */}
          <div className="grid gap-3 border-b pb-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Fecha *</Label>
                <Input type="date" value={nuevaOrden.fecha}
                  onChange={e => setNuevaOrden(p => ({ ...p, fecha: e.target.value }))} />
              </div>
              <div>
                <Label>Peso Prom. kg/cab <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input type="number" step="0.1" placeholder="Ej: 200"
                  value={nuevaOrden.peso_promedio_kg}
                  onChange={e => setNuevaOrden(p => ({ ...p, peso_promedio_kg: e.target.value }))} />
              </div>
              <div>
                <Label>Observaciones</Label>
                <Textarea className="min-h-[38px] resize-none" rows={1} value={nuevaOrden.observaciones}
                  onChange={e => setNuevaOrden(p => ({ ...p, observaciones: e.target.value }))} />
              </div>
            </div>

            {/* Multi-select rodeos */}
            <div>
              <Label className="mb-2 block">Rodeos * <span className="text-muted-foreground text-xs">(seleccione uno o mas)</span></Label>
              <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto border rounded p-2">
                {categoriasHacienda.filter(c => (stockHaciendaMap[c.id] || 0) > 0).map(c => {
                  const stock = stockHaciendaMap[c.id] || 0
                  const seleccionado = rodeosSeleccionados[c.id] || false
                  return (
                    <label key={c.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm border transition-colors ${seleccionado ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-transparent'}`}>
                      <input type="checkbox" checked={seleccionado}
                        onChange={() => toggleRodeo(c.id)}
                        className="rounded" />
                      <span className="font-medium">{c.nombre}</span>
                      <span className="text-muted-foreground text-xs">({stock} cab.)</span>
                    </label>
                  )
                })}
              </div>
              {totalCabezas > 0 && (
                <p className="text-sm font-semibold mt-1">Total: {formatoNumero(totalCabezas)} cabezas</p>
              )}
            </div>
          </div>

          {/* Labores */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Labores</Label>
            <div className="flex flex-wrap gap-2">
              {laboresDisponibles.map(labor => {
                const seleccionada = laboresSeleccionadas[labor.id] || false
                return (
                  <label key={labor.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md cursor-pointer text-sm border transition-colors ${seleccionada ? 'bg-green-50 border-green-300 text-green-800' : 'hover:bg-gray-50 border-gray-200'}`}>
                    <input type="checkbox" checked={seleccionada}
                      onChange={() => setLaboresSeleccionadas(prev => ({ ...prev, [labor.id]: !prev[labor.id] }))}
                      className="rounded" />
                    {labor.nombre}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Lineas de insumos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Insumos</Label>
              <Button variant="outline" size="sm" onClick={agregarLinea}>
                <Plus className="mr-1 h-3 w-3" />
                Agregar Insumo
              </Button>
            </div>

            {lineas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Agregue al menos un insumo para la orden.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Insumo</TableHead>
                    <TableHead className="w-[120px]">Tipo Dosis</TableHead>
                    <TableHead className="w-[80px] text-right">Dosis</TableHead>
                    <TableHead className="w-[90px] text-right">Cada X kg</TableHead>
                    <TableHead className="w-[90px] text-right">Dosis/Cab</TableHead>
                    <TableHead className="w-[100px] text-right">Total</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map(l => {
                    const dosis = parseFloat(l.dosis_ml) || 0
                    const dosisCadaKg = parseFloat(l.dosis_cada_kg) || 0
                    const pesoHeaderKg = parseFloat(nuevaOrden.peso_promedio_kg) || 0
                    const pesoParaCalc = l.tipo_dosis === 'por_kilo' ? pesoHeaderKg : 0
                    const { total, unidad } = calcularTotal(l.tipo_dosis, dosis, totalCabezas, dosisCadaKg, pesoParaCalc)
                    const dpc = dosisPorCabeza(l.tipo_dosis, dosis, dosisCadaKg, pesoParaCalc)

                    return (
                      <TableRow key={l.key}>
                        <TableCell>
                          {insumosVet.length > 0 ? (
                            <Select value={l.insumo_stock_id} onValueChange={v => actualizarLinea(l.key, 'insumo_stock_id', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar o escribir" /></SelectTrigger>
                              <SelectContent position="popper" className="z-[9999]">
                                {insumosVet.map(ins => (
                                  <SelectItem key={ins.id} value={ins.id}>{ins.producto}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input className="h-8 text-xs" placeholder="Nombre insumo"
                              value={l.insumo_nombre}
                              onChange={e => actualizarLinea(l.key, 'insumo_nombre', e.target.value)} />
                          )}
                          {!l.insumo_stock_id && insumosVet.length > 0 && (
                            <Input className="h-7 text-xs mt-1" placeholder="O escriba nombre"
                              value={l.insumo_nombre}
                              onChange={e => actualizarLinea(l.key, 'insumo_nombre', e.target.value)} />
                          )}
                        </TableCell>
                        <TableCell>
                          <Select value={l.tipo_dosis} onValueChange={v => actualizarLinea(l.key, 'tipo_dosis', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent position="popper" className="z-[9999]">
                              <SelectItem value="por_cabeza">Por cabeza (ml)</SelectItem>
                              <SelectItem value="por_kilo">Por kilo (ml)</SelectItem>
                              <SelectItem value="por_dosis">Por dosis</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" className="h-8 text-xs text-right"
                            placeholder={l.tipo_dosis === 'por_dosis' ? 'dosis/cab' : 'ml'}
                            value={l.dosis_ml}
                            onChange={e => actualizarLinea(l.key, 'dosis_ml', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          {l.tipo_dosis === 'por_kilo' ? (
                            <Input type="number" step="0.01" className="h-8 text-xs text-right"
                              value={l.dosis_cada_kg}
                              onChange={e => actualizarLinea(l.key, 'dosis_cada_kg', e.target.value)} />
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {dpc.texto}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {total > 0 ? formatoCantidad(total, unidad) : '-'}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                            onClick={() => eliminarLinea(l.key)}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cerrarModal}>Cancelar</Button>
            <Button onClick={guardarOrden} disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {ordenEditandoId ? 'Actualizar Orden' : 'Guardar Orden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar/Ejecutar Orden */}
      <Dialog open={mostrarModalConfirmar} onOpenChange={(open) => { if (!open) { setMostrarModalConfirmar(false); setOrdenConfirmando(null) } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar Orden como Ejecutada</DialogTitle>
            <DialogDescription>
              Marque los insumos aplicados y ajuste cantidades si difieren de lo planificado.
            </DialogDescription>
          </DialogHeader>

          {ordenConfirmando && (
            <div className="space-y-4">
              {/* Resumen orden */}
              <div className="bg-muted/50 rounded p-3 text-sm space-y-1">
                <p><span className="font-medium">Fecha:</span> {formatoFecha(ordenConfirmando.fecha)}</p>
                <p><span className="font-medium">Rodeo:</span> {getNombresRodeos(ordenConfirmando)}</p>
                <p><span className="font-medium">Cabezas:</span> {formatoNumero(ordenConfirmando.cantidad_cabezas)}</p>
                {ordenConfirmando.observaciones && (
                  <p className="text-muted-foreground whitespace-pre-wrap">{ordenConfirmando.observaciones}</p>
                )}
              </div>

              {/* Tabla recuento */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">Ok</TableHead>
                    <TableHead>Insumo</TableHead>
                    <TableHead className="text-right">Dosis/Cab</TableHead>
                    <TableHead className="text-right">Planificado</TableHead>
                    <TableHead className="w-[130px] text-right">Recuento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ordenConfirmando.lineas || []).map(l => {
                    const rec = recuentoLineas[l.id] || { checked: false, cantidad: String(l.cantidad_total_ml) }
                    const dpc = dosisPorCabeza(l.tipo_dosis, l.dosis_ml, l.dosis_cada_kg, l.peso_promedio_kg || ordenConfirmando.peso_promedio_kg)
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <Checkbox
                            checked={rec.checked}
                            onCheckedChange={(v) => setRecuentoLineas(prev => ({
                              ...prev,
                              [l.id]: { ...prev[l.id], checked: !!v }
                            }))} />
                        </TableCell>
                        <TableCell className="font-medium">{l.insumo_nombre}</TableCell>
                        <TableCell className="text-right text-sm">{dpc.texto}</TableCell>
                        <TableCell className="text-right text-sm">
                          {formatoCantidad(l.cantidad_total_ml, l.unidad_medida || 'ml')}
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" className="h-8 text-xs text-right"
                            value={rec.cantidad}
                            onChange={e => setRecuentoLineas(prev => ({
                              ...prev,
                              [l.id]: { ...prev[l.id], cantidad: e.target.value }
                            }))} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setMostrarModalConfirmar(false); setOrdenConfirmando(null) }}>
              Cancelar
            </Button>
            <Button onClick={ejecutarOrden} disabled={guardando} className="bg-green-600 hover:bg-green-700">
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmar Ejecutada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Eliminar Orden */}
      <Dialog open={mostrarModalEliminar} onOpenChange={(open) => { if (!open) { setMostrarModalEliminar(false); setOrdenEliminando(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar Orden de Aplicación</DialogTitle>
            <DialogDescription>
              {ordenEliminando && (
                <>Orden del {formatoFecha(ordenEliminando.fecha)} - {getNombresRodeos(ordenEliminando)} ({formatoNumero(ordenEliminando.cantidad_cabezas)} cab.)
                {ordenEliminando.estado === 'ejecutada' && (
                  <span className="block mt-1 text-orange-600 font-medium">Esta orden ya fue ejecutada. Al eliminarla se devolverá el stock descontado.</span>
                )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Motivo de eliminación *</Label>
            <Textarea
              value={motivoEliminacion}
              onChange={e => setMotivoEliminacion(e.target.value)}
              placeholder="Ingrese el motivo por el cual se elimina esta orden..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMostrarModalEliminar(false); setOrdenEliminando(null) }}>Cancelar</Button>
            <Button variant="destructive" onClick={eliminarOrden} disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar Orden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// SUB-TAB: NECESIDAD DE COMPRA
// ============================================================

function SubTabNecesidadCompra() {
  const [datos, setDatos] = useState<{
    insumo_nombre: string
    stock_actual: number
    necesario: number
    a_comprar: number
    unidad: string
  }[]>([])
  const [loading, setLoading] = useState(true)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const [lineasRes, stockRes] = await Promise.all([
        supabase.schema('productivo').from('lineas_orden_aplicacion')
          .select('insumo_nombre, insumo_stock_id, cantidad_total_ml, unidad_medida, ordenes_aplicacion!inner(estado)')
          .eq('ordenes_aplicacion.estado', 'planificada'),
        supabase.schema('productivo').from('stock_insumos')
          .select('id, producto, cantidad, unidad_medida')
      ])

      const necesidadMap: Record<string, { nombre: string, stockId: string | null, necesario: number, unidad: string }> = {}
      if (lineasRes.data) {
        for (const l of lineasRes.data) {
          const key = l.insumo_stock_id || l.insumo_nombre
          if (!necesidadMap[key]) {
            necesidadMap[key] = { nombre: l.insumo_nombre, stockId: l.insumo_stock_id, necesario: 0, unidad: l.unidad_medida || 'ml' }
          }
          necesidadMap[key].necesario += l.cantidad_total_ml
        }
      }

      const stockMap: Record<string, { cantidad: number, unidad: string }> = {}
      if (stockRes.data) {
        for (const s of stockRes.data) {
          stockMap[s.id] = { cantidad: s.cantidad, unidad: s.unidad_medida || 'ml' }
        }
      }

      const resultado = Object.values(necesidadMap).map(n => {
        const stockInfo = n.stockId ? stockMap[n.stockId] : null
        const stockActual = stockInfo?.cantidad || 0
        // Preferir la unidad del stock_insumos (fuente de verdad)
        const unidad = stockInfo?.unidad || n.unidad
        return {
          insumo_nombre: n.nombre,
          stock_actual: stockActual,
          necesario: n.necesario,
          a_comprar: Math.max(0, n.necesario - stockActual),
          unidad
        }
      }).sort((a, b) => b.a_comprar - a.a_comprar)

      setDatos(resultado)
    } catch (err) {
      console.error('Error cargando necesidad compra:', err)
      toast.error('Error al cargar necesidad de compra')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        <span>Calculando necesidades...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Necesidad de Compra</h3>
        <Button variant="outline" size="sm" onClick={cargarDatos}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Consolidado de insumos necesarios para ordenes planificadas vs stock disponible.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Insumo</TableHead>
            <TableHead className="text-right">Stock Actual</TableHead>
            <TableHead className="text-right">Necesario (planificadas)</TableHead>
            <TableHead className="text-right">A Comprar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {datos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                Sin ordenes planificadas pendientes.
              </TableCell>
            </TableRow>
          ) : (
            datos.map((d, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{d.insumo_nombre}</TableCell>
                <TableCell className="text-right">{formatoCantidad(d.stock_actual, d.unidad)}</TableCell>
                <TableCell className="text-right">{formatoCantidad(d.necesario, d.unidad)}</TableCell>
                <TableCell className={`text-right font-semibold ${d.a_comprar > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {d.a_comprar > 0 ? formatoCantidad(d.a_comprar, d.unidad) : 'OK'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ============================================================
// TAB LOTES AGRICOLAS
// ============================================================

function TabLotesAgricolas() {
  const [lotes, setLotes] = useState<LoteAgricola[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarModalLote, setMostrarModalLote] = useState(false)

  const [nuevoLote, setNuevoLote] = useState({
    nombre_lote: '',
    campo: '',
    hectareas: '',
    cultivo: '',
    campaña: '',
    fecha_siembra: '',
    fecha_cosecha_estimada: '',
    estado: 'sembrado',
    observaciones: ''
  })

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.schema('productivo').from('lotes_agricolas')
        .select('*')
        .order('campaña', { ascending: false })
        .order('nombre_lote')
      if (error) throw error
      if (data) setLotes(data)
    } catch (err) {
      console.error('Error cargando lotes:', err)
      toast.error('Error al cargar lotes agricolas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const guardarLote = async () => {
    if (!nuevoLote.nombre_lote || !nuevoLote.hectareas || !nuevoLote.cultivo) {
      toast.error('Nombre, hectareas y cultivo son obligatorios')
      return
    }

    const datos: any = {
      nombre_lote: nuevoLote.nombre_lote,
      hectareas: parseFloat(nuevoLote.hectareas),
      cultivo: nuevoLote.cultivo,
      estado: nuevoLote.estado,
    }
    if (nuevoLote.campo) datos.campo = nuevoLote.campo
    if (nuevoLote.campaña) datos.campaña = nuevoLote.campaña
    if (nuevoLote.fecha_siembra) datos.fecha_siembra = nuevoLote.fecha_siembra
    if (nuevoLote.fecha_cosecha_estimada) datos.fecha_cosecha_estimada = nuevoLote.fecha_cosecha_estimada
    if (nuevoLote.observaciones) datos.observaciones = nuevoLote.observaciones

    const { error } = await supabase.schema('productivo').from('lotes_agricolas').insert(datos)
    if (error) {
      console.error('Error guardando lote:', error)
      toast.error('Error al guardar lote')
      return
    }

    toast.success('Lote agricola registrado')
    setMostrarModalLote(false)
    setNuevoLote({
      nombre_lote: '', campo: '', hectareas: '', cultivo: '', campaña: '',
      fecha_siembra: '', fecha_cosecha_estimada: '', estado: 'sembrado', observaciones: ''
    })
    cargarDatos()
  }

  const colorEstado = (estado: string) => {
    switch (estado) {
      case 'sembrado': return 'bg-green-100 text-green-800'
      case 'en_crecimiento': return 'bg-yellow-100 text-yellow-800'
      case 'cosechado': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        <span>Cargando lotes agricolas...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Lotes Agricolas</h3>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setMostrarModalLote(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Nuevo Lote
          </Button>
          <Button variant="outline" size="sm" onClick={cargarDatos}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lote</TableHead>
            <TableHead>Campo</TableHead>
            <TableHead className="text-right">Hectareas</TableHead>
            <TableHead>Cultivo</TableHead>
            <TableHead>Campaña</TableHead>
            <TableHead>Siembra</TableHead>
            <TableHead>Cosecha Est.</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Obs.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lotes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                Sin lotes agricolas registrados.
              </TableCell>
            </TableRow>
          ) : (
            lotes.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.nombre_lote}</TableCell>
                <TableCell>{l.campo || '-'}</TableCell>
                <TableCell className="text-right">{formatoNumero(l.hectareas)} ha</TableCell>
                <TableCell>{l.cultivo}</TableCell>
                <TableCell>{l.campaña || '-'}</TableCell>
                <TableCell>{formatoFecha(l.fecha_siembra)}</TableCell>
                <TableCell>{formatoFecha(l.fecha_cosecha_estimada)}</TableCell>
                <TableCell>
                  <Badge className={colorEstado(l.estado)}>{l.estado.replace('_', ' ')}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{l.observaciones || '-'}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Modal Nuevo Lote */}
      <Dialog open={mostrarModalLote} onOpenChange={setMostrarModalLote}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Lote Agricola</DialogTitle>
            <DialogDescription>Registrar lote con cultivo, hectareas y campaña.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre Lote *</Label>
                <Input value={nuevoLote.nombre_lote} onChange={e => setNuevoLote(p => ({ ...p, nombre_lote: e.target.value }))} />
              </div>
              <div>
                <Label>Campo</Label>
                <Input value={nuevoLote.campo} onChange={e => setNuevoLote(p => ({ ...p, campo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Hectareas *</Label>
                <Input type="number" value={nuevoLote.hectareas} onChange={e => setNuevoLote(p => ({ ...p, hectareas: e.target.value }))} />
              </div>
              <div>
                <Label>Cultivo *</Label>
                <Input value={nuevoLote.cultivo} onChange={e => setNuevoLote(p => ({ ...p, cultivo: e.target.value }))} placeholder="Soja, Maiz, Trigo..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Campaña</Label>
                <Input value={nuevoLote.campaña} onChange={e => setNuevoLote(p => ({ ...p, campaña: e.target.value }))} placeholder="25/26" />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={nuevoLote.estado} onValueChange={v => setNuevoLote(p => ({ ...p, estado: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" className="z-[9999]">
                    <SelectItem value="sembrado">Sembrado</SelectItem>
                    <SelectItem value="en_crecimiento">En Crecimiento</SelectItem>
                    <SelectItem value="cosechado">Cosechado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha Siembra</Label>
                <Input type="date" value={nuevoLote.fecha_siembra} onChange={e => setNuevoLote(p => ({ ...p, fecha_siembra: e.target.value }))} />
              </div>
              <div>
                <Label>Fecha Cosecha Estimada</Label>
                <Input type="date" value={nuevoLote.fecha_cosecha_estimada} onChange={e => setNuevoLote(p => ({ ...p, fecha_cosecha_estimada: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Input value={nuevoLote.observaciones} onChange={e => setNuevoLote(p => ({ ...p, observaciones: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMostrarModalLote(false)}>Cancelar</Button>
            <Button onClick={guardarLote}>Guardar Lote</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
