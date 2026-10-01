"use client"

import { Eye } from "lucide-react"
import { useNivel } from "@/components/contexto-permisos"

/**
 * ENVOLTORIO DE SÓLO-LECTURA — A-FEAT-169, etapa 3
 *
 * Envuelve el contenido de una pestaña. Si el rol la tiene en `"lectura"`, apaga **todos** los
 * controles de formulario de adentro y pone un cartel arriba.
 *
 * ⚠️ **Por qué un `<fieldset disabled>` y no ir botón por botón.**
 * Las vistas de este proyecto tienen miles de líneas y cientos de botones; ir uno por uno es
 * whack-a-mole, y el que se olvida **no avisa**: queda un botón que guarda cuando no debería, y se
 * descubre el día que alguien lo aprieta. `fieldset[disabled]` es del navegador y alcanza a todo
 * `<input>`, `<button>`, `<select>` y `<textarea>` que haya adentro, incluidos los que se agreguen
 * mañana sin que nadie se acuerde de esta feature. Se elige el mecanismo que falla cerrado.
 *
 * ⚠️ **Lo que NO cubre, y hay que saberlo**: un `<div onClick>` no es un control de formulario, así
 * que el navegador no lo apaga. Los componentes de Radix que usamos renderizan `<button>` de
 * verdad, así que la mayoría queda cubierta — pero no es una garantía.
 *
 * ⚠️ **Y esto sigue sin ser seguridad.** Apagar controles en el navegador no impide escribir con la
 * consola: la sesión es la misma. Las barreras reales son la validación en la API (etapa 4) y la
 * RLS por recurso (etapa 5). Esto evita el error honesto, no al que quiere saltarlo.
 */
export function SoloLectura({
  recurso,
  children,
}: {
  recurso: string
  children: React.ReactNode
}) {
  const nivel = useNivel()

  if (nivel(recurso) !== "lectura") return <>{children}</>

  return (
    <div>
      <div
        role="status"
        className="mb-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
      >
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span>
          <strong>Sólo lectura.</strong> Podés mirar y usar los filtros, pero no guardar cambios acá.
        </span>
      </div>
      {/* `min-w-0` y sin borde: el fieldset no tiene que cambiar el layout, sólo apagar. */}
      <fieldset disabled className="min-w-0 border-0 p-0 opacity-75">
        {children}
      </fieldset>
    </div>
  )
}
