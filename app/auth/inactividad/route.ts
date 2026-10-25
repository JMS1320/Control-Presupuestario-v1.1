import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClientServer } from "@/lib/supabase-server"
import { COOKIE_ACTIVIDAD } from "@/lib/auth/inactividad"

/**
 * Cierre de sesión POR INACTIVIDAD (A-FEAT-1351). Lo llama `components/cierre-inactividad.tsx`.
 *
 * Distinto de `/auth/signout` en dos cosas, a propósito:
 *   · `scope: "local"` — cierra **sólo este aparato**. Si se le vence el celular a alguien, no lo
 *     saca de la PC donde está trabajando (el signout común es global).
 *   · No borra la preferencia de «recordarme»: no fue la persona la que eligió salir.
 * POST y no GET por lo mismo que el signout: un `<img src>` no puede desloguear a nadie.
 */
export async function POST() {
  const supabase = await createClientServer()
  await supabase.auth.signOut({ scope: "local" })
  ;(await cookies()).delete(COOKIE_ACTIVIDAD)
  return NextResponse.json({ ok: true })
}
