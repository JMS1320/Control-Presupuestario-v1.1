"use client"

// 🐂 A-FEAT-1667 — La venta presupuestada abierta desde la celda del presupuesto se edita con EL EDITOR DE LOTE DE PRODUCTIVO
// (JMS 26/11: «dale con el editor de Productivo»): el mismo de Productivo → Evolución rodeo → Editar, con peso a la fecha, desbaste,
// CZ, precio de tabla o manual, IVA, IIBB, plazo y el plan del año del lote. Se guarda en el lote (`productivo.stock_lotes`) con la
// misma escritura (`guardarLote`), y si corrés la fecha de venta el período del plan del año que llega a ella se corre con ella.
// Antes (26/11 mañana) esta ventana tenía sus propios campos: duplicaba el editor y no mostraba kg, desbaste ni CZ.

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EditorLoteHacienda } from "@/components/panel-lotes-hacienda"

export interface VentaLoteCelda {
  id: string
  categoria: string
  cantidad: number
  fecha_venta: string | null
  precio_kg_override: number | null
  plazo_cobro: string | null
  monto: number
}

const fmt2 = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dmy = (f: string) => f.split("-").reverse().join("/")

/**
 * `lotes` = los lotes que forman la plata de esa celda (si hay uno solo se abre directo su editor).
 * `nuevaCategoria` = «＋ venta»: abre el editor con un lote nuevo de esa categoría.
 */
export function PresupuestoVentaLote({ abierto, titulo, lotes, nuevaCategoria, onCerrar, onGuardado }: {
  abierto: boolean; titulo: string; lotes: VentaLoteCelda[]; nuevaCategoria?: string | null; onCerrar: () => void; onGuardado: () => void
}) {
  /** El lote abierto en el editor ("__nuevo__" = lote nuevo). */
  const [editando, setEditando] = useState<string | null>(null)
  // Se re-arma sólo cuando cambia QUÉ se abrió (no en cada recarga de la grilla: cerraría el editor a mitad de una edición).
  const claveLotes = lotes.map(l => l.id).join(",")
  useEffect(() => {
    if (!abierto) { setEditando(null); return }
    setEditando(nuevaCategoria ? "__nuevo__" : lotes.length === 1 ? lotes[0]!.id : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, claveLotes, nuevaCategoria])

  if (!abierto) return null
  // Con un solo lote (o una venta nueva) el editor va directo: cerrarlo cierra todo.
  const directo = !!nuevaCategoria || lotes.length === 1
  if (editando) return (
    <EditorLoteHacienda loteId={editando === "__nuevo__" ? null : editando} nuevaCategoria={editando === "__nuevo__" ? nuevaCategoria : null}
      onGuardado={onGuardado} onCerrar={() => (directo ? onCerrar() : setEditando(null))} />
  )
  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>🐂 {titulo}</DialogTitle>
          <DialogDescription>Los lotes que forman esta venta. Cada uno se edita en el editor de Productivo (peso, desbaste, CZ, precio, plazo y su plan del año).</DialogDescription>
        </DialogHeader>
        <table className="w-full text-xs">
          <thead><tr className="border-b text-gray-500">
            <th className="py-1 text-left font-medium">Lote</th><th className="text-left font-medium">Venta</th>
            <th className="text-right font-medium">Cabezas</th><th className="text-right font-medium">$/kg</th>
            <th className="text-left font-medium">Plazo</th><th className="text-right font-medium">Este mes</th><th />
          </tr></thead>
          <tbody>
            {lotes.map(l => (
              <tr key={l.id} className="border-b">
                <td className="py-1">{l.categoria}</td>
                <td>{l.fecha_venta ? dmy(l.fecha_venta) : "—"}</td>
                <td className="text-right">{fmt2(l.cantidad)}</td>
                <td className="text-right">{l.precio_kg_override != null ? fmt2(l.precio_kg_override) : <span className="text-gray-400">tabla</span>}</td>
                <td>{l.plazo_cobro ?? "0"}</td>
                <td className="text-right">$ {Math.round(l.monto).toLocaleString("es-AR")}</td>
                <td className="text-right"><Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditando(l.id)}>✏️ Editar lote</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end pt-2"><Button variant="outline" size="sm" onClick={onCerrar}>Cerrar</Button></div>
      </DialogContent>
    </Dialog>
  )
}
