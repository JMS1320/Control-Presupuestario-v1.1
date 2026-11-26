"use client"

// 🥣 A-FEAT-1665 (c) — El PLAN DEL AÑO de la ración de una actividad, para UNA campaña (JMS 26/11: «es lo mismo que la receta pero
// específico para el año… cada cosa de la receta tiene que poder ser editada para el plan productivo del año»).
// Vacío = receta (override, nunca copia: § Default del dato real). «Este año: 0» saca el renglón ese año. El «cuándo» no va acá: es
// el 📅 plan del año de cada lote (sus tramos). La receta y el Margen no se tocan. Guarda en `public.presupuesto_variables`
// (`actividad_id` + `racion_pct_pv` para el % del peso vivo; `receta_insumo_id` + `cantidad`/`precio`/`iva_pct` por renglón).

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { parseNumeroAR } from "@/lib/format/numero"

export interface RacionReceta {
  id: string; concepto: string; modo: string; valor: number; precio: number | null; moneda: string; iva: number | null; dieta: string | null
}
export interface RacionPlanFila {
  id: string; actividad_id: string | null; receta_insumo_id: string | null; campana: string
  racion_pct_pv: number | null; cantidad: number | null; precio: number | null; iva_pct: number | null
}
export interface DatosPlanRacion {
  actividadId: string; nombre: string; campana: string; pctPv: number; insumos: RacionReceta[]; plan: RacionPlanFila[]
}

const ar = (n: number | null | undefined, d = 2) => n == null ? "" : n.toLocaleString("es-AR", { maximumFractionDigits: d })
/** El % de la mezcla se muestra en % (0,85 → 85); los kg por cabeza y día, tal cual. */
const esPct = (modo: string) => modo === "pct_racion"
const aVista = (modo: string, v: number | null | undefined) => v == null ? null : esPct(modo) ? v * 100 : v
const deVista = (modo: string, v: number) => esPct(modo) ? v / 100 : v

