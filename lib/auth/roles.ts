import type { User } from "@supabase/supabase-js"

/**
 * Roles del sistema. Mismos nombres que usaba `config/access-routes.ts` (rutas-como-password),
 * para que las restricciones finas ya escritas en las pantallas sigan valiendo igual.
 */
export type UserRole = "admin" | "contable"

/**
 * De dónde sale el rol: `app_metadata.role` del JWT.
 *
 * ⚠️ `app_metadata` y NO `user_metadata`. `user_metadata` lo puede editar el propio usuario con su
 * sesión (`auth.updateUser`), así que guardar el rol ahí es regalar un escalado de privilegios:
 * cualquiera se haría `admin` solo. `app_metadata` únicamente se escribe con `service_role`.
 */
export function getRole(user: User | null | undefined): UserRole | null {
  const rol = user?.app_metadata?.role
  return rol === "admin" || rol === "contable" ? rol : null
}

export function esAdmin(user: User | null | undefined): boolean {
  return getRole(user) === "admin"
}

/** Nivel de garantía de la sesión: `aal2` = pasó por el segundo factor. */
export type AAL = "aal1" | "aal2"

/**
 * ¿Este usuario está obligado a tener 2FA? Decidido con el usuario 2026-09-03:
 * obligatorio para `admin` (ve y edita todo el sistema contable), opcional para `contable`
 * para no trabar la delegación a Ulises (§ quinta pieza: el PERMISO, en CLAUDE.md).
 */
export function requiere2FA(user: User | null | undefined): boolean {
  return getRole(user) === "admin"
}
