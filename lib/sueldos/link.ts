/**
 * 🔗 **Link a LOS SUELDOS DE UNA PERSONA** (A-FEAT-1467, JMS 01/11: *«cuando el tema es un movimiento de AMS o Manuel,
 * uno solo a conciliar, me das link a ese movimiento pero me deberías dar también el link a ver la tira de eso: todos los
 * templates de esa campaña o, en este caso, los sueldos de AMS o Manuel»*).
 *
 * Abre Sueldos con el historial completo de esa persona (todos sus meses, 2025 incluido, con sus pagos).
 */
export const linkSueldosDe = (empleadoId: string) => `/?seccion=sueldos&empleado=${encodeURIComponent(empleadoId)}`

export function empleadoDelLink(search: string): string | null {
  const p = new URLSearchParams(search)
  return p.get("seccion") === "sueldos" ? p.get("empleado") : null
}
