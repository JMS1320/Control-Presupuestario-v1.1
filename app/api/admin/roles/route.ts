import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { exigirAdmin } from "@/lib/auth/guard-admin"
import { leerRoles, SECCIONES_IDS } from "@/lib/auth/permisos"
import { RECURSOS } from "@/lib/auth/recursos"

/** GET — los roles con sus permisos. */
export async function GET() {
  const guard = await exigirAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.motivo }, { status: guard.status })

  const { roles, desdeLaBase, falta } = await leerRoles()

  /**
   * Qué recursos tienen tablas mapeadas en `public.recurso_tablas` — o sea, para cuáles la BASE
   * aplica el permiso y no sólo la pantalla (A-SEC-10).
   *
   * La pantalla lo necesita para no mentir: decir «sólo ver» donde la base no lo aplica es
   * prometer una contención que no existe, y decir lo contrario donde sí la aplica asusta de más.
   * Es el mismo dato por el otro camino: lo único que sabe la verdad es el mapeo.
   */
  const { data: mapeo } = await supabaseAdmin.from("recurso_tablas").select("recurso")
  const recursosAplicados = [...new Set((mapeo ?? []).map((m) => m.recurso as string))]
  // `desdeLaBase: false` avisa a la pantalla que está mostrando el paracaídas y que editar no va
  // a servir de nada hasta correr scripts/60. Es preferible a una pantalla que parece editable.
  return NextResponse.json({ roles, desdeLaBase, falta, recursosAplicados })
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
  // Las excepciones finas: `{ "productivo.insumos": "lectura" }` (A-FEAT-169).
  const permisosPedidos: unknown = body?.permisos

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
  const NIVELES = new Set(["ninguno", "lectura", "escritura"])
  const permisos: Record<string, string> = {}
  if (permisosPedidos !== undefined) {
    if (typeof permisosPedidos !== "object" || permisosPedidos === null || Array.isArray(permisosPedidos)) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 })
    }
    const conocidos = new Set(RECURSOS.map((r) => r.id))
    const conSeccion = new Set(secciones as string[])

    for (const [recurso, nivel] of Object.entries(permisosPedidos as Record<string, unknown>)) {
      if (!conocidos.has(recurso)) {
        return NextResponse.json({ error: `Recurso desconocido: ${recurso}` }, { status: 400 })
      }
      if (typeof nivel !== "string" || !NIVELES.has(nivel)) {
        return NextResponse.json({ error: `Nivel desconocido en ${recurso}: ${String(nivel)}` }, { status: 400 })
      }
      // `escritura` es el default heredado: guardarlo sería ruido que hay que mantener al día.
      if (nivel === "escritura") continue
      // Una excepción sobre una sección que el rol no tiene no hace nada, pero ensucia: al volver
      // a dar la sección reaparecería una restricción que nadie recuerda haber puesto.
      if (conSeccion.has(recurso.split(".")[0])) permisos[recurso] = nivel
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
      ...(permisosPedidos === undefined ? {} : { permisos }),
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
