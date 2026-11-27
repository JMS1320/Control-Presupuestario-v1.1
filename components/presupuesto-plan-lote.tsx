"use client"

/**
 * 📅 EL PLAN DEL AÑO DEL LOTE — todo junto, cada cosa con su fecha (A-FEAT-1670).
 *
 * JMS 27/11, en Presupuesto → 🌾 Costos de producción → Cría → Ternero al Pie: *«pensé que abriendo plan del año vería las cosas que están
 * en el plan del año… sólo me permite modificar receta y yo no quería modificar receta… el plan del año debería mostrar cuál es el plan del
 * año, cada cosa con su fecha… y yo debería poder cambiar una o la otra»* · *«a, por lote. dale, desarrollalo»*.
 *
 * Muestra cada TRAMO del lote (actividad, desde / hasta — `productivo.lote_tramos`) y adentro cada RENGLÓN de la ración de esa actividad
 * para la campaña: lo que dice la receta, lo que dice el plan de la actividad (si hay) y lo de ESTE LOTE — cuánto, precio, IVA, desde /
 * hasta (dentro del tramo) o «este año no». Lo del lote se guarda en `presupuesto_variables` con `lote_id` (script 319): NUNCA toca la receta.
 */
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import { esModoRacion, campanaDeMes } from "@/lib/presupuesto/costo-campana"
import { insumosDeDieta } from "@/lib/productivo/actividades"

type Fila = { valor: string; precio: string; iva: string; desde: string; hasta: string; cero: boolean }
const dmy = (f?: string | null) => (f ? String(f).slice(0, 10).split("-").reverse().join("/") : "—")
const esPct = (modo: string) => modo === "pct_racion"
const aVista = (modo: string, v: number) => (esPct(modo) ? v * 100 : v)
const desdeVista = (modo: string, v: number) => (esPct(modo) ? v / 100 : v)
const unidadVista = (modo: string, u: string | null) => (esPct(modo) ? "% de la mezcla" : `${u || "kg"}/cab/día`)

