"use server"

import { createClientServer } from "@/lib/supabase-server"
import { destinoSeguro } from "@/lib/auth/destino-seguro"
import { cookies } from "next/headers"
import { COOKIE_RECORDAR, MAX_AGE_RECORDAR } from "@/lib/auth/cookies-sesion"

export type ResultadoLogin = { error: string | null; volverA?: string }

/**
 * Mensaje ÚNICO para cualquier fallo de credenciales.
 *
 * OWASP — enumeración de usuarios: si el sistema contesta distinto ante "ese mail no existe" y
 * "esa contraseña está mal", un atacante arma la lista de mails válidos antes de empezar a probar
 * contraseñas. Un solo mensaje para los dos casos le saca esa señal.
 */
const CREDENCIALES_INVALIDAS = "Email o contraseña incorrectos."

export async function iniciarSesion(
  _prev: ResultadoLogin,
  formData: FormData
): Promise<ResultadoLogin> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const volverA = destinoSeguro(String(formData.get("volver_a") ?? "/"))
  const recordar = formData.get("recordar") === "on"

  if (!email || !password) return { error: CREDENCIALES_INVALIDAS }

  // ⚠️ La preferencia se escribe ANTES del sign-in, no después: las cookies de sesión las
  // escribe `signInWithPassword`, y para saber si tienen que ser persistentes o de sesión
  // el cliente necesita poder leer esta cookie ya puesta en este mismo request.
  const cookieStore = await cookies()
  if (recordar) {
    cookieStore.set(COOKIE_RECORDAR, "1", {
      maxAge: MAX_AGE_RECORDAR,
      // NO httpOnly a propósito: no es un secreto (es una preferencia de UI) y el cliente del
      // browser tiene que poder leerla para escribir SUS cookies con la misma persistencia.
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    })
  } else {
    cookieStore.delete(COOKIE_RECORDAR)
  }

  const supabase = await createClientServer()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // El rate limit sí se distingue: no revela si la cuenta existe y evita que la persona
    // real siga probando a ciegas contra una puerta que ya está trabada.
    if (error.status === 429) {
      return { error: "Demasiados intentos. Esperá unos minutos antes de reintentar." }
    }
    return { error: CREDENCIALES_INVALIDAS }
  }

  return { error: null, volverA }
}
