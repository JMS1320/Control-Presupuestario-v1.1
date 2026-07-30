"use client"

// Presupuesto → Actividades y costos.
//
// Acá se dejan asentados los parámetros de cada actividad productiva (recría, engorde, soja,
// lo que venga) y sus costos directos. Después alcanza con decir "este lote hace recría del
// 1/4 al 30/9" y el sistema sabe qué calcular.
//
// El costo directo NO es un template: es una consecuencia de la actividad. Por eso los ítems
// son una LISTA editable y no columnas fijas — cada actividad tiene los suyos.

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight, FlaskConical } from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import type { PuntoSerie } from "@/lib/precios/serie"
import {
  consumoMensual, ETIQUETA_MODO, ETIQUETA_MOMENTO, MOMENTO_POR_DEFECTO, esMontoDirecto, usaRacion,
  type Actividad, type InsumoActividad, type ModoCosto, type MomentoCosto, type Tramo, type TipoActividad,
} from "@/lib/productivo/actividades"

const MODOS = Object.keys(ETIQUETA_MODO) as ModoCosto[]
const MOMENTOS = Object.keys(ETIQUETA_MOMENTO) as MomentoCosto[]
const TIPOS: TipoActividad[] = ["recria", "engorde", "pastoreo", "cria", "agricola", "otro"]

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`

/** Fracción ↔ % para los campos que se guardan como fracción. */
const aPct = (f: number) => fmtNumeroAR(f * 100, 2)

/**
 * Input numérico que NO se reformatea mientras se escribe.
 *
 * El bug que arregla: el valor mostrado se derivaba del estado y se volvía a formatear en
 * cada tecla, así que al tipear "85" después de la primera tecla el campo ya decía "8,00" y
 * el 5 caía en el lugar equivocado. El usuario terminó con 8 % y 10 % de ración donde quería
 * 85 % y 15 %. Mientras el campo está tocado se conserva el texto crudo y recién al salir se
 * parsea y se formatea.
 */
function InputNumero({ valor, onCommit, dec = 2, className, placeholder }: {
  valor: number
  onCommit: (n: number) => void
  dec?: number
  className?: string
  placeholder?: string
}) {
  const [crudo, setCrudo] = useState<string | null>(null)
  return (
    <Input
      className={className}
      placeholder={placeholder}
      value={crudo ?? fmtNumeroAR(valor, dec)}
      onChange={e => setCrudo(e.target.value)}
      onBlur={() => {
        if (crudo === null) return
        const n = parseNumeroAR(crudo)
        setCrudo(null)
        if (n !== valor) onCommit(n)
      }}
    />
  )
}

export function ConfiguradorActividades() {
  const [cargando, setCargando] = useState(true)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [insumos, setInsumos] = useState<InsumoActividad[]>([])
  const [tiposCambio, setTiposCambio] = useState<PuntoSerie[]>([])
  const [abierta, setAbierta] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [{ data: acts, error: e1 }, { data: ins, error: e2 }, { data: tc }] = await Promise.all([
        supabase.schema("productivo").from("actividades").select("*").order("tipo").order("nombre"),
        supabase.schema("productivo").from("actividad_insumos").select("*").order("orden"),
        supabase.from("tipos_cambio").select("anio, mes, tc_presupuestado"),
      ])
      // Sin chequear el error un data null se ve igual que "no hay nada" y la pantalla
      // queda vacía sin decir por qué.
      if (e1 || e2) { alert("Error cargando actividades: " + (e1 || e2)!.message); return }
      setActividades((acts || []) as Actividad[])
      setInsumos((ins || []) as InsumoActividad[])
      setTiposCambio(((tc || []) as any[]).map(r => ({
        anio: r.anio, mes: r.mes, valor: Number(r.tc_presupuestado) || 0,
      })))
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

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

  /**
   * Guarda el ítem con los campos que se le pasan. Recibe el objeto completo y no lee del
   * estado a propósito: los números se confirman al salir del campo, y en ese mismo tick el
   * estado todavía no se actualizó.
   */
  const guardarInsumo = async (i: InsumoActividad, cambios: Partial<InsumoActividad> = {}) => {
    const v = { ...i, ...cambios }
    setInsumos(prev => prev.map(x => x.id === v.id ? v : x))
    const { error } = await supabase.schema("productivo").from("actividad_insumos")
      .update({
        concepto: v.concepto, modo: v.modo, valor: v.valor, unidad: v.unidad,
        momento: v.momento, moneda: v.moneda, precio_unitario: v.precio_unitario,
        producto: v.producto, notas: v.notas, orden: v.orden,
        updated_at: new Date().toISOString(),
      }).eq("id", v.id)
    if (error) { alert("Error: " + error.message); await cargar() }
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
    const act = actividades.find(a => a.id === actividadId)
    const agricola = act && !usaRacion(act.tipo)
    const orden = insumosDe(actividadId).length + 1
    const { error } = await supabase.schema("productivo").from("actividad_insumos").insert({
      actividad_id: actividadId, orden, concepto: "Nuevo concepto",
      // En una actividad agrícola el default útil es por hectárea, no % de la ración
      modo: agricola ? "monto_ha" : "pct_racion",
      valor: 0, unidad: agricola ? null : "kg",
      momento: agricola ? "ciclo" : "diario",
      moneda: agricola ? "USD" : "ARS",
      precio_unitario: agricola ? null : 0,
    })
    if (error) { alert("Error: " + error.message); return }
    await cargar()
  }

  const borrar = async (tabla: "actividades" | "actividad_insumos", id: string, aviso: string) => {
    if (!confirm(aviso)) return
    const { error } = await supabase.schema("productivo").from(tabla).delete().eq("id", id)
    if (error) {
      // La FK de lote_tramos es RESTRICT: una actividad en uso no se puede borrar, y eso
      // está bien — pero el mensaje de Postgres no lo explica.
      alert(error.message.includes("foreign key") || error.code === "23503"
        ? "No se puede borrar: hay lotes con tramos que usan esta actividad. Quitá esos tramos primero (o desactivala)."
        : "Error: " + error.message)
      return
    }
    await cargar()
  }

  const setAct = (id: string, campo: keyof Actividad, valor: unknown) =>
    setActividades(prev => prev.map(a => a.id === id ? { ...a, [campo]: valor } : a))

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
          const conRacion = usaRacion(a.tipo)
          const sumaRacion = items.filter(i => i.modo === "pct_racion").reduce((s, i) => s + i.valor, 0)
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
                {conRacion && (
                  <span className="text-xs text-gray-500">
                    {fmtNumeroAR(a.ganancia_diaria_kg, 3)} kg/día · ración {aPct(a.racion_pct_pv)} % PV
                  </span>
                )}
                <span className="ml-auto text-xs text-gray-400">
                  {items.length} {items.length === 1 ? "concepto" : "conceptos"}
                </span>
                {!a.activo && <Badge variant="outline" className="text-[10px]">inactiva</Badge>}
              </button>

              {abierto && (
                <div className="space-y-3 p-3">
                  {/* Parámetros / rindes — las agrícolas no comen, así que no los muestran */}
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <div>
                      <label className="text-[11px] text-gray-500">Nombre</label>
                      <Input className="h-8" value={a.nombre}
                        onChange={e => setAct(a.id, "nombre", e.target.value)}
                        onBlur={() => guardarActividad(a)} />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Tipo</label>
                      <select className="h-8 w-full rounded border border-gray-200 px-2 text-sm"
                        value={a.tipo}
                        onChange={e => {
                          const tipo = e.target.value as TipoActividad
                          setAct(a.id, "tipo", tipo)
                          guardarActividad({ ...a, tipo })
                        }}>
                        {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {conRacion ? (
                      <>
                        <div>
                          <label className="text-[11px] text-gray-500">Ganancia kg/día</label>
                          <InputNumero className="h-8 text-right" dec={3}
                            valor={a.ganancia_diaria_kg}
                            onCommit={n => guardarActividad({ ...a, ganancia_diaria_kg: n })} />
                          <p className="mt-0.5 text-[10px] text-gray-400">el rinde</p>
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500">Ración % PV</label>
                          <InputNumero className="h-8 text-right"
                            valor={a.racion_pct_pv * 100}
                            onCommit={n => guardarActividad({ ...a, racion_pct_pv: n / 100 })} />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-500">Mortandad %</label>
                          <InputNumero className="h-8 text-right"
                            valor={a.pct_mortandad * 100}
                            onCommit={n => guardarActividad({ ...a, pct_mortandad: n / 100 })} />
                        </div>
                      </>
                    ) : (
                      <p className="col-span-3 self-end text-[11px] text-gray-400">
                        Una actividad agrícola no lleva ración ni ganancia diaria: sus costos van
                        por hectárea o como % de lo producido.
                      </p>
                    )}
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
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-[10px] text-gray-500">
                              <th className="py-1 text-left font-medium">Concepto</th>
                              <th className="py-1 text-left font-medium">Cómo escala</th>
                              <th className="py-1 text-right font-medium">Valor</th>
                              <th className="py-1 text-left font-medium">Unidad</th>
                              <th className="py-1 text-left font-medium">Moneda</th>
                              <th className="py-1 text-left font-medium">Cuándo</th>
                              <th className="py-1 text-right font-medium">$/unidad</th>
                              <th className="py-1" />
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(i => {
                              const directo = esMontoDirecto(i.modo)
                              const esPct = i.modo === "pct_racion" || i.modo === "pct_produccion"
                              return (
                                <tr key={i.id} className="border-b border-gray-100 last:border-0">
                                  <td className="py-1 pr-2">
                                    <Input className="h-7 min-w-[7rem] text-xs" value={i.concepto}
                                      onChange={e => setInsumos(prev => prev.map(x => x.id === i.id ? { ...x, concepto: e.target.value } : x))}
                                      onBlur={() => guardarInsumo(i)} />
                                  </td>
                                  <td className="py-1 pr-2">
                                    <select className="h-7 w-full min-w-[9rem] rounded border border-gray-200 px-1 text-xs"
                                      value={i.modo}
                                      onChange={e => {
                                        const modo = e.target.value as ModoCosto
                                        guardarInsumo(i, {
                                          modo,
                                          momento: MOMENTO_POR_DEFECTO[modo],
                                          // El % de la ración se mide siempre en kg y el monto
                                          // directo no tiene unidad: no tiene sentido pedirla.
                                          unidad: modo === "pct_racion" ? "kg" : esMontoDirecto(modo) ? null : i.unidad,
                                        })
                                      }}>
                                      {MODOS.map(m => <option key={m} value={m}>{ETIQUETA_MODO[m]}</option>)}
                                    </select>
                                  </td>
                                  <td className="py-1 pr-2">
                                    <InputNumero className="h-7 w-20 text-right text-xs"
                                      valor={esPct ? i.valor * 100 : i.valor}
                                      onCommit={n => guardarInsumo(i, { valor: esPct ? n / 100 : n })} />
                                    {esPct && <span className="ml-0.5 text-[10px] text-gray-400">%</span>}
                                  </td>
                                  <td className="py-1 pr-2 text-gray-500">
                                    {/* Con % de la ración la unidad ya se sabe (kg) y con un
                                        monto directo no aplica: no se pide. */}
                                    {i.modo === "pct_racion" ? <span className="text-[10px] text-gray-400">kg</span>
                                      : directo ? <span className="text-[10px] text-gray-300">—</span> : (
                                        <Input className="h-7 w-16 text-xs" value={i.unidad ?? ""}
                                          onChange={e => setInsumos(prev => prev.map(x => x.id === i.id ? { ...x, unidad: e.target.value } : x))}
                                          onBlur={() => guardarInsumo(i)} />
                                      )}
                                  </td>
                                  <td className="py-1 pr-2">
                                    <select className="h-7 rounded border border-gray-200 px-1 text-xs"
                                      value={i.moneda ?? "ARS"}
                                      onChange={e => guardarInsumo(i, { moneda: e.target.value as "ARS" | "USD" })}>
                                      <option value="ARS">$</option>
                                      <option value="USD">US$</option>
                                    </select>
                                  </td>
                                  <td className="py-1 pr-2">
                                    <select className="h-7 w-full min-w-[8rem] rounded border border-gray-200 px-1 text-xs"
                                      value={i.momento}
                                      onChange={e => guardarInsumo(i, { momento: e.target.value as MomentoCosto })}>
                                      {MOMENTOS.map(m => <option key={m} value={m}>{ETIQUETA_MOMENTO[m]}</option>)}
                                    </select>
                                  </td>
                                  <td className="py-1 pr-2">
                                    {directo ? <span className="block text-right text-gray-300">—</span> : (
                                      <InputNumero className="h-7 w-20 text-right text-xs"
                                        valor={i.precio_unitario ?? 0}
                                        onCommit={n => guardarInsumo(i, { precio_unitario: n })} />
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
                      </div>
                    )}

                    {items.some(i => i.modo === "pct_racion") && Math.abs(sumaRacion - 1) > 0.001 && (
                      <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
                        Los “% de la ración” suman <strong>{fmtNumeroAR(sumaRacion * 100, 1)} %</strong> y
                        deberían sumar 100 %. Lo que falta es ración que no se está costeando.
                      </p>
                    )}
                    {items.some(i => i.modo === "pct_produccion") && (
                      <p className="mt-1 text-[10px] text-gray-500">
                        Los costos “% de lo producido” necesitan el valor de la producción: sale de
                        la venta del lote, o se pone a mano en la simulación.
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

                  <Simulador actividad={a} insumos={items} tiposCambio={tiposCambio} />
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
// SÓLO MUESTRA. No guarda nada y no crea ningún tramo: es un tablero de prueba para ver si
// los parámetros están bien cargados antes de atar la actividad a un lote real. Lo que se
// plasma en el presupuesto son los tramos del lote (Productivo → Evolución Rodeo).
//
// Las fechas arrancan VACÍAS a propósito: se puede estar presupuestando el año que viene, y
// dar por sentado que el período empieza hoy sería meter una suposición en un simulador.

function Simulador({ actividad, insumos, tiposCambio }: {
  actividad: Actividad; insumos: InsumoActividad[]; tiposCambio: PuntoSerie[]
}) {
  const [ver, setVer] = useState(false)
  const [cabezas, setCabezas] = useState("100")
  const [peso, setPeso] = useState("220")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [has, setHas] = useState("0")
  const [produccion, setProduccion] = useState("0")

  const conRacion = usaRacion(actividad.tipo)
  const necesitaProduccion = insumos.some(i => i.modo === "pct_produccion")

  const meses = useMemo(() => {
    if (!desde || !hasta) return []
    const t: Tramo = {
      actividad, insumos,
      cabezas: parseNumeroAR(cabezas),
      desde, hasta,
      peso_inicial_kg: parseNumeroAR(peso),
      hectareas: parseNumeroAR(has),
      valor_produccion: parseNumeroAR(produccion),
      tiposCambio,
    }
    return consumoMensual(t)
  }, [actividad, insumos, cabezas, peso, desde, hasta, has, produccion, tiposCambio])

  const total = meses.reduce((s, m) => s + m.costo_total, 0)
  const cab = parseNumeroAR(cabezas)
  const conceptos = Array.from(new Set(meses.flatMap(m => m.items.map(i => i.concepto))))
  const hayUsd = meses.some(m => m.items.some(i => i.moneda === "USD"))
  const faltaTc = meses.some(m => m.items.some(i => i.moneda === "USD" && !i.tc))

  if (!ver) {
    return (
      <button type="button" onClick={() => setVer(true)}
        className="flex items-center gap-1.5 text-xs text-blue-600 underline">
        <FlaskConical className="h-3.5 w-3.5" /> Simular cómo cae el gasto en el tiempo
      </button>
    )
  }

  const campos: [string, string, (v: string) => void, string][] = [
    ...(conRacion ? [
      ["Cabezas", cabezas, setCabezas, "text"] as [string, string, (v: string) => void, string],
      ["Peso inicial kg", peso, setPeso, "text"] as [string, string, (v: string) => void, string],
    ] : []),
    ["Desde", desde, setDesde, "date"],
    ["Hasta", hasta, setHasta, "date"],
    ["Hectáreas", has, setHas, "text"],
    ...(necesitaProduccion ? [["Valor producción $", produccion, setProduccion, "text"] as [string, string, (v: string) => void, string]] : []),
  ]

  return (
    <div className="rounded border border-blue-200 bg-blue-50/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-medium text-blue-900">
          Simulación — <strong>no se guarda nada</strong>, es sólo para ver el reparto
        </p>
        <button type="button" className="text-[11px] text-gray-500 underline" onClick={() => setVer(false)}>
          ocultar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {campos.map(([label, val, set, tipo]) => (
          <div key={label}>
            <label className="text-[10px] text-gray-500">{label}</label>
            <Input type={tipo} className="h-7 text-xs" value={val}
              onChange={e => set(e.target.value)} />
          </div>
        ))}
      </div>

      {!desde || !hasta ? (
        <p className="mt-3 text-center text-xs text-gray-500">
          Poné el período que querés simular. No se asume que arranca hoy: podés estar
          presupuestando la campaña que viene.
        </p>
      ) : meses.length === 0 ? (
        <p className="mt-3 text-center text-xs text-amber-600">
          “Hasta” tiene que ser posterior a “Desde”.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b text-[10px] text-gray-500">
                <th className="py-1 text-left font-medium">Mes</th>
                <th className="py-1 text-right font-medium">Días</th>
                {conRacion && <th className="py-1 text-right font-medium">Peso prom</th>}
                {conceptos.map(c => <th key={c} className="py-1 text-right font-medium">{c}</th>)}
                <th className="py-1 text-right font-medium">Costo</th>
                {conRacion && <th className="py-1 text-right font-medium">$/cab</th>}
              </tr>
            </thead>
            <tbody>
              {meses.map(m => (
                <tr key={m.mes} className="border-b border-gray-100">
                  <td className="py-1">{m.mes}</td>
                  <td className="py-1 text-right text-gray-500">{m.dias}</td>
                  {conRacion && <td className="py-1 text-right text-gray-500">{fmtNumeroAR(m.peso_prom_kg, 1)}</td>}
                  {conceptos.map(c => {
                    const it = m.items.find(i => i.concepto === c)
                    if (!it) return <td key={c} className="py-1 text-right text-gray-300">—</td>
                    return (
                      <td key={c} className="py-1 text-right text-gray-600"
                        title={it.moneda === "USD" ? `US$${fmtNumeroAR(it.monto_origen, 0)} × TC ${it.tc ?? "?"}` : undefined}>
                        {esMontoDirecto(it.modo)
                          ? (it.moneda === "USD"
                            ? <>US${fmtNumeroAR(it.monto_origen, 0)}</>
                            : pesos(it.costo))
                          : `${fmtNumeroAR(it.cantidad, 0)} ${it.unidad ?? ""}`}
                      </td>
                    )
                  })}
                  <td className="py-1 text-right font-medium">{pesos(m.costo_total)}</td>
                  {conRacion && <td className="py-1 text-right text-gray-500">{cab > 0 ? pesos(m.costo_total / cab) : "—"}</td>}
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1">Total</td>
                <td className="py-1 text-right">{meses.reduce((s, m) => s + m.dias, 0)}</td>
                {conRacion && <td />}
                {conceptos.map(c => {
                  const items = meses.flatMap(m => m.items).filter(i => i.concepto === c)
                  const primero = items[0]
                  if (!primero) return <td key={c} />
                  return (
                    <td key={c} className="py-1 text-right">
                      {esMontoDirecto(primero.modo)
                        ? (primero.moneda === "USD"
                          ? `US$${fmtNumeroAR(items.reduce((s, i) => s + i.monto_origen, 0), 0)}`
                          : pesos(items.reduce((s, i) => s + i.costo, 0)))
                        : fmtNumeroAR(items.reduce((s, i) => s + i.cantidad, 0), 0)}
                    </td>
                  )
                })}
                <td className="py-1 text-right">{pesos(total)}</td>
                {conRacion && <td className="py-1 text-right">{cab > 0 ? pesos(total / cab) : "—"}</td>}
              </tr>
            </tbody>
          </table>

          {conRacion && (
            <p className="mt-1.5 text-[10px] text-gray-500">
              El consumo diario <strong>sube a lo largo del tramo</strong>: la ración es un % del
              peso vivo y el animal engorda. Por eso cada mes usa su propio peso promedio.
            </p>
          )}
          {hayUsd && (
            <p className="mt-1 text-[10px] text-gray-500">
              Los montos en US$ se pasan a pesos al <strong>TC presupuestado de cada mes</strong>
              {" "}(se arrastra el último cargado). Pasá el mouse por la celda para ver el TC usado.
            </p>
          )}
          {faltaTc && (
            <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
              Hay meses sin TC presupuestado cargado: esos montos en US$ dan $0. Cargalo en
              Precios y TC.
            </p>
          )}
          {meses.some(m => m.items.some(i => i.modo === "pct_produccion" && i.costo === 0)) && (
            <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
              Hay un costo “% de lo producido” sin valor de producción: da $0.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
