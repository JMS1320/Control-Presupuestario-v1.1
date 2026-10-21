'use client'

/**
 * ✓ de una factura en VER: muestra los archivos candidatos y el usuario elige cuál es (A-FEAT-1287).
 *
 * Antes el ✓ confirmaba a ciegas el último candidato del log, sin mostrarlo. Con la regla de
 * 2026-10-20 —dos archivos para una factura → no se vincula ninguno— puede haber varios, y el que
 * decide es el usuario: cada uno se abre, se lee el motivo, y se elige con «Es ésta». Al confirmar,
 * la factura queda en **Confirmada** (no en «Sí», que es de Ulises).
 *
 * Los candidatos salen del log de búsquedas: el último lote en que esta factura quedó a revisar.
 *
 * «No es ésta» (usuario 2026-10-20): al lado de cada candidato se ve lo que dice la factura de ARCA
 * (fecha, número, importe) y lo que leyó la app del archivo. Si no es, se descarta con un motivo: queda
 * en el historial de búsquedas, no se vuelve a ofrecer, y sin candidatos la factura vuelve a NO Mail.
 */
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { candidatosDelLog, type FilaLogCandidato } from '@/lib/gas-pdf/lote'

interface Props {
  open: boolean
  empresa: 'MSA' | 'PAM' | 'MA'
  factura: { id: string; rotulo: string; fecha_emision?: string | null; imp_total?: number | null } | null
  onClose: () => void
  onConfirmada: (facturaId: string, driveUrl: string) => void
  /** Se descartó un candidato; `fcNuevo` = 'NO Mail' si no quedó ninguno */
  onDescartada?: (facturaId: string, fcNuevo?: string) => void
}

const pesos = (n?: number | null) => n == null ? '—' : '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fechaAR = (iso?: string | null) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—'

export function ModalElegirCandidato({ open, empresa, factura, onClose, onConfirmada, onDescartada }: Props) {
  const [filas, setFilas] = useState<FilaLogCandidato[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  // «No es ésta»: el candidato que se está descartando y su motivo
  const [descartando, setDescartando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  const cargar = () => {
    if (!factura) return
    setFilas(null); setError(null)
    fetch(`/api/gas/historial-pdf?factura_id=${factura.id}&limit=200`)
      .then(r => r.json())
      .then(d => { if (!d.ok) throw new Error(d.error || 'error'); setFilas(candidatosDelLog(d.logs || [])) })
      .catch(e => setError((e as Error).message))
  }
  useEffect(() => {
    if (!open || !factura) return
    setDescartando(null); setMotivo('')
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, factura])

  const descartar = async (driveUrl: string) => {
    if (!factura) return
    setConfirmando(driveUrl)
    try {
      const r = await fetch('/api/gas/descartar-candidato', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factura_id: factura.id, empresa, drive_url: driveUrl, motivo }),
      })
      const data = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
      if (!data.ok) { setError('No se pudo descartar: ' + (data.error || '')); return }
      setDescartando(null); setMotivo('')
      onDescartada?.(factura.id, data.fc_nuevo)
      if (data.quedan === 0) onClose(); else cargar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setConfirmando(null)
    }
  }

  const confirmar = async (driveUrl: string) => {
    if (!factura) return
    setConfirmando(driveUrl)
    try {
      const r = await fetch('/api/gas/confirmar-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factura_id: factura.id, empresa, drive_url: driveUrl }),
      })
      const data = await r.json()
      if (!data.ok) { setError('No se pudo confirmar: ' + (data.error || '')); return }
      onConfirmada(factura.id, data.drive_url || driveUrl)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setConfirmando(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !confirmando) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>¿Cuál es el archivo de {factura?.rotulo}?</DialogTitle>
          <DialogDescription>
            Abrí cada candidato y elegí el que corresponde: la factura queda en «Confirmada» con ese archivo.
            Si no es, «No es ésta»: queda registrado y no se vuelve a ofrecer. Ningún archivo se borra.
          </DialogDescription>
        </DialogHeader>
        {factura && (
          <p className="text-xs bg-gray-50 border rounded px-2 py-1">
            <span className="text-gray-500">La factura en ARCA:</span>{' '}
            <b>{factura.rotulo}</b> · emitida {fechaAR(factura.fecha_emision)} · {pesos(factura.imp_total)}
          </p>
        )}
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
        {!filas && !error && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando candidatos…</p>}
        {filas && filas.length === 0 && (
          <p className="text-sm text-gray-600">No hay candidatos guardados para esta factura. Volvé a buscarla.</p>
        )}
        {filas && filas.length > 0 && (
          <ul className="space-y-2">
            {filas.map((c, i) => (
              <li key={c.drive_url} className="border rounded p-2 flex items-start gap-3">
                <div className="flex-1 min-w-0 text-sm">
                  <a href={c.drive_url} target="_blank" rel="noreferrer" className="text-blue-700 underline font-medium">
                    Abrir candidato {i + 1}
                  </a>
                  <span className="ml-2 text-[11px] text-gray-500">{c.deCarpeta ? '🗂️ ya está en la carpeta' : '📧 bajado del mail a _Revisar'}</span>
                  {c.observaciones && <p className="text-xs text-gray-600 mt-0.5 break-words">{c.observaciones}</p>}
                  <p className="text-xs mt-0.5">
                    <span className="text-gray-500">Importe que leyó la app en el archivo:</span>{' '}
                    {c.monto_pdf == null
                      ? <span className="text-gray-400">no lo pudo leer</span>
                      : <span className={factura?.imp_total != null && Math.abs(Math.abs(c.monto_pdf) - Math.abs(Number(factura.imp_total))) > 1 ? 'text-red-700 font-medium' : 'text-emerald-700'}>
                          {pesos(c.monto_pdf)}
                        </span>}
                  </p>
                  {descartando === c.drive_url && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <input autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo (opcional): número distinto, otra póliza…"
                        className="flex-1 h-7 text-xs border rounded px-2" onKeyDown={e => { if (e.key === 'Enter') descartar(c.drive_url) }} />
                      <Button size="sm" variant="destructive" disabled={!!confirmando} onClick={() => descartar(c.drive_url)}>
                        {confirmando === c.drive_url ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Descartar'}
                      </Button>
                      <button type="button" className="text-xs text-gray-500 underline" onClick={() => { setDescartando(null); setMotivo('') }}>cancelar</button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" disabled={!!confirmando} onClick={() => confirmar(c.drive_url)}>
                    {confirmando === c.drive_url && descartando !== c.drive_url ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Es ésta'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={!!confirmando} onClick={() => { setDescartando(c.drive_url); setMotivo('') }}>
                    No es ésta
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
