"use client"

/**
 * 📮 Quién recibe qué + las obligaciones de cada mes — A-FEAT-1449 tanda 3 (script 153).
 *
 * · Cada tipo de aviso → la persona a la que va por defecto («Pasarle a…» la propone). Una persona por tipo (la primera
 *   de la lista); 🤖 Claude también vale.
 * · Las obligaciones: lo que hay que hacer cada mes antes de un día. Se crea sola la tarea del mes en el «Para vos» de
 *   quien recibe ese tipo de aviso. Se agregan ahí mismo (§ 🧩).
 * Se escriben sólo con admin (RLS); con otro rol se ve y no se guarda.
 */
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { ahoraISO } from "@/lib/fechas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AvisoDestinatarios, ObligacionRecurrente } from "@/lib/revisiones/avisos"

export function ConfigAvisos() {
  const [avisos, setAvisos] = useState<AvisoDestinatarios[]>([])
  const [obligaciones, setObligaciones] = useState<ObligacionRecurrente[]>([])
  const [personas, setPersonas] = useState<{ mail: string; nombre: string }[]>([])
  const [nueva, setNueva] = useState({ nombre: "", aviso_tipo: "", dia_mes: "10" })

  const cargar = useCallback(async () => {
    const [{ data: a }, { data: o }] = await Promise.all([
      supabase.from("avisos_destinatarios").select("tipo, nombre, destinatarios").order("nombre"),
      supabase.from("obligaciones_recurrentes").select("id, nombre, aviso_tipo, dia_mes, activa").order("dia_mes"),
    ])
    setAvisos((a ?? []) as AvisoDestinatarios[]); setObligaciones((o ?? []) as ObligacionRecurrente[])
  }, [])
  useEffect(() => {
    void cargar()
    fetch("/api/sesion/personas?con_claude=1").then(r => (r.ok ? r.json() : null)).then(j => { if (j?.personas) setPersonas(j.personas) }).catch(() => {})
  }, [cargar])

  const asignar = async (tipo: string, mail: string) => {
    const { error } = await supabase.from("avisos_destinatarios").update({ destinatarios: mail ? [mail] : [], updated_at: ahoraISO() }).eq("tipo", tipo)
    if (error) { toast.error("No se pudo guardar: " + error.message); return }
    setAvisos(prev => prev.map(a => a.tipo === tipo ? { ...a, destinatarios: mail ? [mail] : [] } : a))
    toast.success(mail ? `«${avisos.find(a => a.tipo === tipo)?.nombre}» va a ${personas.find(p => p.mail === mail)?.nombre ?? mail}` : "Sin destinatario")
  }
  const cambiarObligacion = async (o: ObligacionRecurrente, cambio: Partial<ObligacionRecurrente>) => {
    const { error } = await supabase.from("obligaciones_recurrentes").update({ ...cambio, updated_at: ahoraISO() }).eq("id", o.id)
    if (error) { toast.error("No se pudo guardar: " + error.message); return }
    setObligaciones(prev => prev.map(x => x.id === o.id ? { ...x, ...cambio } : x))
  }
  const agregar = async () => {
    const dia = parseInt(nueva.dia_mes, 10)
    if (!nueva.nombre.trim() || !nueva.aviso_tipo || !(dia >= 1 && dia <= 28)) { toast.error("Falta qué hay que hacer, a quién va (tipo de aviso) o el día (1 a 28)."); return }
    const { error } = await supabase.from("obligaciones_recurrentes").insert({ nombre: nueva.nombre.trim(), aviso_tipo: nueva.aviso_tipo, dia_mes: dia, nota: "agregada desde la app" })
    if (error) { toast.error("No se pudo agregar: " + error.message); return }
    setNueva({ nombre: "", aviso_tipo: "", dia_mes: "10" }); void cargar()
    toast.success("Obligación agregada: la tarea del mes se crea sola al abrir el Principal")
  }
  const nombrePersona = (mail?: string) => personas.find(p => p.mail === mail)?.nombre ?? mail ?? ""

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">📮 Quién recibe cada tipo de aviso</p>
        <p className="text-xs text-muted-foreground">Es la persona que «Pasarle a…» propone y a la que van las obligaciones del mes de ese tipo. 🔴 = nadie todavía.</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {avisos.map(a => (
            <label key={a.tipo} className="flex items-center gap-2 text-xs">
              <span className={`w-56 shrink-0 ${a.destinatarios.length ? "" : "font-semibold text-red-600"}`}>{a.destinatarios.length ? "" : "🔴 "}{a.nombre}</span>
              <select className="h-7 flex-1 rounded border bg-background px-1" value={a.destinatarios[0] ?? ""} onChange={e => void asignar(a.tipo, e.target.value)}>
                <option value="">— nadie —</option>
                {personas.map(p => <option key={p.mail} value={p.mail}>{p.nombre}</option>)}
                {a.destinatarios[0] && !personas.some(p => p.mail === a.destinatarios[0]) && <option value={a.destinatarios[0]}>{a.destinatarios[0]}</option>}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">📅 Lo que hay que hacer todos los meses</p>
        <p className="text-xs text-muted-foreground">Cada mes se crea sola una tarea con fecha (ese día del mes) en el «Para vos» de quien recibe ese tipo de aviso.</p>
        <ul className="space-y-1 text-xs">
          {obligaciones.map(o => {
            const tipo = avisos.find(a => a.tipo === o.aviso_tipo)
            return (
              <li key={o.id} className={`flex flex-wrap items-center gap-2 ${o.activa ? "" : "opacity-50"}`}>
                <input type="checkbox" checked={o.activa} onChange={() => void cambiarObligacion(o, { activa: !o.activa })} aria-label="Activa" />
                <span className="flex-1">{o.nombre}</span>
                <span>antes del día</span>
                <Input defaultValue={String(o.dia_mes)} className="h-6 w-12 text-xs" onBlur={e => { const d = parseInt(e.target.value, 10); if (d >= 1 && d <= 28 && d !== o.dia_mes) void cambiarObligacion(o, { dia_mes: d }) }} />
                <span className={tipo?.destinatarios.length ? "text-muted-foreground" : "font-semibold text-red-600"}>
                  → {tipo?.destinatarios.length ? nombrePersona(tipo.destinatarios[0]) : `🔴 nadie (asignalo en «${tipo?.nombre ?? o.aviso_tipo}»)`}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
          <Input placeholder="Qué hay que hacer (ej. Pagar el VEP de IIBB MA)" value={nueva.nombre} onChange={e => setNueva({ ...nueva, nombre: e.target.value })} className="h-7 w-72 text-xs" />
          <select className="h-7 rounded border bg-background px-1" value={nueva.aviso_tipo} onChange={e => setNueva({ ...nueva, aviso_tipo: e.target.value })}>
            <option value="">— tipo de aviso (a quién va) —</option>
            {avisos.map(a => <option key={a.tipo} value={a.tipo}>{a.nombre}</option>)}
          </select>
          <span>antes del día</span>
          <Input value={nueva.dia_mes} onChange={e => setNueva({ ...nueva, dia_mes: e.target.value.replace(/\D/g, "") })} className="h-7 w-12 text-xs" />
          <Button size="sm" className="h-7 text-xs" onClick={() => void agregar()}>＋ Agregar</Button>
        </div>
      </div>
    </div>
  )
}
