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
import { getRoleFromRoute } from "@/config/access-routes"
import {
  instalarCinta, mirarCinta, confirmarCorte, reiniciarCorte, type EventoDiagnostico,
} from "@/lib/cinta-diagnostico"

/** Ancho máximo de la captura guardada. Suficiente para leer un cartel, liviano para la fila. */
const ANCHO_MAX = 1400
const CALIDAD = 0.72

interface Captura {
  orden: number
  texto: string
  ruta: string
  pantalla: string
  /** El camino de solapas por debajo de `pantalla`: «Hacienda → Movimientos». */
  subpantalla: string
  modal: string
  titulo_doc: string
  imagen: string
  user_agent: string
  /** Los eventos técnicos previos a ESTA captura — A-FEAT-72. Ver `lib/cinta-diagnostico.ts`. */
  diagnostico: EventoDiagnostico[]
}

/**
 * 🔐 La ruta **sin el primer segmento** — A-SEC-04.
 *
 * En esta app el primer segmento **ES la contraseña** (`config/access-routes.ts`: `/adminjms1320`
 * da admin). Guardar `location.pathname` entero metía esa llave, en claro, en `notas_capturas` —
 * una tabla que `anon` lee entera ([A-SEC-01](PENDIENTES.md#a-sec-01)). Cualquiera que llegara a la
 * API se llevaba el acceso de admin sin adivinar nada.
 *
 * La nota necesita saber **dónde** estabas, no **con qué llave entraste**: `/adminjms1320/x/y` se
 * guarda como `/x/y`, y el usuario se guarda como **rol** (`admin` / `contable`), no como la ruta.
 *
 * ⚠️ Quedan filas viejas con el valor completo — se limpian aparte (son datos: se pregunta antes).
 */
function rutaSinLlave(): string {
  if (typeof window === "undefined") return ""
  const resto = window.location.pathname.split("/").filter(Boolean).slice(1)
  return "/" + resto.join("/") + window.location.search
}

/** El ROL de quien deja la nota, nunca su ruta de acceso. Ver `rutaSinLlave()`. */
function rolActual(): string | null {
  if (typeof window === "undefined") return null
  const primero = window.location.pathname.split("/").filter(Boolean)[0] ?? ""
  return getRoleFromRoute(primero)
}

/**
 * El texto visible de un nodo, salteando lo marcado con `data-nota-ignorar`.
 *
 * Existe por un caso real: el contador de pendientes vive DENTRO del `TabsTrigger`, así que el
 * `textContent` de la solapa pasó a ser «Sueldos11» en vez de «Sueldos» (las 5 notas del 2026-08-28
 * quedaron así). No rompe nada, pero **arruina `pantalla` como clave**: la misma pantalla se llama
 * distinto cada vez que cambia el contador, y deja de poder agruparse.
 *
 * Se resuelve acá y no en cada pantalla a propósito: cualquier adorno futuro que se meta en una
 * solapa se excluye marcándolo, sin volver a tocar esto.
 */
function textoLimpio(nodo: Element | null): string {
  if (!nodo) return ""
  const copia = nodo.cloneNode(true) as Element
  copia.querySelectorAll("[data-nota-ignorar]").forEach(n => n.remove())
  return (copia.textContent ?? "").trim()
}

/**
 * Lo que la app sabe de dónde está parado el usuario, sin que escriba nada.
 * Se lee del DOM porque es lo único que funciona igual en todas las pantallas sin tener que
 * instrumentar cada una — y si alguna cambia, esto degrada a vacío en vez de romper.
 */
