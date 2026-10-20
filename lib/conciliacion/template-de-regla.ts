/**
 * 🎯 **A QUÉ TEMPLATE CARGA UNA REGLA** (A-FEAT-1293, 2026-10-19).
 *
 * El usuario elige el template en la regla (*«yo trabajo con los templates, no con las cuentas»*). Pero
 * un template con campaña se **renueva**: cada año/campaña es otro renglón con el mismo nombre y
 * responsable (Seguro Flota 25/26 → 26/27). Si la regla quedara clavada al renglón que se eligió, al
 * renovarse seguiría cargando en la campaña vieja.
 *
 * > **La regla apunta a una FAMILIA (nombre + responsable). Se carga en el renglón cuya campaña
 * > corresponde a la fecha del movimiento; si no hay, en el elegido.**
 *
 * La campaña de la fecha sale de `campanaDeFecha` (la misma que usa el alta desde la conciliación).
 */
import { campanaDeFecha, type Periodicidad } from "@/lib/templates/nuevo-desde-conciliacion"

export interface TemplateDeFamilia {
  id: string
  nombre_referencia: string
  responsable: string | null
  año: string | null
  periodicidad?: string | null
  activo?: boolean | null
}

const norm = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase()

/** Los de la misma familia que el elegido: mismo nombre y mismo responsable. */
export const esDeLaFamilia = (elegido: TemplateDeFamilia, t: TemplateDeFamilia) =>
  norm(t.nombre_referencia) === norm(elegido.nombre_referencia) && norm(t.responsable) === norm(elegido.responsable)

/**
 * Elige el renglón: entre los ACTIVOS de la familia, el de la campaña de `fecha`; si ninguno, el elegido
 * si está activo; si tampoco, `null` (el motor no inventa: avisa y no carga).
 */
export function templateParaFecha(
  elegido: TemplateDeFamilia,
  candidatos: TemplateDeFamilia[],
  fecha: string,
): TemplateDeFamilia | null {
  const familia = candidatos.filter(t => t.activo !== false && esDeLaFamilia(elegido, t))
  // Muchos templates viejos no tienen `periodicidad`: se deduce del formato de su campaña («25/26» = jul–jun).
  const periodicidad: Periodicidad = elegido.periodicidad === "bianual" || (!elegido.periodicidad && String(elegido.año ?? "").includes("/"))
    ? "bianual" : "anual"
  const campana = campanaDeFecha(periodicidad, fecha)
  const deLaCampana = familia.find(t => norm(t.año) === norm(campana))
  if (deLaCampana) return deLaCampana
  if (elegido.activo !== false) return elegido
  return null
}

/**
 * 🗂️ A-BUG-1300 — en una lista de templates, los renglones de la MISMA familia (renovación de campaña)
 * van con la campaña más nueva primero. El resto conserva su orden (comparador estable: 0).
 */
export const campanaNuevaPrimero = (a: TemplateDeFamilia, b: TemplateDeFamilia): number =>
  esDeLaFamilia(a, b) ? String(b.año ?? "").localeCompare(String(a.año ?? "")) : 0

/**
 * 📅 A-BUG-1303 — para ELEGIR en una regla, un renglón por familia (la campaña más nueva). La regla sigue
 * a la familia (`templateParaFecha`), así que elegir 25/26 o 26/27 da lo mismo; mostrar las dos hacía
 * parecer que la regla quedaba clavada a una campaña (usuario: *«eso va cambiando»*).
 */
export function unoPorFamilia<T extends TemplateDeFamilia>(lista: T[]): T[] {
  // Sin `sort`: `campanaNuevaPrimero` no ordena entre familias distintas. Se elige el mejor de cada una
  // y se respeta el orden en que aparece la familia por primera vez.
  const mejor = new Map<string, T>()
  for (const t of lista) {
    const k = `${norm(t.nombre_referencia)}|${norm(t.responsable)}`
    const actual = mejor.get(k)
    if (!actual || String(t.año ?? "").localeCompare(String(actual.año ?? "")) > 0) mejor.set(k, t)
  }
  return [...mejor.values()]
}
