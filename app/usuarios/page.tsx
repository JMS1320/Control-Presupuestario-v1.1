import { redirect } from "next/navigation"
import { createClientServer } from "@/lib/supabase-server"
import { esAdmin } from "@/lib/auth/roles"
import { PanelUsuarios } from "@/components/panel-usuarios"
import { LayoutApp } from "@/components/layout-app"

export const metadata = { title: "Usuarios — Control Presupuestario" }

export default async function UsuariosPage() {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()

  // Doble puerta: el middleware ya cortó, pero la página vuelve a chequear. La API hace lo
  // mismo por su cuenta (lib/auth/guard-admin.ts) — A-SEC-06.
  if (!esAdmin(user)) redirect("/")

  return (
    // Dentro del marco de la app: antes esta pantalla era una isla sin menú ni sesión, de la que
    // sólo se salía con un link «← Volver al sistema». El menú lateral la saca de acá.
    <LayoutApp userRole="admin">
      <div>
        <h1 className="titulo-pantalla">Usuarios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuentas del sistema, sus roles y su acceso.
        </p>
      </div>
      <PanelUsuarios miId={user!.id} />
    </LayoutApp>
  )
}
