/**
 * ⏸️ PAUSA POR PERSONA — «estamos actualizando, probá más tarde».
 *
 * Pedido de JMS 2026-10-30, al publicar `desarrollo` a `main` después de 4 semanas: a Ulises se le
 * corta la vista con un aviso mientras se publica y se controla primero cómo la ve, en vez de que
 * le aparezcan de golpe pantallas nuevas sin revisar.
 *
 * Es POR PERSONA (`app_metadata.pausa = true` en su usuario) y no por rol, a propósito: así el rol
 * `contable` sigue intacto y se puede revisar con otra cuenta que tenga ese rol exactamente lo que
 * él va a ver. Se prende y se apaga sin publicar código.
 *
 * `app_metadata` y no `user_metadata`: el segundo lo puede editar la propia persona y se sacaría
 * la pausa sola (mismo motivo que el rol, ver `lib/auth/roles.ts`).
 */

/** La pantalla del aviso. */
export const RUTA_PAUSA = "/actualizando"

/**
 * ¿Esta persona está en pausa? Un admin NUNCA: si por error se le marcara a JMS, se quedaría
 * afuera de la única pantalla desde la que se saca la marca.
 */
export function enPausa(appMetadata: Record<string, unknown> | null | undefined): boolean {
  if (!appMetadata) return false
  if (appMetadata.role === "admin") return false
  return appMetadata.pausa === true
}

/**
 * ¿Hay que desviar este pedido al aviso? Se deja pasar el aviso mismo y lo que sirve para salir
 * (login, cerrar sesión); la API contesta 503 en vez de un redirect.
 */
export function desvioPorPausa(
  appMetadata: Record<string, unknown> | null | undefined,
  pathname: string
): "pasa" | "aviso" | "api-503" {
  if (!enPausa(appMetadata)) return "pasa"
  const libres = [RUTA_PAUSA, "/login", "/auth"]
  if (libres.some((r) => pathname === r || pathname.startsWith(r + "/"))) return "pasa"
  return pathname.startsWith("/api/") ? "api-503" : "aviso"
}
