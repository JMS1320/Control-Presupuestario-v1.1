import { redirect } from "next/navigation"
import { createClientServer } from "@/lib/supabase-server"
import { getRole } from "@/lib/auth/roles"
import { seccionesDelRol } from "@/lib/auth/permisos"
import { leerPreferencias } from "@/lib/auth/preferencias"
import { LayoutApp } from "@/components/layout-app"
import { PanelCuaderno } from "@/components/panel-cuaderno"

export const metadata = { title: "Cuaderno — Control Presupuestario" }

/** 📓 A-FEAT-1410 — el cuaderno de trabajo (piloto). Personal: cada usuario ve los suyos (RLS en la tabla). */
export default async function CuadernoPage() {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()
  const rol = getRole(user)
  if (!rol) redirect("/no-access")
  const secciones = await seccionesDelRol(rol)
  const preferencias = leerPreferencias(user)
  return (
    <LayoutApp userRole={rol} secciones={secciones} preferencias={preferencias}>
      <div>
        <h1 className="titulo-pantalla">📓 Cuaderno</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Anotaciones de trabajo: texto y tablas intercalados, como en un cuaderno. Se guarda solo y se baja a Excel.
        </p>
      </div>
      <PanelCuaderno />
    </LayoutApp>
  )
}
