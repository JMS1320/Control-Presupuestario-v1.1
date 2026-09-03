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
