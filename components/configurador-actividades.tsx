"use client"

// Presupuesto → Actividades y costos.
//
// Acá se dejan asentados los parámetros de cada actividad productiva (recría, engorde, lo que
// venga) y sus costos directos. Después alcanza con decir "este lote hace recría del 1/4 al
// 30/9" y el sistema sabe qué calcular.
//
// El costo directo NO es un template: es una consecuencia de la actividad. Por eso los ítems
// son una LISTA editable y no columnas fijas — cada actividad tiene los suyos.
//
// El simulador de abajo no guarda nada: es para ver cómo cae el gasto en el tiempo antes de
// atar la actividad a un lote real.

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight, FlaskConical } from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import {
  consumoMensual, ETIQUETA_MODO, MOMENTO_POR_DEFECTO, esMontoDirecto,
  type Actividad, type InsumoActividad, type ModoCosto, type MomentoCosto, type Tramo,
} from "@/lib/productivo/actividades"

const MODOS = Object.keys(ETIQUETA_MODO) as ModoCosto[]
const MOMENTOS: MomentoCosto[] = ["diario", "mensual", "inicio", "fin"]
const TIPOS = ["recria", "engorde", "pastoreo", "cria", "otro"] as const

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`

/** Fracción ↔ % para los campos que se guardan como fracción. */
const aPct = (f: number) => fmtNumeroAR(f * 100, 2)
const dePct = (s: string) => parseNumeroAR(s) / 100

export function ConfiguradorActividades() {
  const [cargando, setCargando] = useState(true)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [insumos, setInsumos] = useState<InsumoActividad[]>([])
  const [abierta, setAbierta] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [{ data: acts, error: e1 }, { data: ins, error: e2 }] = await Promise.all([
        supabase.schema("productivo").from("actividades").select("*").order("tipo").order("nombre"),
        supabase.schema("productivo").from("actividad_insumos").select("*").order("orden"),
      ])
      // Sin chequear el error un data null se ve igual que "no hay nada" y la pantalla
      // queda vacía sin decir por qué.
      if (e1 || e2) { alert("Error cargando actividades: " + (e1 || e2)!.message); return }
      setActividades((acts || []) as Actividad[])
      setInsumos((ins || []) as InsumoActividad[])
      if (!abierta && acts?.length) setAbierta(acts[0].id)
    } finally { setCargando(false) }
  }, [abierta])

  useEffect(() => { cargar() }, [])

  const insumosDe = (id: string) => insumos.filter(i => i.actividad_id === id)

  // ── Guardado ────────────────────────────────────────────────────────────────

  const guardarActividad = async (a: Actividad) => {
    setGuardando(true)
    const { error } = await supabase.schema("productivo").from("actividades")
      .update({
        tipo: a.tipo, nombre: a.nombre,
        ganancia_diaria_kg: a.ganancia_diaria_kg,
        racion_pct_pv: a.racion_pct_pv,
        pct_mortandad: a.pct_mortandad,
        notas: a.notas, activo: a.activo,
        updated_at: new Date().toISOString(),
      }).eq("id", a.id)
    setGuardando(false)
    if (error) { alert("Error: " + error.message); return }
    await cargar()
  }

  const guardarInsumo = async (i: InsumoActividad) => {
    setGuardando(true)
    const { error } = await supabase.schema("productivo").from("actividad_insumos")
      .update({
        concepto: i.concepto, modo: i.modo, valor: i.valor, unidad: i.unidad,
        momento: i.momento, precio_unitario: i.precio_unitario,
        producto: i.producto, notas: i.notas, orden: i.orden,
        updated_at: new Date().toISOString(),
      }).eq("id", i.id)
    setGuardando(false)
    if (error) { alert("Error: " + error.message); return }
    await cargar()
  }

  const nuevaActividad = async () => {
    const { error } = await supabase.schema("productivo").from("actividades").insert({
      empresa: "MSA", tipo: "otro", nombre: "Actividad nueva",
      ganancia_diaria_kg: 0, racion_pct_pv: 0.015, pct_mortandad: 0,
    })
    if (error) { alert("Error: " + error.message); return }
    await cargar()
  }

  const nuevoInsumo = async (actividadId: string) => {
    const orden = insumosDe(actividadId).length + 1
    const { error } = await supabase.schema("productivo").from("actividad_insumos").insert({
      actividad_id: actividadId, orden, concepto: "Nuevo concepto",
      modo: "pct_racion", valor: 0, unidad: "kg", momento: "diario", precio_unitario: 0,
    })
    if (error) { alert("Error: " + error.message); return }
    await cargar()
  }

  const borrar = async (tabla: "actividades" | "actividad_insumos", id: string, aviso: string) => {
    if (!confirm(aviso)) return
    const { error } = await supabase.schema("productivo").from(tabla).delete().eq("id", id)
    if (error) { alert("Error: " + error.message); return }
    await cargar()
  }

  // ── Edición en memoria ──────────────────────────────────────────────────────
  const setAct = (id: string, campo: keyof Actividad, valor: unknown) =>
    setActividades(prev => prev.map(a => a.id === id ? { ...a, [campo]: valor } : a))
  const setIns = (id: string, campo: keyof InsumoActividad, valor: unknown) =>
    setInsumos(prev => prev.map(i => i.id === id ? { ...i, [campo]: valor } : i))

  if (cargando) {
    return (
      <Card><CardContent className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando actividades…
      </CardContent></Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">🌾 Actividades y costos directos</CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              Los parámetros de cada actividad. El costo directo no se registra en ningún lado:
              se <strong>calcula</strong> a partir de la actividad que se decide hacer.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={nuevaActividad}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Actividad
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {actividades.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">No hay actividades cargadas.</p>
        )}

        {actividades.map(a => {
          const abierto = abierta === a.id
          const items = insumosDe(a.id)
          return (
            <div key={a.id} className="rounded border">
              <button
                type="button"
                onClick={() => setAbierta(abierto ? null : a.id)}
                className="flex w-full items-center gap-2 bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
              >
                {abierto ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                <span className="font-medium text-gray-800">{a.nombre}</span>
                <Badge variant="secondary" className="text-[10px]">{a.tipo}</Badge>
                <span className="text-xs text-gray-500">
                  {fmtNumeroAR(a.ganancia_diaria_kg, 3)} kg/día · ración {aPct(a.racion_pct_pv)} % PV
                </span>
                <span className="ml-auto text-xs text-gray-400">
                  {items.length} {items.length === 1 ? "concepto" : "conceptos"}
                </span>
                {!a.activo && <Badge variant="outline" className="text-[10px]">inactiva</Badge>}
              </button>

              {abierto && (
                <div className="space-y-3 p-3">
                  {/* Parámetros / rindes */}
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <div>
                      <label className="text-[11px] text-gray-500">Nombre</label>
                      <Input className="h-8" value={a.nombre}
                        onChange={e => setAct(a.id, "nombre", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Tipo</label>
                      <select className="h-8 w-full rounded border border-gray-200 px-2 text-sm"
                        value={a.tipo} onChange={e => setAct(a.id, "tipo", e.target.value)}>
                        {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Ganancia kg/día</label>
                      <Input className="h-8 text-right" value={fmtNumeroAR(a.ganancia_diaria_kg, 3)}
                        onChange={e => setAct(a.id, "ganancia_diaria_kg", parseNumeroAR(e.target.value))} />
                      <p className="mt-0.5 text-[10px] text-gray-400">el rinde</p>
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Ración % PV</label>
                      <Input className="h-8 text-right" value={aPct(a.racion_pct_pv)}
                        onChange={e => setAct(a.id, "racion_pct_pv", dePct(e.target.value))} />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Mortandad %</label>
                      <Input className="h-8 text-right" value={aPct(a.pct_mortandad)}
                        onChange={e => setAct(a.id, "pct_mortandad", dePct(e.target.value))} />
                    </div>
                  </div>

                  {/* Costos directos */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-[11px] font-medium text-gray-600">Costos directos de esta actividad</p>
                      <Button size="sm" variant="ghost" className="h-6 text-[11px]"
                        onClick={() => nuevoInsumo(a.id)}>
                        <Plus className="mr-1 h-3 w-3" /> concepto
                      </Button>
                    </div>

                    {items.length === 0 ? (
                      <p className="py-3 text-center text-xs text-gray-400">
                        Sin conceptos. Para recría/engorde suelen ser maíz y concentrado.
                      </p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-[10px] text-gray-500">
                            <th className="py-1 text-left font-medium">Concepto</th>
                            <th className="py-1 text-left font-medium">Cómo escala</th>
                            <th className="py-1 text-right font-medium">Valor</th>
                            <th className="py-1 text-left font-medium">Unidad</th>
                            <th className="py-1 text-left font-medium">Cuándo</th>
                            <th className="py-1 text-right font-medium">$/unidad</th>
                            <th className="py-1" />
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(i => {
                            const directo = esMontoDirecto(i.modo)
                            const esPct = i.modo === "pct_racion"
                            return (
                              <tr key={i.id} className="border-b border-gray-100 last:border-0">
                                <td className="py-1 pr-2">
                                  <Input className="h-7 text-xs" value={i.concepto}
                                    onChange={e => setIns(i.id, "concepto", e.target.value)}
                                    onBlur={() => guardarInsumo(i)} />
                                </td>
                                <td className="py-1 pr-2">
                                  <select className="h-7 w-full rounded border border-gray-200 px-1 text-xs"
                                    value={i.modo}
                                    onChange={e => {
                                      const modo = e.target.value as ModoCosto
                                      setIns(i.id, "modo", modo)
                                      setIns(i.id, "momento", MOMENTO_POR_DEFECTO[modo])
                                    }}
                                    onBlur={() => guardarInsumo(i)}>
                                    {MODOS.map(m => <option key={m} value={m}>{ETIQUETA_MODO[m]}</option>)}
                                  </select>
                                </td>
                                <td className="py-1 pr-2">
                                  <Input className="h-7 text-right text-xs"
                                    value={esPct ? aPct(i.valor) : fmtNumeroAR(i.valor, 2)}
                                    onChange={e => setIns(i.id, "valor", esPct ? dePct(e.target.value) : parseNumeroAR(e.target.value))}
                                    onBlur={() => guardarInsumo(i)} />
                                </td>
                                <td className="py-1 pr-2 text-gray-500">
                                  {directo ? <span className="text-gray-400">$</span> : (
                                    <Input className="h-7 w-16 text-xs" value={i.unidad ?? ""}
                                      onChange={e => setIns(i.id, "unidad", e.target.value)}
                                      onBlur={() => guardarInsumo(i)} />
                                  )}
                                </td>
                                <td className="py-1 pr-2">
                                  <select className="h-7 w-full rounded border border-gray-200 px-1 text-xs"
                                    value={i.momento}
                                    onChange={e => setIns(i.id, "momento", e.target.value as MomentoCosto)}
                                    onBlur={() => guardarInsumo(i)}>
                                    {MOMENTOS.map(m => <option key={m} value={m}>{m}</option>)}
                                  </select>
                                </td>
                                <td className="py-1 pr-2">
                                  {directo ? <span className="block text-right text-gray-300">—</span> : (
                                    <Input className="h-7 text-right text-xs"
                                      value={fmtNumeroAR(i.precio_unitario ?? 0, 2)}
                                      onChange={e => setIns(i.id, "precio_unitario", parseNumeroAR(e.target.value))}
                                      onBlur={() => guardarInsumo(i)} />
                                  )}
                                </td>
                                <td className="py-1 text-right">
                                  <button type="button" className="text-gray-300 hover:text-red-500"
                                    onClick={() => borrar("actividad_insumos", i.id, `¿Borrar "${i.concepto}"?`)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                    {items.some(i => i.modo === "pct_racion") && (
                      <p className="mt-1 text-[10px] text-gray-400">
                        Los “% de la ración” deberían sumar 100 %: hoy suman{" "}
                        <strong>{fmtNumeroAR(items.filter(i => i.modo === "pct_racion").reduce((s, i) => s + i.valor, 0) * 100, 1)} %</strong>.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => guardarActividad(a)} disabled={guardando}>
                      {guardando && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Guardar parámetros
                    </Button>
                    <button type="button"
                      className="text-xs text-gray-400 underline hover:text-red-500"
                      onClick={() => borrar("actividades", a.id, `¿Borrar la actividad "${a.nombre}" y sus ${items.length} conceptos?`)}>
                      eliminar actividad
                    </button>
                  </div>

                  <Simulador actividad={a} insumos={items} />
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ── Simulador ─────────────────────────────────────────────────────────────────
//
// No guarda nada. Sirve para ver cómo cae el gasto en el tiempo antes de atar la actividad a
// un lote: es la forma más rápida de darse cuenta si un parámetro quedó mal cargado.

function Simulador({ actividad, insumos }: { actividad: Actividad; insumos: InsumoActividad[] }) {
  const hoy = new Date().toISOString().slice(0, 10)
  const enSeisMeses = (() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 10) })()

  const [ver, setVer] = useState(false)
  const [cabezas, setCabezas] = useState("100")
  const [peso, setPeso] = useState("220")
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(enSeisMeses)
  const [has, setHas] = useState("0")

  const meses = useMemo(() => {
    const t: Tramo = {
      actividad, insumos,
      cabezas: parseNumeroAR(cabezas),
      desde, hasta,
      peso_inicial_kg: parseNumeroAR(peso),
      hectareas: parseNumeroAR(has),
    }
    return consumoMensual(t)
  }, [actividad, insumos, cabezas, peso, desde, hasta, has])

  const total = meses.reduce((s, m) => s + m.costo_total, 0)
  const cab = parseNumeroAR(cabezas)
  const conceptos = Array.from(new Set(meses.flatMap(m => m.items.map(i => i.concepto))))

  if (!ver) {
    return (
      <button type="button" onClick={() => setVer(true)}
        className="flex items-center gap-1.5 text-xs text-blue-600 underline">
        <FlaskConical className="h-3.5 w-3.5" /> Simular cómo cae el gasto en el tiempo
      </button>
    )
  }

  return (
    <div className="rounded border border-blue-200 bg-blue-50/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-medium text-blue-900">
          Simulación — no se guarda, es sólo para ver el reparto
        </p>
        <button type="button" className="text-[11px] text-gray-500 underline" onClick={() => setVer(false)}>
          ocultar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          ["Cabezas", cabezas, setCabezas, "text"],
          ["Peso inicial kg", peso, setPeso, "text"],
          ["Desde", desde, setDesde, "date"],
          ["Hasta", hasta, setHasta, "date"],
          ["Hectáreas", has, setHas, "text"],
        ].map(([label, val, set, tipo]) => (
          <div key={label as string}>
            <label className="text-[10px] text-gray-500">{label as string}</label>
            <Input type={tipo as string} className="h-7 text-xs"
              value={val as string}
              onChange={e => (set as (v: string) => void)(e.target.value)} />
          </div>
        ))}
      </div>

      {meses.length === 0 ? (
        <p className="mt-3 text-center text-xs text-gray-400">Revisá las fechas.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b text-[10px] text-gray-500">
                <th className="py-1 text-left font-medium">Mes</th>
                <th className="py-1 text-right font-medium">Días</th>
                <th className="py-1 text-right font-medium">Peso prom</th>
                {conceptos.map(c => <th key={c} className="py-1 text-right font-medium">{c}</th>)}
                <th className="py-1 text-right font-medium">Costo</th>
                <th className="py-1 text-right font-medium">$/cab</th>
              </tr>
            </thead>
            <tbody>
              {meses.map(m => (
                <tr key={m.mes} className="border-b border-gray-100">
                  <td className="py-1">{m.mes}</td>
                  <td className="py-1 text-right text-gray-500">{m.dias}</td>
                  <td className="py-1 text-right text-gray-500">{fmtNumeroAR(m.peso_prom_kg, 1)}</td>
                  {conceptos.map(c => {
                    const it = m.items.find(i => i.concepto === c)
                    return (
                      <td key={c} className="py-1 text-right text-gray-600">
                        {it ? `${fmtNumeroAR(it.cantidad, 0)} ${it.unidad ?? ""}` : "—"}
                      </td>
                    )
                  })}
                  <td className="py-1 text-right font-medium">{pesos(m.costo_total)}</td>
                  <td className="py-1 text-right text-gray-500">{cab > 0 ? pesos(m.costo_total / cab) : "—"}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1">Total</td>
                <td className="py-1 text-right">{meses.reduce((s, m) => s + m.dias, 0)}</td>
                <td />
                {conceptos.map(c => (
                  <td key={c} className="py-1 text-right">
                    {fmtNumeroAR(meses.reduce((s, m) => s + (m.items.find(i => i.concepto === c)?.cantidad ?? 0), 0), 0)}
                  </td>
                ))}
                <td className="py-1 text-right">{pesos(total)}</td>
                <td className="py-1 text-right">{cab > 0 ? pesos(total / cab) : "—"}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1.5 text-[10px] text-gray-500">
            El consumo diario <strong>sube a lo largo del tramo</strong>: la ración es un % del peso
            vivo y el animal engorda. Por eso cada mes se calcula con su propio peso promedio.
          </p>
        </div>
      )}
    </div>
  )
}
