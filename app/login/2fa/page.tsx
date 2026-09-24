import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClientServer } from "@/lib/supabase-server"
import { esAdmin } from "@/lib/auth/roles"
import { DesafioTOTP } from "@/components/dos-factores"

export const metadata = { title: "Verificación en dos pasos" }

/**
 * DESAFÍO DEL SEGUNDO FACTOR.
 *
 * ⚠️ **La página comprueba que haya algo que desafiar antes de pedirlo** (A-FEAT-86). Antes era
 * estática, y eso la volvía un callejón sin salida: si el factor dejaba de existir mientras
 * alguien estaba parado acá —porque otro admin se lo reseteó, o porque hubo que borrarlo a mano—
 * la pantalla seguía pidiendo un código que ya no podía generar **nadie**, sin ningún camino de
 * vuelta. Le pasó al usuario el 2026-09-17 y quedó trabado mirando un input muerto.
 *
 * El middleware no lo resolvía porque **no redirige dentro de `/login`** (si lo hiciera, se pelearía
 * con sus propias pantallas). Así que el chequeo tiene que estar acá.
 */
export default async function Page() {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  // Ya lo pasó: no hay nada que pedirle.
  if (aal?.currentLevel === "aal2") redirect("/")

  // No hay factor inscripto → no hay código posible. A un admin lo mandamos a inscribir uno
  // (es obligatorio); a cualquier otro, adentro.
  if (aal?.nextLevel !== "aal2") {
    redirect(esAdmin(user) ? "/login/2fa/alta" : "/")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm dark:bg-slate-900">
        <h1 className="mb-1 text-xl font-semibold">Verificación en dos pasos</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Escribí el código de tu app de autenticación.
        </p>
        {/* Suspense: el componente lee `?next=` para volver a donde iba (A-FEAT-87). */}
        <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
          <DesafioTOTP />
        </Suspense>

        {/*
          La salida para quien SÍ tiene factor pero perdió el autenticador. No borra nada —eso
          sería convertir 2 factores en 1 (§ MODULO_USUARIOS)—: sólo cierra la sesión para poder
          entrar con otra cuenta, y dice cuál es el camino real.
        */}
        <div className="mt-6 space-y-2 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            ¿No tenés el autenticador? Pedile a otro administrador que te lo resetee desde
            Configuración → Usuarios. Por seguridad no se puede dar de baja desde acá.
          </p>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Salir y entrar con otra cuenta
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
