import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { exigirAdmin } from "@/lib/auth/guard-admin"
import { leerRoles, SECCIONES_IDS } from "@/lib/auth/permisos"

/** GET — los roles con sus permisos. */
export async function GET() {
  const guard = await exigirAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.motivo }, { status: guard.status })

  const { roles, desdeLaBase } = await leerRoles()
  // `desdeLaBase: false` avisa a la pantalla que está mostrando el paracaídas y que editar no va
  // a servir de nada hasta correr scripts/60. Es preferible a una pantalla que parece editable.
  return NextResponse.json({ roles, desdeLaBase })
}

/**
 * PATCH — cambiar los permisos de un rol.
 *
 * Tres puertas, no una:
 *   1. `exigirAdmin()` — sesión válida, rol admin y **aal2** (pasó por el segundo factor). Cambiar
 *      permisos es la acción más sensible de la app: con sólo una cookie robada no alcanza.
 *   2. Acá abajo se rechaza tocar un rol de sistema y cualquier sección inventada.
 *   3. El trigger de la base (`scripts/60`) vuelve a rechazar el rol de sistema — porque esta ruta
 *      usa `service_role` e ignora la RLS, así que la base tiene que defenderse sola.
 */
export async function PATCH(request: Request) {
  const guard = await exigirAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.motivo }, { status: guard.status })

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === "string" ? body.id : null
  const secciones = Array.isArray(body?.secciones) ? body.secciones : null
  const exige2FA = typeof body?.exige_2fa === "boolean" ? body.exige_2fa : null

  if (!id || !secciones) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 })
  }

  // Sólo secciones que existen: una inventada quedaría guardada para siempre sin que nada la use.
  const validas = new Set<string>(SECCIONES_IDS)
  const desconocidas = secciones.filter((s: unknown) => typeof s !== "string" || !validas.has(s))
  if (desconocidas.length > 0) {
    return NextResponse.json({ error: `Sección desconocida: ${desconocidas.join(", ")}` }, { status: 400 })
  }

  const { data: actual } = await supabaseAdmin
    .from("roles").select("es_sistema").eq("id", id).single()

  if (!actual) return NextResponse.json({ error: "Ese rol no existe." }, { status: 404 })
  if (actual.es_sistema) {
    return NextResponse.json(
      { error: "Es un rol de sistema: sus permisos no se cambian. Si no, se podría dejar el sistema sin nadie que lo administre." },
      { status: 403 }
    )
  }

  const { error } = await supabaseAdmin
    .from("roles")
    .update({
      secciones,
      ...(exige2FA === null ? {} : { exige_2fa: exige2FA }),
      actualizado: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    const falta = /relation .* does not exist|schema cache/i.test(error.message)
    return NextResponse.json(
      { error: falta ? "Falta crear la tabla de roles (scripts/60-roles-permisos.sql)." : "No se pudo guardar." },
      { status: falta ? 503 : 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
