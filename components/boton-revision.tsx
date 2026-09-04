"use client"

/**
 * 🚩 Marcar algo «para revisar» — desde CUALQUIER pantalla, con o sin fila.
 *
 * ## De dónde salió (2026-09-04)
 * Empezó auditando el archivo digital: apareció una imputación dudosa y el usuario pidió poder
 * dejarla marcada. La primera versión colgaba la marca **de una fila**. Horas después apareció el
 * caso que rompió ese supuesto: *"entro al subdiario de marzo y veo algo que no cuadra en una
 * declaración"* — eso no es de una fila, es del período.
 *
 * Y con él, la restricción que ordena todo el diseño:
 *
 * > **"No puedo quedar anclado a que exista el lugar en la fila desarrollado. Debo poder subir
 * > warnings yo, de cosas que la app no puede registrar."**
 *
 * Por eso el instrumento **está siempre**, como el `Alt+N` de las notas, y funciona aunque nadie
 * haya cableado nada en esa pantalla. El ancla a una fila pasó a ser **una comodidad cuando
 * existe**, no un requisito: tocada desde una fila, la marca queda pegada a esa fila; levantada
 * desde el botón flotante, queda pegada al contexto (pantalla, solapa, período).
 *
 * ## Por qué NO son las notas de `Alt+N`
 * El instrumento se parece; **el destino no**. Una nota habla de la **app** y la leo yo, para
 * cambiar código. Una marca habla de un **dato** y se queda en el equipo, para corregirlo.
 * Si al investigar una marca resulta que el problema era de la app, desde su seguimiento se
 * convierte en pendiente con ID — la separación se hace **cuando ya se sabe**, no antes.
 */

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Flag, Loader2, Trash2, ImageOff } from "lucide-react"
import { toast } from "sonner"
import { getRoleFromRoute } from "@/config/access-routes"
import { contextoActual } from "@/lib/contexto-pantalla"

const ANCHO_MAX = 1400
const CALIDAD = 0.72

export interface RevisionAbierta {
  id: string
  schema_ref: string | null
  tabla_ref: string | null
  registro_id: string | null
  descripcion_ref: string
  motivo: string
  pantalla: string | null
  subpantalla?: string | null
  estado: string
  creado_por: string | null
  created_at: string
  imagen?: string | null
  /** Lo que se fue aprendiendo DESPUÉS de dejar la marca. Se agrega, nunca se pisa. */
  seguimiento?: { fecha: string; texto: string; autor: string | null }[]
}

/** El ROL de quien marca, nunca la ruta (A-SEC-04: el 1er segmento ES la contraseña). */
function rolActual(): string | null {
  if (typeof window === "undefined") return null
  return getRoleFromRoute(window.location.pathname.split("/").filter(Boolean)[0] ?? "")
}

async function comprimir(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  const escala = Math.min(1, ANCHO_MAX / bitmap.width)
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", CALIDAD)
}

/** Las marcas abiertas de una tabla, cargadas UNA vez por pantalla (no una consulta por fila). */
export function useRevisionesDe(schema: string, tabla: string) {
  const [porRegistro, setPorRegistro] = useState<Record<string, RevisionAbierta>>({})
  const recargar = useCallback(async () => {
    try {
      const j = await (await fetch("/api/revisiones")).json()
      const mapa: Record<string, RevisionAbierta> = {}
      for (const v of (j.revisiones ?? []) as RevisionAbierta[]) {
        if (v.schema_ref === schema && v.tabla_ref === tabla && v.registro_id) mapa[v.registro_id] = v
      }
      setPorRegistro(mapa)
    } catch {
      setPorRegistro({})
    }
  }, [schema, tabla])
  useEffect(() => { recargar() }, [recargar])
  return { porRegistro, recargar }
}

/* ────────────────────────────────────────────────────────────────────────── */

interface AnclaFila { schema: string; tabla: string; registroId: string; descripcion: string }

