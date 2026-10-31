"use client"

/**
 * ↗ La pestaña aparte de un tema del recorrido: lee la foto que dejó el recorrido en este navegador y la muestra con la
 * misma vista (`DetalleTema`). Sólo lectura: los links abren donde vive el dato; para responder, se vuelve al recorrido.
 */
import { useEffect, useState } from "react"
import { DetalleTema } from "@/components/recorrido-tema-detalle"
import type { Tema } from "@/lib/balance/recorrido"

interface Foto { tema: Tema; empresa: string; etiqueta: string; foto: string }

export function TemaAparte() {
  const [foto, setFoto] = useState<Foto | null | undefined>(undefined)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id")
    try {
      const v = id ? localStorage.getItem(`recorrido-tema:${id}`) : null
      setFoto(v ? JSON.parse(v) as Foto : null)
    } catch { setFoto(null) }
  }, [])
  useEffect(() => { if (foto) document.title = `${foto.tema.titulo} — balance ${foto.empresa} ${foto.etiqueta}` }, [foto])

  if (foto === undefined) return <main className="p-6 text-sm text-muted-foreground">Cargando…</main>
  if (!foto) return (
    <main className="p-6 text-sm">
      No encontré el tema en este navegador. Se abre desde el recorrido del balance con «↗ Abrir en otra pestaña» (y en
      el mismo navegador).
    </main>
  )
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 md:p-8 bg-background min-h-screen">
      <p className="text-xs text-muted-foreground">
        🧭 Recorrido del balance — {foto.empresa} {foto.etiqueta} · foto de las {foto.foto} (no se actualiza sola) · para
        responder, volvé a la pestaña del recorrido
      </p>
      <DetalleTema tema={foto.tema} />
    </main>
  )
}
