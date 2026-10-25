import { supabaseAdmin } from "@/lib/supabase-admin"
import { minutosEfectivos } from "@/lib/auth/inactividad"

/**
 * ⏱️ El tiempo de inactividad de los roles, leído de `public.roles.minutos_inactividad`
 * (A-FEAT-1351, `scripts/101`).
 *
 * Mismo criterio que `cerrado` en `leerRoles()`: **si el script todavía no se corrió, la columna no
 * existe** y un `select` que la pida falla entero. Por eso se lee aparte, y si falla todos los roles
 * quedan con el default (1 hora). Un script pendiente degrada esta función, no la app.
 */

/** Los minutos del rol, ya resueltos (default si no hay nada o si falta la columna). */
export async function minutosInactividadDe(rol: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("minutos_inactividad")
    .eq("id", rol)
    .maybeSingle()
  if (error || !data) return minutosEfectivos(null)
  return minutosEfectivos((data as { minutos_inactividad?: unknown }).minutos_inactividad)
}

/**
 * Lo guardado en cada rol, sin resolver (null = usa el default). Devuelve `null` entero si falta la
 * columna, para que Configuración → Roles diga que hay que correr el script en vez de mostrar un
 * campo que no guarda nada.
 */
export async function leerMinutosPorRol(): Promise<Record<string, number | null> | null> {
  const { data, error } = await supabaseAdmin.from("roles").select("id, minutos_inactividad")
  if (error || !data) return null
  const out: Record<string, number | null> = {}
  for (const f of data as { id: string; minutos_inactividad: number | null }[]) {
    out[f.id] = typeof f.minutos_inactividad === "number" ? f.minutos_inactividad : null
  }
  return out
}
