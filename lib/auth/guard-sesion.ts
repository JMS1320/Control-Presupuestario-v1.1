import { NextResponse } from "next/server"
import { createClientServer } from "@/lib/supabase-server"
import type { User } from "@supabase/supabase-js"

export type GuardSesion =
  | { ok: true; user: User; rol: string }
  | { ok: false; status: 401 | 403; motivo: string }

/**
 * Portero de TODAS las API routes que usan `service_role` ([A-SEC-06](PENDIENTES.md#a-sec-06)).
 *
 * ⚠️ **No alcanza con el middleware.** `service_role` ignora la RLS: si algún día cambia el
 * `matcher` de `middleware.ts`, o alguien llega a la route por un camino que el middleware no
 * cubre, la route quedaría abierta **con permisos de superusuario de la base**. Por eso cada
 * handler vuelve a chequear acá — defensa en profundidad, igual que `exigirAdmin()` en los
 * endpoints de administración.
 *
 * Exige dos cosas:
 *   1. sesión válida (`getUser()`, que valida el JWT contra Auth — no `getSession()`, que le cree
 *      a la cookie);
 *   2. **un rol** en `app_metadata.role` (que el usuario no puede escribir). Una cuenta sin rol es
 *      una cuenta que el admin todavía no habilitó: la app la manda a `/no-access`, y la API tiene
 *      que decirle lo mismo — es exactamente el agujero de A-SEC-07 pero del lado del servidor.
 *
 * No mira qué secciones tiene el rol: eso lo decide la pantalla que llama. Lo que garantiza es que
 * **nadie sin cuenta habilitada** llegue a tocar la base con `service_role`.
 */
export async function exigirSesion(): Promise<GuardSesion> {
  const supabase = await createClientServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, status: 401, motivo: "Sin sesión." }

  const rol = user.app_metadata?.role
  if (typeof rol !== "string" || !rol) {
    return { ok: false, status: 403, motivo: "La cuenta no tiene un rol habilitado." }
  }

  return { ok: true, user, rol }
}

/** La respuesta JSON que corresponde a un guard que no pasó. Siempre JSON, nunca redirect: es una API. */
export function respuestaSinAcceso(guard: Extract<GuardSesion, { ok: false }>): NextResponse {
  return NextResponse.json({ ok: false, error: guard.motivo }, { status: guard.status })
}
