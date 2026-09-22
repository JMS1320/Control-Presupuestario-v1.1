import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClientServer } from "@/lib/supabase-server"
import { AltaTOTP } from "@/components/dos-factores"

export const metadata = { title: "Activar segundo factor" }

/**
 * ALTA DEL SEGUNDO FACTOR.
 *
 * Igual que el desafío, comprueba el estado antes de mostrar nada: sin sesión no hay a qué cuenta
 * inscribir, y si ya hay un factor verificado esta pantalla no corresponde — lo que falta en ese
 * caso es el código, no un alta nueva. Ver `app/login/2fa/page.tsx`.
 */
export default async function Page() {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  // `nextLevel === 'aal2'` con `currentLevel` menor = ya tiene factor y le falta el desafío.
  if (aal?.nextLevel === "aal2" && aal?.currentLevel !== "aal2") redirect("/login/2fa")

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm dark:bg-slate-900">
        <h1 className="mb-1 text-xl font-semibold">Activá el segundo factor</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Tu cuenta es de administrador: el segundo factor es obligatorio.
        </p>
        {/* Suspense porque el componente lee `?next=` para saber a dónde volver (A-FEAT-87). */}
        <Suspense fallback={<p className="text-sm text-muted-foreground">Generando el código…</p>}>
          <AltaTOTP />
        </Suspense>
      </div>
    </main>
  )
}
