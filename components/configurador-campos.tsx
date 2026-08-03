"use client"

// Presupuesto → Campos y hectáreas.
//
// Tres cosas que estaban mezcladas en `centros_costo` y acá se ven separadas:
//   CAMPO       dónde se produce (Nazarenas, Rojas, Lima) y cuántas hectáreas tiene
//   PARTIDAS    las partidas inmobiliarias del campo — el TITULAR vive acá, no en el campo,
//               porque un mismo campo puede estar repartido entre empresas (Nazarenas: MSA y PAM)
//   ASIGNACIÓN  cuántas has de ese campo hace cada actividad EN CADA CAMPAÑA
//
// Lo último es la razón de ser de la pantalla: las hectáreas se reasignan de un año al otro
// (las que un año son de recría al siguiente vuelven a cría), así que no pueden ser un atributo
// fijo del campo.
//
// El control de "que no quede ninguna hectárea afuera" lo pidió el usuario y se lee de la vista
// `control_has_por_campana`: se calcula en la base, no acá, para que sea el mismo número en
// cualquier pantalla que lo muestre.

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, ChevronDown, ChevronRight, Plus, Trash2, MapPin, AlertTriangle, CheckCircle2,
} from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"

interface Campo {
  id: string
  nombre: string
  zona: string | null
  empresa_propietaria: string | null
  has_totales: number | null
  has_productivas: number | null
  aptitud: string | null
  dominio: string | null
  provisorio: boolean
  notas: string | null
}
interface Partida {
  id: string
  campo_id: string
  nombre_partida: string
  nro_partida: string | null
  empresa_titular: string | null
  has: number | null
}
interface Asignacion {
  id: string
  campo_id: string
  campana: string
  centro_costo_id: string
  has_netas: number | null
  provisorio: boolean
}
interface Actividad { id: string; nombre: string }
interface Control {
  campo: string
  campana: string | null
  campo_has_productivas: number | null
  asignadas_netas: number | null
  sin_asignar: number | null
  estado: string
  tiene_datos_provisorios: boolean
}

/** Hectáreas: mismo criterio es-AR que los montos, pero sin decimales de más. */
const has = (n: number | null | undefined) =>
  n == null ? "—" : `${fmtNumeroAR(n, n % 1 === 0 ? 0 : 1)} ha`

