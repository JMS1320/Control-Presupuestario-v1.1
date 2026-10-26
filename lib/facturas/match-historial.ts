/**
 * 🔎 **El MATCH de una factura sin cuenta sale del HISTORIAL del proveedor**, no del filtro de la pantalla.
 *
 * Usuario 2026-10-26: *«el match es sobre todo el historial, el filtro es para trabajar tandas. Me debería
 * mostrar el match»*. Antes el estado comparaba sólo el nombre de cuenta que traía la factura contra el plan:
 * una factura sin nombre quedaba siempre «Sin match», aunque su proveedor tuviera 20 facturas imputadas.
 *
 * Ahora, para una factura sin cuenta:
 * - se juntan las cuentas que ese CUIT ya tiene en TODO el historial (facturas de la app con cuenta + el
 *   histórico del contador), sólo las que están en el plan;
 * - se suma la cuenta cuyo nombre trae la factura, si está en el plan;
 * - **una sola** → «Match» (se puede auto-asignar) · **varias** → «Ambiguo» (se elige a mano, ordenadas por uso) ·
 *   **ninguna** → «Sin match».
 *
 * Vale igual para notas de crédito y débito: toman la cuenta de su proveedor (A-FEAT-1375, mientras no exista
 * un vínculo guardado nota ↔ factura).
 */
export type EstadoMatch = "asignado" | "unico" | "ambiguo" | "sin_match"

export interface CuentaDelPlanMatch {
  categ: string
  nro_cuenta: string | null
}

export interface Candidata extends CuentaDelPlanMatch {
  usos: number
  fuente: "historial" | "nombre de la factura"
}

export interface ResultadoMatch {
  estado: EstadoMatch
  /** La cuenta a asignar si el estado es «unico». */
  sugerida: CuentaDelPlanMatch | null
  /** Todas, de más usada a menos. */
  candidatas: Candidata[]
}

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()
export const cuitNormalizado = (s: unknown) => String(s ?? "").replace(/\D/g, "")

/** CUIT → (cuenta del plan → veces usada). Sólo filas con cuenta que exista en el plan. */
export function armarHistorialPorCuit(
  filas: ReadonlyArray<{ cuit: string | null | undefined; cuenta: string | null | undefined; nro_cuenta?: string | null }>,
  plan: readonly CuentaDelPlanMatch[],
): Map<string, Map<string, number>> {
  const porNombre = new Map(plan.map(c => [norm(c.categ), c]))
  const porNro = new Map(plan.filter(c => c.nro_cuenta).map(c => [String(c.nro_cuenta), c]))
  const h = new Map<string, Map<string, number>>()
  for (const f of filas) {
    const cuit = cuitNormalizado(f.cuit)
    if (!cuit) continue
    const c = porNombre.get(norm(f.cuenta)) ?? (f.nro_cuenta ? porNro.get(String(f.nro_cuenta)) : undefined)
    if (!c) continue
    const m = h.get(cuit) ?? new Map<string, number>()
    m.set(c.categ, (m.get(c.categ) ?? 0) + 1)
    h.set(cuit, m)
  }
  return h
}

export function matchPorHistorial(
  factura: { cuit: string | null | undefined; cuenta_contable: string | null | undefined; nro_cuenta: string | null | undefined },
  historial: Map<string, Map<string, number>>,
  plan: readonly CuentaDelPlanMatch[],
): ResultadoMatch {
  if (factura.nro_cuenta) return { estado: "asignado", sugerida: null, candidatas: [] }
  const porNombre = new Map(plan.map(c => [norm(c.categ), c]))
  const cands = new Map<string, Candidata>()
  for (const [categ, usos] of historial.get(cuitNormalizado(factura.cuit)) ?? []) {
    const c = porNombre.get(norm(categ))
    if (c) cands.set(c.categ, { ...c, usos, fuente: "historial" })
  }
  const delNombre = porNombre.get(norm(factura.cuenta_contable))
  if (delNombre && !cands.has(delNombre.categ)) cands.set(delNombre.categ, { ...delNombre, usos: 0, fuente: "nombre de la factura" })
  const candidatas = [...cands.values()].sort((a, b) => b.usos - a.usos || a.categ.localeCompare(b.categ))
  if (candidatas.length === 0) return { estado: "sin_match", sugerida: null, candidatas }
  if (candidatas.length === 1) return { estado: "unico", sugerida: { categ: candidatas[0].categ, nro_cuenta: candidatas[0].nro_cuenta }, candidatas }
  return { estado: "ambiguo", sugerida: null, candidatas }
}
