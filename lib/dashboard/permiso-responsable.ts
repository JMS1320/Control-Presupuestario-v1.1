/**
 * 🔒 ¿Quién puede pedir la vista «Por responsable» a la ruta del servidor? — A-FEAT-1637 (B3). Pura (la prueba `npm run probar`).
 *
 * Admin siempre (la configura y la mira «como la ve ella»). Otro rol: con la sección Dashboard y los DOS candados prendidos —
 * `dashboard.por-responsable` (la vista) y `dashboard.empresa-ma` (lo de MA) —, como los bloques de la pantalla de MA. Lo que recibe
 * es siempre sólo lo de MA (`resultadoParaRuta(…, soloMA = true)`).
 */
export const RECURSOS_POR_RESPONSABLE = ["dashboard.por-responsable", "dashboard.empresa-ma"] as const

export function puedeVerPorResponsable(rol: string | null, secciones: string[], niveles: Record<string, string>): boolean {
  if (rol === "admin") return true
  if (!rol || !secciones.includes("dashboard")) return false
  // Misma regla que la pantalla (`usePuedeVer`): en un rol CERRADO lo no tildado viene «ninguno»; en uno abierto lo que no figura
  // hereda de la sección. Así el selector y la ruta dicen lo mismo.
  return RECURSOS_POR_RESPONSABLE.every(r => (niveles[r] ?? "escritura") !== "ninguno")
}

/**
 * 👥 Con qué vista abre el Dashboard (JMS 22/11: para MA «que se abra por default en Por responsable», y que pueda pasar a «Por caja»;
 * admin sigue abriendo en «Por caja»). Manda la última elección de la persona (sus preferencias); sin elección, la de su rol. Si no
 * tiene el candado de la vista, siempre «Por caja».
 */
export function vistaInicialDashboard(rol: string | null | undefined, guardada: "caja" | "responsable" | null | undefined, puedeResponsable: boolean): "caja" | "responsable" {
  if (!puedeResponsable) return "caja"
  if (guardada) return guardada
  return rol === "admin" ? "caja" : "responsable"
}
