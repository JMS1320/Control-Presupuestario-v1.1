import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { exigirAdmin } from "@/lib/auth/guard-admin"
import { urlBase, destinoDescartado } from "@/lib/auth/url-base"

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
  const destino = `${origen}/auth/confirm?next=/bienvenida`

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: u.user.email,
    options: { redirectTo: destino },
  })

  if (error) {
    return NextResponse.json({ error: "No se pudo generar el link." }, { status: 500 })
  }

  /**
   * CONTROL (A-BUG-98): ¿el link apunta a donde lo pedimos?
   *
   * Supabase descarta en silencio el `redirectTo` que no esté en sus **Redirect URLs** y lo
   * cambia por el **Site URL** del proyecto. No devuelve error: devuelve un link perfecto que
   * lleva a otro lado. Como el destino aceptado viaja dentro del link, compararlo es gratis
   * — y es la diferencia entre enterarse acá o que la persona invitada termine en una pantalla
   * que no es la nuestra.
   */
  const descartado = destinoDescartado(data.properties.action_link, destino)

  return NextResponse.json({
    email: u.user.email,
    link: data.properties.action_link,
    // La UI lo muestra como alerta. Se manda el link igual: el admin decide, pero avisado.
    advertencia: descartado
      ? `Supabase no aceptó el destino ${destino} y lo reemplazó por ${descartado}. ` +
        "El link NO va a funcionar: hay que agregar esta dirección en Supabase → Authentication " +
        "→ URL Configuration → Redirect URLs."
      : null,
  })
}
