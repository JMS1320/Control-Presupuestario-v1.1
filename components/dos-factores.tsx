"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { destinoSeguro } from "@/lib/auth/destino-seguro"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/** Sólo dígitos, 6 posiciones: es lo único que puede ser un TOTP. */
const CODIGO_OK = /^\d{6}$/

/**
 * Desafío de segundo factor: el usuario ya tiene un autenticador inscripto y tiene que
 * escribir el código para que la sesión suba a aal2.
 */
export function DesafioTOTP() {
  const router = useRouter()
  // A dónde ir después. Importa para la invitación de un admin (A-FEAT-87): el middleware lo
  // manda a inscribir el 2FA ANTES de dejarlo llegar a /bienvenida, así que si acá volviéramos
  // siempre a "/", se saltearía la pantalla donde define su contraseña y no podría volver nunca.
  const destino = destinoSeguro(useSearchParams().get("next"))
  const [codigo, setCodigo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function verificar(e: React.FormEvent) {
    e.preventDefault()
    if (!CODIGO_OK.test(codigo)) {
      setError("El código son 6 dígitos.")
      return
    }
    setEnviando(true)
    setError(null)

    const { data: factores, error: errFactores } = await supabase.auth.mfa.listFactors()
    const factor = factores?.totp?.[0]
    if (errFactores || !factor) {
      setError("No se pudo verificar. Cerrá sesión y volvé a entrar.")
      setEnviando(false)
      return
    }

    const { error: errVerificar } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: codigo,
    })

    if (errVerificar) {
      // Mensaje único: no se distingue "código vencido" de "código equivocado".
      setError("Código incorrecto.")
      setCodigo("")
      setEnviando(false)
      return
    }

    router.refresh()
    router.replace(destino)
  }

  return (
    <form onSubmit={verificar} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="codigo">Código de tu app de autenticación</Label>
        <Input
          id="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          autoFocus
          placeholder="000000"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando ? "Verificando…" : "Verificar"}
      </Button>
    </form>
  )
}

/**
 * Alta del segundo factor. El admin no puede entrar sin esto (decidido 2026-09-03).
 * El QR lo devuelve Supabase ya armado como data URI — no hace falta librería de QR.
 */
export function AltaTOTP() {
  const router = useRouter()
  // A dónde ir después. Importa para la invitación de un admin (A-FEAT-87): el middleware lo
  // manda a inscribir el 2FA ANTES de dejarlo llegar a /bienvenida, así que si acá volviéramos
  // siempre a "/", se saltearía la pantalla donde define su contraseña y no podría volver nunca.
  const destino = destinoSeguro(useSearchParams().get("next"))
  const [qr, setQr] = useState<string | null>(null)
  const [secreto, setSecreto] = useState<string | null>(null)
  // El `otpauth://` crudo. Sirve para quien está mirando esta pantalla DESDE el teléfono: tocarlo
  // abre el autenticador y agrega la cuenta sin cámara de por medio.
  const [uri, setUri] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [codigo, setCodigo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      // Si quedó un alta a medias de un intento anterior, se reusa en vez de acumular factores.
      const { data: existentes } = await supabase.auth.mfa.listFactors()
      const pendiente = existentes?.all?.find((f) => f.status === "unverified")
      if (pendiente) {
        await supabase.auth.mfa.unenroll({ factorId: pendiente.id })
      }

      /**
       * ⚠️ `issuer` va explícito, y es lo que la persona va a leer en su app de autenticación
       * durante años.
       *
       * Sin él, Supabase lo deduce del **Site URL** del proyecto, y la entrada queda nombrada
       * `localhost:3000` — que no dice qué sistema es, y encima es el puerto de OTRA aplicación.
       * `friendlyName` no alcanza: ése es el nombre interno que ve el admin en la lista de
       * factores, no el del QR.
       *
       * Y por eso es un **nombre fijo y no la URL**: el QR se escanea una vez y esa entrada
       * sobrevive al cambio de dominio. Si el issuer saliera del host, quien se inscribe hoy en
       * local vería «localhost» en el teléfono para siempre, incluso después de pasar a
       * producción — y dos ambientes distintos crearían entradas que parecen sistemas distintos.
       */
      const { data, error: err } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Control Presupuestario",
        friendlyName: "Control Presupuestario",
      })
      if (cancelado) return
      if (err || !data) {
        setError("No se pudo generar el código. Recargá la página.")
        return
      }
      setQr(data.totp.qr_code)
      setSecreto(data.totp.secret)
      setUri(data.totp.uri)
      setFactorId(data.id)
    })()
    return () => {
      cancelado = true
    }
  }, [])

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || !CODIGO_OK.test(codigo)) {
      setError("El código son 6 dígitos.")
      return
    }
    setEnviando(true)
    setError(null)

    const { error: err } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: codigo,
    })
    if (err) {
      setError("Código incorrecto. Revisá que la hora del teléfono esté en automático.")
      setCodigo("")
      setEnviando(false)
      return
    }

    router.refresh()
    router.replace(destino)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Escaneá este código con Google Authenticator (o la app que uses) y escribí el número que
        te muestre.
      </p>

      {/*
        ⚠️ **Fondo blanco FIJO y margen alrededor — no es decoración, es lo que lo hace escaneable.**
        El SVG que devuelve Supabase son módulos oscuros SIN fondo propio. Servido sobre la tarjeta
        (`dark:bg-slate-900`), en modo oscuro queda negro sobre gris oscuro: a ojo se ve un QR, pero
        para una cámara no hay contraste y la app de autenticación no lo agrega. Le pasó a un usuario
        el 2026-09-23 y el síntoma no dice nada — no hay error, simplemente no pasa nada.
        El `p-4` es la **zona de silencio** que el estándar QR exige: sin margen claro alrededor,
        muchos lectores tampoco enganchan.
      */}
      {qr ? (
        <div className="mx-auto w-fit rounded-lg bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Código QR para el segundo factor" className="h-48 w-48" />
        </div>
      ) : (
        <div className="mx-auto h-56 w-56 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      )}

      {/*
        Los dos caminos que NO usan la cámara. Van a la vista y no escondidos en un <details>:
        cuando el QR falla, la persona ya está trabada, y un desplegable que hay que descubrir es
        justo lo que no encuentra.
      */}
      {uri && (
        <a
          href={uri}
          className="block text-center text-sm underline underline-offset-2 sm:hidden"
        >
          Abrir directamente en mi app de autenticación
        </a>
      )}

      {secreto && (
        <div className="rounded border bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
          <p className="mb-1 font-medium">¿No lo toma el escáner? Cargalo a mano</p>
          <p className="mb-2 text-muted-foreground">
            En tu app: «Agregar cuenta» → «Ingresar clave de configuración», tipo{" "}
            <strong>por tiempo</strong>. El nombre de cuenta lo elegís vos.
          </p>
          <p className="break-all font-mono text-sm tracking-wider">{secreto}</p>
        </div>
      )}

      <form onSubmit={confirmar} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="codigo-alta">Código de 6 dígitos</Label>
          <Input
            id="codigo-alta"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={enviando || !factorId}>
          {enviando ? "Confirmando…" : "Activar segundo factor"}
        </Button>
      </form>
    </div>
  )
}
