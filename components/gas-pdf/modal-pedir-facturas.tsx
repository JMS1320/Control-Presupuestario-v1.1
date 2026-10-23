'use client'

/**
 * 📮 Pedirle la factura al proveedor (A-FEAT-1313, texto acordado con el usuario 2026-10-21).
 *
 * Muestra los mails tal cual van a salir —uno por proveedor, con todas sus facturas— y deja elegir:
 * **Crear borradores** (quedan en Gmail para revisarlos y mandarlos) o **Enviar**. Las facturas de
 * proveedores sin mail cargado se listan aparte: desde acá no se pueden pedir.
 * Cada pedido queda en el historial de la factura, y la lista de facturas sin PDF muestra «pedida hace N días».
 */
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { haceCuanto } from '@/lib/gas-pdf/pedido'
import { hoyArgentina, diaArgentino } from '@/lib/fechas'

interface MailPedido {
  cuit: string; proveedor: string; para: string; asunto: string; texto: string
  facturas: Array<{ id: string; rotulo: string; pedida?: string | null }>
}
interface Props {
  open: boolean
  empresa: 'MSA' | 'PAM' | 'MA'
  facturaIds: string[]
  onClose: () => void
  /** Se pidieron (borrador o envío): para refrescar «pedida hace N días» */
  onHecho?: () => void
}

type Estado = { tipo: 'espera' } | { tipo: 'ok'; aviso?: string; modo: string } | { tipo: 'error'; error: string }

export function ModalPedirFacturas({ open, empresa, facturaIds, onClose, onHecho }: Props) {
  const [mails, setMails] = useState<MailPedido[] | null>(null)
  const [sinMail, setSinMail] = useState<Array<{ proveedor: string; facturas: Array<{ rotulo: string }> }>>([])
  const [error, setError] = useState<string | null>(null)
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [abierto, setAbierto] = useState<string | null>(null)
  const [estados, setEstados] = useState<Record<string, Estado>>({})
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    if (!open) return
    setMails(null); setError(null); setEstados({}); setAbierto(null)
    fetch('/api/gas/pedir-factura', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'previsualizar', empresa, factura_ids: facturaIds }),
    })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) throw new Error(d.error || 'error')
        setMails(d.mails); setSinMail(d.sin_mail || [])
        setElegidos(new Set((d.mails as MailPedido[]).map(m => m.cuit)))
      })
      .catch(e => setError((e as Error).message))
  }, [open, empresa, facturaIds])

  const hoy = hoyArgentina()
  const mandar = async (modo: 'borrador' | 'enviar') => {
    if (!mails) return
    const lista = mails.filter(m => elegidos.has(m.cuit) && estados[m.cuit]?.tipo !== 'ok')
    if (lista.length === 0) return
    if (modo === 'enviar' && !window.confirm(`Se van a ENVIAR ${lista.length} mail(s) a los proveedores desde la casilla de la empresa. ¿Seguro?`)) return
    setTrabajando(true)
    for (const m of lista) {
      setEstados(prev => ({ ...prev, [m.cuit]: { tipo: 'espera' } }))
      try {
        const r = await fetch('/api/gas/pedir-factura', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: modo, empresa, factura_ids: m.facturas.map(f => f.id) }),
        })
        const d = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
        setEstados(prev => ({ ...prev, [m.cuit]: d.ok ? { tipo: 'ok', modo, aviso: d.error_registro ? `No quedó en el historial: ${d.error_registro}` : undefined } : { tipo: 'error', error: d.error || 'error' } }))
      } catch (e) {
        setEstados(prev => ({ ...prev, [m.cuit]: { tipo: 'error', error: (e as Error).message } }))
      }
    }
    setTrabajando(false)
    onHecho?.()
  }

  const nElegidos = mails ? mails.filter(m => elegidos.has(m.cuit) && estados[m.cuit]?.tipo !== 'ok').length : 0
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !trabajando) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>📮 Pedir la factura al proveedor</DialogTitle>
          <DialogDescription>
            Un mail nuevo por proveedor, desde la casilla de la empresa, firmado Jose Martinez Sobrado (y debajo Martinez Sobrado Agro SRL si es de MSA). Elegí si quedan como borrador en Gmail o se envían.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-red-700">No se pudo armar el pedido: {error}</p>}
        {!mails && !error && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Armando los mails…</p>}
        {mails && (
          <div className="overflow-y-auto flex-1 min-h-0 space-y-2 text-xs">
            {mails.length === 0 && <p className="text-gray-500">Ninguna de estas facturas es de un proveedor con mail cargado.</p>}
            {mails.map(m => {
              const st = estados[m.cuit]
              return (
                <div key={m.cuit} className="border rounded p-2">
                  <div className="flex items-start gap-2">
                    <input type="checkbox" className="mt-0.5" checked={elegidos.has(m.cuit)} disabled={trabajando || st?.tipo === 'ok'}
                      onChange={() => setElegidos(prev => { const n = new Set(prev); if (n.has(m.cuit)) n.delete(m.cuit); else n.add(m.cuit); return n })} />
                    <div className="flex-1 min-w-0">
                      <div><b>{m.proveedor}</b> <span className="text-gray-500">→ {m.para}</span></div>
                      <div className="text-gray-600">{m.facturas.map(f => (
                        <span key={f.id} className="mr-2">{f.rotulo}{f.pedida ? <span className="text-amber-700"> (📮 ya pedida {haceCuanto(diaArgentino(new Date(f.pedida)), hoy)})</span> : null}</span>
                      ))}</div>
                      <button type="button" className="text-blue-700 underline" onClick={() => setAbierto(abierto === m.cuit ? null : m.cuit)}>
                        {abierto === m.cuit ? 'ocultar el mail' : 'ver el mail'}
                      </button>
                      {abierto === m.cuit && (
                        <div className="mt-1 bg-gray-50 border rounded p-2">
                          <div className="text-gray-500">Asunto: <span className="text-gray-800">{m.asunto}</span></div>
                          <pre className="whitespace-pre-wrap font-sans mt-1">{m.texto}</pre>
                        </div>
                      )}
                    </div>
                    <div className="w-40 text-right">
                      {st?.tipo === 'espera' && <Loader2 className="h-4 w-4 animate-spin inline" />}
                      {st?.tipo === 'ok' && <span className="text-emerald-700">✅ {st.modo === 'enviar' ? 'enviado' : 'borrador creado'}{st.aviso ? <span className="block text-amber-700">{st.aviso}</span> : null}</span>}
                      {st?.tipo === 'error' && <span className="text-red-700">❌ {st.error}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
            {sinMail.length > 0 && (
              <div className="border border-amber-200 bg-amber-50 rounded p-2 text-amber-800">
                <b>Sin mail del proveedor</b> (cargalo en Config PDFs para poder pedirla): {sinMail.map(s => `${s.proveedor} (${s.facturas.map(f => f.rotulo).join(', ')})`).join(' · ')}
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" disabled={trabajando} onClick={onClose}>Cerrar</Button>
          <Button variant="outline" disabled={trabajando || nElegidos === 0} onClick={() => mandar('borrador')}>Crear borradores ({nElegidos})</Button>
          <Button disabled={trabajando || nElegidos === 0} onClick={() => mandar('enviar')}>Enviar ({nElegidos})</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
