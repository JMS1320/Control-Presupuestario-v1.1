"use client"

/**
 * 📝 Notas para Claude — dejar un bug o una idea **en el momento y el contexto** en que pasa.
 *
 * ## Por qué (P-34)
 * Hoy los pendientes se dictan de memoria, días después. *"Ajuste de 2 meses en un solo"* no se
 * entiende tres semanas más tarde. Lo valioso no es la nota: es **el contexto que se captura solo**.
 *
 * ## Una nota es una GRABACIÓN, no un evento
 * El usuario marca «nota», hace lo que iba a hacer, captura cuantas veces necesite y **finaliza**.
 * La app no sabe cuántas capturas serán. Eso convierte *"no anda"* en un caso con pasos numerados,
 * cada uno con su pantalla real — la diferencia entre un comentario y un bug con receta.
 *
 * ## La captura se PEGA del portapapeles, no se renderiza
 * `Win+Shift+S` → `Ctrl+V`. Es a propósito: las alertas que más interrumpen son `alert()` nativos
 * (hay 188 en la app) y **ninguna librería de captura de DOM puede fotografiarlos**. Pegar del
 * portapapeles agarra exactamente lo que el usuario vio, incluido eso.
 *
 * ## 🔒 La regla que evita que se vuelva un tacho
 * **Una nota NO es un pendiente: es una bandeja de entrada.** Al leerla termina como ítem con ID en
 * `PENDIENTES.md` o descartada con motivo, y se marca `leida`. Si no, en dos meses hay 80 notas que
 * nadie mira.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, NotebookPen, Camera, Check, X, Trash2, ImageOff } from "lucide-react"
import { toast } from "sonner"

/** Ancho máximo de la captura guardada. Suficiente para leer un cartel, liviano para la fila. */
const ANCHO_MAX = 1400
const CALIDAD = 0.72

interface Captura {
  orden: number
  texto: string
  ruta: string
  pantalla: string
  modal: string
  titulo_doc: string
  imagen: string
  user_agent: string
}

/**
 * Lo que la app sabe de dónde está parado el usuario, sin que escriba nada.
 * Se lee del DOM porque es lo único que funciona igual en todas las pantallas sin tener que
 * instrumentar cada una — y si alguna cambia, esto degrada a vacío en vez de romper.
 */
function contextoActual() {
  const tab = document.querySelector('[role="tab"][data-state="active"]')
  const dialogo = document.querySelector('[role="dialog"] h2, [role="dialog"] [id$="-title"]')
  return {
    ruta: typeof window !== "undefined" ? window.location.pathname + window.location.search : "",
    pantalla: (tab?.textContent ?? "").trim().slice(0, 120),
    modal: (dialogo?.textContent ?? "").trim().slice(0, 160),
    titulo_doc: document.title.slice(0, 160),
    user_agent: navigator.userAgent.slice(0, 200),
  }
}

/** Redimensiona y comprime para que la fila no pese de más. */
async function comprimir(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  const escala = Math.min(1, ANCHO_MAX / bitmap.width)
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", CALIDAD)
}

