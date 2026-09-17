"use client"

import { useState } from "react"
import { toast } from "sonner"
import { LayoutGrid, GripVertical, X, Plus, RotateCcw } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Ayuda } from "@/components/ayuda"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { WIDGETS, WIDGETS_POR_DEFECTO, widgetsVisibles } from "@/lib/widgets/registro"
import type { Preferencias } from "@/lib/auth/preferencias"

/**
 * PANTALLA DE INICIO CONFIGURABLE (A-FEAT-88).
 *
 * ⚠️ **`secciones` es el permiso, y por eso viene por prop desde el servidor.** La lista de
 * widgets elegidos vive en `user_metadata`, que el propio usuario puede escribir con un
 * `updateUser`; si el filtro se hiciera con algo que también sale de ahí, cualquiera se agregaría
 * un widget de una sección que su rol no habilita. `widgetsVisibles()` cruza las dos cosas: la
 * preferencia dice **qué y en qué orden**, el rol dice **qué está permitido**.
 *
 * Es la misma puerta de `seccionInicio` (A-FEAT-83) y del `?seccion=` de la URL (A-FEAT-82).
 */
export function VistaInicio({
  preferencias,
  secciones,
}: {
  preferencias: Preferencias
  /** Las secciones que habilita el ROL, leídas en el servidor. La única fuente de verdad. */
  secciones: string[]
}) {
  const [elegidos, setElegidos] = useState<string[]>(
    preferencias.widgets ?? WIDGETS_POR_DEFECTO
  )
  const [configurando, setConfigurando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  /** Qué widget se está arrastrando, y sobre cuál está parado. */
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  /** De qué lado del widget de destino está el cursor: ahí es donde va a caer. */
  const [encima, setEncima] = useState<{ id: string; lado: "antes" | "despues" } | null>(null)
  const [tamanos, setTamanos] = useState(preferencias.widgetsTamano)

  const visibles = widgetsVisibles(elegidos, secciones)
  // Lo que se puede agregar: del registro, lo que el rol permite y todavía no está puesto.
  const disponibles = WIDGETS.filter(
    (w) => secciones.includes(w.seccion) && !elegidos.includes(w.id)
  )

  async function guardar(nuevos: string[]) {
    const anterior = elegidos
    setElegidos(nuevos) // optimista: mover una tarjeta tiene que verse al instante
    setGuardando(true)
    // Se manda el objeto entero: `updateUser` REEMPLAZA la clave, no la mergea.
    const { error } = await supabase.auth.updateUser({
      data: { preferencias: { ...preferencias, widgets: nuevos, widgetsTamano: tamanos } },
    })
    setGuardando(false)
    if (error) {
      setElegidos(anterior)
      toast.error("No se pudo guardar. Probá de nuevo.")
    }
  }

  /** El tamaño de un widget: lo que eligió el usuario, y si no, lo que declara el registro. */
  const tamanoDe = (w: { id: string; ancho: "medio" | "completo" }) =>
    tamanos[w.id] ?? { ancho: w.ancho === "completo" ? 2 : 1, alto: 1 }

  async function cambiarTamano(id: string, campo: "ancho" | "alto", actual: 1 | 2) {
    const nuevo = { ...tamanoDe({ id, ancho: "medio" }), ...tamanos[id] }
    nuevo[campo] = actual === 2 ? 1 : 2
    const nuevos = { ...tamanos, [id]: nuevo }
    const anterior = tamanos
    setTamanos(nuevos)
    const { error } = await supabase.auth.updateUser({
      data: { preferencias: { ...preferencias, widgets: elegidos, widgetsTamano: nuevos } },
    })
    if (error) {
      setTamanos(anterior)
      toast.error("No se pudo guardar el tamaño.")
    }
  }

  const quitar = (id: string) => guardar(elegidos.filter((w) => w !== id))
  const agregar = (id: string) => guardar([...elegidos, id])

  /**
   * Suelta `arrastrando` en la posición de `destino`.
   *
   * Termina en el mismo `guardar()` que los botones ↑ ↓: el arrastre es otra forma de pedir lo
   * mismo, no otro camino. Si tuviera su propia escritura, una de las dos se desincronizaría el
   * día que cambie el formato de la preferencia.
   */
  function soltarEn(destino: string, lado: "antes" | "despues") {
    const origen = arrastrando
    setArrastrando(null)
    setEncima(null)
    if (!origen || origen === destino) return

    // ⚠️ El índice se calcula sobre la lista YA SIN el que se arrastra. Calcularlo sobre la
    // original daba un corrimiento de uno al mover hacia adelante —la tarjeta caía del otro lado
    // del destino— y por eso no se podía dejar algo *entre* dos widgets: el resultado dependía de
    // la dirección del arrastre en vez de dónde soltaste.
    const sinOrigen = elegidos.filter((w) => w !== origen)
    const i = sinOrigen.indexOf(destino)
    if (i < 0) return
    sinOrigen.splice(lado === "antes" ? i : i + 1, 0, origen)
    guardar(sinOrigen)
  }

  function mover(id: string, delta: number) {
    const i = elegidos.indexOf(id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= elegidos.length) return
    const nuevos = [...elegidos]
    ;[nuevos[i], nuevos[j]] = [nuevos[j], nuevos[i]]
    guardar(nuevos)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="titulo-pantalla">Principal</h1>
        <Button
          variant={configurando ? "default" : "secondary"}
          size="sm"
          className="gap-2"
          onClick={() => setConfigurando((c) => !c)}
          disabled={guardando}
        >
          <LayoutGrid className="h-4 w-4" />
          {configurando ? "Listo" : "Configurar mi inicio"}
        </Button>
      </div>

      {configurando && (
        <Card className="border-dashed">
          <CardContent className="space-y-4 p-4">
            <Ayuda className="text-sm">
              Elegí qué querés ver al entrar y en qué orden: <strong>arrastrá las tarjetas</strong>
              para acomodarlas, o usá las flechas. Se guarda solo, y es tuyo: no le cambia la
              pantalla a nadie más.
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

            {elegidos.length !== WIDGETS_POR_DEFECTO.length && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => guardar(WIDGETS_POR_DEFECTO)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Volver a la pantalla original
              </Button>
            )}
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
          Grilla de 2 columnas desde `sm`. Los widgets `completo` toman la fila entera: son avisos
          con texto, y a media columna no se leen.
          `items-start` para que una tarjeta alta no estire a su vecina — sin eso, el widget más
          largo de cada fila le impone su alto a los demás y la pantalla se ve desprolija.
        */
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          {visibles.map((w) => {
            const t = tamanoDe(w)
            return (
              <div
                key={w.id}
                className={[
                  "relative",
                  t.ancho === 2 ? "sm:col-span-2" : "",
                  // El alto se hace con min-height y no con `row-span`: con filas automáticas, un
                  // row-span empuja a los vecinos de forma impredecible según lo que haya al lado.
                  t.alto === 2 ? "min-h-[20rem]" : "",
                  configurando ? "cursor-move" : "",
                  arrastrando === w.id ? "opacity-40" : "",
                ].join(" ")}
                draggable={configurando}
                onDragStart={() => setArrastrando(w.id)}
                onDragEnd={() => { setArrastrando(null); setEncima(null) }}
                onDragOver={(e) => {
                  if (!configurando || !arrastrando) return
                  e.preventDefault() // sin esto el navegador no admite el drop
                  // De qué lado cae: mitad izquierda = antes, mitad derecha = después. Es lo que
                  // permite dejar una tarjeta ENTRE otras dos en vez de sólo encima de una.
                  const r = e.currentTarget.getBoundingClientRect()
                  const lado = e.clientX < r.left + r.width / 2 ? "antes" : "despues"
                  setEncima({ id: w.id, lado })
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
                {/* La marca de dónde va a caer. Una línea en el borde dice «acá en el medio»;
                    un recuadro alrededor decía «encima de éste», que no es lo que pasa. */}
                {encima?.id === w.id && arrastrando !== w.id && (
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 z-20 w-1 rounded bg-primary ${
                      encima.lado === "antes" ? "-left-2" : "-right-2"
                    }`}
                  />
                )}

                {configurando && (
                  <div className="absolute -top-2 right-2 z-10 flex items-center gap-0.5 rounded-md border bg-background p-1 shadow-sm">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <Button
                      variant="ghost" size="sm" className="h-7 px-1.5"
                      onClick={() => cambiarTamano(w.id, "ancho", t.ancho)}
                      title={t.ancho === 2 ? "Angostar" : "Ensanchar"}
                      aria-label={`${t.ancho === 2 ? "Angostar" : "Ensanchar"} ${w.titulo}`}
                    >
                      {t.ancho === 2 ? "▭" : "▬"}
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 px-1.5"
                      onClick={() => cambiarTamano(w.id, "alto", t.alto)}
                      title={t.alto === 2 ? "Achicar el alto" : "Agrandar el alto"}
                      aria-label={`${t.alto === 2 ? "Achicar" : "Agrandar"} el alto de ${w.titulo}`}
                    >
                      {t.alto === 2 ? "↕" : "⇕"}
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 px-2"
                      onClick={() => mover(w.id, -1)}
                      aria-label={`Subir ${w.titulo}`}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 px-2"
                      onClick={() => mover(w.id, 1)}
                      aria-label={`Bajar ${w.titulo}`}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground"
                      onClick={() => quitar(w.id)}
                      aria-label={`Quitar ${w.titulo}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Cada widget carga lo suyo: uno lento no tapa a los demás. */}
                <w.Componente />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
