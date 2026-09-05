"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertTriangle, ImagePlus, Loader2, Trash2 } from "lucide-react"

/** Lo mínimo para no mandar al servidor algo que no es un link. El resto lo valida el endpoint. */
function pareceLink(texto: string): boolean {
  return /^https?:\/\/\S+$/i.test(texto.trim())
}

/**
 * Un solo control para poner la foto de perfil: **pegar un link, elegir un archivo, arrastrarlo
 * o pegar la imagen del portapapeles** (A-FEAT-83).
 *
 * Antes eran dos controles separados y en dos lugares distintos de la tarjeta: un botón «Subir una
 * imagen» arriba y, cinco campos más abajo, un input de texto «…o pegar la dirección». Además se
 * comportaban distinto — el botón guardaba solo y el input necesitaba «Guardar cambios» —, así que
 * había que leer la letra chica para saber si la foto ya estaba puesta o no.
 *
 * Acá **las cuatro maneras son la misma cosa**: den lo que den, terminan en una imagen guardada en
 * nuestro Storage y en un solo `onCambio` con la URL final. El link no se guarda como link: lo
 * descarga el servidor (ver `traerImagenRemota`).
 *
 * **Y guarda al toque, siempre.** No hay estado intermedio "elegida pero sin guardar" a propósito:
 * la foto se guarda en una ruta fija que se sobrescribe (`<id>/avatar`), así que apenas se sube ya
 * cambió para todo el mundo. Un botón «Guardar» acá sería mentira — diría que no pasó nada cuando
 * ya pasó.
 */
