import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { exigirAdmin } from "@/lib/auth/guard-admin"

/**
 * DELETE — resetear el segundo factor de OTRA persona (A-FEAT-86).
 *
 * El caso: alguien perdió el teléfono, o nunca guardó la llave. Sin esto la única salida es tocar
 * la base con `service_role` — que es exactamente lo que pasó el 2026-09-07 y lo que este endpoint
 * viene a evitar.
 *
 * ## Por qué esto NO debilita el 2FA
 *
 * La pregunta correcta ante cualquier "reseteo de segundo factor" es **quién está autenticado en
 * el momento de apretar el botón**:
 *
 * - Si lo aprieta **la persona trabada en la pantalla del código** (`aal1`), el 2FA deja de
 *   existir: quien tenga la contraseña usa el botón en vez de pelear con el TOTP, y el camino del
 *   atacante queda **más corto** que el del usuario legítimo. Por eso ese botón **no existe**.
 * - Acá lo aprieta **otro admin con `aal2`** (`exigirAdmin()` lo exige). La autorización la aporta
 *   una segunda persona que sí demostró sus dos factores. Siguen siendo dos factores; lo que
 *   cambia es de quién.
 *
 * ⚠️ **No sirve para uno mismo, a propósito.** Para tu propia cuenta está `/perfil` → «Cambiar de
 * dispositivo», que exige tu sesión `aal2`. Si se permitiera acá, un admin trabado en el desafío
 * no llegaría igual (el middleware no lo deja pasar), pero el candado se escribe explícito para
 * que nadie lo relaje después sin ver el motivo.
 *
 * ⚠️ **Y no cubre al admin solo.** Si queda un único admin y pierde el autenticador, no hay otro
 * que lo resetee. Ese hueco lo cierran los códigos de recuperación → A-SEC-08.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await exigirAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.motivo }, { status: guard.status })
  }

  const { id } = await params

  if (id === guard.user.id) {
    return NextResponse.json(
      {
        error:
          "Para tu propia cuenta usá Perfil → Segundo factor → Cambiar de dispositivo.",
      },
      { status: 400 }
    )
  }

  const { data: u, error: errU } = await supabaseAdmin.auth.admin.getUserById(id)
  if (errU || !u?.user) {
    return NextResponse.json({ error: "No se encontró la cuenta." }, { status: 404 })
  }

  const { data: f, error: errF } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: id })
  if (errF) {
    return NextResponse.json({ error: "No se pudieron leer sus factores." }, { status: 500 })
  }

  const factores = (f?.factors ?? []) as { id: string }[]
  if (factores.length === 0) {
    // No es un error: es el estado al que se quería llegar. Decirlo evita que el admin lo
    // intente tres veces creyendo que no anduvo.
    return NextResponse.json({ ok: true, borrados: 0, yaEstaba: true })
  }

  // Se borran TODOS: si quedara uno, la persona seguiría trabada y el reseteo no habría servido.
  for (const factor of factores) {
    const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: id,
    })
    if (error) {
      return NextResponse.json(
        { error: "No se pudo dar de baja el segundo factor." },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ ok: true, borrados: factores.length, email: u.user.email })
}
