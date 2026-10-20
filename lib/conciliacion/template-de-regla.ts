/**
 * 🎯 **A QUÉ TEMPLATE CARGA UNA REGLA** (A-FEAT-1293, 2026-10-19).
 *
 * El usuario elige el template en la regla (*«yo trabajo con los templates, no con las cuentas»*). Pero
 * un template con campaña se **renueva**: cada año/campaña es otro renglón con el mismo nombre y
 * responsable (Seguro Flota 25/26 → 26/27). Si la regla quedara clavada al renglón que se eligió, al
 * renovarse seguiría cargando en la campaña vieja.
 *
 * > **La regla apunta a una FAMILIA (nombre + responsable). Se carga en el renglón cuya campaña
 * > corresponde a la fecha del movimiento.**
 *
 * ⚠️ *Cambió 2026-10-20 (A-DEC-1015)*: si esa campaña **no existe**, antes cargaba en el elegido — y una
 * cuota de Orbith de 2025 caía en la campaña 2026, sin aviso. Ahora eso sólo vale para los **cargos del
 * banco** (`solo_conciliacion`: comisión, IVA, percepción), que no se presupuestan por campaña. Para el
 * resto no se carga: el motor deja el movimiento en auditar diciendo qué campaña falta.
 *
 * ⚠️ *Y 2026-10-20 (A-DEC-1016)*: un template **abierto no tiene campaña** (*«la campaña sólo sirve
 * para generar las cuotas al futuro»*); se vació en 60. Sin campaña → carga en el elegido, siempre.
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
  solo_conciliacion?: boolean | null
}

const norm = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase()

/** Los de la misma familia que el elegido: mismo nombre y mismo responsable. */
export const esDeLaFamilia = (elegido: TemplateDeFamilia, t: TemplateDeFamilia) =>
  norm(t.nombre_referencia) === norm(elegido.nombre_referencia) && norm(t.responsable) === norm(elegido.responsable)

/** La campaña que le corresponde a `fecha` en la familia del elegido («2025», «25/26»…). */
export function campanaParaFecha(elegido: TemplateDeFamilia, fecha: string): string {
  // Muchos templates viejos no tienen `periodicidad`: se deduce del formato de su campaña («25/26» = jul–jun).
  const periodicidad: Periodicidad = elegido.periodicidad === "bianual" || (!elegido.periodicidad && String(elegido.año ?? "").includes("/"))
    ? "bianual" : "anual"
  return campanaDeFecha(periodicidad, fecha)
}

/**
 * Elige el renglón: entre los ACTIVOS de la familia, el de la campaña de `fecha`. Si no existe:
 * - un **cargo del banco** (`solo_conciliacion`) o un template **sin campaña** carga en el elegido;
 * - cualquier otro → `null`: el motor no inventa, deja el movimiento en auditar (A-DEC-1015).
 */
export function templateParaFecha(
  elegido: TemplateDeFamilia,
  candidatos: TemplateDeFamilia[],
  fecha: string,
): TemplateDeFamilia | null {
  const familia = candidatos.filter(t => t.activo !== false && esDeLaFamilia(elegido, t))
  const campana = campanaParaFecha(elegido, fecha)
  const deLaCampana = familia.find(t => norm(t.año) === norm(campana))
  if (deLaCampana) return deLaCampana
  const sinCampana = !String(elegido.año ?? "").trim()
  if (elegido.activo !== false && (elegido.solo_conciliacion || sinCampana)) return elegido
  return null
}

/** El motivo de auditar cuando falta la campaña (A-DEC-1015). */
export function motivoFaltaCampana(elegido: TemplateDeFamilia, fecha: string): string {
  return `Falta la campaña ${campanaParaFecha(elegido, fecha)} de «${elegido.nombre_referencia}» (${elegido.responsable ?? "?"}): `
    + `creala con el botón «📅 Crear campaña» de esta fila. No se cargó ninguna cuota.`
}

/**
 * 🔙 A-FEAT-1302 punto 3 — de un motivo «Falta la campaña…» saca qué falta (campaña, nombre, responsable),
 * para que el auditar ofrezca crearla ahí mismo. Si el motivo es otro, `null`.
 */
export function faltaCampanaDelMotivo(motivo: string | null | undefined): { campana: string; nombre: string; responsable: string } | null {
  const m = /^Falta la campaña (\S+) de «(.+)» \(([^)]*)\)/.exec(String(motivo ?? ""))
  return m ? { campana: m[1], nombre: m[2], responsable: m[3] } : null
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

/**
 * ✍️ A-DEC-1012 (a) — el detalle que el usuario escribió en una regla NUEVA (que elige template) se copia
 * siempre, aunque repita la cuenta: desde el 19/10 la cuenta es el nombre del template y repetirlo es lo
 * común (Chubb → «Seguro Chalet»). Usuario: *«ok, porque es una regla»*. Las reglas VIEJAS (sin template)
 * siguen con A-FEAT-138: 60 de 68 traían el detalle = cuenta por default, y ése no aporta.
 */
export function detalleDeRegla(regla: { detalle?: string | null; categ?: string | null; template_id?: string | null }): string | null {
  const d = (regla.detalle ?? "").trim()
  if (!d) return null
  if (regla.template_id) return d
  return d.toLowerCase() === (regla.categ ?? "").trim().toLowerCase() ? null : d
}
