"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Trash2, Building2, Users, UserCheck } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"

// ── Tipos ──────────────────────────────────────────────────────────

interface ReglaContableInterno {
  id: string
  cuenta_bancaria_id: string
  tipo_regla: 'especifica' | 'responsable' | 'empleado'
  template_id: string | null
  responsable: string | null
  empleado_id: string | null
  codigo_contable: string | null
  codigo_interno: string | null
  descripcion: string | null
  activo: boolean
  orden: number
}

interface TemplateOpcion {
  id: string
  nombre_referencia: string
  responsable: string | null
}

interface EmpleadoOpcion {
  id: string
  nombre: string
  empresa: string | null
}

// Modal state
interface ModalState {
  tipo: 'especifica' | 'responsable' | 'empleado'
  editando: ReglaContableInterno | null
}

// ── Componente principal ───────────────────────────────────────────

export function ConfiguradorReglasContable({ cuentaBancariaId }: { cuentaBancariaId?: string }) {
  const [cuentaId, setCuentaId] = useState(cuentaBancariaId || 'msa_galicia')
  const [reglas, setReglas] = useState<ReglaContableInterno[]>([])
  const [templates, setTemplates] = useState<TemplateOpcion[]>([])
  const [empleados, setEmpleados] = useState<EmpleadoOpcion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)

  // Formulario modal
  const [formTemplateId, setFormTemplateId] = useState('')
  const [formResponsable, setFormResponsable] = useState('')
  const [formEmpleadoId, setFormEmpleadoId] = useState('')
  const [formContable, setFormContable] = useState('')
  const [formInterno, setFormInterno] = useState('')
  const [formDescripcion, setFormDescripcion] = useState('')
  const [guardandoModal, setGuardandoModal] = useState(false)

  // Sync si el padre cambia la cuenta
  useEffect(() => { if (cuentaBancariaId) setCuentaId(cuentaBancariaId) }, [cuentaBancariaId])

  const cargarDatos = async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ data: reglasData, error: e1 }, { data: tmplData, error: e2 }, { data: empData, error: e3 }] = await Promise.all([
        supabase
          .from('reglas_contable_interno')
          .select('*')
          .eq('cuenta_bancaria_id', cuentaId)
          .order('tipo_regla')
          .order('orden'),
        supabase
          .from('egresos_sin_factura')
          .select('id, nombre_referencia, responsable')
          .eq('activo', true)
          .order('nombre_referencia'),
        supabase
          .from('sueldos_empleados')
          .select('id, nombre, empresa')
          .eq('activo', true)
          .order('nombre')
      ])
      if (e1) throw e1
      if (e2) throw e2
      if (e3) throw e3
      setReglas(reglasData || [])
      setTemplates(tmplData || [])
      setEmpleados(empData || [])
    } catch (err: any) {
      setError(err.message || 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarDatos() }, [cuentaId])

  const tipoA = reglas.filter(r => r.tipo_regla === 'especifica' && r.activo)
  const tipoB = reglas.filter(r => r.tipo_regla === 'responsable' && r.activo)
  const tipoC = reglas.filter(r => r.tipo_regla === 'empleado' && r.activo)

  // Nombre template para mostrar en Tipo A
  const nombreTemplate = (id: string | null) => {
    if (!id) return '—'
    const t = templates.find(t => t.id === id)
    return t ? `${t.nombre_referencia}${t.responsable ? ` (${t.responsable})` : ''}` : id
  }

  // Nombre empleado para mostrar en Tipo C
  const nombreEmpleado = (id: string | null) => {
    if (!id) return '—'
    const e = empleados.find(e => e.id === id)
    return e ? `${e.nombre}${e.empresa ? ` (${e.empresa})` : ''}` : id
  }

  // Abrir modal para crear
  const abrirCrear = (tipo: 'especifica' | 'responsable' | 'empleado') => {
    setFormTemplateId('')
    setFormResponsable('')
    setFormEmpleadoId('')
    setFormContable('')
    setFormInterno('')
    setFormDescripcion('')
    setModal({ tipo, editando: null })
  }

  // Abrir modal para editar
  const abrirEditar = (regla: ReglaContableInterno) => {
    setFormTemplateId(regla.template_id || '')
    setFormResponsable(regla.responsable || '')
    setFormEmpleadoId(regla.empleado_id || '')
    setFormContable(regla.codigo_contable || '')
    setFormInterno(regla.codigo_interno || '')
    setFormDescripcion(regla.descripcion || '')
    setModal({ tipo: regla.tipo_regla, editando: regla })
  }

  // Guardar desde modal
  const guardarModal = async () => {
    if (!modal) return
    setGuardandoModal(true)
    try {
      const update: any = {
        cuenta_bancaria_id: cuentaId,
        tipo_regla: modal.tipo,
        codigo_contable: formContable.trim() || null,
        codigo_interno: formInterno.trim() || null,
        descripcion: formDescripcion.trim() || null,
        activo: true
      }
      if (modal.tipo === 'especifica') {
        update.template_id = formTemplateId || null
        update.responsable = null
        update.empleado_id = null
        if (!update.descripcion && formTemplateId) update.descripcion = nombreTemplate(formTemplateId)
      } else if (modal.tipo === 'responsable') {
        update.responsable = formResponsable.trim() || null
        update.template_id = null
        update.empleado_id = null
        if (!update.descripcion && formResponsable.trim()) update.descripcion = formResponsable.trim()
      } else if (modal.tipo === 'empleado') {
        update.empleado_id = formEmpleadoId || null
        update.template_id = null
        update.responsable = null
        if (!update.descripcion && formEmpleadoId) update.descripcion = nombreEmpleado(formEmpleadoId)
      }

      if (modal.editando) {
        const { error } = await supabase.from('reglas_contable_interno').update(update).eq('id', modal.editando.id)
        if (error) throw error
      } else {
        update.orden = reglas.length + 1
        const { error } = await supabase.from('reglas_contable_interno').insert(update)
        if (error) throw error
      }

      setModal(null)
      await cargarDatos()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardandoModal(false)
    }
  }

  // Eliminar regla
  const eliminarRegla = async (id: string) => {
    if (!confirm('¿Eliminar esta regla?')) return
    setGuardando(id)
    try {
      const { error } = await supabase.from('reglas_contable_interno').delete().eq('id', id)
      if (error) throw error
      await cargarDatos()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(null)
    }
  }

  // Guardar campo inline (código)
  const guardarCampoInline = async (id: string, campo: 'codigo_contable' | 'codigo_interno', valor: string) => {
    setGuardando(id + campo)
    try {
      const { error } = await supabase
        .from('reglas_contable_interno')
        .update({ [campo]: valor.trim() || null })
        .eq('id', id)
      if (error) throw error
      setReglas(prev => prev.map(r => r.id === id ? { ...r, [campo]: valor.trim() || null } : r))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(null)
    }
  }

  const cuentas = CUENTAS_BANCARIAS.filter(c => c.activa)
  const cuentaActual = cuentas.find(c => c.id === cuentaId)

  const formEsValido = modal?.tipo === 'especifica'
    ? !!formTemplateId && (!!formContable.trim() || !!formInterno.trim())
    : modal?.tipo === 'responsable'
    ? !!formResponsable.trim() && (!!formContable.trim() || !!formInterno.trim())
    : modal?.tipo === 'empleado'
    ? !!formEmpleadoId && (!!formContable.trim() || !!formInterno.trim())
    : false

  if (loading) return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="ml-2">Cargando...</span>
    </div>
  )

  // Render tabla genérica para los 3 tipos
  const renderTabla = (lista: ReglaContableInterno[], columnaLabel: string, renderNombre: (r: ReglaContableInterno) => string) => (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b">
        <tr>
          <th className="text-left p-3 font-medium text-xs text-gray-500">{columnaLabel}</th>
          <th className="text-left p-3 font-medium text-xs text-gray-500 w-36">Contable</th>
          <th className="text-left p-3 font-medium text-xs text-gray-500 w-36">Interno</th>
          <th className="p-3 w-16"></th>
        </tr>
      </thead>
      <tbody>
        {lista.map((regla, i) => (
          <tr key={regla.id} className={`border-b last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
            <td className="p-3">
              <button className="text-left hover:text-blue-700 transition-colors" onClick={() => abrirEditar(regla)}>
                <span className="font-medium text-gray-800">{renderNombre(regla)}</span>
                {regla.descripcion && regla.descripcion !== renderNombre(regla) && (
                  <span className="text-xs text-gray-400 ml-2">{regla.descripcion}</span>
                )}
              </button>
            </td>
            <td className="p-3">
              <CeldaEditable
                valor={regla.codigo_contable}
                guardando={guardando === regla.id + 'codigo_contable'}
                onGuardar={v => guardarCampoInline(regla.id, 'codigo_contable', v)}
              />
            </td>
            <td className="p-3">
              <CeldaEditable
                valor={regla.codigo_interno}
                guardando={guardando === regla.id + 'codigo_interno'}
                onGuardar={v => guardarCampoInline(regla.id, 'codigo_interno', v)}
              />
            </td>
            <td className="p-3 text-center">
              <button
                onClick={() => eliminarRegla(regla.id)}
                disabled={guardando === regla.id}
                className="text-gray-300 hover:text-red-500 transition-colors"
                title="Eliminar regla"
              >
                {guardando === regla.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div className="space-y-5">

      {/* Selector cuenta (visible solo si no hay prop externo) */}
      {!cuentaBancariaId && (
        <div className="flex items-center gap-3">
          <Label className="text-sm whitespace-nowrap">Cuenta bancaria:</Label>
          <Select value={cuentaId} onValueChange={setCuentaId}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cuentas.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-gray-400">Empresa: {cuentaActual?.empresa}</span>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── TIPO A — Reglas Específicas ─────────────────────── */}
      <Card className="border-blue-200">
        <CardHeader className="bg-blue-50 rounded-t-lg pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">Tipo A — Reglas Específicas</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{tipoA.length}</span>
            </div>
            <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100"
              onClick={() => abrirCrear('especifica')}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
            </Button>
          </div>
          <p className="text-xs text-blue-600 mt-0.5">
            Esta cuenta + template específico → códigos. Mayor prioridad.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {tipoA.length === 0 ? (
            <p className="p-5 text-sm text-gray-400 text-center">Sin reglas específicas para esta cuenta.</p>
          ) : renderTabla(tipoA, 'Template', r => nombreTemplate(r.template_id))}
        </CardContent>
      </Card>

      {/* ── TIPO B — Reglas por Responsable ─────────────────── */}
      <Card className="border-amber-200">
        <CardHeader className="bg-amber-50 rounded-t-lg pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">Tipo B — Reglas por Responsable</span>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{tipoB.length}</span>
            </div>
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={() => abrirCrear('responsable')}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
            </Button>
          </div>
          <p className="text-xs text-amber-700 mt-0.5">
            Esta cuenta + responsable → códigos para todos sus templates. Aplica solo en caso cross-company.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {tipoB.length === 0 ? (
            <p className="p-5 text-sm text-gray-400 text-center">Sin reglas por responsable para esta cuenta.</p>
          ) : renderTabla(tipoB, 'Responsable', r => r.responsable || '—')}
        </CardContent>
      </Card>

      {/* ── TIPO C — Reglas por Empleado (Sueldos) ───────────── */}
      <Card className="border-green-200">
        <CardHeader className="bg-green-50 rounded-t-lg pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold text-green-800">Tipo C — Reglas por Empleado (Sueldos)</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{tipoC.length}</span>
            </div>
            <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-100"
              onClick={() => abrirCrear('empleado')}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
            </Button>
          </div>
          <p className="text-xs text-green-700 mt-0.5">
            Empleado específico → códigos contable/interno para pagos de sueldos y anticipos.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {tipoC.length === 0 ? (
            <p className="p-5 text-sm text-gray-400 text-center">Sin reglas por empleado para esta cuenta.</p>
          ) : renderTabla(tipoC, 'Empleado', r => nombreEmpleado(r.empleado_id))}
        </CardContent>
      </Card>

      {/* ── Leyenda prioridades ──────────────────────────────── */}
      <div className="text-xs text-gray-400 bg-gray-50 rounded p-3 space-y-0.5">
        <p><span className="font-medium text-gray-600">Prioridad de aplicación:</span> Tipo A (específica) &gt; Tipo B (responsable) &gt; Tipo C (empleado) &gt; Tab 1 regla con código</p>
        <p>Tipo B solo aplica cuando la empresa que paga ≠ responsable del template (casos cross-company).</p>
        <p>Tipo C aplica exclusivamente a pagos de sueldos asignados desde el extracto bancario.</p>
      </div>

      {/* ── Modal Crear / Editar ─────────────────────────────── */}
      <Dialog open={!!modal} onOpenChange={open => !open && setModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {modal?.editando ? 'Editar regla' : 'Nueva regla'} —{' '}
              {modal?.tipo === 'especifica' ? 'Tipo A (Específica)' : modal?.tipo === 'responsable' ? 'Tipo B (Responsable)' : 'Tipo C (Empleado)'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {modal?.tipo === 'especifica' ? (
              <div>
                <Label className="text-sm">Template *</Label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm mt-1 bg-white"
                  value={formTemplateId}
                  onChange={e => setFormTemplateId(e.target.value)}
                >
                  <option value="">— Seleccionar template —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nombre_referencia}{t.responsable ? ` (${t.responsable})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : modal?.tipo === 'responsable' ? (
              <div>
                <Label className="text-sm">Responsable *</Label>
                <Input
                  className="mt-1"
                  value={formResponsable}
                  onChange={e => setFormResponsable(e.target.value)}
                  placeholder="Ej: PAM, MA, JMS"
                />
                <p className="text-xs text-gray-400 mt-1">Se aplicará a todos los templates con ese responsable pagados por esta cuenta.</p>
              </div>
            ) : (
              <div>
                <Label className="text-sm">Empleado *</Label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm mt-1 bg-white"
                  value={formEmpleadoId}
                  onChange={e => setFormEmpleadoId(e.target.value)}
                >
                  <option value="">— Seleccionar empleado —</option>
                  {empleados.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}{e.empresa ? ` (${e.empresa})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Se aplicará a todos los pagos de sueldo y anticipos de este empleado.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Código Contable</Label>
                <Input className="mt-1" value={formContable} onChange={e => setFormContable(e.target.value)} placeholder="Ej: CTA JMS" />
              </div>
              <div>
                <Label className="text-sm">Código Interno</Label>
                <Input className="mt-1" value={formInterno} onChange={e => setFormInterno(e.target.value)} placeholder="Ej: DIST MA" />
              </div>
            </div>

            <div>
              <Label className="text-sm">Descripción <span className="text-gray-400">(opcional)</span></Label>
              <Input className="mt-1" value={formDescripcion} onChange={e => setFormDescripcion(e.target.value)} placeholder="Nota descriptiva" />
            </div>

            <p className="text-xs text-gray-400">Al menos un código (contable o interno) es requerido.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={guardarModal}
              disabled={!formEsValido || guardandoModal}
              className="bg-green-600 hover:bg-green-700"
            >
              {guardandoModal && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

// ── Celda editable inline ──────────────────────────────────────────
function CeldaEditable({
  valor, guardando, placeholder = 'click para editar', onGuardar
}: {
  valor: string | null
  guardando: boolean
  placeholder?: string
  onGuardar: (v: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [valorLocal, setValorLocal] = useState(valor || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setValorLocal(valor || '') }, [valor])
  useEffect(() => { if (editando) { inputRef.current?.focus(); inputRef.current?.select() } }, [editando])

  if (guardando) return <span className="text-xs text-gray-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />guardando...</span>

  if (editando) return (
    <input
      ref={inputRef}
      className="border rounded px-2 py-0.5 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-400"
      value={valorLocal}
      onChange={e => setValorLocal(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { onGuardar(valorLocal); setEditando(false) }
        if (e.key === 'Escape') { setValorLocal(valor || ''); setEditando(false) }
      }}
      onBlur={() => { onGuardar(valorLocal); setEditando(false) }}
    />
  )

  return (
    <span
      onClick={() => { setValorLocal(valor || ''); setEditando(true) }}
      className={`cursor-pointer inline-block px-1.5 py-0.5 rounded transition-colors hover:bg-blue-50 hover:text-blue-700 ${
        valor ? 'font-medium text-gray-800' : 'text-gray-300 italic text-xs'
      }`}
      title="Click para editar"
    >
      {valor || placeholder}
    </span>
  )
}
