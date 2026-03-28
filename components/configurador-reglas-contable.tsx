"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Plus, Check, X, Building } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface TemplateContable {
  id: string
  nombre_referencia: string
  responsable: string | null
  categ: string | null
  codigo_contable: string | null
  codigo_interno: string | null
  activo: boolean
}

export function ConfiguradorReglasContable() {
  const [templates, setTemplates] = useState<TemplateContable[]>([])
  const [todosTemplates, setTodosTemplates] = useState<TemplateContable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)

  // Modal agregar
  const [modalAgregar, setModalAgregar] = useState(false)
  const [templateSeleccionado, setTemplateSeleccionado] = useState('')
  const [nuevoContable, setNuevoContable] = useState('')
  const [nuevoInterno, setNuevoInterno] = useState('')
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)

  const cargarTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: todos, error: e } = await supabase
        .from('egresos_sin_factura')
        .select('id, nombre_referencia, responsable, categ, codigo_contable, codigo_interno, activo')
        .order('nombre_referencia', { ascending: true })

      if (e) throw e

      const all = todos || []
      setTodosTemplates(all)
      // Sección estándar: solo los que tienen al menos uno de los dos campos
      setTemplates(all.filter(t =>
        (t.codigo_contable && t.codigo_contable.trim() !== '') ||
        (t.codigo_interno && t.codigo_interno.trim() !== '')
      ))
    } catch (err: any) {
      setError(err.message || 'Error cargando templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarTemplates() }, [])

  const guardarCampo = async (id: string, campo: 'codigo_contable' | 'codigo_interno', valor: string) => {
    const key = id + campo
    setGuardando(key)
    try {
      const { error } = await supabase
        .from('egresos_sin_factura')
        .update({ [campo]: valor.trim() || null })
        .eq('id', id)
      if (error) throw error
      await cargarTemplates()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(null)
    }
  }

  const agregarNueva = async () => {
    if (!templateSeleccionado) return
    if (!nuevoContable.trim() && !nuevoInterno.trim()) return
    setGuardandoNuevo(true)
    const updates: any = {}
    if (nuevoContable.trim()) updates.codigo_contable = nuevoContable.trim()
    if (nuevoInterno.trim()) updates.codigo_interno = nuevoInterno.trim()
    try {
      const { error } = await supabase
        .from('egresos_sin_factura')
        .update(updates)
        .eq('id', templateSeleccionado)
      if (error) throw error
      setModalAgregar(false)
      setTemplateSeleccionado('')
      setNuevoContable('')
      setNuevoInterno('')
      await cargarTemplates()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardandoNuevo(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="ml-2">Cargando...</span>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold">Reglas Estándar — Contable e Interno</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Valores guardados en cada template. El motor los aplica automáticamente al conciliar.
          </p>
        </div>
        <Button onClick={() => { setTemplateSeleccionado(''); setNuevoContable(''); setNuevoInterno(''); setModalAgregar(true) }}
          className="bg-green-600 hover:bg-green-700" size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Agregar a template
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabla estándar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building className="h-4 w-4" />
            Templates con reglas configuradas ({templates.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">Template</th>
                <th className="text-left p-3 font-medium text-xs text-gray-500 w-24">Responsable</th>
                <th className="text-left p-3 font-medium w-44">Contable</th>
                <th className="text-left p-3 font-medium w-44">Interno</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t, i) => (
                <tr key={t.id} className={`border-b last:border-0 ${!t.activo ? 'opacity-50' : ''} ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="p-3">
                    <div className="font-medium">{t.nombre_referencia}</div>
                    {t.categ && <div className="text-xs text-gray-400">{t.categ}</div>}
                  </td>
                  <td className="p-3 text-xs text-gray-400">{t.responsable || '—'}</td>
                  <td className="p-3">
                    <CeldaEditable
                      valor={t.codigo_contable}
                      guardando={guardando === t.id + 'codigo_contable'}
                      onGuardar={(v) => guardarCampo(t.id, 'codigo_contable', v)}
                    />
                  </td>
                  <td className="p-3">
                    <CeldaEditable
                      valor={t.codigo_interno}
                      guardando={guardando === t.id + 'codigo_interno'}
                      onGuardar={(v) => guardarCampo(t.id, 'codigo_interno', v)}
                    />
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400 text-sm">
                    No hay templates con reglas configuradas. Usá "Agregar a template" para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modal Agregar */}
      <Dialog open={modalAgregar} onOpenChange={setModalAgregar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar regla a template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label className="text-sm">Template</Label>
              <select
                className="w-full border rounded px-3 py-2 text-sm mt-1 bg-white"
                value={templateSeleccionado}
                onChange={(e) => setTemplateSeleccionado(e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {todosTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nombre_referencia}{t.responsable ? ` (${t.responsable})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Contable</Label>
                <Input
                  className="mt-1"
                  value={nuevoContable}
                  onChange={(e) => setNuevoContable(e.target.value)}
                  placeholder="Ej: CTA MA, Desglosar"
                />
              </div>
              <div>
                <Label className="text-sm">Interno</Label>
                <Input
                  className="mt-1"
                  value={nuevoInterno}
                  onChange={(e) => setNuevoInterno(e.target.value)}
                  placeholder="Ej: DIST MA"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">Podés completar solo uno de los dos campos.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalAgregar(false)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={agregarNueva}
              disabled={!templateSeleccionado || (!nuevoContable.trim() && !nuevoInterno.trim()) || guardandoNuevo}
              className="bg-green-600 hover:bg-green-700"
            >
              {guardandoNuevo && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

// Celda con edición inline: click para editar, Enter/blur para guardar, Escape para cancelar
function CeldaEditable({
  valor,
  guardando,
  onGuardar
}: {
  valor: string | null
  guardando: boolean
  onGuardar: (v: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [valorLocal, setValorLocal] = useState(valor || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValorLocal(valor || '')
  }, [valor])

  useEffect(() => {
    if (editando && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editando])

  const confirmar = () => {
    onGuardar(valorLocal)
    setEditando(false)
  }

  const cancelar = () => {
    setValorLocal(valor || '')
    setEditando(false)
  }

  if (guardando) return (
    <div className="flex items-center gap-1 text-gray-400 text-xs">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>guardando...</span>
    </div>
  )

  if (editando) return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        className="border rounded px-2 py-0.5 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-400"
        value={valorLocal}
        onChange={(e) => setValorLocal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') confirmar()
          if (e.key === 'Escape') cancelar()
        }}
        onBlur={confirmar}
      />
      <button onMouseDown={(e) => { e.preventDefault(); confirmar() }} className="text-green-600 hover:text-green-700">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onMouseDown={(e) => { e.preventDefault(); cancelar() }} className="text-red-400 hover:text-red-600">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  return (
    <span
      onClick={() => { setValorLocal(valor || ''); setEditando(true) }}
      className={`cursor-pointer inline-block px-1.5 py-0.5 rounded transition-colors hover:bg-blue-50 hover:text-blue-700 ${
        valor ? 'font-medium text-gray-800' : 'text-gray-300 italic text-xs'
      }`}
      title="Click para editar"
    >
      {valor || 'click para editar'}
    </span>
  )
}
