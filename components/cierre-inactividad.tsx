"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import {
  COOKIE_ACTIVIDAD,
  SEGUNDOS_AVISO,
  msRestantes,
  valorCookieActividad,
} from "@/lib/auth/inactividad"

/**
 * ⏱️ CIERRE DE SESIÓN POR INACTIVIDAD — la mitad de la pantalla (A-FEAT-1351).
 *
 * Montado una vez en `app/layout.tsx`, así cubre la app, Configuración, Perfil y Usuarios sin que
 * cada página se acuerde. En las pantallas sin sesión (login, 2FA) no hace nada.
 *
 * Qué cuenta como actividad: tocar, hacer clic, escribir, mover el mouse o desplazarse. **Lo que NO
 * cuenta**: que la app consulte datos sola (contadores, recargas). Si no, una pestaña abierta no se
 * cerraría nunca.
 *
 * La marca vive en una cookie que comparten todas las pestañas y que también lee el servidor
 * (`middleware.ts`): por eso al reabrir la app pasado el tiempo se va directo al login.
 */

const RUTAS_SIN_SESION = ["/login", "/auth", "/no-access"]
/** Cada cuánto se reescribe la marca mientras hay actividad (no en cada movimiento del mouse). */
const MS_ENTRE_ESCRITURAS = 15_000
const MS_ENTRE_CONTROLES = 5_000

function leerCookie(): string | undefined {
  try {
    const par = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_ACTIVIDAD}=`))
    return par ? decodeURIComponent(par.slice(COOKIE_ACTIVIDAD.length + 1)) : undefined
  } catch {
    return undefined
  }
}

function escribirCookie(sesion: string, minutos: number) {
  try {
    const seguro = location.protocol === "https:" ? "; Secure" : ""
    const valor = valorCookieActividad({ sesion, ultima: Date.now(), minutos })
    // Dura más que la sesión a propósito: el servidor tiene que poder leerla al día siguiente.
    document.cookie = `${COOKIE_ACTIVIDAD}=${encodeURIComponent(valor)}; Max-Age=${400 * 24 * 60 * 60}; Path=/; SameSite=Lax${seguro}`
  } catch {
    /* sin cookies no hay cierre por inactividad; la app sigue andando */
  }
}

export function CierreInactividad() {
  const pathname = usePathname() ?? "/"
  const sinSesion = RUTAS_SIN_SESION.some((r) => pathname === r || pathname.startsWith(r + "/"))
  const [config, setConfig] = useState<{ minutos: number; sesion: string } | null>(null)
  const [segundosAviso, setSegundosAviso] = useState<number | null>(null)
  const ultimaEscritura = useRef(0)
  const cerrando = useRef(false)
  // El aviso tiene que poder leerse desde el handler sin re-suscribir los eventos.
  const segundosAvisoRef = useRef<number | null>(null)
  segundosAvisoRef.current = segundosAviso

  // 1 · Cuánto tiempo tiene este rol, y de qué sesión es la marca.
  useEffect(() => {
    if (sinSesion) return
    let vivo = true
    fetch("/api/sesion/inactividad")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (vivo && j && typeof j.minutos === "number" && typeof j.sesion === "string") {
          setConfig({ minutos: j.minutos, sesion: j.sesion })
        }
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [sinSesion])

  // 2 · Anotar la actividad y controlar el vencimiento.
  useEffect(() => {
    if (sinSesion || !config) return
    const { minutos, sesion } = config

    const cerrar = () => {
      if (cerrando.current) return
      cerrando.current = true
      fetch("/auth/inactividad", { method: "POST" })
        .catch(() => {})
        .finally(() => {
          window.location.href = "/login?error=inactividad"
        })
    }

    const controlar = () => {
      const restan = msRestantes(leerCookie(), sesion, Date.now())
      if (restan === null) {
        // Sin marca o marca de otra sesión (recién se entró): se arranca a contar desde ahora.
        escribirCookie(sesion, minutos)
        ultimaEscritura.current = Date.now()
        setSegundosAviso(null)
        return
      }
      if (restan <= 0) return cerrar()
      setSegundosAviso(restan <= SEGUNDOS_AVISO * 1000 ? Math.ceil(restan / 1000) : null)
    }

    const huboActividad = () => {
      if (cerrando.current) return
      // Ya vencida no revive: se controla antes de anotar (el celular que se despierta).
      const restan = msRestantes(leerCookie(), sesion, Date.now())
      if (restan !== null && restan <= 0) return cerrar()
      const ahora = Date.now()
      if (ahora - ultimaEscritura.current < MS_ENTRE_ESCRITURAS && segundosAvisoRef.current === null) return
      ultimaEscritura.current = ahora
      escribirCookie(sesion, minutos)
      setSegundosAviso(null)
    }

    const alVolver = () => {
      if (document.visibilityState === "visible") controlar()
    }

    controlar()
    const eventos = ["pointerdown", "keydown", "wheel", "touchstart", "scroll", "mousemove"] as const
    eventos.forEach((e) => window.addEventListener(e, huboActividad, { passive: true, capture: true }))
    document.addEventListener("visibilitychange", alVolver)
    const intervalo = window.setInterval(controlar, MS_ENTRE_CONTROLES)
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, huboActividad, { capture: true }))
      document.removeEventListener("visibilitychange", alVolver)
      window.clearInterval(intervalo)
    }
  }, [sinSesion, config])

  if (sinSesion || segundosAviso === null) return null
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-3"
    >
      <div className="max-w-md rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow-md">
        ⏱️ Por inactividad, la sesión se cierra en <strong>{segundosAviso} s</strong>. Tocá cualquier lado para seguir.
      </div>
    </div>
  )
}
