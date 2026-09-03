import { createClientServer } from "@/lib/supabase-server"
import type { User } from "@supabase/supabase-js"

export type Guard =
  | { ok: true; user: User }
  | { ok: false; status: 401 | 403; motivo: string }

/**
 * Portero de los endpoints de administración.
 *
 * ⚠️ **No alcanza con el middleware.** Estos endpoints usan `service_role`, que ignora la RLS:
 * si algún día cambia el `matcher` del middleware, quedarían abiertos **con permisos de
 * superusuario de la base**. Por eso cada route vuelve a chequear acá — defensa en profundidad
 * ([A-SEC-06](PENDIENTES.md#a-sec-06)).
 *
 * Exige tres cosas, en orden:
 *   1. sesión válida (`getUser()`, que valida el JWT — no `getSession()`, que le cree a la cookie);
 *   2. rol `admin` leído de `app_metadata` (que el usuario no puede escribir);
 *   3. **`aal2`**: la sesión pasó por el segundo factor. Sin esto, robar una cookie de sesión
 *      alcanzaría para crear cuentas nuevas — que es la escalada más grave posible acá.
 */
export async function exigirAdmin(): Promise<Guard> {
  const supabase = await createClientServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, status: 401, motivo: "Sin sesión." }

  if (user.app_metadata?.role !== "admin") {
    return { ok: false, status: 403, motivo: "Requiere rol de administrador." }
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== "aal2") {
    return { ok: false, status: 403, motivo: "Requiere verificación en dos pasos." }
  }

  return { ok: true, user }
}
