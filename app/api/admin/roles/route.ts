import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { exigirAdmin } from "@/lib/auth/guard-admin"
import { leerRoles, SECCIONES_IDS } from "@/lib/auth/permisos"
import { RECURSOS } from "@/lib/auth/recursos"

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
  // Los recursos que este rol NO puede ver, dentro de las secciones que sí tiene (A-FEAT-169).
  const ocultos: unknown = body?.ocultos

  if (!id || !secciones) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 })
  }

  // Sólo secciones que existen: una inventada quedaría guardada para siempre sin que nada la use.
  const validas = new Set<string>(SECCIONES_IDS)
  const desconocidas = secciones.filter((s: unknown) => typeof s !== "string" || !validas.has(s))
  if (desconocidas.length > 0) {
    return NextResponse.json({ error: `Sección desconocida: ${desconocidas.join(", ")}` }, { status: 400 })
  }

  /**
   * Las excepciones finas. Mismo criterio que arriba y por el mismo motivo: un recurso inventado
   * se guardaría para siempre sin que nada lo lea — y como el default es "se ve", una excepción
   * mal escrita **no oculta nada y parece que sí**. Es peor que un error: es un permiso falso.
   */
  const permisos: Record<string, string> = {}
  if (ocultos !== undefined) {
    if (!Array.isArray(ocultos)) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 })
    }
    const conocidos = new Set(RECURSOS.map((r) => r.id))
    const malos = ocultos.filter((r: unknown) => typeof r !== "string" || !conocidos.has(r))
    if (malos.length > 0) {
      return NextResponse.json({ error: `Recurso desconocido: ${malos.join(", ")}` }, { status: 400 })
    }
    // Una excepción sobre una sección que el rol no tiene no hace nada, pero ensucia: al volver a
    // dar la sección reaparecería una restricción que nadie recuerda haber puesto.
    const conSeccion = new Set(secciones as string[])
    for (const r of ocultos as string[]) {
      if (conSeccion.has(r.split(".")[0])) permisos[r] = "ninguno"
    }
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
      ...(ocultos === undefined ? {} : { permisos }),
      ...(exige2FA === null ? {} : { exige_2fa: exige2FA }),
      actualizado: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    const falta = /relation .* does not exist|schema cache/i.test(error.message)
    return NextResponse.json(
      {
        error: falta
          ? "Falta crear la tabla de roles (scripts/60-roles-permisos.sql)."
          : /permisos/i.test(error.message)
            ? "Falta la columna de permisos finos: corré scripts/61-permisos-finos.sql."
            : "No se pudo guardar.",
      },
      { status: falta ? 503 : 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
