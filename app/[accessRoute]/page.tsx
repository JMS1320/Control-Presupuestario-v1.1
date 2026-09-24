import { redirect } from "next/navigation"

/**
 * Las viejas rutas-como-password (`/adminjms1320`, `/ulises`) ya NO dan acceso.
 *
 * Reemplazo total decidido con el usuario 2026-09-03: la URL dejó de ser la contraseña. Se deja
 * este redirect en vez de borrar la ruta para que los favoritos viejos no den 404 — caen en la
 * raíz, y si no hay sesión el middleware los manda al login.
 *
 * ⚠️ No se lee `accessRoute` a propósito: cualquier valor va al mismo lugar. Si volviera a
 * mapearse a un rol, volvería el agujero que cerró A-SEC-04.
 */
export default function AccessPage() {
  redirect("/")
}
