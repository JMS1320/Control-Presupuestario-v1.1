import { createClient } from "@supabase/supabase-js"

/**
 *  Cliente “admin” (solo servidor).
 *  – Usa SERVICE_ROLE_KEY  ➜  omite la RLS
 *  – No persiste sesión en cookies
 *
 * 🔴 **37 rutas de `/api` dependen de esta clave**, y desde el hardening **casi todas sus tablas le
 * niegan el acceso a `anon`**: sin la clave, no hay plan B — la consulta no devuelve poco, devuelve
 * error. Importadores, notas, marcas «para revisar», pendientes, usuarios, ARCA, GAS.
 *
 * 🧨 **Por qué este archivo dejó de ser tres líneas (A-BUG-1219, 2026-09-28).** Antes hacía
 * `process.env.SUPABASE_SERVICE_ROLE_KEY!` y listo. Con la clave ausente, `createClient` construye
 * igual un cliente inservible y **el error aparece recién en la consulta**, como un fallo de
 * Supabase cualquiera — no como «falta una variable». Y del otro lado varias pantallas se comen el
 * error y muestran **una lista vacía**, que el usuario lee como *«no hay nada para revisar»*.
 *
 * O sea: **una variable faltante se disfrazaba de dato faltante.** Eso es lo que esto corta.
 */

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

/** Qué falta, en palabras, o `null` si está todo. Las rutas lo usan para explicar en vez de romper. */
export function faltaConfiguracionAdmin(): string | null {
  const faltan: string[] = []
  if (!url) faltan.push("SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)")
  if (!key) faltan.push("SUPABASE_SERVICE_ROLE_KEY")
  if (faltan.length === 0) return null
  return (
    `Falta ${faltan.join(" y ")} en el servidor. ` +
    (process.env.VERCEL
      ? "Cargalas en Vercel → Settings → Environment Variables (para Production Y Preview) y volvé a desplegar: se toman en el build."
      : "Si ya están en .env.local, reiniciá el «npm run dev»: Next lee el entorno al arrancar.")
  )
}

/**
 * ⚠️ Se construye igual aunque falte la clave —para no romper el import de 37 rutas— pero
 * **quien lo use tiene que preguntar antes por `faltaConfiguracionAdmin()`** y devolver ese
 * mensaje. Un cliente mudo es justo lo que hacía que el síntoma no se pudiera diagnosticar.
 */
export const supabaseAdmin = createClient(url ?? "http://sin-configurar.local", key ?? "sin-clave", {
  auth: { persistSession: false },
})
