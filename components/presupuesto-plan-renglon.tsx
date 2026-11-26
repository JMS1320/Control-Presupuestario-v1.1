"use client"

/**
 * ✎ **A-FEAT-1663 — el PLAN PRODUCTIVO DEL AÑO de un renglón, editado desde la grilla del presupuesto.**
 *
 * JMS 25/11: *«el plan del año para mí tiene que ser editable desde el presupuesto mismo… las variables yo las tengo que poder
 * modificar ahí»*. Cantidad × precio (en US$ por el TC de cada mes), en los meses que se marquen, para UNA campaña. Vacío = manda
 * la receta; «Este año: 0» apaga el renglón; «Quitar el plan» vuelve a la receta. Se guarda en `presupuesto_variables`
 * (`receta_insumo_id` = el renglón que reemplaza; `actividad_id` = renglón propio del plan). La receta y el Margen no se tocan.
 */
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { RenglonPlan } from "@/lib/presupuesto/costo-campana"

const MESES_CAMPANA = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
const NOMBRE = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const parseAR = (t: string) => { const n = parseFloat(String(t).replace(/\./g, "").replace(",", ".")); return isNaN(n) ? null : n }
const fmtAR = (n: number | null | undefined) => n == null ? "" : n.toLocaleString("es-AR", { maximumFractionDigits: 4 })

export interface RenglonParaPlan {
  actividadId: string
  /** null = renglón PROPIO del plan (no está en la receta). */
  insumoId: string | null
  concepto: string
  /** El plan de cada campaña, si existe. */
  plan: Record<string, RenglonPlan>
  /** Qué dice la receta (o el plan) en cada campaña, para tenerlo a la vista. */
  explicacion: Record<string, string>
}

