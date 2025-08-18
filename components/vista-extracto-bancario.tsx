"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  X
} from "lucide-react"
import { ConfiguradorReglas } from "./configurador-reglas"
import { useMotorConciliacion, CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"
import { useMovimientosBancarios } from "@/hooks/useMovimientosBancarios"

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

  const { procesoEnCurso, error, resultados, ejecutarConciliacion, cuentasDisponibles } = useMotorConciliacion()
  const { movimientos, estadisticas, loading, cargarMovimientos, actualizarMasivo, recargar } = useMovimientosBancarios()

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
        // Resetear después de aplicar exitosamente
        setSeleccionados(new Set())
        setModoEdicion(false)
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

  // Cancelar modo edición
  const cancelarEdicion = () => {
    setModoEdicion(false)
    setSeleccionados(new Set())
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
                    <Input
                      placeholder="Cuenta contable"
                      value={editData.categ}
                      onChange={(e) => setEditData({...editData, categ: e.target.value})}
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
                            {new Date(movimiento.fecha).toLocaleDateString('es-AR')}
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