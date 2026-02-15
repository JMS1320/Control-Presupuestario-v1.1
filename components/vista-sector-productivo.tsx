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
import { Loader2, Plus, RefreshCw, Beef, Wheat, Package } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

// ============================================================
// TIPOS
// ============================================================

interface CategoriaHacienda {
  id: number
  nombre: string
  activo: boolean
}

interface StockHacienda {
  id: string
  categoria_id: number
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
  categoria_id: number
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
  id: number
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

function TabHacienda() {
  const [stock, setStock] = useState<StockHacienda[]>([])
  const [categorias, setCategorias] = useState<CategoriaHacienda[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoHacienda[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarModalMov, setMostrarModalMov] = useState(false)
  const [verMovimientos, setVerMovimientos] = useState(false)

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
      const [catRes, stockRes, movRes] = await Promise.all([
        supabase.schema('productivo').from('categorias_hacienda').select('*').eq('activo', true).order('nombre'),
        supabase.schema('productivo').from('stock_hacienda').select('*, categorias_hacienda(nombre)').order('categoria_id'),
        supabase.schema('productivo').from('movimientos_hacienda').select('*, categorias_hacienda(nombre)').order('fecha', { ascending: false }).limit(50)
      ])
      if (catRes.data) setCategorias(catRes.data)
      if (stockRes.data) setStock(stockRes.data)
      if (movRes.data) setMovimientos(movRes.data)
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
      categoria_id: parseInt(nuevoMov.categoria_id),
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
              <TableHead className="text-right">Peso Prom. (kg)</TableHead>
              <TableHead>Campo</TableHead>
              <TableHead>Observaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Sin registros de stock. Registre movimientos para actualizar.
                </TableCell>
              </TableRow>
            ) : (
              stock.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.categorias_hacienda?.nombre || '-'}</TableCell>
                  <TableCell className="text-right">{formatoNumero(s.cantidad)}</TableCell>
                  <TableCell className="text-right">{s.peso_promedio_kg ? `${formatoNumero(s.peso_promedio_kg)} kg` : '-'}</TableCell>
                  <TableCell>{s.campo || '-'}</TableCell>
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
              movimientos.map(m => (
                <TableRow key={m.id}>
                  <TableCell>{formatoFecha(m.fecha)}</TableCell>
                  <TableCell>
                    <Badge variant={m.tipo === 'compra' ? 'default' : m.tipo === 'venta' ? 'secondary' : 'outline'}>
                      {m.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.categorias_hacienda?.nombre || '-'}</TableCell>
                  <TableCell className="text-right">{formatoNumero(m.cantidad)}</TableCell>
                  <TableCell className="text-right">{m.peso_total_kg ? `${formatoNumero(m.peso_total_kg)}` : '-'}</TableCell>
                  <TableCell className="text-right">{formatoMoneda(m.monto_total)}</TableCell>
                  <TableCell>{m.proveedor_cliente || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.observaciones || '-'}</TableCell>
                </TableRow>
              ))
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
                  <SelectContent>
                    <SelectItem value="compra">Compra</SelectItem>
                    <SelectItem value="venta">Venta</SelectItem>
                    <SelectItem value="nacimiento">Nacimiento</SelectItem>
                    <SelectItem value="mortandad">Mortandad</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria *</Label>
                <Select value={nuevoMov.categoria_id} onValueChange={v => setNuevoMov(p => ({ ...p, categoria_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
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
// TAB INSUMOS
// ============================================================

function TabInsumos() {
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
                  <SelectContent>
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
                <SelectContent>
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
                  <SelectContent>
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
