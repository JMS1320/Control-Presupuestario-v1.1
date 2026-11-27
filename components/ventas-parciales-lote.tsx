"use client"

/**
 * ✂️ LAS VENTAS PARCIALES de un lote, dentro del editor del lote (Productivo, y el mismo editor que se abre desde la grilla del presupuesto) —
 * A-FEAT-1675 (JMS 27/11: «dividir la venta presupuestada… en 2 ventas… y luego convertirlo en una venta firme editando los datos reales» ·
 * «poder accionarlo también desde presupuesto»).
 *
 * Cada parcial: fecha, cabezas y, si se quiere, peso, precio y plazo (vacío = los del lote). El resto del lote sigue a la fecha principal.
 * «Confirmar» abre la confirmación real (`ModalConfirmarVentaHacienda`) precargada; al confirmar, la parcial queda atada a la venta firme
 * (`venta_id`) y deja de proyectarse. Se guarda en `productivo.lote_ventas_plan` (script 322), aparte del botón Guardar del lote.
 */
import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import { ModalConfirmarVentaHacienda, type LoteAConfirmar } from "@/components/modal-confirmar-venta-hacienda"

type Fila = { id: string | null; fecha_venta: string; cabezas: string; peso_kg: string; precio_kg: string; plazo_cobro: string; venta_id: string | null }
const vacia = (): Fila => ({ id: null, fecha_venta: "", cabezas: "", peso_kg: "", precio_kg: "", plazo_cobro: "", venta_id: null })
const dmy = (f: string) => f.split("-").reverse().join("/")

