"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { MS_ENTRE_VIGIAS, RUTA_PAUSA, RUTA_VIGIA, vigiaDebeDesviar } from "@/lib/auth/pausa"

/**
 * 👁️ VIGÍA DE LA PAUSA — la mitad de la pantalla (A-BUG-1542).
 *
 * Caso que lo originó (05/11): Ulises tenía la app abierta desde antes de la pausa; una pestaña abierta habla directo
 * con la base y el middleware —que es el que frena— no se entera. Montado una vez en `app/layout.tsx`: consulta al
 * volver a la ventana y cada `MS_ENTRE_VIGIAS`; si la respuesta es 503, va al aviso «Estamos actualizando».
 * Un error de red no hace nada: no se saca a nadie por no poder preguntar.
 */
export function VigiaPausa() {
  const pathname = usePathname() ?? "/"
  useEffect(() => {
    let vivo = true
    const mirar = async () => {
      try {
        const r = await fetch(RUTA_VIGIA, { cache: "no-store" })
        if (vivo && vigiaDebeDesviar(r.status, window.location.pathname)) window.location.href = RUTA_PAUSA
      } catch { /* sin red: no se decide nada */ }
    }
    const alVolver = () => { if (document.visibilityState === "visible") void mirar() }
    if (!vigiaDebeDesviar(503, pathname)) return // en login, aviso, etc. no hay nada que vigilar
    void mirar()
    const t = window.setInterval(() => void mirar(), MS_ENTRE_VIGIAS)
    document.addEventListener("visibilitychange", alVolver)
    window.addEventListener("focus", alVolver)
    return () => { vivo = false; window.clearInterval(t); document.removeEventListener("visibilitychange", alVolver); window.removeEventListener("focus", alVolver) }
  }, [pathname])
  return null
}
