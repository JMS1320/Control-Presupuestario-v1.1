/**
 * 🔀 EL ORDEN Y EL NOMBRE DE LOS RENGLONES DEL DASHBOARD — A-FEAT-1637 (JMS 22/11).
 *
 * Una sola pieza para la pantalla, la impresión y el PDF (§ ♻️ centralizar: si cada uno ordenara a su manera, el papel no
 * coincidiría con la pantalla):
 *   · «estaría bueno poder reubicar dentro del dashboard y que se quede guardado ese orden, tal como hice para partidas»:
 *     el orden de las agrupadoras de cada sección lo deja el usuario arrastrando, y se guarda en sus preferencias
 *     (`ordenDashboard`, claves `seccion:agrupadora`). Lo que no está en su orden va después, por nombre; los grupos
 *     especiales «(Sin agrupar)» / «(Sin clasificar)» siempre al final.
 *   · «estos casos, idealmente mostrar el nombre de la agrupadora y entre paréntesis el del template, y no tener
 *     desplegable porque es una sola»: un grupo con UNA sola cuenta va en un renglón, «Agrupadora (cuenta)».
 * Pura: la prueba `npm run probar`.
 */
import { moverColumna } from "@/lib/cashflow/columnas-usuario"

const especial = (a: string) => a.startsWith("(")
const porNombre = (a: string, b: string) => (especial(a) !== especial(b) ? (especial(a) ? 1 : -1) : a.localeCompare(b, "es"))

export const claveOrden = (seccion: string, agrupadora: string) => `${seccion}:${agrupadora}`

/** Las agrupadoras de una sección en el orden del usuario (los especiales al final). */
export function ordenarAgrupadoras(seccion: string, agrupadoras: Iterable<string>, orden: readonly string[] | null | undefined): string[] {
  const base = [...new Set(agrupadoras)].sort(porNombre)
  const normales = base.filter(a => !especial(a)), especiales = base.filter(especial)
  // Primero lo que la persona ordenó (en su orden); después lo que nunca movió, por nombre. (`ordenarColumnas` del Cash Flow
  // vuelve a meter lo no ordenado en su lugar natural, que acá desarmaba el orden: lo atrapó el caso.)
  const pos = new Map((orden ?? []).map((k, i) => [k, i]))
  const enOrden = normales.filter(a => pos.has(claveOrden(seccion, a))).sort((a, b) => pos.get(claveOrden(seccion, a))! - pos.get(claveOrden(seccion, b))!)
  const resto = normales.filter(a => !pos.has(claveOrden(seccion, a)))
  return [...enOrden, ...resto, ...especiales]
}

/** El orden nuevo (completo, todas las secciones) después de soltar `desde` antes o después de `hasta`, en la misma sección. */
export function moverAgrupadora(ordenActual: readonly string[] | null | undefined, seccion: string, visibles: readonly string[], desde: string, hasta: string, lado: "antes" | "despues"): string[] {
  const claves = visibles.filter(a => !especial(a)).map(a => claveOrden(seccion, a))
  const movidas = moverColumna(claves, claveOrden(seccion, desde), claveOrden(seccion, hasta), lado)
  // Lo de las otras secciones (y lo guardado que hoy no se ve) se conserva, después de lo de esta sección.
  const resto = (ordenActual ?? []).filter(k => !movidas.includes(k))
  return [...movidas, ...resto]
}

/** El rótulo del grupo: con UNA sola cuenta de otro nombre, «Agrupadora (cuenta)» y sin desplegable. */
export function rotuloAgrupadora(agrupadora: string, subs: readonly string[]): { texto: string; desplegable: boolean } {
  if (subs.length > 1) return { texto: agrupadora, desplegable: true }
  if (subs.length === 1 && subs[0] !== agrupadora) return { texto: `${agrupadora} (${subs[0]})`, desplegable: false }
  return { texto: agrupadora, desplegable: false }
}
