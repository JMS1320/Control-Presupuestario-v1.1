import type { CookieOptions } from "@supabase/ssr"

/** Cookie de preferencia: "¿mantener la sesión al cerrar el navegador?". */
export const COOKIE_RECORDAR = "cp-recordar"

/** ~13 meses: el tope que los browsers aceptan hoy para una cookie. */
export const MAX_AGE_RECORDAR = 400 * 24 * 60 * 60

/**
 * Ajusta las cookies de sesión según la preferencia del usuario.
 *
 * - **Recordar tildado** → se dejan como vienen (persistentes): sobreviven al cierre del browser.
 * - **Sin tildar** → se les saca `maxAge`/`expires`, con lo que pasan a ser **cookies de sesión**:
 *   el browser las borra al cerrarse y hay que volver a entrar.
 *
 * Por qué importa: sin esto, "recordarme" no existe — Supabase deja la sesión persistente
 * **siempre**, y en una máquina compartida cualquiera que abra el navegador entra al sistema
 * contable sin pedir nada.
 */
export function ajustarPersistencia(
  options: CookieOptions,
  recordar: boolean
): CookieOptions {
  if (recordar) return options
  const { maxAge, expires, ...resto } = options
  return resto
}

/**
 * Escribe la preferencia desde el BROWSER.
 *
 * Existe por el login con Google (A-FEAT-85): ahí no hay Server Action que la escriba antes del
 * sign-in —el navegador se va a `accounts.google.com` y vuelve por `/auth/callback`—, así que la
 * preferencia tiene que quedar puesta **antes de irse**. Cuando el usuario vuelve, el callback ya
 * la encuentra y escribe las cookies de sesión con la persistencia correcta.
 *
 * Se puede escribir desde acá porque `COOKIE_RECORDAR` **no es httpOnly a propósito**: no es un
 * secreto, es una preferencia de UI (ver el comentario en `app/login/actions.ts`).
 */
export function escribirRecordarEnElBrowser(recordar: boolean): void {
  if (typeof document === "undefined") return
  const seguro = location.protocol === "https:" ? "; Secure" : ""
  document.cookie = recordar
    ? `${COOKIE_RECORDAR}=1; Max-Age=${MAX_AGE_RECORDAR}; Path=/; SameSite=Lax${seguro}`
    : `${COOKIE_RECORDAR}=; Max-Age=0; Path=/; SameSite=Lax${seguro}`
}
