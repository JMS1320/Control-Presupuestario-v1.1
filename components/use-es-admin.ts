"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

/**
 * ¿El que mira es ADMIN? — para lo que es SÓLO del dueño y no se delega a nadie (JMS 2026-10-27: «lo que es solo
 * admin, que no se pueda habilitar para nadie salvo admin»): confirmar una orden (descuenta stock), aprobar cambios
 * del plan sanitario. Eso NO tiene casilla en Roles a propósito.
 *
 * El rol vive en `app_metadata.role` del JWT (el usuario no lo puede escribir). Arranca en `false`: mientras se lee,
 * nadie ve un botón de admin que no le corresponde.
 */
export function useEsAdmin(): boolean {
  const [es, setEs] = useState(false)
  useEffect(() => {
    let vivo = true
    supabase.auth.getUser().then(({ data }) => { if (vivo) setEs(data.user?.app_metadata?.role === "admin") })
    return () => { vivo = false }
  }, [])
  return es
}
