import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { exigirAdmin } from "@/lib/auth/guard-admin"
import { urlBase } from "@/lib/auth/url-base"

/**
 * POST — reenviar por MAIL el acceso a una cuenta que ya existe.
 *
 * Casos: perdió el link, se le venció, o se olvidó la contraseña.
 *
 * Manda un mail de recuperación y no de invitación, porque `invite` sólo funciona con emails que
 * todavía no existen. Termina en la misma pantalla: la persona pone su contraseña.
 *
 * ⚠️ Sujeto al límite de envío de Supabase (~2/hora sin SMTP propio). Si no llega, la fila tiene
 * «Copiar link» como respaldo.
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

  // Mandarle el acceso a alguien revocado no sirve: entraría y sería rechazado igual.
  if ((u.user as { banned_until?: string }).banned_until) {
    return NextResponse.json(
      { error: "La cuenta está revocada. Reactivala primero." },
      { status: 409 }
    )
  }

  const origen = urlBase(request)
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(u.user.email, {
    redirectTo: `${origen}/login`,
  })

  if (error) {
    const limite = error.status === 429 || /rate|limit/i.test(error.message)
    return NextResponse.json(
      {
        error: limite
          ? "Supabase frenó el envío por límite de mails (~2/hora sin SMTP propio). Usá «Copiar link» o esperá un rato."
          : "No se pudo enviar el mail. Usá «Copiar link».",
      },
      { status: limite ? 429 : 500 }
    )
  }

  return NextResponse.json({ ok: true, email: u.user.email })
}
