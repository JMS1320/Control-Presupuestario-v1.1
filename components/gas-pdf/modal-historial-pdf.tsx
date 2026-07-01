'use client'

/**
 * Modal "Historial de búsquedas PDFs"
 *
 * Dos modos:
 *   - Modo lote: filtra por loteId específico (uso típico: ver detalle del lote
 *     que acaba de terminar)
 *   - Modo factura: filtra por factura_id específica (uso típico: click en una
 *     fila de la alerta para ver historial de UNA factura)
 *   - Modo global: muestra los últimos N intentos sin filtro (acceso desde
 *     algún botón general)
 */

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { Loader2, ExternalLink } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  /** Si se pasa, filtra por este lote */
  loteId?: string
  /** Si se pasa, filtra por esta factura */
  facturaId?: string
  /** Cantidad máxima a mostrar (default 50) */
  limit?: number
}

interface LogEntry {
  id: string
  factura_id: string
  factura_schema: string
  fecha_hora: string
  resultado: string
  drive_url: string | null
  observaciones: string | null
  tiempo_ejecucion_ms: number | null
  cuit_emisor: string | null
  numero_comprobante: string | null
  monto_factura: number | null
  monto_pdf: number | null
}

const COLOR_RESULTADO: Record<string, string> = {
  descargado: 'bg-green-100 text-green-800',
  revisar: 'bg-yellow-100 text-yellow-800',
  no_encontrado: 'bg-gray-100 text-gray-700',
  error: 'bg-red-100 text-red-800',
  pendiente: 'bg-blue-100 text-blue-800',
}

export function ModalHistorialPdf({ open, onClose, loteId, facturaId, limit = 50 }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!open) return
    setCargando(true)
    const params = new URLSearchParams()
    if (loteId) params.set('lote_id', loteId)
    if (facturaId) params.set('factura_id', facturaId)
    params.set('limit', String(limit))
    fetch(`/api/gas/historial-pdf?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setLogs(data.logs)
        else console.error('Error cargando log:', data.error)
      })
      .catch(err => console.error('Error fetch log:', err))
      .finally(() => setCargando(false))
  }, [open, loteId, facturaId, limit])

  const titulo = loteId
    ? 'Detalle del lote de búsqueda'
    : facturaId
    ? 'Historial de búsquedas de esta factura'
    : 'Historial de búsquedas PDFs (últimas ' + limit + ')'

  const totales = logs.reduce((acc, l) => {
    acc[l.resultado] = (acc[l.resultado] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>📋 {titulo}</DialogTitle>
          <DialogDescription>
            {loteId && `Lote ${loteId.slice(0, 8)}… — `}
            {logs.length} intento{logs.length !== 1 ? 's' : ''}
            {Object.keys(totales).length > 0 && (
              <span className="ml-2">
                ({Object.entries(totales).map(([r, n]) => `${n} ${r}`).join(' / ')})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <div className="flex items-center justify-center py-8 text-gray-500 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Cargando…</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-sm text-gray-500 py-6 text-center">
            Sin registros para mostrar.
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="border px-2 py-1.5 text-left">Fecha/hora</th>
                  <th className="border px-2 py-1.5 text-left">Empresa</th>
                  <th className="border px-2 py-1.5 text-left">Resultado</th>
                  <th className="border px-2 py-1.5 text-left">CUIT</th>
                  <th className="border px-2 py-1.5 text-left">Comprobante</th>
                  <th className="border px-2 py-1.5 text-right">Monto FC</th>
                  <th className="border px-2 py-1.5 text-right">Monto PDF</th>
                  <th className="border px-2 py-1.5 text-left">Observaciones</th>
                  <th className="border px-2 py-1.5 text-right">ms</th>
                  <th className="border px-2 py-1.5 text-center">PDF</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-blue-50">
                    <td className="border px-2 py-1 whitespace-nowrap">
                      {new Date(l.fecha_hora).toLocaleString('es-AR')}
                    </td>
                    <td className="border px-2 py-1 uppercase">{l.factura_schema}</td>
                    <td className="border px-2 py-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${COLOR_RESULTADO[l.resultado] || 'bg-gray-100'}`}>
                        {l.resultado}
                      </span>
                    </td>
                    <td className="border px-2 py-1 font-mono">{l.cuit_emisor || '—'}</td>
                    <td className="border px-2 py-1">{l.numero_comprobante || '—'}</td>
                    <td className="border px-2 py-1 text-right">
                      {l.monto_factura ? `$${Number(l.monto_factura).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="border px-2 py-1 text-right">
                      {l.monto_pdf ? `$${Number(l.monto_pdf).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="border px-2 py-1 max-w-[300px] truncate" title={l.observaciones || ''}>
                      {l.observaciones || '—'}
                    </td>
                    <td className="border px-2 py-1 text-right">{l.tiempo_ejecucion_ms || '—'}</td>
                    <td className="border px-2 py-1 text-center">
                      {l.drive_url ? (
                        <a href={l.drive_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                          <ExternalLink className="h-3.5 w-3.5 inline" />
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