export function SelectorImagenPerfil({
  valor,
  iniciales,
  onCambio,
}: {
  /** La URL de la foto actual, o vacío si no tiene. */
  valor: string
  /** Qué mostrar cuando no hay foto. */
  iniciales: string
  /** Se llama con la URL final ya guardable, o con `""` al quitarla. Persiste el que llama. */
  onCambio: (url: string) => Promise<void>
}) {
  const [link, setLink] = useState("")
  const [trabajando, setTrabajando] = useState<"" | "subiendo" | "bajando" | "quitando">("")
  const [arrastrando, setArrastrando] = useState(false)
  /** El control: ¿la foto que quedó guardada se puede mostrar de verdad? */
  const [estadoImagen, setEstadoImagen] = useState<"idle" | "loading" | "loaded" | "error">("idle")
  const inputArchivo = useRef<HTMLInputElement>(null)

  const ocupado = trabajando !== ""

  /** El único camino al servidor: reciba archivo o link, sale por acá. */
  async function enviar(cuerpo: FormData, modo: "subiendo" | "bajando") {
    setTrabajando(modo)
    const res = await fetch("/api/perfil/avatar", { method: "POST", body: cuerpo })
    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      setTrabajando("")
      // El mensaje viene del endpoint: dice el motivo real (tipo, tamaño, link caído, o que
      // falta el bucket). Uno genérico acá taparía el único dato que sirve para arreglarlo.
      toast.error(json.error ?? "No se pudo cargar la imagen.")
      return
    }

    await onCambio(json.url as string)
    setTrabajando("")
    setLink("")
  }

  function usarArchivo(archivo: File | null | undefined) {
    if (!archivo || ocupado) return
    if (!archivo.type.startsWith("image/")) {
      toast.error("Eso no es una imagen.")
      return
    }
    const cuerpo = new FormData()
    cuerpo.append("archivo", archivo)
    void enviar(cuerpo, "subiendo")
  }

  function usarLink() {
    if (ocupado) return
    if (!pareceLink(link)) {
      toast.error("Pegá un link que empiece con http:// o https://.")
      return
    }
    const cuerpo = new FormData()
    cuerpo.append("url", link.trim())
    void enviar(cuerpo, "bajando")
  }

  async function quitar() {
    setTrabajando("quitando")
    await onCambio("")
    setTrabajando("")
  }

  /**
   * Pegar con Ctrl+V sobre el recuadro.
   *
   * Sirve para las dos cosas y no hay que elegir cuál: si en el portapapeles hay una **imagen**
   * (una captura de pantalla recién sacada) se sube; si hay **texto** que parece un link, se
   * escribe en el campo. Es el mismo gesto para los dos casos, que es de lo que se trata todo esto.
   */
  function pegar(e: React.ClipboardEvent) {
    const archivo = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"))
    if (archivo) {
      e.preventDefault()
      usarArchivo(archivo)
      return
    }
    const texto = e.clipboardData.getData("text").trim()
    if (pareceLink(texto)) {
      e.preventDefault()
      setLink(texto)
    }
  }

  function soltar(e: React.DragEvent) {
    e.preventDefault()
    setArrastrando(false)
    const archivo = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"))
    if (archivo) {
      usarArchivo(archivo)
      return
    }
    // Arrastrar una imagen **desde otra pestaña** no trae un archivo: trae su URL como texto.
    // Sin esto, el gesto más natural de todos (traerla de Google Imágenes) no haría nada.
    const texto = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain")
    if (pareceLink(texto)) setLink(texto.trim())
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
        // `relatedTarget` es a dónde se fue el puntero: sin este chequeo, cruzar por encima del
        // input o del botón cuenta como salir del recuadro y el resaltado titila mientras
        // arrastrás justo adonde tenés que soltar.
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastrando(false)
        }}
        onDrop={soltar}
        onPaste={pegar}
        className={`flex items-center gap-4 rounded-lg border border-dashed p-4 transition-colors ${
          arrastrando ? "border-primary bg-primary/5" : "border-input bg-muted/30"
        }`}
      >
        <Avatar className="h-16 w-16 shrink-0">
          {valor.trim() && (
            <AvatarImage
              src={valor.trim()}
              alt=""
              onLoadingStatusChange={setEstadoImagen}
            />
          )}
          <AvatarFallback className="bg-slate-200 text-lg font-semibold text-slate-700">
            {iniciales}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex gap-2">
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); usarLink() } }}
              disabled={ocupado}
              placeholder="Pegá el link de una imagen, o arrastrala acá"
              aria-label="Link de la imagen de perfil"
            />
            {/* El botón de archivo vive **dentro** del mismo campo, pegado al input: es la misma
                decisión («qué foto va») y no dos tareas distintas en dos lugares de la pantalla. */}
            {link.trim() ? (
              <Button type="button" onClick={usarLink} disabled={ocupado}>
                {trabajando === "bajando" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Usar"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={ocupado}
                onClick={() => inputArchivo.current?.click()}
              >
                {trabajando === "subiendo" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Elegir</span>
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {trabajando === "bajando"
              ? "Descargando la imagen del link…"
              : trabajando === "subiendo"
                ? "Subiendo la imagen…"
                : "Con el cursor en el campo también podés pegarla con Ctrl+V. JPG, PNG, WEBP o GIF, hasta 2 MB."}
          </p>
        </div>

        {valor.trim() && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground"
            disabled={ocupado}
            onClick={quitar}
            title="Quitar la foto y volver a las iniciales"
          >
            {trabajando === "quitando" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span className="sr-only">Quitar la foto</span>
          </Button>
        )}
      </div>

      {/* El CONTROL, y no es decorativo: `<Avatar>` cae a las iniciales cuando la imagen no carga,
          así que sin este aviso una foto rota se ve **exactamente igual** que una cuenta sin foto —
          se guardó, no dio ningún error, y no se ve. Es el modo de falla que ya pasó con la CSP
          (ver `middleware.ts`). Ahora falla a la vista. */}
      {valor.trim() && estadoImagen === "error" && (
        <p className="flex items-start gap-2 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            La foto está guardada pero el navegador no la puede mostrar, así que se ven tus
            iniciales. Probá cargarla de nuevo; si sigue igual, quitala.
          </span>
        </p>
      )}

      {/* El input real va oculto: el que trae el navegador no se puede estilar y queda fuera de
          lugar. Se limpia el `value` en cada `change` para que elegir DOS VECES el mismo archivo
          vuelva a disparar el evento — si no, el segundo intento no hace nada. */}
      <input
        ref={inputArchivo}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ""
          usarArchivo(f)
        }}
      />
    </div>
  )
}
