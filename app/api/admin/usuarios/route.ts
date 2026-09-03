import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { exigirAdmin } from "@/lib/auth/guard-admin"
import { urlBase } from "@/lib/auth/url-base"

/** Roles que se pueden asignar. Cualquier otra cosa se rechaza. */
const ROLES = ["admin", "contable"] as const
type Rol = (typeof ROLES)[number]

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** GET — listar las cuentas y su rol. */
export async function GET() {
  const guard = await exigirAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.motivo }, { status: guard.status })
  }

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 })
  if (error) {
    return NextResponse.json({ error: "No se pudo listar." }, { status: 500 })
  }

  /**
   * ⚠️ `listUsers` NO devuelve `factors` (la clave directamente no viene en la respuesta).
   * Leerla de ahí daba "sin 2FA" para todo el mundo, incluido un admin que sí lo tenía puesto
   * — una columna de seguridad que miente es peor que no tenerla. Hay que pedirlos por usuario.
   * El N+1 no molesta: son un puñado de cuentas, no miles.
   */
  const factoresPorUsuario = await Promise.all(
    data.users.map(async (u) => {
      const { data: f } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: u.id })
      const lista = (f?.factors ?? []) as { status?: string }[]
      return lista.some((x) => x.status === "verified")
    })
  )

  // Se devuelve lo mínimo: nada de tokens, identidades ni metadata suelta.
  const usuarios = data.users.map((u, i) => ({
    id: u.id,
    email: u.email,
    rol: (u.app_metadata?.role as string) ?? null,
    creado: u.created_at,
    ultimoIngreso: u.last_sign_in_at,
    confirmado: Boolean(u.email_confirmed_at),
    tiene2FA: factoresPorUsuario[i],
    bloqueado: Boolean((u as { banned_until?: string }).banned_until),
  }))

  return NextResponse.json({ usuarios })
}

/**
 * POST — crear una cuenta.
 *
 * NO recibe ni genera contraseña: crea el usuario y devuelve un **link de invitación de un solo
 * uso** para que la persona ponga la suya. Así ningún admin conoce la clave de otro, y no hay una
 * contraseña viajando por la UI, el log ni el chat.
 */
export async function POST(request: Request) {
  const guard = await exigirAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.motivo }, { status: guard.status })
  }

  let body: { email?: string; rol?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 })
  }

  const email = String(body.email ?? "").trim().toLowerCase()
  const rol = String(body.rol ?? "") as Rol

  if (!EMAIL_OK.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 })
  }
  if (!ROLES.includes(rol)) {
    return NextResponse.json({ error: "Rol inválido." }, { status: 400 })
  }

  const origen = urlBase(request)

  /**
   * `inviteUserByEmail` crea la cuenta **y manda el mail**.
   *
   * ⚠️ Depende del envío de Supabase. Con el mailer interno (sin SMTP propio) el límite es de
   * ~2 mails/hora, así que **el mail puede no salir**. Por eso la fila tiene «Copiar link» como
   * respaldo: el alta nunca queda trabada por el correo.
   * Para que salga siempre → habilitar SMTP propio (A-AUTO-02 § Envío de mail).
   */
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origen}/login`,
  })

  if (error) {
    const yaExiste = /already|registered|exists/i.test(error.message)
    if (!yaExiste) {
      return NextResponse.json({ error: "No se pudo crear la cuenta." }, { status: 500 })
    }
    /**
     * "Ya existe" a secas dejaba al admin sin salida: el caso típico es una cuenta **revocada**,
     * que sigue existiendo y por eso bloquea el alta, pero no se ve como culpable. El mensaje
     * tiene que decir en qué estado está y qué hacer, no sólo que falló.
     */
    const { data: lista } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 })
    const existente = lista?.users.find((u) => u.email?.toLowerCase() === email)
    const revocada = Boolean((existente as { banned_until?: string } | undefined)?.banned_until)
    return NextResponse.json(
      {
        error: revocada
          ? "Ya existe esa cuenta y está REVOCADA. Reactivala desde la lista de abajo en vez de crearla de nuevo."
          : "Ya existe una cuenta con ese email. Si perdió el link, generale uno nuevo desde la lista.",
      },
      { status: 409 }
    )
  }

  // El rol va en app_metadata (service_role): el usuario no puede tocarlo desde su sesión.
  const { error: errRol } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role: rol },
  })
  if (errRol) {
    return NextResponse.json(
      { error: "Cuenta creada pero sin rol. Asignalo desde la lista." },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: data.user.id, email, rol, enviado: true })
}
