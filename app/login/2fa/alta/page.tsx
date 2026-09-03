import { AltaTOTP } from "@/components/dos-factores"

export const metadata = { title: "Activar segundo factor" }

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm dark:bg-slate-900">
        <h1 className="mb-1 text-xl font-semibold">Activá el segundo factor</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Tu cuenta es de administrador: el segundo factor es obligatorio.
        </p>
        <AltaTOTP />
      </div>
    </main>
  )
}
