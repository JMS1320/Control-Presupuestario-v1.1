import { redirect } from "next/navigation"
import ControlPresupuestario from "@/dashboard"
import { createClientServer } from "@/lib/supabase-server"
import { getRole } from "@/lib/auth/roles"
import { seccionesDelRol } from "@/lib/auth/permisos"
import { leerPreferencias } from "@/lib/auth/preferencias"

/**
 * La app vive acá, en la raíz, y el rol sale de la SESIÓN.
 *
 * Antes la raíz mandaba a /no-access y el acceso lo daba la URL (`/adminjms1320`). Desde el login
 * real (2026-09-03) esto se invirtió: el middleware ya garantizó que hay sesión válida cuando se
 * llega hasta acá; lo único que falta es traducirla a rol.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string }>
}) {
  // El menú lateral navega acá con `?seccion=` cuando se lo usa desde otra ruta (/usuarios,
  // /perfil). Se lee en el servidor y se pasa como prop para no necesitar Suspense.
  const { seccion } = await searchParams
  const supabase = await createClientServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const rol = getRole(user)

  // Sin rol asignado no se entra: una cuenta existe pero todavía no fue habilitada.
  // Es el opt-in que pedía MODULO_USUARIOS.md (dar acceso de a poco, no bloquear de a poco).
  if (!rol) redirect("/no-access")

  // Qué ve este usuario sale de `public.roles`, no del código (A-FEAT-82).
  const secciones = await seccionesDelRol(rol)
  const preferencias = leerPreferencias(user)

  // El `?seccion=` manda sobre la preferencia: si alguien navegó a una sección concreta, es a esa
  // sección adonde quiere ir **ahora**; la preferencia es sobre cómo arranca, no sobre a dónde va.
  const inicial = seccion ?? preferencias.seccionInicio ?? undefined

  return (
    <ControlPresupuestario
      userRole={rol}
      seccionInicial={inicial}
      secciones={secciones}
      preferencias={preferencias}
    />
  )
}
