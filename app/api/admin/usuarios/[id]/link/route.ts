import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { exigirAdmin } from "@/lib/auth/guard-admin"
import { urlBase } from "@/lib/auth/url-base"

/**
 * POST — generar un link de acceso NUEVO para una cuenta que ya existe.
 *
 * Para qué: el link de invitación es de un solo uso y vence. Si se perdió, o si la cuenta se
 * revocó y se reactivó antes de que la persona lo usara, no había forma de darle otro — y crearla
 * de nuevo tampoco, porque el email ya estaba tomado.
 *
 * Se usa `recovery` y no `invite`: `invite` sólo funciona con emails que no existen. `recovery`
 * sirve para cualquier cuenta existente y termina en la misma pantalla — la persona pone su
 * contraseña. Vale igual para "se olvidó la clave".
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await exigirAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.motivo }, { status: guard.status })
  }

  const { id } = await params

  const { data: u, error: errU } = await supabaseAdmin.auth.admin.getUserById(id)
  if (errU || !u?.user?.email) {
    return NextResponse.json({ error: "No se encontró la cuenta." }, { status: 404 })
  }

  // Un link para alguien con el acceso revocado no serviría de nada: entraría y sería rechazado.
  if ((u.user as { banned_until?: string }).banned_until) {
    return NextResponse.json(
      { error: "La cuenta está revocada. Reactivala primero." },
      { status: 409 }
    )
  }

  const origen = urlBase(request)
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: u.user.email,
    options: { redirectTo: `${origen}/login` },
  })

  if (error) {
    return NextResponse.json({ error: "No se pudo generar el link." }, { status: 500 })
  }

  return NextResponse.json({ email: u.user.email, link: data.properties.action_link })
}
