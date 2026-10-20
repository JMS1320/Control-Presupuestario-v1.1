'use client'

/**
 * 📋 El INFORME del lote del buscador de PDFs (A-FEAT-1287): una línea por factura, agrupada por lo
 * que pasó —ya estaba en la carpeta, bajada del mail, a revisar, no encontrada…— con el link a cada
 * archivo. Lo mismo va en el mail resumen; acá se ve al terminar, sin esperar el mail.
 */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { agruparInforme, type ItemInforme } from '@/lib/gas-pdf/lote'

interface Props {
  open: boolean
  informe: ItemInforme[]
  onClose: () => void
}

export function InformeLote({ open, informe, onClose }: Props) {
  const grupos = agruparInforme(informe)
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