function ModalMarca({
  abierto, onClose, ancla, yaAbierta, onGuardada,
}: {
  abierto: boolean
  onClose: () => void
  /** Si viene, la marca queda pegada a esa fila. Si no, queda pegada al contexto. */
  ancla?: AnclaFila
  yaAbierta?: RevisionAbierta
  onGuardada?: () => void
}) {
  const [motivo, setMotivo] = useState("")
  const [imagen, setImagen] = useState("")
  const [guardando, setGuardando] = useState(false)

  /**
   * El contexto se congela al ABRIR, y va en ESTADO, no en una referencia.
   *
   * Con una referencia el valor se actualizaba **después** de dibujar (actualizar un ref no vuelve
   * a renderizar), así que el recuadro mostraba el contexto de la pantalla anterior: se abría el
   * warning parado en Sueldos y decía «Principal». Lo detectó el test del navegador.
   */
  const [ctx, setCtx] = useState(contextoActual)

  useEffect(() => {
    if (abierto) { setCtx(contextoActual()); setMotivo(""); setImagen("") }
  }, [abierto])

  // La captura se PEGA, no se genera: es la única forma de fotografiar lo que el usuario ve de
  // verdad, incluidos los carteles nativos del navegador, que ninguna librería puede capturar.
  useEffect(() => {
    if (!abierto) return
    const pegar = async (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith("image/"))
      const blob = item?.getAsFile()
      if (!blob) return
      e.preventDefault()
      try { setImagen(await comprimir(blob)); toast.success("Captura pegada") }
      catch { toast.error("No se pudo procesar la imagen") }
    }
    document.addEventListener("paste", pegar as any)
    return () => document.removeEventListener("paste", pegar as any)
  }, [abierto])

  const donde = ancla
    ? ancla.descripcion
    : [ctx.pantalla, ctx.subpantalla].filter(Boolean).join(" → ") || "la pantalla actual"

  const guardar = async () => {
    if (!motivo.trim()) { toast.error("Escribí qué viste"); return }
    setGuardando(true)
    try {
      // El id se genera acá: `anon` sólo tiene INSERT, y un `INSERT … RETURNING` necesita además
      // permiso de lectura (A-SEC-04).
      const { error } = await supabase.from("revisiones").insert({
        id: crypto.randomUUID(),
        schema_ref: ancla?.schema ?? null,
        tabla_ref: ancla?.tabla ?? null,
        registro_id: ancla ? String(ancla.registroId) : null,
        descripcion_ref: donde.slice(0, 300),
        motivo: motivo.trim(),
        imagen: imagen || null,
        pantalla: ctx.pantalla,
        subpantalla: ctx.subpantalla,
        ruta: ctx.ruta,
        creado_por: rolActual(),
      })
      if (error) throw error
      toast.success("Marcada. La vas a ver en Principal → Para revisar.")
      onClose()
      onGuardada?.()
    } catch (e) {
      toast.error("No se pudo marcar: " + (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🚩 {ancla ? "Marcar esta fila para revisar" : "Levantar algo para revisar"}</DialogTitle>
        </DialogHeader>

        <div className="rounded border bg-gray-50 px-2.5 py-2 text-[11px] leading-4 text-gray-600">
          <span className="font-medium">{ancla ? "Queda pegada a:" : "Queda pegada al contexto:"}</span> {donde}
        </div>

        {yaAbierta && (
          <div className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-800">
            ⚠️ Esto <b>ya está marcado</b>: «{yaAbierta.motivo}». Si guardás, quedan las dos.
          </div>
        )}

        <div>
          <Label className="text-xs">¿Qué viste?</Label>
          <Textarea
            className="mt-1" rows={3} autoFocus value={motivo}
            placeholder="Ej: la declaración de marzo no cuadra con el subdiario, revisar de dónde sale la diferencia"
            onChange={e => setMotivo(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs">Captura (opcional)</Label>
          {imagen ? (
            <div className="relative mt-1">
              <img src={imagen} alt="captura" className="max-h-48 w-full rounded border bg-gray-50 object-contain" />
              <button onClick={() => setImagen("")} title="Quitar"
                className="absolute right-1 top-1 rounded bg-white/90 p-1 text-gray-500 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="mt-1 rounded border border-dashed bg-gray-50 p-3 text-center">
              <ImageOff className="mx-auto mb-1 h-4 w-4 text-gray-300" />
              <p className="text-[11px] text-gray-600">
                <strong>Win + Shift + S</strong> y pegala acá con <strong>Ctrl + V</strong>
              </p>
            </div>
          )}
        </div>

        <p className="text-[11px] leading-4 text-gray-500">
          No hace falta que lo arregles ahora. Queda en <b>Principal → Para revisar</b>, donde vas a
          poder ir agregando lo que averigües hasta cerrarla.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Marcar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ── 1 · Pegada a una fila (comodidad, donde esté cableada) ───────────────── */

export function BotonRevision({
  schema, tabla, registroId, descripcion, abierta, onCambio,
}: AnclaFila & { abierta?: RevisionAbierta; onCambio?: () => void }) {
  const [modal, setModal] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setModal(true)}
        title={abierta ? `Marcada para revisar: ${abierta.motivo}` : "Marcar esta fila para revisar"}
        className={`inline-flex h-6 w-6 items-center justify-center rounded transition ${
          abierta ? "bg-amber-50 text-amber-600 ring-1 ring-amber-300" : "text-gray-300 hover:bg-amber-50 hover:text-amber-600"
        }`}
      >
        <Flag className="h-3.5 w-3.5" fill={abierta ? "currentColor" : "none"} />
      </button>
      <ModalMarca
        abierto={modal} onClose={() => setModal(false)}
        ancla={{ schema, tabla, registroId, descripcion }}
        yaAbierta={abierta} onGuardada={onCambio}
      />
    </>
  )
}

/* ── 2 · Global: está SIEMPRE, en toda la app ─────────────────────────────── */

/**
 * El botón flotante y `Alt+R`.
 *
 * Es la pieza que cumple la restricción del usuario: **no depende de que nadie haya cableado nada**
 * en la pantalla donde estás. El atajo existe por el mismo motivo que el `Alt+N`: con un modal
 * abierto el botón flotante queda tapado por el overlay del diálogo, y el modal es justo donde
 * suele aparecer lo que se quiere reportar.
 */
export function MarcaFlotante() {
  const [modal, setModal] = useState(false)

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      if ((e.key || "").toLowerCase() !== "r") return
      if (modal) return
      e.preventDefault()
      setModal(true)
    }
    document.addEventListener("keydown", atajo)
    return () => document.removeEventListener("keydown", atajo)
  }, [modal])

  return (
    <>
      {!modal && (
        <span className="fixed bottom-[7.6rem] right-4 z-50 select-none rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 shadow ring-1 ring-amber-200">
          Alt+R
        </span>
      )}
      <button
        onClick={() => setModal(true)}
        title="Levantar algo para revisar — un dato que no cuadra · atajo Alt+R"
        className="fixed bottom-[4.6rem] right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-amber-300 bg-white text-amber-700 shadow-lg transition hover:bg-amber-50"
      >
        <Flag className="h-5 w-5" />
      </button>
      <ModalMarca abierto={modal} onClose={() => setModal(false)} />
    </>
  )
}
