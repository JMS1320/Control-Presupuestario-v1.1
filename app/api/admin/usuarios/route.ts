import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { exigirAdmin } from "@/lib/auth/guard-admin"
import { urlBase } from "@/lib/auth/url-base"
import { leerRoles } from "@/lib/auth/permisos"

/**
 * 🐞 **A-BUG-1198 — los roles salen de la TABLA, no de una lista escrita acá.**
 *
 * Acá vivía `const ROLES = ["admin", "contable"]`. El problema: `public.roles` ya tenía **cuatro**
 * (`admin`, `contable`, `productivo`, `socio`), y los dos últimos **existían en la base pero no se
 * le podían asignar a nadie** — la pantalla de Configuración → Roles los mostraba y los dejaba
 * editar, y el alta los rechazaba con «Rol inválido».
 *
 * 🔑 **Y era invisible desde los dos lados**: quien mira la tabla los ve; quien mira esta lista ve
 * otra cosa. Crear un rol nuevo parecía funcionar hasta el momento de usarlo.
 *
 * 📌 `leerRoles()` es la **misma** función que usa la pantalla de roles, así que las dos no pueden
 * divergir. Trae su propio paracaídas: si la tabla todavía no existe devuelve el reparto anterior,
 * y el alta sigue funcionando como antes en vez de quedarse sin ningún rol válido.
 */
async function rolesAsignables(): Promise<string[]> {
  const { roles } = await leerRoles()
  return roles.map(r => r.id)
}

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
  const rol = String(body.rol ?? "")

  if (!EMAIL_OK.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 })
  }
  const asignables = await rolesAsignables()
  if (!asignables.includes(rol)) {
    // El mensaje dice CUÁLES valen: «Rol inválido» a secas obliga a adivinar, y con los roles
    // saliendo de una tabla la lista cambia sin que nadie toque este archivo.
    return NextResponse.json(
      { error: `Rol inválido. Los que existen hoy son: ${asignables.join(", ")}.` },
      { status: 400 },
    )
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
    redirectTo: `${origen}/auth/confirm?next=/bienvenida`,
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
    // Caso nuevo desde A-FEAT-85: la persona ya entró con Google, así que la cuenta existe y
    // está esperando rol. Crearla de nuevo no es lo que hay que hacer — hay que habilitarla.
    const seAnotoSola = !revocada && existente && !existente.app_metadata?.role

    let mensaje: string
    if (revocada) {
      mensaje =
        "Ya existe esa cuenta y está REVOCADA. Reactivala desde la lista de abajo en vez de crearla de nuevo."
    } else if (seAnotoSola) {
      mensaje =
        "Esa persona ya entró con Google y su cuenta está esperando rol. Asignáselo desde la lista de abajo: no hace falta crearla."
    } else {
      mensaje =
        "Ya existe una cuenta con ese email. Si perdió el link, generale uno nuevo desde la lista."
    }

    return NextResponse.json({ error: mensaje }, { status: 409 })
  }

  /**
   * Dos cosas en la misma llamada, y la segunda es la que habilita la vía de Google.
   *
   * 1. **El rol** va en `app_metadata` (sólo `service_role` lo escribe): el usuario no puede
   *    tocarlo desde su sesión.
   *
   * 2. **`email_confirm`** (A-FEAT-85). `inviteUserByEmail` deja el mail **sin confirmar** hasta
   *    que la persona usa el link, y Supabase **no vincula una identidad de Google a un usuario
   *    con mail sin verificar** — es su defensa contra el *pre-account takeover*. Sin esto, a
   *    quien invitás y entra por Google se le crea una **cuenta nueva sin rol** en vez de entrar
   *    a la suya: mismo mail, dos cuentas, y el rol en la que no usa.
   *
   *    Lo damos por confirmado porque **el admin ya está afirmando que ese mail es de esa
   *    persona** al escribirlo — es el mismo acto de confianza que mandarle la invitación ahí.
   *    Escribir mal el mail tiene la misma consecuencia que antes: el acceso le llega a otro.
   */
  const { error: errRol } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role: rol },
    email_confirm: true,
  })
  if (errRol) {
    return NextResponse.json(
      { error: "Cuenta creada pero sin rol. Asignalo desde la lista." },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: data.user.id, email, rol, enviado: true })
}
