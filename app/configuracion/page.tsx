import { redirect } from "next/navigation"
import { createClientServer } from "@/lib/supabase-server"
import { esAdmin } from "@/lib/auth/roles"
import { LayoutApp } from "@/components/layout-app"
import { PanelConfiguracion } from "@/components/panel-configuracion"

export const metadata = { title: "Configuración — Control Presupuestario" }

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string }>
}) {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()

  // Doble puerta: el middleware ya cortó, pero la página vuelve a chequear. La API hace lo
  // mismo por su cuenta (lib/auth/guard-admin.ts) — A-SEC-06.
  if (!esAdmin(user)) redirect("/")

  const { panel } = await searchParams

  return (
    <LayoutApp userRole="admin">
      <div>
        <h1 className="titulo-pantalla">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuentas, permisos y datos del sistema.
        </p>
      </div>
      <PanelConfiguracion miId={user!.id} panelInicial={panel} />
    </LayoutApp>
  )
}
