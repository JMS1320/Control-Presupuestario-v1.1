import { redirect } from "next/navigation"
import ControlPresupuestario from "@/dashboard"
import { createClientServer } from "@/lib/supabase-server"
import { getRole } from "@/lib/auth/roles"
import { seccionesDelRol, nivelesDe, leerRoles } from "@/lib/auth/permisos"
import type { RolEnModo } from "@/components/modo-permisos"
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
  searchParams: Promise<{ seccion?: string; permisos?: string }>
}) {
  // El menú lateral navega acá con `?seccion=` cuando se lo usa desde otra ruta (/usuarios,
  // /perfil). Se lee en el servidor y se pasa como prop para no necesitar Suspense.
  const { seccion, permisos: rolAEditar } = await searchParams
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
  // Las excepciones finas de este rol: qué no ve y qué ve sin poder editar (A-FEAT-169).
  const niveles = await nivelesDe(rol)
  const preferencias = leerPreferencias(user)

  // El `?seccion=` manda sobre la preferencia: si alguien navegó a una sección concreta, es a esa
  // sección adonde quiere ir **ahora**; la preferencia es sobre cómo arranca, no sobre a dónde va.
  const inicial = seccion ?? preferencias.seccionInicio ?? undefined

  // 🖱️ Modo permisos (A-FEAT-1334): `/?permisos=<rol>` abre la app para PRENDER sobre la pantalla lo
  // que ve ese rol. Sólo admin, y nunca sobre un rol de sistema (el endpoint igual lo rechazaría).
  let modoPermisos: RolEnModo | null = null
  if (rol === "admin" && rolAEditar) {
    const { roles } = await leerRoles()
    const r = roles.find((x) => x.id === rolAEditar)
    if (r && !r.es_sistema) {
      modoPermisos = {
        id: r.id,
        descripcion: r.descripcion,
        secciones: r.secciones,
        permisos: (r.permisos ?? {}) as Record<string, string>,
        cerrado: r.cerrado === true,
      }
    }
  }

  return (
    <ControlPresupuestario
      userRole={rol}
      seccionInicial={inicial}
      secciones={secciones}
      nivelesPermisos={niveles}
      preferencias={preferencias}
      modoPermisos={modoPermisos}
    />
  )
}
