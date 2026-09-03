import Link from "next/link"
import { redirect } from "next/navigation"
import { createClientServer } from "@/lib/supabase-server"
import { esAdmin } from "@/lib/auth/roles"
import { PanelUsuarios } from "@/components/panel-usuarios"

export const metadata = { title: "Usuarios — Control Presupuestario" }

export default async function UsuariosPage() {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()

  // Doble puerta: el middleware ya cortó, pero la página vuelve a chequear. La API hace lo
  // mismo por su cuenta (lib/auth/guard-admin.ts) — A-SEC-06.
  if (!esAdmin(user)) redirect("/")

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Usuarios</h1>
            <p className="text-sm text-muted-foreground">
              Cuentas del sistema, sus roles y su acceso.
            </p>
          </div>
          <Link href="/" className="text-sm underline underline-offset-4">
            ← Volver al sistema
          </Link>
        </div>
        <PanelUsuarios miId={user!.id} />
      </div>
    </main>
  )
}
