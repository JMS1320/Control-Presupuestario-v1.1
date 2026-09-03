/**
 * Valida el destino post-login.
 *
 * OWASP — redirección abierta: si aceptáramos `?volver_a=https://sitio-falso/`, alguien manda ese
 * link, la víctima se loguea de verdad y termina en una copia del sistema que le vuelve a pedir la
 * clave. Sólo se admiten rutas internas ("/algo"), nunca "//host" ni una URL absoluta.
 */
export function destinoSeguro(destino: string | null | undefined): string {
  if (!destino) return "/"
  if (!destino.startsWith("/")) return "/"
  if (destino.startsWith("//")) return "/"
  return destino
}
