import { redirect } from "next/navigation"
import { createClientServer } from "@/lib/supabase-server"
import { getRole } from "@/lib/auth/roles"
import { PanelBienvenida } from "@/components/panel-bienvenida"

export const metadata = { title: "Bienvenida — Control Presupuestario" }

/**
 * DONDE TERMINA UNA INVITACIÓN (A-FEAT-87).
 *
 * Se llega con sesión ya iniciada —`/auth/confirm` canjeó el link—, así que la persona **ya está
 * adentro**. Lo que falta no es entrar: es dejar armada la forma de volver mañana, que es
 * exactamente el paso que faltaba y por el que alguien invitado entraba una vez y no podía nunca
 * más.
 *
 * Las dos opciones conviven y **ninguna es obligatoria**: se puede definir contraseña, vincular
 * Google, las dos, o ninguna y salir (aunque eso último se avisa).
 */
export default async function BienvenidaPage() {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()

  // Sin sesión no hay nada que configurar: o el link no se canjeó, o venció.
  if (!user) redirect("/login?error=link_vencido")

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-sm dark:bg-slate-900">
        <PanelBienvenida email={user.email ?? ""} tieneRol={Boolean(getRole(user))} />
      </div>
    </main>
  )
}
