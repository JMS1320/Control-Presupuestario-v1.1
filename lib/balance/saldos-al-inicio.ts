/**
 * 🏦 **EL SALDO AL INICIO DEL EJERCICIO, y la cadena que lo une con el cierre** (A-FEAT-1206).
 *
 * ## El problema, que parecía no tener solución
 *
 * El papel 07 pide el saldo bancario **en las dos puntas** del ejercicio. El de cierre sale del
 * extracto; **el de inicio no**, porque el extracto cargado en la app **arranca el 02/02/2026** y el
 * ejercicio 25/26 empieza el **01/07/2025**. Hasta el 2026-09-30 la celda iba **vacía a propósito**,
 * con un cartel diciendo que la completaba el usuario.
 *
 * ## ✅ La solución: el dato es de él y ya estaba escrito
 *
 * En el Excel que dejó —*«extracto desde julio del 2025 hasta enero 26 parcial. galicia MSA cta cte
 * pesos»*— la última fila dice, textual, **«saldo de inicio de ej 2025/26 banco galicia cta cte»**, y
 * en la columna Saldo: **$832.605,05**.
 *
 * ## 🧮 Y LA CADENA CIERRA AL CENTAVO — que es lo que la vuelve entregable
 *
 * Medido el 2026-09-30 sobre Banco Galicia cta cte, ejercicio 25/26:
 *
 * | | |
 * |---|---|
 * | Saldo al inicio (01/07/2025), **declarado** | **$832.605,05** |
 * | Neto de los 7 meses que la app **no** tiene (jul-25 → 30/01/2026), **derivado** | **+$367.777,47** |
 * | = saldo justo antes del primer movimiento cargado | **$1.200.382,52** |
 * | Neto de los 695 movimientos cargados (02/02 → 30/06/2026) | **−$3.461.752,49** |
 * | = **saldo al cierre calculado** | **−$2.261.369,97** |
 * | Saldo que trae el **último movimiento** del 30/06 | **−$2.261.369,97** ✅ |
 *
 * 🔑 **Y el tramo no cargado NO se carga: se deduce.** El saldo previo al primer movimiento se
 * despeja de ese mismo movimiento (`saldo + débito − crédito`), así que la cadena se arma **sin
 * cargar los extractos de julio-25 a enero-26** — que es exactamente lo que el usuario decidió no
 * hacer (*«conciliar julio-enero no agrega nada al resultado»*).
 *
 * 📌 Es la § 🎚️ *default del dato real, siempre editable* aplicada a un papel: el número viene puesto
 * y la celda del Excel sigue siendo suya.
 */

/**
 * Los saldos al inicio de ejercicio que **están declarados en algún papel del usuario**.
 *
 * 🔑 **Vive acá y no en la BD a propósito, por ahora.** Es **un número por cuenta y por ejercicio**,
 * y su fuente es un papel, no una pantalla: meterlo en una tabla obliga a construir el alta, el
 * permiso y la auditoría de un dato que se escribe una vez al año. Cuando haya más de dos ejercicios
 * cargados, conviene mudarlo — y ahí la clave ya está bien elegida.
 *
 * ⚠️ **Cada entrada lleva su FUENTE.** Un saldo de inicio sin decir de dónde salió es un número
 * puesto a mano en un papel que va al contador, y eso no se hace en silencio (§ 🧮).
 */
export interface SaldoAlInicio {
  /** `MSA` / `PAM` / `MA`. */
  empresa: string
  /** La etiqueta del ejercicio, como la arma `armarEjercicio`: `25/26`. */
  ejercicio: string
  /** El nombre de la cuenta, **exactamente** como lo declara `CUENTAS_DEL_EXTRACTO`. */
  cuenta: string
  saldo: number
  /** De dónde salió. Se imprime en el papel. */
  fuente: string
}

export const SALDOS_AL_INICIO: SaldoAlInicio[] = [
  {
    empresa: "MSA",
    ejercicio: "25/26",
    cuenta: "BANCO GALICIA (cta cte)",
    saldo: 832605.05,
    fuente: 'planilla del usuario «extracto desde julio del 2025 hasta enero 26 parcial», '
      + 'fila «saldo de inicio de ej 2025/26 banco galicia cta cte»',
  },
]