export function NotasParaClaude() {
  const [grabando, setGrabando] = useState(false)
  const [capturas, setCapturas] = useState<Captura[]>([])
  const [modalCaptura, setModalCaptura] = useState(false)
  const [modalFinalizar, setModalFinalizar] = useState(false)
  const [verLista, setVerLista] = useState(false)

  const [texto, setTexto] = useState("")
  const [imagen, setImagen] = useState("")
  const [titulo, setTitulo] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [notas, setNotas] = useState<any[]>([])
  const ctxRef = useRef(contextoActual())

  /** Pegar desde el portapapeles: es la vía principal para traer la captura. */
  const pegar = useCallback(async (e: ClipboardEvent) => {
    const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith("image/"))
    if (!item) return
    const blob = item.getAsFile()
    if (!blob) return
    e.preventDefault()
    try {
      setImagen(await comprimir(blob))
      toast.success("Captura pegada")
    } catch {
      toast.error("No se pudo procesar la imagen")
    }
  }, [])

  useEffect(() => {
    if (!modalCaptura) return
    document.addEventListener("paste", pegar as any)
    return () => document.removeEventListener("paste", pegar as any)
  }, [modalCaptura, pegar])

  const abrirCaptura = () => {
    // El contexto se congela ANTES de abrir el modal: si no, el modal se capturaría a sí mismo
    // como "el modal abierto" y perderíamos dónde estaba realmente el usuario.
    ctxRef.current = contextoActual()
    setTexto("")
    setImagen("")
    setModalCaptura(true)
  }

  const agregarCaptura = () => {
    if (!texto.trim() && !imagen) { toast.error("Escribí algo o pegá una captura"); return }
    setCapturas(cs => [...cs, { orden: cs.length + 1, texto: texto.trim(), imagen, ...ctxRef.current }])
    setModalCaptura(false)
    if (!grabando) setGrabando(true)
    toast.success(`Captura ${capturas.length + 1} agregada`)
  }

  const finalizar = async () => {
    if (capturas.length === 0) { toast.error("No hay ninguna captura"); return }
    setGuardando(true)
    try {
      const { data: nota, error } = await supabase
        .from("notas_para_claude")
        .insert({
          titulo: titulo.trim() || capturas[0].texto.slice(0, 80) || "Sin título",
          estado: "finalizada",
          finalizada_at: new Date().toISOString(),
          usuario: window.location.pathname.split("/")[1] || null,
        })
        .select("id")
        .single()
      if (error) throw error

      const { error: e2 } = await supabase.from("notas_capturas").insert(
        capturas.map(c => ({ ...c, nota_id: nota.id }))
      )
      if (e2) throw e2

      toast.success(`Nota guardada con ${capturas.length} captura(s). Claude la va a ver al abrir sesión.`)
      setCapturas([]); setGrabando(false); setModalFinalizar(false); setTitulo("")
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const cargarNotas = async () => {
    const { data } = await supabase
      .from("notas_para_claude")
      .select("id, titulo, estado, resultado, created_at, notas_capturas(count)")
      .order("created_at", { ascending: false })
      .limit(30)
    setNotas(data ?? [])
  }

  const descartar = () => {
    if (capturas.length > 0 && !window.confirm(`¿Descartar la nota y sus ${capturas.length} captura(s)?`)) return
    setCapturas([]); setGrabando(false)
  }

  return (
    <>
      {/* Botón fijo — está en toda la app a propósito: la idea aparece donde aparece */}
      {!grabando && (
        <button
          onClick={abrirCaptura}
          onContextMenu={(e) => { e.preventDefault(); setVerLista(true); cargarNotas() }}
          title="Dejar una nota para Claude (click derecho: ver las notas)"
          className="fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-violet-300 bg-white text-violet-700 shadow-lg transition hover:bg-violet-50"
        >
          <NotebookPen className="h-5 w-5" />
        </button>
      )}

      {/* Barra de grabación */}
      {grabando && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-violet-300 bg-white px-3 py-2 shadow-lg">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-600" />
          </span>
          <span className="text-xs font-medium text-violet-900">
            Grabando · {capturas.length} captura{capturas.length === 1 ? "" : "s"}
          </span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={abrirCaptura}>
            <Camera className="mr-1 h-3 w-3" /> Capturar
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={() => setModalFinalizar(true)}>
            <Check className="mr-1 h-3 w-3" /> Finalizar
          </Button>
          <button onClick={descartar} title="Descartar" className="text-gray-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Modal de captura ─────────────────────────────────────────────── */}
      <Dialog open={modalCaptura} onOpenChange={setModalCaptura}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {grabando ? `Captura ${capturas.length + 1}` : "Nueva nota para Claude"}
            </DialogTitle>
          </DialogHeader>

          <div>
            <Label className="text-xs">¿Qué pasó / qué se te ocurrió?</Label>
            <Textarea className="mt-1" rows={3} autoFocus value={texto} placeholder="Ej: al pagar el lote saltó este cartel y no entendí qué hacer"
              onChange={e => setTexto(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Captura de pantalla</Label>
            {imagen ? (
              <div className="relative mt-1">
                <img src={imagen} alt="captura" className="max-h-56 w-full rounded border object-contain bg-gray-50" />
                <button onClick={() => setImagen("")} title="Quitar"
                  className="absolute right-1 top-1 rounded bg-white/90 p-1 text-gray-500 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="mt-1 rounded border border-dashed bg-gray-50 p-4 text-center">
                <ImageOff className="mx-auto mb-1 h-5 w-5 text-gray-300" />
                <p className="text-xs text-gray-600">
                  Sacá la captura con <strong>Win + Shift + S</strong> y pegala acá con <strong>Ctrl + V</strong>
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  Es a propósito: así también se pueden fotografiar los carteles del navegador, que
                  ninguna captura automática puede agarrar.
                </p>
                <input type="file" accept="image/*" className="mx-auto mt-2 block text-[11px]"
                  onChange={async e => {
                    const f = e.target.files?.[0]
                    if (f) { try { setImagen(await comprimir(f)) } catch { toast.error("No se pudo leer la imagen") } }
                  }} />
              </div>
            )}
          </div>

          <div className="rounded border bg-gray-50 px-2.5 py-2 text-[11px] leading-4 text-gray-500">
            <span className="font-medium text-gray-600">Se guarda solo:</span>{" "}
            {[ctxRef.current.pantalla && `pantalla «${ctxRef.current.pantalla}»`,
              ctxRef.current.modal && `modal «${ctxRef.current.modal}»`,
              ctxRef.current.ruta].filter(Boolean).join(" · ")}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalCaptura(false)}>Cancelar</Button>
            <Button onClick={agregarCaptura}>
              {grabando ? "Agregar captura" : "Empezar nota"}
            </Button>
          </div>
          {!grabando && (
            <p className="text-[11px] leading-4 text-gray-500">
              Después podés seguir usando la app y agregar más capturas. La nota se guarda cuando
              tocás <strong>Finalizar</strong>.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Finalizar ────────────────────────────────────────────────────── */}
      <Dialog open={modalFinalizar} onOpenChange={setModalFinalizar}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Finalizar la nota</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">{capturas.length} captura(s) grabada(s).</p>
          <div>
            <Label className="text-xs">Título (opcional)</Label>
            <Input className="mt-1" value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder={capturas[0]?.texto.slice(0, 60) || "Ej: el lote de pagos deja todo en pagar"} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalFinalizar(false)}>Volver</Button>
            <Button onClick={finalizar} disabled={guardando}>
              {guardando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Guardar nota
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Lista de notas (click derecho en el botón) ───────────────────── */}
      <Dialog open={verLista} onOpenChange={setVerLista}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Notas dejadas para Claude</DialogTitle></DialogHeader>
          {notas.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Todavía no hay notas.</p>
          ) : (
            <div className="space-y-1.5">
              {notas.map(n => (
                <div key={n.id} className="flex flex-wrap items-center gap-2 rounded border px-2.5 py-1.5 text-xs">
                  <Badge variant="outline" className={`text-[10px] ${
                    n.estado === "finalizada" ? "border-violet-400 bg-violet-50 text-violet-800"
                    : n.estado === "leida" ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                    : "text-gray-500"}`}>
                    {n.estado === "finalizada" ? "sin leer" : n.estado}
                  </Badge>
                  <span className="flex-1 truncate text-gray-800">{n.titulo}</span>
                  <span className="text-gray-400">{n.notas_capturas?.[0]?.count ?? 0} cap.</span>
                  <span className="text-gray-400">{String(n.created_at).slice(0, 10)}</span>
                  {n.resultado && <span className="w-full text-[11px] text-gray-500">→ {n.resultado}</span>}
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] leading-4 text-gray-500">
            Una nota <strong>no es un pendiente</strong>: es una bandeja de entrada. Al leerla, Claude
            la convierte en un ítem con ID en <code>PENDIENTES.md</code> o la descarta con motivo, y
            queda marcada como leída.
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