export function PresupuestoPlanRacion({ datos, onCerrar, onGuardado }: { datos: DatosPlanRacion | null; onCerrar: () => void; onGuardado: () => void }) {
  const [pct, setPct] = useState("")
  const [filas, setFilas] = useState<Record<string, { valor: string; precio: string; iva: string; cero: boolean }>>({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!datos) return
    const pAct = datos.plan.find(p => p.actividad_id === datos.actividadId && p.racion_pct_pv != null)
    setPct(pAct ? ar(Number(pAct.racion_pct_pv) * 100, 3) : "")
    const f: Record<string, { valor: string; precio: string; iva: string; cero: boolean }> = {}
    for (const i of datos.insumos) {
      const p = datos.plan.find(x => x.receta_insumo_id === i.id)
      f[i.id] = { cero: p?.cantidad === 0, valor: p && p.cantidad ? ar(aVista(i.modo, p.cantidad), 3) : "",
        precio: p?.precio != null ? ar(p.precio) : "", iva: p?.iva_pct != null ? ar(p.iva_pct) : "" }
    }
    setFilas(f)
  }, [datos])

  if (!datos) return null
  const num = (t: string) => t.trim() === "" ? null : parseNumeroAR(t)

  const guardar = async () => {
    setGuardando(true)
    const base = { empresa: "MSA", escenario: "base", campana: datos.campana, distribucion: "calendario", fuente_cantidad: "manual",
      fuente_precio: "manual", activo: true, updated_at: new Date().toISOString() }
    const errores: string[] = []
    const escribir = async (existente: RacionPlanFila | undefined, vacio: boolean, fila: Record<string, unknown>) => {
      const r = existente
        ? (vacio ? await supabase.from("presupuesto_variables").delete().eq("id", existente.id)
                 : await supabase.from("presupuesto_variables").update(fila).eq("id", existente.id))
        : vacio ? { error: null } : await supabase.from("presupuesto_variables").insert(fila)
      if (r.error) errores.push(r.error.message)
    }
    // % del peso vivo de la actividad
    const pAct = datos.plan.find(p => p.actividad_id === datos.actividadId && p.racion_pct_pv != null)
    const vPct = num(pct)
    await escribir(pAct, vPct == null, { ...base, concepto: `Ración ${datos.campana}`, actividad_id: datos.actividadId,
      racion_pct_pv: vPct == null ? null : vPct / 100, fundamento: "Plan del año de la ración" })
    // Cada renglón
    for (const i of datos.insumos) {
      const f = filas[i.id]; if (!f) continue
      const p = datos.plan.find(x => x.receta_insumo_id === i.id)
      const v = num(f.valor), pr = num(f.precio), iva = num(f.iva)
      const vacio = !f.cero && v == null && pr == null && iva == null
      await escribir(p, vacio, { ...base, concepto: i.concepto, receta_insumo_id: i.id,
        cantidad: f.cero ? 0 : v == null ? null : deVista(i.modo, v), precio: f.cero ? null : pr, moneda: i.moneda, iva_pct: iva,
        fundamento: "Plan del año de la ración" })
    }
    setGuardando(false)
    if (errores.length) { alert("No se pudo guardar: " + errores.join(" · ")); return }
    onGuardado(); onCerrar()
  }

  const set = (id: string, k: "valor" | "precio" | "iva", v: string) => setFilas(p => ({ ...p, [id]: { ...p[id]!, [k]: v } }))
  return (
    <Dialog open={!!datos} onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>🥣 Plan del año {datos.campana} — ración de {datos.nombre}</DialogTitle>
          <DialogDescription>Vacío = lo que dice la receta (en gris). Lo que escribas vale sólo para {datos.campana}; la receta y el Margen no cambian. Desde / hasta de cada lote: botón 📅 en el lote.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-700">% del peso vivo</span>
          <Input className="h-8 w-24 text-right text-xs" type="text" placeholder={ar(datos.pctPv * 100, 3)} value={pct} onChange={e => setPct(e.target.value)} />
          <span className="text-xs text-gray-400">receta: {ar(datos.pctPv * 100, 3)} %</span>
        </div>
        <table className="mt-2 w-full text-xs">
          <thead><tr className="border-b text-gray-500">
            <th className="py-1 text-left font-medium">Renglón</th><th className="text-left font-medium">Dieta</th>
            <th className="text-right font-medium">Cantidad</th><th className="text-right font-medium">Precio</th>
            <th className="text-right font-medium">IVA %</th><th className="text-center font-medium">Este año: 0</th>
          </tr></thead>
          <tbody>
            {datos.insumos.map(i => {
              const f = filas[i.id] ?? { valor: "", precio: "", iva: "", cero: false }
              return (
                <tr key={i.id} className={`border-b ${f.cero ? "opacity-50" : ""}`}>
                  <td className="py-1">{i.concepto}</td>
                  <td className="text-gray-500">{i.dieta ?? "todas"}</td>
                  <td className="text-right">
                    <Input className="ml-auto h-7 w-20 text-right text-xs" type="text" disabled={f.cero} placeholder={ar(aVista(i.modo, i.valor), 3)}
                      value={f.valor} onChange={e => set(i.id, "valor", e.target.value)} />
                    <span className="text-[10px] text-gray-400">{esPct(i.modo) ? "% de la mezcla" : "kg/cab/día"}</span>
                  </td>
                  <td className="text-right"><Input className="ml-auto h-7 w-24 text-right text-xs" type="text" disabled={f.cero}
                    placeholder={ar(i.precio)} value={f.precio} onChange={e => set(i.id, "precio", e.target.value)} />
                    <span className="text-[10px] text-gray-400">{i.moneda}</span></td>
                  <td className="text-right"><Input className="ml-auto h-7 w-16 text-right text-xs" type="text" disabled={f.cero}
                    placeholder={ar(i.iva)} value={f.iva} onChange={e => set(i.id, "iva", e.target.value)} /></td>
                  <td className="text-center"><input type="checkbox" checked={f.cero}
                    onChange={e => setFilas(p => ({ ...p, [i.id]: { ...f, cero: e.target.checked } }))} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCerrar}>Cancelar</Button>
          <Button size="sm" disabled={guardando} onClick={() => void guardar()}>{guardando ? "Guardando…" : "Guardar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
