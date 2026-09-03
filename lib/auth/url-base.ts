/**
 * La URL pública de la app, para armar los links que se le mandan a la gente.
 *
 * Existe porque `new URL(request.url).origin` devuelve **el origen desde donde se llamó**: si el
 * admin genera una invitación corriendo en local, el link sale apuntando a `localhost:3000` y no
 * le sirve a nadie. Y detrás de un proxy, `request.url` tampoco es siempre el host público.
 *
 * Orden de resolución:
 *   1. `NEXT_PUBLIC_SITE_URL` — el que manda si está puesto (producción).
 *   2. Las cabeceras `x-forwarded-*` — el host público real detrás del proxy de Vercel;
 *      es lo que hace que cada **preview deployment** genere links a sí mismo.
 *   3. El origen del request — el fallback de siempre (local).
 */
export function urlBase(request: Request): string {
  const explicita = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicita) return explicita.replace(/\/+$/, "")

  const host = request.headers.get("x-forwarded-host")
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https"
    return `${proto}://${host}`
  }

  return new URL(request.url).origin
}
