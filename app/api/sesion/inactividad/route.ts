import { NextResponse } from "next/server"
import { createClientServer } from "@/lib/supabase-server"
import { getRole } from "@/lib/auth/roles"
import { minutosInactividadDe } from "@/lib/auth/inactividad-db"
import { sesionDelToken } from "@/lib/auth/inactividad"

/**
 * GET — cuánto puede quedar quieta la sesión de quien pregunta, y a qué sesión pertenece
 * (A-FEAT-1351). Lo pide `components/cierre-inactividad.tsx` al cargar cualquier pantalla.
 *
 * Sólo devuelve datos del propio usuario: su rol sale del JWT (`app_metadata`, que él no puede
 * escribir) y nada del pedido elige otro rol.
 */
export async function GET() {
  const supabase = await createClientServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Sin sesión." }, { status: 401 })

  const rol = getRole(user)
  if (!rol) return NextResponse.json({ error: "La cuenta no tiene un rol habilitado." }, { status: 403 })

  // getSession() sólo para leer el `session_id` del token: el usuario ya lo validó getUser().
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return NextResponse.json({
    minutos: await minutosInactividadDe(rol),
    sesion: sesionDelToken(session?.access_token),
  })
}
