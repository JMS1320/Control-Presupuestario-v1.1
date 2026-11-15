"use client"

/**
 * 🚩 LAS TAREAS DE ESTA PANTALLA — un aviso en la barra de arriba, en TODAS las pantallas (JMS 15/11: «las tareas está bien que
 * estén en la principal, pero si hay tareas para hacer en caja, está bueno cuando uno abra caja ahí las tenga… y así en las
 * pantallas también aparezca»).
 *
 * Cuenta las marcas 🚩 abiertas cuya pantalla es la sección en la que estás (la marca guarda la solapa de nivel 1 al crearse) y,
 * al tocarlo, abre el MISMO panel de Para revisar filtrado a esa pantalla. Sin tareas, no se muestra.
 * Se consulta al cambiar de pantalla y cada 2 minutos, como la campanita.
 */
import { useCallback, useEffect, useState } from "react"
import { Flag } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { PanelRevisiones } from "@/components/panel-revisiones"
import type { RevisionAbierta } from "@/components/boton-revision"

const MS_ENTRE_CONSULTAS = 120_000

export function TareasDeLaPantalla({ pantalla }: { pantalla?: string }) {
  const [n, setN] = useState(0)
  const [abierto, setAbierto] = useState(false)

  const contar = useCallback(async () => {
    if (!pantalla) { setN(0); return }
    try {
      const j = await (await fetch("/api/revisiones")).json()
      setN(((j?.revisiones ?? []) as RevisionAbierta[]).filter(v => v.pantalla === pantalla).length)
    } catch { setN(0) }   // si falla, el panel de Principal lo dice; acá sólo no se muestra el aviso
  }, [pantalla])

  useEffect(() => {
    contar()
    const t = setInterval(contar, MS_ENTRE_CONSULTAS)
    return () => clearInterval(t)
  }, [contar])

  if (!pantalla || n === 0) return null
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} title={`Tareas abiertas de ${pantalla}`}
        className="flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100">
        <Flag className="h-3.5 w-3.5" /> {n} de esta pantalla
      </button>
      <Sheet open={abierto} onOpenChange={a => { setAbierto(a); if (!a) contar() }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>🚩 Tareas de {pantalla}</SheetTitle>
            <SheetDescription>Las marcas abiertas que se dejaron en esta pantalla. Abrí una para agregar lo que averigües, o cerrala diciendo qué se hizo.</SheetDescription>
          </SheetHeader>
          <div className="mt-4"><PanelRevisiones titulo={`Abiertas en ${pantalla}`} filtro={v => v.pantalla === pantalla} /></div>
        </SheetContent>
      </Sheet>
    </>
  )
}
