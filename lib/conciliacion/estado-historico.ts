/**
 * 📜 MOVIMIENTOS HISTÓRICOS DEL EXTRACTO — A-DEC-1009 / A-DAT-68 (2026-10-15).
 *
 * El extracto de MSA de jul-2025 → ene-2026 se carga **entero** como histórico (decisión del usuario:
 * *«así no alteramos la manera en que la app trabaja… cargaríamos template y pago»*). Cada movimiento
 * entra **sin clasificar** y se clasifica después, de a lotes por CATEG.
 *
 * Un movimiento histórico:
 * - **no es pendiente**: el motor de conciliación sólo toma `pendiente`, así que nunca lo va a querer
 *   vincular contra el Cash Flow de hoy;
 * - **no tiene categoría** hasta que se revisa su lote: el dashboard y los papeles 8 y 9 descartan lo
 *   que no tiene `categ`, así que **no aparece en ningún número**. Sólo aporta su saldo a la cadena;
 * - cuando su lote se aprueba, se vincula a su cuota y pasa a `conciliado`, como cualquier otro.
 */
export const ESTADO_HISTORICO = 'historico'

/** ¿El movimiento es del extracto histórico (cargado sin clasificar)? */
export function esHistorico(estado: string | null | undefined): boolean {
  return String(estado ?? '').trim().toLowerCase() === ESTADO_HISTORICO
}

/**
 * 🧮 Los contadores de la pantalla del extracto. Los históricos se cuentan **aparte** y no inflan
 * «Sin CATEG» ni «sin revisar»: que un movimiento histórico no tenga categoría es su estado normal
 * hasta que se revisa su lote, no un pendiente de hoy.
 */
export function contarEstadisticasExtracto(filas: Array<{ estado?: string | null; categ?: string | null; revisado?: boolean | null }>) {
  const vivos = filas.filter(m => !esHistorico(m.estado))
  const est = (e: string) => filas.filter(m => String(m.estado ?? '').toLowerCase() === e).length
  return {
    total: filas.length,
    conciliados: est('conciliado'),
    pendientes: est('pendiente'),
    auditar: est('auditar'),
    historicos: filas.length - vivos.length,
    sin_categ: vivos.filter(m => !m.categ || m.categ === '').length,
    sin_revisar: vivos.filter(m => !m.revisado).length,
  }
}

/**
 * 🛡️ **Qué estado le queda a una cuota cuando el movimiento que la pagaba se desvincula.**
 *
 * Hasta acá volvía siempre a `pendiente`, y eso la hace reaparecer en el Cash Flow como una deuda a
 * pagar. Para una cuota **«anterior»** (el histórico jul-25 → ene-26, que ya se pagó y no va al Cash
 * Flow) eso es un error: desvincular a mano un movimiento histórico revivía un pago de hace meses.
 * Una cuota «anterior» **sigue siendo anterior** — el vínculo se suelta, el hecho de que se pagó no.
 */
export function estadoCuotaAlDesvincular(estadoActual: string | null | undefined): 'anterior' | 'pendiente' {
  return String(estadoActual ?? '').trim().toLowerCase() === 'anterior' ? 'anterior' : 'pendiente'
}
