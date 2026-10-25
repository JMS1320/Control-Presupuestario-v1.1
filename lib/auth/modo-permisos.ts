import { RECURSOS, SECCIONES } from "@/lib/auth/recursos"
import { excepcionesParaEditar, type NivelRol } from "@/lib/auth/rol-cerrado"

/**
 * 🖱️ MODO PERMISOS — prender sobre la pantalla lo que ve un rol (A-FEAT-1334).
 *
 * Pedido del usuario 2026-10-24: elegir los permisos **apretando sobre la app** en vez de en una
 * lista, y en el sentido de **PRENDER**: *«¿por qué decís de apagar si yo hablo de prender?»*. El
 * caso es Ulises: se le arma un rol cerrado y vacío, y el admin recorre la app prendiendo lo que le
 * da. Lo que el rol no tiene se ve atenuado con un candado.
 *
 * El borrador vive en la pantalla y se guarda con el MISMO endpoint que Configuración → Roles
 * (`PATCH /api/admin/roles`), así que no hay un segundo camino de escritura.
 *
 * Pieza pura (sin base): la prueba `npm run probar`.
 */
export type Borrador = {
  secciones: string[]
  /** Como las edita Configuración → Roles: lo que no figura = ve y edita. */
  excepciones: Record<string, NivelRol>
  cerrado: boolean
}

export type RolParaModo = {
  secciones: string[]
  permisos: Record<string, string>
  cerrado?: boolean
}

const ORDEN_SECCIONES = SECCIONES.map((s) => s.id)

function ordenar(secciones: string[]): string[] {
  return ORDEN_SECCIONES.filter((s) => secciones.includes(s))
}

/** El borrador inicial: lo que el rol ve hoy. */
export function borradorDe(rol: RolParaModo): Borrador {
  return {
    secciones: ordenar(rol.secciones ?? []),
    excepciones: excepcionesParaEditar({ ...rol, permisos: rol.permisos ?? {} }),
    cerrado: Boolean(rol.cerrado),
  }
}

export function tieneSeccion(b: Borrador, seccion: string): boolean {
  return b.secciones.includes(seccion)
}

/** El nivel de un recurso en el borrador. Sin su sección, no lo ve. */
export function nivelEnBorrador(b: Borrador, recurso: string): NivelRol {
  if (!tieneSeccion(b, recurso.split(".")[0])) return "ninguno"
  return b.excepciones[recurso] ?? "escritura"
}

/** Las excepciones sin las de una sección (al quitarla no tiene que quedar nada colgado). */
function sinLaSeccion(excepciones: Record<string, NivelRol>, seccion: string): Record<string, NivelRol> {
  const out: Record<string, NivelRol> = {}
  for (const [id, n] of Object.entries(excepciones)) if (id.split(".")[0] !== seccion) out[id] = n
  return out
}

/**
 * Prender o apagar una sección del menú.
 *
 * ⚠️ En un rol CERRADO, prender una sección **no prende lo de adentro**: sus solapas y botones
 * arrancan apagados y se prenden uno por uno. Es el mismo criterio del rol cerrado (lo que no se
 * eligió no se ve) — si no, prender «Extracto» le daría también Importar y Auditoría sin que nadie
 * lo decidiera. En un rol abierto, como siempre: la sección entra con todo.
 */
export function alternarSeccion(b: Borrador, seccion: string): Borrador {
  if (tieneSeccion(b, seccion)) {
    return { ...b, secciones: b.secciones.filter((s) => s !== seccion), excepciones: sinLaSeccion(b.excepciones, seccion) }
  }
  const excepciones = sinLaSeccion(b.excepciones, seccion)
  if (b.cerrado) for (const r of RECURSOS) if (r.seccion === seccion) excepciones[r.id] = "ninguno"
  return { ...b, secciones: ordenar([...b.secciones, seccion]), excepciones }
}

/**
 * Prender o apagar una solapa o un botón.
 *
 * Prender algo que cuelga de otra cosa apagada prende también lo de arriba (la sección, y la solapa
 * padre si es una sub-solapa): si no, quedaría «prendido» algo a lo que no se puede llegar.
 * Apagar no toca lo de abajo: un hijo prendido debajo de un padre apagado no se ve, y al volver a
 * prender el padre reaparece como estaba.
 */
export function alternarRecurso(b: Borrador, recurso: string): Borrador {
  const actual = nivelEnBorrador(b, recurso)
  if (actual !== "ninguno") {
    return { ...b, excepciones: { ...b.excepciones, [recurso]: "ninguno" } }
  }
  let nuevo = b
  const seccion = recurso.split(".")[0]
  if (!tieneSeccion(nuevo, seccion)) nuevo = alternarSeccion(nuevo, seccion)
  const padre = RECURSOS.find((r) => r.id === recurso)?.padre
  const excepciones = { ...nuevo.excepciones }
  delete excepciones[recurso]
  if (padre && excepciones[padre] === "ninguno") delete excepciones[padre]
  return { ...nuevo, excepciones }
}

/** Cuántas cosas cambian respecto de lo guardado: secciones + solapas/botones con otro nivel. */
export function contarCambios(original: Borrador, b: Borrador): number {
  let n = 0
  for (const s of ORDEN_SECCIONES) if (tieneSeccion(original, s) !== tieneSeccion(b, s)) n++
  for (const r of RECURSOS) {
    if (!tieneSeccion(original, r.seccion) && !tieneSeccion(b, r.seccion)) continue
    if (nivelEnBorrador(original, r.id) !== nivelEnBorrador(b, r.id)) n++
  }
  return n
}

/**
 * Lo que se le manda a `PATCH /api/admin/roles`. Las excepciones van completas (incluido
 * «ninguno»): en un rol cerrado el endpoint toma lo que falta como «ve y edita», así que lo apagado
 * tiene que viajar explícito. El modo (abierto/cerrado) no se manda: acá no se cambia.
 */
export function cuerpoGuardar(id: string, b: Borrador) {
  const permisos: Record<string, NivelRol> = {}
  for (const [rid, n] of Object.entries(b.excepciones)) if (tieneSeccion(b, rid.split(".")[0])) permisos[rid] = n
  return { id, secciones: b.secciones, permisos }
}
