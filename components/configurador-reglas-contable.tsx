"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Plus, ChevronDown, ChevronRight, Building, Users } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface TemplateContable {
  id: string
  nombre_referencia: string
  responsable: string | null
  categ: string | null
  codigo_contable: string | null
  codigo_interno: string | null
  activo: boolean
  seccion_regla: number | null
  grupo_impuesto_id: string | null
}

// Una fila en la tabla puede representar un grupo o un template individual
interface FilaTabla {
  key: string                   // grupo_impuesto_id o id
  nombre: string                // label a mostrar
  ids: string[]                 // IDs de todos los miembros (para update masivo)
  responsable: string | null
  codigo_contable: string | null
  codigo_interno: string | null
  seccion_regla: number | null
  tieneActivo: boolean
  esGrupo: boolean              // true si agrupa más de un template
}

// Valor "real" = no nulo, no vacío, no "No Lleva"
const esValorReal = (v: string | null | undefined): boolean => {
  if (!v || v.trim() === '') return false
  return !v.toLowerCase().replace(/\s+/g, '').includes('nolleva')
}

const tieneCodigoReal = (t: { codigo_contable: string | null; codigo_interno: string | null }): boolean =>
  esValorReal(t.codigo_contable) || esValorReal(t.codigo_interno)

export function ConfiguradorReglasContable() {
  const [templates, setTemplates] = useState<TemplateContable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)

  // Filtros globales
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [mostrarSinRegla, setMostrarSinRegla] = useState(false)

  // Modal agregar
  const [modalAgregar, setModalAgregar] = useState<{ seccion: 1 | 2 } | null>(null)
  const [templateSeleccionado, setTemplateSeleccionado] = useState('')
  const [nuevoContable, setNuevoContable] = useState('')
  const [nuevoInterno, setNuevoInterno] = useState('')
  const [guardandoModal, setGuardandoModal] = useState(false)

  const cargarTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('egresos_sin_factura')
        .select('id, nombre_referencia, responsable, categ, codigo_contable, codigo_interno, activo, seccion_regla, grupo_impuesto_id')
        .order('nombre_referencia', { ascending: true })
      if (e) throw e
      setTemplates(data || [])
    } catch (err: any) {
      setError(err.message || 'Error cargando templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarTemplates() }, [])

  // Agrupa templates en FilaTabla
  const agrupar = (lista: TemplateContable[]): FilaTabla[] => {
    const grupos = new Map<string, TemplateContable[]>()
    const individuales: TemplateContable[] = []

    lista.forEach(t => {
      if (t.grupo_impuesto_id) {
        const g = grupos.get(t.grupo_impuesto_id) || []
        g.push(t)
        grupos.set(t.grupo_impuesto_id, g)
      } else {
        individuales.push(t)
      }
    })

    const filas: FilaTabla[] = []

    grupos.forEach((miembros, grupoId) => {
      const rep = miembros[0]
      filas.push({
        key: grupoId,
        nombre: grupoId,
        ids: miembros.map(m => m.id),
        responsable: rep.responsable,
        codigo_contable: rep.codigo_contable,
        codigo_interno: rep.codigo_interno,
        seccion_regla: rep.seccion_regla,
        tieneActivo: miembros.some(m => m.activo),
        esGrupo: miembros.length > 1
      })
    })

    individuales.forEach(t => {
      filas.push({
        key: t.id,
        nombre: t.nombre_referencia,
        ids: [t.id],
        responsable: t.responsable,
        codigo_contable: t.codigo_contable,
        codigo_interno: t.codigo_interno,
        seccion_regla: t.seccion_regla,
        tieneActivo: t.activo,
        esGrupo: false
      })
    })

    return filas.sort((a, b) => a.nombre.localeCompare(b.nombre))
  }

  // Filtrar por activo
  const filtrarActivos = (filas: FilaTabla[]) =>
    mostrarInactivos ? filas : filas.filter(f => f.tieneActivo)

  // Secciones derivadas
  const { filasSec1, filasSec2, filasSinRegla, idsEnSecciones } = useMemo(() => {
    const todas = agrupar(templates)
    const s1 = filtrarActivos(todas.filter(f => f.seccion_regla === 1 && tieneCodigoReal(f)))
    const s2 = filtrarActivos(todas.filter(f => f.seccion_regla === 2 && tieneCodigoReal(f)))
    const idsS1S2 = new Set([...s1, ...s2].flatMap(f => f.ids))
    const sinR = filtrarActivos(todas.filter(f => f.seccion_regla !== 1 && f.seccion_regla !== 2))
    return { filasSec1: s1, filasSec2: s2, filasSinRegla: sinR, idsEnSecciones: idsS1S2 }
  }, [templates, mostrarInactivos])

  // Templates disponibles para agregar (no están en la sección destino)
  const templatesParaAgregar = useMemo(() => {
    if (!modalAgregar) return []
    return templates.filter(t => {
      if (!mostrarInactivos && !t.activo) return false
      if (modalAgregar.seccion === 1) return t.seccion_regla !== 1
      if (modalAgregar.seccion === 2) return t.seccion_regla !== 2
      return true
    })
  }, [templates, modalAgregar, mostrarInactivos])

  // Guardar campo en todos los IDs del grupo
  const guardarCampo = async (
    ids: string[],
    campo: 'codigo_contable' | 'codigo_interno' | 'responsable',
    valor: string,
    seccionNueva?: number
  ) => {
    const key = ids[0] + campo
    setGuardando(key)
    try {
      const update: any = { [campo]: valor.trim() || null }
      if (seccionNueva !== undefined) update.seccion_regla = seccionNueva
      for (const id of ids) {
        const { error } = await supabase.from('egresos_sin_factura').update(update).eq('id', id)
        if (error) throw error
      }
      await cargarTemplates()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(null)
    }
  }

  // Guardar desde modal
  const guardarDesdeModal = async () => {
    if (!modalAgregar || !templateSeleccionado) return
    if (!nuevoContable.trim() && !nuevoInterno.trim()) return
    setGuardandoModal(true)

    // Obtener todos los IDs del mismo grupo
    const tmpl = templates.find(t => t.id === templateSeleccionado)
    if (!tmpl) return

    const idsGrupo = tmpl.grupo_impuesto_id
      ? templates.filter(t => t.grupo_impuesto_id === tmpl.grupo_impuesto_id).map(t => t.id)
      : [tmpl.id]

    try {
      const update: any = { seccion_regla: modalAgregar.seccion }
      if (nuevoContable.trim()) update.codigo_contable = nuevoContable.trim()
      if (nuevoInterno.trim()) update.codigo_interno = nuevoInterno.trim()

      for (const id of idsGrupo) {
        const { error } = await supabase.from('egresos_sin_factura').update(update).eq('id', id)
        if (error) throw error
      }
      setModalAgregar(null)
      setTemplateSeleccionado('')
      setNuevoContable('')
      setNuevoInterno('')
      await cargarTemplates()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardandoModal(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin" />
      <span className="ml-2">Cargando...</span>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Filtro global */}
      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mostrarInactivos}
            onChange={e => setMostrarInactivos(e.target.checked)}
            className="rounded"
          />
          Mostrar templates inactivos
        </label>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── SECCIÓN 1 ─────────────────────────────────────── */}
      <SeccionTabla
        titulo="Sección 1 — Reglas fijas"
        descripcion="Se aplican siempre al conciliar, sin importar quién paga."
        badge={filasSec1.length}
        color="blue"
        filas={filasSec1}
        guardando={guardando}
        onGuardar={(ids, campo, valor) => guardarCampo(ids, campo, valor)}
        botonAgregar={
          <Button size="sm" variant="outline" onClick={() => { setTemplateSeleccionado(''); setNuevoContable(''); setNuevoInterno(''); setModalAgregar({ seccion: 1 }) }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
          </Button>
        }
      />

      {/* ── SECCIÓN 2 ─────────────────────────────────────── */}
      <SeccionTabla
        titulo="Sección 2 — Reglas por responsable"
        descripcion="Se aplican solo cuando la empresa que paga ≠ responsable del template."
        badge={filasSec2.length}
        color="amber"
        filas={filasSec2}
        guardando={guardando}
        onGuardar={(ids, campo, valor) => guardarCampo(ids, campo, valor)}
        botonAgregar={
          <Button size="sm" variant="outline" onClick={() => { setTemplateSeleccionado(''); setNuevoContable(''); setNuevoInterno(''); setModalAgregar({ seccion: 2 }) }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
          </Button>
        }
      />

      {/* ── SIN REGLA (colapsable) ────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <button
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              onClick={() => setMostrarSinRegla(v => !v)}
            >
              {mostrarSinRegla ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Users className="h-4 w-4" />
              Templates sin regla asignada ({filasSinRegla.length})
            </button>
            <span className="text-xs text-gray-400">Editá contable/interno → se asigna automáticamente a Sección 2</span>
          </div>
        </CardHeader>
        {mostrarSinRegla && (
          <CardContent className="p-0">
            <TablaTemplates
              filas={filasSinRegla}
              guardando={guardando}
              onGuardar={(ids, campo, valor) => guardarCampo(ids, campo, valor, campo !== 'responsable' ? 2 : undefined)}
            />
          </CardContent>
        )}
      </Card>

      {/* Modal Agregar */}
      <Dialog open={!!modalAgregar} onOpenChange={() => setModalAgregar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Agregar a Sección {modalAgregar?.seccion} —{' '}
              {modalAgregar?.seccion === 1 ? 'Regla fija' : 'Regla por responsable'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label className="text-sm">Template</Label>
              <select
                className="w-full border rounded px-3 py-2 text-sm mt-1 bg-white"
                value={templateSeleccionado}
                onChange={e => setTemplateSeleccionado(e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {templatesParaAgregar.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nombre_referencia}{t.responsable ? ` (${t.responsable})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Contable</Label>
                <Input className="mt-1" value={nuevoContable} onChange={e => setNuevoContable(e.target.value)} placeholder="Ej: RET 3 PAM" />
              </div>
              <div>
                <Label className="text-sm">Interno</Label>
                <Input className="mt-1" value={nuevoInterno} onChange={e => setNuevoInterno(e.target.value)} placeholder="Ej: DIST PAM" />
              </div>
            </div>
            <p className="text-xs text-gray-400">Si el template pertenece a un grupo, el cambio aplica a todos los del grupo.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalAgregar(null)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={guardarDesdeModal}
              disabled={!templateSeleccionado || (!nuevoContable.trim() && !nuevoInterno.trim()) || guardandoModal}
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

// ── Sección con título y tabla ──────────────────────────────────────
function SeccionTabla({
  titulo, descripcion, badge, color, filas, guardando, onGuardar, botonAgregar
}: {
  titulo: string
  descripcion: string
  badge: number
  color: 'blue' | 'amber'
  filas: FilaTabla[]
  guardando: string | null
  onGuardar: (ids: string[], campo: 'codigo_contable' | 'codigo_interno' | 'responsable', valor: string) => void
  botonAgregar: React.ReactNode
}) {
  const borderColor = color === 'blue' ? 'border-blue-200' : 'border-amber-200'
  const headerBg = color === 'blue' ? 'bg-blue-50' : 'bg-amber-50'
  const badgeClass = color === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'

  return (
    <Card className={`border ${borderColor}`}>
      <CardHeader className={`${headerBg} rounded-t-lg pb-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold">{titulo}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>{badge}</span>
          </div>
          {botonAgregar}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{descripcion}</p>
      </CardHeader>
      <CardContent className="p-0">
        <TablaTemplates filas={filas} guardando={guardando} onGuardar={onGuardar} />
      </CardContent>
    </Card>
  )
}

// ── Tabla reutilizable ─────────────────────────────────────────────
function TablaTemplates({
  filas, guardando, onGuardar
}: {
  filas: FilaTabla[]
  guardando: string | null
  onGuardar: (ids: string[], campo: 'codigo_contable' | 'codigo_interno' | 'responsable', valor: string) => void
}) {
  if (filas.length === 0) return (
    <div className="p-6 text-center text-sm text-gray-400">Sin templates en esta sección.</div>
  )

  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b">
        <tr>
          <th className="text-left p-3 font-medium text-xs text-gray-500">Template / Grupo</th>
          <th className="text-left p-3 font-medium text-xs text-gray-500 w-28">Responsable</th>
          <th className="text-left p-3 font-medium text-xs text-gray-500 w-40">Contable</th>
          <th className="text-left p-3 font-medium text-xs text-gray-500 w-40">Interno</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, i) => (
          <tr key={fila.key} className={`border-b last:border-0 ${!fila.tieneActivo ? 'opacity-40' : ''} ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
            <td className="p-3">
              <div className="flex items-center gap-1.5">
                {fila.esGrupo && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">grupo</span>
                )}
                <span className="font-medium">{fila.nombre}</span>
              </div>
            </td>
            <td className="p-3">
              <CeldaEditable
                valor={fila.responsable}
                guardando={guardando === fila.ids[0] + 'responsable'}
                placeholder="—"
                onGuardar={v => onGuardar(fila.ids, 'responsable', v)}
              />
            </td>
            <td className="p-3">
              <CeldaEditable
                valor={fila.codigo_contable}
                guardando={guardando === fila.ids[0] + 'codigo_contable'}
                onGuardar={v => onGuardar(fila.ids, 'codigo_contable', v)}
              />
            </td>
            <td className="p-3">
              <CeldaEditable
                valor={fila.codigo_interno}
                guardando={guardando === fila.ids[0] + 'codigo_interno'}
                onGuardar={v => onGuardar(fila.ids, 'codigo_interno', v)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
      className="border rounded px-2 py-0.5 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-blue-400"
      value={valorLocal}
      onChange={e => setValorLocal(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { onGuardar(valorLocal); setEditando(false) }
        if (e.key === 'Escape') { setValorLocal(valor || ''); setEditando(false) }
      }}
      onBlur={() => { onGuardar(valorLocal); setEditando(false) }}
    />
  )

  const esNoLleva = valor && valor.toLowerCase().replace(/\s+/g, '').includes('nolleva')

  return (
    <span
      onClick={() => { setValorLocal(valor || ''); setEditando(true) }}
      className={`cursor-pointer inline-block px-1.5 py-0.5 rounded transition-colors hover:bg-blue-50 hover:text-blue-700 ${
        esNoLleva ? 'text-gray-300 italic text-xs' :
        valor ? 'font-medium text-gray-800' :
        'text-gray-300 italic text-xs'
      }`}
      title="Click para editar"
    >
      {esNoLleva ? 'No Lleva' : valor || placeholder}
    </span>
  )
}
