import { LoginForm } from "@/components/login-form"
import { destinoSeguro } from "@/lib/auth/destino-seguro"

export const metadata = { title: "Ingresar — Control Presupuestario" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volver_a?: string }>
}) {
  const { volver_a } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm dark:bg-slate-900">
        <div className="mb-6 space-y-1">
          <h1 className="text-xl font-semibold">Control Presupuestario</h1>
          <p className="text-sm text-muted-foreground">Ingresá con tu cuenta.</p>
        </div>
        <LoginForm volverA={destinoSeguro(volver_a)} />
      </div>
    </main>
  )
}
