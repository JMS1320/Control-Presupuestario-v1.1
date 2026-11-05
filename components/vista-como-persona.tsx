"use client"

import { Eye } from "lucide-react"

/**
 * 👁️ Envoltura de un panel PERSONAL en «Ver como lo ve él» (A-BUG-1544): lo muestra con los datos de la persona elegida
 * y sin dejar tocar nada (es una vista previa del admin). Sin persona con ese rol, un cartel que lo explica.
 */
export function VistaComoPersona({ titulo, persona, children }: {
  titulo: string
  persona: { mail: string; nombre: string } | null
  children: React.ReactNode
}) {
  if (!persona) {
    return (
      <div className="rounded-md border border-dashed border-violet-300 bg-violet-50/50 p-3 text-sm text-violet-900">
        <Eye className="mr-1 inline h-4 w-4" /> <strong>{titulo}</strong> es de cada persona. Ninguna cuenta tiene este rol
        todavía: cuando se lo asignes a alguien, acá vas a ver lo suyo.
      </div>
    )
  }
  return (
    <div className="relative rounded-md ring-2 ring-violet-300 ring-offset-2">
      <div className="absolute -top-3 right-3 z-10 rounded bg-violet-600 px-2 py-0.5 text-[11px] font-medium text-white">
        👁️ {titulo} de {persona.nombre} · sólo para mirar
      </div>
      <div className="pointer-events-none select-text" aria-readonly>{children}</div>
    </div>
  )
}
