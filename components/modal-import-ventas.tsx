"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, FileSpreadsheet } from "lucide-react"
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

  const reset = () => { setFile(null); setFechaCobro(''); setPreview(null) }

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
          <div>
            <Label className="text-xs">Archivo (.xlsx / .xls / .csv)</Label>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null) }} />
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
