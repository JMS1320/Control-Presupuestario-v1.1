/**
 * 🧠 **Qué pestañas quedan VIVAS (montadas y escondidas) al cambiar de pestaña** — A-FEAT-1378, paso 1.
 *
 * Usuario 2026-10-26: *«me molesta mucho cuando entro a la app y cambio cada pestaña»*. Las pestañas de
 * Radix desmontan lo que se deja: al volver, la pantalla arranca de cero y vuelve a bajar todo.
 *
 * Se guardan vivas las **últimas N visitadas** (no todas): esta PC tiene 8 GB y Cash Flow, Extracto y
 * Facturas son pesadas. La más vieja sale (se desmonta) cuando entra una nueva por encima del tope; si
 * se vuelve a ella, carga de nuevo como antes. Lo que nunca se visitó no se monta.
 */

/** La lista de vivas después de entrar a `activa`: la activa va al frente, sin repetir, con tope `max`. */
export function actualizarVivas(vivas: readonly string[], activa: string | undefined, max: number): string[] {
  if (!activa) return [...vivas]
  const resto = vivas.filter(v => v !== activa)
  return [activa, ...resto].slice(0, Math.max(1, max))
}

/** ¿Se dibuja esta pestaña? La activa siempre; las demás, sólo si están entre las vivas. */
export function debeMontarse(valor: string, activa: string | undefined, vivas: readonly string[]): boolean {
  return valor === activa || vivas.includes(valor)
}
