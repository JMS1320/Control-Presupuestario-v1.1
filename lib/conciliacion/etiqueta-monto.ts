/**
 * 🏷️ **A-BUG-169 — «Monto exacto» tiene que querer decir exacto.**
 *
 * La propuesta de conciliación manual etiquetaba así:
 *
 * ```ts
 * const label = matchMontoCercano || diffAbs <= 2 ? 'Monto exacto' : 'Monto ≈'
 * ```
 *
 * `matchMontoCercano` es **±5%**, así que un candidato con **$1.700 de diferencia** se anunciaba
 * como *exacto*. Lo vio el usuario el 2026-09-13 conciliando un pago de I.C.T. NET: le ofrecía
 * `BAILO ANDRES` con el cartel **«Monto exacto»** y difería **$2,19**.
 *
 * 🧨 **Es peor que ordenar mal.** Proponer un candidato flojo es una molestia: se mira y se
 * descarta. **Afirmar que es exacto cuando no lo es invita a aceptarlo sin mirar** — y una
 * conciliación equivocada es un dato falso que después nadie vuelve a revisar.
 *
 * 🔑 La regla queda en una línea: **exacto es diferencia CERO. Todo lo demás muestra el número.**
 * El usuario decide igual si le sirve, pero decide **sabiendo cuánto** se aparta.
 */

/** Un peso de diferencia se considera cero: los importes vienen con 2 decimales. */
const CERO = 0.005

export interface EtiquetaMonto {
  texto: string
  /** `true` sólo cuando la diferencia es cero. Lo usa el color: verde sólo si es exacto. */
  exacto: boolean
}

/**
 * Cómo se anuncia la diferencia entre lo que pagó el banco y lo que vale el candidato.
 *
 * - sin diferencia → `Monto exacto`
 * - hasta $100 → el peso de diferencia: `≈ $2,19`
 * - más → el porcentaje: `≈ 4,8%`
 *
 * 📌 **Por qué pesos abajo y porcentaje arriba**: con importes chicos un 3% no dice nada
 * (`≈ 3%` sobre $600 son 18 pesos), y con importes grandes el peso tampoco (`≈ $40.000` sobre
 * 2 millones es 2%). Cada escala se lee mejor en su unidad.
 */
export function etiquetaMonto(montoMovimiento: number, montoCandidato: number): EtiquetaMonto {
  const dif = Math.abs((montoCandidato || 0) - (montoMovimiento || 0))
  if (dif < CERO) return { texto: 'Monto exacto', exacto: true }

  if (dif <= 100) {
    return { texto: `≈ $${dif.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, exacto: false }
  }
  const rel = montoMovimiento > 0 ? (dif / montoMovimiento) * 100 : 100
  return { texto: `≈ ${rel.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`, exacto: false }
}
