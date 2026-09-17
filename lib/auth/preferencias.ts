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
  /**
   * Mostrar los textos que explican cada pantalla (A-FEAT-84).
   *
   * ⚠️ Apaga **sólo lo didáctico**. Los controles y las alertas de datos no llevan la marca y no
   * se apagan nunca — `CLAUDE.md` § 🧮. El detalle de qué se marca, en `components/ayuda.tsx`.
   */
  explicaciones: boolean
  /**
   * Qué widgets se ven en la pantalla de inicio y **en qué orden** (A-FEAT-88).
   *
   * `null` = todavía no eligió → se muestra el conjunto por defecto. No es lo mismo que `[]`,
   * que significa «los saqué todos a propósito»: sin esa distinción, vaciar la pantalla la
   * devolvería al default en la siguiente carga y no habría forma de dejarla limpia.
   *
   * ⚠️ **Esta lista NO decide permisos.** Vive en `user_metadata`, que el propio usuario escribe;
   * se filtra contra las secciones de su rol antes de renderizar nada. Misma puerta que
   * `seccionInicio`.
   */
  widgets: string[] | null
  /**
   * El tamaño que el usuario le dio a un widget, sólo para los que tocó (A-FEAT-88).
   *
   * `{ "alertas-pagos": { ancho: 2, alto: 320 } }` — `ancho` en columnas (1 o 2) y `alto` en
   * píxeles, o `0` para que lo decida el contenido.
   *
   * El alto va en píxeles y no en "chico/grande" porque se ajusta **arrastrando el borde**: un
   * par de tamaños fijos haría que el gesto salte, y el usuario pidió poder agrandarlo *si fuera
   * necesario* — o sea, lo que necesite, no lo que previmos.
   *
   * Se guarda **disperso**: sólo los widgets que se tocaron. Si guardáramos los 8 siempre,
   * cambiar el default de uno no le llegaría nunca a quien ya abrió la pantalla una vez.
   */
  widgetsTamano: Record<string, { ancho: 1 | 2; alto: number }>
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
  // Encendidas: el que no sabe que esto existe tiene que seguir viendo las explicaciones. Apagarlas
  // por default le sacaría la ayuda justamente al que todavía no aprendió a encenderla.
  explicaciones: true,
  widgets: null,
  widgetsTamano: {},
}

/**
 * Lee las preferencias tolerando cualquier cosa que haya guardada.
 *
 * ⚠️ **No se confía en la forma del dato.** `user_metadata` es un JSON libre que el propio usuario
 * puede escribir por API con cualquier contenido, y además una preferencia vieja puede haber
 * quedado con otro tipo después de un cambio acá. Cada campo se valida por separado y el que no
 * cierra cae a su default, en vez de romper la pantalla entera por una clave mal tipada.
 */
/**
 * Valida el mapa de tamaños campo por campo. Es JSON libre que el propio usuario puede escribir:
 * un `ancho: 7` no rompería nada visible, dejaría una grilla rota sin explicación.
 */
function leerTamanos(crudo: unknown): Record<string, { ancho: 1 | 2; alto: number }> {
  if (!crudo || typeof crudo !== "object") return {}
  const salida: Record<string, { ancho: 1 | 2; alto: number }> = {}
  for (const [id, valor] of Object.entries(crudo as Record<string, unknown>)) {
    if (!valor || typeof valor !== "object") continue
    const v = valor as Record<string, unknown>
    // El alto se acota a un rango usable: un valor absurdo dejaría una tarjeta de 9000px sin
    // ningún error que lo explique, y esto es un JSON que el propio usuario puede escribir.
    const altoCrudo = typeof v.alto === "number" && Number.isFinite(v.alto) ? v.alto : 0
    salida[id] = {
      ancho: v.ancho === 2 ? 2 : 1,
      alto: altoCrudo <= 0 ? 0 : Math.min(Math.max(altoCrudo, 120), 800),
    }
  }
  return salida
}

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
    explicaciones: bool("explicaciones", PREFERENCIAS_DEFAULT.explicaciones),
    // Se aceptan sólo strings: un id que no exista lo descarta después el registro, pero un
    // número o un objeto acá romperían el render.
    widgets: Array.isArray(p.widgets)
      ? (p.widgets as unknown[]).filter((w): w is string => typeof w === "string")
      : null,
    widgetsTamano: leerTamanos(p.widgetsTamano),
  }
}
