import { createBrowserClient } from "@supabase/ssr"
import { COOKIE_RECORDAR } from "@/lib/auth/cookies-sesion"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Cliente Supabase del BROWSER.
 *
 * Pasó de `createClient` a `createBrowserClient` (@supabase/ssr) el 2026-09-03 para que la sesión
 * viaje en COOKIES en vez de localStorage. Es lo que hace que las ~103 pantallas que importan este
 * mismo `supabase` queden autenticadas sin tocarles una línea: el browser manda el JWT del usuario
 * logueado, y la RLS lo deja escribir. Con el cliente viejo mandaría `anon` y la RLS lo frenaría.
 *
 * Ver `MODULO_USUARIOS.md` § Opción A · `PENDIENTES.md` § A-SEC-03.
 */
/**
 * Lee las cookies del documento. En el servidor (SSR de un componente cliente) no hay `document`:
 * devuelve vacío en vez de romper.
 */
function leerCookies() {
  if (typeof document === "undefined") return []
  return document.cookie
    .split("; ")
    .filter(Boolean)
    .map((c) => {
      const i = c.indexOf("=")
      return {
        name: decodeURIComponent(c.slice(0, i)),
        value: decodeURIComponent(c.slice(i + 1)),
      }
    })
}

/**
 * Escribe respetando la preferencia "Recordarme en este navegador".
 *
 * Sin esto, "recordarme" quedaba a medias: el servidor escribía cookies de sesión, pero el
 * cliente (al verificar el 2FA y en cada refresh del token) las volvía a escribir persistentes
 * — y la sesión sobrevivía igual al cierre del navegador. Ver `lib/auth/cookies-sesion.ts`.
 */
function escribirCookies(
  cookies: { name: string; value: string; options?: Record<string, unknown> }[]
) {
  if (typeof document === "undefined") return
  const recordar = leerCookies().find((c) => c.name === COOKIE_RECORDAR)?.value === "1"

  for (const { name, value, options = {} } of cookies) {
    const partes = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`]
    partes.push(`Path=${(options.path as string) ?? "/"}`)
    if (recordar && typeof options.maxAge === "number") {
      partes.push(`Max-Age=${options.maxAge}`)
    }
    // Sin Max-Age ni Expires = cookie de sesión: se borra al cerrar el navegador.
    partes.push(`SameSite=${(options.sameSite as string) ?? "Lax"}`)
    if (location.protocol === "https:") partes.push("Secure")
    document.cookie = partes.join("; ")
  }
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookies: { getAll: leerCookies, setAll: escribirCookies },
})

export type CuentaContable = {
  id: string
  categ: string
  cuenta_contable: string
  tipo: "ingreso" | "egreso" | "financiero" | "distribucion"
  nombre_totalizadora?: string | null
  cta_totalizadora?: string | null
  imputable?: boolean | null
}

export type MovimientoMSA = {
  id?: string // UUID generado automáticamente
  fecha?: string | null
  descripcion?: string | null
  origen?: string | null
  debitos?: number | null
  creditos?: number | null
  grupo_de_conceptos?: string | null
  concepto?: string | null
  numero_de_terminal?: string | null
  observaciones_cliente?: string | null
  numero_de_comprobante?: string | null
  leyendas_adicionales_1?: string | null
  leyendas_adicionales_2?: string | null
  leyendas_adicionales_3?: string | null
  leyendas_adicionales_4?: string | null
  tipo_de_movimiento?: string | null
  saldo?: number | null
  control?: number | null
  categ?: string | null
  detalle?: string | null
  contable?: string | null
  interno?: string | null
  centro_de_costo?: string | null
  cuenta?: string | null
  orden?: number | null
}
