"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { LayoutGrid, GripVertical, X, Plus, RotateCcw } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Ayuda } from "@/components/ayuda"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { WIDGETS, WIDGETS_POR_DEFECTO, widgetsVisibles, type Widget } from "@/lib/widgets/registro"
import type { Preferencias } from "@/lib/auth/preferencias"

type Tamano = { ancho: 1 | 2; alto: number }

/** Mientras se arrastra un borde: qué widget, en qué eje, y desde dónde. */
type Redimension = {
  id: string
  eje: "ancho" | "alto"
  desdeX: number
  desdeY: number
  altoInicial: number
}

/**
 * PANTALLA DE INICIO CONFIGURABLE (A-FEAT-88).
 *
 * ⚠️ **`secciones` es el permiso, y por eso viene por prop desde el servidor.** La lista de
 * widgets vive en `user_metadata`, que el propio usuario escribe con un `updateUser`; si el filtro
 * se hiciera con algo que también sale de ahí, cualquiera se agregaría un widget de una sección
 * que su rol no habilita. `widgetsVisibles()` cruza las dos cosas: la preferencia dice **qué y en
 * qué orden**, el rol dice **qué está permitido**. Misma puerta que `seccionInicio` (A-FEAT-83).
 */
export function VistaInicio({
  preferencias,
  secciones,
}: {
  preferencias: Preferencias
  /** Las secciones que habilita el ROL, leídas en el servidor. La única fuente de verdad. */
  secciones: string[]
}) {
  const [elegidos, setElegidos] = useState<string[]>(preferencias.widgets ?? WIDGETS_POR_DEFECTO)
  const [tamanos, setTamanos] = useState<Record<string, Tamano>>(preferencias.widgetsTamano)
  const [configurando, setConfigurando] = useState(false)

  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [encima, setEncima] = useState<{ id: string; lado: "antes" | "despues" } | null>(null)
  const [redim, setRedim] = useState<Redimension | null>(null)
  /** El alto en vivo mientras se arrastra el borde, antes de guardarlo. */
  const [altoVivo, setAltoVivo] = useState<{ id: string; px: number } | null>(null)
  const [anchoVivo, setAnchoVivo] = useState<{ id: string; cols: 1 | 2 | null } | null>(null)
  const cajas = useRef<Record<string, HTMLDivElement | null>>({})

  const visibles = widgetsVisibles(elegidos, secciones)
  const disponibles = WIDGETS.filter(
    (w) => secciones.includes(w.seccion) && !elegidos.includes(w.id)
  )

  const tamanoDe = (w: Widget): Tamano =>
    tamanos[w.id] ?? { ancho: w.ancho === "completo" ? 2 : 1, alto: 0 }

  /** Una sola escritura para todo: orden y tamaños viajan juntos siempre. */
  async function persistir(nuevosIds: string[], nuevosTamanos: Record<string, Tamano>) {
    const antesIds = elegidos
    const antesTam = tamanos
    setElegidos(nuevosIds)
    setTamanos(nuevosTamanos)
    // Se manda el objeto entero: `updateUser` REEMPLAZA la clave, no la mergea.
    const { error } = await supabase.auth.updateUser({
      data: {
        preferencias: { ...preferencias, widgets: nuevosIds, widgetsTamano: nuevosTamanos },
      },
    })
    if (error) {
      setElegidos(antesIds)
      setTamanos(antesTam)
      toast.error("No se pudo guardar. Probá de nuevo.")
    }
  }

  const guardarOrden = (ids: string[]) => persistir(ids, tamanos)
  const quitar = (id: string) => guardarOrden(elegidos.filter((w) => w !== id))
  const agregar = (id: string) => guardarOrden([...elegidos, id])

  function soltarEn(destino: string, lado: "antes" | "despues") {
    const origen = arrastrando
    setArrastrando(null)
    setEncima(null)
    if (!origen || origen === destino) return

    // ⚠️ El índice se calcula sobre la lista YA SIN el que se arrastra. Sobre la original daba un
    // corrimiento de uno al mover hacia adelante, y la tarjeta caía del otro lado del destino:
    // el resultado dependía de la DIRECCIÓN del arrastre en vez de dónde soltabas.
    const sinOrigen = elegidos.filter((w) => w !== origen)
    const i = sinOrigen.indexOf(destino)
    if (i < 0) return
    sinOrigen.splice(lado === "antes" ? i : i + 1, 0, origen)
    guardarOrden(sinOrigen)
  }

  // ─────────────────────────── redimensionar arrastrando el borde ───────────────────────────

  function empezarRedim(e: React.PointerEvent, w: Widget, eje: "ancho" | "alto") {
    e.preventDefault()
    e.stopPropagation() // que el borde no dispare también el arrastre de la tarjeta
    // Captura: el puntero sigue mandando eventos aunque se salga de la franja, que es de 6px.
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setRedim({
      id: w.id,
      eje,
      desdeX: e.clientX,
      desdeY: e.clientY,
      altoInicial: tamanoDe(w).alto || cajas.current[w.id]?.offsetHeight || 160,
    })
  }

  function moverRedim(e: React.PointerEvent) {
    if (!redim) return
    if (redim.eje === "alto") {
      setAltoVivo({
        id: redim.id,
        px: Math.min(Math.max(redim.altoInicial + (e.clientY - redim.desdeY), 100), 800),
      })
    } else {
      // Aviso en vivo también para el ancho: sin esto, arrastrar el borde derecho no mostraba
      // NADA hasta soltar, y si no llegabas al umbral parecía que la tarjeta estaba trabada.
      setAnchoVivo({ id: redim.id, cols: e.clientX - redim.desdeX > 60 ? 2 : e.clientX - redim.desdeX < -60 ? 1 : null })
    }
  }

  function terminarRedim(e: React.PointerEvent, w: Widget) {
    if (!redim || redim.id !== w.id) return
    const actual = tamanoDe(w)
    let nuevo: Tamano

    if (redim.eje === "ancho") {
      // El ancho es discreto: la grilla tiene 2 columnas, no hay medio widget. Un umbral de 60px
      // evita que un clic sin querer cambie la columna.
      const dx = e.clientX - redim.desdeX
      nuevo = { ...actual, ancho: dx > 60 ? 2 : dx < -60 ? 1 : actual.ancho }
    } else {
      nuevo = { ...actual, alto: altoVivo?.id === w.id ? altoVivo.px : actual.alto }
    }

    setRedim(null)
    setAltoVivo(null)
    setAnchoVivo(null)
    if (nuevo.ancho !== actual.ancho || nuevo.alto !== actual.alto) {
      persistir(elegidos, { ...tamanos, [w.id]: nuevo })
    }
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="titulo-pantalla">Principal</h1>
        <Button
          variant={configurando ? "default" : "secondary"}
          size="sm"
          className="gap-2"
          onClick={() => setConfigurando((c) => !c)}
        >
          <LayoutGrid className="h-4 w-4" />
          {configurando ? "Listo" : "Configurar mi inicio"}
        </Button>
      </div>

      {configurando && (
        <Card className="border-dashed">
          <CardContent className="space-y-4 p-4">
            <Ayuda className="text-sm">
              Arrastrá una tarjeta <strong>desde su manija</strong> (⣿, arriba a la izquierda) y
              soltala donde quieras: la línea azul te muestra dónde va a caer. Para cambiarle el
              tamaño, <strong>pasá el mouse por el borde derecho o el de abajo</strong> y arrastrá.
              Se guarda solo, y es tuyo: no le cambia la pantalla a nadie más.
            </Ayuda>

            {disponibles.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Para agregar</p>
                <div className="flex flex-wrap gap-2">
                  {disponibles.map((w) => (
                    <Button
                      key={w.id}
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      title={w.descripcion}
                      onClick={() => agregar(w.id)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {w.titulo}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ya tenés todos los widgets disponibles para tu cuenta.
              </p>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => persistir(WIDGETS_POR_DEFECTO, {})}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Volver a la pantalla original
            </Button>
          </CardContent>
        </Card>
      )}

      {visibles.length === 0 ? (
        // Vacío a propósito y vacío por accidente se ven igual, así que la pantalla dice cuál es
        // y cómo salir. Sin esto, quitar el último widget dejaba una página en blanco.
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <LayoutGrid className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">Tu inicio está vacío</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tocá «Configurar mi inicio» y elegí qué querés ver acá.
            </p>
          </CardContent>
        </Card>
      ) : (
        /*
          MASONRY con columnas CSS, no con `grid`.
          ⚠️ Con `grid` las tarjetas se acomodan por FILAS, y la fila entera mide lo que mide la
          más alta. Una tarjeta corta al lado de una larga dejaba media pantalla en blanco — y ese
          blanco no es un hueco donde soltar algo, es el sobrante de la fila: por más que se
          arreglara el arrastre, ahí no entraba nada. Con columnas, cada tarjeta ocupa su alto y la
          siguiente arranca pegada.
          El precio, que conviene saber: el orden fluye **hacia abajo y después a la derecha**, no
          de izquierda a derecha. Con pocas tarjetas se lee igual, y es lo que hace que no queden
          huecos.
        */
        <div className="columns-1 gap-4 sm:columns-2">
          {visibles.map((w) => {
            const t = tamanoDe(w)
            const alto = altoVivo?.id === w.id ? altoVivo.px : t.alto
            const ancho =
              anchoVivo?.id === w.id && anchoVivo.cols !== null ? anchoVivo.cols : t.ancho
            return (
              <div
                key={w.id}
                ref={(el) => { cajas.current[w.id] = el }}
                /* El alto va en el contenido, no acá: si lo pusiéramos en el contenedor, achicar
                   dejaría la tarjeta flotando con espacio muerto debajo en vez de encogerse. */
                className={[
                  // `flex` + `flex-1` en el hijo es lo que hace que el alto llegue a la tarjeta.
                  // Con `min-height` en el contenedor y `h-full` adentro no pasaba nada: un
                  // `height:100%` se resuelve contra la ALTURA del padre, que acá es `auto` —
                  // así que la tarjeta quedaba de su tamaño y el contenedor crecía vacío.
                  "group/w relative flex flex-col",
                  // En columnas CSS hay que pedir explícitamente que la tarjeta no se parta al
                  // medio entre una columna y la siguiente. `w-full` + el margen de abajo hacen
                  // de separación: el `gap` de las columnas sólo separa en horizontal.
                  "mb-4 w-full break-inside-avoid",
                  // El widget "ancho" cruza las dos columnas. `column-span` es la forma de
                  // hacerlo en multicolumna; `col-span-2` es de grid y acá no hace nada.
                  ancho === 2 ? "sm:[column-span:all]" : "",
                  arrastrando === w.id ? "opacity-40" : "",
                ].join(" ")}
                /*
                  ⚠️ `draggable` va en la tarjeta entera, pero el arrastre sólo ARRANCA desde la
                  manija (ver `onDragStart`). Hacer draggable sólo a la manija funciona, pero el
                  navegador usa como imagen de arrastre el elemento que la tiene: se vería volando
                  un iconito en vez de la tarjeta.
                */
                draggable={configurando}
                onDragStart={(e) => {
                  if (!configurando) return
                  // Sin `setData` **Firefox y Safari no inician el arrastre**: la API lo exige
                  // aunque no usemos el contenido. Era por esto que no se podía arrastrar nada.
                  e.dataTransfer.setData("text/plain", w.id)
                  e.dataTransfer.effectAllowed = "move"
                  setArrastrando(w.id)
                }}
                onDragEnd={() => { setArrastrando(null); setEncima(null) }}
                onDragOver={(e) => {
                  if (!configurando || !arrastrando) return
                  e.preventDefault() // sin esto el navegador no admite el drop
                  e.dataTransfer.dropEffect = "move"
                  // De qué lado cae: mitad izquierda = antes, mitad derecha = después. Es lo que
                  // permite dejar una tarjeta ENTRE otras dos y no sólo encima de una.
                  const r = e.currentTarget.getBoundingClientRect()
                  const lado = e.clientX < r.left + r.width / 2 ? "antes" : "despues"
                  if (encima?.id !== w.id || encima.lado !== lado) setEncima({ id: w.id, lado })
                }}
                onDragLeave={(e) => {
                  // Sólo si se salió de verdad: pasar sobre un hijo dispara `dragleave` igual, y
                  // sin esta guarda la marca parpadea.
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setEncima(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  soltarEn(w.id, encima?.id === w.id ? encima.lado : "despues")
                }}
              >
                {/* Dónde va a caer. Una línea en el borde dice «acá, en el medio»; un recuadro
                    alrededor decía «encima de éste», que no es lo que pasa. */}
                {encima?.id === w.id && arrastrando !== w.id && (
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 z-20 w-1 rounded bg-primary ${
                      encima.lado === "antes" ? "left-0" : "right-0"
                    }`}
                  />
                )}

                {configurando && (
                  <>
                    {/* Manija: el único punto desde el que arranca el arrastre. Que la tarjeta
                        entera fuera el asa hacía que intentar seleccionar un texto moviera todo. */}
                    <div
                      className="absolute left-1 top-1 z-10 flex cursor-grab items-center gap-0.5 rounded-md border bg-background p-1 shadow-sm active:cursor-grabbing"
                      title="Arrastrame para mover la tarjeta"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-muted-foreground" onClick={() => quitar(w.id)} aria-label={`Quitar ${w.titulo}`}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Borde DERECHO — ancho. Invisible hasta que pasás por encima. */}
                    <div
                      onPointerDown={(e) => empezarRedim(e, w, "ancho")}
                      onPointerMove={moverRedim}
                      onPointerUp={(e) => terminarRedim(e, w)}
                      title={t.ancho === 2 ? "Arrastrá a la izquierda para angostar" : "Arrastrá a la derecha para ensanchar"}
                      className="absolute right-0 inset-y-6 z-10 w-2 cursor-col-resize rounded-full bg-primary/0 transition-colors hover:bg-primary/60 group-hover/w:bg-primary/20"
                    />

                    {/* Borde INFERIOR — alto. */}
                    <div
                      onPointerDown={(e) => empezarRedim(e, w, "alto")}
                      onPointerMove={moverRedim}
                      onPointerUp={(e) => terminarRedim(e, w)}
                      title="Arrastrá para cambiar el alto"
                      className="absolute bottom-0 inset-x-6 z-10 h-2 cursor-row-resize rounded-full bg-primary/0 transition-colors hover:bg-primary/60 group-hover/w:bg-primary/20"
                    />
                  </>
                )}

                {/* Cada widget carga lo suyo: uno lento no tapa a los demás. */}
                {/*
                  Con alto elegido: altura fija y **scroll adentro de la tarjeta**. Es lo que hace
                  que achicar signifique algo — antes el contenido no se podía encoger, así que la
                  tarjeta quedaba de su tamaño y el contenedor crecía vacío debajo.
                  Sin alto elegido: lo que mida el contenido, que es lo que espera el masonry.
                */}
                <div
                  className={alto > 0 ? "min-h-0 flex-1 overflow-y-auto" : "flex-1"}
                  style={alto > 0 ? { height: alto } : undefined}
                >
                  <w.Componente />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
