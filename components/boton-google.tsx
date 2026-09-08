"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { escribirRecordarEnElBrowser } from "@/lib/auth/cookies-sesion"

/** El logo va en SVG inline y no como imagen: el CSP sólo admite `img-src 'self'` y Supabase. */
function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/**
 * ENTRAR CON GOOGLE (A-FEAT-85).
 *
 * El arranque del OAuth va desde el **browser** y no desde una Server Action, por una razón
 * concreta: `redirectTo` tiene que ser el origen exacto desde el que se está mirando la app, y
 * `window.location.origin` lo sabe sin adivinar. En el servidor habría que deducirlo de las
 * cabeceras `x-forwarded-*`, y cada preview de Vercel tiene un host distinto — un error ahí manda
 * a la persona de vuelta a otro deployment con un `code` que ya no sirve.
 *
 * ⚠️ La preferencia «Recordarme» se escribe **antes** de irse a Google: el navegador se va del
 * sitio y vuelve por `/auth/callback`, así que si no queda puesta ahora, al volver ya no hay quién
 * la ponga y la sesión se escribe siempre persistente.
 */
export function BotonGoogle({ volverA, recordar }: { volverA: string; recordar: boolean }) {
  const [yendo, setYendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function entrar() {
    setError(null)
    setYendo(true)
    escribirRecordarEnElBrowser(recordar)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(volverA)}`,
      },
    })

    // Si todo va bien no se llega acá: el navegador ya se fue a Google.
    if (error) {
      setError("No se pudo abrir el ingreso con Google. Probá de nuevo.")
      setYendo(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={entrar}
        disabled={yendo}
      >
        <LogoGoogle />
        {yendo ? "Abriendo Google…" : "Continuar con Google"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