export function VentasParcialesLote({ lote, onCambio }: {
  /** El lote tal como está en el editor (id, categoría, cantidad, fecha de venta, peso, precio, desbaste, CZ, plazo, empresa). */
  lote: any
  onCambio?: () => void
}) {
  const [filas, setFilas] = useState<Fila[]>([])
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [aConfirmar, setAConfirmar] = useState<{ lote: LoteAConfirmar; parcialId: string } | null>(null)

  const cargar = useCallback(async () => {
    if (!lote?.id) return
    const { data } = await supabase.schema("productivo").from("lote_ventas_plan").select("*").eq("lote_id", lote.id).order("fecha_venta")
    setFilas(((data || []) as any[]).map(p => ({
      id: p.id, fecha_venta: p.fecha_venta, cabezas: fmtNumeroAR(Number(p.cabezas), 0),
      peso_kg: p.peso_kg != null ? fmtNumeroAR(Number(p.peso_kg), 0) : "", precio_kg: p.precio_kg != null ? fmtNumeroAR(Number(p.precio_kg), 2) : "",
      plazo_cobro: p.plazo_cobro ?? "", venta_id: p.venta_id ?? null,
    })))
  }, [lote?.id])
  useEffect(() => { void cargar() }, [cargar])

  if (!lote?.id) return <p className="text-[11px] text-gray-500">Guardá el lote para poder dividir su venta en ventas parciales.</p>
  const num = (t: string) => (t.trim() === "" ? null : parseNumeroAR(t))
  const total = Number(lote.cantidad) || 0
  const enParciales = filas.filter(f => !f.venta_id).reduce((t, f) => t + (num(f.cabezas) ?? 0), 0)
  const resto = total - enParciales
  const set = (i: number, c: Partial<Fila>) => setFilas(p => p.map((x, j) => (j === i ? { ...x, ...c } : x)))

  const guardar = async () => {
    setAviso(null)
    if (resto < -0.001) { setAviso(`Las ventas parciales suman ${enParciales} cabezas y el lote tiene ${total}.`); return }
    const malas = filas.filter(f => !f.venta_id && (!f.fecha_venta || !(num(f.cabezas)! > 0)))
    if (malas.length) { setAviso("Cada venta parcial necesita fecha y cabezas."); return }
    setGuardando(true)
    try {
      const P = supabase.schema("productivo")
      const { data: actuales } = await P.from("lote_ventas_plan").select("id, venta_id").eq("lote_id", lote.id)
      const ids = new Set(filas.filter(f => f.id).map(f => f.id))
      // Las que se quitaron (y no estaban confirmadas) se borran; las confirmadas no se tocan desde acá
      const quitar = ((actuales || []) as any[]).filter(a => !ids.has(a.id) && !a.venta_id).map(a => a.id)
      if (quitar.length) { const { error } = await P.from("lote_ventas_plan").delete().in("id", quitar); if (error) throw error }
      for (const f of filas.filter(x => !x.venta_id)) {
        const fila = { lote_id: lote.id, fecha_venta: f.fecha_venta, cabezas: num(f.cabezas), peso_kg: num(f.peso_kg), precio_kg: num(f.precio_kg),
          plazo_cobro: f.plazo_cobro.trim() || null, updated_at: new Date().toISOString() }
        const { error } = f.id ? await P.from("lote_ventas_plan").update(fila).eq("id", f.id) : await P.from("lote_ventas_plan").insert(fila)
        if (error) throw error
      }
      await cargar(); onCambio?.()
      setAviso("✓ Ventas parciales guardadas")
    } catch (e) { setAviso("No se pudo guardar: " + (e as Error).message) }
    finally { setGuardando(false) }
  }

  const confirmar = (f: Fila) => {
    if (!f.id) { setAviso("Guardá las ventas parciales antes de confirmar una."); return }
    setAConfirmar({ parcialId: f.id, lote: {
      id: lote.id, categoria: lote.categoria, cabezas: num(f.cabezas) ?? 0,
      pesoProyectado: num(f.peso_kg) ?? (Number(lote.peso_base_kg) || 0),
      precioProyectado: num(f.precio_kg) ?? (Number(lote.precio_kg_override) || 0),
      pctDesbaste: Number(lote.pct_desbaste) || 0, pctCz: Number(lote.pct_cz) || 0,
      plazoCobro: f.plazo_cobro || lote.plazo_cobro || null, fechaVentaEstimada: f.fecha_venta,
      empresa: lote.empresa || "MSA", esGordo: /gordo|novillo|vaquillona engorde/i.test(String(lote.categoria)),
    } })
  }

  return (
    <div className="rounded border border-emerald-200 bg-emerald-50/40 p-2">
      <p className="text-[11px] font-medium text-emerald-900">✂️ Ventas parciales presupuestadas</p>
      <p className="mb-1 text-[10px] text-gray-600">
        Para vender el lote en partes: cada parcial con su fecha y cabezas (peso, precio y plazo vacíos = los del lote). El resto
        (<strong>{fmtNumeroAR(Math.max(0, resto), 0)}</strong> de {fmtNumeroAR(total, 0)} cab) se vende en la fecha del lote{lote.fecha_venta_estimada ? ` (${dmy(String(lote.fecha_venta_estimada))})` : ""}.
        Desde cada fecha de venta la ración come con las cabezas que quedan. «Confirmar» la pasa a venta firme con los datos reales.
      </p>
      {filas.length > 0 && (
        <table className="w-full text-xs">
          <thead><tr className="text-[10px] text-gray-500">
            <th className="text-left font-medium">Fecha</th><th className="text-left font-medium">Cabezas</th><th className="text-left font-medium">Peso (kg)</th>
            <th className="text-left font-medium">Precio $/kg</th><th className="text-left font-medium">Plazo</th><th />
          </tr></thead>
          <tbody>
            {filas.map((f, i) => f.venta_id ? (
              <tr key={f.id ?? i}><td colSpan={6} className="py-0.5 text-emerald-800">✓ {dmy(f.fecha_venta)} · {f.cabezas} cab — <strong>confirmada</strong> (venta firme)</td></tr>
            ) : (
              <tr key={f.id ?? `n${i}`}>
                <td className="pr-1"><input type="date" className="h-7 rounded border px-1 text-xs" value={f.fecha_venta} onChange={e => set(i, { fecha_venta: e.target.value })} /></td>
                <td className="pr-1"><Input className="h-7 w-16 text-xs" value={f.cabezas} onChange={e => set(i, { cabezas: e.target.value })} /></td>
                <td className="pr-1"><Input className="h-7 w-20 text-xs" placeholder="del lote" value={f.peso_kg} onChange={e => set(i, { peso_kg: e.target.value })} /></td>
                <td className="pr-1"><Input className="h-7 w-20 text-xs" placeholder={lote.precio_kg_override ? fmtNumeroAR(Number(lote.precio_kg_override), 2) : "del lote"} value={f.precio_kg} onChange={e => set(i, { precio_kg: e.target.value })} /></td>
                <td className="pr-1"><Input className="h-7 w-16 text-xs" placeholder={lote.plazo_cobro || "0"} value={f.plazo_cobro} onChange={e => set(i, { plazo_cobro: e.target.value })} /></td>
                <td className="whitespace-nowrap">
                  {f.id && <Button type="button" size="sm" variant="outline" className="h-6 border-emerald-400 text-[10px] text-emerald-800" onClick={() => confirmar(f)}>Confirmar →</Button>}
                  <button type="button" className="ml-1 text-[10px] text-red-700 hover:underline" onClick={() => setFilas(p => p.filter((_, j) => j !== i))}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-1 flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setFilas(p => [...p, vacia()])}>＋ venta parcial</Button>
        <Button type="button" size="sm" className="h-6 text-[10px]" disabled={guardando} onClick={() => void guardar()}>{guardando ? "Guardando…" : "Guardar ventas parciales"}</Button>
        {aviso && <span className={`text-[10px] ${aviso.startsWith("✓") ? "text-emerald-700" : "text-red-700"}`}>{aviso}</span>}
      </div>
      <ModalConfirmarVentaHacienda lote={aConfirmar?.lote ?? null} parcialId={aConfirmar?.parcialId ?? null}
        onCerrar={() => setAConfirmar(null)} onConfirmado={() => { void cargar(); onCambio?.() }} />
    </div>
  )
}
