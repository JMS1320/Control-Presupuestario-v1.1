import { DesafioTOTP } from "@/components/dos-factores"

export const metadata = { title: "Verificación en dos pasos" }

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm dark:bg-slate-900">
        <h1 className="mb-1 text-xl font-semibold">Verificación en dos pasos</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Escribí el código de tu app de autenticación.
        </p>
        <DesafioTOTP />
      </div>
    </main>
  )
}
