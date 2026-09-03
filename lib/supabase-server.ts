import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { COOKIE_RECORDAR, ajustarPersistencia } from "@/lib/auth/cookies-sesion"

/**
 * Cliente Supabase para el SERVIDOR (Server Components, Route Handlers, Server Actions).
 *
 * ⚠️ Para decidir permisos usar SIEMPRE `supabase.auth.getUser()`, NUNCA `getSession()`:
 * `getSession()` devuelve lo que dice la cookie sin validarla contra el servidor de Auth, así que
 * una cookie armada a mano pasaría el chequeo. `getUser()` valida el JWT.
 *
 * Este cliente usa la `anon key` + la sesión del usuario → queda sujeto a RLS.
 * Para tareas de sistema que deben saltear RLS está `lib/supabase-admin.ts` (service_role).
 */
export async function createClientServer() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            const recordar = cookieStore.get(COOKIE_RECORDAR)?.value === "1"
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, ajustarPersistencia(options, recordar))
            )
          } catch {
            // Un Server Component no puede escribir cookies. No es un error: el middleware ya
            // refrescó la sesión antes de llegar acá.
          }
        },
      },
    }
  )
}
