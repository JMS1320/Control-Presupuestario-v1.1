import { NextResponse } from "next/server"
import { createClientServer } from "@/lib/supabase-server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { getRole } from "@/lib/auth/roles"
import { etiquetaPersona } from "@/lib/auth/identidad"

/**
 * GET — a quién se le puede mandar un mensaje desde una marca 🚩 (A-FEAT-1364, la campanita).
 *
 * Sólo nombre y mail de las cuentas habilitadas (con rol y sin revocar): nada de roles, 2FA ni
 * fechas, que es lo que muestra la pantalla de Usuarios a un admin. Lo pide cualquiera que tenga un
 * rol, porque cualquiera puede contestarle o escribirle a otro.
 */
export async function GET() {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Sin sesión." }, { status: 401 })
  if (!getRole(user)) return NextResponse.json({ error: "La cuenta no tiene un rol habilitado." }, { status: 403 })

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 })
  if (error) return NextResponse.json({ error: "No se pudo listar." }, { status: 500 })

  const personas = data.users
    .filter((u) => u.email && getRole(u) && !(u as { banned_until?: string }).banned_until)
    .map((u) => ({ mail: u.email as string, nombre: etiquetaPersona(u) ?? (u.email as string) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))

  return NextResponse.json({ personas, yo: user.email ?? null })
}
