import type { User } from "@supabase/supabase-js"

/**
 * Preferencias personales: lo que cada uno configura **de su propia cuenta**.
 *
 * Viven en `user_metadata.preferencias`, igual que el nombre y la foto, y por el mismo motivo:
 * son **cosméticas**. El propio usuario las puede escribir con `auth.updateUser()` sin ningún
 * endpoint de admin y sin tocar la base.
 *
 * ⚠️ **Acá no puede entrar nada que decida permisos.** `user_metadata` lo edita el propio dueño
 * de la cuenta (ver `roles.ts`): una preferencia que abriera una sección sería un escalado de
 * privilegios de un `updateUser` de distancia. Lo que se elige acá **no agranda lo que se ve, sólo
 * lo acomoda** — la sección de inicio se valida igual contra las permitidas del rol, así que
 * elegir «sueldos» sin tener Sueldos no muestra Sueldos: cae al default.
 */
export type Preferencias = {
  /** Sección que se abre al entrar. `null` = la primera que ve el rol (el default real). */
  seccionInicio: string | null
  /** Arrancar con el menú lateral abierto. */
  menuAbierto: boolean
  /** Mostrar los contadores de pendientes en el menú (sólo tienen datos para `admin`). */
  contadoresPendientes: boolean
  /** Confirmar antes de cerrar sesión. */
  confirmarSalida: boolean
}

/**
 * Los defaults son **el comportamiento de siempre**, no una opinión nueva.
 *
 * Regla § Default del dato real: preferencia sin tocar = como venía funcionando. Nadie que no
 * entre a configurar nada tiene que notar que esto existe.
 */
export const PREFERENCIAS_DEFAULT: Preferencias = {
  seccionInicio: null,
  menuAbierto: false,
  contadoresPendientes: true,
  confirmarSalida: false,
}

/**
 * Lee las preferencias tolerando cualquier cosa que haya guardada.
 *
 * ⚠️ **No se confía en la forma del dato.** `user_metadata` es un JSON libre que el propio usuario
 * puede escribir por API con cualquier contenido, y además una preferencia vieja puede haber
 * quedado con otro tipo después de un cambio acá. Cada campo se valida por separado y el que no
 * cierra cae a su default, en vez de romper la pantalla entera por una clave mal tipada.
 */
export function leerPreferencias(user: User | null | undefined): Preferencias {
  const crudo = user?.user_metadata?.preferencias
  if (!crudo || typeof crudo !== "object") return PREFERENCIAS_DEFAULT

  const p = crudo as Record<string, unknown>
  const bool = (clave: keyof Preferencias, porDefecto: boolean) =>
    typeof p[clave] === "boolean" ? (p[clave] as boolean) : porDefecto

  return {
    seccionInicio: typeof p.seccionInicio === "string" && p.seccionInicio ? p.seccionInicio : null,
    menuAbierto: bool("menuAbierto", PREFERENCIAS_DEFAULT.menuAbierto),
    contadoresPendientes: bool("contadoresPendientes", PREFERENCIAS_DEFAULT.contadoresPendientes),
    confirmarSalida: bool("confirmarSalida", PREFERENCIAS_DEFAULT.confirmarSalida),
  }
}
