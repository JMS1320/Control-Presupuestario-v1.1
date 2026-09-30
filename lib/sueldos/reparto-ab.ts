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

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * 🧾 **LA CUOTA ALIMENTARIA ES PARTE DE A, NO UN EXTRA** (A-FEAT-1213).
 *
 * Precisión del usuario 2026-09-30, corrigiendo la lectura anterior:
 *
 * > *«Sigot es: se carga Lucrecia, se carga total A Sigot —Sigot antes de Lucrecia— y **eso da el A
 * > total**. Luego se carga total y eso calcula B.»*
 *
 * 🧨 **Lo que yo había entendido mal**: leí *«lo que cobra él + la cuota alimentaria = el total»* como
 * el total **del sueldo**. Es el total **de A**. El total del sueldo se carga aparte y B sale de la
 * resta, como ya estaba.
 *
 * Entonces para Sigot son **cuatro** números y sólo **tres** se escriben:
 *
 * | | Se escribe | Cómo sale |
 * |---|---|---|
 * | **Cuota alimentaria** (Lucrecia) | ✍️ sí | |
 * | **A de Sigot** (antes de Lucrecia) | ✍️ sí | |
 * | **A total** | ❌ | `A Sigot + cuota` → es lo que se guarda en `monto_a` |
 * | **Total del sueldo** | ✍️ sí | |
 * | **B** | ❌ | `total − A total` |
 *
 * 🔑 **Y sigue sin cambiar ningún número**: `monto_a` guarda el **A total**, así que el bruto
 * —que usa `(A + B)`— queda idéntico. La cuota es **la apertura de A**, no un componente nuevo.
 *
 * 💡 **Y sirve para algo más**: con la cuota cargada, el pago repartido puede **pre-llenar solo el
 * renglón de Lucrecia** (`A-FEAT-1212`), que es el destino que ya existe entre sus tres cuentas.
 */
export interface AperturaDeA {
  /** Lo que se le paga al empleado como parte de A, **antes** de la cuota. */
  aPropio: number
  /** La cuota alimentaria a un tercero. `0` cuando no aplica. */
  cuotaAlimentaria: number
  /** `aPropio + cuotaAlimentaria`. Es lo que se guarda en `monto_a`. */
  aTotal: number
}

/** Compone el A total desde sus dos partes. */
export function componerA(aPropio: number, cuotaAlimentaria: number): AperturaDeA {
  return {
    aPropio: r2(aPropio),
    cuotaAlimentaria: r2(cuotaAlimentaria),
    aTotal: r2(aPropio + cuotaAlimentaria),
  }
}

/**
 * 🧨 **Escribir la CUOTA no infla A: lo que baja es lo propio** (bug encontrado por el usuario el
 * 2026-09-30, probando `A-FEAT-1213`).
 *
 * ## Qué pasó
 *
 * El modal abre con **«A del empleado» = el A total guardado**, porque hasta ese momento no había
 * cuota. Al escribir la cuota, componer `A total = propio + cuota` **inflaba A** por encima del total
 * del sueldo, B daba negativo y la guardia frenaba el guardado. Medido en Sigot: A total
 * **1.661.085,80**, total nuevo **1.850.000** — con una cuota de sólo 200.000 ya se pasaba, y
 * **no guardaba nada**.
 *
 * 🔑 **Por qué no se notó antes**: **Wilson funcionó bien** y era la prueba de que el camino sin
 * cuota estaba sano. El bug vive **sólo** en el camino con cuota.
 *
 * ## La regla, que sigue siendo la que él enunció
 *
 * *«Se carga Lucrecia, se carga total A Sigot —Sigot antes de Lucrecia— y eso da el A total»*. Eso se
 * respeta: **A total sigue siendo `propio + cuota`**. Lo que cambia es **qué se ajusta cuando se
 * escribe la cuota**: se mantiene el **A total** y se baja lo propio.
 *
 * 📌 Y es lo que uno espera al cargarla por primera vez: poner la cuota es **decir qué parte del A que
 * ya existe se le paga a un tercero**, no agregarle plata al sueldo. Si querés que A total suba, se
 * edita **«A del empleado»**, que sí lo recompone.
 */
export function aplicarCuotaManteniendoA(aTotalActual: number, cuota: number): AperturaDeA {
  return {
    aPropio: r2(aTotalActual - cuota),
    cuotaAlimentaria: r2(cuota),
    aTotal: r2(aTotalActual),
  }
}

/**
 * Y el camino inverso, para **abrir** un A que ya está guardado: al reabrir un período sólo se conoce
 * `monto_a` y la cuota, así que lo propio es la resta.
 *
 * ⚠️ Si la cuota guardada fuera mayor que `monto_a` —dato viejo o mal cargado— lo propio daría
 * negativo. Se devuelve así, **sin corregirlo**, para que la pantalla lo muestre en vez de esconder
 * una inconsistencia (§ 🧮).
 */
export function abrirA(aTotal: number, cuotaAlimentaria: number | null): AperturaDeA {
  const cuota = r2(cuotaAlimentaria ?? 0)
  return { aPropio: r2(aTotal - cuota), cuotaAlimentaria: cuota, aTotal: r2(aTotal) }
}

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
