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

type Periodo = { valor: string; precio: string; iva: string; desde: string; hasta: string }
/** Un renglón de la ración en el plan del lote: uno o varios PERÍODOS (cambios de ración), o «este año no». */
type Fila = { cero: boolean; periodos: Periodo[] }
const periodoVacio = (): Periodo => ({ valor: "", precio: "", iva: "", desde: "", hasta: "" })
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
            const ps = pLote.filter(x => String(x.receta_insumo_id) === String(i.id) && String(x.campana) === camp)
              .sort((a, b) => String(a.fecha_desde ?? "").localeCompare(String(b.fecha_desde ?? "")))
            const cero = ps.length > 0 && ps.every(p => p.cantidad != null && Number(p.cantidad) === 0)
            f[`${t.id}|${i.id}`] = {
              cero,
              periodos: cero || !ps.length ? [periodoVacio()] : ps.map(p => ({
                valor: p.cantidad != null && Number(p.cantidad) !== 0 ? fmtNumeroAR(aVista(i.modo, Number(p.cantidad)), 3) : "",
                precio: p.precio != null ? fmtNumeroAR(Number(p.precio), 2) : "",
                iva: p.iva_pct != null ? fmtNumeroAR(Number(p.iva_pct), 1) : "",
                desde: p.fecha_desde ?? "", hasta: p.fecha_hasta ?? "",
              })),
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
        const f = filas[`${t.id}|${i.id}`]; if (!f || f.cero) continue
        const usados = f.periodos.filter(x => x.valor || x.precio || x.iva || x.desde || x.hasta)
        for (const x of usados) {
          const d = x.desde || fe.desde, h = x.hasta || fe.hasta
          if (d >= h) e.push(`${i.concepto}: «desde» tiene que ser antes que «hasta»`)
          if ((x.desde && (x.desde < fe.desde || x.desde > fe.hasta)) || (x.hasta && (x.hasta < fe.desde || x.hasta > fe.hasta)))
            e.push(`${i.concepto}: las fechas tienen que estar dentro del tramo (${dmy(fe.desde)} → ${dmy(fe.hasta)})`)
        }
        if (usados.length > 1) {
          const ord = usados.map(x => ({ d: x.desde || fe.desde, h: x.hasta || fe.hasta })).sort((a, b) => a.d.localeCompare(b.d))
          for (let k = 1; k < ord.length; k++) if (ord[k]!.d < ord[k - 1]!.h) e.push(`${i.concepto}: dos períodos se pisan (${dmy(ord[k - 1]!.d)}–${dmy(ord[k - 1]!.h)} y ${dmy(ord[k]!.d)}–${dmy(ord[k]!.h)})`)
        }
      }
    }
    return e
  }, [tramos, fechas, filas, ins, acts])

  if (!lote) return null
  const num = (t: string) => (t.trim() === "" ? null : parseNumeroAR(t))
  const setF = (k: string, c: Partial<Fila>) => setFilas(p => ({ ...p, [k]: { ...p[k]!, ...c } }))
  const setP = (k: string, idx: number, c: Partial<Periodo>) => setFilas(p => ({ ...p, [k]: { ...p[k]!, periodos: p[k]!.periodos.map((x, j) => j === idx ? { ...x, ...c } : x) } }))
  const masPeriodo = (k: string) => setFilas(p => ({ ...p, [k]: { ...p[k]!, periodos: [...p[k]!.periodos, periodoVacio()] } }))
  const sacarPeriodo = (k: string, idx: number) => setFilas(p => ({ ...p, [k]: { ...p[k]!, periodos: p[k]!.periodos.length > 1 ? p[k]!.periodos.filter((_, j) => j !== idx) : [periodoVacio()] } }))

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
          const campOrig = campanaDeMes(String(t.fecha_desde).slice(0, 7))
          // Se reescriben TODOS los períodos del renglón (borrar y volver a cargar): así un período quitado no queda colgado.
          const viejos = planLote.filter(x => String(x.receta_insumo_id) === String(i.id) && (String(x.campana) === camp || String(x.campana) === campOrig))
          if (viejos.length) {
            const { error } = await supabase.from("presupuesto_variables").delete().in("id", viejos.map(x => x.id))
            if (error) { errs.push(`${i.concepto}: ${error.message}`); continue }
          }
          const base = { empresa: "MSA", escenario: "base", campana: camp, concepto: `${i.concepto} · ${lote.nombre}`, receta_insumo_id: i.id, lote_id: lote.id,
            distribucion: "calendario", fuente_cantidad: "manual", fuente_precio: "manual", activo: true, fundamento: "Plan del año del lote" }
          const nuevos = f.cero
            ? [{ ...base, cantidad: 0, precio: null, iva_pct: null, fecha_desde: null, fecha_hasta: null }]
            : f.periodos.filter(x => x.valor || x.precio || x.iva || x.desde || x.hasta).map(x => {
                const v = num(x.valor)
                return { ...base, cantidad: v == null ? null : desdeVista(i.modo, v), precio: num(x.precio), iva_pct: num(x.iva), fecha_desde: x.desde || null, fecha_hasta: x.hasta || null }
              })
          if (nuevos.length) {
            const { error } = await supabase.from("presupuesto_variables").insert(nuevos)
            if (error) errs.push(`${i.concepto}: ${error.message}`)
          }
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
                      const tienePlan = f.cero || f.periodos.some(x => x.valor || x.precio || x.iva || x.desde || x.hasta)
                      return f.periodos.map((x, idx) => (
                        <tr key={`${k}|${idx}`} className={`${idx === f.periodos.length - 1 ? "border-b" : ""} align-top ${fuera ? "opacity-50" : ""}`}>
                          <td className="py-1 pr-2">
                            {idx === 0 && <>
                              <span className="font-medium">{i.concepto}</span>
                              <span className={`ml-1 rounded px-1 text-[9px] ${tienePlan ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}>{tienePlan ? "plan del lote" : pA ? "plan de la actividad" : "receta"}</span>
                              {i.insumo_stock_id && <span className="block text-[10px] text-gray-500">del stock: {stock.get(String(i.insumo_stock_id)) ?? "—"}</span>}
                              {fuera && <span className="block text-[10px] text-amber-700">no está en la dieta de este año ({dieta})</span>}
                            </>}
                            {idx > 0 && <span className="pl-3 text-[10px] text-gray-500">↳ período {idx + 1}</span>}
                            {idx === f.periodos.length - 1 && !f.cero && (
                              <button type="button" className="mt-0.5 block text-[10px] text-blue-700 hover:underline" title="Otro período con otra cantidad (un cambio de ración)" onClick={() => masPeriodo(k)}>＋ período (cambio de ración)</button>
                            )}
                          </td>
                          <td className="pr-2 text-gray-600">{idx === 0 && <>{fmtNumeroAR(aVista(i.modo, Number(i.valor)), 2)} {unidadVista(i.modo, i.unidad)}{i.precio_unitario != null ? ` · ${i.moneda === "USD" ? "US$" : "$"} ${fmtNumeroAR(Number(i.precio_unitario), 2)}` : ""}{i.iva_pct != null ? ` · IVA ${fmtNumeroAR(Number(i.iva_pct), 1)} %` : ""}</>}</td>
                          <td className="pr-2 text-gray-600">{idx === 0 && (pA ? (Number(pA.cantidad) === 0 && pA.cantidad != null ? "este año 0" : [pA.cantidad != null ? `${fmtNumeroAR(aVista(i.modo, Number(pA.cantidad)), 2)}` : null, pA.precio != null ? `$ ${fmtNumeroAR(Number(pA.precio), 2)}` : null].filter(Boolean).join(" · ") || "—") : "—")}</td>
                          <td className="pr-1"><input className="h-7 w-20 rounded border px-1 text-xs" placeholder={fmtNumeroAR(aVista(i.modo, Number(pA?.cantidad ?? i.valor)), 2)} disabled={f.cero} value={x.valor} onChange={e => setP(k, idx, { valor: e.target.value })} /></td>
                          <td className="pr-1"><input className="h-7 w-20 rounded border px-1 text-xs" placeholder={i.precio_unitario != null ? fmtNumeroAR(Number(pA?.precio ?? i.precio_unitario), 2) : ""} disabled={f.cero} value={x.precio} onChange={e => setP(k, idx, { precio: e.target.value })} /></td>
                          <td className="pr-1"><input className="h-7 w-14 rounded border px-1 text-xs" placeholder={i.iva_pct != null ? fmtNumeroAR(Number(i.iva_pct), 1) : ""} disabled={f.cero} value={x.iva} onChange={e => setP(k, idx, { iva: e.target.value })} /></td>
                          <td className="pr-1">
                            <input type="date" className="h-7 rounded border px-1 text-xs" disabled={f.cero} value={x.desde} min={fe.desde} max={fe.hasta} onChange={e => setP(k, idx, { desde: e.target.value })} />
                            {!x.desde && <span className="block text-[10px] text-gray-400">{dmy(fe.desde)} (el tramo)</span>}
                          </td>
                          <td className="pr-1">
                            <input type="date" className="h-7 rounded border px-1 text-xs" disabled={f.cero} value={x.hasta} min={fe.desde} max={fe.hasta} onChange={e => setP(k, idx, { hasta: e.target.value })} />
                            {!x.hasta && <span className="block text-[10px] text-gray-400">{dmy(fe.hasta)} (el tramo)</span>}
                          </td>
                          <td>
                            {idx === 0 && <input type="checkbox" title="Este año no" checked={f.cero} onChange={e => setF(k, { cero: e.target.checked })} />}
                            {f.periodos.length > 1 && !f.cero && <button type="button" className="ml-1 text-[10px] text-red-700 hover:underline" title="Quitar este período" onClick={() => sacarPeriodo(k, idx)}>✕</button>}
                          </td>
                        </tr>
                      ))
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
        {errores.length > 0 && <ul className="list-disc pl-5 text-xs text-red-700">{errores.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        <p className="text-[11px] text-gray-500">«hasta» no se come (igual que el tramo): hasta el 01/03 = come hasta el 28/02. Con varios períodos (cambios de ración), fuera de los períodos cargados ese renglón no come. Para cambiar la receta permanente: «✏️ receta».</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCerrar}>Cancelar</Button>
          <Button size="sm" disabled={guardando || cargando || errores.length > 0} onClick={() => void guardar()}>{guardando ? "Guardando…" : "Guardar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
