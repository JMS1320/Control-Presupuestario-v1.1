"use client"

/**
 * 🏦 EL EXCEL DE EMISIÓN DE ECHEQS para el banco — A-FEAT-1282 (2026-10-14).
 *
 * Como el lote de transferencias, pero para echeqs: arma el archivo con el formato de la plantilla
 * del banco (`Plantilla_Emision250.xlsx`, hoja «Plantilla para emision»), una fila por echeq.
 *   · **Cláusula**: se elige, con la explicación de cada una (pedido del usuario).
 *   · **Motivo**: «Factura» si el echeq paga una factura; si no, «Orden de pago» (pedido del usuario).
 *   · **Mail**: el de pagos del proveedor (`proveedores`), como en las transferencias.
 * Si algo haría que el banco rechace el archivo (un CUIT mal, un monto en cero), NO se genera y se
 * dice qué es: es un error del dato, no del negocio (§ 🚦 integridad).
 */

import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { CLAUSULAS, MOTIVOS_ECHEQ, motivoPorDefecto, filasEmision, nombreArchivoEmision } from "@/lib/pagos/echeqs-multiples"
import { hoyArgentina } from "@/lib/fechas"

export interface ChequeAExportar {
  id: string
  beneficiario_cuit: string | null
  beneficiario_nombre: string | null
  monto: number | null
  fecha_cobro: string | null
  numero: string | null
  factura_id: string | null
  anticipo_id: string | null
  concepto: string | null
}

const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fechaAR = (s: string | null) => (s ? s.split('-').reverse().join('/') : '')

export function ModalExportarEcheqs({ open, onClose, cheques, empresa = 'MSA' }: {
  open: boolean
  onClose: () => void
  cheques: ChequeAExportar[]
  empresa?: string
}) {
  const [clausula, setClausula] = useState<string>('')
  const [motivos, setMotivos] = useState<Record<string, string>>({})
  const [mails, setMails] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setClausula('')
    setMotivos(Object.fromEntries(cheques.map(c => [c.id, motivoPorDefecto(!!c.factura_id)])))
    // El mail de pagos del proveedor, por CUIT (como en las transferencias).
    const cuits = [...new Set(cheques.map(c => String(c.beneficiario_cuit || '').replace(/\D/g, '')).filter(Boolean))]
    if (!cuits.length) { setMails({}); return }
    supabase.from('proveedores').select('cuit, email_pagos, email_facturacion').in('cuit', cuits)
      .then(({ data }) => setMails(Object.fromEntries((data || []).map((p: any) => [String(p.cuit), p.email_pagos || p.email_facturacion || '']))))
    // Sólo al abrir: `cheques` llega como un arreglo nuevo en cada render y reiniciaría la cláusula elegida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const { filas, problemas } = useMemo(() => filasEmision(cheques.map(c => ({
    cuit: String(c.beneficiario_cuit || ''),
    monto: Number(c.monto) || 0,
    fechaCobro: c.fecha_cobro || '',
    motivo: motivos[c.id] || motivoPorDefecto(!!c.factura_id),
    descripcion1: c.concepto || c.beneficiario_nombre || '',
    mail: mails[String(c.beneficiario_cuit || '').replace(/\D/g, '')] || '',
    clausula: clausula || 'A la orden',
    numero: c.numero || '',
  }))), [cheques, motivos, mails, clausula])

  const total = cheques.reduce((s, c) => s + (Number(c.monto) || 0), 0)

  const exportar = () => {
    if (!clausula) { toast.error('Elegí la cláusula'); return }
    if (problemas.length) { toast.error('El banco rechazaría el archivo: ' + problemas[0]); return }
    const ws = XLSX.utils.aoa_to_sheet(filas)
    // Formatos de la plantilla: documento entero, monto con 2 decimales, fecha como TEXTO.
    for (let r = 1; r < filas.length; r++) {
      const b = ws[XLSX.utils.encode_cell({ r, c: 1 })]; if (b) b.z = '#0'
      const c = ws[XLSX.utils.encode_cell({ r, c: 2 })]; if (c) c.z = '0.00'
      const d = ws[XLSX.utils.encode_cell({ r, c: 3 })]; if (d) { d.t = 's'; d.z = '@' }
    }
    ws['!cols'] = Array.from({ length: 10 }, () => ({ wch: 20 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla para emision')
    XLSX.writeFile(wb, nombreArchivoEmision(empresa, hoyArgentina()))
    toast.success(`Excel de emisión generado: ${cheques.length} echeq(s) por $${fmt(total)}`)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🏦 Excel de emisión de ECHEQs</DialogTitle>
          <DialogDescription>{cheques.length} echeq(s) por ${fmt(total)} — formato de la plantilla del banco (máx. 250).</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-sm font-medium">Cláusula *</div>
          {CLAUSULAS.map(c => (
            <label key={c.valor} className={`flex gap-2 items-start border rounded p-2 cursor-pointer ${clausula === c.valor ? 'border-amber-500 bg-amber-50' : ''}`}>
              <input type="radio" className="mt-1" checked={clausula === c.valor} onChange={() => setClausula(c.valor)} />
              <span><b>{c.valor}</b> — <span className="text-sm text-gray-600">{c.explicacion}</span></span>
            </label>
          ))}
        </div>

        <table className="w-full text-xs mt-3">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-1 text-left">Beneficiario</th><th className="p-1 text-left">CUIT</th>
              <th className="p-1 text-right">Monto</th><th className="p-1 text-center">Fecha de pago</th>
              <th className="p-1 text-left">Motivo</th><th className="p-1 text-left">Mail</th><th className="p-1 text-left">Nº</th>
            </tr>
          </thead>
          <tbody>
            {cheques.map(c => (
              <tr key={c.id} className="border-b">
                <td className="p-1">{c.beneficiario_nombre || '—'}</td>
                <td className="p-1">{c.beneficiario_cuit || '—'}</td>
                <td className="p-1 text-right tabular-nums">${fmt(Number(c.monto) || 0)}</td>
                <td className="p-1 text-center">{fechaAR(c.fecha_cobro)}</td>
                <td className="p-1">
                  <select className="border rounded px-1 py-0.5" value={motivos[c.id] || ''} onChange={e => setMotivos(m => ({ ...m, [c.id]: e.target.value }))}>
                    {MOTIVOS_ECHEQ.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
                <td className="p-1 text-gray-600">{mails[String(c.beneficiario_cuit || '').replace(/\D/g, '')] || <span className="text-gray-400">sin mail</span>}</td>
                <td className="p-1 text-gray-600">{c.numero || <span className="text-gray-400">banco</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {problemas.length > 0 && (
          <ul className="text-xs text-red-700 list-disc pl-4 mt-2">{problemas.map((p, i) => <li key={i}>{p}</li>)}</ul>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-amber-600 hover:bg-amber-700" disabled={!clausula || problemas.length > 0 || !cheques.length} onClick={exportar}>Generar Excel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
