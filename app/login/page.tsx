import { LoginForm } from "@/components/login-form"
import { destinoSeguro } from "@/lib/auth/destino-seguro"

export const metadata = { title: "Ingresar — Control Presupuestario" }

/**
 * Lo que puede fallar en la vuelta de Google (`/auth/callback` redirige con `?error=`).
 *
 * Los textos viven acá y no en el callback por dos razones: una ruta no debería decidir cómo se
 * le habla al usuario, y sobre todo porque un mensaje en la URL sería **texto que elige quien
 * arma el link** — bastaría un `?error=Tu%20sesión%20expiró,%20llamá%20al%20+54...` para poner
 * un cartel falso adentro de nuestra pantalla de login. Acá la URL sólo elige de esta lista.
 */
const ERRORES: Record<string, string> = {
  cancelado: "Cancelaste el ingreso con Google.",
  sin_alta:
    "Esa cuenta de Google todavía no está habilitada. Pedile el alta a un administrador.",
  oauth: "No se pudo completar el ingreso con Google. Probá de nuevo.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volver_a?: string; error?: string }>
}) {
  const { volver_a, error } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm dark:bg-slate-900">
        <div className="mb-6 space-y-1">
          <h1 className="text-xl font-semibold">Control Presupuestario</h1>
          <p className="text-sm text-muted-foreground">Ingresá con tu cuenta.</p>
        </div>
        <LoginForm
          volverA={destinoSeguro(volver_a)}
          errorInicial={(error && ERRORES[error]) ?? null}
        />
      </div>
    </main>
  )
}
