import { RECURSOS } from "@/lib/auth/recursos"

/**
 * 🔒 ROL CERRADO — lo nuevo nace apagado para el delegado (A-FEAT-1333, etapa 2 de A-FEAT-1322).
 *
 * Un rol guarda en `permisos` una lista por recurso, y cómo se lee esa lista depende del rol:
 *
 *   · **Abierto** (todos los roles de hoy): la lista dice lo que se le SACA. Lo que no figura se ve
 *     y se edita. Una pestaña que se agregue mañana le aparece sola. Es lo de siempre.
 *   · **Cerrado** (`public.roles.cerrado`, `scripts/99`): la lista dice lo que se le DA. Lo que no
 *     figura, no se ve. Una pestaña que se registre mañana **nace apagada** para ese rol hasta que
 *     el usuario la tilde. Es lo que pidió para Ulises: *«no debe cambiar hasta darle click»*.
 *
 * Todo pasa por acá: la pantalla, el guard de las rutas y Configuración reciben el mapa EFECTIVO
 * (`nivelesEfectivos`), así que ninguno de ellos necesita saber si el rol es abierto o cerrado.
 *
 * ⚠️ «Lo nuevo» es lo que se REGISTRA en `lib/auth/recursos.ts`. El control
 * `npm run verificar:recursos` es el que obliga a registrar cada solapa nueva; sin ese control, una
 * solapa sin registrar se seguiría viendo en un rol cerrado. Las secciones ya eran cerradas: un rol
 * ve sólo las que tiene tildadas.
 *
 * Pieza pura (sin base): la prueba `npm run probar`.
 */
export type NivelRol = "ninguno" | "lectura" | "escritura"

type RolConPermisos = {
  secciones: string[]
  permisos: Record<string, string>
  cerrado?: boolean
}

/** Los recursos registrados de las secciones que tiene el rol. */
function recursosDeSecciones(secciones: string[]): string[] {
  const tiene = new Set(secciones)
  return RECURSOS.filter((r) => tiene.has(r.seccion)).map((r) => r.id)
}

/**
 * Lo que de verdad ve el rol, en la forma de siempre: un mapa de EXCEPCIONES donde lo que no figura
 * es «ve y edita». Para un rol abierto es su lista tal cual; para uno cerrado, todo lo registrado de
 * sus secciones que no tiene tildado queda en «ninguno».
 */
export function nivelesEfectivos(rol: RolConPermisos): Record<string, NivelRol> {
  const permisos = (rol.permisos ?? {}) as Record<string, NivelRol>
  if (!rol.cerrado) return permisos
  const efectivos: Record<string, NivelRol> = {}
  for (const id of recursosDeSecciones(rol.secciones)) efectivos[id] = permisos[id] ?? "ninguno"
  return efectivos
}

/**
 * Para la pantalla de Roles: las excepciones como las edita (lo que no figura = ve y edita). Así la
 * pantalla funciona igual con los dos tipos de rol.
 */
export function excepcionesParaEditar(rol: RolConPermisos): Record<string, NivelRol> {
  const efectivos = nivelesEfectivos(rol)
  const excepciones: Record<string, NivelRol> = {}
  for (const [id, nivel] of Object.entries(efectivos)) if (nivel !== "escritura") excepciones[id] = nivel
  return excepciones
}

/**
 * Lo que se guarda en `public.roles.permisos`, a partir de las excepciones que manda la pantalla.
 *
 *   · Abierto: las excepciones de las secciones que tiene, sin «escritura» (es lo que se hereda).
 *   · Cerrado: lo que SÍ ve, con su nivel. Lo que hoy está registrado y destildado no se guarda, y lo
 *     que se registre después tampoco va a estar: por eso nace apagado.
 *
 * Pasar de un modo al otro con esto no cambia nada de lo que el rol ve en ese momento: cambia sólo
 * qué le pasa a lo que se agregue después.
 */
export function permisosAGuardar(
  excepciones: Record<string, string>,
  secciones: string[],
  cerrado: boolean,
): Record<string, NivelRol> {
  const guardar: Record<string, NivelRol> = {}
  if (!cerrado) {
    const tiene = new Set(secciones)
    for (const [id, nivel] of Object.entries(excepciones)) {
      if (nivel === "escritura") continue
      if (tiene.has(id.split(".")[0])) guardar[id] = nivel as NivelRol
    }
    return guardar
  }
  for (const id of recursosDeSecciones(secciones)) {
    const nivel = (excepciones[id] ?? "escritura") as NivelRol
    if (nivel !== "ninguno") guardar[id] = nivel
  }
  return guardar
}