export function ConfiguradorCampos() {
  const [cargando, setCargando] = useState(true)
  const [campos, setCampos] = useState<Campo[]>([])
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [control, setControl] = useState<Control[]>([])
  const [campana, setCampana] = useState("26/27")
  const [abierto, setAbierto] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [ca, pa, asg, act, ctl] = await Promise.all([
        supabase.from("campos").select("*").eq("activo", true).order("nombre"),
        supabase.from("campo_partidas").select("*").order("nombre_partida"),
        supabase.from("campo_campana_actividad").select("*"),
        supabase.from("centros_costo").select("id, nombre").eq("tipo", "actividad").eq("activo", true).order("nombre"),
        supabase.from("control_has_por_campana").select("*"),
      ])
      setCampos((ca.data || []) as Campo[])
      setPartidas((pa.data || []) as Partida[])
      setAsignaciones((asg.data || []) as Asignacion[])
      setActividades((act.data || []) as Actividad[])
      setControl((ctl.data || []) as Control[])
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  /** Las campañas que ya tienen algo cargado, más la actual, para no perder ninguna de vista. */
  const campanas = useMemo(() => {
    const s = new Set(asignaciones.map(a => a.campana))
    s.add(campana)
    return Array.from(s).sort()
  }, [asignaciones, campana])

  const controlDe = (nombre: string) =>
    control.find(c => c.campo === nombre && (c.campana === campana || c.campana == null))

  // ── Guardado ────────────────────────────────────────────────────────────────

  const guardarCampo = async (id: string, cambios: Partial<Campo>) => {
    setCampos(prev => prev.map(c => (c.id === id ? { ...c, ...cambios } : c)))
    const { error } = await supabase.from("campos")
      .update({ ...cambios, updated_at: new Date().toISOString() }).eq("id", id)
    if (error) alert("Error: " + error.message)
    await cargar()   // el control se recalcula en la base
  }

  const guardarAsignacion = async (campoId: string, actividadId: string, hasNetas: number) => {
    const existente = asignaciones.find(
      a => a.campo_id === campoId && a.campana === campana && a.centro_costo_id === actividadId)
    if (existente) {
      await supabase.from("campo_campana_actividad")
        .update({ has_netas: hasNetas, has_totales: hasNetas, updated_at: new Date().toISOString() })
        .eq("id", existente.id)
    } else {
      await supabase.from("campo_campana_actividad")
        .insert({ campo_id: campoId, campana, centro_costo_id: actividadId,
                  has_netas: hasNetas, has_totales: hasNetas })
    }
    await cargar()
  }

  const borrarAsignacion = async (id: string) => {
    await supabase.from("campo_campana_actividad").delete().eq("id", id)
    await cargar()
  }

  const marcarConfirmado = async (id: string, tabla: "campos" | "campo_campana_actividad") => {
    await supabase.from(tabla).update({ provisorio: false }).eq("id", id)
    await cargar()
  }

  if (cargando) {
    return (
      <Card><CardContent className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leyendo campos y hectáreas…
      </CardContent></Card>
    )
  }

  const conProblema = control.filter(c => c.estado !== "ok" && (c.campana === campana || c.campana == null))
  const provisorios = campos.filter(c => c.provisorio).length +
    asignaciones.filter(a => a.provisorio && a.campana === campana).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Campos y hectáreas
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              Cuántas hectáreas de cada campo hace cada actividad, <strong>por campaña</strong>.
              Las has se reasignan de un año al otro, por eso se cargan acá y no en el campo.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Campaña</span>
            {campanas.map(c => (
              <button key={c} type="button" onClick={() => setCampana(c)}
                className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                  campana === c ? "border-gray-700 bg-gray-700 text-white" : "border-gray-200 hover:bg-gray-50"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* ── El control que pidió el usuario: que no quede ninguna hectárea afuera ── */}
        {conProblema.length === 0 ? (
          <div className="flex items-center gap-2 rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Todas las hectáreas están asignadas en {campana}.
          </div>
        ) : (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="flex items-center gap-2 text-xs font-medium text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {conProblema.length} {conProblema.length === 1 ? "campo" : "campos"} con hectáreas sin resolver
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-amber-800">
              {conProblema.map(c => (
                <li key={c.campo}>
                  <strong>{c.campo}</strong> — {c.estado}
                  {c.sin_asignar != null && c.estado === "quedan has sin asignar" &&
                    ` (${has(c.sin_asignar)} libres)`}
                  {c.estado === "SOBREASIGNADO" && c.sin_asignar != null &&
                    ` (${has(Math.abs(c.sin_asignar))} de más)`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {provisorios > 0 && (
          <p className="text-[11px] text-gray-500">
            ⏳ Hay <strong>{provisorios}</strong> {provisorios === 1 ? "dato marcado" : "datos marcados"} como
            provisorios. Los números cuadran, pero están a confirmar — tildalos cuando los verifiques.
          </p>
        )}

        {/* ── Campos ── */}
        <div className="space-y-1.5">
          {campos.map(campo => {
            const ctl = controlDe(campo.nombre)
            const mias = asignaciones.filter(a => a.campo_id === campo.id && a.campana === campana)
            const misPartidas = partidas.filter(p => p.campo_id === campo.id)
            const open = abierto === campo.id
            return (
              <div key={campo.id} className="rounded border">
                <button type="button" onClick={() => setAbierto(open ? null : campo.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50">
                  {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                  <span className="text-sm font-medium text-gray-800">{campo.nombre}</span>
                  {campo.zona && <span className="text-[11px] text-gray-400">{campo.zona}</span>}
                  {campo.empresa_propietaria && (
                    <Badge variant="outline" className="text-[9px]">{campo.empresa_propietaria}</Badge>
                  )}
                  {campo.provisorio && (
                    <Badge variant="outline" className="border-amber-300 text-[9px] text-amber-700">provisorio</Badge>
                  )}
                  <span className="ml-auto text-xs text-gray-500">
                    {has(campo.has_productivas)} productivas · {mias.length}{" "}
                    {mias.length === 1 ? "actividad" : "actividades"}
                  </span>
                  {ctl && ctl.estado !== "ok" && (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  )}
                </button>

                {open && (
                  <div className="space-y-3 border-t bg-slate-50 px-3 py-3">
                    {/* Datos del campo */}
                    <div className="flex flex-wrap items-end gap-3">
                      <CampoNumero label="Has totales" valor={campo.has_totales}
                        onGuardar={v => guardarCampo(campo.id, { has_totales: v })} />
                      <CampoNumero label="Has productivas" valor={campo.has_productivas}
                        ayuda="La base del prorrateo de estructura. Distinta de las totales."
                        onGuardar={v => guardarCampo(campo.id, { has_productivas: v })} />
                      <div>
                        <label className="block text-[10px] text-gray-500">Aptitud</label>
                        <Input className="h-7 w-32 text-xs" defaultValue={campo.aptitud ?? ""}
                          onBlur={e => guardarCampo(campo.id, { aptitud: e.target.value || null })} />
                      </div>
                      {campo.provisorio && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => marcarConfirmado(campo.id, "campos")}>
                          Confirmar datos
                        </Button>
                      )}
                    </div>
                    {campo.notas && <p className="text-[11px] italic text-gray-500">{campo.notas}</p>}

                    {/* Asignación por actividad */}
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-gray-700">
                        Hectáreas por actividad en {campana}
                      </p>
                      <div className="space-y-1">
                        {actividades.map(act => {
                          const asg = mias.find(a => a.centro_costo_id === act.id)
                          return (
                            <div key={act.id} className="flex items-center gap-2">
                              <span className="w-32 text-xs text-gray-600">{act.nombre}</span>
                              <Input className="h-7 w-24 text-right text-xs" placeholder="—"
                                defaultValue={asg?.has_netas != null ? fmtNumeroAR(asg.has_netas, 0) : ""}
                                onBlur={e => {
                                  const v = parseNumeroAR(e.target.value)
                                  if (v > 0) guardarAsignacion(campo.id, act.id, v)
                                  else if (asg) borrarAsignacion(asg.id)
                                }} />
                              <span className="text-[10px] text-gray-400">ha</span>
                              {asg?.provisorio && (
                                <button type="button" className="text-[10px] text-amber-600 underline"
                                  onClick={() => marcarConfirmado(asg.id, "campo_campana_actividad")}>
                                  provisorio — confirmar
                                </button>
                              )}
                              {asg && (
                                <button type="button" onClick={() => borrarAsignacion(asg.id)}
                                  className="text-gray-300 hover:text-red-500" title="Quitar la asignación">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {ctl && (
                        <p className={`mt-1.5 text-[11px] ${ctl.estado === "ok" ? "text-green-700" : "text-amber-700"}`}>
                          {has(ctl.asignadas_netas)} asignadas de {has(ctl.campo_has_productivas)} · {ctl.estado}
                        </p>
                      )}
                    </div>

                    {/* Partidas */}
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-gray-700">
                        Partidas inmobiliarias ({misPartidas.length})
                        <span className="ml-1 font-normal text-gray-400">
                          — el titular de la partida es el dueño de esas hectáreas
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {misPartidas.map(p => (
                          <span key={p.id}
                            className="rounded border bg-white px-1.5 py-0.5 text-[10px] text-gray-600">
                            {p.nombre_partida}
                            {p.empresa_titular && (
                              <strong className="ml-1 text-gray-800">{p.empresa_titular}</strong>
                            )}
                          </span>
                        ))}
                        {misPartidas.length === 0 && (
                          <span className="text-[10px] text-gray-400">sin partidas cargadas</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

/** Input de hectáreas con el parseo es-AR, para no repetirlo en cada campo. */
function CampoNumero({ label, valor, ayuda, onGuardar }: {
  label: string; valor: number | null; ayuda?: string; onGuardar: (v: number | null) => void
}) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500" title={ayuda}>
        {label}{ayuda && <span className="ml-0.5 text-gray-300">ⓘ</span>}
      </label>
      <Input className="h-7 w-24 text-right text-xs" placeholder="—"
        defaultValue={valor != null ? fmtNumeroAR(valor, 0) : ""}
        onBlur={e => {
          const t = e.target.value.trim()
          onGuardar(t === "" ? null : parseNumeroAR(t))
        }} />
    </div>
  )
}
