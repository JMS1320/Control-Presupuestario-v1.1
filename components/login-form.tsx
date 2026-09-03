"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { Eye, EyeOff } from "lucide-react"
import { iniciarSesion, type ResultadoLogin } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function BotonEntrar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </Button>
  )
}

export function LoginForm({ volverA }: { volverA: string }) {
  const router = useRouter()
  const [verPassword, setVerPassword] = useState(false)
  const [estado, accion] = useActionState<ResultadoLogin, FormData>(iniciarSesion, {
    error: null,
  })

  useEffect(() => {
    if (estado.error === null && estado.volverA) {
      // refresh() antes de navegar: el middleware tiene que ver la cookie nueva.
      router.refresh()
      router.replace(estado.volverA)
    }
  }, [estado, router])

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="volver_a" value={volverA} />

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="tu@email.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={verPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-10"
          />
          {/*
            type="button" para que no dispare el submit.
            aria-pressed + aria-label: el estado tiene que ser legible por lector de pantalla,
            porque el ícono solo no dice nada.
          */}
          <button
            type="button"
            onClick={() => setVerPassword((v) => !v)}
            aria-pressed={verPassword}
            aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            title={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox id="recordar" name="recordar" className="mt-0.5" />
        <div className="space-y-1">
          <Label htmlFor="recordar" className="font-normal">
            Recordarme en este navegador
          </Label>
          <p className="text-xs text-muted-foreground">
            Sin esto, se cierra la sesión al cerrar el navegador. No lo tildes en una
            computadora compartida.
          </p>
        </div>
      </div>

      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {estado.error}
        </p>
      )}

      <BotonEntrar />
    </form>
  )
}
