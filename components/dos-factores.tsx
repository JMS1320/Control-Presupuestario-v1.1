"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
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
    router.replace("/")
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
  const [qr, setQr] = useState<string | null>(null)
  const [secreto, setSecreto] = useState<string | null>(null)
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

      const { data, error: err } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Control Presupuestario",
      })
      if (cancelado) return
      if (err || !data) {
        setError("No se pudo generar el código. Recargá la página.")
        return
      }
      setQr(data.totp.qr_code)
      setSecreto(data.totp.secret)
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
    router.replace("/")
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Escaneá este código con Google Authenticator (o la app que uses) y escribí el número que
        te muestre.
      </p>

      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="Código QR para el segundo factor" className="mx-auto h-48 w-48" />
      ) : (
        <div className="mx-auto h-48 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      )}

      {secreto && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">No puedo escanear el QR</summary>
          <p className="mt-2 break-all font-mono">{secreto}</p>
        </details>
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
