'use client'

/**
 * 📋 El INFORME del lote del buscador de PDFs (A-FEAT-1287): una línea por factura, agrupada por lo
 * que pasó —ya estaba en la carpeta, bajada del mail, a revisar, no encontrada…— con el link a cada
 * archivo. Lo mismo va en el mail resumen; acá se ve al terminar, sin esperar el mail.
 */
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { agruparInforme, type ItemInforme } from '@/lib/gas-pdf/lote'

interface Props {
  open: boolean
  informe: ItemInforme[]
  onClose: () => void
  /** ✓ Confirmar desde el informe: lo bajado del mail o tomado de la carpeta queda en APP; abrís el
   *  PDF acá mismo y, si es ésa, pasa a Confirmada. Devuelve true si se guardó. */
  onConfirmar?: (item: ItemInforme, url: string) => Promise<boolean>
}

/** Sólo lo que la app vinculó sola (APP) se confirma desde acá: lo «a revisar» tiene su propio paso */
const SE_CONFIRMA = new Set(['mail', 'carpeta'])

export function InformeLote({ open, informe, onClose, onConfirmar }: Props) {
  const grupos = agruparInforme(informe)
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set())
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Informe de la búsqueda — {informe.length} factura(s)</DialogTitle>
          <DialogDescription>Qué pasó con cada una, y el archivo para abrirlo.</DialogDescription>
        </DialogHeader>
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
