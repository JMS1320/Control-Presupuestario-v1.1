import { redirect } from "next/navigation"
import ControlPresupuestario from "@/dashboard"
import { createClientServer } from "@/lib/supabase-server"
import { getRole } from "@/lib/auth/roles"

/**
 * La app vive acá, en la raíz, y el rol sale de la SESIÓN.
 *
 * Antes la raíz mandaba a /no-access y el acceso lo daba la URL (`/adminjms1320`). Desde el login
 * real (2026-09-03) esto se invirtió: el middleware ya garantizó que hay sesión válida cuando se
 * llega hasta acá; lo único que falta es traducirla a rol.
 */
export default async function Page() {
  const supabase = await createClientServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const rol = getRole(user)

  // Sin rol asignado no se entra: una cuenta existe pero todavía no fue habilitada.
  // Es el opt-in que pedía MODULO_USUARIOS.md (dar acceso de a poco, no bloquear de a poco).
  if (!rol) redirect("/no-access")

  return <ControlPresupuestario userRole={rol} />
}
