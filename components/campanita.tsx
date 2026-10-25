"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bell, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import {
  clasificarCampanita,
  contarNuevos,
  type EntradaHilo,
  type MarcaCampanita,
  type Yo,
} from "@/lib/revisiones/campanita"

/**
 * 🔔 LA CAMPANITA (A-FEAT-1364) — los mensajes anclados a una cosa, en la barra de arriba.
 *
 * Un mensaje es una marca 🚩 con destinatario: «esta factura está mal cargada, corregir», pegada a la
 * factura. Al destinatario le aparece acá; contesta en el mismo hilo; a quien la mandó le llega la
 * respuesta. Se cierra diciendo qué se hizo (igual que en Para revisar). Qué cuenta como nuevo está
 * en `lib/revisiones/campanita.ts`.
 *
 * Se consulta al abrir, cada 2 minutos y al volver a la pestaña. Esa consulta no cuenta como
 * actividad para el cierre por inactividad (sólo cuentan los toques del usuario).
 */

type Marca = MarcaCampanita & {
  descripcion_ref: string
  pantalla: string | null
  subpantalla?: string | null
}

const CLAVE_VISTOS = "cp-campanita-vistos"
const MS_ENTRE_CONSULTAS = 120_000

function leerVistos(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_VISTOS) || "{}") ?? {}
  } catch {
    return {}
  }
}
function guardarVistos(v: Record<string, number>) {
  try {
    localStorage.setItem(CLAVE_VISTOS, JSON.stringify(v))
  } catch {
    /* sin almacenamiento: vuelven a contar como nuevas, nada más */
  }
}

