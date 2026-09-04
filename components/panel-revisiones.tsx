"use client"

/**
 * 🚩 Para revisar — lo marcado desde cualquier pantalla, junto en Principal.
 *
 * Es la otra mitad de `BotonRevision`: allá se marca, acá se resuelve. Va con las alertas de Pagos y
 * de Ventas porque es lo mismo — cosas que alguien tiene que mirar antes de que ensucien un número.
 *
 * ⚠️ **Cerrar exige decir qué se hizo.** Sin eso, "resuelta" termina significando "la miré y me
 * pareció que estaba bien", que no es lo mismo que "la corregí". Es la § «todo desarrollo termina
 * con su control» aplicada al cierre de la marca.
 */

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Flag, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getRoleFromRoute } from "@/config/access-routes"
import type { RevisionAbierta } from "@/components/boton-revision"

function rolActual(): string | null {
  if (typeof window === "undefined") return null
  return getRoleFromRoute(window.location.pathname.split("/").filter(Boolean)[0] ?? "")
}

function cuando(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function PanelRevisiones() {
  const [revisiones, setRevisiones] = useState<RevisionAbierta[]>([])
  const [cargando, setCargando] = useState(true)
  /**
   * La marca abierta en detalle — pedido del usuario (2026-09-04):
   * *"recién encontré cuál es el problema, debería poder abrir para actualizar"*.
   *
   * Una marca **no nace con el diagnóstico, nace con la sospecha**. Si lo único que se puede hacer
   * es cerrarla, lo que se aprende en el medio se pierde o termina escrito en otro lado.
   */
  const [detalle, setDetalle] = useState<RevisionAbierta | null>(null)
  const [nuevoSeguimiento, setNuevoSeguimiento] = useState("")
  const [agregando, setAgregando] = useState(false)
  const [cerrando, setCerrando] = useState<RevisionAbierta | null>(null)
  const [resolucion, setResolucion] = useState("")
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const r = await fetch("/api/revisiones")
      const j = await r.json()
      setRevisiones(j.revisiones ?? [])
    } catch {
      setRevisiones([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const agregarSeguimiento = async () => {
    if (!detalle || !nuevoSeguimiento.trim()) { toast.error("Escribí algo"); return }
    setAgregando(true)
    try {
      const r = await fetch("/api/revisiones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: detalle.id, seguimiento: nuevoSeguimiento.trim(), autor: rolActual() }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || "no se pudo agregar")
      setNuevoSeguimiento("")
      // Refrescar y dejar el detalle abierto con lo recién agregado a la vista.
      const lista = await (await fetch("/api/revisiones")).json()
      const frescas: RevisionAbierta[] = lista.revisiones ?? []
      setRevisiones(frescas)
      setDetalle(frescas.find(v => v.id === detalle.id) ?? null)
      toast.success("Agregado")
    } catch (e) {
      toast.error("No se pudo agregar: " + (e as Error).message)
    } finally {
      setAgregando(false)
    }
  }

  const cerrar = async (estado: "resuelta" | "descartada") => {
    if (!cerrando) return
    if (!resolucion.trim()) { toast.error("Escribí qué se hizo"); return }
    setGuardando(true)
    try {
      const r = await fetch("/api/revisiones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cerrando.id, estado, resolucion: resolucion.trim(), resuelto_por: rolActual(),
        }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || "no se pudo cerrar")
      toast.success(estado === "resuelta" ? "Marca resuelta" : "Marca descartada")
      setCerrando(null); setResolucion("")
      cargar()
    } catch (e) {
      toast.error("No se pudo cerrar: " + (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-amber-600" />
            Para revisar
            {revisiones.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {revisiones.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-6 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando…</span>
            </div>
          ) : revisiones.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-300" />
              <p className="text-sm">Nada marcado para revisar</p>
              <p className="mt-1 text-xs text-gray-400">
                Cuando veas algo raro en cualquier pantalla, tocá la 🚩 de esa fila.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {revisiones.map(v => (
                <li key={v.id} className="rounded border border-amber-200 bg-amber-50/50 px-3 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => { setDetalle(v); setNuevoSeguimiento("") }}
                      title="Abrir para ver y agregar lo que vayas averiguando"
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-sm font-medium text-gray-900">{v.motivo}</p>
                      {/* La lápida: dice de qué fila hablaba, aunque la fila ya no exista. */}
                      <p className="mt-0.5 text-xs text-gray-600">{v.descripcion_ref}</p>
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        {v.pantalla ? `${v.pantalla} · ` : ""}{cuando(v.created_at)}
                        {v.creado_por ? ` · ${v.creado_por}` : ""}
                        {(v.seguimiento?.length ?? 0) > 0 && (
                          <span className="ml-1 text-amber-700">· 📝 {v.seguimiento!.length} agregado(s)</span>
                        )}
                      </p>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => { setDetalle(v); setNuevoSeguimiento("") }}
                      >
                        Abrir
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => { setCerrando(v); setResolucion("") }}
                      >
                        Cerrar
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Detalle: lo que se sabe hasta ahora, y donde se agrega lo que se va averiguando. */}
      <Dialog open={!!detalle} onOpenChange={o => { if (!o) setDetalle(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>🚩 {detalle?.motivo}</DialogTitle></DialogHeader>
          {detalle && (
            <>
              <div className="rounded border bg-gray-50 px-2.5 py-2 text-[11px] leading-4 text-gray-600">
                <b>{detalle.descripcion_ref}</b><br />
                {detalle.pantalla ? `${detalle.pantalla}${detalle.subpantalla ? " → " + detalle.subpantalla : ""} · ` : ""}
                {cuando(detalle.created_at)}{detalle.creado_por ? ` · ${detalle.creado_por}` : ""}
              </div>

              {detalle.imagen && (
                <img src={detalle.imagen} alt="captura" className="max-h-56 w-full rounded border bg-gray-50 object-contain" />
              )}

              <div>
                <Label className="text-xs">Lo que se fue averiguando</Label>
                {(detalle.seguimiento?.length ?? 0) === 0 ? (
                  <p className="mt-1 text-xs italic text-gray-400">
                    Todavía nada. La marca guarda la sospecha inicial; acá va lo que descubras después.
                  </p>
                ) : (
                  <ul className="mt-1 max-h-52 space-y-1.5 overflow-auto">
                    {detalle.seguimiento!.map((e, i) => (
                      <li key={i} className="rounded border-l-2 border-amber-300 bg-amber-50/50 px-2.5 py-1.5">
                        <p className="whitespace-pre-wrap text-sm">{e.texto}</p>
                        <p className="mt-0.5 text-[10px] text-gray-400">
                          {cuando(e.fecha)}{e.autor ? ` · ${e.autor}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <Label className="text-xs">Agregar</Label>
                <Textarea
                  className="mt-1" rows={3} value={nuevoSeguimiento}
                  placeholder="Ej: encontré el problema — la regla del proveedor imputaba a la cuenta vieja"
                  onChange={e => setNuevoSeguimiento(e.target.value)}
                />
                <p className="mt-1 text-[11px] leading-4 text-gray-500">
                  Se <b>agrega</b>, no reemplaza lo anterior. La observación original queda como estaba
                  — a veces resulta equivocada, y eso también sirve saberlo.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDetalle(null)}>Cerrar ventana</Button>
                <Button
                  variant="outline"
                  onClick={() => { const d = detalle; setDetalle(null); setCerrando(d); setResolucion("") }}
                >
                  Resolver la marca
                </Button>
                <Button onClick={agregarSeguimiento} disabled={agregando}>
                  {agregando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Agregar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!cerrando} onOpenChange={o => { if (!o) setCerrando(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cerrar la marca</DialogTitle></DialogHeader>
          {cerrando && (
            <div className="rounded border bg-gray-50 px-2.5 py-2 text-[11px] leading-4 text-gray-600">
              <b>{cerrando.motivo}</b><br />{cerrando.descripcion_ref}
            </div>
          )}
          <div>
            <Label className="text-xs">¿Qué se hizo?</Label>
            <Textarea
              className="mt-1" rows={3} autoFocus value={resolucion}
              placeholder="Ej: se reimputó a Servicios Eléctricos, contra el comprobante 23-197741"
              onChange={e => setResolucion(e.target.value)}
            />
            <p className="mt-1 text-[11px] leading-4 text-gray-500">
              Es obligatorio. Sin esto, «resuelta» termina significando «la miré», que no es lo mismo
              que «la corregí».
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCerrando(null)}>Volver</Button>
            <Button variant="outline" disabled={guardando} onClick={() => cerrar("descartada")}>
              No era un problema
            </Button>
            <Button disabled={guardando} onClick={() => cerrar("resuelta")}>
              {guardando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Resuelta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