function contextoActual() {
  // En el SERVIDOR no hay `document`. Y esto corre durante el render: `useRef(contextoActual())`
  // se evalúa también en SSR, así que sin este guard la página entera tiraba
  // `ReferenceError: document is not defined` → **500 en /adminjms1320**.
  // El contexto real igual se relee al capturar (`ctxRef.current = contextoActual()`), así que
  // devolver vacío acá no pierde nada.
  if (typeof document === "undefined") {
    return { ruta: "", pantalla: "", subpantalla: "", modal: "", titulo_doc: "", user_agent: "" }
  }
  /**
   * TODAS las solapas activas, no sólo la primera — mejora 2026-09-03.
   *
   * La app anida solapas: `Productivo → Hacienda → Movimientos`. Guardando sólo la de nivel 1
   * quedaba «Productivo», y el usuario terminaba **escribiendo el resto a mano** en el texto de la
   * nota (*"hacienda / movimientos"*) — justo el trabajo que esto viene a ahorrar.
   *
   * `pantalla` sigue siendo **sólo el nivel 1**, a propósito: es la clave por la que se agrupan las
   * notas, y meterle el camino entero la volvería distinta en cada sub-solapa. El resto va aparte,
   * en `subpantalla`.
   */
  const activas = Array.from(document.querySelectorAll('[role="tab"][data-state="active"]'))
    .map(t => textoLimpio(t))
    .filter(Boolean)
  const dialogo = document.querySelector('[role="dialog"] h2, [role="dialog"] [id$="-title"]')
  return {
    ruta: rutaSinLlave(),
    pantalla: (activas[0] ?? "").slice(0, 120),
    subpantalla: activas.slice(1).join(" → ").slice(0, 200),
    modal: textoLimpio(dialogo).slice(0, 160),
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

  /** La cinta de diagnóstico congelada al abrir la captura, igual que `ctxRef` — A-FEAT-72. */
  const diagRef = useRef<EventoDiagnostico[]>([])

  /**
   * Los eventos posteriores a la ÚLTIMA captura — A-FEAT-72.
   *
   * Sin esto se perdían, y justo en el caso más natural: hacés los pasos, algo explota, y vas
   * derecho a Finalizar. El error que motivó la nota quedaba afuera porque el corte sólo ocurría
   * al abrir una captura. Ahora se enganchan a la última captura, que es donde el usuario los
   * hubiera puesto si se hubiera acordado de capturar una vez más.
   */
  const sueltosRef = useRef<EventoDiagnostico[]>([])

  const abrirFinalizar = () => {
    sueltosRef.current = mirarCinta()
    setModalFinalizar(true)
  }

  /**
   * La cinta se engancha acá porque este componente vive en el layout: está montado en toda la app,
   * que es exactamente el alcance que necesita. `instalarCinta()` es idempotente, así que el doble
   * montaje de StrictMode en desarrollo no la duplica.
   */
  useEffect(() => { instalarCinta() }, [])

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
    // Y la cinta se mira en el mismo instante y por el mismo motivo: lo que interesa es lo que pasó
    // ANTES de abrir la nota. El corte se confirma recién al agregar la captura, así cancelar no
    // borra los eventos (ver `mirarCinta`).
    diagRef.current = mirarCinta()
    setTexto("")
    setImagen("")
    setModalCaptura(true)
  }

  /**
   * Atajo **Alt + N** — es la única vía cuando hay un modal abierto.
   *
   * El botón flotante es `fixed z-50`, pero el overlay de un `Dialog` se monta en un portal por
   * encima: con un modal abierto **el botón no se puede clickear**. Y el modal es justo donde
   * aparece lo que se quiere reportar — el usuario lo dijo textual: *"no puedo capturar con el
   * modal abierto"*. Un atajo no pelea con el z-index de nadie.
   *
   * `Alt+N` y no `Ctrl+Shift+N`: ese último abre una ventana de incógnito en Chrome.
   * El contexto se congela igual dentro de `abrirCaptura()`, así que el modal de la app queda
   * registrado en la captura (que es todo el punto).
   */
  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      if ((e.key || "").toLowerCase() !== "n") return
      if (modalCaptura || modalFinalizar) return // ya hay una nota abierta
      e.preventDefault()
      abrirCaptura()
    }
    document.addEventListener("keydown", atajo)
    return () => document.removeEventListener("keydown", atajo)
  }, [modalCaptura, modalFinalizar])

  const agregarCaptura = () => {
    if (!texto.trim() && !imagen) { toast.error("Escribí algo o pegá una captura"); return }
    setCapturas(cs => [...cs, {
      orden: cs.length + 1, texto: texto.trim(), imagen, ...ctxRef.current,
      diagnostico: diagRef.current,
    }])
    confirmarCorte(diagRef.current.length) // ya viajan en esta captura: la próxima arranca después
    setModalCaptura(false)
    if (!grabando) setGrabando(true)
    toast.success(`Captura ${capturas.length + 1} agregada`)
  }

  const finalizar = async () => {
    if (capturas.length === 0) { toast.error("No hay ninguna captura"); return }

    // Aviso, no bloqueo: de las primeras 15 capturas, **11 quedaron sin imagen** — y no porque
    // sacarla cueste (el usuario pega sin problema), sino porque nada se lo recordaba en el
    // momento. Se decidió NO generar la captura automáticamente: un redibujo del DOM da una
    // imagen peor y puede descolocar una columna, y el riesgo de una captura que miente es peor
    // que el de una que falta. Entonces la foto la saca él y esto sólo avisa si se olvidó.
    const sinFoto = capturas.filter(c => !c.imagen).length
    if (sinFoto > 0 && !window.confirm(
      sinFoto === capturas.length
        ? `Ninguna de las ${capturas.length} captura(s) tiene imagen.\n\n¿Guardar igual?`
        : `${sinFoto} de ${capturas.length} capturas no tienen imagen.\n\n¿Guardar igual?`
    )) return

    setGuardando(true)
    try {
      /**
       * El id se genera ACÁ y no se pide de vuelta — A-SEC-04.
       *
       * Antes esto era `.insert(...).select("id").single()`. Con la RLS puesta eso **rompe el
       * guardado**: `anon` tiene permiso de INSERT y nada más, y un `INSERT ... RETURNING`
       * necesita **además** permiso de lectura para devolver la fila. Verificado contra la base:
       * el INSERT solo pasa, el INSERT con RETURNING da
       * `42501: new row violates row-level security policy`.
       *
       * Generar el uuid del lado del cliente evita el viaje de vuelta y deja a `anon` con el
       * mínimo permiso posible. (`crypto.randomUUID` existe en todo contexto seguro: HTTPS y
       * localhost.)
       */
      const notaId = crypto.randomUUID()

      const { error } = await supabase.from("notas_para_claude").insert({
        id: notaId,
        titulo: titulo.trim() || capturas[0].texto.slice(0, 80) || "Sin título",
        estado: "finalizada",
        finalizada_at: new Date().toISOString(),
        usuario: rolActual(), // el ROL, no la ruta — A-SEC-04
      })
      if (error) throw error

      // Los eventos posteriores a la última captura se enganchan a ella (ver `sueltosRef`).
      const ultima = capturas.length - 1
      const { error: e2 } = await supabase.from("notas_capturas").insert(
        capturas.map((c, i) => ({
          ...c,
          nota_id: notaId,
          diagnostico: i === ultima && sueltosRef.current.length > 0
            ? [...c.diagnostico, ...sueltosRef.current]
            : c.diagnostico,
        }))
      )
      if (e2) throw e2

      toast.success(`Nota guardada con ${capturas.length} captura(s). Claude la va a ver al abrir sesión.`)
      reiniciarCorte() // lo de esta nota ya viajó: la próxima arranca limpia
      sueltosRef.current = []
      setCapturas([]); setGrabando(false); setModalFinalizar(false); setTitulo("")
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  /**
   * La lista sale por `/api/notas`, no de Supabase directo — A-SEC-04.
   * `anon` ya **no puede leer** estas tablas (sólo insertar), así que la lectura pasa por el
   * servidor, donde la `SERVICE_ROLE_KEY` no se expone. Ver el comentario del endpoint.
   */
  const cargarNotas = async () => {
    try {
      const r = await fetch("/api/notas")
      const j = await r.json()
      setNotas(j.notas ?? [])
      if (j.error) toast.error("No se pudieron cargar las notas: " + j.error)
    } catch (e) {
      setNotas([])
      toast.error("No se pudieron cargar las notas")
    }
  }

  const descartar = () => {
    if (capturas.length > 0 && !window.confirm(`¿Descartar la nota y sus ${capturas.length} captura(s)?`)) return
    setCapturas([]); setGrabando(false)
    reiniciarCorte() // que la próxima nota no arrastre los eventos de ésta
  }

  return (
    <>
      {/* Botón fijo — está en toda la app a propósito: la idea aparece donde aparece.
          El cartelito `Alt+N` va al lado y no sólo en el `title`: el atajo es la ÚNICA vía cuando
          hay un modal abierto, así que si no se recuerda, no sirve de nada (pedido del usuario). */}
      {!grabando && (
        <span className="fixed bottom-[3.9rem] right-4 z-50 select-none rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 shadow ring-1 ring-violet-200">
          Alt+N
        </span>
      )}
      {!grabando && (
        <button
          onClick={abrirCaptura}
          onContextMenu={(e) => { e.preventDefault(); setVerLista(true); cargarNotas() }}
          title="Dejar una nota para Claude · atajo Alt+N (anda también con un modal abierto) · click derecho: ver las notas"
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
          <Button size="sm" className="h-7 text-xs" onClick={abrirFinalizar}>
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
            {[ctxRef.current.pantalla && `pantalla «${ctxRef.current.pantalla}${
                ctxRef.current.subpantalla ? " → " + ctxRef.current.subpantalla : ""}»`,
              ctxRef.current.modal && `modal «${ctxRef.current.modal}»`].filter(Boolean).join(" · ")}
          </div>

          {/*
            🔎 La cinta de diagnóstico — A-FEAT-72.

            Se muestra y no se adjunta en silencio, por dos motivos. Uno: es el control de que la
            cinta ANDA — sin esto no hay forma de saber si capturó algo hasta abrir la base
            (§ CLAUDE.md «todo desarrollo termina con su control, y el control se ve»). Dos: el
            usuario tiene que poder VER qué se manda, que es la única manera de creerle a la lista
            blanca.
          */}
          {diagRef.current.length > 0 && (
            <details className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-4">
              <summary className="cursor-pointer font-medium text-amber-800">
                🔎 Se adjuntan {diagRef.current.length} evento(s) técnico(s) — tocá para verlos
              </summary>
              <ul className="mt-1.5 space-y-1 font-mono text-[10px] text-amber-900">
                {diagRef.current.map((ev, i) => (
                  <li key={i} className="border-t border-amber-200/70 pt-1">
                    <span className="text-amber-600">{ev.hora}</span>{" "}
                    <span className="font-semibold uppercase">{ev.tipo}</span>
                    {ev.codigo && <span className="ml-1 rounded bg-amber-200 px-1">{ev.codigo}</span>}
                    {ev.donde && <div className="text-amber-700">{ev.donde}</div>}
                    <div className="whitespace-pre-wrap break-words">{ev.msg}</div>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 border-t border-amber-200 pt-1 text-[10px] text-amber-700">
                Nunca viaja lo que escribiste en un campo, ni el contenido de las llamadas: sólo
                mensajes de error, el archivo y línea, y el camino de la llamada que falló.
              </p>
            </details>
          )}

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
          {sueltosRef.current.length > 0 && (
            <p className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-800">
              🔎 Se suman <strong>{sueltosRef.current.length} evento(s) técnico(s)</strong> posteriores
              a la última captura — se guardan junto con ella.
            </p>
          )}
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
