import { redirect } from "next/navigation"
import { createClientServer } from "@/lib/supabase-server"
import { getRole } from "@/lib/auth/roles"
import { seccionesDelRol } from "@/lib/auth/permisos"
import { LayoutApp } from "@/components/layout-app"
import { PanelPerfil } from "@/components/panel-perfil"

export const metadata = { title: "Tu perfil — Control Presupuestario" }

export default async function PerfilPage() {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()

  // Cualquier usuario con rol ve su propio perfil — no es una pantalla de admin.
  const rol = getRole(user)
  if (!rol) redirect("/no-access")

  const secciones = await seccionesDelRol(rol)

  return (
    <LayoutApp userRole={rol} secciones={secciones}>
      <div>
        <h1 className="titulo-pantalla">Tu perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu nombre, tu foto y el estado de tu segundo factor.
        </p>
      </div>
      <PanelPerfil userRole={rol} />
    </LayoutApp>
  )
}