function cuando(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function Campanita() {
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [yo, setYo] = useState<Yo>({ mail: null, etiqueta: null })
  const [vistos, setVistos] = useState<Record<string, number>>({})
  const [abierta, setAbierta] = useState(false)
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [texto, setTexto] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/revisiones?mias=1")
      if (r.status === 401) return
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || "No se pudo leer")
      setMarcas(j.revisiones ?? [])
      setYo(j.yo ?? { mail: null, etiqueta: null })
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    setVistos(leerVistos())
    void cargar()
    const t = window.setInterval(cargar, MS_ENTRE_CONSULTAS)
    const alVolver = () => { if (document.visibilityState === "visible") void cargar() }
    document.addEventListener("visibilitychange", alVolver)
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", alVolver) }
  }, [cargar])

  const items = useMemo(() => clasificarCampanita(marcas, yo, vistos), [marcas, yo, vistos])
  const nuevos = contarNuevos(items)
  const porId = useMemo(() => Object.fromEntries(marcas.map((m) => [m.id, m])), [marcas])

  const abrir = (o: boolean) => {
    setAbierta(o)
    if (o) {
      void cargar()
      if (!Object.keys(nombres).length) {
        fetch("/api/sesion/personas").then((r) => (r.ok ? r.json() : null)).then((j) => {
          if (j?.personas) setNombres(Object.fromEntries(j.personas.map((p: { mail: string; nombre: string }) => [p.mail.toLowerCase(), p.nombre])))
        }).catch(() => {})
      }
    } else {
      // Al cerrar, lo que se mostró queda visto.
      const v = { ...vistos }
      for (const i of items) v[i.id] = i.mensajes
      setVistos(v)
      guardarVistos(v)
    }
  }

  const nombre = (mail: string | null) => (mail ? nombres[mail.toLowerCase()] ?? mail : "—")

  const responder = async (id: string, cerrar: boolean) => {
    const t = (texto[id] ?? "").trim()
    if (!t) { toast.error(cerrar ? "Escribí qué se hizo antes de cerrarla" : "Escribí la respuesta"); return }
    setEnviando(id)
    try {
      const r = await fetch("/api/revisiones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cerrar ? { id, estado: "resuelta", resolucion: t } : { id, seguimiento: t }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || "No se pudo guardar")
      setTexto((x) => ({ ...x, [id]: "" }))
      toast.success(cerrar ? "Cerrada" : "Respuesta enviada")
      await cargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setEnviando(null)
    }
  }

  const grupos: { titulo: string; tipo: "para-mi" | "enviada"; vacio: string }[] = [
    { titulo: "Para mí", tipo: "para-mi", vacio: "Nadie te dejó nada." },
    { titulo: "Lo que mandé", tipo: "enviada", vacio: "No tenés mensajes abiertos enviados a otros." },
  ]

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 shrink-0"
        title={nuevos ? `${nuevos} mensaje${nuevos === 1 ? "" : "s"} nuevo${nuevos === 1 ? "" : "s"}` : "Mensajes"}
        onClick={() => abrir(true)}
      >
        <Bell className="h-5 w-5" />
        {nuevos > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {nuevos}
          </span>
        )}
      </Button>

      <Sheet open={abierta} onOpenChange={abrir}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>🔔 Mensajes</SheetTitle>
            <SheetDescription>
              Para mandarle algo a alguien: marcalo con 🚩 y elegí «Para». Se cierra diciendo qué se hizo.
            </SheetDescription>
          </SheetHeader>

          {error && (
            <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              No se pudieron leer los mensajes: {error}
            </p>
          )}

          {grupos.map((g) => {
            const lista = items.filter((i) => i.tipo === g.tipo)
            return (
              <div key={g.tipo} className="mt-5">
                <h3 className="text-sm font-semibold text-gray-700">{g.titulo}</h3>
                {lista.length === 0 && <p className="mt-1 text-xs text-gray-500">{g.vacio}</p>}
                <div className="mt-2 space-y-3">
                  {lista.map((i) => {
                    const m = porId[i.id]
                    if (!m) return null
                    const hilo: EntradaHilo[] = Array.isArray(m.seguimiento) ? m.seguimiento : []
                    return (
                      <div key={i.id} className={`rounded-md border p-3 text-sm ${i.nuevo ? "border-amber-300 bg-amber-50" : "bg-white"}`}>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
                          <span>
                            {i.tipo === "para-mi" ? <>De <b>{m.creado_por ?? "—"}</b></> : <>Para <b>{nombre(m.asignado_a)}</b></>}
                            {" · "}{cuando(m.created_at)}
                          </span>
                          {i.nuevo && <span className="rounded bg-amber-200 px-1.5 text-[10px] font-semibold text-amber-900">nuevo</span>}
                        </div>
                        <p className="mt-1 text-[11px] text-gray-600">
                          Sobre: {m.descripcion_ref}{m.pantalla ? ` (${[m.pantalla, m.subpantalla].filter(Boolean).join(" → ")})` : ""}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap">{m.motivo}</p>
                        {hilo.length > 0 && (
                          <ul className="mt-2 space-y-1 border-l-2 border-gray-200 pl-2">
                            {hilo.map((h, k) => (
                              <li key={k} className="text-xs">
                                <span className="text-gray-500">{h.autor ?? "—"} · {cuando(h.fecha)}:</span>{" "}
                                <span className="whitespace-pre-wrap">{h.texto}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <Textarea
                          className="mt-2 text-xs"
                          rows={2}
                          placeholder={i.tipo === "para-mi" ? "Contestá, o escribí qué hiciste y cerrala" : "Contestá, o cerrala si ya está"}
                          value={texto[i.id] ?? ""}
                          onChange={(e) => setTexto((x) => ({ ...x, [i.id]: e.target.value }))}
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={enviando === i.id}
                            onClick={() => void responder(i.id, false)}>
                            {enviando === i.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Contestar
                          </Button>
                          <Button size="sm" className="h-7 text-xs" disabled={enviando === i.id}
                            onClick={() => void responder(i.id, true)}>
                            Listo, cerrar
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </SheetContent>
      </Sheet>
    </>
  )
}
