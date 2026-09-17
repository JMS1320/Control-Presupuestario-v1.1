import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClientServer } from "@/lib/supabase-server"
import { destinoSeguro } from "@/lib/auth/destino-seguro"

/**
 * VUELTA DE UN LINK DE MAIL — invitación, recuperación, confirmación (A-FEAT-87).
 *
 * Es el hermano de `/auth/callback`, que atiende el OAuth. Se separan porque **el canje es
 * distinto**, y ahí está el detalle que hace que esto funcione:
 *
 * - En OAuth, el navegador **inició** el flujo, así que dejó guardado el `code_verifier` del PKCE
 *   y `exchangeCodeForSession()` puede usarlo.
 * - Un link de mail **lo abre otra persona, en otro navegador, días después**. No hay verifier.
 *   Por eso se usa `verifyOtp({ token_hash, type })`, que no lo necesita.
 *
 * ⚠️ **Acepta las dos formas a propósito.** Según la plantilla de mail y la configuración del
 * proyecto, Supabase puede devolver `token_hash`+`type` o un `code`. Atender una sola y acertar
 * por suerte es lo que convierte esto en un bug que aparece recién cuando invitás a alguien de
 * verdad — y para entonces la persona ya vio una pantalla rota.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const destino = destinoSeguro(url.searchParams.get("next") ?? "/bienvenida")

  const alLogin = (motivo: string) =>
    NextResponse.redirect(new URL(`/login?error=${motivo}`, url.origin))

  const supabase = await createClientServer()

  const tokenHash = url.searchParams.get("token_hash")
  const tipo = url.searchParams.get("type") as EmailOtpType | null
  const code = url.searchParams.get("code")

  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
    if (error) return alLogin("link_vencido")
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return alLogin("link_vencido")
  } else {
    // Sin ninguno de los dos no hay nada que canjear. Pasa con un link recortado al copiarlo.
    return alLogin("link_invalido")
  }

  return NextResponse.redirect(new URL(destino, url.origin))
}
