"use client"

// Segmentador por rangos de peso (extraído de tab-terneros para soportar MÚLTIPLES:
// uno por población, ej. Machos y Hembras a la vez). Autocontenido: su estado, cálculo,
// arrastre de cortes y render. Reporta sus secciones + su config hacia arriba.

import { useState, useEffect, useRef, Fragment } from "react"
import type { SegConfig, SegSnapshot } from "./analisis-productivo"

interface AnimalSeg {
  sexo: string | null
  es_torito: boolean
  activo: boolean
  caravana_oficial?: string | null
  caravana_interna?: string | null
  pesadas_terneros: { fecha: string; peso_kg: number }[]
}
const caravanaDe = (a: AnimalSeg) => a.caravana_oficial || a.caravana_interna || "—"
export interface SeccionSeg { label: string; cantidad: number; promedio: number }
export interface SegPayload { poblacion: string; secciones: SeccionSeg[]; total: { cantidad: number; promedio: number } | null }

interface Props {
  titulo: string
  animales: AnimalSeg[]
  todasFechas: string[]
  gananciaDefault: number
  onSections: (p: SegPayload) => void
  onConfig?: (c: SegConfig) => void
  onRemove?: () => void
  initialConfig?: SegConfig
  // frozen: modo foto → mostrar/reportar la foto congelada, sin tocar el rodeo
  frozen?: SegSnapshot | null
}

