"use client"

/**
 * 🏠 «🚩 PARA VOS» — arriba del Principal de CADA usuario (A-FEAT-1411).
 *
 * JMS 2026-10-28: «a él no le llega la campanita: los flags le llegan a su Principal. Cada usuario debe tener su
 * Principal… un flag es algo urgente… la flag incluye la creación de una tarea para ese usuario».
 * Trae SÓLO lo de quien mira (`/api/revisiones?mias=1`: el servidor filtra por la sesión, nadie pide las de otro):
 * arriba lo que le asignaron (las tareas vencidas en rojo), abajo lo que mandó y espera respuesta. Se contesta o se
 * cierra acá mismo, por el mismo camino que la campanita (PATCH /api/revisiones).
 */
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Flag, Loader2, CalendarClock } from "lucide-react"
import { paraVos, estaVencida, type MarcaParaVos } from "@/lib/revisiones/para-vos"
import { hoyArgentina } from "@/lib/fechas"

interface Marca extends MarcaParaVos {
  descripcion_ref: string
  motivo: string
  pantalla: string | null
  subpantalla?: string | null
  seguimiento?: { fecha: string; texto: string; autor: string | null }[] | null
}

const dm = (f: string) => f.slice(0, 10).split("-").reverse().slice(0, 2).join("/")

export function PanelParaVos() {
  const [marcas, setMarcas] = useState<Marca[] | null>(null)
  const [yo, setYo] = useState<{ mail: string | null; etiqueta: string | null }>({ mail: null, etiqueta: null })
  const [abierta, setAbierta] = useState<string | null>(null)
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch("/api/revisiones?mias=1")).json()
      setMarcas((j.revisiones ?? []) as Marca[])
      setYo({ mail: j.yo?.mail ?? null, etiqueta: j.yo?.etiqueta ?? null })
    } catch { setMarcas([]) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const responder = async (id: string, cerrar: boolean) => {
    const t = texto.trim()
    if (!t) { toast.error(cerrar ? "Escribí qué se hizo antes de cerrarla" : "Escribí la respuesta"); return }
    setEnviando(true)
    try {
      const r = await fetch("/api/revisiones", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cerrar ? { id, estado: "resuelta", resolucion: t } : { id, seguimiento: t }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `error ${r.status}`)
      toast.success(cerrar ? "Cerrada" : "Respuesta enviada")
      setTexto(""); setAbierta(null); cargar()
    } catch (e) { toast.error("No se pudo: " + (e as Error).message) } finally { setEnviando(false) }
  }

  if (marcas === null) return null
  const hoy = hoyArgentina()
  const { paraMi, mandadas, vencidas } = paraVos(marcas, yo, hoy)
  if (paraMi.length === 0 && mandadas.length === 0) {
    return <div className="rounded-lg border bg-white px-4 py-3 text-sm text-muted-foreground">🚩 Para vos: no tenés nada pendiente.</div>
  }

  const tarjeta = (m: Marca, mia: boolean) => {
    const venc = estaVencida(m, hoy)
    const hilo = m.seguimiento ?? []
    return (
      <li key={m.id} className={`rounded-md border p-3 ${mia ? (venc ? "border-red-400 bg-red-50" : "border-red-200 bg-red-50/40") : "bg-white"}`}>
        <div className="flex flex-wrap items-start gap-2">
          <Flag className={`mt-0.5 h-4 w-4 shrink-0 ${mia ? "text-red-600" : "text-amber-600"}`} fill="currentColor" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{m.motivo}</div>
            <div className="text-xs text-muted-foreground">
              {m.descripcion_ref}{m.pantalla ? ` · ${m.pantalla}${m.subpantalla ? ` → ${m.subpantalla}` : ""}` : ""} · {mia ? `de ${m.creado_por ?? "—"}` : `para ${m.asignado_a}`} · {dm(m.created_at)}
            </div>
            {m.es_tarea && (
              <div className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${venc ? "bg-red-600 text-white" : "bg-amber-100 text-amber-900"}`}>
                <CalendarClock className="h-3 w-3" /> Tarea{m.tarea_hasta ? ` · para el ${dm(m.tarea_hasta)}${venc ? " — VENCIDA" : ""}` : ""}
              </div>)}
            {hilo.length > 0 && (
              <ul className="mt-2 space-y-1 border-l-2 pl-2 text-xs">
                {hilo.map((h, i) => <li key={i}><b>{h.autor ?? "—"}</b>: {h.texto}</li>)}
              </ul>)}
          </div>
          {abierta !== m.id && <Button size="sm" variant="outline" onClick={() => { setAbierta(m.id); setTexto("") }}>{mia ? "Responder / cerrar" : "Escribir"}</Button>}
        </div>
        {abierta === m.id && (
          <div className="mt-2 space-y-2">
            <Textarea rows={2} value={texto} onChange={e => setTexto(e.target.value)} placeholder={mia ? "Qué hiciste, o tu pregunta" : "Tu mensaje"} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAbierta(null)}>Cancelar</Button>
              <Button size="sm" variant="outline" disabled={enviando} onClick={() => responder(m.id, false)}>Responder</Button>
              {mia && <Button size="sm" disabled={enviando} onClick={() => responder(m.id, true)}>{enviando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Listo, cerrar</Button>}
            </div>
          </div>)}
      </li>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border-2 border-red-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Flag className="h-5 w-5 text-red-600" fill="currentColor" />
        <h2 className="text-base font-semibold">Para vos</h2>
        {paraMi.length > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{paraMi.length}</span>}
        {vencidas > 0 && <span className="text-xs font-medium text-red-700">{vencidas} vencida(s)</span>}
      </div>
      {paraMi.length > 0 && <ul className="space-y-2">{paraMi.map(m => tarjeta(m, true))}</ul>}
      {mandadas.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">Lo que mandaste, esperando respuesta</div>
          <ul className="space-y-2">{mandadas.map(m => tarjeta(m, false))}</ul>
        </div>)}
    </div>
  )
}
