"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Eye, EyeOff } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { BotonGoogle } from "@/components/boton-google"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * El largo mínimo lo decide Supabase (Authentication → Policies). Acá se valida igual, para que
 * el aviso salga **antes** de mandar y no como un error del servidor en inglés.
 */
const MINIMO = 8

export function PanelBienvenida({ email, tieneRol }: { email: string; tieneRol: boolean }) {
  const router = useRouter()
  const [clave, setClave] = useState("")
  const [repetida, setRepetida] = useState("")
  const [verClave, setVerClave] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [listaClave, setListaClave] = useState(false)

  async function definirClave(e: React.FormEvent) {
    e.preventDefault()
    if (clave.length < MINIMO) {
      toast.error(`La contraseña tiene que tener al menos ${MINIMO} caracteres.`)
      return
    }
    if (clave !== repetida) {
      // Se compara acá y no se confía en el navegador: es el único error que, si pasa, la deja
      // afuera con una clave que escribió mal y no puede ver.
      toast.error("Las dos contraseñas no coinciden.")
      return
    }
    setGuardando(true)
    const { error } = await supabase.auth.updateUser({ password: clave })
    setGuardando(false)
    if (error) {
      toast.error(
        /weak|pwned|compromis/i.test(error.message)
          ? "Esa contraseña aparece en filtraciones conocidas. Elegí otra."
          : "No se pudo guardar la contraseña."
      )
      return
    }
    setClave("")
    setRepetida("")
    setListaClave(true)
    toast.success("Contraseña definida.")
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Ya estás adentro</h1>
        <p className="text-sm text-muted-foreground">
          Tu cuenta es <strong>{email}</strong>. Antes de seguir, dejá elegido cómo vas a entrar la
          próxima vez.
        </p>
      </div>

      {/* ---------- contraseña ---------- */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          {listaClave && <Check className="h-4 w-4 text-emerald-600" />}
          Con una contraseña
        </h2>

        {listaClave ? (
          <p className="text-sm text-emerald-700">
            Listo. Vas a entrar con {email} y esa contraseña.
          </p>
        ) : (
          <form onSubmit={definirClave} className="space-y-3">
            {/*
              Campo oculto con el usuario: sin esto los gestores de contraseñas guardan la clave
              sin saber a qué cuenta pertenece, y después no la ofrecen al volver.
            */}
            <input type="hidden" name="username" autoComplete="username" value={email} readOnly />
            <div className="space-y-2">
              <Label htmlFor="clave">Contraseña nueva</Label>
              <div className="relative">
                <Input
                  id="clave"
                  type={verClave ? "text" : "password"}
                  autoComplete="new-password"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  className="pr-10"
                  placeholder={`Al menos ${MINIMO} caracteres`}
                />
                <button
                  type="button"
                  onClick={() => setVerClave((v) => !v)}
                  aria-pressed={verClave}
                  aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {verClave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clave2">Repetila</Label>
              <Input
                id="clave2"
                type={verClave ? "text" : "password"}
                autoComplete="new-password"
                value={repetida}
                onChange={(e) => setRepetida(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={guardando} className="w-full">
              {guardando ? "Guardando…" : "Definir contraseña"}
            </Button>
          </form>
        )}
      </section>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">y / o</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* ---------- google ---------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Con tu cuenta de Google</h2>
        <p className="text-xs text-muted-foreground">
          Tiene que ser la de <strong>{email}</strong>. Si usás otra, vas a terminar en una cuenta
          distinta sin acceso.
        </p>
        <BotonGoogle volverA="/" recordar={false} />
      </section>

      <div className="space-y-3 border-t pt-4">
        <Button
          variant={listaClave ? "default" : "secondary"}
          className="w-full"
          onClick={() => router.push("/")}
        >
          Entrar al sistema
        </Button>
        {!listaClave && (
          // No se bloquea el paso: se avisa. Trabar a alguien en esta pantalla sería peor que el
          // problema que resuelve, y con Google vinculado la contraseña no hace falta.
          <p className="text-xs text-muted-foreground">
            Si no hacés ninguna de las dos, vas a poder usar el sistema ahora, pero para volver más
            adelante vas a tener que pedir un link nuevo.
          </p>
        )}
        {!tieneRol && (
          <p className="text-xs text-amber-700">
            Tu cuenta todavía no tiene permisos asignados. Cuando un administrador te los dé, vas a
            ver el sistema completo.
          </p>
        )}
      </div>
    </div>
  )
}
