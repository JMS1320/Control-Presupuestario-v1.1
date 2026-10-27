"use client"

/**
 * 💉 PLAN SANITARIO — A-FEAT-1380. Solapa de Productivo.
 *
 * Lo que ve el usuario, de arriba a abajo (pensado primero para el celular):
 *   1. Para atender: lo vencido, lo hecho fuera de fecha sin explicar y lo que falta < 1 mes.
 *   2. Sugerencias de juntar tareas que caen cerca para la misma hacienda.
 *   3. Propuestas de cambio (de quien no aprueba, ej. Enrique) — Aceptar / Rechazar.
 *   4. El calendario de la campaña: hacienda × mes, con cada tarea en su color.
 *
 * Lo sucedido NO se carga acá: son las órdenes de aplicación. Acá sólo se reconoce cuál orden cumplió
 * cada tarea y se deja la huella (se hizo / no se hizo y por qué / se movió). La IATF sí se carga acá,
 * porque es UNA carga que arma cuatro órdenes (dispositivos, retiro, IA, entore).
 *
 * Permisos: ver/editar = la pestaña `productivo.plan-sanitario`. Aprobar = la acción
 * `productivo.plan-sanitario.aprobar`: quien no la tiene, propone y espera el OK.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { traerTodo } from "@/lib/supabase-paginado"
import { hoyArgentina } from "@/lib/fechas"
import { etiquetaPersona } from "@/lib/auth/identidad"
import { usePuedeEditar, usePuedeVer } from "@/components/contexto-permisos"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import {
  ocurrenciasDeCampania, avisos, sugerirAgrupar, campaniaDe, nombreCampania, fechaCorta, difDias, sumarDias,
  fechasIatf, chequearIatf, chequearEntore, moverPideExplicacion, fechaEnCampania,
  type TareaPlan, type RegistroPlan, type Hecho, type Ocurrencia, type EstadoOcurrencia, type IatfCargada, type Sugerencia,
} from "@/lib/productivo/plan-sanitario"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Syringe, Pencil } from "lucide-react"

const RECURSO = "productivo.plan-sanitario"
const ps = () => supabase.schema("productivo")

export const GRUPOS = ["Vacas", "Vaquillonas", "Toros", "Terneros al pie", "Recría", "CUT", "Caballos", "Campo"]
const COLUMNAS: Record<string, string> = {
  servicio: "Servicio y parición", veterinario: "Sanidad", manejo: "Manejo", ventas: "Ventas y selección",
  caballos: "Caballos", pasto: "Pasto y campo",
}
const MESES = ["Jul", "Ago", "Sep", "Oct", "Nov", "Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun"]

const ESTILO: Record<EstadoOcurrencia, { icono: string; clase: string; texto: string }> = {
  hecha: { icono: "✅", clase: "bg-green-50 border-green-300 text-green-900", texto: "hecha" },
  hecha_sin_explicar: { icono: "⚠️", clase: "bg-amber-50 border-amber-400 text-amber-900", texto: "hecha fuera de fecha — falta anotar por qué" },
  explicada: { icono: "📝", clase: "bg-slate-50 border-slate-300 text-slate-700", texto: "no se hizo (con motivo)" },
  vencida: { icono: "🔴", clase: "bg-red-50 border-red-400 text-red-900", texto: "pasó sin registro — anotar si se hizo o por qué no" },
  proxima: { icono: "🟡", clase: "bg-yellow-50 border-yellow-400 text-yellow-900", texto: "falta menos de 1 mes" },
  proyectada: { icono: "⚪", clase: "bg-white border-slate-300 text-slate-700", texto: "prevista" },
  deseable: { icono: "▫️", clase: "bg-white border-dashed border-slate-300 text-slate-500", texto: "deseable (no reclama)" },
}

type FilaIatf = {
  id: string; anio: number; fecha_dispositivos: string; fecha_retiro: string; fecha_ia: string; fecha_entore: string
  orden_dispositivos_id: string | null; orden_retiro_id: string | null; orden_ia_id: string | null; orden_entore_id: string | null
  explicacion: string | null; observaciones: string | null; autor: string | null
  iatf_toros: { id: string; rodeo: string; categoria_hacienda_id: string | null; cabezas: number | null; toros: string | null; cantidad_toros: number | null }[]
}
type Propuesta = {
  id: string; tarea_id: string | null; tipo: string; cambios: any; antes: any; campania: number | null
  nota: string | null; autor: string | null; estado: string; created_at: string
}
type OrdenLista = { id: string; fecha: string; textos: string[]; categorias: string[] }

/** 'MM-DD' ↔ 'dd/mm' para que se escriba como se habla */
const aDdMm = (mmdd: string | null) => mmdd ? `${mmdd.slice(3, 5)}/${mmdd.slice(0, 2)}` : ""
function aMmDd(ddmm: string): string | null {
  const m = ddmm.trim().match(/^(\d{1,2})[/-](\d{1,2})$/)
  if (!m) return null
  const d = parseInt(m[1], 10), mes = parseInt(m[2], 10)
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null
  return `${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}
const cuando = (faltan: number) => faltan === 0 ? "hoy" : faltan > 0 ? `en ${faltan} día${faltan === 1 ? "" : "s"}` : `hace ${-faltan} día${faltan === -1 ? "" : "s"}`

export function TabPlanSanitario() {
  const hoy = hoyArgentina()
  const puedeVer = usePuedeVer()
  const puedeEditar = usePuedeEditar()
  const editable = puedeEditar(RECURSO)
  const aprueba = puedeVer("productivo.plan-sanitario.aprobar") && editable

  const [cargando, setCargando] = useState(true)
  const [faltaBase, setFaltaBase] = useState(false)
  const [tareas, setTareas] = useState<TareaPlan[]>([])
  const [registros, setRegistros] = useState<RegistroPlan[]>([])
  const [propuestas, setPropuestas] = useState<Propuesta[]>([])
  const [iatfRows, setIatfRows] = useState<FilaIatf[]>([])
  const [ordenes, setOrdenes] = useState<OrdenLista[]>([])
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([])
  const [yo, setYo] = useState<string | null>(null)
  const [campania, setCampania] = useState(() => campaniaDe(hoyArgentina()))

  const [detalle, setDetalle] = useState<Ocurrencia | null>(null)
  const [editarTarea, setEditarTarea] = useState<TareaPlan | "nueva" | null>(null)
  const [verPlan, setVerPlan] = useState(false)
  const [iatfAbierta, setIatfAbierta] = useState<{ campania: number } | null>(null)
  const [juntar, setJuntar] = useState<Sugerencia | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [t, r, p, i, o, c] = await Promise.all([
        ps().from("plan_sanitario_tareas").select("*").order("orden"),
        traerTodo((d, h) => ps().from("plan_sanitario_registro").select("*").range(d, h)),
        ps().from("plan_sanitario_propuestas").select("*").eq("estado", "pendiente").order("created_at"),
        ps().from("iatf").select("*, iatf_toros(*)").order("fecha_ia"),
        traerTodo((d, h) => ps().from("ordenes_aplicacion")
          .select("id, fecha, estado, lineas_orden_aplicacion(insumo_nombre), lineas_orden_labores(labores(nombre)), categorias_hacienda(nombre), ordenes_aplicacion_rodeos(categorias_hacienda(nombre))")
          .eq("estado", "ejecutada").order("fecha").range(d, h)),
        ps().from("categorias_hacienda").select("id, nombre").eq("activo", true).order("nombre"),
      ])
      if (t.error) {
        // la tabla no existe todavía = falta correr scripts/106
        if (/plan_sanitario_tareas|does not exist|schema cache/i.test(t.error.message)) { setFaltaBase(true); return }
        throw new Error(t.error.message)
      }
      setFaltaBase(false)
      setTareas((t.data ?? []) as TareaPlan[])
      setRegistros((r.data ?? []) as RegistroPlan[])
      setPropuestas((p.data ?? []) as Propuesta[])
      setIatfRows((i.data ?? []) as FilaIatf[])
      setOrdenes((o.data ?? []).map((x: any) => ({
        id: x.id, fecha: x.fecha,
        textos: [
          ...(x.lineas_orden_labores ?? []).map((l: any) => l.labores?.nombre).filter(Boolean),
          ...(x.lineas_orden_aplicacion ?? []).map((l: any) => l.insumo_nombre).filter(Boolean),
        ],
        categorias: [x.categorias_hacienda?.nombre, ...(x.ordenes_aplicacion_rodeos ?? []).map((r: any) => r.categorias_hacienda?.nombre)].filter(Boolean),
      })))
      setCategorias((c.data ?? []) as any)
      for (const res of [r, o]) if (res.error) toast.error(`No se pudo leer todo: ${res.error.message}`)
    } catch (e: any) {
      toast.error(`Error al cargar el plan: ${e.message ?? e}`)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setYo(etiquetaPersona(data.user))) }, [])

  const hechos: Hecho[] = useMemo(() => ordenes.map(o => ({ orden_id: o.id, fecha: o.fecha, textos: o.textos, categorias: o.categorias })), [ordenes])
  const iatfs = useMemo(() => {
    const m: Record<number, IatfCargada> = {}
    for (const f of iatfRows) m[campaniaDe(f.fecha_ia)] = f
    return m
  }, [iatfRows])
  const ocs = useMemo(() => ocurrenciasDeCampania(tareas, campania, hechos, registros, hoy, iatfs), [tareas, campania, hechos, registros, hoy, iatfs])
  // Los avisos miran la campaña actual Y la anterior (lo vencido de junio no desaparece el 1/7)
  const pendientes = useMemo(() => {
    const actual = campaniaDe(hoy)
    const todas = [...ocurrenciasDeCampania(tareas, actual - 1, hechos, registros, hoy, iatfs), ...ocurrenciasDeCampania(tareas, actual, hechos, registros, hoy, iatfs)]
    return avisos(todas).filter(o => o.faltan >= -365)
  }, [tareas, hechos, registros, hoy, iatfs])
  const sugerencias = useMemo(() => {
    const actual = campaniaDe(hoy)
    return sugerirAgrupar([...ocurrenciasDeCampania(tareas, actual, hechos, registros, hoy, iatfs), ...ocurrenciasDeCampania(tareas, actual + 1, hechos, registros, hoy, iatfs)], hoy)
  }, [tareas, hechos, registros, hoy, iatfs])

  // ── Escrituras ──────────────────────────────────────────────────────────────────────────────
  const guardarRegistro = async (o: Ocurrencia, cambios: Partial<RegistroPlan>) => {
    const fila = {
      tarea_id: o.tarea.id, campania: o.campania,
      estado: cambios.estado ?? o.registro?.estado ?? "hecha",
      fecha: cambios.fecha !== undefined ? cambios.fecha : o.registro?.fecha ?? null,
      orden_id: cambios.orden_id !== undefined ? cambios.orden_id : o.registro?.orden_id ?? null,
      explicacion: cambios.explicacion !== undefined ? cambios.explicacion : o.registro?.explicacion ?? null,
      autor: yo, updated_at: new Date().toISOString(),
    }
    const { error } = await ps().from("plan_sanitario_registro").upsert(fila, { onConflict: "tarea_id,campania" })
    if (error) { toast.error(`No se guardó: ${error.message}`); return false }
    return true
  }

  const proponer = async (p: { tarea_id: string | null; tipo: string; cambios: any; antes?: any; campania?: number | null; nota?: string | null }) => {
    const { error } = await ps().from("plan_sanitario_propuestas").insert({ ...p, autor: yo })
    if (error) { toast.error(`No se guardó la propuesta: ${error.message}`); return false }
    toast.success("Propuesta enviada: queda pendiente hasta que se acepte")
    return true
  }

  /** Aplica una propuesta (o un cambio directo de quien aprueba). */
  const aplicar = async (p: { tarea_id: string | null; tipo: string; cambios: any; campania?: number | null }) => {
    if (p.tipo === "nueva") {
      const { error } = await ps().from("plan_sanitario_tareas").insert({ ...p.cambios, actualizado_por: yo })
      if (error) throw new Error(error.message)
    } else if (p.tipo === "editar" || p.tipo === "desactivar") {
      const cambios = p.tipo === "desactivar" ? { activa: false } : p.cambios
      const { error } = await ps().from("plan_sanitario_tareas").update({ ...cambios, actualizado_por: yo, updated_at: new Date().toISOString() }).eq("id", p.tarea_id!)
      if (error) throw new Error(error.message)
    } else if (p.tipo === "programar") {
      // { tareas: [{tarea_id, campania}], fecha, explicacion }
      for (const t of p.cambios.tareas as { tarea_id: string; campania: number }[]) {
        const { error } = await ps().from("plan_sanitario_registro").upsert({
          tarea_id: t.tarea_id, campania: t.campania, estado: "programada", fecha: p.cambios.fecha,
          explicacion: p.cambios.explicacion ?? null, autor: yo, updated_at: new Date().toISOString(),
        }, { onConflict: "tarea_id,campania" })
        if (error) throw new Error(error.message)
      }
    }
  }

  const resolverPropuesta = async (p: Propuesta, aceptar: boolean) => {
    try {
      if (aceptar) await aplicar(p)
      const { error } = await ps().from("plan_sanitario_propuestas").update({
        estado: aceptar ? "aceptada" : "rechazada", resuelto_por: yo, resuelto_at: new Date().toISOString(),
      }).eq("id", p.id)
      if (error) throw new Error(error.message)
      toast.success(aceptar ? "Aceptada y aplicada" : "Rechazada: el plan queda como estaba")
      cargar()
    } catch (e: any) { toast.error(`No se pudo: ${e.message ?? e}`) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────────────────────
  if (cargando && tareas.length === 0 && !faltaBase) {
    return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando el plan…</div>
  }
  if (faltaBase) {
    return (
      <Card><CardContent className="p-6 text-sm space-y-2">
        <p className="font-medium">💉 El plan sanitario todavía no está en la base.</p>
        <p className="text-muted-foreground">Falta aplicar el script 106 (crea el plan, la carga de IATF y las labores que faltan). Pedíselo a Claude con tu OK.</p>
      </CardContent></Card>
    )
  }

  const nombreTarea = (id: string | null) => tareas.find(t => t.id === id)?.nombre ?? "tarea nueva"
  const misPropuestas = propuestas.filter(p => p.autor && p.autor === yo)

  return (
    <div className="space-y-4">
      <TestsDelProceso proceso="productivo/plan-sanitario" pantalla="productivo" />

      {/* Barra */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCampania(c => c - 1)} aria-label="Campaña anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium px-2">Campaña {nombreCampania(campania)}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCampania(c => c + 1)} aria-label="Campaña siguiente"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          {editable && (
            <Button size="sm" onClick={() => setIatfAbierta({ campania: campaniaDe(hoy) < campania ? campania : campaniaDe(hoy) })}>
              <Syringe className="h-4 w-4 mr-1" /> {iatfs[campaniaDe(hoy)] ? "Ver / mover IATF" : "Cargar IATF"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setVerPlan(true)}><Pencil className="h-4 w-4 mr-1" /> El plan</Button>
          <Button size="sm" variant="ghost" onClick={cargar} aria-label="Actualizar"><RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} /></Button>
        </div>
      </div>

      {/* 1 · Para atender */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Para atender {pendientes.length > 0 && <Badge variant="secondary" className="ml-1">{pendientes.length}</Badge>}</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {pendientes.length === 0 && <p className="text-sm text-muted-foreground">✓ Nada vencido ni sin explicar, y nada en el próximo mes.</p>}
          {pendientes.map(o => (
            <button key={`${o.tarea.id}|${o.campania}`} onClick={() => setDetalle(o)}
              className={`w-full text-left rounded-md border px-3 py-2 text-sm flex items-start gap-2 ${ESTILO[o.estado].clase}`}>
              <span className="text-base leading-5">{ESTILO[o.estado].icono}</span>
              <span className="flex-1 min-w-0">
                <span className="font-medium">{o.tarea.nombre}</span>
                <span className="block text-xs opacity-80">{o.tarea.grupos.join(", ")} · {o.estado === "hecha_sin_explicar" ? `hecha ${fechaCorta(o.fechaReal)} (${o.desvio! > 0 ? "+" : ""}${o.desvio} días)` : `${fechaCorta(o.esperada)} · ${cuando(o.faltan)}`}</span>
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* 2 · Juntar */}
      {sugerencias.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">💡 Se pueden juntar</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {sugerencias.map((s, k) => (
              <div key={k} className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm flex flex-wrap items-center gap-2">
                <span className="flex-1 min-w-[200px]">
                  <b>{s.grupo}</b>: {s.ocurrencias.map(o => `${o.tarea.nombre} (${fechaCorta(o.esperada)})`).join(" + ")}
                  <span className="block text-xs text-sky-900">→ las dos el {fechaCorta(s.fecha, true)}{s.pideExplicacion ? " · alguna queda fuera de su margen: pide explicación" : " · entra en el margen de todas"}</span>
                </span>
                {editable && <Button size="sm" variant="outline" onClick={() => setJuntar(s)}>{aprueba ? "Juntar" : "Proponer juntar"}</Button>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 3 · Propuestas */}
      {aprueba && propuestas.length > 0 && (
        <Card className="border-violet-300">
          <CardHeader className="pb-2"><CardTitle className="text-base">✍️ Propuestas para aceptar <Badge className="ml-1 bg-violet-600">{propuestas.length}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {propuestas.map(p => (
              <div key={p.id} className="rounded-md border px-3 py-2 text-sm space-y-1">
                <div><b>{p.autor ?? "alguien"}</b> propone {textoPropuesta(p, nombreTarea)}</div>
                {p.nota && <div className="text-xs text-muted-foreground">«{p.nota}»</div>}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => resolverPropuesta(p, true)}>Aceptar</Button>
                  <Button size="sm" variant="outline" onClick={() => resolverPropuesta(p, false)}>Rechazar</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {!aprueba && misPropuestas.length > 0 && (
        <Card><CardContent className="p-3 text-sm space-y-1">
          <div className="font-medium">⏳ Mis propuestas esperando el OK ({misPropuestas.length})</div>
          {misPropuestas.map(p => <div key={p.id} className="text-xs text-muted-foreground">· {textoPropuesta(p, nombreTarea)}</div>)}
        </CardContent></Card>
      )}

      {/* 4 · Calendario */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Calendario {nombreCampania(campania)}</CardTitle>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-1">
            {(["hecha", "hecha_sin_explicar", "vencida", "proxima", "proyectada", "explicada", "deseable"] as EstadoOcurrencia[]).map(e =>
              <span key={e}>{ESTILO[e].icono} {ESTILO[e].texto.split(" —")[0]}</span>)}
            <span>⚡ la cadena la aleja de su fecha óptima</span>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="text-xs border-collapse min-w-[1100px] w-full">
            <thead>
              <tr>
                <th className="sticky left-0 bg-background z-10 text-left p-1 w-28"></th>
                {MESES.map((m, i) => {
                  const esHoy = campaniaDe(hoy) === campania && ((parseInt(hoy.slice(5, 7)) + 5) % 12) === i
                  return <th key={m} className={`p-1 font-medium text-center ${esHoy ? "bg-yellow-100 rounded" : ""}`}>{m}</th>
                })}
              </tr>
            </thead>
            <tbody>
              {GRUPOS.map(g => (
                <tr key={g} className="border-t align-top">
                  <td className="sticky left-0 bg-background z-10 p-1 font-medium">{g}</td>
                  {MESES.map((_, i) => {
                    const delMes = ocs.filter(o => o.tarea.grupos.includes(g) && ((parseInt((o.fechaReal ?? o.esperada).slice(5, 7)) + 5) % 12) === i
                      && campaniaDe(o.fechaReal ?? o.esperada) === campania)
                    return (
                      <td key={i} className="p-0.5 w-[8%]">
                        <div className="flex flex-col gap-0.5">
                          {delMes.map(o => (
                            <button key={o.tarea.id} onClick={() => setDetalle(o)} title={`${o.tarea.nombre} — ${ESTILO[o.estado].texto}`}
                              className={`text-left rounded border px-1 py-0.5 leading-tight ${ESTILO[o.estado].clase}`}>
                              {ESTILO[o.estado].icono}{o.conflicto != null ? "⚡" : ""} {o.tarea.nombre}
                              <span className="block opacity-70">{fechaCorta(o.fechaReal ?? o.esperada).slice(0, 5)}</span>
                            </button>
                          ))}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {detalle && (
        <DialogoOcurrencia o={detalle} ordenes={ordenes} editable={editable} aprueba={aprueba}
          onCerrar={() => setDetalle(null)}
          onGuardarRegistro={async (c) => { if (await guardarRegistro(detalle, c)) { toast.success("Anotado"); setDetalle(null); cargar() } }}
          onProgramar={async (fecha, explicacion) => {
            const cambios = { tareas: [{ tarea_id: detalle.tarea.id, campania: detalle.campania }], fecha, explicacion }
            if (aprueba) { try { await aplicar({ tarea_id: detalle.tarea.id, tipo: "programar", cambios }); toast.success("Movida"); setDetalle(null); cargar() } catch (e: any) { toast.error(e.message) } }
            else if (await proponer({ tarea_id: detalle.tarea.id, tipo: "programar", cambios, campania: detalle.campania, nota: explicacion })) { setDetalle(null); cargar() }
          }}
          onEditarTarea={() => { setEditarTarea(detalle.tarea); setDetalle(null) }}
          onIatf={() => { setIatfAbierta({ campania: detalle.campania }); setDetalle(null) }}
        />
      )}

      {juntar && (
        <DialogoJuntar s={juntar} aprueba={aprueba} onCerrar={() => setJuntar(null)}
          onConfirmar={async (fecha, explicacion) => {
            const cambios = { tareas: juntar.ocurrencias.map(o => ({ tarea_id: o.tarea.id, campania: o.campania })), fecha, explicacion }
            if (aprueba) { try { await aplicar({ tarea_id: null, tipo: "programar", cambios }); toast.success("Juntadas"); setJuntar(null); cargar() } catch (e: any) { toast.error(e.message) } }
            else if (await proponer({ tarea_id: null, tipo: "programar", cambios, nota: explicacion })) { setJuntar(null); cargar() }
          }} />
      )}

      {verPlan && (
        <DialogoPlan tareas={tareas} editable={editable} onCerrar={() => setVerPlan(false)}
          onEditar={(t) => { setEditarTarea(t); setVerPlan(false) }} />
      )}

      {editarTarea && (
        <DialogoTarea tarea={editarTarea === "nueva" ? null : editarTarea} tareas={tareas} aprueba={aprueba} editable={editable}
          onCerrar={() => setEditarTarea(null)}
          onGuardar={async (tipo, cambios, antes, nota) => {
            const tarea_id = editarTarea === "nueva" ? null : editarTarea.id
            if (aprueba) {
              try { await aplicar({ tarea_id, tipo, cambios }); toast.success("Plan actualizado"); setEditarTarea(null); cargar() } catch (e: any) { toast.error(e.message) }
            } else if (await proponer({ tarea_id, tipo, cambios, antes, nota })) { setEditarTarea(null); cargar() }
          }} />
      )}

      {iatfAbierta && (
        <DialogoIatf campania={iatfAbierta.campania} existente={iatfRows.find(f => campaniaDe(f.fecha_ia) === iatfAbierta.campania) ?? null}
          categorias={categorias} tareaIatf={tareas.find(t => t.codigo === "iatf") ?? null} yo={yo} hoy={hoy}
          onCerrar={() => setIatfAbierta(null)} onGuardado={() => { setIatfAbierta(null); cargar() }} />
      )}
    </div>
  )
}

function textoPropuesta(p: Propuesta, nombreTarea: (id: string | null) => string): string {
  if (p.tipo === "programar") {
    const n = (p.cambios?.tareas ?? []).map((t: any) => nombreTarea(t.tarea_id)).join(" + ")
    return `${(p.cambios?.tareas ?? []).length > 1 ? "juntar" : "mover"} ${n} al ${fechaCorta(p.cambios?.fecha ?? null, true)}`
  }
  if (p.tipo === "nueva") return `agregar la tarea «${p.cambios?.nombre ?? ""}» (${aDdMm(p.cambios?.optimo_mmdd ?? null)})`
  if (p.tipo === "desactivar") return `sacar del plan «${nombreTarea(p.tarea_id)}»`
  const etiquetas: Record<string, string> = { optimo_mmdd: "fecha óptima", hasta_mmdd: "hasta", tol_antes: "margen antes", tol_despues: "margen después", nombre: "nombre", grupos: "a quién", ancla_dias: "días de la cadena", ancla_id: "cuelga de", obligatoria: "obligatoria", claves: "cómo se reconoce", detalle: "detalle", columna: "columna" }
  const fmt = (k: string, v: any) => k.endsWith("mmdd") ? aDdMm(v) : Array.isArray(v) ? v.join(", ") : k === "ancla_id" ? nombreTarea(v) : String(v ?? "—")
  const partes = Object.entries(p.cambios ?? {}).map(([k, v]) => `${etiquetas[k] ?? k}: ${fmt(k, p.antes?.[k])} → ${fmt(k, v)}`)
  return `cambiar «${nombreTarea(p.tarea_id)}»: ${partes.join(" · ")}`
}

// ── El detalle de una tarea en una campaña ────────────────────────────────────────────────────
function DialogoOcurrencia({ o, ordenes, editable, aprueba, onCerrar, onGuardarRegistro, onProgramar, onEditarTarea, onIatf }: {
  o: Ocurrencia; ordenes: OrdenLista[]; editable: boolean; aprueba: boolean; onCerrar: () => void
  onGuardarRegistro: (c: Partial<RegistroPlan>) => void; onProgramar: (fecha: string, explicacion: string | null) => void
  onEditarTarea: () => void; onIatf: () => void
}) {
  const [modo, setModo] = useState<null | "hecha" | "no" | "mover" | "explicar">(null)
  const [fecha, setFecha] = useState(o.fechaReal ?? hoyArgentina())
  const [ordenId, setOrdenId] = useState<string>(o.ordenId ?? "")
  const [texto, setTexto] = useState(o.registro?.explicacion ?? "")
  const esIatf = o.tarea.codigo === "iatf" || o.tarea.codigo === "entore"

  const candidatas = ordenes.filter(x => Math.abs(difDias(x.fecha, o.esperada)) <= 60).sort((a, b) => Math.abs(difDias(a.fecha, o.esperada)) - Math.abs(difDias(b.fecha, o.esperada)))
  // hecha en otra fecha: fuera de margen si se aleja tanto de la cadena como del óptimo (igual que el cálculo)
  const fueraDe = (ref: string) => { const d = difDias(fecha, ref); return d < -o.tarea.tol_antes || d > o.tarea.tol_despues }
  const fueraNuevo = modo === "hecha" && !!fecha && fueraDe(o.esperada) && moverPideExplicacion(o, fecha)
  const moverPide = modo === "mover" && fecha ? moverPideExplicacion(o, fecha) : false
  const faltaTexto = (modo === "no" || modo === "explicar" || fueraNuevo || moverPide) && !texto.trim()
  const orden = ordenes.find(x => x.id === o.ordenId)

  return (
    <Dialog open onOpenChange={v => !v && onCerrar()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{ESTILO[o.estado].icono} {o.tarea.nombre}</DialogTitle>
          <DialogDescription>{o.tarea.grupos.join(", ")} · campaña {nombreCampania(o.campania)} · {ESTILO[o.estado].texto}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <Linea t="Fecha óptima">{o.hasta ? `del ${fechaCorta(o.optimo)} al ${fechaCorta(o.hasta)}` : fechaCorta(o.optimo, true)} · margen {o.tarea.tol_antes} días antes / {o.tarea.tol_despues} después</Linea>
          <Linea t="Se espera">{fechaCorta(o.esperada, true)} ({cuando(o.faltan)}) — {o.origen}</Linea>
          {o.conflicto != null && (
            <div className="rounded border border-amber-400 bg-amber-50 p-2 text-xs">⚡ Por la cadena cae {Math.abs(o.conflicto)} días {o.conflicto < 0 ? "antes" : "después"} de su fecha óptima. Decidir: hacerla por cadena, en su óptimo, o moverla (y anotar por qué).</div>
          )}
          {o.fechaReal && (
            <Linea t="Se hizo">{fechaCorta(o.fechaReal, true)}{o.desvio ? ` (${o.desvio > 0 ? "+" : ""}${o.desvio} días)` : " (en fecha)"}
              {orden && <span className="block text-xs text-muted-foreground">{o.reconocida ? "orden reconocida sola" : "orden vinculada"}: {orden.textos.join(" · ")}</span>}
              {!orden && o.ordenId == null && <span className="block text-xs text-muted-foreground">sin orden vinculada</span>}
            </Linea>
          )}
          {o.registro?.explicacion && <Linea t="Explicación">«{o.registro.explicacion}»{o.registro.autor ? ` — ${o.registro.autor}` : ""}</Linea>}
          {o.tarea.detalle && <p className="text-xs text-muted-foreground">{o.tarea.detalle}</p>}
          {o.tarea.claves.length > 0 && <p className="text-xs text-muted-foreground">Se reconoce por: {o.tarea.claves.join(", ")}</p>}
        </div>

        {editable && !modo && (
          <div className="flex flex-wrap gap-2 pt-2">
            {esIatf ? <Button size="sm" onClick={onIatf}>{o.fechaReal ? "Ver / mover la IATF" : "Cargar IATF"}</Button> : <>
              <Button size="sm" onClick={() => setModo("hecha")}>✅ Se hizo</Button>
              <Button size="sm" variant="outline" onClick={() => setModo("no")}>📝 No se hizo</Button>
              {!o.fechaReal && <Button size="sm" variant="outline" onClick={() => { setFecha(o.esperada); setModo("mover") }}>{aprueba ? "Mover" : "Proponer otra fecha"}</Button>}
              {o.estado === "hecha_sin_explicar" && <Button size="sm" variant="outline" onClick={() => setModo("explicar")}>Anotar por qué</Button>}
            </>}
            <Button size="sm" variant="ghost" onClick={onEditarTarea}><Pencil className="h-3.5 w-3.5 mr-1" />{aprueba ? "Editar la tarea" : "Proponer cambio"}</Button>
          </div>
        )}

        {modo && (
          <div className="space-y-2 border-t pt-3">
            {(modo === "hecha" || modo === "mover") && (
              <div><Label className="text-xs">{modo === "hecha" ? "¿Cuándo se hizo?" : "Nueva fecha"}</Label>
                <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            )}
            {modo === "hecha" && (
              <div><Label className="text-xs">¿Con qué orden de aplicación? (opcional)</Label>
                <Select value={ordenId || "_"} onValueChange={v => setOrdenId(v === "_" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">Sin orden (todavía no está cargada)</SelectItem>
                    {candidatas.map(x => <SelectItem key={x.id} value={x.id}>{fechaCorta(x.fecha)} · {x.textos.slice(0, 4).join(", ")}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!ordenId && <p className="text-xs text-muted-foreground pt-1">Lo hecho queda anotado igual; la orden con insumos (para el stock) se carga en Insumos → Órdenes de Aplicación.</p>}
              </div>
            )}
            <div>
              <Label className="text-xs">{modo === "no" ? "¿Por qué no se hizo?" : modo === "explicar" ? "¿Por qué se hizo fuera de fecha?" : "Explicación"}
                {(fueraNuevo || moverPide) && <span className="text-amber-700"> — fuera del margen: es obligatoria</span>}</Label>
              <Textarea rows={2} value={texto} onChange={e => setTexto(e.target.value)} placeholder={modo === "mover" ? "ej.: se junta con el tacto" : ""} />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setModo(null)}>Volver</Button>
              <Button disabled={faltaTexto || ((modo === "hecha" || modo === "mover") && !fecha)} onClick={() => {
                if (modo === "hecha") onGuardarRegistro({ estado: "hecha", fecha, orden_id: ordenId || null, explicacion: texto.trim() || null })
                else if (modo === "no") onGuardarRegistro({ estado: "no_se_hizo", fecha: null, orden_id: null, explicacion: texto.trim() })
                else if (modo === "explicar") onGuardarRegistro({ estado: "hecha", fecha: o.fechaReal, orden_id: o.ordenId, explicacion: texto.trim() })
                else onProgramar(fecha, texto.trim() || null)
              }}>{modo === "mover" && !aprueba ? "Proponer" : "Guardar"}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

const Linea = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[110px_1fr] gap-2"><span className="text-muted-foreground">{t}</span><span>{children}</span></div>
)

// ── Juntar ────────────────────────────────────────────────────────────────────────────────────
function DialogoJuntar({ s, aprueba, onCerrar, onConfirmar }: { s: Sugerencia; aprueba: boolean; onCerrar: () => void; onConfirmar: (fecha: string, explicacion: string | null) => void }) {
  const [fecha, setFecha] = useState(s.fecha)
  const [texto, setTexto] = useState(`Juntadas: ${s.ocurrencias.map(o => o.tarea.nombre).join(" + ")}`)
  const fuera = s.ocurrencias.filter(o => moverPideExplicacion(o, fecha))
  return (
    <Dialog open onOpenChange={v => !v && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Juntar en {s.grupo}</DialogTitle>
          <DialogDescription>{s.ocurrencias.map(o => `${o.tarea.nombre} (${fechaCorta(o.esperada)})`).join(" + ")}</DialogDescription></DialogHeader>
        <div className="space-y-2">
          <div><Label className="text-xs">Fecha para todas</Label><Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
          {fuera.length > 0 && <p className="text-xs text-amber-700">Queda fuera del margen de: {fuera.map(o => o.tarea.nombre).join(", ")}. La explicación es obligatoria.</p>}
          <div><Label className="text-xs">Explicación</Label><Textarea rows={2} value={texto} onChange={e => setTexto(e.target.value)} /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button disabled={!fecha || (fuera.length > 0 && !texto.trim())} onClick={() => onConfirmar(fecha, texto.trim() || null)}>{aprueba ? "Juntar" : "Proponer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── El plan entero ────────────────────────────────────────────────────────────────────────────
function DialogoPlan({ tareas, editable, onCerrar, onEditar }: { tareas: TareaPlan[]; editable: boolean; onCerrar: () => void; onEditar: (t: TareaPlan | "nueva") => void }) {
  const activas = tareas.filter(t => t.activa)
  const porId = new Map(tareas.map(t => [t.id, t]))
  return (
    <Dialog open onOpenChange={v => !v && onCerrar()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>El plan</DialogTitle>
          <DialogDescription>Cada tarea con su fecha óptima y su margen. Tocá una para cambiarla.</DialogDescription></DialogHeader>
        {Object.entries(COLUMNAS).map(([col, titulo]) => {
          const de = activas.filter(t => t.columna === col).sort((a, b) => fechaEnCampania(a.optimo_mmdd, 2000).localeCompare(fechaEnCampania(b.optimo_mmdd, 2000)))
          if (de.length === 0) return null
          return (
            <div key={col} className="space-y-1">
              <div className="text-xs font-semibold uppercase text-muted-foreground pt-2">{titulo}</div>
              {de.map(t => (
                <button key={t.id} onClick={() => onEditar(t)} className="w-full text-left rounded border px-2 py-1.5 text-sm hover:bg-muted">
                  <span className="font-medium">{t.nombre}</span>{!t.obligatoria && <span className="text-xs text-muted-foreground"> · deseable</span>}
                  <span className="block text-xs text-muted-foreground">
                    {t.hasta_mmdd ? `${aDdMm(t.optimo_mmdd)} al ${aDdMm(t.hasta_mmdd)}` : aDdMm(t.optimo_mmdd)} · ±{t.tol_antes}/{t.tol_despues} días
                    {t.ancla_id ? ` · ${t.ancla_dias} días después de «${porId.get(t.ancla_id)?.nombre ?? "?"}»` : ""} · {t.grupos.join(", ")}
                  </span>
                </button>
              ))}
            </div>
          )
        })}
        {editable && <DialogFooter><Button size="sm" onClick={() => onEditar("nueva")}><Plus className="h-4 w-4 mr-1" />Tarea nueva</Button></DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}

// ── Editar / proponer una tarea ───────────────────────────────────────────────────────────────
function DialogoTarea({ tarea, tareas, aprueba, editable, onCerrar, onGuardar }: {
  tarea: TareaPlan | null; tareas: TareaPlan[]; aprueba: boolean; editable: boolean; onCerrar: () => void
  onGuardar: (tipo: "nueva" | "editar" | "desactivar", cambios: any, antes: any, nota: string | null) => void
}) {
  const [f, setF] = useState(() => ({
    nombre: tarea?.nombre ?? "", columna: tarea?.columna ?? "veterinario", grupos: tarea?.grupos ?? [] as string[],
    optimo: aDdMm(tarea?.optimo_mmdd ?? null), hasta: aDdMm(tarea?.hasta_mmdd ?? null),
    tol_antes: String(tarea?.tol_antes ?? 15), tol_despues: String(tarea?.tol_despues ?? 15),
    ancla_id: tarea?.ancla_id ?? "", ancla_dias: tarea?.ancla_dias != null ? String(tarea.ancla_dias) : "",
    obligatoria: tarea?.obligatoria ?? true, claves: (tarea?.claves ?? []).join(", "), detalle: tarea?.detalle ?? "",
  }))
  const [nota, setNota] = useState("")
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }))
  const optimo = aMmDd(f.optimo), hasta = f.hasta.trim() ? aMmDd(f.hasta) : null
  const invalido = !f.nombre.trim() || !optimo || (f.hasta.trim() && !hasta) || f.grupos.length === 0 || (f.ancla_id && !f.ancla_dias.trim())

  const nuevo = {
    nombre: f.nombre.trim(), columna: f.columna, grupos: f.grupos, optimo_mmdd: optimo, hasta_mmdd: hasta,
    tol_antes: parseInt(f.tol_antes) || 0, tol_despues: parseInt(f.tol_despues) || 0,
    ancla_id: f.ancla_id || null, ancla_dias: f.ancla_id ? parseInt(f.ancla_dias) || 0 : null,
    obligatoria: f.obligatoria, claves: f.claves.split(",").map(s => s.trim()).filter(Boolean), detalle: f.detalle.trim() || null,
  }
  // sólo lo que cambió (la propuesta muestra antes → después)
  const cambios: Record<string, any> = {}, antes: Record<string, any> = {}
  if (tarea) for (const [k, v] of Object.entries(nuevo)) {
    const prev = (tarea as any)[k]
    if (JSON.stringify(prev ?? null) !== JSON.stringify(v ?? null)) { cambios[k] = v; antes[k] = prev }
  }

  return (
    <Dialog open onOpenChange={v => !v && onCerrar()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{tarea ? tarea.nombre : "Tarea nueva"}</DialogTitle>
          <DialogDescription>{aprueba ? "Los cambios se aplican al guardar." : "Lo que cambies queda como propuesta hasta que lo acepten."}</DialogDescription></DialogHeader>
        <div className="space-y-2 text-sm">
          <div><Label className="text-xs">Nombre</Label><Input value={f.nombre} onChange={e => set("nombre", e.target.value)} disabled={!editable} /></div>
          <div><Label className="text-xs">A quién</Label>
            <div className="flex flex-wrap gap-1 pt-1">{GRUPOS.map(g => (
              <button key={g} type="button" disabled={!editable} onClick={() => set("grupos", f.grupos.includes(g) ? f.grupos.filter(x => x !== g) : [...f.grupos, g])}
                className={`rounded-full border px-2 py-0.5 text-xs ${f.grupos.includes(g) ? "bg-primary text-primary-foreground" : ""}`}>{g}</button>))}</div></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Fecha óptima (dd/mm)</Label><Input value={f.optimo} onChange={e => set("optimo", e.target.value)} placeholder="25/02" disabled={!editable} /></div>
            <div><Label className="text-xs">Hasta (si es ventana)</Label><Input value={f.hasta} onChange={e => set("hasta", e.target.value)} placeholder="30/09" disabled={!editable} /></div>
            <div><Label className="text-xs">Margen antes (días)</Label><Input inputMode="numeric" value={f.tol_antes} onChange={e => set("tol_antes", e.target.value)} disabled={!editable} /></div>
            <div><Label className="text-xs">Margen después (días)</Label><Input inputMode="numeric" value={f.tol_despues} onChange={e => set("tol_despues", e.target.value)} disabled={!editable} /></div>
          </div>
          <div className="grid grid-cols-[1fr_90px] gap-2">
            <div><Label className="text-xs">Cuelga de (si se corre aquella, se corre ésta)</Label>
              <Select value={f.ancla_id || "_"} onValueChange={v => set("ancla_id", v === "_" ? "" : v)} disabled={!editable}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="_">De ninguna (orbita su fecha)</SelectItem>
                  {tareas.filter(t => t.activa && t.id !== tarea?.id).map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label className="text-xs">Días después</Label><Input inputMode="numeric" value={f.ancla_dias} onChange={e => set("ancla_dias", e.target.value)} disabled={!editable || !f.ancla_id} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Columna</Label>
              <Select value={f.columna} onValueChange={v => set("columna", v)} disabled={!editable}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(COLUMNAS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <label className="flex items-center gap-2 pt-5 text-xs"><Checkbox checked={f.obligatoria} onCheckedChange={v => set("obligatoria", !!v)} disabled={!editable} /> Obligatoria (si no se hace, pide motivo)</label>
          </div>
          <div><Label className="text-xs">Se reconoce por (labores o insumos, separados por coma)</Label><Input value={f.claves} onChange={e => set("claves", e.target.value)} placeholder="Fasiolisida, Hemoglobinuria" disabled={!editable} /></div>
          <div><Label className="text-xs">Detalle</Label><Textarea rows={2} value={f.detalle} onChange={e => set("detalle", e.target.value)} disabled={!editable} /></div>
          {!aprueba && editable && <div><Label className="text-xs">Nota para quien aprueba</Label><Textarea rows={2} value={nota} onChange={e => setNota(e.target.value)} /></div>}
        </div>
        {editable && (
          <DialogFooter className="gap-2 flex-wrap">
            {tarea && <Button variant="ghost" className="mr-auto text-red-700" onClick={() => onGuardar("desactivar", { activa: false }, { activa: true }, nota.trim() || null)}>{aprueba ? "Sacar del plan" : "Proponer sacarla"}</Button>}
            <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
            <Button disabled={!!invalido || (tarea != null && Object.keys(cambios).length === 0)}
              onClick={() => onGuardar(tarea ? "editar" : "nueva", tarea ? cambios : { ...nuevo, orden: 90 }, tarea ? antes : null, nota.trim() || null)}>
              {aprueba ? "Guardar" : "Proponer"}</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── La IATF: una carga, cuatro órdenes ────────────────────────────────────────────────────────
type RodeoIatf = { sel: boolean; cabezas: string; toros: string; cantidad: string }

function DialogoIatf({ campania, existente, categorias, tareaIatf, yo, hoy, onCerrar, onGuardado }: {
  campania: number; existente: FilaIatf | null; categorias: { id: string; nombre: string }[]; tareaIatf: TareaPlan | null
  yo: string | null; hoy: string; onCerrar: () => void; onGuardado: () => void
}) {
  const optimoMmdd = tareaIatf?.optimo_mmdd ?? "10-01"
  const [fechaIa, setFechaIa] = useState(existente?.fecha_ia ?? `${campania}-${optimoMmdd}`)
  const [entore, setEntore] = useState(existente?.fecha_entore ?? sumarDias(existente?.fecha_ia ?? `${campania}-${optimoMmdd}`, 2))
  const [entoreTocado, setEntoreTocado] = useState(!!existente)
  const [explicacion, setExplicacion] = useState(existente?.explicacion ?? "")
  const [obs, setObs] = useState(existente?.observaciones ?? "")
  const [rodeos, setRodeos] = useState<Record<string, RodeoIatf>>(() => {
    const m: Record<string, RodeoIatf> = {}
    for (const t of existente?.iatf_toros ?? []) if (t.categoria_hacienda_id)
      m[t.categoria_hacienda_id] = { sel: true, cabezas: t.cabezas != null ? String(t.cabezas) : "", toros: t.toros ?? "", cantidad: t.cantidad_toros != null ? String(t.cantidad_toros) : "" }
    return m
  })
  const [guardando, setGuardando] = useState(false)

  const f = fechasIatf(fechaIa, entore)
  const chIa = fechaIa ? chequearIatf(fechaIa, optimoMmdd) : null
  const chEn = fechaIa && entore ? chequearEntore(fechaIa, entore) : null
  const pide = !!(chIa?.pideExplicacion || chEn?.pideExplicacion)
  const elegidos = Object.entries(rodeos).filter(([, r]) => r.sel)
  const totalCabezas = elegidos.reduce((s, [, r]) => s + (parseInt(r.cabezas) || 0), 0)
  // los rodeos de servicio primero (vacas y vaquillonas)
  const cats = [...categorias].sort((a, b) => Number(/vaca|vaquillona/i.test(b.nombre)) - Number(/vaca|vaquillona/i.test(a.nombre)))
  const setR = (id: string, k: keyof RodeoIatf, v: any) => setRodeos(p => ({ ...p, [id]: { ...(p[id] ?? { sel: false, cabezas: "", toros: "", cantidad: "" }), [k]: v } }))

  const guardar = async () => {
    setGuardando(true)
    const creadas: string[] = []
    try {
      const ps = supabase.schema("productivo")
      const { data: labs, error: eL } = await ps.from("labores").select("id, nombre")
        .in("nombre", ["Colocación dispositivos IATF", "Retiro dispositivos IATF", "IATF", "Servicio/Entore"])
      if (eL) throw new Error(eL.message)
      const lab = (n: string) => labs?.find(l => l.nombre === n)?.id
      if (!lab("Colocación dispositivos IATF") || !lab("Retiro dispositivos IATF") || !lab("IATF") || !lab("Servicio/Entore"))
        throw new Error("faltan las labores de la IATF (script 106)")
      const anio = parseInt(f.ia.slice(0, 4), 10)
      const pasos: { clave: "dispositivos" | "retiro" | "ia" | "entore"; fecha: string; labor: string }[] = [
        { clave: "dispositivos", fecha: f.dispositivos, labor: "Colocación dispositivos IATF" },
        { clave: "retiro", fecha: f.retiro, labor: "Retiro dispositivos IATF" },
        { clave: "ia", fecha: f.ia, labor: "IATF" },
        { clave: "entore", fecha: f.entore, labor: "Servicio/Entore" },
      ]
      let iatfId: string
      let ordenEntore: string | null
      const rodeosFilas = elegidos.map(([id, r]) => ({ categoria_hacienda_id: id, cantidad_cabezas: parseInt(r.cabezas) || 0 }))

      if (existente) {
        // MOVER: las cuatro órdenes se corren juntas; las distancias no cambian.
        const ids = { dispositivos: existente.orden_dispositivos_id, retiro: existente.orden_retiro_id, ia: existente.orden_ia_id, entore: existente.orden_entore_id }
        for (const p of pasos) {
          const id = ids[p.clave]
          if (!id) continue
          const { error } = await ps.from("ordenes_aplicacion").update({ fecha: p.fecha, cantidad_cabezas: totalCabezas }).eq("id", id)
          if (error) throw new Error(error.message)
          await ps.from("ordenes_aplicacion_rodeos").delete().eq("orden_id", id)
          if (rodeosFilas.length) { const { error: e2 } = await ps.from("ordenes_aplicacion_rodeos").insert(rodeosFilas.map(r => ({ ...r, orden_id: id }))); if (e2) throw new Error(e2.message) }
        }
        const { error } = await ps.from("iatf").update({
          fecha_dispositivos: f.dispositivos, fecha_retiro: f.retiro, fecha_ia: f.ia, fecha_entore: f.entore, anio,
          explicacion: explicacion.trim() || null, observaciones: obs.trim() || null, autor: yo, updated_at: new Date().toISOString(),
        }).eq("id", existente.id)
        if (error) throw new Error(error.message)
        await ps.from("iatf_toros").delete().eq("iatf_id", existente.id)
        iatfId = existente.id
        ordenEntore = existente.orden_entore_id
      } else {
        const ordenIds: Record<string, string> = {}
        for (const p of pasos) {
          const { data, error } = await ps.from("ordenes_aplicacion").insert({
            fecha: p.fecha, cantidad_cabezas: totalCabezas, estado: p.fecha <= hoy ? "ejecutada" : "planificada",
            observaciones: `IATF ${fechaCorta(f.ia)} — cargada desde Plan sanitario${obs.trim() ? ` · ${obs.trim()}` : ""}`,
          }).select("id").single()
          if (error || !data) throw new Error(error?.message ?? "no se creó la orden")
          ordenIds[p.clave] = data.id
          creadas.push(`${p.labor} ${fechaCorta(p.fecha)}`)
          if (rodeosFilas.length) { const { error: e2 } = await ps.from("ordenes_aplicacion_rodeos").insert(rodeosFilas.map(r => ({ ...r, orden_id: data.id }))); if (e2) throw new Error(e2.message) }
          const { error: e3 } = await ps.from("lineas_orden_labores").insert({ orden_id: data.id, labor_id: lab(p.labor) })
          if (e3) throw new Error(e3.message)
        }
        const { data: fila, error } = await ps.from("iatf").insert({
          anio, fecha_dispositivos: f.dispositivos, fecha_retiro: f.retiro, fecha_ia: f.ia, fecha_entore: f.entore,
          orden_dispositivos_id: ordenIds.dispositivos, orden_retiro_id: ordenIds.retiro, orden_ia_id: ordenIds.ia, orden_entore_id: ordenIds.entore,
          explicacion: explicacion.trim() || null, observaciones: obs.trim() || null, autor: yo,
        }).select("id").single()
        if (error || !fila) throw new Error(error?.message ?? "no se guardó la IATF")
        iatfId = fila.id
        ordenEntore = ordenIds.entore
      }

      // Los toros que se echaron, por rodeo
      const toros = elegidos.map(([id, r]) => ({
        iatf_id: iatfId, categoria_hacienda_id: id, rodeo: categorias.find(c => c.id === id)?.nombre ?? id,
        cabezas: parseInt(r.cabezas) || null, toros: r.toros.trim() || null, cantidad_toros: parseInt(r.cantidad) || null,
      }))
      if (toros.length) { const { error } = await ps.from("iatf_toros").insert(toros); if (error) throw new Error(error.message) }

      // El ciclo de cría del año: el servicio arranca con la IA (mismo criterio que la labor Servicio/Entore)
      for (const t of toros) {
        const { error } = await ps.from("ciclos_cria").upsert({
          anio_servicio: anio, rodeo: t.rodeo, fecha_servicio: f.ia, cabezas_servicio: t.cabezas ?? 0, orden_servicio_id: ordenEntore,
        }, { onConflict: "anio_servicio,rodeo" })
        if (error) toast.error(`Ciclo de cría ${t.rodeo}: ${error.message}`)
      }
      toast.success(existente ? "IATF movida (las cuatro órdenes juntas)" : `IATF cargada: ${creadas.length} órdenes y el ciclo de cría ${anio}`)
      onGuardado()
    } catch (e: any) {
      toast.error(`No se terminó de guardar: ${e.message ?? e}${creadas.length ? ` · ya se crearon: ${creadas.join(", ")} (revisar en Órdenes de Aplicación)` : ""}`, { duration: 15000 })
    } finally { setGuardando(false) }
  }

  const color = (c: { pideExplicacion: boolean; fueraDeRango: boolean } | null) => !c ? "" : c.fueraDeRango ? "text-red-700" : c.pideExplicacion ? "text-amber-700" : "text-green-700"

  return (
    <Dialog open onOpenChange={v => !v && onCerrar()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>💉 {existente ? "IATF — ver o mover" : "Cargar IATF"} {nombreCampania(campania)}</DialogTitle>
          <DialogDescription>Poné la fecha de la inseminación: los dispositivos y el retiro se calculan solos.</DialogDescription></DialogHeader>
        <div className="space-y-3 text-sm">
          <div><Label className="text-xs">Fecha de la IATF</Label>
            <Input type="date" value={fechaIa} onChange={e => { setFechaIa(e.target.value); if (!entoreTocado && e.target.value) setEntore(sumarDias(e.target.value, 2)) }} />
            {chIa && <p className={`text-xs pt-1 ${color(chIa)}`}>{chIa.texto} (óptima {aDdMm(optimoMmdd)})</p>}</div>
          {fechaIa && (
            <div className="rounded border bg-muted/40 p-2 text-xs grid grid-cols-[1fr_auto] gap-y-0.5">
              <span>Colocación de dispositivos (IA − 10)</span><b>{fechaCorta(f.dispositivos, true)}</b>
              <span>Retiro de dispositivos (IA − 2)</span><b>{fechaCorta(f.retiro, true)}</b>
              <span>IATF</span><b>{fechaCorta(f.ia, true)}</b>
            </div>
          )}
          <div><Label className="text-xs">Entore (toros) — lleva su fecha, ~2 días después</Label>
            <Input type="date" value={entore} onChange={e => { setEntore(e.target.value); setEntoreTocado(true) }} />
            {chEn && <p className={`text-xs pt-1 ${color(chEn)}`}>{chEn.texto}</p>}</div>

          <div><Label className="text-xs">Rodeos: cabezas y toros que se echaron</Label>
            <div className="space-y-1.5 pt-1">
              {cats.map(c => { const r = rodeos[c.id]; return (
                <div key={c.id} className={`rounded border p-1.5 ${r?.sel ? "border-primary" : ""}`}>
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!r?.sel} onCheckedChange={v => setR(c.id, "sel", !!v)} />{c.nombre}</label>
                  {r?.sel && (
                    <div className="grid grid-cols-[70px_1fr_60px] gap-1 pt-1">
                      <Input inputMode="numeric" placeholder="cabezas" value={r.cabezas} onChange={e => setR(c.id, "cabezas", e.target.value)} />
                      <Input placeholder="qué toros (caravana, nombre…)" value={r.toros} onChange={e => setR(c.id, "toros", e.target.value)} />
                      <Input inputMode="numeric" placeholder="cant." value={r.cantidad} onChange={e => setR(c.id, "cantidad", e.target.value)} />
                    </div>)}
                </div>) })}
            </div>
            {elegidos.length > 0 && <p className="text-xs text-muted-foreground pt-1">Total: {totalCabezas} cabezas en {elegidos.length} rodeo(s).</p>}
          </div>

          <div><Label className="text-xs">Explicación{pide && <span className="text-amber-700"> — obligatoria: alguna fecha sale del margen</span>}</Label>
            <Textarea rows={2} value={explicacion} onChange={e => setExplicacion(e.target.value)} /></div>
          <div><Label className="text-xs">Observaciones</Label><Input value={obs} onChange={e => setObs(e.target.value)} /></div>
          {!existente && <p className="text-xs text-muted-foreground">Se crean 4 órdenes de aplicación (ejecutadas si la fecha ya pasó) y el ciclo de cría del año. Los insumos (dispositivos, hormonas) se agregan después en la orden si hace falta.</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button disabled={guardando || !fechaIa || !entore || elegidos.length === 0 || (pide && !explicacion.trim()) || entore < fechaIa}
            onClick={guardar}>{guardando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{existente ? "Mover" : "Cargar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
