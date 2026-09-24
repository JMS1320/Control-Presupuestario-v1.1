"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { Eye, EyeOff } from "lucide-react"
import { iniciarSesion, type ResultadoLogin } from "@/app/login/actions"
import { BotonGoogle } from "@/components/boton-google"
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

export function LoginForm({
  volverA,
  errorInicial = null,
}: {
  volverA: string
  /** Lo que salió mal en la vuelta de Google (`/auth/callback` redirige con `?error=`). */
  errorInicial?: string | null
}) {
  const router = useRouter()
  const [verPassword, setVerPassword] = useState(false)
  // «Recordarme» pasa a ser estado y no sólo un campo del form: el botón de Google vive FUERA
  // del <form> (no se pueden anidar) y necesita leerlo para dejar la cookie antes de irse.
  const [recordar, setRecordar] = useState(false)
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
    <div className="space-y-4">
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

        {/*
          El visible está ABAJO, después del botón de Google: la preferencia vale para las dos
          formas de entrar, y arriba del todo parecía ser sólo de la contraseña. Acá queda el
          campo que viaja en el FormData, atado al mismo estado.
        */}
        <input type="hidden" name="recordar" value={recordar ? "on" : ""} />

        {estado.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {estado.error}
          </p>
        )}

        <BotonEntrar />
      </form>

      {/* Separador. `aria-hidden`: el «o» es decoración visual, no información. */}
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">o</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <BotonGoogle volverA={volverA} recordar={recordar} />

      {/* Vale para las dos: la contraseña y Google. Por eso está debajo de ambas y no dentro
          del formulario — ahí se leía como una opción del login con contraseña. */}
      <div className="flex items-start gap-2 border-t pt-4">
        <Checkbox
          id="recordar"
          className="mt-0.5"
          checked={recordar}
          onCheckedChange={(v) => setRecordar(v === true)}
        />
        <div className="space-y-1">
          <Label htmlFor="recordar" className="font-normal">
            Recordarme en este navegador
          </Label>
          <p className="text-xs text-muted-foreground">
            Vale para las dos formas de entrar. Sin esto se cierra la sesión al cerrar el
            navegador —y volvés a poner el código de 6 dígitos—. No lo tildes en una computadora
            compartida.
          </p>
        </div>
      </div>

      {errorInicial && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorInicial}
        </p>
      )}

      {/*
        Esto no se puede apagar con las explicaciones (A-FEAT-84): el interruptor es una
        preferencia de la cuenta, y acá todavía no hay cuenta. Además es justo lo que necesita
        leer quien entra por primera vez.
      */}
      <p className="text-xs text-muted-foreground">
        Si es tu primera vez, entrá con Google: te crea la cuenta y después un administrador te
        habilita el acceso.
      </p>
    </div>
  )
}