function getUltima(pesadas: { fecha: string; peso_kg: number }[]) {
  if (!pesadas.length) return null
  return [...pesadas].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
}
// Peso estimado = última pesada + ganancia × días hasta hoy.
// asOf: si se pasa, toma la última pesada CON fecha ≤ asOf (reproduce el estado histórico).
// hoyMs: si se pasa, usa esa fecha como "hoy" (congela el drift de días).
function pesoEstimado(pesadas: { fecha: string; peso_kg: number }[], g: number, asOf?: string | null, hoyMs?: number): number | null {
  const rel = asOf ? pesadas.filter(p => p.fecha <= asOf) : pesadas
  const u = getUltima(rel); if (!u) return null
  const ref = hoyMs ?? Date.now()
  const d = Math.floor((ref - new Date(u.fecha).getTime()) / 86400000)
  return u.peso_kg + g * d
}
function fFecha(iso: string) { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y.slice(2)}` }

// Índices históricos de un animal desde sus pesadas: ganancia diaria punta a punta (1ª→última)
// y entre las 2 últimas pesadas (kg/día). null si no hay datos suficientes.
function indicesHistoricos(pesadas: { fecha: string; peso_kg: number }[]): { puntaPunta: number | null; ultimas: number | null; nPesadas: number } {
  const ps = [...pesadas].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const n = ps.length
  const dias = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
  let puntaPunta: number | null = null, ultimas: number | null = null
  if (n >= 2) {
    const dPP = dias(ps[0].fecha, ps[n - 1].fecha)
    if (dPP > 0) puntaPunta = (ps[n - 1].peso_kg - ps[0].peso_kg) / dPP
    const dUlt = dias(ps[n - 2].fecha, ps[n - 1].fecha)
    if (dUlt > 0) ultimas = (ps[n - 1].peso_kg - ps[n - 2].peso_kg) / dUlt
  }
  return { puntaPunta, ultimas, nPesadas: n }
}
const promedioNoNulo = (arr: (number | null)[]): number | null => { const v = arr.filter((n): n is number => n != null); return v.length ? v.reduce((s, n) => s + n, 0) / v.length : null }

// Sub-segmentación: divide un conjunto de animales (de una sección) en sub-rangos de peso de ancho `cada`.
function subRangos(items: { a: AnimalSeg; peso: number }[], cada: number): { lo: number; hi: number; cantidad: number; promedio: number; pct: number }[] {
  if (!items.length || cada <= 0) return []
  const pesos = items.map(i => i.peso)
  const min = Math.min(...pesos), max = Math.max(...pesos)
  const start = Math.floor(min / cada) * cada
  const bins: { lo: number; hi: number; cantidad: number; promedio: number; pct: number }[] = []
  for (let b = start; b <= max; b += cada) {
    // Último bin inclusivo en el extremo superior para no perder el máximo exacto.
    const ultimo = b + cada > max
    const en = items.filter(i => i.peso >= b && (ultimo ? i.peso <= b + cada : i.peso < b + cada))
    if (en.length) bins.push({ lo: b, hi: b + cada, cantidad: en.length, promedio: en.reduce((s, i) => s + i.peso, 0) / en.length, pct: en.length / items.length })
  }
  return bins
}

const GRUPOS_ALL = ["torito", "ternera_rep", "macho", "hembra"]
export function poblacionLabel(grupos: string[]): string {
  const has = (k: string) => grupos.includes(k)
  const parts: string[] = []
  if (has("macho") && has("torito")) parts.push("Machos")
  else if (has("macho")) parts.push("Machos venta")
  else if (has("torito")) parts.push("Toritos")
  if (has("hembra") && has("ternera_rep")) parts.push("Hembras")
  else if (has("hembra")) parts.push("Hembras venta")
  else if (has("ternera_rep")) parts.push("Terneras rep")
  if (!parts.length) return "—"
  if (parts.length === 2 && parts[0] === "Machos" && parts[1] === "Hembras") return "Todos"
  return parts.join(" + ")
}

export function Segmentador({ titulo, animales, todasFechas, gananciaDefault, onSections, onConfig, onRemove, initialConfig, frozen }: Props) {
  const [segColapsado, setSegColapsado] = useState(false)
  const [segGrupos, setSegGrupos] = useState<Set<string>>(new Set(initialConfig?.grupos ?? GRUPOS_ALL))
  const [segOrigen, setSegOrigen] = useState<"estimado" | "pesada">(initialConfig?.origen === "pesada" ? "pesada" : "estimado")
  const [segGanancia, setSegGanancia] = useState(initialConfig?.ganancia ?? gananciaDefault)
  const [segCada, setSegCada] = useState(initialConfig?.cada ?? 20)
  const [segDesde, setSegDesde] = useState<number | null>(initialConfig?.desde ?? null)
  const [segFecha, setSegFecha] = useState(initialConfig?.fecha ?? "")
  // Estimado configurable: pesada BASE ("" = última) + proyectar HASTA fecha ("" = hoy).
  // Se guardan resueltas a fecha concreta en el config → un estudio reproduce el kilaje exacto.
  const [segPesadaBase, setSegPesadaBase] = useState(initialConfig?.pesadaBaseFecha ?? "")
  const [segHasta, setSegHasta] = useState(initialConfig?.fechaCalculo ?? "")
  const [segCortes, setSegCortes] = useState<number[] | null>(initialConfig?.cortes ?? null)
  const [segDragIdx, setSegDragIdx] = useState<number | null>(null)
  const [segDragDelete, setSegDragDelete] = useState(false)
  // Panel de sección (individuos + sub-segmentar): índice de fila abierta + ancho de sub-rango.
  const [subAbierta, setSubAbierta] = useState<number | null>(null)
  const [subCada, setSubCada] = useState(10)
  const segAxisRef = useRef<HTMLDivElement>(null)
  const segCortesRef = useRef<number[] | null>(null)

  const segFechaEff = segFecha || todasFechas[todasFechas.length - 1] || ""
  // Estimado: base = pesada elegida ("" → última) proyectada hasta la fecha elegida ("" → hoy).
  const asOf = segPesadaBase || null
  const hastaMs = segHasta ? new Date(segHasta + "T00:00:00").getTime() : undefined
  const grupoDe = (t: AnimalSeg) => t.es_torito ? (t.sexo === "Macho" ? "torito" : "ternera_rep") : (t.sexo === "Macho" ? "macho" : "hembra")
  // Animales con su peso (conserva identidad → para el panel de individuos / sub-segmentar).
  const segAnimalesPeso: { a: AnimalSeg; peso: number }[] = animales
    .filter(t => t.activo && t.pesadas_terneros.length > 0 && segGrupos.has(grupoDe(t)))
    .map(t => ({ a: t, peso: segOrigen === "estimado" ? pesoEstimado(t.pesadas_terneros, segGanancia, asOf, hastaMs) : (t.pesadas_terneros.find(p => p.fecha === segFechaEff)?.peso_kg ?? null) }))
    .filter((x): x is { a: AnimalSeg; peso: number } => x.peso != null)
  const segPesos: number[] = segAnimalesPeso.map(x => x.peso)

  const SEG_SECCIONES_DEFAULT = 5
  const segNCortesDefault = SEG_SECCIONES_DEFAULT - 1
  const segDesdeAuto = (() => {
    if (!segPesos.length) return 0
    const prom = segPesos.reduce((s, p) => s + p, 0) / segPesos.length
    const centro = Math.round(prom / 10) * 10
    return centro - ((segNCortesDefault - 1) / 2) * segCada
  })()
  const segDesdeEff = segDesde ?? segDesdeAuto
  const cortesAuto = (() => {
    if (!segPesos.length) return [] as number[]
    const cortes: number[] = []
    for (let i = 0; i < segNCortesDefault; i++) cortes.push(Math.round(segDesdeEff + i * segCada))
    return cortes
  })()
  const cortesEff = (segCortes && segCortes.length >= 1) ? [...segCortes].sort((a, b) => a - b) : cortesAuto
  const segMinPeso = segPesos.length ? Math.min(...segPesos) : 0
  const segMaxPeso = segPesos.length ? Math.max(...segPesos) : 1
  const segAxisMin = segMinPeso
  const segAxisMax = segMaxPeso
  const segDensidad = (() => {
    if (!segPesos.length || segAxisMax <= segAxisMin) return [] as { lo: number; hi: number; n: number }[]
    const nBins = 40
    const paso = (segAxisMax - segAxisMin) / nBins
    const bins = Array.from({ length: nBins }, (_, i) => ({ lo: segAxisMin + i * paso, hi: segAxisMin + (i + 1) * paso, n: 0 }))
    for (const p of segPesos) {
      let idx = Math.floor((p - segAxisMin) / paso)
      if (idx < 0) idx = 0
      if (idx >= nBins) idx = nBins - 1
      bins[idx].n++
    }
    return bins
  })()
  const segDensMax = Math.max(1, ...segDensidad.map(b => b.n))
  const segReporte = (() => {
    if (!segPesos.length || cortesEff.length < 1) return { filas: [] as { lo: number; hi: number; cantidad: number; promedio: number; pct: number }[], total: null as null | { cantidad: number; promedio: number } }
    const bounds = [-Infinity, ...cortesEff, Infinity]
    const filas: { lo: number; hi: number; cantidad: number; promedio: number; pct: number }[] = []
    for (let i = 0; i < bounds.length - 1; i++) {
      const lo = bounds[i], hi = bounds[i + 1]
      const en = segPesos.filter(p => p >= lo && p < hi)
      filas.push({ lo, hi, cantidad: en.length, promedio: en.length ? en.reduce((s, p) => s + p, 0) / en.length : 0, pct: en.length / segPesos.length })
    }
    const total = { cantidad: segPesos.length, promedio: segPesos.reduce((s, p) => s + p, 0) / segPesos.length }
    return { filas, total }
  })()

  useEffect(() => { segCortesRef.current = segCortes }, [segCortes])
  useEffect(() => {
    if (segDragIdx == null) return
    let del = false
    const onMove = (e: MouseEvent) => {
      const el = segAxisRef.current
      if (!el || segAxisMax <= segAxisMin) return
      const rect = el.getBoundingClientRect()
      const pct = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
      const w = segAxisMax - pct * (segAxisMax - segAxisMin)
      const base = segCortesRef.current ?? cortesAuto
      const arr = [...base]
      const lo = arr[segDragIdx - 1] ?? -Infinity
      const hi = arr[segDragIdx + 1] ?? Infinity
      const val = Math.round(Math.min(hi - 1, Math.max(lo + 1, w)))
      arr[segDragIdx] = val
      const T = segCada * 0.4
      del = base.length > 1 && (
        (segDragIdx > 0 && (val - arr[segDragIdx - 1]) <= T) ||
        (segDragIdx < arr.length - 1 && (arr[segDragIdx + 1] - val) <= T)
      )
      segCortesRef.current = arr
      setSegCortes(arr)
      setSegDragDelete(del)
    }
    const onUp = () => {
      if (del) {
        const base = segCortesRef.current ?? cortesAuto
        const arr = base.filter((_, i) => i !== segDragIdx)
        segCortesRef.current = arr
        setSegCortes(arr)
      }
      setSegDragIdx(null)
      setSegDragDelete(false)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segDragIdx, segAxisMin, segAxisMax, segCada])

  // Reportar secciones + config hacia arriba
  const poblacion = poblacionLabel([...segGrupos])
  const livePayload: SegPayload = {
    poblacion,
    secciones: segReporte.filas.map(r => ({
      label: r.lo === -Infinity ? `< ${Math.round(r.hi)}` : r.hi === Infinity ? `> ${Math.round(r.lo)}` : `${Math.round(r.lo)} / ${Math.round(r.hi)}`,
      cantidad: r.cantidad, promedio: r.promedio,
    })),
    total: segReporte.total,
  }
  // En modo foto se reporta la foto congelada tal cual (no depende del rodeo actual).
  const payload: SegPayload = frozen ?? livePayload
  const payloadKey = JSON.stringify(payload)
  useEffect(() => { onSections(payload) }, [payloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Receta de reproducción: pesada BASE + fecha HASTA (del análisis), resueltas a fecha concreta
  // ("" → última / hoy) para que un estudio guardado reproduzca el kilaje exacto al recargar.
  // En modo foto se preserva la receta original (initialConfig) para no pisarla al re-guardar.
  const hoyISO = new Date().toISOString().slice(0, 10)
  const pesadaBaseFecha = frozen
    ? (initialConfig?.pesadaBaseFecha ?? null)
    : segOrigen === "estimado"
      ? (segPesadaBase || todasFechas[todasFechas.length - 1] || null)
      : (segFechaEff || null)
  const fechaCalculo = frozen
    ? (initialConfig?.fechaCalculo ?? hoyISO)
    : (segHasta || hoyISO)
  const cfg: SegConfig = { origen: segOrigen, grupos: [...segGrupos], ganancia: segGanancia, cada: segCada, desde: segDesde, fecha: segFecha, cortes: segCortes, pesadaBaseFecha, fechaCalculo, snapshot: frozen ?? livePayload }
  const cfgKey = JSON.stringify(cfg)
  useEffect(() => { onConfig?.(cfg) }, [cfgKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // El sexo es "maestro": al sacar/poner Machos arrastra Toritos; Hembras arrastra Terneras rep.
  // La reposición sí se puede togglear sola (ej. Machos SIN toritos = solo venta).
  const parRep: Record<string, string> = { macho: "torito", hembra: "ternera_rep" }
  const toggleGrupo = (k: string) => setSegGrupos(prev => {
    const n = new Set(prev)
    const prender = !n.has(k)
    if (k === "macho" || k === "hembra") {
      if (prender) { n.add(k); n.add(parRep[k]) } else { n.delete(k); n.delete(parRep[k]) }
    } else {
      if (prender) n.add(k); else n.delete(k)
    }
    return n
  })

  return (
    <div className="mb-3 border rounded-lg p-3 bg-slate-50">
      <div className="flex items-center gap-2 mb-2">
        <button type="button" onClick={() => setSegColapsado(v => !v)} className="flex items-center gap-2 flex-1 text-left font-semibold text-gray-700">
          <span className="text-gray-400">{segColapsado ? "▶" : "▼"}</span>
          <span>Segmentador {titulo}</span>
          <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">{poblacion}</span>
          {segReporte.total && <span className="text-xs font-normal text-gray-400">· {segReporte.filas.length} secc · {segReporte.total.cantidad} animales</span>}
        </button>
        {frozen && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700" title="Foto guardada con el estudio — no depende del rodeo actual">📸 foto guardada</span>}
        {onRemove && <button type="button" onClick={onRemove} title="Quitar segmentador" className="text-xs px-1.5 py-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">✕</button>}
      </div>
      {/* Modo foto: tabla read-only de la foto congelada (no re-deriva del rodeo) */}
      {!segColapsado && frozen && (
        <div className="text-sm">
          <p className="text-xs text-indigo-600 mb-2">Datos guardados con el estudio (foto congelada). No dependen de las pesadas actuales.</p>
          <table className="w-full text-base">
            <thead>
              <tr className="text-gray-500 border-b"><th className="text-left py-1">Rango</th><th className="text-right">Cantidad</th><th className="text-right pr-1">Promedio</th></tr>
            </thead>
            <tbody>
              {frozen.secciones.map((s, idx) => (
                <tr key={idx} className="hover:bg-white"><td className="py-2">{s.label}</td><td className="text-right">{s.cantidad}</td><td className="text-right pr-1">{s.cantidad ? s.promedio.toFixed(0) : "—"}</td></tr>
              ))}
              {frozen.total && (
                <tr className="font-semibold border-t"><td className="py-2">Total</td><td className="text-right">{frozen.total.cantidad}</td><td className="text-right pr-1">{frozen.total.promedio.toFixed(1).replace(".", ",")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!segColapsado && !frozen && (<>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 text-sm">
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className="text-gray-500">Reposición:</span>
            {([["torito", "🐂 Toritos"], ["ternera_rep", "♀ Terneras rep"]] as const).map(([k, lbl]) => {
              const on = segGrupos.has(k)
              return <button key={k} type="button" onClick={() => toggleGrupo(k)}
                className={`px-2 py-0.5 rounded-full border text-xs ${on ? "bg-amber-100 border-amber-400 text-amber-800" : "bg-white border-gray-300 text-gray-400 line-through"}`}>{lbl}</button>
            })}
            <span className="text-gray-500 ml-2">Venta:</span>
            {([["macho", "♂ Machos"], ["hembra", "♀ Hembras"]] as const).map(([k, lbl]) => {
              const on = segGrupos.has(k)
              return <button key={k} type="button" onClick={() => toggleGrupo(k)}
                className={`px-2 py-0.5 rounded-full border text-xs ${on ? "bg-sky-100 border-sky-400 text-sky-800" : "bg-white border-gray-300 text-gray-400 line-through"}`}>{lbl}</button>
            })}
            <button type="button" onClick={() => setSegGrupos(new Set(GRUPOS_ALL))} className="text-xs text-blue-600 hover:underline ml-1">Todos</button>
            <button type="button" onClick={() => setSegGrupos(new Set())} className="text-xs text-blue-600 hover:underline">Ninguno</button>
          </span>
          <label className="flex items-center gap-1 cursor-pointer flex-wrap">
            <input type="radio" checked={segOrigen === "estimado"} onChange={() => setSegOrigen("estimado")} />
            Estimado
            <input type="number" step="0.1" value={segGanancia} onChange={e => setSegGanancia(parseFloat(e.target.value) || 0)} disabled={segOrigen !== "estimado"} className="w-16 border rounded px-1 py-1" />
            kg/día
            <span className="text-gray-500">desde</span>
            <select value={segPesadaBase} onChange={e => { setSegPesadaBase(e.target.value); setSegCortes(null) }} disabled={segOrigen !== "estimado"} title="Pesada base de la proyección" className="border rounded px-1 py-1">
              <option value="">última</option>
              {todasFechas.map(f => <option key={f} value={f}>{fFecha(f)}</option>)}
            </select>
            <span className="text-gray-500">hasta</span>
            <input type="date" value={segHasta || hoyISO} onChange={e => { setSegHasta(e.target.value); setSegCortes(null) }} disabled={segOrigen !== "estimado"} title="Fecha del análisis (hasta cuándo proyecta el aumento diario)" className="border rounded px-1 py-1" />
            {segOrigen === "estimado" && segHasta && <button type="button" onClick={() => { setSegHasta(""); setSegCortes(null) }} className="text-xs text-blue-600 hover:underline" title="Proyectar hasta hoy">hoy</button>}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={segOrigen === "pesada"} onChange={() => setSegOrigen("pesada")} />
            Pesada
            <select value={segFechaEff} onChange={e => setSegFecha(e.target.value)} disabled={segOrigen !== "pesada"} className="border rounded px-1 py-1">
              {todasFechas.map(f => <option key={f} value={f}>{fFecha(f)}</option>)}
            </select>
          </label>
          <span className="flex items-center gap-1">
            cada <input type="number" value={segCada} onChange={e => { setSegCada(parseInt(e.target.value) || 20); setSegCortes(null) }} className="w-16 border rounded px-1 py-1" /> kg
            desde <input type="number" value={segDesdeEff} onChange={e => { setSegDesde(parseInt(e.target.value)); setSegCortes(null) }} className="w-16 border rounded px-1 py-1" />
            <button onClick={() => { setSegDesde(null); setSegCortes(null) }} className="underline text-gray-500" title="Volver a rangos uniformes centrados en el promedio">auto</button>
          </span>
          <span className="text-gray-400 text-xs">↕ arrastrá los divisores del eje para mover los cortes</span>
        </div>
        {segReporte.total ? (
          <div className="flex gap-3">
            <div ref={segAxisRef} className="relative select-none shrink-0 my-5" style={{ width: 130, height: 520 }}>
              {segDensidad.map((b, i) => {
                const topPct = ((segAxisMax - b.hi) / (segAxisMax - segAxisMin)) * 100
                const hPct = ((b.hi - b.lo) / (segAxisMax - segAxisMin)) * 100
                return <div key={i} className="absolute left-7 bg-green-300/70 rounded-sm" style={{ top: `${topPct}%`, height: `${Math.max(hPct - 0.4, 0.6)}%`, width: `${(b.n / segDensMax) * 60}px` }} />
              })}
              <span className="absolute left-0 -top-1 text-[10px] text-gray-400">{Math.round(segAxisMax)}</span>
              <span className="absolute left-0 -bottom-1 text-[10px] text-gray-400">{Math.round(segAxisMin)}</span>
              {cortesEff.map((c, i) => {
                const topPct = ((segAxisMax - c) / (segAxisMax - segAxisMin)) * 100
                const enBorrado = segDragIdx === i && segDragDelete
                return (
                  <div key={i} className="absolute left-5 right-0 flex items-center cursor-ns-resize group" style={{ top: `${topPct}%`, transform: "translateY(-50%)", height: 12 }}
                    onMouseDown={(e) => { e.preventDefault(); if (segCortes == null) { const c0 = [...cortesEff]; setSegCortes(c0); segCortesRef.current = c0 } setSegDragIdx(i) }}>
                    <div className={`h-[2px] w-full ${enBorrado ? "bg-red-500" : "bg-blue-500 group-hover:bg-blue-700"}`} />
                    <span className={`absolute -left-6 -top-2 text-[9px] font-medium px-0.5 rounded ${enBorrado ? "text-red-600 bg-red-50" : "text-blue-600 bg-white/90"}`}>{enBorrado ? "✕ borrar" : Math.round(c)}</span>
                  </div>
                )
              })}
              <button className="absolute left-6 -top-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-full px-2 py-0.5 shadow whitespace-nowrap z-10" title="Crear una sección en los más pesados"
                onClick={() => { const last = cortesEff.length ? cortesEff[cortesEff.length - 1] : Math.round(segMaxPeso - segCada); const nuevo = Math.min(Math.round(last + segCada), Math.round(segMaxPeso) - 1); if (nuevo > (cortesEff[cortesEff.length - 1] ?? -Infinity)) setSegCortes([...cortesEff, nuevo]) }}>＋ sección ↑</button>
              <button className="absolute left-6 -bottom-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-full px-2 py-0.5 shadow whitespace-nowrap z-10" title="Crear una sección en los más livianos"
                onClick={() => { const first = cortesEff.length ? cortesEff[0] : Math.round(segMinPeso + segCada); const nuevo = Math.max(Math.round(first - segCada), Math.round(segMinPeso) + 1); if (nuevo < (cortesEff[0] ?? Infinity)) setSegCortes([nuevo, ...cortesEff]) }}>＋ sección ↓</button>
            </div>
            <table className="w-full text-base self-start">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="text-left py-1">Rango</th>
                  <th className="text-right">Cantidad</th>
                  <th className="text-right">Promedio</th>
                  <th className="text-right pr-1">% sobre total</th>
                </tr>
              </thead>
              <tbody>
                {segReporte.filas.map((r, idx) => {
                  const label = r.lo === -Infinity ? `< ${Math.round(r.hi)}` : r.hi === Infinity ? `> ${Math.round(r.lo)}` : `${Math.round(r.lo)} / ${Math.round(r.hi)}`
                  const esExtremo = r.lo === -Infinity || r.hi === Infinity
                  const abierta = subAbierta === idx
                  const animalesSec = abierta ? segAnimalesPeso.filter(x => x.peso >= r.lo && x.peso < r.hi).sort((a, b) => b.peso - a.peso) : []
                  const subs = abierta ? subRangos(animalesSec, subCada) : []
                  return (
                    <Fragment key={idx}>
                      <tr onClick={() => setSubAbierta(abierta ? null : idx)} title="Ver individuos y sub-segmentar"
                        className={`cursor-pointer ${esExtremo ? "text-gray-500" : ""} ${abierta ? "bg-emerald-50" : "hover:bg-white"}`}>
                        <td className="py-2"><span className="text-gray-400 mr-1 text-xs">{abierta ? "▼" : "▶"}</span>{label}</td>
                        <td className="text-right">{r.cantidad}</td>
                        <td className="text-right">{r.cantidad ? r.promedio.toFixed(0) : "—"}</td>
                        <td className="text-right pr-1">{Math.round(r.pct * 100)}%</td>
                      </tr>
                      {abierta && (
                        <tr>
                          <td colSpan={4} className="bg-slate-50 border-b px-2 py-2">
                            {animalesSec.length === 0 ? <p className="text-xs text-gray-400">Sin animales en este rango.</p> : (
                              <div className="flex flex-col gap-3">
                                <div>
                                  <div className="flex items-center gap-2 text-sm mb-1">
                                    <span className="font-semibold text-gray-600">Sub-segmentar</span>
                                    <span className="text-gray-500">cada</span>
                                    <input type="number" value={subCada} onClick={e => e.stopPropagation()} onChange={e => setSubCada(Math.max(1, parseInt(e.target.value) || 10))} className="w-14 border rounded px-1 py-0.5" />
                                    <span className="text-gray-500">kg</span>
                                    <span className="text-xs text-gray-400">· para informar al comprador cómo viene el lote</span>
                                  </div>
                                  <table className="text-sm w-full">
                                    <thead><tr className="text-gray-500 border-b"><th className="text-left">Sub-rango</th><th className="text-right">Cant.</th><th className="text-right">Prom.</th><th className="text-right pr-1">%</th></tr></thead>
                                    <tbody>
                                      {subs.map((s, i) => (
                                        <tr key={i} className="border-b border-slate-100">
                                          <td>{Math.round(s.lo)} / {Math.round(s.hi)}</td>
                                          <td className="text-right">{s.cantidad}</td>
                                          <td className="text-right">{s.promedio.toFixed(0)}</td>
                                          <td className="text-right pr-1">{Math.round(s.pct * 100)}%</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                {(() => {
                                  const ind = animalesSec.map(x => ({ x, i: indicesHistoricos(x.a.pesadas_terneros) }))
                                  const fmt = (n: number | null) => n == null ? "—" : n.toFixed(2).replace(".", ",")
                                  const avgPP = promedioNoNulo(ind.map(o => o.i.puntaPunta))
                                  const avgUlt = promedioNoNulo(ind.map(o => o.i.ultimas))
                                  return (
                                    <div>
                                      <div className="text-sm font-semibold text-gray-600 mb-1">Individuos ({animalesSec.length}) e índices históricos</div>
                                      <div className="text-xs text-gray-600 mb-1">Promedio grupo — g. diaria punta a punta: <b>{fmt(avgPP)}</b> kg/día · últimas pesadas: <b>{fmt(avgUlt)}</b> kg/día</div>
                                      <div className="max-h-48 overflow-y-auto">
                                        <table className="text-xs w-full">
                                          <thead><tr className="text-gray-500 border-b">
                                            <th className="text-left">Caravana</th>
                                            <th className="text-right">Peso</th>
                                            <th className="text-right" title="Ganancia diaria punta a punta (1ª → última pesada)">g. p-p</th>
                                            <th className="text-right pr-1" title="Ganancia diaria entre las 2 últimas pesadas">g. últ.</th>
                                          </tr></thead>
                                          <tbody>
                                            {ind.map((o, i) => (
                                              <tr key={i} className="border-b border-slate-100">
                                                <td>{caravanaDe(o.x.a)}</td>
                                                <td className="text-right">{o.x.peso.toFixed(0)}kg</td>
                                                <td className="text-right">{fmt(o.i.puntaPunta)}</td>
                                                <td className="text-right pr-1">{fmt(o.i.ultimas)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                <tr className="font-semibold border-t">
                  <td className="py-2">Total</td>
                  <td className="text-right">{segReporte.total.cantidad}</td>
                  <td className="text-right">{segReporte.total.promedio.toFixed(1).replace(".", ",")}</td>
                  <td className="text-right pr-1">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-xs">Sin pesos para segmentar (elegí "Estimado" o una pesada, y al menos un grupo).</p>
        )}
      </>)}
    </div>
  )
}
