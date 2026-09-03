import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClientServer } from "@/lib/supabase-server"
import { COOKIE_RECORDAR } from "@/lib/auth/cookies-sesion"

/**
 * Cierre de sesión. POST y no GET a propósito: con GET, un `<img src="/auth/signout">` en
 * cualquier página desloguearía al usuario (CSRF de logout).
 */
export async function POST(request: Request) {
  const supabase = await createClientServer()
  await supabase.auth.signOut()
  // Al salir a propósito se olvida también la preferencia: el próximo login vuelve a preguntar.
  ;(await cookies()).delete(COOKIE_RECORDAR)
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 })
}
