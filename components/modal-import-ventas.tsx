"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, FileSpreadsheet, Download } from "lucide-react"
import { toast } from "sonner"

/**
 * Modal para importar facturas de venta (ARCA "Mis Comprobantes Emitidos" o Excel del mismo formato)
 * a msa.comprobantes_venta vía /api/import-ventas. Pide la fecha de cobro estimada (para el Cash Flow).
 */
export function ModalImportVentas({ open, onClose, onImportado }: { open: boolean; onClose: () => void; onImportado: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [fechaCobro, setFechaCobro] = useState('')
  const [cargando, setCargando] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  // Descarga directa de ARCA (emitidos)
  const [arcaPassword, setArcaPassword] = useState('')
  const [arcaDesde, setArcaDesde] = useState('')
  const [arcaHasta, setArcaHasta] = useState('')
  const [descargando, setDescargando] = useState(false)

  const reset = () => { setFile(null); setFechaCobro(''); setPreview(null); setArcaPassword(''); setArcaDesde(''); setArcaHasta('') }

  // Baja "Mis Comprobantes Emitidos" de ARCA y lo deja cargado como archivo (luego Previsualizar/Importar).
  const descargarDeArca = async () => {
    if (!arcaPassword.trim()) { toast.error('Ingresá tu clave fiscal de ARCA'); return }
    if (!arcaDesde || !arcaHasta) { toast.error('Completá ambas fechas'); return }
    setDescargando(true)
    try {
      const r = await fetch('/api/arca/descargar-comprobantes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa: 'MSA', password: arcaPassword, fechaDesde: arcaDesde, fechaHasta: arcaHasta, tipo: 'emitidos' }),
      })
      const d = await r.json()
      if (!r.ok) { toast.error('ARCA: ' + (d.error || `Error ${r.status}`)); return }
      const blob = new Blob([d.csvText], { type: 'text/csv;charset=utf-8' })
      const f = new File([blob], `arca-emitidos-${arcaDesde}-a-${arcaHasta}.csv`, { type: 'text/csv' })
      setFile(f)
      setArcaPassword('') // borrar clave de memoria
      setPreview(null)
      toast.success(`Descargadas ${d.cantidad ?? ''} de ARCA. Revisá la fecha de cobro y Previsualizá.`)
    } catch (e) {
      toast.error('Error de red: ' + (e as Error).message)
    } finally {
      setDescargando(false)
    }
  }

  const llamar = async (modoPreview: boolean) => {
    if (!file) { toast.error('Elegí un archivo'); return }
    setCargando(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (fechaCobro) fd.append('fecha_cobro', fechaCobro)
      if (modoPreview) fd.append('preview', 'true')
      const r = await fetch('/api/import-ventas', { method: 'POST', body: fd })
      const d = await r.json()
      if (!d.ok) { toast.error('Error: ' + (d.error || 'desconocido')); console.error('[import-ventas] respuesta:', d); return }
      if (modoPreview) {
        setPreview(d)
      } else {
        toast.success(`Importadas ${d.insertadas} · duplicadas ${d.duplicadas} · retenciones vinculadas ${d.retenciones_vinculadas}`)
        reset()
        onImportado()
        onClose()
      }
    } catch (e) {
      toast.error('Error de red: ' + (e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !cargando && (reset(), onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Importar facturas de venta</DialogTitle>
          <DialogDescription>
            Excel/CSV de ARCA "Mis Comprobantes Emitidos" (o mismo formato). Nacen como <b>a cobrar</b>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Opción A: descargar directo de ARCA (emitidos) */}
          <div className="rounded border bg-blue-50/50 p-2 space-y-2">
            <div className="text-xs font-medium text-blue-800 flex items-center gap-1"><Download className="h-3.5 w-3.5" />Descargar directo de ARCA (Emitidos)</div>
            <div className="grid grid-cols-3 gap-2">
              <Input type="password" placeholder="Clave fiscal" value={arcaPassword} onChange={e => setArcaPassword(e.target.value)} className="text-sm" />
              <Input type="date" value={arcaDesde} onChange={e => setArcaDesde(e.target.value)} className="text-sm" title="Desde" />
              <Input type="date" value={arcaHasta} onChange={e => setArcaHasta(e.target.value)} className="text-sm" title="Hasta" />
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={descargarDeArca} disabled={descargando}>
              {descargando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Bajar de ARCA
            </Button>
          </div>

          <div className="text-center text-[11px] text-gray-400">— o subí un archivo —</div>

          <div>
            <Label className="text-xs">Archivo (.xlsx / .xls / .csv)</Label>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null) }} />
            {file && <div className="text-[11px] text-green-700 mt-0.5">Archivo listo: {file.name}</div>}
          </div>
          <div>
            <Label className="text-xs">Fecha de cobro estimada (para el Cash Flow)</Label>
            <Input type="date" value={fechaCobro} onChange={e => setFechaCobro(e.target.value)} className="max-w-[200px]" />
          </div>

          {preview && (
            <div className="rounded border bg-gray-50 p-2 text-xs">
              <div>Total filas: <b>{preview.total}</b> · Nuevas: <b className="text-green-700">{preview.nuevas}</b> · Duplicadas: <b className="text-orange-700">{preview.duplicadas}</b></div>
              {preview.muestra?.[0] && (
                <div className="mt-1 text-gray-600">
                  Ej: {preview.muestra[0].denominacion_cliente} · CUIT {preview.muestra[0].cuit_cliente} · ${preview.muestra[0].imp_total}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => { reset(); onClose() }} disabled={cargando}>Cancelar</Button>
          <Button variant="outline" onClick={() => llamar(true)} disabled={cargando || !file}>
            {cargando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Previsualizar
          </Button>
          <Button onClick={() => llamar(false)} disabled={cargando || !file} className="bg-blue-600 hover:bg-blue-700">
            {cargando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Importar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
