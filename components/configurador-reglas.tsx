"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Plus, Edit, Trash2, ArrowUp, ArrowDown, Settings, Eye, EyeOff } from "lucide-react"
import { useReglasConciliacion } from "@/hooks/useReglasConciliacion"
import { ReglaConciliacion } from "@/types/conciliacion"

export function ConfiguradorReglas() {
  const { reglas, loading, error, crearRegla, actualizarRegla, eliminarRegla, toggleRegla, reordenarReglas } = useReglasConciliacion()
  
  const [modalAbierto, setModalAbierto] = useState(false)
  const [reglaEditando, setReglaEditando] = useState<ReglaConciliacion | null>(null)
  const [formulario, setFormulario] = useState({
    orden: '',
    tipo: '',
    columna_busqueda: '',
    texto_buscar: '',
    tipo_match: '',
    categ: '',
    centro_costo: '',
    detalle: '',
    activo: true
  })

  // Reset formulario
  const resetFormulario = () => {
    setFormulario({
      orden: '',
      tipo: '',
      columna_busqueda: '',
      texto_buscar: '',
      tipo_match: '',
      categ: '',
      centro_costo: '',
      detalle: '',
      activo: true
    })
    setReglaEditando(null)
  }

  // Abrir modal para nueva regla
  const abrirModalNueva = () => {
    resetFormulario()
    // Sugerir próximo orden disponible
    const maxOrden = Math.max(...reglas.map(r => r.orden), 0)
    setFormulario(prev => ({ ...prev, orden: String(maxOrden + 1) }))
    setModalAbierto(true)
  }

  // Abrir modal para editar
  const abrirModalEditar = (regla: ReglaConciliacion) => {
    setReglaEditando(regla)
    setFormulario({
      orden: String(regla.orden),
      tipo: regla.tipo,
      columna_busqueda: regla.columna_busqueda,
      texto_buscar: regla.texto_buscar,
      tipo_match: regla.tipo_match,
      categ: regla.categ,
      centro_costo: regla.centro_costo || '',
      detalle: regla.detalle,
      activo: regla.activo
    })
    setModalAbierto(true)
  }

  // Guardar regla
  const guardarRegla = async () => {
    const datosRegla = {
      orden: parseInt(formulario.orden),
      tipo: formulario.tipo as any,
      columna_busqueda: formulario.columna_busqueda as any,
      texto_buscar: formulario.texto_buscar,
      tipo_match: formulario.tipo_match as any,
      categ: formulario.categ,
      centro_costo: formulario.centro_costo || null,
      detalle: formulario.detalle,
      activo: formulario.activo
    }

    let exito = false
    if (reglaEditando) {
      exito = await actualizarRegla(reglaEditando.id, datosRegla)
    } else {
      exito = await crearRegla(datosRegla)
    }

    if (exito) {
      setModalAbierto(false)
      resetFormulario()
    }
  }

  // Cambiar orden de regla
  const cambiarOrden = async (regla: ReglaConciliacion, direccion: 'up' | 'down') => {
    const reglasOrdenadas = [...reglas].sort((a, b) => a.orden - b.orden)
    const indiceActual = reglasOrdenadas.findIndex(r => r.id === regla.id)
    
    if (direccion === 'up' && indiceActual > 0) {
      // Intercambiar con anterior
      const temp = reglasOrdenadas[indiceActual].orden
      reglasOrdenadas[indiceActual].orden = reglasOrdenadas[indiceActual - 1].orden
      reglasOrdenadas[indiceActual - 1].orden = temp
    } else if (direccion === 'down' && indiceActual < reglasOrdenadas.length - 1) {
      // Intercambiar con siguiente
      const temp = reglasOrdenadas[indiceActual].orden
      reglasOrdenadas[indiceActual].orden = reglasOrdenadas[indiceActual + 1].orden
      reglasOrdenadas[indiceActual + 1].orden = temp
    }

    await reordenarReglas(reglasOrdenadas)
  }

  // Badge color por tipo
  const getBadgeColor = (tipo: string) => {
    switch (tipo) {
      case 'cash_flow': return 'bg-blue-100 text-blue-800'
      case 'impuestos': return 'bg-red-100 text-red-800'
      case 'bancarios': return 'bg-green-100 text-green-800'
      case 'otras': return 'bg-purple-100 text-purple-800'
      case 'cuit': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando reglas...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configurador de Reglas</h2>
          <p className="text-gray-600">Gestiona las reglas de conciliación bancaria automática</p>
        </div>
        <Button onClick={abrirModalNueva} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Regla
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{reglas.length}</div>
            <p className="text-xs text-gray-600">Total Reglas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{reglas.filter(r => r.activo).length}</div>
            <p className="text-xs text-gray-600">Activas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{reglas.filter(r => !r.activo).length}</div>
            <p className="text-xs text-gray-600">Inactivas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{new Set(reglas.map(r => r.tipo)).size}</div>
            <p className="text-xs text-gray-600">Tipos</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Reglas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Reglas de Conciliación ({reglas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {reglas
              .sort((a, b) => a.orden - b.orden)
              .map((regla) => (
                <div
                  key={regla.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    !regla.activo ? 'opacity-50 bg-gray-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* Orden */}
                    <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      #{regla.orden}
                    </div>

                    {/* Tipo */}
                    <Badge className={getBadgeColor(regla.tipo)}>
                      {regla.tipo.toUpperCase()}
                    </Badge>

                    {/* Criterio */}
                    <div className="flex-1">
                      <div className="font-medium">{regla.texto_buscar}</div>
                      <div className="text-sm text-gray-500">
                        {regla.columna_busqueda} • {regla.tipo_match}
                      </div>
                    </div>

                    {/* Resultado */}
                    <div className="text-right">
                      <div className="font-medium text-blue-600">{regla.categ}</div>
                      <div className="text-sm text-gray-500">{regla.detalle}</div>
                    </div>

                    {/* Estado */}
                    <div className="flex items-center gap-2">
                      {regla.activo ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cambiarOrden(regla, 'up')}
                      disabled={regla.orden === 1}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cambiarOrden(regla, 'down')}
                      disabled={regla.orden === Math.max(...reglas.map(r => r.orden))}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Switch
                      checked={regla.activo}
                      onCheckedChange={() => toggleRegla(regla.id)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirModalEditar(regla)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => eliminarRegla(regla.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal Crear/Editar */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {reglaEditando ? 'Editar Regla' : 'Nueva Regla'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="orden">Orden (Prioridad)</Label>
              <Input
                id="orden"
                type="number"
                value={formulario.orden}
                onChange={(e) => setFormulario(prev => ({ ...prev, orden: e.target.value }))}
                placeholder="1, 2, 3..."
              />
            </div>

            <div>
              <Label htmlFor="tipo">Tipo de Regla</Label>
              <Select value={formulario.tipo} onValueChange={(value) => setFormulario(prev => ({ ...prev, tipo: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash_flow">Cash Flow</SelectItem>
                  <SelectItem value="impuestos">Impuestos</SelectItem>
                  <SelectItem value="bancarios">Bancarios</SelectItem>
                  <SelectItem value="otras">Otras</SelectItem>
                  <SelectItem value="cuit">CUIT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="columna_busqueda">Columna a Buscar</Label>
              <Select value={formulario.columna_busqueda} onValueChange={(value) => setFormulario(prev => ({ ...prev, columna_busqueda: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona columna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="descripcion">Descripción</SelectItem>
                  <SelectItem value="cuit">CUIT</SelectItem>
                  <SelectItem value="monto_debito">Monto Débito</SelectItem>
                  <SelectItem value="monto_credito">Monto Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tipo_match">Tipo de Match</Label>
              <Select value={formulario.tipo_match} onValueChange={(value) => setFormulario(prev => ({ ...prev, tipo_match: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exacto">Exacto</SelectItem>
                  <SelectItem value="contiene">Contiene</SelectItem>
                  <SelectItem value="inicia_con">Inicia Con</SelectItem>
                  <SelectItem value="termina_con">Termina Con</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="texto_buscar">Texto a Buscar</Label>
              <Input
                id="texto_buscar"
                value={formulario.texto_buscar}
                onChange={(e) => setFormulario(prev => ({ ...prev, texto_buscar: e.target.value }))}
                placeholder="Ej: Comision Extraccion, 20044390222"
              />
            </div>

            <div>
              <Label htmlFor="categ">CATEG (Cuenta Contable)</Label>
              <Input
                id="categ"
                value={formulario.categ}
                onChange={(e) => setFormulario(prev => ({ ...prev, categ: e.target.value }))}
                placeholder="Ej: BANC, IMP, FCI"
              />
            </div>

            <div>
              <Label htmlFor="centro_costo">Centro de Costo (Opcional)</Label>
              <Input
                id="centro_costo"
                value={formulario.centro_costo}
                onChange={(e) => setFormulario(prev => ({ ...prev, centro_costo: e.target.value }))}
                placeholder="Ej: ADM, OPE"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="detalle">Detalle</Label>
              <Input
                id="detalle"
                value={formulario.detalle}
                onChange={(e) => setFormulario(prev => ({ ...prev, detalle: e.target.value }))}
                placeholder="Ej: Comision Extracciones Efectivo"
              />
            </div>

            <div className="col-span-2 flex items-center space-x-2">
              <Switch
                id="activo"
                checked={formulario.activo}
                onCheckedChange={(checked) => setFormulario(prev => ({ ...prev, activo: checked }))}
              />
              <Label htmlFor="activo">Regla activa</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarRegla} className="bg-blue-600 hover:bg-blue-700">
              {reglaEditando ? 'Actualizar' : 'Crear'} Regla
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}