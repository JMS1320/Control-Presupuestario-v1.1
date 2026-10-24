/**
 * ⏱️ CIERRE DE SESIÓN POR INACTIVIDAD — A-FEAT-1351
 *
 * Pedido del usuario 2026-10-24: *«cierre por inactividad a 1 hora sin actividad y configurable…
 * si luego quiero achicar o agrandar esa brecha»*. Es la pieza que pidió para el celular (clave +
 * cierre por inactividad): un teléfono perdido o una PC compartida no pueden quedar con la sesión
 * abierta para siempre.
 *
 * Cómo funciona, en tres piezas:
 *   1. **El tiempo vive en el ROL** (`public.roles.minutos_inactividad`, `scripts/101`). Vacío =
 *      60 minutos (§ default del dato real: vacío = «usá el de siempre»).
 *   2. **La pantalla** (`components/cierre-inactividad.tsx`) anota la última actividad en una
 *      cookie y cierra la sesión cuando se pasa el tiempo. La cookie la comparten todas las
 *      pestañas: trabajar en una mantiene viva a las otras.
 *   3. **El servidor** (`middleware.ts`) lee esa misma cookie: si alguien reabre la app pasado el
 *      tiempo, va directo al login **sin que la página llegue a mostrar datos**.
 *
 * La cookie lleva la SESIÓN a la que pertenece. Sin eso, al volver a entrar quedaría la marca
 * vieja de la sesión anterior y el servidor cerraría la nueva apenas abierta.
 *
 * Esto es lógica pura (sin base ni navegador) para que la cubra `npm run probar`.
 */

export const MINUTOS_INACTIVIDAD_DEFAULT = 60
/** Menos de 5 minutos echa a alguien mientras lee una pantalla. */
export const MINUTOS_INACTIVIDAD_MIN = 5
/** Un día entero: más que eso ya no es un cierre por inactividad. */
export const MINUTOS_INACTIVIDAD_MAX = 24 * 60

export const COOKIE_ACTIVIDAD = "cp-actividad"

/** Cuánto antes del cierre aparece el aviso «se cierra en…». */
export const SEGUNDOS_AVISO = 60

/** Los minutos que valen para un rol: lo guardado si es válido, si no el default. */
export function minutosEfectivos(guardado: unknown): number {
  if (typeof guardado !== "number" || !Number.isInteger(guardado)) return MINUTOS_INACTIVIDAD_DEFAULT
  if (guardado < MINUTOS_INACTIVIDAD_MIN || guardado > MINUTOS_INACTIVIDAD_MAX) return MINUTOS_INACTIVIDAD_DEFAULT
  return guardado
}

/**
 * Lo que escribe el usuario en Configuración → Roles. Vacío = volver al default (se guarda null,
 * no una copia del 60: si algún día cambia el default, el rol lo sigue).
 */
export function validarMinutos(
  texto: unknown,
): { ok: true; valor: number | null } | { ok: false; motivo: string } {
  if (texto === null || texto === undefined) return { ok: true, valor: null }
  const limpio = String(texto).trim()
  if (limpio === "") return { ok: true, valor: null }
  if (!/^\d+$/.test(limpio)) return { ok: false, motivo: "Escribí los minutos como un número entero (60 = 1 hora)." }
  const n = Number(limpio)
  if (n < MINUTOS_INACTIVIDAD_MIN || n > MINUTOS_INACTIVIDAD_MAX) {
    return {
      ok: false,
      motivo: `Tiene que ser entre ${MINUTOS_INACTIVIDAD_MIN} minutos y ${MINUTOS_INACTIVIDAD_MAX} (24 horas).`,
    }
  }
  return { ok: true, valor: n }
}

/** «60 min» → «1 hora», para que la tarjeta del rol se lea sin hacer la cuenta. */
export function textoMinutos(min: number): string {
  if (min % 60 === 0) {
    const h = min / 60
    return h === 1 ? "1 hora" : `${h} horas`
  }
  if (min > 60) return `${Math.floor(min / 60)} h ${min % 60} min`
  return `${min} min`
}

export type MarcaActividad = { sesion: string; ultima: number; minutos: number }

/** Formato de la cookie: `<sesión>.<última actividad en ms>.<minutos>`. */
export function valorCookieActividad(m: MarcaActividad): string {
  return `${m.sesion}.${Math.floor(m.ultima)}.${m.minutos}`
}

export function leerCookieActividad(valor: string | undefined | null): MarcaActividad | null {
  if (!valor) return null
  const partes = valor.split(".")
  if (partes.length !== 3) return null
  const [sesion, u, m] = partes
  const ultima = Number(u)
  const minutos = Number(m)
  if (!sesion || !Number.isFinite(ultima) || !Number.isFinite(minutos)) return null
  return { sesion, ultima, minutos: minutosEfectivos(minutos) }
}

/**
 * Milisegundos que le quedan a la sesión antes del cierre. `null` = no hay nada que controlar
 * (sin marca, o la marca es de otra sesión: la pantalla la va a reescribir apenas cargue).
 */
export function msRestantes(
  valor: string | undefined | null,
  sesionActual: string | null,
  ahora: number,
): number | null {
  const m = leerCookieActividad(valor)
  if (!m || !sesionActual || m.sesion !== sesionActual) return null
  return m.ultima + m.minutos * 60_000 - ahora
}

export function sesionVencida(valor: string | undefined | null, sesionActual: string | null, ahora: number): boolean {
  const r = msRestantes(valor, sesionActual, ahora)
  return r !== null && r <= 0
}

/**
 * La sesión de Supabase a la que pertenece un access token (claim `session_id`). No valida la
 * firma: sólo se usa para saber si la marca es de esta sesión, y la validez del usuario ya la
 * comprobó `getUser()` antes.
 */
export function sesionDelToken(accessToken: string | undefined | null): string | null {
  if (!accessToken) return null
  const partes = accessToken.split(".")
  if (partes.length < 2) return null
  try {
    const b64 = partes[1].replace(/-/g, "+").replace(/_/g, "/")
    const json = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)))
    return typeof json?.session_id === "string" && json.session_id ? json.session_id : null
  } catch {
    return null
  }
}