export function EditorPlanRenglon(p: {
  abierto: boolean
  renglon: RenglonParaPlan | null
  campanas: string[]
  onCerrar: () => void
  onGuardado: () => Promise<void> | void
}) {
  const [campana, setCampana] = useState(p.campanas[0] ?? "")
  const [concepto, setConcepto] = useState("")
  const [cantidad, setCantidad] = useState("")
  const [unidad, setUnidad] = useState("")
  const [precio, setPrecio] = useState("")
  const [moneda, setMoneda] = useState("ARS")
  const [meses, setMeses] = useState<number[]>([])
  const [nota, setNota] = useState("")
  const [estado, setEstado] = useState("")

  const plan = p.renglon?.plan[campana]
  useEffect(() => {
    if (!p.renglon) return
    const pl = p.renglon.plan[campana]
    setConcepto(pl?.concepto ?? p.renglon.concepto)
    setCantidad(fmtAR(pl?.cantidad)); setUnidad(pl?.unidad ?? ""); setPrecio(fmtAR(pl?.precio))
    setMoneda(String(pl?.moneda ?? "ARS")); setMeses(pl?.meses ?? []); setEstado("")
  }, [p.renglon, campana])
  useEffect(() => { if (p.abierto) setCampana(p.campanas[0] ?? "") }, [p.abierto])

  if (!p.renglon) return null
  const r = p.renglon
  const guardar = async (cero = false) => {
    setEstado("guardando…")
    const fila: Record<string, unknown> = {
      empresa: "MSA", escenario: "base", campana, concepto: concepto.trim() || r.concepto,
      receta_insumo_id: r.insumoId, actividad_id: r.insumoId ? null : r.actividadId,
      cantidad: cero ? 0 : parseAR(cantidad), unidad: unidad.trim() || null, precio: cero ? 0 : parseAR(precio), moneda,
      meses: meses.length ? meses : null, distribucion: "calendario", fuente_cantidad: "manual", fuente_precio: "manual",
      fundamento: nota.trim() || null, activo: true, updated_at: new Date().toISOString(),
    }
    const { error } = plan
      ? await supabase.from("presupuesto_variables").update(fila).eq("id", plan.id)
      : await supabase.from("presupuesto_variables").insert(fila)
    if (error) { setEstado("no se pudo guardar: " + error.message); return }
    setEstado("✓ guardado"); await p.onGuardado(); p.onCerrar()
  }
  const quitar = async () => {
    if (!plan) return
    setEstado("quitando…")
    const { error } = await supabase.from("presupuesto_variables").delete().eq("id", plan.id)
    if (error) { setEstado("no se pudo quitar: " + error.message); return }
    await p.onGuardado(); p.onCerrar()
  }
  const total = (parseAR(cantidad) ?? 0) * (parseAR(precio) ?? 0)

  return (
    <Dialog open={p.abierto} onOpenChange={o => { if (!o) p.onCerrar() }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Plan del año · {r.concepto}</DialogTitle>
          <DialogDescription>
            Lo que va a pasar ESTA campaña. Vacío = manda la receta. No cambia la receta ni el Margen.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Campaña</span>
            {p.campanas.map(c => (
              <button key={c} type="button" onClick={() => setCampana(c)}
                className={`rounded border px-2 py-0.5 text-xs ${c === campana ? "border-blue-500 bg-blue-50 text-blue-800" : "border-gray-300 text-gray-600"}`}>
                {c}{r.plan[c] ? " ✎" : ""}
              </button>
            ))}
          </div>
          <p className="rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
            {plan ? "Hoy, con el plan: " : "Hoy manda la receta: "}{r.explicacion[campana] || "—"}
          </p>
          {!r.insumoId && (
            <label className="grid gap-1 text-xs">Concepto<Input id="plan-concepto" value={concepto} onChange={e => setConcepto(e.target.value)} /></label>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="grid gap-1 text-xs">Cantidad<Input id="plan-cantidad" type="text" className="text-right" value={cantidad} placeholder="0" onChange={e => setCantidad(e.target.value)} /></label>
            <label className="grid gap-1 text-xs">Unidad<Input id="plan-unidad" value={unidad} placeholder="rollos, ha, litros…" onChange={e => setUnidad(e.target.value)} /></label>
            <label className="grid gap-1 text-xs">Precio por unidad<Input id="plan-precio" type="text" className="text-right" value={precio} placeholder="0,00" onChange={e => setPrecio(e.target.value)} /></label>
            <label className="grid gap-1 text-xs">Moneda
              <select id="plan-moneda" className="h-9 rounded border border-gray-300 px-2" value={moneda} onChange={e => setMoneda(e.target.value)}>
                <option value="ARS">$</option><option value="USD">US$ (× TC del mes)</option>
              </select>
            </label>
          </div>
          <div className="grid gap-1 text-xs">
            <span>Meses en que se paga (vacío = los 12, parejo)</span>
            <div className="flex flex-wrap gap-1">
              {MESES_CAMPANA.map(m => (
                <button key={m} type="button" onClick={() => setMeses(ms => ms.includes(m) ? ms.filter(x => x !== m) : [...ms, m])}
                  className={`rounded border px-1.5 py-0.5 ${meses.includes(m) ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-gray-300 text-gray-500"}`}>
                  {NOMBRE[m - 1]}
                </button>
              ))}
            </div>
          </div>
          <label className="grid gap-1 text-xs">Fundamento (opcional)<Input id="plan-nota" value={nota} onChange={e => setNota(e.target.value)} /></label>
          <p className="text-xs text-gray-600">Total de la campaña: <strong>{moneda === "USD" ? "US$" : "$"} {total.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</strong>{moneda === "USD" ? " (en pesos, por el TC de cada mes)" : ""}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => guardar(false)}>Guardar el plan {campana}</Button>
            {r.insumoId && <Button size="sm" variant="outline" onClick={() => guardar(true)} title="Este año ese renglón no se gasta">Este año: 0</Button>}
            {plan && <Button size="sm" variant="outline" onClick={quitar} title="Borra el plan de esta campaña: vuelve a mandar la receta">{r.insumoId ? "Quitar el plan (vuelve la receta)" : "Borrar este renglón del plan"}</Button>}
            <span className="text-xs text-gray-500">{estado}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
