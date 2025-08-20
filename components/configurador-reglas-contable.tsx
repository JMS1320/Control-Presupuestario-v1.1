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
import { Loader2, Plus, Edit, Trash2, Building, FileText } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface ReglaContableInterno {
  id: string
  orden: number
  tipo_regla: 'contable' | 'interno'
  banco_origen: 'MSA' | 'PAM' // Si es pagado por MSA o PAM
  tipo_gasto: 'template' | 'factura' // Si viene de template o factura
  proveedor_pattern: string // Patrón para identificar proveedor
  valor_asignar: string // Valor a asignar en contable o interno
  activo: boolean
  created_at: string
}

export function ConfiguradorReglasContable() {
  const [reglas, setReglas] = useState<ReglaContableInterno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [reglaEditando, setReglaEditando] = useState<ReglaContableInterno | null>(null)
  const [formulario, setFormulario] = useState({
    orden: '',
    tipo_regla: '',
    banco_origen: '',
    tipo_gasto: '',
    proveedor_pattern: '',
    valor_asignar: '',
    activo: true
  })

  // Cargar reglas
  const cargarReglas = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error: supabaseError } = await supabase
        .from('reglas_contable_interno')
        .select('*')
        .order('orden', { ascending: true })

      if (supabaseError) {
        console.error('Error al cargar reglas contable/interno:', supabaseError)
        setError(`Error al cargar reglas: ${supabaseError.message}`)
        return
      }

      setReglas(data || [])
    } catch (error) {
      console.error('Error inesperado:', error)
      setError('Error inesperado al cargar las reglas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarReglas()
  }, [])

  // Reset formulario
  const resetFormulario = () => {
    setFormulario({
      orden: '',
      tipo_regla: '',
      banco_origen: '',
      tipo_gasto: '',
      proveedor_pattern: '',
      valor_asignar: '',
      activo: true
    })
    setReglaEditando(null)
  }

  // Abrir modal para nueva regla
  const abrirModalNueva = () => {
    resetFormulario()
    const maxOrden = Math.max(...reglas.map(r => r.orden), 0)
    setFormulario(prev => ({ ...prev, orden: String(maxOrden + 1) }))
    setModalAbierto(true)
  }

  // Abrir modal para editar
  const abrirModalEditar = (regla: ReglaContableInterno) => {
    setReglaEditando(regla)
    setFormulario({
      orden: String(regla.orden),
      tipo_regla: regla.tipo_regla,
      banco_origen: regla.banco_origen,
      tipo_gasto: regla.tipo_gasto,
      proveedor_pattern: regla.proveedor_pattern,
      valor_asignar: regla.valor_asignar,
      activo: regla.activo
    })
    setModalAbierto(true)
  }

  // Guardar regla
  const guardarRegla = async () => {
    // Validar campos requeridos
    if (!formulario.orden || !formulario.tipo_regla || !formulario.banco_origen || 
        !formulario.tipo_gasto || !formulario.proveedor_pattern || !formulario.valor_asignar) {
      setError('Todos los campos son requeridos')
      return
    }

    try {
      const datosRegla = {
        orden: parseInt(formulario.orden),
        tipo_regla: formulario.tipo_regla as 'contable' | 'interno',
        banco_origen: formulario.banco_origen as 'MSA' | 'PAM',
        tipo_gasto: formulario.tipo_gasto as 'template' | 'factura',
        proveedor_pattern: formulario.proveedor_pattern,
        valor_asignar: formulario.valor_asignar,
        activo: formulario.activo
      }

      let supabaseError
      if (reglaEditando) {
        const { error } = await supabase
          .from('reglas_contable_interno')
          .update(datosRegla)
          .eq('id', reglaEditando.id)
        supabaseError = error
      } else {
        const { error } = await supabase
          .from('reglas_contable_interno')
          .insert(datosRegla)
        supabaseError = error
      }

      if (supabaseError) {
        console.error('Error al guardar regla:', supabaseError)
        setError(`Error al guardar regla: ${supabaseError.message}`)
        return
      }

      setModalAbierto(false)
      resetFormulario()
      setError(null)
      await cargarReglas()
    } catch (error) {
      console.error('Error inesperado:', error)
      setError('Error inesperado al guardar la regla')
    }
  }

  // Eliminar regla
  const eliminarRegla = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta regla?')) return

    try {
      const { error: supabaseError } = await supabase
        .from('reglas_contable_interno')
        .delete()
        .eq('id', id)

      if (supabaseError) {
        console.error('Error al eliminar regla:', supabaseError)
        setError(`Error al eliminar regla: ${supabaseError.message}`)
        return
      }

      await cargarReglas()
    } catch (error) {
      console.error('Error inesperado:', error)
      setError('Error inesperado al eliminar la regla')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando reglas contable/interno...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">Reglas Contable e Interno</h3>
          <p className="text-gray-600">Automatización de campos contable e interno según proveedor y contexto</p>
        </div>
        <Button onClick={abrirModalNueva} className="bg-green-600 hover:bg-green-700">
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
            <div className="text-2xl font-bold text-blue-600">{reglas.filter(r => r.tipo_regla === 'contable').length}</div>
            <p className="text-xs text-gray-600">Contable</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{reglas.filter(r => r.tipo_regla === 'interno').length}</div>
            <p className="text-xs text-gray-600">Interno</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{reglas.filter(r => r.activo).length}</div>
            <p className="text-xs text-gray-600">Activas</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Reglas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Reglas Contable e Interno ({reglas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {reglas.map((regla) => (
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
                  <Badge className={regla.tipo_regla === 'contable' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}>
                    {regla.tipo_regla.toUpperCase()}
                  </Badge>

                  {/* Contexto */}
                  <div className="flex gap-2">
                    <Badge variant="outline">{regla.banco_origen}</Badge>
                    <Badge variant="outline">{regla.tipo_gasto}</Badge>
                  </div>

                  {/* Criterio */}
                  <div className="flex-1">
                    <div className="font-medium">{regla.proveedor_pattern}</div>
                    <div className="text-sm text-gray-500">
                      Proveedor Pattern
                    </div>
                  </div>

                  {/* Resultado */}
                  <div className="text-right">
                    <div className="font-medium text-green-600">{regla.valor_asignar}</div>
                    <div className="text-sm text-gray-500">Valor a asignar</div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2">
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
              {reglaEditando ? 'Editar Regla' : 'Nueva Regla'} Contable/Interno
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
              <Label htmlFor="tipo_regla">Tipo de Campo</Label>
              <Select value={formulario.tipo_regla} onValueChange={(value) => setFormulario(prev => ({ ...prev, tipo_regla: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contable">Contable</SelectItem>
                  <SelectItem value="interno">Interno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="banco_origen">Banco que Paga</Label>
              <Select value={formulario.banco_origen} onValueChange={(value) => setFormulario(prev => ({ ...prev, banco_origen: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona banco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MSA">MSA (30617786016)</SelectItem>
                  <SelectItem value="PAM">PAM (20044390222)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tipo_gasto">Tipo de Gasto</Label>
              <Select value={formulario.tipo_gasto} onValueChange={(value) => setFormulario(prev => ({ ...prev, tipo_gasto: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Origen del gasto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">Template (tiene responsable)</SelectItem>
                  <SelectItem value="factura">Factura ARCA (MSA/PAM por CUIT)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="proveedor_pattern">Patrón Proveedor</Label>
              <Input
                id="proveedor_pattern"
                value={formulario.proveedor_pattern}
                onChange={(e) => setFormulario(prev => ({ ...prev, proveedor_pattern: e.target.value }))}
                placeholder="Ej: TELECOM, YPF, Jose Perez (responsable template)"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="valor_asignar">Valor a Asignar</Label>
              <Input
                id="valor_asignar"
                value={formulario.valor_asignar}
                onChange={(e) => setFormulario(prev => ({ ...prev, valor_asignar: e.target.value }))}
                placeholder="Ej: TEL001, SUM-YPF, REF-JP"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarRegla} className="bg-green-600 hover:bg-green-700">
              {reglaEditando ? 'Actualizar' : 'Crear'} Regla
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}