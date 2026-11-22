"use client"

/**
 * ✋ PEDIR CANDADO — A-FEAT-1634 (JMS 22/11: «que yo pueda marcar los botones que no tienen opción de candado para
 * indicarte que me interesa que los tengan»).
 *
 * En la barra del modo permisos: se aprieta «✋ Pedir candado» y el PRÓXIMO clic en la pantalla no hace lo que haría
 * (no abre, no guarda): marca ese botón o esa parte, y deja una tarea 🚩 para Claude con qué es, en qué pantalla y para
 * qué rol. Es el cuarto canal de siempre (`revisiones` con `asignado_a = 'claude'`): se ve al abrir sesión.
 * Esc cancela. No escribe ningún dato del negocio; sólo la tarea.
 */
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { contextoActual, textoLimpio } from "@/lib/contexto-pantalla"
import { quienMarca } from "@/components/boton-revision"

/** Qué se marcó, en palabras: el texto del botón (o su ayuda), y la tarjeta o el título donde está. */
export function describirElemento(el: Element): { que: string; donde: string } {
  const objetivo = el.closest("button, a, [role=tab], [role=button], label, th, summary, h1, h2, h3, [data-permisable]") ?? el
  const que = (objetivo.getAttribute("aria-label") || objetivo.getAttribute("title") || textoLimpio(objetivo) || objetivo.tagName.toLowerCase())
    .replace(/\s+/g, " ").trim().slice(0, 120)
  // La tarjeta o el bloque que lo contiene: su primer título.
  let donde = ""
  for (let p: Element | null = objetivo.parentElement; p && !donde; p = p.parentElement) {
    const t = p.querySelector(":scope > * h1, :scope > * h2, :scope > * h3, :scope > h1, :scope > h2, :scope > h3, :scope p.font-semibold")
    if (t && !t.contains(objetivo)) donde = textoLimpio(t).replace(/\s+/g, " ").trim().slice(0, 80)
  }
  return { que, donde }
}

export function BotonPedirCandado({ rolId }: { rolId: string }) {
  const [pidiendo, setPidiendo] = useState(false)

  useEffect(() => {
    if (!pidiendo) return
    document.body.style.cursor = "crosshair"
    const alClic = async (e: MouseEvent) => {
      const el = e.target as Element | null
      if (!el || el.closest("[data-pedir-candado-barra]")) return // la barra del modo sigue andando
      e.preventDefault()
      e.stopPropagation()
      setPidiendo(false)
      const { que, donde } = describirElemento(el)
      const ctx = contextoActual()
      const pantalla = [ctx.pantalla, ctx.subpantalla].filter(Boolean).join(" → ") || "la pantalla actual"
      const lugar = donde ? `${pantalla} → ${donde}` : pantalla
      const { error } = await supabase.from("revisiones").insert({
        id: crypto.randomUUID(),
        descripcion_ref: `✋ Pedir candado: «${que}» en ${lugar}`.slice(0, 300),
        motivo: `✋ JMS quiere poder dar o sacar «${que}» (en ${lugar}) desde «Editar sobre la pantalla» — se marcó editando el rol «${rolId}». Ponerle su candado.`,
        pantalla: ctx.pantalla,
        subpantalla: ctx.subpantalla,
        ruta: ctx.ruta,
        creado_por: await quienMarca(),
        asignado_a: "claude",
        es_tarea: true,
        origen: "pedir-candado",
      })
      if (error) toast.error("No se pudo anotar el pedido: " + error.message)
      else toast.success(`Anotado para Claude: candado para «${que}» (${lugar}).`)
    }
    const alTecla = (e: KeyboardEvent) => { if (e.key === "Escape") setPidiendo(false) }
    // En captura: el clic se ataja ANTES de que el botón marcado haga lo suyo.
    document.addEventListener("click", alClic, true)
    document.addEventListener("keydown", alTecla)
    return () => {
      document.body.style.cursor = ""
      document.removeEventListener("click", alClic, true)
      document.removeEventListener("keydown", alTecla)
    }
  }, [pidiendo, rolId])

  return (
    <Button size="sm" variant={pidiendo ? "default" : "outline"} onClick={() => setPidiendo(p => !p)}
      title="Apretá y después hacé clic sobre un botón o una parte de la pantalla que no tenga candado: me queda una tarea para ponérselo. Esc cancela.">
      {pidiendo ? "✋ Hacé clic en lo que querés… (Esc cancela)" : "✋ Pedir candado"}
    </Button>
  )
}
