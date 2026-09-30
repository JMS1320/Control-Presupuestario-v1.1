/**
 * 💰 **EL SUELDO SE CARGA POR TOTAL, Y A/B ES LA APERTURA** (A-FEAT-1211).
 *
 * Pedido del usuario 2026-09-30: *«para editar el sueldo pongo lo que cobra total y A, y calcula solo
 * B. Y en el caso de Sigot pongo lo que cobra él, lo que es la cuota alimentaria a Lucrecia, y eso es
 * el total. Luego pongo A y calcula B»*.
 *
 * ## 🔑 Por qué esto NO cambia ningún número
 *
 * Las dos fórmulas del sueldo `ab_francos` usan **la suma**, nunca A y B por separado:
 *
 * ```
 * bruto        = (A + B) + valor_franco × francos + extras
 * valor_franco = (A + B) / 25        ← cuando no hay override manual
 * ```
 *
 * Así que pasar de *«escribí A y B»* a *«escribí el total y A»* es un cambio de **cómo se ingresa**,
 * no de cómo se calcula: **el bruto de todos los períodos queda idéntico**. A y B siguen guardándose
 * porque son la apertura del convenio, que se informa.
 *
 * 🔢 **Y la prueba de que el total es el dato verdadero**: los valores de Sigot son
 * **A 1.408.347,10 + B 191.652,90 = $1.600.000 justos**. El total es redondo porque el total es lo
 * que se acuerda; A sale de la escala y B es el resto.
 *
 * ## 📌 Qué es el «total» en el caso de Sigot, que conviene no perder
 *
 * **No es sólo lo que él cobra**: incluye **la cuota alimentaria a Lucrecia**, que se paga a otra
 * cuenta pero **es parte del mismo sueldo**. El reparto entre destinos es otro tema
 * (`A-FEAT-1212`): acá se define **cuánto es**, no **a quién se le transfiere**.
 */

/** El reparto de un total entre las dos categorías del convenio. */
export interface RepartoAB {
  total: number
  /** Lo que viene de la escala del convenio. Lo escribe el usuario. */
  a: number
  /** `total − a`. **Derivado**: no se escribe. */
  b: number
  /**
   * 🛑 `true` si `a` supera el total, o sea que `b` daría **negativo**.
   *
   * No se corrige solo ni se recorta a cero: **se avisa y no se guarda**. Un B negativo es una
   * contradicción interna —las partes no pueden sumar más que el todo—, así que frena
   * (§ 🚦 de `CLAUDE.md`: *frena sólo lo que delata un error del sistema*).
   */
  invalido: boolean
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Reparte el total entre A (dado) y B (la resta). */
export function repartirTotalEnAB(total: number, a: number): RepartoAB {
  const b = r2(total - a)
  return { total: r2(total), a: r2(a), b, invalido: b < 0 }
}

/**
 * El valor de un franco cuando no hay override manual.
 *
 * 📌 Es `total / 25`, que es **exactamente** el `(A + B) / 25` de antes. Se expresa con el total
 * porque ahora el total es el campo que se escribe, y así se ve que el número no cambió.
 */
export const valorFrancoDeTotal = (total: number): number => r2(total / 25)
