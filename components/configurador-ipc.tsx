"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Plus, Edit, Trash2, TrendingUp, Calendar } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface IndiceIPC {
  id: string
  anio: number
  mes: number
  valor_ipc: number
  fuente: 'manual' | 'indec_api' | 'indec_scraping'
  auto_completado: boolean
  observaciones?: string
  created_at: string
}

export function ConfiguradorIPC() {
  const [indices, setIndices] = useState<IndiceIPC[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [indiceEditando, setIndiceEditando] = useState<IndiceIPC | null>(null)
  const [formulario, setFormulario] = useState({
    anio: '',
    mes: '',
    valor_ipc: '',
    observaciones: ''
  })

  // Meses del año
  const meses = [
    { valor: 1, nombre: 'Enero' },
    { valor: 2, nombre: 'Febrero' },
    { valor: 3, nombre: 'Marzo' },
    { valor: 4, nombre: 'Abril' },
    { valor: 5, nombre: 'Mayo' },
    { valor: 6, nombre: 'Junio' },
    { valor: 7, nombre: 'Julio' },
    { valor: 8, nombre: 'Agosto' },
    { valor: 9, nombre: 'Septiembre' },
    { valor: 10, nombre: 'Octubre' },
    { valor: 11, nombre: 'Noviembre' },
    { valor: 12, nombre: 'Diciembre' }
  ]

  // Cargar índices
  const cargarIndices = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error: supabaseError } = await supabase
        .from('indices_ipc')
        .select('*')
        .order('anio', { ascending: false })
        .order('mes', { ascending: false })

      if (supabaseError) {
        console.error('Error al cargar índices IPC:', supabaseError)
        setError(`Error al cargar índices: ${supabaseError.message}`)
        return
      }

      setIndices(data || [])
    } catch (error) {
      console.error('Error inesperado:', error)
      setError('Error inesperado al cargar los índices IPC')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarIndices()
  }, [])

  // Reset formulario
  const resetFormulario = () => {
    const anioActual = new Date().getFullYear()
    setFormulario({
      anio: String(anioActual),
      mes: '',
      valor_ipc: '',
      observaciones: ''
    })
    setIndiceEditando(null)
  }

  // Abrir modal para nuevo índice
  const abrirModalNuevo = () => {
    resetFormulario()
    setModalAbierto(true)
  }

  // Abrir modal para editar
  const abrirModalEditar = (indice: IndiceIPC) => {
    setIndiceEditando(indice)
    setFormulario({
      anio: String(indice.anio),
      mes: String(indice.mes),
      valor_ipc: String(indice.valor_ipc),
      observaciones: indice.observaciones || ''
    })
    setModalAbierto(true)
  }

  // Guardar índice
  const guardarIndice = async () => {
    // Validar campos requeridos
    if (!formulario.anio || !formulario.mes || !formulario.valor_ipc) {
      setError('Año, mes y valor IPC son requeridos')
      return
    }

    const anio = parseInt(formulario.anio)
    const mes = parseInt(formulario.mes)
    const valorIpc = parseFloat(formulario.valor_ipc)

    if (anio < 2024) {
      setError('El año debe ser 2024 o posterior')
      return
    }

    if (valorIpc < 0) {
      setError('El valor IPC no puede ser negativo')
      return
    }

    try {
      const datosIndice = {
        anio,
        mes,
        valor_ipc: valorIpc,
        fuente: 'manual' as const,
        auto_completado: false,
        observaciones: formulario.observaciones || null
      }

      let supabaseError
      if (indiceEditando) {
        const { error } = await supabase
          .from('indices_ipc')
          .update(datosIndice)
          .eq('id', indiceEditando.id)
        supabaseError = error
      } else {
        const { error } = await supabase
          .from('indices_ipc')
          .insert(datosIndice)
        supabaseError = error
      }

      if (supabaseError) {
        console.error('Error al guardar índice:', supabaseError)
        if (supabaseError.code === '23505') {
          setError(`Ya existe un índice IPC para ${meses.find(m => m.valor === mes)?.nombre} ${anio}`)
        } else {
          setError(`Error al guardar índice: ${supabaseError.message}`)
        }
        return
      }

      setModalAbierto(false)
      resetFormulario()
      setError(null)
      await cargarIndices()
    } catch (error) {
      console.error('Error inesperado:', error)
      setError('Error inesperado al guardar el índice')
    }
  }

  // Eliminar índice
  const eliminarIndice = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este índice IPC?')) return

    try {
      const { error: supabaseError } = await supabase
        .from('indices_ipc')
        .delete()
        .eq('id', id)

      if (supabaseError) {
        console.error('Error al eliminar índice:', supabaseError)
        setError(`Error al eliminar índice: ${supabaseError.message}`)
        return
      }

      await cargarIndices()
    } catch (error) {
      console.error('Error inesperado:', error)
      setError('Error inesperado al eliminar el índice')
    }
  }

  // Obtener nombre del mes
  const obtenerNombreMes = (mes: number) => {
    return meses.find(m => m.valor === mes)?.nombre || mes.toString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando índices IPC...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">Índices IPC Mensuales</h3>
          <p className="text-gray-600">Gestión de índices de inflación mensual (dato público)</p>
        </div>
        <Button onClick={abrirModalNuevo} className="bg-orange-600 hover:bg-orange-700">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Índice
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
            <div className="text-2xl font-bold">{indices.length}</div>
            <p className="text-xs text-gray-600">Total Índices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">
              {indices.filter(i => i.anio === new Date().getFullYear()).length}
            </div>
            <p className="text-xs text-gray-600">Año Actual</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {indices.filter(i => i.auto_completado).length}
            </div>
            <p className="text-xs text-gray-600">Automáticos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {indices.length > 0 ? indices[0].valor_ipc.toFixed(2) + '%' : '-'}
            </div>
            <p className="text-xs text-gray-600">Último IPC</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Índices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Índices IPC ({indices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {indices.map((indice) => (
              <div
                key={indice.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-white"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Fecha */}
                  <div className="text-sm font-mono bg-gray-100 px-3 py-2 rounded">
                    <Calendar className="h-4 w-4 inline mr-2" />
                    {obtenerNombreMes(indice.mes)} {indice.anio}
                  </div>

                  {/* Valor IPC */}
                  <div className="text-2xl font-bold text-orange-600">
                    {indice.valor_ipc.toFixed(2)}%
                  </div>

                  {/* Fuente */}
                  <Badge variant={indice.auto_completado ? 'default' : 'secondary'}>
                    {indice.fuente.toUpperCase()}
                  </Badge>

                  {/* Observaciones */}
                  {indice.observaciones && (
                    <div className="text-sm text-gray-500 flex-1">
                      {indice.observaciones}
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => abrirModalEditar(indice)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => eliminarIndice(indice.id)}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {indiceEditando ? 'Editar Índice' : 'Nuevo Índice'} IPC
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="anio">Año *</Label>
                <Input
                  id="anio"
                  type="number"
                  min="2024"
                  value={formulario.anio}
                  onChange={(e) => setFormulario(prev => ({ ...prev, anio: e.target.value }))}
                  placeholder="2024"
                />
              </div>

              <div>
                <Label htmlFor="mes">Mes *</Label>
                <Select value={formulario.mes} onValueChange={(value) => setFormulario(prev => ({ ...prev, mes: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map(mes => (
                      <SelectItem key={mes.valor} value={String(mes.valor)}>
                        {mes.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="valor_ipc">Valor IPC (%) *</Label>
              <Input
                id="valor_ipc"
                type="number"
                step="0.001"
                min="0"
                value={formulario.valor_ipc}
                onChange={(e) => setFormulario(prev => ({ ...prev, valor_ipc: e.target.value }))}
                placeholder="Ej: 2.5"
              />
            </div>

            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <Input
                id="observaciones"
                value={formulario.observaciones}
                onChange={(e) => setFormulario(prev => ({ ...prev, observaciones: e.target.value }))}
                placeholder="Ej: Dato preliminar, revisado, etc."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarIndice} className="bg-orange-600 hover:bg-orange-700">
              {indiceEditando ? 'Actualizar' : 'Crear'} Índice
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}