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
import { Loader2, Plus, RefreshCw, Beef, Wheat, Package, Edit3, Syringe, ShoppingCart, Trash2 } from "lucide-react"
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

interface OrdenAplicacion {
  id: string
  fecha: string
  categoria_hacienda_id: string
  cantidad_cabezas: number
  estado: string
  observaciones: string | null
  created_at: string
  categorias_hacienda?: { nombre: string }
  lineas?: LineaOrdenAplicacion[]
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
  created_at: string
}

interface LineaFormulario {
  key: number
  insumo_nombre: string
  insumo_stock_id: string
  tipo_dosis: 'por_cabeza' | 'por_kilo'
  dosis_ml: string
  dosis_cada_kg: string
  peso_promedio_kg: string
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

const formatoMl = (ml: number): string => {
  if (ml >= 1000) {
    return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(ml / 1000)} L`
  }
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(ml)} ml`
}

const calcularTotalMl = (
  tipoDosis: string,
  dosisMl: number,
  cantidadCabezas: number,
  dosisCadaKg?: number | null,
  pesoPromedioKg?: number | null
): number => {
  if (tipoDosis === 'por_cabeza') {
    return dosisMl * cantidadCabezas
  }
  // por_kilo: (peso_promedio / cada_kg) * dosis_ml * cantidad_cabezas
  if (dosisCadaKg && pesoPromedioKg) {
    return (pesoPromedioKg / dosisCadaKg) * dosisMl * cantidadCabezas
  }
  return 0
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

function SubTabStockInsumos() {
  const [stock, setStock] = useState<StockInsumo[]>([])
  const [categorias, setCategorias] = useState<CategoriaInsumo[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoInsumo[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarModalMov, setMostrarModalMov] = useState(false)
  const [verMovimientos, setVerMovimientos] = useState(false)

  const [nuevoMov, setNuevoMov] = useState({
    fecha: new Date().toISOString().split('T')[0],
    insumo_stock_id: '',
    tipo: 'compra',
    cantidad: '',
    costo_unitario: '',
    monto_total: '',
    destino_campo: '',
    proveedor: '',
    cuit: '',
    observaciones: ''
  })

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const [catRes, stockRes, movRes] = await Promise.all([
        supabase.schema('productivo').from('categorias_insumo').select('*').eq('activo', true).order('nombre'),
        supabase.schema('productivo').from('stock_insumos').select('*, categorias_insumo(nombre, unidad_medida)').order('producto'),
        supabase.schema('productivo').from('movimientos_insumos').select('*, stock_insumos(producto, categorias_insumo(nombre))').order('fecha', { ascending: false }).limit(50)
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

  const guardarMovimiento = async () => {
    if (!nuevoMov.cantidad) {
      toast.error('Cantidad es obligatoria')
      return
    }

    const datos: any = {
      fecha: nuevoMov.fecha,
      tipo: nuevoMov.tipo,
      cantidad: parseFloat(nuevoMov.cantidad),
    }
    if (nuevoMov.insumo_stock_id) datos.insumo_stock_id = nuevoMov.insumo_stock_id
    if (nuevoMov.costo_unitario) datos.costo_unitario = parseFloat(nuevoMov.costo_unitario)
    if (nuevoMov.monto_total) datos.monto_total = parseFloat(nuevoMov.monto_total)
    if (nuevoMov.destino_campo) datos.destino_campo = nuevoMov.destino_campo
    if (nuevoMov.proveedor) datos.proveedor = nuevoMov.proveedor
    if (nuevoMov.cuit) datos.cuit = nuevoMov.cuit
    if (nuevoMov.observaciones) datos.observaciones = nuevoMov.observaciones

    const { error } = await supabase.schema('productivo').from('movimientos_insumos').insert(datos)
    if (error) {
      console.error('Error guardando movimiento insumo:', error)
      toast.error('Error al guardar movimiento')
      return
    }

    toast.success('Movimiento de insumo registrado')
    setMostrarModalMov(false)
    setNuevoMov({
      fecha: new Date().toISOString().split('T')[0],
      insumo_stock_id: '', tipo: 'compra', cantidad: '', costo_unitario: '',
      monto_total: '', destino_campo: '', proveedor: '', cuit: '', observaciones: ''
    })
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
              <TableHead>Producto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Costo Unit.</TableHead>
              <TableHead>Observaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Sin registros de stock de insumos.
                </TableCell>
              </TableRow>
            ) : (
              stock.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.producto}</TableCell>
                  <TableCell>{s.categorias_insumo?.nombre || '-'}</TableCell>
                  <TableCell className="text-right">{formatoNumero(s.cantidad)}</TableCell>
                  <TableCell>{s.categorias_insumo?.unidad_medida || '-'}</TableCell>
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
              movimientos.map(m => (
                <TableRow key={m.id}>
                  <TableCell>{formatoFecha(m.fecha)}</TableCell>
                  <TableCell>
                    <Badge variant={m.tipo === 'compra' ? 'default' : m.tipo === 'uso' ? 'secondary' : 'outline'}>
                      {m.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.stock_insumos?.producto || '-'}</TableCell>
                  <TableCell className="text-right">{formatoNumero(m.cantidad)}</TableCell>
                  <TableCell className="text-right">{formatoMoneda(m.costo_unitario)}</TableCell>
                  <TableCell className="text-right">{formatoMoneda(m.monto_total)}</TableCell>
                  <TableCell>{m.proveedor || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.observaciones || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Modal Nuevo Movimiento Insumo */}
      <Dialog open={mostrarModalMov} onOpenChange={setMostrarModalMov}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Movimiento Insumo</DialogTitle>
            <DialogDescription>Registrar compra, uso o ajuste de insumos.</DialogDescription>
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
                    <SelectItem value="uso">Uso</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Producto (stock existente)</Label>
              <Select value={nuevoMov.insumo_stock_id} onValueChange={v => setNuevoMov(p => ({ ...p, insumo_stock_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar (opcional)" /></SelectTrigger>
                <SelectContent position="popper" className="z-[9999]">
                  {stock.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.producto} ({s.categorias_insumo?.nombre})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cantidad *</Label>
                <Input type="number" value={nuevoMov.cantidad} onChange={e => setNuevoMov(p => ({ ...p, cantidad: e.target.value }))} />
              </div>
              <div>
                <Label>Costo Unitario</Label>
                <Input type="number" value={nuevoMov.costo_unitario} onChange={e => setNuevoMov(p => ({ ...p, costo_unitario: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Monto Total</Label>
              <Input type="number" value={nuevoMov.monto_total} onChange={e => setNuevoMov(p => ({ ...p, monto_total: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Destino/Campo</Label>
                <Input value={nuevoMov.destino_campo} onChange={e => setNuevoMov(p => ({ ...p, destino_campo: e.target.value }))} />
              </div>
              <div>
                <Label>Proveedor</Label>
                <Input value={nuevoMov.proveedor} onChange={e => setNuevoMov(p => ({ ...p, proveedor: e.target.value }))} />
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

  // Form cabecera
  const [nuevaOrden, setNuevaOrden] = useState({
    fecha: new Date().toISOString().split('T')[0],
    categoria_hacienda_id: '',
    cantidad_cabezas: '',
    observaciones: ''
  })

  // Lineas de la orden
  const [lineas, setLineas] = useState<LineaFormulario[]>([])

  const agregarLinea = () => {
    setLineas(prev => [...prev, {
      key: Date.now(),
      insumo_nombre: '',
      insumo_stock_id: '',
      tipo_dosis: 'por_cabeza',
      dosis_ml: '',
      dosis_cada_kg: '',
      peso_promedio_kg: ''
    }])
  }

  const actualizarLinea = (key: number, campo: string, valor: any) => {
    setLineas(prev => prev.map(l => l.key === key ? { ...l, [campo]: valor } : l))
  }

  const eliminarLinea = (key: number) => {
    setLineas(prev => prev.filter(l => l.key !== key))
  }

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const [ordenesRes, catHacRes, insRes, movHacRes] = await Promise.all([
        supabase.schema('productivo').from('ordenes_aplicacion')
          .select('*, categorias_hacienda(nombre), lineas_orden_aplicacion(*)')
          .order('fecha', { ascending: false }),
        supabase.schema('productivo').from('categorias_hacienda')
          .select('*').eq('activo', true).order('nombre'),
        supabase.schema('productivo').from('stock_insumos')
          .select('*, categorias_insumo(nombre, unidad_medida)')
          .order('producto'),
        supabase.schema('productivo').from('movimientos_hacienda')
          .select('categoria_id, tipo, cantidad')
      ])

      if (ordenesRes.data) {
        setOrdenes(ordenesRes.data.map((o: any) => ({
          ...o,
          lineas: o.lineas_orden_aplicacion || []
        })))
      }
      if (catHacRes.data) setCategoriasHacienda(catHacRes.data)
      if (insRes.data) setInsumosVet(insRes.data)

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

  // Auto-completar cabezas al seleccionar categoria
  const onCategoriaChange = (catId: string) => {
    setNuevaOrden(p => ({
      ...p,
      categoria_hacienda_id: catId,
      cantidad_cabezas: String(stockHaciendaMap[catId] || 0)
    }))
  }

  const guardarOrden = async () => {
    if (!nuevaOrden.categoria_hacienda_id || !nuevaOrden.cantidad_cabezas) {
      toast.error('Seleccione rodeo y cantidad de cabezas')
      return
    }
    if (lineas.length === 0) {
      toast.error('Agregue al menos un insumo')
      return
    }

    const cabezas = parseInt(nuevaOrden.cantidad_cabezas)
    // Validar lineas
    for (const l of lineas) {
      if (!l.insumo_nombre && !l.insumo_stock_id) {
        toast.error('Cada linea debe tener un insumo')
        return
      }
      if (!l.dosis_ml || parseFloat(l.dosis_ml) <= 0) {
        toast.error('Cada linea debe tener dosis en ml')
        return
      }
      if (l.tipo_dosis === 'por_kilo') {
        if (!l.dosis_cada_kg || !l.peso_promedio_kg) {
          toast.error('Para dosis por kilo, complete "Cada X kg" y "Peso Promedio"')
          return
        }
      }
    }

    setGuardando(true)
    try {
      // 1. Crear orden cabecera
      const { data: ordenData, error: ordenError } = await supabase.schema('productivo')
        .from('ordenes_aplicacion')
        .insert({
          fecha: nuevaOrden.fecha,
          categoria_hacienda_id: nuevaOrden.categoria_hacienda_id,
          cantidad_cabezas: cabezas,
          estado: 'planificada',
          observaciones: nuevaOrden.observaciones || null
        })
        .select('id')
        .single()

      if (ordenError || !ordenData) {
        throw new Error(ordenError?.message || 'Error creando orden')
      }

      // 2. Crear lineas
      const lineasData = lineas.map(l => {
        const dosisMl = parseFloat(l.dosis_ml)
        const dosisCadaKg = l.tipo_dosis === 'por_kilo' ? parseFloat(l.dosis_cada_kg) : null
        const pesoPromedio = l.tipo_dosis === 'por_kilo' ? parseFloat(l.peso_promedio_kg) : null
        const totalMl = calcularTotalMl(l.tipo_dosis, dosisMl, cabezas, dosisCadaKg, pesoPromedio)

        // Determinar nombre insumo
        const insumoStock = l.insumo_stock_id ? insumosVet.find(i => i.id === l.insumo_stock_id) : null
        const nombre = insumoStock ? insumoStock.producto : l.insumo_nombre

        return {
          orden_id: ordenData.id,
          insumo_nombre: nombre,
          insumo_stock_id: l.insumo_stock_id || null,
          tipo_dosis: l.tipo_dosis,
          dosis_ml: dosisMl,
          dosis_cada_kg: dosisCadaKg,
          peso_promedio_kg: pesoPromedio,
          cantidad_total_ml: totalMl,
          unidad_medida: 'ml'
        }
      })

      const { error: lineasError } = await supabase.schema('productivo')
        .from('lineas_orden_aplicacion')
        .insert(lineasData)

      if (lineasError) throw new Error(lineasError.message)

      // 3. Crear movimientos de uso en stock_insumos para las lineas que tengan insumo_stock_id
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

      toast.success('Orden de aplicacion creada')
      setMostrarModal(false)
      setNuevaOrden({ fecha: new Date().toISOString().split('T')[0], categoria_hacienda_id: '', cantidad_cabezas: '', observaciones: '' })
      setLineas([])
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

  const cabezasForm = parseInt(nuevaOrden.cantidad_cabezas) || 0

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Ordenes de Aplicacion Veterinaria</h3>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { setMostrarModal(true); if (lineas.length === 0) agregarLinea() }}>
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
            <TableHead>Rodeo</TableHead>
            <TableHead className="text-right">Cabezas</TableHead>
            <TableHead>Insumos</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Obs.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordenes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Sin ordenes de aplicacion registradas.
              </TableCell>
            </TableRow>
          ) : (
            ordenes.map(o => (
              <TableRow key={o.id}>
                <TableCell>{formatoFecha(o.fecha)}</TableCell>
                <TableCell className="font-medium">{o.categorias_hacienda?.nombre || '-'}</TableCell>
                <TableCell className="text-right">{formatoNumero(o.cantidad_cabezas)}</TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {o.lineas && o.lineas.length > 0 ? o.lineas.map((l, i) => (
                      <div key={l.id} className="text-xs">
                        {l.insumo_nombre}: {formatoMl(l.cantidad_total_ml)}
                      </div>
                    )) : <span className="text-muted-foreground text-xs">-</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={o.estado === 'ejecutada' ? 'default' : 'outline'}>
                    {o.estado}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {o.observaciones || '-'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Modal Nueva Orden */}
      <Dialog open={mostrarModal} onOpenChange={setMostrarModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Orden de Aplicacion</DialogTitle>
            <DialogDescription>Seleccione rodeo, agregue insumos con dosis y el sistema calcula totales.</DialogDescription>
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
                <Label>Rodeo (Categoria) *</Label>
                <Select value={nuevaOrden.categoria_hacienda_id} onValueChange={onCategoriaChange}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar rodeo" /></SelectTrigger>
                  <SelectContent position="popper" className="z-[9999]">
                    {categoriasHacienda.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre} ({stockHaciendaMap[c.id] || 0} cab.)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad Cabezas *</Label>
                <Input type="number" value={nuevaOrden.cantidad_cabezas}
                  onChange={e => setNuevaOrden(p => ({ ...p, cantidad_cabezas: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Input value={nuevaOrden.observaciones}
                onChange={e => setNuevaOrden(p => ({ ...p, observaciones: e.target.value }))} />
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
                    <TableHead className="w-[80px] text-right">Dosis (ml)</TableHead>
                    <TableHead className="w-[90px] text-right">Cada X kg</TableHead>
                    <TableHead className="w-[90px] text-right">Peso Prom. kg</TableHead>
                    <TableHead className="w-[100px] text-right">Total</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map(l => {
                    const dosisMl = parseFloat(l.dosis_ml) || 0
                    const dosisCadaKg = parseFloat(l.dosis_cada_kg) || 0
                    const pesoPromedio = parseFloat(l.peso_promedio_kg) || 0
                    const totalMl = calcularTotalMl(l.tipo_dosis, dosisMl, cabezasForm, dosisCadaKg, pesoPromedio)

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
                              <SelectItem value="por_cabeza">Por cabeza</SelectItem>
                              <SelectItem value="por_kilo">Por kilo</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" className="h-8 text-xs text-right"
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
                        <TableCell>
                          {l.tipo_dosis === 'por_kilo' ? (
                            <Input type="number" step="0.01" className="h-8 text-xs text-right"
                              value={l.peso_promedio_kg}
                              onChange={e => actualizarLinea(l.key, 'peso_promedio_kg', e.target.value)} />
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {totalMl > 0 ? formatoMl(totalMl) : '-'}
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
            <Button variant="outline" onClick={() => setMostrarModal(false)}>Cancelar</Button>
            <Button onClick={guardarOrden} disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Orden
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
  }[]>([])
  const [loading, setLoading] = useState(true)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      // Obtener lineas de ordenes planificadas + stock actual
      const [lineasRes, stockRes] = await Promise.all([
        supabase.schema('productivo').from('lineas_orden_aplicacion')
          .select('insumo_nombre, insumo_stock_id, cantidad_total_ml, ordenes_aplicacion!inner(estado)')
          .eq('ordenes_aplicacion.estado', 'planificada'),
        supabase.schema('productivo').from('stock_insumos')
          .select('id, producto, cantidad')
      ])

      // Consolidar necesidades por insumo
      const necesidadMap: Record<string, { nombre: string, stockId: string | null, necesario: number }> = {}
      if (lineasRes.data) {
        for (const l of lineasRes.data) {
          const key = l.insumo_stock_id || l.insumo_nombre
          if (!necesidadMap[key]) {
            necesidadMap[key] = { nombre: l.insumo_nombre, stockId: l.insumo_stock_id, necesario: 0 }
          }
          necesidadMap[key].necesario += l.cantidad_total_ml
        }
      }

      // Mapear stock actual
      const stockMap: Record<string, number> = {}
      if (stockRes.data) {
        for (const s of stockRes.data) {
          stockMap[s.id] = s.cantidad
        }
      }

      // Combinar
      const resultado = Object.values(necesidadMap).map(n => {
        const stockActual = n.stockId ? (stockMap[n.stockId] || 0) : 0
        return {
          insumo_nombre: n.nombre,
          stock_actual: stockActual,
          necesario: n.necesario,
          a_comprar: Math.max(0, n.necesario - stockActual)
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
                <TableCell className="text-right">{formatoMl(d.stock_actual)}</TableCell>
                <TableCell className="text-right">{formatoMl(d.necesario)}</TableCell>
                <TableCell className={`text-right font-semibold ${d.a_comprar > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {d.a_comprar > 0 ? formatoMl(d.a_comprar) : 'OK'}
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
