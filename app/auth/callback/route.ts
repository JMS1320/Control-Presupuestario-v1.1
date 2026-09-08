import { NextResponse } from "next/server"
import { createClientServer } from "@/lib/supabase-server"
import { destinoSeguro } from "@/lib/auth/destino-seguro"

/**
 * VUELTA DEL LOGIN CON GOOGLE (A-FEAT-85).
 *
 * Google no nos manda la sesión: nos manda un `code` de un solo uso. Acá se canjea por la sesión
 * real (`exchangeCodeForSession`), que es lo que escribe las cookies. El `code_verifier` del PKCE
 * lo dejó el cliente del browser en una cookie, por eso el canje puede hacerse en el servidor.
 *
 * ⚠️ **El destino se valida con `destinoSeguro()`**, igual que el `volver_a` del login con
 * contraseña: `next` viaja en la URL, así que sin validar sería una redirección abierta con la
 * sesión ya iniciada — el peor momento posible para mandar a alguien a un sitio ajeno.
 *
 * Esta ruta es pública (`RUTAS_PUBLICAS` del middleware incluye `/auth`) y tiene que serlo: se
 * llega sin sesión, que es justamente lo que se viene a resolver.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const destino = destinoSeguro(url.searchParams.get("next"))

  /** Vuelve al login mostrando el motivo. Nunca a una URL externa. */
  const alLogin = (motivo: string) =>
    NextResponse.redirect(new URL(`/login?error=${motivo}`, url.origin))

  // Cancelar en la pantalla de Google y "el proveedor está apagado" llegan por el mismo
  // parámetro, y no se le dice lo mismo a alguien que se arrepintió que a alguien que se topó
  // con algo que todavía no está habilitado. `access_denied` es lo único que significa "no
  // quise"; el resto es un problema de configuración y va al mensaje genérico.
  const falla = url.searchParams.get("error")
  if (falla) return alLogin(falla === "access_denied" ? "cancelado" : "oauth")
  if (!code) return alLogin("oauth")

  const supabase = await createClientServer()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Con el registro cerrado en Supabase, una cuenta de Google que no existe cae acá. No es un
    // fallo: es el sistema diciendo que no. El mensaje tiene que decir qué hacer, no "error 400".
    const sinAlta =
      error.code === "signup_disabled" || /signup|not allowed/i.test(error.message)
    return alLogin(sinAlta ? "sin_alta" : "oauth")
  }

  // El middleware vuelve a mirar todo en el próximo request: si es admin sin 2FA, lo manda a
  // inscribirlo; si la cuenta todavía no tiene rol, `app/page.tsx` la manda a /no-access. Acá no
  // se decide nada de eso — se decide en un solo lugar, y no es éste.
  return NextResponse.redirect(new URL(destino, url.origin))
}
