import type { User } from "@supabase/supabase-js"

/**
 * EL NOMBRE Y LA FOTO DE UNA PERSONA — cuáles son los suyos y cuáles los del proveedor.
 *
 * ⚠️ **Por qué existe este archivo** (A-FEAT-85). Cuando alguien entra con Google, GoTrue vuelca
 * los datos de la identidad en `user_metadata`, y las claves que usa son **`full_name` y
 * `avatar_url`** — exactamente las dos que la app venía usando para lo que la persona cargaba en
 * `/perfil`. O sea: subías tu foto, entrabas con Google, y volvía la de Google. Sin error y sin
 * aviso, que es el modo de falla que más caro sale.
 *
 * La solución no es pelearle al proveedor sino separar las cosas:
 *
 *   - **`nombre` y `foto`** → nuestras. Sólo las escribe la persona desde `/perfil`.
 *   - **`full_name` / `avatar_url` / `name` / `picture`** → del proveedor. Se **leen** como
 *     default y no se escriben nunca.
 *
 * Es la § «Default del dato real, siempre editable» de `CLAUDE.md` aplicada tal cual: campo vacío
 * = *usá el de Google*; campo lleno = *acá mando yo*. Y como es un override y no una copia, quien
 * nunca tocó su nombre lo ve **actualizarse solo** si lo cambia en Google.
 *
 * ⚠️ La foto es el caso especial: la de Google vive en `googleusercontent.com` y el CSP del
 * `middleware.ts` sólo admite `'self'` y Supabase, así que **el navegador la bloquea en silencio**.
 * Por eso `foto` devuelve únicamente la nuestra, y la del proveedor sale aparte como *sugerencia*:
 * el perfil ofrece traerla, y al traerla pasa por `/api/perfil/avatar`, que la descarga a nuestro
 * Storage. Mostrarla directo daría un avatar vacío sin ningún error — el mismo bug de A-FEAT-79.
 */
export type Identidad = {
  /** El que se muestra: el propio si lo hay, si no el del proveedor, si no vacío. */
  nombre: string
  /** La foto **nuestra** (Storage). Vacío = se muestran las iniciales. */
  foto: string
  /** La del proveedor, sólo si no hay una propia. No se puede mostrar: hay que traerla primero. */
  fotoDelProveedor: string
}

/** Un string usable, o null. `user_metadata` es JSON libre: no se confía en la forma del dato. */
function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null
}

export function leerIdentidad(user: User | null | undefined): Identidad {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>

  const nombrePropio = texto(meta.nombre)
  const fotoPropia = texto(meta.foto)

  return {
    nombre: nombrePropio ?? texto(meta.full_name) ?? texto(meta.name) ?? "",
    foto: fotoPropia ?? "",
    fotoDelProveedor: fotoPropia
      ? ""
      : texto(meta.avatar_url) ?? texto(meta.picture) ?? "",
  }
}
