"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SelectorCuentaContable } from "@/components/ui/selector-cuenta-contable"
import { ProveedorCombobox } from "@/components/ui/proveedor-combobox"
import { Loader2, Plus, Trash2, Save, X, Pencil } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { normalizarBusqueda } from "@/lib/normalizar-texto"
import { toast } from "sonner"

interface Regla {
  id: string
  cuit: string
  denominacion_emisor: string | null
  cuenta_contable: string
  estado: string
  fc: string | null
  activo: boolean
}

const FORM_VACIO = { cuit: '', denominacion_emisor: '', cuenta_contable: '', estado: 'pendiente', fc: 'Buscar', activo: true }

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-700',
  debito: 'bg-violet-100 text-violet-800',
  credito: 'bg-blue-100 text-blue-800',
}

export function ModalReglasImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [reglas, setReglas] = useState<Regla[]>([])
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [editId, setEditId] = useState<string | null>(null) // id en edición o 'nuevo'
  const [form, setForm] = useState({ ...FORM_VACIO })
  const [guardando, setGuardando] = useState(false)

  const cargar = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('reglas_ctas_import_arca')
      .select('*')
      .order('estado', { ascending: true })
      .order('denominacion_emisor', { ascending: true, nullsFirst: false })
    if (error) toast.error('Error al cargar reglas: ' + error.message)
    setReglas((data as Regla[]) || [])
    setCargando(false)
  }

  useEffect(() => {
    if (open) { cargar(); setEditId(null); setBusqueda('') }
  }, [open])

  const abrirNueva = () => { setForm({ ...FORM_VACIO }); setEditId('nuevo') }
  const abrirEdicion = (r: Regla) => {
    setForm({
      cuit: r.cuit,
      denominacion_emisor: r.denominacion_emisor || '',
      cuenta_contable: r.cuenta_contable,
      estado: r.estado || 'pendiente',
      fc: r.fc || 'Buscar',
      activo: r.activo !== false,
    })
    setEditId(r.id)
  }

  const guardar = async () => {
    const cuitLimpio = form.cuit.replace(/\D/g, '')
    if (!cuitLimpio) { toast.error('El CUIT es obligatorio (solo números)'); return }
    if (!form.cuenta_contable.trim()) { toast.error('La cuenta contable es obligatoria'); return }
    setGuardando(true)
    const payload = {
      cuit: cuitLimpio,
      denominacion_emisor: form.denominacion_emisor.trim() || null,
      cuenta_contable: form.cuenta_contable,
      estado: form.estado,
      fc: form.fc,
      activo: form.activo,
      updated_at: new Date().toISOString(),
    }
    const res = editId === 'nuevo'
      ? await supabase.from('reglas_ctas_import_arca').insert(payload)
      : await supabase.from('reglas_ctas_import_arca').update(payload).eq('id', editId)
    setGuardando(false)
    if (res.error) { toast.error('Error al guardar: ' + res.error.message); return }
    toast.success(editId === 'nuevo' ? 'Regla creada' : 'Regla actualizada')
    setEditId(null)
    cargar()
  }

  const borrar = async (r: Regla) => {
    if (!window.confirm(`¿Borrar la regla de ${r.denominacion_emisor || r.cuit}?`)) return
    const { error } = await supabase.from('reglas_ctas_import_arca').delete().eq('id', r.id)
    if (error) { toast.error('Error al borrar: ' + error.message); return }
    toast.success('Regla borrada')
    cargar()
  }

  const filtradas = reglas.filter(r => {
    const q = normalizarBusqueda(busqueda)
    if (!q) return true
    return [r.cuit, r.denominacion_emisor, r.cuenta_contable, r.estado, r.fc]
      .some(c => normalizarBusqueda(c || '').includes(q))
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reglas de importación ARCA</DialogTitle>
          <DialogDescription>
            Al importar facturas, si el CUIT coincide se asigna automáticamente la cuenta contable, el estado y el FC
            (ej. Portal para los que vienen del portal del proveedor). Las reglas son únicas por CUIT (aplican a todas las empresas).
          </DialogDescription>
        </DialogHeader>

        {/* Búsqueda + nueva */}
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Buscar por CUIT, proveedor, cuenta o estado..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="text-sm"
          />
          {!editId && (
            <Button onClick={abrirNueva} className="bg-green-600 hover:bg-green-700 whitespace-nowrap">
              <Plus className="h-4 w-4 mr-1" />Nueva regla
            </Button>
          )}
        </div>

        {/* Form crear/editar */}
        {editId && (
          <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
            <ProveedorCombobox
              label="Proveedor"
              required
              value={{ cuit: form.cuit, nombre: form.denominacion_emisor }}
              onChange={(sel) => setForm(f => ({ ...f, cuit: sel.cuit, denominacion_emisor: sel.nombre }))}
            />
            <div>
              <Label className="text-xs">Cuenta contable *</Label>
              <SelectorCuentaContable
                value={form.cuenta_contable}
                onSelect={(cuenta) => setForm(f => ({ ...f, cuenta_contable: cuenta?.categ || '' }))}
                placeholder="Buscar cuenta del plan..."
                autoFocus={false}
                mostrarSinAsignar={false}
                className="w-full"
              />
            </div>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label className="text-xs">Estado al importar</Label>
                <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="debito">Débito</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs">FC (archivo PDF)</Label>
                <Select value={form.fc} onValueChange={v => setForm(f => ({ ...f, fc: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Buscar">Buscar (busca el PDF)</SelectItem>
                    <SelectItem value="Portal">Portal (no busca)</SelectItem>
                    <SelectItem value="NO">NO (no tengo)</SelectItem>
                    <SelectItem value="Sí">Sí</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
                <Checkbox checked={form.activo} onCheckedChange={c => setForm(f => ({ ...f, activo: !!c }))} />
                Activa
              </label>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={() => setEditId(null)}>
                <X className="h-4 w-4 mr-1" />Cancelar
              </Button>
              <Button size="sm" onClick={guardar} disabled={guardando} className="bg-blue-600 hover:bg-blue-700">
                {guardando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Guardar
              </Button>
            </div>
          </div>
        )}

        {/* Tabla de reglas */}
        {cargando ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">CUIT</TableHead>
                  <TableHead className="text-xs">Proveedor</TableHead>
                  <TableHead className="text-xs">Cuenta contable</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                  <TableHead className="text-xs">FC</TableHead>
                  <TableHead className="text-xs">Activa</TableHead>
                  <TableHead className="text-xs w-[90px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-20 text-center text-muted-foreground text-sm">Sin reglas</TableCell></TableRow>
                ) : filtradas.map(r => (
                  <TableRow key={r.id} className={r.activo === false ? 'opacity-50' : ''}>
                    <TableCell className="text-sm font-mono">{r.cuit}</TableCell>
                    <TableCell className="text-sm">{r.denominacion_emisor || '—'}</TableCell>
                    <TableCell className="text-sm">{r.cuenta_contable}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${ESTADO_BADGE[r.estado] || ''}`}>{r.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.fc || 'Buscar'}</TableCell>
                    <TableCell className="text-sm">{r.activo === false ? 'No' : 'Sí'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => abrirEdicion(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => borrar(r)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
