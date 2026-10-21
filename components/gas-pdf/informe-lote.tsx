'use client'

/**
 * 📋 El INFORME del lote del buscador de PDFs (A-FEAT-1287): una línea por factura, agrupada por lo
 * que pasó —ya estaba en la carpeta, bajada del mail, a revisar, no encontrada…— con el link a cada
 * archivo. Lo mismo va en el mail resumen; acá se ve al terminar, sin esperar el mail.
 */
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { agruparInforme, textoPedidoFacturas, SE_RECLAMA, type ItemInforme } from '@/lib/gas-pdf/lote'
import { toast } from 'sonner'

interface Props {
  open: boolean
  informe: ItemInforme[]
  onClose: () => void
  /** ✓ Confirmar desde el informe: lo bajado del mail o tomado de la carpeta queda en APP; abrís el
   *  PDF acá mismo y, si es ésa, pasa a Confirmada. Devuelve true si se guardó. */
  onConfirmar?: (item: ItemInforme, url: string) => Promise<boolean>
  /** Fecha e importe de la factura, para el pedido */
  datosDe?: (facturaId: string) => { fecha_emision?: string | null; imp_total?: number | null } | undefined
  /** 📮 Pedirle la factura al proveedor por mail (A-FEAT-1313) */
  onPedirProveedor?: (facturaIds: string[]) => void
}

/** Sólo lo que la app vinculó sola (APP) se confirma desde acá: lo «a revisar» tiene su propio paso */
const SE_CONFIRMA = new Set(['mail', 'carpeta'])

export function InformeLote({ open, informe, onClose, onConfirmar, datosDe, onPedirProveedor }: Props) {
  const grupos = agruparInforme(informe)
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set())
  const [aReclamar, setAReclamar] = useState<Set<string>>(new Set())
  const alternar = (id: string) => setAReclamar(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const copiarPedido = async () => {
    const filas = informe.filter(it => aReclamar.has(it.factura_id)).map(it => {
      const d = datosDe?.(it.factura_id)
      return { fecha_emision: d?.fecha_emision, imp_total: d?.imp_total, proveedor: it.proveedor, comprobante: it.factura }
    })
    try {
      await navigator.clipboard.writeText(textoPedidoFacturas(filas))
      toast.success(`Pedido copiado (${filas.length} factura${filas.length === 1 ? '' : 's'}). Pegalo donde quieras.`)
    } catch {
      toast.error('El navegador no dejó copiar al portapapeles.')
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Informe de la búsqueda — {informe.length} factura(s)</DialogTitle>
          <DialogDescription>Qué pasó con cada una, y el archivo para abrirlo.</DialogDescription>
        </DialogHeader>
        {informe.some(it => SE_RECLAMA.has(it.proceso)) && (
          <div className="flex items-center gap-2 text-xs">
            <button type="button" disabled={aReclamar.size === 0} onClick={copiarPedido}
              className="border rounded px-2 py-1 bg-white hover:bg-gray-50 disabled:opacity-40">
              📋 Copiar pedido de facturas ({aReclamar.size})
            </button>
            {onPedirProveedor && (
              <button type="button" disabled={aReclamar.size === 0} onClick={() => onPedirProveedor([...aReclamar])}
                className="border rounded px-2 py-1 bg-white hover:bg-gray-50 disabled:opacity-40">
                📮 Pedir al proveedor ({aReclamar.size})
              </button>
            )}
            <button type="button" className="text-blue-700 underline"
              onClick={() => setAReclamar(new Set(informe.filter(it => SE_RECLAMA.has(it.proceso)).map(it => it.factura_id)))}>
              Todas
            </button>
            <button type="button" className="text-blue-700 underline" onClick={() => setAReclamar(new Set())}>Ninguna</button>
            <span className="text-gray-500">Tildá las que querés reclamar: copiás un texto, o le mandás un mail a cada proveedor.</span>
          </div>
        )}
        <div className="overflow-y-auto flex-1 min-h-0 space-y-4">
          {grupos.length === 0 && <p className="text-sm text-gray-500">No se procesó ninguna factura.</p>}
          {grupos.map(g => (
            <section key={g.clave}>
              <h3 className="text-sm font-semibold">{g.titulo} <span className="text-gray-400 font-normal">({g.items.length})</span></h3>
              <p className="text-[11px] text-gray-500 mb-1">{g.ayuda}</p>
              <table className="w-full text-xs">
                <tbody>
                  {g.items.map(it => (
                    <tr key={it.factura_id} className="border-b align-top">
                      <td className="p-1 w-5">
                        {SE_RECLAMA.has(it.proceso) && (
                          <input type="checkbox" checked={aReclamar.has(it.factura_id)} onChange={() => alternar(it.factura_id)} title="Incluir en el pedido de facturas" />
                        )}
                      </td>
                      <td className="p-1 whitespace-nowrap">{it.factura}</td>
                      <td className="p-1 max-w-[220px] truncate">{it.proveedor}</td>
                      <td className="p-1 whitespace-nowrap">
                        {it.links.length === 0 ? <span className="text-gray-300">—</span> : it.links.map((l, i) => (
                          <a key={i} href={l.url} target="_blank" rel="noreferrer" className="text-blue-700 underline mr-2">{l.rotulo}</a>
                        ))}
                        {onConfirmar && SE_CONFIRMA.has(it.proceso) && it.links[0] && (
                          confirmadas.has(it.factura_id)
                            ? <span className="text-emerald-700 font-medium">Confirmada ✓</span>
                            : <button type="button" title="Abriste el PDF y es ésta → pasa de APP a Confirmada"
                                className="text-emerald-700 border border-emerald-300 rounded px-1.5 hover:bg-emerald-50"
                                onClick={async () => {
                                  if (await onConfirmar(it, it.links[0].url)) setConfirmadas(prev => new Set(prev).add(it.factura_id))
                                }}>✓ Confirmar</button>
                        )}
                      </td>
                      <td className="p-1 text-gray-500 break-words">{it.detalle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
