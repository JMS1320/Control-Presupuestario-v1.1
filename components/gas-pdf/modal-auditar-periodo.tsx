"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Empresa = 'MSA' | 'PAM' | 'MA'

interface Props {
  empresa: Empresa
  open: boolean
  onClose: () => void
}

interface Resultado {
  ok: boolean
  error?: string
  existe?: boolean
  observaciones?: string
  total_facturas?: number
  links_agregados?: number
  matched?: { factura_id: string; archivo: string; file_id?: string }[]
  huerfanos?: { archivo: string; url: string; file_id?: string; chars?: number; ocr_error?: string }[]
  sin_pdf?: { numero?: string; denominacion?: string; fc?: string }[]
}

export function ModalAuditarPeriodo({ empresa, open, onClose }: Props) {
  const hoy = new Date()
  const [anio, setAnio] = useState(String(hoy.getFullYear()))
  const [mes, setMes] = useState(String(hoy.getMonth() + 1).padStart(2, '0'))
  const [cargando, setCargando] = useState(false)
  const [progreso, setProgreso] = useState('')
  const [res, setRes] = useState<Resultado | null>(null)

  const cerrar = () => { setRes(null); setProgreso(''); onClose() }

  // Loop por tandas: cada request procesa ≤10 archivos y commitea sus links; acumulamos los file_id
  // procesados (skip) hasta completo. Luego un cierre que deja el log + manda el mail.
  const correr = async () => {
    setCargando(true); setRes(null); setProgreso('')
    const skip = new Set<string>()
    const matchedAcc: NonNullable<Resultado['matched']> = []
    const huerfanosAcc: NonNullable<Resultado['huerfanos']> = []
    let sinPdf: Resultado['sin_pdf'] = []
    let total = 0, links = 0, tanda = 0
    try {
      for (let guard = 0; guard < 500; guard++) {
        tanda++
        setProgreso(`Tanda ${tanda} — ${skip.size} archivo(s) procesados…`)
        const r = await fetch('/api/gas/auditar-periodo', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empresa, anio: parseInt(anio), mes: parseInt(mes), skip_file_ids: [...skip], max_files: 10 }),
        })
        const data = await r.json()
        if (!data.ok) { setRes(data); return }
        if (data.existe === false) { setRes(data); return }
        total = data.total_facturas ?? total
        links += data.links_agregados || 0
        for (const m of (data.matched || [])) { matchedAcc.push(m); if (m.file_id) skip.add(m.file_id) }
        for (const h of (data.huerfanos || [])) { huerfanosAcc.push(h); if (h.file_id) skip.add(h.file_id) }
        sinPdf = data.sin_pdf || sinPdf
        if (data.completo) break
      }
      // Cierre: log datado + mail con el acumulado
      setProgreso('Cerrando (log + mail)…')
      await fetch('/api/gas/auditar-periodo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa, anio: parseInt(anio), mes: parseInt(mes), finalizar: true, resumen: { matched: matchedAcc, huerfanos: huerfanosAcc, sin_pdf: sinPdf } }),
      })
      setRes({ ok: true, existe: true, total_facturas: total, matched: matchedAcc, huerfanos: huerfanosAcc, sin_pdf: sinPdf, links_agregados: links })
    } catch (e) {
      setRes({ ok: false, error: (e as Error).message })
    } finally {
      setCargando(false); setProgreso('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cerrar() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Auditar registro digital — {empresa}</DialogTitle>
          <DialogDescription>
            Releva la carpeta del período contra las facturas: agrega links faltantes, verifica los existentes
            y marca incongruencias. Deja un log en la carpeta y manda un mail resumen.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Año contable</Label>
            <Input className="w-24" value={anio} onChange={(e) => setAnio(e.target.value)} placeholder="2026" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mes contable</Label>
            <Input className="w-20" value={mes} onChange={(e) => setMes(e.target.value)} placeholder="06" />
          </div>
          <Button onClick={correr} disabled={cargando}>
            {cargando ? 'Auditando…' : 'Auditar'}
          </Button>
        </div>

        {cargando && (
          <p className="text-sm text-gray-500">{progreso || 'Procesando…'} — no cierres la ventana.</p>
        )}

        {res && !res.ok && <p className="text-sm text-red-600">Error: {res.error}</p>}

        {res && res.ok && res.existe === false && (
          <p className="text-sm text-amber-600">⚠️ {res.observaciones || 'La carpeta del período no existe.'}</p>
        )}

        {res && res.ok && res.existe !== false && (
          <div className="space-y-3 text-sm max-h-[50vh] overflow-y-auto">
            <div className="flex flex-wrap gap-3 font-medium">
              <span>Facturas: {res.total_facturas ?? 0}</span>
              <span className="text-green-700">✅ Con PDF: {res.matched?.length ?? 0}</span>
              <span className="text-amber-700">⚠️ Sin PDF: {res.sin_pdf?.length ?? 0}</span>
              <span className="text-gray-600">❓ Huérfanos: {res.huerfanos?.length ?? 0}</span>
              <span className="text-blue-700">🔗 Links agregados: {res.links_agregados ?? 0}</span>
            </div>

            {(res.sin_pdf?.length ?? 0) > 0 && (
              <div>
                <p className="font-medium text-amber-700">⚠️ Facturas sin PDF en la carpeta</p>
                <ul className="list-disc pl-5">
                  {res.sin_pdf!.map((s, i) => (
                    <li key={i}>{s.numero} — {s.denominacion} (fc={s.fc})</li>
                  ))}
                </ul>
              </div>
            )}

            {(res.huerfanos?.length ?? 0) > 0 && (
              <div>
                <p className="font-medium text-gray-700">❓ PDFs sin factura (huérfanos)</p>
                <p className="text-xs text-gray-400">OCR: caracteres leídos por archivo. <b>0 = no se pudo extraer texto</b> (PDF imagen o servicio Drive mal configurado).</p>
                <ul className="list-disc pl-5">
                  {res.huerfanos!.map((h, i) => (
                    <li key={i}>
                      <a className="text-blue-600 underline" href={h.url} target="_blank" rel="noreferrer">{h.archivo}</a>
                      {typeof h.chars === 'number' && (
                        <span className={`ml-2 text-xs ${h.chars === 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          (OCR: {h.chars} chars{h.ocr_error ? `, error: ${h.ocr_error}` : ''})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={cerrar}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