export function PresupuestoPlanLote({ lote, onCerrar, onGuardado }: {
  lote: { id: string; nombre: string } | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [tramos, setTramos] = useState<any[]>([])
  const [acts, setActs] = useState<any[]>([])
  const [ins, setIns] = useState<any[]>([])
  const [planAct, setPlanAct] = useState<any[]>([])
  const [planLote, setPlanLote] = useState<any[]>([])
  const [stock, setStock] = useState<Map<string, string>>(new Map())
  const [fechas, setFechas] = useState<Record<string, { desde: string; hasta: string }>>({})
  const [filas, setFilas] = useState<Record<string, Fila>>({})   // `${tramoId}|${insumoId}`

  useEffect(() => {
    if (!lote) return
    void (async () => {
      setCargando(true)
      try {
        const P = supabase.schema("productivo")
        const { data: tr } = await P.from("lote_tramos").select("id, actividad_id, fecha_desde, fecha_hasta, orden").eq("lote_id", lote.id).order("fecha_desde")
        const idsAct = Array.from(new Set(((tr || []) as any[]).map(t => String(t.actividad_id))))
        const [{ data: ac }, { data: ai }, { data: pv }, { data: st }] = await Promise.all([
          P.from("actividades").select("id, nombre, dieta_default, racion_pct_pv").in("id", idsAct.length ? idsAct : ["00000000-0000-0000-0000-000000000000"]),
          P.from("actividad_insumos").select("*").in("actividad_id", idsAct.length ? idsAct : ["00000000-0000-0000-0000-000000000000"]).order("orden"),
          supabase.from("presupuesto_variables").select("*").eq("empresa", "MSA").eq("activo", true).or(`lote_id.eq.${lote.id},lote_id.is.null`),
          P.from("stock_insumos").select("id, producto"),
        ])
        const rac = ((ai || []) as any[]).filter(i => esModoRacion(i.modo))
        const idsRac = new Set(rac.map(i => String(i.id)))
        const pvs = (pv || []) as any[]
        const pLote = pvs.filter(p => p.lote_id === lote.id && p.receta_insumo_id && idsRac.has(String(p.receta_insumo_id)))
        setTramos((tr || []) as any[]); setActs((ac || []) as any[]); setIns(rac)
        setPlanAct(pvs.filter(p => !p.lote_id && (idsAct.includes(String(p.actividad_id)) || (p.receta_insumo_id && idsRac.has(String(p.receta_insumo_id))))))
        setPlanLote(pLote)
        setStock(new Map(((st || []) as any[]).map(s => [String(s.id), String(s.producto)])))
        const fe: Record<string, { desde: string; hasta: string }> = {}
        for (const t of (tr || []) as any[]) fe[t.id] = { desde: t.fecha_desde, hasta: t.fecha_hasta }
        setFechas(fe)
        const f: Record<string, Fila> = {}
        for (const t of (tr || []) as any[]) {
          const camp = campanaDeMes(String(t.fecha_desde).slice(0, 7))
          for (const i of rac.filter(x => x.actividad_id === t.actividad_id)) {
            const p = pLote.find(x => String(x.receta_insumo_id) === String(i.id) && String(x.campana) === camp)
            f[`${t.id}|${i.id}`] = {
              cero: p?.cantidad === 0 || p?.cantidad === "0",
              valor: p && p.cantidad != null && Number(p.cantidad) !== 0 ? fmtNumeroAR(aVista(i.modo, Number(p.cantidad)), 3) : "",
              precio: p?.precio != null ? fmtNumeroAR(Number(p.precio), 2) : "",
              iva: p?.iva_pct != null ? fmtNumeroAR(Number(p.iva_pct), 1) : "",
              desde: p?.fecha_desde ?? "", hasta: p?.fecha_hasta ?? "",
            }
          }
        }
        setFilas(f)
      } finally { setCargando(false) }
    })()
  }, [lote])

  const errores = useMemo(() => {
    const e: string[] = []
    for (const t of tramos) {
      const fe = fechas[t.id]; if (!fe) continue
      if (!fe.desde || !fe.hasta || fe.desde >= fe.hasta) e.push(`${acts.find(a => a.id === t.actividad_id)?.nombre ?? "Tramo"}: «desde» tiene que ser antes que «hasta»`)
      for (const i of ins.filter(x => x.actividad_id === t.actividad_id)) {
        const f = filas[`${t.id}|${i.id}`]; if (!f) continue
        const d = f.desde || fe.desde, h = f.hasta || fe.hasta
        if (d >= h) e.push(`${i.concepto}: «desde» tiene que ser antes que «hasta»`)
        if ((f.desde && (f.desde < fe.desde || f.desde > fe.hasta)) || (f.hasta && (f.hasta < fe.desde || f.hasta > fe.hasta)))
          e.push(`${i.concepto}: las fechas tienen que estar dentro del tramo (${dmy(fe.desde)} → ${dmy(fe.hasta)})`)
      }
    }
    return e
  }, [tramos, fechas, filas, ins, acts])

  if (!lote) return null
  const num = (t: string) => (t.trim() === "" ? null : parseNumeroAR(t))
  const setF = (k: string, c: Partial<Fila>) => setFilas(p => ({ ...p, [k]: { ...p[k]!, ...c } }))

  const guardar = async () => {
    setGuardando(true)
    const errs: string[] = []
    try {
      for (const t of tramos) {
        const fe = fechas[t.id]
        if (fe && (fe.desde !== t.fecha_desde || fe.hasta !== t.fecha_hasta)) {
          const { error } = await supabase.schema("productivo").from("lote_tramos").update({ fecha_desde: fe.desde, fecha_hasta: fe.hasta, updated_at: new Date().toISOString() }).eq("id", t.id)
          if (error) errs.push(error.message)
        }
        // La campaña sale del tramo YA guardado (si se movió de campaña, el plan del lote viaja con el tramo)
        const camp = campanaDeMes(String(fe?.desde || t.fecha_desde).slice(0, 7))
        for (const i of ins.filter(x => x.actividad_id === t.actividad_id)) {
          const f = filas[`${t.id}|${i.id}`]; if (!f) continue
          const v = num(f.valor), pr = num(f.precio), iva = num(f.iva)
          const vacio = !f.cero && v == null && pr == null && iva == null && !f.desde && !f.hasta
          const existente = planLote.find(x => String(x.receta_insumo_id) === String(i.id) && (String(x.campana) === camp || String(x.campana) === campanaDeMes(String(t.fecha_desde).slice(0, 7))))
          const fila = { empresa: "MSA", escenario: "base", campana: camp, concepto: `${i.concepto} · ${lote.nombre}`, receta_insumo_id: i.id, lote_id: lote.id,
            cantidad: f.cero ? 0 : v == null ? null : desdeVista(i.modo, v), precio: pr, iva_pct: iva, fecha_desde: f.desde || null, fecha_hasta: f.hasta || null,
            distribucion: "calendario", fuente_cantidad: "manual", fuente_precio: "manual", activo: true, fundamento: "Plan del año del lote",
            updated_at: new Date().toISOString() }
          const r = existente
            ? (vacio ? await supabase.from("presupuesto_variables").delete().eq("id", existente.id) : await supabase.from("presupuesto_variables").update(fila).eq("id", existente.id))
            : vacio ? { error: null } : await supabase.from("presupuesto_variables").insert(fila)
          if (r.error) errs.push(`${i.concepto}: ${r.error.message}`)
        }
      }
    } finally { setGuardando(false) }
    if (errs.length) { alert("No se pudo guardar todo:\n" + errs.join("\n")); return }
    onGuardado(); onCerrar()
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>📅 Plan del año — {lote.nombre}</DialogTitle>
          <DialogDescription>
            Lo que va a pasar este año con este lote: cada actividad con su desde / hasta y, adentro, cada renglón de la ración con su fecha.
            Lo que cambies acá vale sólo para ESTE lote y ESTE año: la receta no cambia (eso es «✏️ receta»). Vacío = lo que dice la receta (o el plan de la actividad).
          </DialogDescription>
        </DialogHeader>
        {cargando && <p className="text-sm text-gray-500">Cargando…</p>}
        {!cargando && tramos.length === 0 && <p className="text-sm text-gray-500">Este lote no tiene plan del año (tramos).</p>}
        {!cargando && tramos.map(t => {
          const a = acts.find(x => x.id === t.actividad_id)
          const fe = fechas[t.id] || { desde: t.fecha_desde, hasta: t.fecha_hasta }
          const camp = campanaDeMes(String(fe.desde).slice(0, 7))
          const dietaPlan = planAct.find(p => String(p.actividad_id) === String(t.actividad_id) && p.dieta && String(p.campana) === camp)?.dieta ?? null
          const dieta = dietaPlan ?? a?.dieta_default ?? null
          const deAct = ins.filter(x => x.actividad_id === t.actividad_id)
          const enDieta = new Set(insumosDeDieta(deAct, dieta).map((x: any) => String(x.id)))
          const pctPvPlan = planAct.find(p => String(p.actividad_id) === String(t.actividad_id) && p.racion_pct_pv != null && String(p.campana) === camp)?.racion_pct_pv
          return (
            <div key={t.id} className="rounded border p-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{a?.nombre ?? "Actividad"}</span>
                <span className="text-xs text-gray-500">campaña {camp}</span>
                <label className="text-xs text-gray-500">desde</label>
                <input type="date" className="h-7 rounded border px-1 text-xs" value={fe.desde} onChange={e => setFechas(p => ({ ...p, [t.id]: { ...fe, desde: e.target.value } }))} />
                <label className="text-xs text-gray-500">hasta</label>
                <input type="date" className="h-7 rounded border px-1 text-xs" value={fe.hasta} onChange={e => setFechas(p => ({ ...p, [t.id]: { ...fe, hasta: e.target.value } }))} />
                <span className="text-[11px] text-gray-500">
                  ración {fmtNumeroAR(Number(pctPvPlan ?? a?.racion_pct_pv ?? 0) * 100, 2)} % del peso vivo{pctPvPlan != null ? " (plan de la actividad)" : " (receta)"}
                  {dieta ? ` · dieta: ${dieta}` : ""}
                </span>
              </div>
              {deAct.length === 0 ? <p className="mt-1 text-xs text-gray-500">Esta actividad no tiene renglones de ración.</p> : (
                <table className="mt-1 w-full text-xs">
                  <thead><tr className="border-b text-[10px] text-gray-500">
                    <th className="py-1 text-left font-medium">Renglón</th>
                    <th className="text-left font-medium">Receta</th>
                    <th className="text-left font-medium">Plan de la actividad</th>
                    <th className="text-left font-medium">Este lote: cuánto</th>
                    <th className="text-left font-medium">Precio</th>
                    <th className="text-left font-medium">IVA %</th>
                    <th className="text-left font-medium">Come desde</th>
                    <th className="text-left font-medium">hasta</th>
                    <th className="text-left font-medium">Este año no</th>
                  </tr></thead>
                  <tbody>
                    {deAct.map(i => {
                      const k = `${t.id}|${i.id}`, f = filas[k]; if (!f) return null
                      const pA = planAct.find(p => String(p.receta_insumo_id) === String(i.id) && String(p.campana) === camp)
                      const fuera = !enDieta.has(String(i.id))
                      const tienePlan = f.cero || !!f.valor || !!f.precio || !!f.iva || !!f.desde || !!f.hasta
                      return (
                        <tr key={k} className={`border-b align-top ${fuera ? "opacity-50" : ""}`}>
                          <td className="py-1 pr-2">
                            <span className="font-medium">{i.concepto}</span>
                            <span className={`ml-1 rounded px-1 text-[9px] ${tienePlan ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}>{tienePlan ? "plan del lote" : pA ? "plan de la actividad" : "receta"}</span>
                            {i.insumo_stock_id && <span className="block text-[10px] text-gray-500">del stock: {stock.get(String(i.insumo_stock_id)) ?? "—"}</span>}
                            {fuera && <span className="block text-[10px] text-amber-700">no está en la dieta de este año ({dieta})</span>}
                          </td>
                          <td className="pr-2 text-gray-600">{fmtNumeroAR(aVista(i.modo, Number(i.valor)), 2)} {unidadVista(i.modo, i.unidad)}{i.precio_unitario != null ? ` · ${i.moneda === "USD" ? "US$" : "$"} ${fmtNumeroAR(Number(i.precio_unitario), 2)}` : ""}{i.iva_pct != null ? ` · IVA ${fmtNumeroAR(Number(i.iva_pct), 1)} %` : ""}</td>
                          <td className="pr-2 text-gray-600">{pA ? (pA.cantidad === 0 || pA.cantidad === "0" ? "este año 0" : [pA.cantidad != null ? `${fmtNumeroAR(aVista(i.modo, Number(pA.cantidad)), 2)}` : null, pA.precio != null ? `$ ${fmtNumeroAR(Number(pA.precio), 2)}` : null].filter(Boolean).join(" · ") || "—") : "—"}</td>
                          <td className="pr-1"><input className="h-7 w-20 rounded border px-1 text-xs" placeholder={fmtNumeroAR(aVista(i.modo, Number(pA?.cantidad ?? i.valor)), 2)} disabled={f.cero} value={f.valor} onChange={e => setF(k, { valor: e.target.value })} /></td>
                          <td className="pr-1"><input className="h-7 w-20 rounded border px-1 text-xs" placeholder={i.precio_unitario != null ? fmtNumeroAR(Number(pA?.precio ?? i.precio_unitario), 2) : ""} disabled={f.cero} value={f.precio} onChange={e => setF(k, { precio: e.target.value })} /></td>
                          <td className="pr-1"><input className="h-7 w-14 rounded border px-1 text-xs" placeholder={i.iva_pct != null ? fmtNumeroAR(Number(i.iva_pct), 1) : ""} disabled={f.cero} value={f.iva} onChange={e => setF(k, { iva: e.target.value })} /></td>
                          <td className="pr-1">
                            <input type="date" className="h-7 rounded border px-1 text-xs" disabled={f.cero} value={f.desde} min={fe.desde} max={fe.hasta} onChange={e => setF(k, { desde: e.target.value })} />
                            {!f.desde && <span className="block text-[10px] text-gray-400">{dmy(fe.desde)} (el tramo)</span>}
                          </td>
                          <td className="pr-1">
                            <input type="date" className="h-7 rounded border px-1 text-xs" disabled={f.cero} value={f.hasta} min={fe.desde} max={fe.hasta} onChange={e => setF(k, { hasta: e.target.value })} />
                            {!f.hasta && <span className="block text-[10px] text-gray-400">{dmy(fe.hasta)} (el tramo)</span>}
                          </td>
                          <td><input type="checkbox" checked={f.cero} onChange={e => setF(k, { cero: e.target.checked })} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
        {errores.length > 0 && <ul className="list-disc pl-5 text-xs text-red-700">{errores.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        <p className="text-[11px] text-gray-500">«hasta» no se come (igual que el tramo): hasta el 01/03 = come hasta el 28/02. Para cambiar la receta permanente: «✏️ receta».</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCerrar}>Cancelar</Button>
          <Button size="sm" disabled={guardando || cargando || errores.length > 0} onClick={() => void guardar()}>{guardando ? "Guardando…" : "Guardar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