/** El saldo al inicio declarado para una cuenta, o `null` si no hay ninguno. */
export function saldoAlInicioDe(
  empresa: string,
  ejercicio: string,
  cuenta: string,
): SaldoAlInicio | null {
  return SALDOS_AL_INICIO.find(s =>
    s.empresa.toUpperCase() === empresa.toUpperCase()
    && s.ejercicio === ejercicio
    && s.cuenta === cuenta) ?? null
}

/** Un movimiento, con lo justo para armar la cadena. */
export interface MovimientoConOrden {
  fecha: string
  /**
   * La posición del movimiento **dentro del día**, como vino del banco.
   *
   * 🧨 **Sin esto el saldo sale de cualquier movimiento del último día.** El 30/06/2026 hay 10 en
   * Banco Galicia y los saldos van de $313.855,13 a −$2.261.369,97: **$2,58 M de diferencia** entre
   * tomar el primero y el último → [A-BUG-1224]. Las 7 tablas de extracto y caja tienen la columna.
   */
  orden?: number | null
  debitos?: number | null
  creditos?: number | null
  saldo?: number | null
}

/** La cadena del papel 07 para UNA cuenta: de dónde arranca el ejercicio hasta dónde termina. */
export interface CadenaDeSaldos {
  cuenta: string
  /** El declarado, si hay. `null` = no se conoce y el papel lo dice. */
  saldoInicio: number | null
  fuenteInicio: string | null
  /**
   * El saldo justo **antes** del primer movimiento que la app tiene, despejado de ese movimiento.
   * `null` si la cuenta no tiene movimientos en el ejercicio.
   */
  saldoAntesDeLoCargado: number | null
  /** La fecha de ese primer movimiento cargado. */
  desde: string | null
  /**
   * El neto del tramo que la app **no** tiene: `saldoAntesDeLoCargado − saldoInicio`.
   * `null` si falta cualquiera de los dos.
   */
  netoNoCargado: number | null
  /** `créditos − débitos` de todo lo cargado en el ejercicio. */
  netoCargado: number
  /** La fecha del último movimiento cargado. */
  hasta: string | null
  /** El saldo que trae el último movimiento, tomado por `fecha` **y** `orden`. */
  saldoAlCierre: number | null
  /** `saldoAntesDeLoCargado + netoCargado`. Es el camino inverso. */
  cierreCalculado: number | null
  /**
   * 🧮 `cierreCalculado − saldoAlCierre`. **Tiene que ser cero.**
   *
   * Si no lo es, los importes del extracto y sus saldos no cuentan la misma historia: falta un
   * movimiento, sobra, o hay un mes sin cargar. **Avisa, no frena** (§ 🚦): la causa más probable es
   * un dato incompleto, no una cuenta mal hecha, y frenar dejaría al usuario sin el papel justo
   * cuando lo necesita para encontrar el hueco.
   */
  diferencia: number | null
  movimientos: number
  /**
   * 🔍 **Cuántas veces el saldo de una fila NO se explica por la fila anterior** —
   * `saldo ≠ saldo previo + crédito − débito`, recorriendo por `fecha` y `orden`.
   *
   * 🧨 **Es lo que distingue dos causas que dan la misma diferencia total**, y confundirlas manda a
   * buscar plata que no falta:
   *
   * | Qué se ve | Qué significa |
   * |---|---|
   * | **un solo salto** | falta (o sobra) **un movimiento**: ahí está la plata |
   * | **muchos saltos que se compensan** | el **orden está mal**: los saldos se calcularon en otra secuencia |
   *
   * 📌 Caso real, el día que se puso (2026-09-30): **CAJA SIGOT** daba $205.000 de diferencia y
   * parecía plata faltante. Tiene **17 saltos que se cancelan de a pares** (+30.000 / −27.000 / −3.000
   * …) porque su columna `orden` **no sigue a la fecha**: el movimiento con `orden` 26 está fechado el
   * 17/03 y el 27 el 14/03. O sea que ahí no falta un peso — lo que no sirve es el orden, y por eso
   * las dos puntas de la cadena salen del movimiento equivocado → [A-DAT-75].
   */
  saltos: number
  /** La suma de esos saltos. Cerca de cero con muchos saltos = es orden, no plata. */
  sumaDeSaltos: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * 🔑 **El último movimiento de verdad: por `fecha` Y por `orden`.**
 *
 * Ordenar sólo por fecha y tomar «el último de la lista» deja el saldo a merced de en qué orden
 * devolvió las filas la base — y dentro de un día hay diez. Ver [A-BUG-1224].
 */
export function ultimoMovimiento<T extends MovimientoConOrden>(filas: T[]): T | null {
  let mejor: T | null = null
  for (const f of filas) {
    if (f.saldo == null) continue
    if (!mejor) { mejor = f; continue }
    const fa = String(f.fecha).slice(0, 10)
    const fb = String(mejor.fecha).slice(0, 10)
    if (fa > fb) { mejor = f; continue }
    if (fa === fb && (f.orden ?? -Infinity) > (mejor.orden ?? -Infinity)) mejor = f
  }
  return mejor
}

/** El primero, con el mismo criterio al revés. */
export function primerMovimiento<T extends MovimientoConOrden>(filas: T[]): T | null {
  let mejor: T | null = null
  for (const f of filas) {
    if (f.saldo == null) continue
    if (!mejor) { mejor = f; continue }
    const fa = String(f.fecha).slice(0, 10)
    const fb = String(mejor.fecha).slice(0, 10)
    if (fa < fb) { mejor = f; continue }
    if (fa === fb && (f.orden ?? Infinity) < (mejor.orden ?? Infinity)) mejor = f
  }
  return mejor
}

/**
 * 🏦 Arma la cadena de saldos de una cuenta.
 *
 * @param cuenta       el nombre, como en `CUENTAS_DEL_EXTRACTO`
 * @param movimientos  los del ejercicio, de esa cuenta
 * @param declarado    el saldo al inicio si está declarado (`saldoAlInicioDe`)
 */
export function armarCadenaDeSaldos(
  cuenta: string,
  movimientos: MovimientoConOrden[],
  declarado: SaldoAlInicio | null,
): CadenaDeSaldos {
  const primero = primerMovimiento(movimientos)
  const ultimo = ultimoMovimiento(movimientos)

  /**
   * 🔑 El saldo previo se **despeja del propio movimiento**: si después de él el saldo quedó en
   * `saldo`, antes era `saldo + débito − crédito`. Por eso el tramo no cargado no hay que cargarlo.
   */
  const saldoAntesDeLoCargado = primero
    ? r2((primero.saldo ?? 0) + (primero.debitos ?? 0) - (primero.creditos ?? 0))
    : null

  const netoCargado = r2(movimientos.reduce(
    (s, m) => s + (m.creditos ?? 0) - (m.debitos ?? 0), 0))

  const saldoInicio = declarado?.saldo ?? null
  const netoNoCargado = saldoInicio != null && saldoAntesDeLoCargado != null
    ? r2(saldoAntesDeLoCargado - saldoInicio)
    : null

  const cierreCalculado = saldoAntesDeLoCargado != null
    ? r2(saldoAntesDeLoCargado + netoCargado)
    : null
  const saldoAlCierre = ultimo?.saldo ?? null
  const diferencia = cierreCalculado != null && saldoAlCierre != null
    ? r2(cierreCalculado - saldoAlCierre)
    : null

  /**
   * 🔍 La secuencia fila por fila, recorrida en el orden que la cadena da por bueno. Ver `saltos`:
   * es lo único que separa *«falta un movimiento»* de *«el orden está mal»*.
   */
  const enOrden = movimientos
    .filter(m => m.saldo != null)
    .slice()
    .sort((a, b) => {
      const c = String(a.fecha).slice(0, 10).localeCompare(String(b.fecha).slice(0, 10))
      return c !== 0 ? c : (a.orden ?? 0) - (b.orden ?? 0)
    })
  let saltos = 0
  let sumaDeSaltos = 0
  for (let i = 1; i < enOrden.length; i++) {
    const esperado = (enOrden[i - 1].saldo ?? 0)
      + (enOrden[i].creditos ?? 0) - (enOrden[i].debitos ?? 0)
    const d = r2((enOrden[i].saldo ?? 0) - esperado)
    if (Math.abs(d) > 0.01) { saltos += 1; sumaDeSaltos = r2(sumaDeSaltos + d) }
  }

  return {
    cuenta,
    saldoInicio,
    fuenteInicio: declarado?.fuente ?? null,
    saldoAntesDeLoCargado,
    desde: primero ? String(primero.fecha).slice(0, 10) : null,
    netoNoCargado,
    netoCargado,
    hasta: ultimo ? String(ultimo.fecha).slice(0, 10) : null,
    saldoAlCierre,
    cierreCalculado,
    diferencia,
    movimientos: movimientos.length,
    saltos,
    sumaDeSaltos,
  }
}
