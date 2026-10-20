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
 */
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { candidatosDelLog, type FilaLogCandidato } from '@/lib/gas-pdf/lote'

interface Props {
  open: boolean
  empresa: 'MSA' | 'PAM' | 'MA'
  factura: { id: string; rotulo: string } | null
  onClose: () => void
  onConfirmada: (facturaId: string, driveUrl: string) => void
}

export function ModalElegirCandidato({ open, empresa, factura, onClose, onConfirmada }: Props) {
  const [filas, setFilas] = useState<FilaLogCandidato[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !factura) return
    setFilas(null); setError(null)
    fetch(`/api/gas/historial-pdf?factura_id=${factura.id}&limit=50`)
      .then(r => r.json())
      .then(d => { if (!d.ok) throw new Error(d.error || 'error'); setFilas(candidatosDelLog(d.logs || [])) })
      .catch(e => setError((e as Error).message))
  }, [open, factura])

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
            Abrí cada candidato y elegí el que corresponde. La factura queda en «Confirmada» con ese archivo.
            Los que no elijas no se borran: quedan donde están.
          </DialogDescription>
        </DialogHeader>
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
                </div>
                <Button size="sm" disabled={!!confirmando} onClick={() => confirmar(c.drive_url)}>
                  {confirmando === c.drive_url ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Es ésta'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
