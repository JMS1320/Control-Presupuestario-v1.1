'use client'

/**
 * Modal "Exportar lote a Excel" — banco Galicia.
 *
 * Flujo:
 *   1. Recibe items seleccionados desde Vista Pagos
 *   2. Llama a /api/lotes/preview
 *   3. Muestra tabla con validaciones, fecha de pago
 *   4. Botones: Cancelar / Completar mails / Completar CBUs / Aceptar y exportar
 *   5. Al exportar: llama a /api/lotes/generar, descarga archivos, muestra resumen
 */

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, AlertTriangle, Mail, CreditCard, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  llamarPreview, llamarGenerar, descargarArchivosLote,
} from '@/lib/lotes-galicia/client'
import type {
  ItemSeleccionado, PreviewLoteOutput, ItemPreview,
} from '@/lib/lotes-galicia/types'
import { ModalCompletarDatosProveedor } from './modal-completar-datos-proveedor'

interface Props {
  open: boolean
  onClose: () => void
  empresa: 'MSA' | 'PAM' | 'MA'
  items: ItemSeleccionado[]
  userRole?: string
}

const fmtMonto = (n: number) =>
  `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

export function ModalExportarLote({ open, onClose, empresa, items, userRole }: Props) {
  const [preview, setPreview] = useState<PreviewLoteOutput | null>(null)
  const [cargando, setCargando] = useState(false)
  const [fechaPago, setFechaPago] = useState('')
  const [generando, setGenerando] = useState(false)
  const [mensajes, setMensajes] = useState<Record<string, string>>({}) // itemId → override de mensaje
  const [fijar, setFijar] = useState<Set<string>>(new Set())            // itemIds a guardar como fijo
  // Edición inline de mail/CBU/Alias por proveedor (clave = proveedor_id)
  const [edDatos, setEdDatos] = useState<Record<string, { email?: string; cbuAlias?: string }>>({})
  const [guardandoProv, setGuardandoProv] = useState<string | null>(null)
  // Edición inline de cuenta de empleado por fila de sueldo (clave = item.id del pago)
  const [edSueldo, setEdSueldo] = useState<Record<string, { alias?: string; grupo?: string; concepto?: string; email?: string }>>({})
  const [guardandoSueldo, setGuardandoSueldo] = useState<string | null>(null)
  const [modalCompletar, setModalCompletar] = useState<{
    open: boolean
    modo: 'email' | 'cbu'
    cola: { proveedor_id: string; cuit: string; razon_social: string }[]
    indice: number
  }>({ open: false, modo: 'email', cola: [], indice: 0 })

  // Cargar preview al abrir
  useEffect(() => {
    if (!open) return
    cargarPreview()
    setMensajes({})
    setFijar(new Set())
    setEdDatos({})
    setEdSueldo({})
    // Default fecha de pago: hoy
    const hoy = new Date()
    const isoHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    setFechaPago(isoHoy)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function cargarPreview() {
    setCargando(true)
    try {
      const data = await llamarPreview({ empresa, items })
      if (data.ok) setPreview(data)
      else toast.error(`Error preview: ${data.error}`)
    } finally { setCargando(false) }
  }

  async function generar() {
    if (!fechaPago) { toast.error('Falta fecha de pago'); return }
    if (!preview) return
    setGenerando(true)
    try {
      const out = await llamarGenerar({ empresa, fecha_pago: fechaPago, items, user_role: userRole, mensajes, fijarMensaje: [...fijar] })
      if (!out.ok) { toast.error('Error: ' + out.error); return }

      // Descargar archivos
      await descargarArchivosLote(out)

      // Resumen
      const totPagos = out.archivos_pagos.reduce((s, a) => s + a.monto_total, 0)
      const totSueldos = out.archivos_sueldos.reduce((s, a) => s + a.monto_total, 0)
      const filasPagos = out.archivos_pagos.reduce((s, a) => s + a.cantidad_filas, 0)
      const filasSueldos = out.archivos_sueldos.reduce((s, a) => s + a.cantidad_filas, 0)

      let msg = '✅ Lote generado.\n'
      if (filasPagos > 0) msg += `\n📤 PAGOS: ${filasPagos} transferencias — ${fmtMonto(totPagos)}`
      if (filasSueldos > 0) msg += `\n💼 SUELDOS: ${filasSueldos} transferencias — ${fmtMonto(totSueldos)}`
      if (out.excluidos.length > 0) {
        msg += `\n\n⚠️ Excluidos (${out.excluidos.length}):\n`
        msg += out.excluidos.slice(0, 10).map(e => `• ${e.proveedor} — ${e.motivo}`).join('\n')
        if (out.excluidos.length > 10) msg += `\n…y ${out.excluidos.length - 10} más`
      }
      alert(msg)
      onClose()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    } finally {
      setGenerando(false)
    }
  }

  // Guarda mail (email_pagos) y/o CBU/Alias de un proveedor en la BBDD (proveedores) y refresca el preview.
  // El CBU/Alias se detecta: 22 dígitos → cbu, si no → alias_cbu.
  async function guardarDatosProv(proveedorId: string, campos: { email_pagos?: string | null; cbu?: string | null; alias_cbu?: string | null }) {
    setGuardandoProv(proveedorId)
    try {
      const r = await fetch('/api/gas/config-proveedor', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proveedor_id: proveedorId, ...campos }),
      })
      const d = await r.json()
      if (!d.ok) { toast.error('No se pudo guardar: ' + (d.error || '')); return }
      toast.success('Datos del proveedor guardados')
      setEdDatos(prev => { const n = { ...prev }; delete n[proveedorId]; return n })
      await cargarPreview() // refresca ✓/falta y los valores
    } catch (e) {
      toast.error('Error al guardar: ' + (e as Error).message)
    } finally {
      setGuardandoProv(null)
    }
  }

  // Guarda alias/grupo/concepto de la cuenta del empleado (sueldos.cuentas_empleado) y refresca el preview.
  async function guardarDatosSueldo(item: ItemPreview, campos: { alias?: string | null; grupo_export?: string | null; concepto?: string | null; email?: string | null }) {
    if (!item.empleado_id) { toast.error('Falta el empleado de este pago'); return }
    setGuardandoSueldo(item.id)
    try {
      const r = await fetch('/api/sueldos/cuenta-empleado', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empleado_id: item.empleado_id, cuenta_id: item.cuenta_destino_id || null, ...campos }),
      })
      const d = await r.json()
      if (!d.ok) { toast.error('No se pudo guardar: ' + (d.error || '')); return }
      toast.success('Cuenta del empleado guardada')
      setEdSueldo(prev => { const n = { ...prev }; delete n[item.id]; return n })
      await cargarPreview()
    } catch (e) {
      toast.error('Error al guardar: ' + (e as Error).message)
    } finally {
      setGuardandoSueldo(null)
    }
  }

  function abrirCompletar(modo: 'email' | 'cbu') {
    if (!preview) return
    const cola = modo === 'email' ? preview.proveedores_sin_email : preview.proveedores_sin_cbu
    if (cola.length === 0) return
    setModalCompletar({ open: true, modo, cola, indice: 0 })
  }

  function onCompletarGuardado() {
    // pasar al siguiente
    setModalCompletar(prev => {
      if (prev.indice + 1 >= prev.cola.length) {
        // Terminó la cola — refrescar preview
        cargarPreview()
        return { ...prev, open: false }
      }
      return { ...prev, indice: prev.indice + 1 }
    })
  }

  function onCompletarSaltado() {
    onCompletarGuardado() // mismo flujo (pasa al siguiente)
  }

  function onCompletarCancelado() {
    setModalCompletar(prev => ({ ...prev, open: false }))
    cargarPreview() // refrescar por si guardó algunos
  }

  const itemsPagos = preview?.pagos.items || []
  const itemsSueldos = preview?.sueldos.items || []
  const hayBloqueantes = (preview?.bloqueantes?.length || 0) > 0
  const totalValidos = (preview?.pagos.cantidad_validos || 0) + (preview?.sueldos.cantidad_validos || 0)
  const totalExcluidos = (preview?.pagos.cantidad_excluidos || 0) + (preview?.sueldos.cantidad_excluidos || 0)

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && !generando && onClose()}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>📤 Exportar lote a Excel — Banco Galicia ({empresa})</DialogTitle>
            <DialogDescription>
              Validá los datos, completá lo faltante si querés, y descargá el Excel.
            </DialogDescription>
          </DialogHeader>

          {cargando ? (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Cargando datos…</span>
            </div>
          ) : !preview ? (
            <div className="text-sm text-red-600 py-4">No se pudo cargar el preview.</div>
          ) : (
            <>
              {/* Fecha de pago */}
              <div className="flex items-center gap-3 mb-3">
                <Label className="text-sm font-medium">Fecha de pago *</Label>
                <Input
                  type="date"
                  value={fechaPago}
                  onChange={e => setFechaPago(e.target.value)}
                  className="max-w-[180px]"
                />
              </div>

              {/* Bloqueantes */}
              {hayBloqueantes && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 mb-3">
                  <div className="font-semibold flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    No se puede exportar — hay {preview.bloqueantes.length} bloqueante(s):
                  </div>
                  <ul className="list-disc ml-6 text-xs">
                    {preview.bloqueantes.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              )}

              {/* Resumen + acciones */}
              <div className="flex items-center gap-4 mb-3 text-sm">
                <span className="text-gray-700">
                  Válidos: <b className="text-green-700">{totalValidos}</b> · Excluidos: <b className="text-orange-700">{totalExcluidos}</b>
                </span>
                {preview.proveedores_sin_email.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => abrirCompletar('email')}>
                    <Mail className="mr-1 h-3.5 w-3.5" /> Completar emails ({preview.proveedores_sin_email.length})
                  </Button>
                )}
                {preview.proveedores_sin_cbu.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => abrirCompletar('cbu')}>
                    <CreditCard className="mr-1 h-3.5 w-3.5" /> Completar CBU/Alias ({preview.proveedores_sin_cbu.length})
                  </Button>
                )}
              </div>

              <div className="overflow-auto flex-1">
                {itemsPagos.length > 0 && (
                  <SectionTabla
                    titulo="🏦 Pagos (FC / Templates / Anticipos / Grupos)"
                    items={itemsPagos}
                    totalValidos={preview.pagos.cantidad_validos}
                    totalExcluidos={preview.pagos.cantidad_excluidos}
                    montoValido={preview.pagos.monto_total_valido}
                    montoExcluido={preview.pagos.monto_total_excluido}
                    mensajes={mensajes}
                    onMensaje={(id, v) => setMensajes(prev => ({ ...prev, [id]: v }))}
                    fijar={fijar}
                    onToggleFijar={(id) => setFijar(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })}
                    edDatos={edDatos}
                    setEdDatos={setEdDatos}
                    guardarDatosProv={guardarDatosProv}
                    guardandoProv={guardandoProv}
                    edSueldo={edSueldo}
                    setEdSueldo={setEdSueldo}
                    guardarDatosSueldo={guardarDatosSueldo}
                    guardandoSueldo={guardandoSueldo}
                  />
                )}
                {itemsSueldos.length > 0 && (
                  <div className="mt-4">
                    <SectionTabla
                      titulo="💼 Sueldos (archivo aparte)"
                      items={itemsSueldos}
                      totalValidos={preview.sueldos.cantidad_validos}
                      totalExcluidos={preview.sueldos.cantidad_excluidos}
                      montoValido={preview.sueldos.monto_total_valido}
                      montoExcluido={preview.sueldos.monto_total_excluido}
                      mensajes={mensajes}
                      onMensaje={(id, v) => setMensajes(prev => ({ ...prev, [id]: v }))}
                      fijar={fijar}
                      onToggleFijar={(id) => setFijar(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })}
                      edDatos={edDatos}
                      setEdDatos={setEdDatos}
                      guardarDatosProv={guardarDatosProv}
                      guardandoProv={guardandoProv}
                    edSueldo={edSueldo}
                    setEdSueldo={setEdSueldo}
                    guardarDatosSueldo={guardarDatosSueldo}
                    guardandoSueldo={guardandoSueldo}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t mt-3">
                <Button variant="outline" onClick={onClose} disabled={generando}>Cancelar</Button>
                <Button
                  onClick={generar}
                  disabled={generando || cargando || hayBloqueantes || totalValidos === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {generando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Aceptar y exportar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ModalCompletarDatosProveedor
        open={modalCompletar.open}
        modo={modalCompletar.modo}
        proveedor={modalCompletar.cola[modalCompletar.indice]}
        indice={modalCompletar.indice + 1}
        total={modalCompletar.cola.length}
        onGuardado={onCompletarGuardado}
        onSaltado={onCompletarSaltado}
        onCancelar={onCompletarCancelado}
      />
    </>
  )
}

function SectionTabla({
  titulo, items, totalValidos, totalExcluidos, montoValido, montoExcluido,
  mensajes, onMensaje, fijar, onToggleFijar,
  edDatos, setEdDatos, guardarDatosProv, guardandoProv,
  edSueldo, setEdSueldo, guardarDatosSueldo, guardandoSueldo,
}: {
  titulo: string
  items: ItemPreview[]
  totalValidos: number
  totalExcluidos: number
  montoValido: number
  montoExcluido: number
  mensajes: Record<string, string>
  onMensaje: (id: string, v: string) => void
  fijar: Set<string>
  onToggleFijar: (id: string) => void
  edDatos: Record<string, { email?: string; cbuAlias?: string }>
  setEdDatos: (fn: (prev: Record<string, { email?: string; cbuAlias?: string }>) => Record<string, { email?: string; cbuAlias?: string }>) => void
  guardarDatosProv: (proveedorId: string, campos: { email_pagos?: string | null; cbu?: string | null; alias_cbu?: string | null }) => void
  guardandoProv: string | null
  edSueldo: Record<string, { alias?: string; grupo?: string; concepto?: string; email?: string }>
  setEdSueldo: (fn: (prev: Record<string, { alias?: string; grupo?: string; concepto?: string; email?: string }>) => Record<string, { alias?: string; grupo?: string; concepto?: string; email?: string }>) => void
  guardarDatosSueldo: (item: ItemPreview, campos: { alias?: string | null; grupo_export?: string | null; concepto?: string | null; email?: string | null }) => void
  guardandoSueldo: string | null
}) {
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="bg-gray-100 px-3 py-2 flex items-center justify-between text-sm">
        <span className="font-semibold">{titulo}</span>
        <span className="text-xs text-gray-700">
          <span className="text-green-700">{totalValidos} válidos · {fmtMonto(montoValido)}</span>
          {totalExcluidos > 0 && (
            <span className="ml-3 text-orange-700">+ {totalExcluidos} excluidos · {fmtMonto(montoExcluido)}</span>
          )}
        </span>
      </div>
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-2 py-1.5 text-left">Tipo</th>
            <th className="px-2 py-1.5 text-left">Proveedor</th>
            <th className="px-2 py-1.5 text-left">CUIT</th>
            <th className="px-2 py-1.5 text-left">Mail</th>
            <th className="px-2 py-1.5 text-left">CBU/Alias</th>
            <th className="px-2 py-1.5 text-right">Monto</th>
            <th className="px-2 py-1.5 text-left">Último uso</th>
            <th className="px-2 py-1.5 text-left">Warnings</th>
            <th className="px-2 py-1.5 text-left">Mensaje del email</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <tr key={p.id + i} className={p.excluido_del_excel ? 'bg-orange-50' : p.bloqueante ? 'bg-red-50' : 'odd:bg-white even:bg-gray-50'}>
              <td className="px-2 py-1 uppercase">{p.tipo}</td>
              <td className="px-2 py-1 max-w-[200px] truncate" title={p.razon_social}>{p.razon_social}</td>
              <td className="px-2 py-1 font-mono">{p.cuit}</td>
              {/* Mail — pagos: email_pagos del proveedor (persistente). Sueldos: mail por export (va al Excel junto a sanmanuel). */}
              <td className="px-2 py-1">
                {p.tipo === 'sueldo' ? (() => {
                  const stored = p.email_pagos ?? ''
                  const val = edSueldo[p.id]?.email ?? stored
                  const cambiado = val !== stored
                  return (
                    <div className="flex items-center gap-1">
                      <input type="email" placeholder="mail (opcional)"
                        className="border rounded px-1 py-0.5 text-[11px] w-36"
                        value={val} disabled={guardandoSueldo === p.id}
                        onChange={e => setEdSueldo(prev => ({ ...prev, [p.id]: { ...prev[p.id], email: e.target.value } }))} />
                      {cambiado && (
                        <button type="button" title="Guardar mail del empleado" className="text-blue-600 shrink-0" disabled={guardandoSueldo === p.id}
                          onClick={() => guardarDatosSueldo(p, { email: val.trim() || null })}>
                          {guardandoSueldo === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  )
                })() : p.proveedor_id ? (() => {
                  const stored = p.email_pagos ?? ''
                  const val = edDatos[p.proveedor_id]?.email ?? stored
                  const cambiado = val !== stored
                  return (
                    <div className="flex items-center gap-1">
                      <input type="email" placeholder="agregar mail"
                        className={`border rounded px-1 py-0.5 text-[11px] w-36 ${stored ? '' : 'border-orange-300 placeholder-orange-500'}`}
                        value={val} disabled={guardandoProv === p.proveedor_id}
                        onChange={e => setEdDatos(prev => ({ ...prev, [p.proveedor_id!]: { ...prev[p.proveedor_id!], email: e.target.value } }))} />
                      {cambiado && (
                        <button type="button" title="Guardar mail" className="text-blue-600 shrink-0" disabled={guardandoProv === p.proveedor_id}
                          onClick={() => guardarDatosProv(p.proveedor_id!, { email_pagos: val.trim() || null })}>
                          {guardandoProv === p.proveedor_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  )
                })() : (p.email_pagos || <span className="text-red-600">❌ falta</span>)}
              </td>
              {/* CBU/Alias — editable inline. Sueldos: alias de cuenta_empleado. Pagos: CBU/Alias del proveedor. */}
              <td className="px-2 py-1">
                {p.tipo === 'sueldo' ? (() => {
                  const storedAlias = p.cbu ?? p.alias_cbu ?? ''
                  const storedGrupo = p.grupo_export ?? ''
                  const storedConcepto = p.concepto ?? ''
                  const valAlias = edSueldo[p.id]?.alias ?? storedAlias
                  const valGrupo = edSueldo[p.id]?.grupo ?? storedGrupo
                  const valConcepto = edSueldo[p.id]?.concepto ?? storedConcepto
                  const cambiado = valAlias !== storedAlias || valGrupo !== storedGrupo || valConcepto !== storedConcepto
                  const setF = (k: 'alias' | 'grupo' | 'concepto', v: string) =>
                    setEdSueldo(prev => ({ ...prev, [p.id]: { ...prev[p.id], [k]: v } }))
                  return (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <input type="text" placeholder="CBU o alias"
                          className={`border rounded px-1 py-0.5 text-[11px] w-44 ${storedAlias ? '' : 'border-orange-300 placeholder-orange-500'}`}
                          value={valAlias} disabled={guardandoSueldo === p.id}
                          onChange={e => setF('alias', e.target.value)} />
                        {cambiado && (
                          <button type="button" title="Guardar cuenta del empleado (alias + grupo + concepto)" className="text-blue-600 shrink-0" disabled={guardandoSueldo === p.id}
                            onClick={() => guardarDatosSueldo(p, { alias: valAlias.trim() || null, grupo_export: valGrupo.trim() || null, concepto: valConcepto.trim() || null })}>
                            {guardandoSueldo === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <input type="text" placeholder="grupo archivo"
                          className={`border rounded px-1 py-0.5 text-[10px] w-24 ${storedGrupo ? '' : 'border-orange-300 placeholder-orange-500'}`}
                          value={valGrupo} disabled={guardandoSueldo === p.id}
                          title="Agrupa el archivo Excel (ej. sigot_gs, sigot_lucresia, general)"
                          onChange={e => setF('grupo', e.target.value)} />
                        <input type="text" placeholder="concepto"
                          className="border rounded px-1 py-0.5 text-[10px] w-24"
                          value={valConcepto} disabled={guardandoSueldo === p.id}
                          title="Motivo del Excel (ej. Honorarios). Vacío = sin concepto"
                          onChange={e => setF('concepto', e.target.value)} />
                      </div>
                    </div>
                  )
                })() : p.proveedor_id ? (() => {
                  const stored = p.cbu ?? p.alias_cbu ?? ''
                  const val = edDatos[p.proveedor_id]?.cbuAlias ?? stored
                  const cambiado = val !== stored
                  const guardar = () => {
                    const limpio = val.replace(/\s/g, '')
                    if (!limpio) return guardarDatosProv(p.proveedor_id!, { cbu: null, alias_cbu: null })
                    if (/^\d{22}$/.test(limpio)) return guardarDatosProv(p.proveedor_id!, { cbu: limpio, alias_cbu: null })
                    return guardarDatosProv(p.proveedor_id!, { alias_cbu: val.trim(), cbu: null })
                  }
                  return (
                    <div className="flex items-center gap-1">
                      <input type="text" placeholder="CBU o Alias"
                        className={`border rounded px-1 py-0.5 text-[11px] w-40 ${stored ? '' : 'border-orange-300 placeholder-orange-500'}`}
                        value={val} disabled={guardandoProv === p.proveedor_id}
                        onChange={e => setEdDatos(prev => ({ ...prev, [p.proveedor_id!]: { ...prev[p.proveedor_id!], cbuAlias: e.target.value } }))} />
                      {cambiado && (
                        <button type="button" title="Guardar CBU/Alias" className="text-blue-600 shrink-0" disabled={guardandoProv === p.proveedor_id}
                          onClick={guardar}>
                          {guardandoProv === p.proveedor_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  )
                })() : (p.cbu ? 'CBU ✓' : p.alias_cbu ? 'Alias ✓' : <span className="text-red-600">❌ falta</span>)}
              </td>
              <td className="px-2 py-1 text-right">{fmtMonto(p.monto)}</td>
              <td className={`px-2 py-1 ${p.ultimo_uso_warning ? 'text-orange-700 font-medium' : ''}`}>
                {p.ultimo_uso_dias === null ? '—' : `hace ${p.ultimo_uso_dias}d`}
                {p.ultimo_uso_warning && ' ⚠'}
              </td>
              <td className="px-2 py-1 text-orange-700 text-[10px] max-w-[200px] truncate" title={p.warnings.join(' / ')}>
                {p.warnings.join(' / ')}
              </td>
              {/* Mensaje del email — igual para pagos y sueldos (va al Excel). "fijar" solo cuando hay proveedor. */}
              <td className="px-2 py-1">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    className="border rounded px-1 py-0.5 text-[11px] w-40"
                    placeholder={p.mensaje ? '' : 'sin mensaje'}
                    value={mensajes[p.id] ?? (p.mensaje ?? '')}
                    onChange={e => onMensaje(p.id, e.target.value.slice(0, 200))}
                    title={p.mensaje ? `Fijo del proveedor: ${p.mensaje}` : 'Sin mensaje fijo — podés escribir uno'}
                  />
                  {p.proveedor_id && (
                    <label className="flex items-center gap-0.5 text-[10px] text-gray-500 whitespace-nowrap" title="Guardar este mensaje como fijo del proveedor">
                      <input type="checkbox" checked={fijar.has(p.id)} onChange={() => onToggleFijar(p.id)} />
                      fijar
                    </label>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
