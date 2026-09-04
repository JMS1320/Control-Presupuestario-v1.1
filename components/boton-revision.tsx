"use client"

/**
 * 🚩 Marcar una fila «para revisar» — desde cualquier pantalla.
 *
 * ## De dónde salió (2026-09-04)
 * Auditando el archivo digital apareció una imputación dudosa. En palabras del usuario:
 * *"debería poder asignarle un warning a una factura para dejar un comentario y que sea revisado
 * (…) yo lo estoy viendo por la vinculación de las facturas pero podría haberlo visto en cualquier
 * lado"*.
 *
 * ## La decisión de diseño, que es suya: **partir del vínculo, no de la tarea**
 * La marca vive **pegada al registro**, no en una lista aparte. Por eso el componente recibe a qué
 * fila apunta y se puede enchufar en cualquier grilla sin escribir nada nuevo — igual que
 * `SelectorCuentaContable`.
 *
 * ## Por qué NO son las notas de `Alt+N`
 * Parecen lo mismo y no lo son: **distinto sujeto y distinto final**. Una nota habla de la **app** y
 * muere cuando se vuelve pendiente o se descarta; la lee Claude. Una marca habla de un **dato** y
 * muere cuando **alguien corrige el dato**. Mezclarlas llenaría una bandeja con el trabajo de la otra.
 *
 * ## Se ve en DOS lados, y los dos hacen falta
 * En **Principal** para acordarse de que existe, y **en la fila misma** para que quien entre a esa
 * pantalla se entere ahí, sin pasar por Principal.
 */

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Flag, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getRoleFromRoute } from "@/config/access-routes"

/** El ROL de quien marca, nunca la ruta de acceso (A-SEC-04: el 1er segmento ES la contraseña). */
function rolActual(): string | null {
  if (typeof window === "undefined") return null
  const primero = window.location.pathname.split("/").filter(Boolean)[0] ?? ""
  return getRoleFromRoute(primero)
}

/** La ruta sin el primer segmento — misma razón que arriba. */
function rutaSinLlave(): string {
  if (typeof window === "undefined") return ""
  return "/" + window.location.pathname.split("/").filter(Boolean).slice(1).join("/")
}

/** La solapa activa de nivel 1, para saber dónde se encontró el problema. */
function pantallaActual(): string {
  if (typeof document === "undefined") return ""
  const t = document.querySelector('[role="tab"][data-state="active"]')
  return (t?.textContent ?? "").trim().slice(0, 120)
}

export interface RevisionAbierta {
  id: string
  schema_ref: string
  tabla_ref: string
  registro_id: string
  descripcion_ref: string
  motivo: string
  pantalla: string | null
  estado: string
  creado_por: string | null
  created_at: string
}

/**
 * Las marcas abiertas de una tabla, cargadas UNA vez por pantalla.
 *
 * A propósito no se consulta por fila: una grilla de 40 facturas dispararía 40 consultas para
 * pintar 40 banderitas que casi siempre están apagadas.
 */
export function useRevisionesDe(schema: string, tabla: string) {
  const [porRegistro, setPorRegistro] = useState<Record<string, RevisionAbierta>>({})

  const recargar = useCallback(async () => {
    try {
      const r = await fetch("/api/revisiones")
      const j = await r.json()
      const mapa: Record<string, RevisionAbierta> = {}
      for (const v of (j.revisiones ?? []) as RevisionAbierta[]) {
        if (v.schema_ref === schema && v.tabla_ref === tabla) mapa[v.registro_id] = v
      }
      setPorRegistro(mapa)
    } catch {
      setPorRegistro({}) // que falle esto no puede romper la grilla
    }
  }, [schema, tabla])

  useEffect(() => { recargar() }, [recargar])
  return { porRegistro, recargar }
}

interface Props {
  schema: string
  tabla: string
  registroId: string
  /** El texto legible que queda congelado en la marca. Ver la LÁPIDA en el comentario de la tabla. */
  descripcion: string
  /** La marca abierta de esta fila, si la hay (viene de `useRevisionesDe`). */
  abierta?: RevisionAbierta
  onCambio?: () => void
}

export function BotonRevision({ schema, tabla, registroId, descripcion, abierta, onCambio }: Props) {
  const [modal, setModal] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    if (!motivo.trim()) { toast.error("Escribí qué viste"); return }
    setGuardando(true)
    try {
      // El id se genera acá y no se pide de vuelta: `anon` sólo tiene INSERT, y un
      // `INSERT … RETURNING` necesita además permiso de lectura (A-SEC-04).
      const { error } = await supabase.from("revisiones").insert({
        id: crypto.randomUUID(),
        schema_ref: schema,
        tabla_ref: tabla,
        registro_id: String(registroId),
        descripcion_ref: descripcion.slice(0, 300),
        motivo: motivo.trim(),
        pantalla: pantallaActual(),
        ruta: rutaSinLlave(),
        creado_por: rolActual(),
      })
      if (error) throw error
      toast.success("Marcada para revisar. La vas a ver en Principal.")
      setMotivo(""); setModal(false)
      onCambio?.()
    } catch (e) {
      toast.error("No se pudo marcar: " + (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModal(true)}
        title={abierta ? `Marcada para revisar: ${abierta.motivo}` : "Marcar para revisar"}
        className={`inline-flex h-6 w-6 items-center justify-center rounded transition ${
          abierta
            ? "text-amber-600 bg-amber-50 ring-1 ring-amber-300"
            : "text-gray-300 hover:text-amber-600 hover:bg-amber-50"
        }`}
      >
        <Flag className="h-3.5 w-3.5" fill={abierta ? "currentColor" : "none"} />
      </button>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>🚩 Marcar para revisar</DialogTitle></DialogHeader>

          <div className="rounded border bg-gray-50 px-2.5 py-2 text-[11px] leading-4 text-gray-600">
            <span className="font-medium">Queda pegada a:</span> {descripcion}
          </div>

          {abierta && (
            <div className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-800">
              ⚠️ Esta fila <b>ya está marcada</b>: «{abierta.motivo}». Si guardás, quedan las dos.
            </div>
          )}

          <div>
            <Label className="text-xs">¿Qué viste?</Label>
            <Textarea
              className="mt-1" rows={3} autoFocus value={motivo}
              placeholder="Ej: la imputación no coincide con el proveedor, revisar contra el comprobante"
              onChange={e => setMotivo(e.target.value)}
            />
          </div>

          <p className="text-[11px] leading-4 text-gray-500">
            No hace falta que lo arregles ahora. Queda en <b>Principal → Para revisar</b> hasta que
            alguien la cierre diciendo qué hizo.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Marcar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
