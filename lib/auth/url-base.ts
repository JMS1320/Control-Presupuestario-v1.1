/**
 * La URL pública de la app, para armar los links que se le mandan a la gente.
 *
 * Existe porque `new URL(request.url).origin` devuelve **el origen desde donde se llamó**: si el
 * admin genera una invitación corriendo en local, el link sale apuntando a `localhost:3001` y no
 * le sirve a nadie. Y detrás de un proxy, `request.url` tampoco es siempre el host público.
 *
 * Orden de resolución:
 *   1. **Preview de Vercel → el host real del deploy**, aunque haya `NEXT_PUBLIC_SITE_URL`.
 *      Va primero porque en Vercel las variables se agregan a los **tres** entornos por defecto:
 *      con la regla al revés, un admin que invita desde un preview mandaría un link a producción,
 *      que en ese momento corre **otro código**. El pedido es que el link caiga donde se creó.
 *   2. `NEXT_PUBLIC_SITE_URL` — el que manda en producción (y el único que sabe de un dominio
 *      propio, que `x-forwarded-host` no distingue del `.vercel.app`).
 *   3. Las cabeceras `x-forwarded-*` — el host público real detrás del proxy.
 *   4. El origen del request — el fallback de siempre (local).
 */
export function urlBase(request: Request): string {
  const reenviado = hostReenviado(request)

  if (process.env.VERCEL_ENV === "preview" && reenviado) return reenviado

  const explicita = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicita) return explicita.replace(/\/+$/, "")

  if (reenviado) return reenviado

  return new URL(request.url).origin
}

function hostReenviado(request: Request): string | null {
  const host = request.headers.get("x-forwarded-host")
  if (!host) return null
  const proto = request.headers.get("x-forwarded-proto") ?? "https"
  return `${proto}://${host}`
}

/**
 * EL CONTROL DEL LINK (§ 🧮 de CLAUDE.md — y es el control más barato que hay: el mismo dato por
 * dos caminos).
 *
 * Supabase **no falla** cuando el `redirectTo` que le pasamos no está en su lista de Redirect URLs:
 * lo descarta y lo reemplaza por el **Site URL** del proyecto, sin avisar ni por error ni por log.
 * El link sale, el mail se manda, y la persona termina en otro lado — el 2026-09-18 el Site URL
 * era `http://localhost:3000`, que ni siquiera es esta app (A-BUG-98).
 *
 * Por suerte `generateLink` devuelve el link ya armado, así que el destino que Supabase **aceptó**
 * viaja en su query string. Comparar los dos cuesta nada y convierte un fallo mudo en un cartel.
 *
 * Devuelve `null` si coinciden, o el destino realmente aceptado si no.
 */
export function destinoDescartado(actionLink: string, pedido: string): string | null {
  let aceptado: string | null
  try {
    aceptado = new URL(actionLink).searchParams.get("redirect_to")
  } catch {
    // Un link que no parsea es otro problema; este control no opina sobre él.
    return null
  }
  if (!aceptado) return null
  return mismoDestino(aceptado, pedido) ? null : aceptado
}

/** Compara origen + path, que es lo que decide a dónde cae la persona. */
function mismoDestino(a: string, b: string): boolean {
  try {
    const ua = new URL(a)
    const ub = new URL(b)
    return ua.origin === ub.origin && ua.pathname === ub.pathname
  } catch {
    return a === b
  }
}
