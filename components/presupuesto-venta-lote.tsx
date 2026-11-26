"use client"

// 🐂 A-FEAT-1667 — La venta presupuestada de un lote, abierta desde la celda del presupuesto y editada EN SU ORIGEN
// (`productivo.stock_lotes`: el mismo lote de Productivo → Evolución rodeo). JMS 26/11: «yo debería poder ir a la venta desde acá y
// poder editarla, pero que la edición se guarde en el origen. Si eso implica seguir dando ración, se debe actualizar sólo el plan
// productivo del año: más días, más ración». Si la fecha se corre, el último tramo del lote (el plan del año que llega a la venta)
// se estira o se acorta con ella (`tramoHastaLaVenta`); se dice qué se movió.

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { parseNumeroAR } from "@/lib/format/numero"
import { tramoHastaLaVenta } from "@/lib/productivo/tramos"

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

export function PresupuestoVentaLote({ abierto, titulo, lotes, onCerrar, onGuardado }: {
  abierto: boolean; titulo: string; lotes: VentaLoteCelda[]; onCerrar: () => void; onGuardado: () => void
}) {
  const [filas, setFilas] = useState<(VentaLoteCelda & { cantTxt: string; precioTxt: string })[]>([])
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string[]>([])
  useEffect(() => {
    setAviso([])
    setFilas(lotes.map(l => ({ ...l,
      cantTxt: fmt2(l.cantidad),
      precioTxt: l.precio_kg_override != null ? fmt2(l.precio_kg_override) : "" })))
  }, [lotes])

  const guardar = async () => {
    setGuardando(true)
    const hecho: string[] = []
    for (const f of filas) {
      const orig = lotes.find(l => l.id === f.id)!
      const cantidad = parseNumeroAR(f.cantTxt)
      const precio = f.precioTxt.trim() === "" ? null : parseNumeroAR(f.precioTxt)
      const cambios: Record<string, unknown> = {}
      if (f.fecha_venta && f.fecha_venta !== orig.fecha_venta) cambios.fecha_venta_estimada = f.fecha_venta
      if (cantidad > 0 && Math.abs(cantidad - orig.cantidad) > 0.001) cambios.cantidad = cantidad
      if (precio !== orig.precio_kg_override) cambios.precio_kg_override = precio
      if ((f.plazo_cobro ?? "") !== (orig.plazo_cobro ?? "")) cambios.plazo_cobro = f.plazo_cobro || "0"
      if (Object.keys(cambios).length === 0) continue
      const { error } = await supabase.schema("productivo").from("stock_lotes")
        .update({ ...cambios, updated_at: new Date().toISOString() }).eq("id", f.id)
      if (error) { alert("No se pudo guardar el lote: " + error.message); setGuardando(false); return }
      hecho.push(`${f.categoria}: venta guardada en el lote`)
      // Más días hasta la venta → más ración: se mueve el plan del año (tramo) que llega a la venta
      if (cambios.fecha_venta_estimada) {
        const { data: trs } = await supabase.schema("productivo").from("lote_tramos").select("id, fecha_desde, fecha_hasta").eq("lote_id", f.id)
        const mover = tramoHastaLaVenta((trs || []) as any[], orig.fecha_venta, String(cambios.fecha_venta_estimada))
        if (mover) {
          const { error: e2 } = await supabase.schema("productivo").from("lote_tramos")
            .update({ fecha_hasta: mover.hastaNueva, updated_at: new Date().toISOString() }).eq("id", mover.id)
          hecho.push(e2 ? `⚠️ no se pudo mover el plan del año: ${e2.message}`
            : `plan del año (ración): hasta ${dmy(mover.hastaVieja)} → ${dmy(mover.hastaNueva)}`)
        } else if ((trs || []).length) {
          hecho.push("el plan del año (ración) no se movió: no llegaba hasta la venta")
        }
      }
    }
    setGuardando(false)
    setAviso(hecho.length ? hecho : ["No había cambios."])
    onGuardado()
  }

  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>🐂 {titulo}</DialogTitle>
          <DialogDescription>Se guarda en el lote (Productivo → Evolución rodeo). Si corrés la fecha de venta, la ración del plan del año se corre con ella.</DialogDescription>
        </DialogHeader>
        <table className="w-full text-xs">
          <thead><tr className="border-b text-gray-500">
            <th className="py-1 text-left font-medium">Lote</th><th className="text-left font-medium">Fecha de venta</th>
            <th className="text-right font-medium">Cabezas</th>
            <th className="text-right font-medium" title="Vacío = el precio de la tabla de precios de hacienda">$/kg (vacío = tabla)</th>
            <th className="text-left font-medium" title="Días de cobro, separados por coma (ej. 0,30)">Plazo</th>
            <th className="text-right font-medium">Monto hoy</th>
          </tr></thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id} className="border-b">
                <td className="py-1">{f.categoria}</td>
                <td><input type="date" className="h-7 rounded border px-1 text-xs" value={f.fecha_venta ?? ""}
                  onChange={e => setFilas(p => p.map((x, j) => j === i ? { ...x, fecha_venta: e.target.value } : x))} /></td>
                <td><Input className="h-7 w-20 text-right text-xs" type="text" value={f.cantTxt}
                  onChange={e => setFilas(p => p.map((x, j) => j === i ? { ...x, cantTxt: e.target.value } : x))} /></td>
                <td><Input className="h-7 w-24 text-right text-xs" type="text" placeholder="tabla" value={f.precioTxt}
                  onChange={e => setFilas(p => p.map((x, j) => j === i ? { ...x, precioTxt: e.target.value } : x))} /></td>
                <td><Input className="h-7 w-16 text-xs" type="text" value={f.plazo_cobro ?? ""}
                  onChange={e => setFilas(p => p.map((x, j) => j === i ? { ...x, plazo_cobro: e.target.value } : x))} /></td>
                <td className="text-right text-gray-600">$ {Math.round(f.monto).toLocaleString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {aviso.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-emerald-800">{aviso.map((a, i) => <li key={i}>{a}</li>)}</ul>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCerrar}>Cerrar</Button>
          <Button size="sm" disabled={guardando} onClick={() => void guardar()}>{guardando ? "Guardando…" : "Guardar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
