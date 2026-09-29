/**
 * 🐄 **EL CUADRE DE LA HACIENDA — existencia al inicio ± movimientos = existencia al cierre.**
 *
 * Pedido del usuario 2026-09-29, revisando el export:
 * > *«hacienda precisa el cheq de consistencia de inicio más menos mov = stock final»*
 *
 * ## ⚠️ Por qué este control NO puede ser sólo la resta
 *
 * En la app la existencia **ES** la suma de los movimientos (`hacienda-al-cierre` acumula
 * `movimientos_hacienda.cantidad` hasta el cierre). Entonces *«inicio + movimientos = cierre»*
 * comparado contra esa misma suma **da siempre cero**: no controla nada, sólo se mira al espejo.
 *
 * 🔑 **Lo que sí controla, y es lo que este módulo hace:**
 *
 * 1. **Que la existencia al inicio EXISTA.** Si el ejercicio arranca con la hacienda ya en el campo,
 *    tiene que haber movimientos anteriores a su primer día. Si no hay, la existencia al inicio es
 *    **cero** y el papel está diciendo que los animales aparecieron de la nada.
 * 2. **Que nada se descarte en silencio.** Un movimiento sin categoría se **saltea** al acumular
 *    (`if (!nombre) continue`), así que desaparece de la existencia sin dejar rastro. Acá se cuentan.
 * 3. **La apertura por tipo de movimiento**, que es lo que el contador quiere ver: cuántas cabezas
 *    entraron, cuántas se vendieron, cuántas se murieron y cuántas sólo cambiaron de categoría.
 * 4. **Contra una fuente independiente, si se le pasa una** (su planilla de hacienda). Ése es el
 *    control fuerte; los tres de arriba son de integridad.
 *
 * 🧨 **Y lo que encontró en la primera corrida**, que es el motivo de que valga la pena: de los **47**
 * movimientos de MSA, **ninguno es anterior al 01/07/2025**. La carga inicial —un `ajuste_stock` de
 * **421 cabezas**— está fechada el **15/02/2026**. O sea que el sistema **no tiene existencia al
 * inicio del ejercicio**: es el mismo hueco que el extracto bancario, y por el mismo motivo.
 */

/** Un movimiento, con lo mínimo que hace falta para cuadrar. */
export interface MovimientoDeHacienda {
  fecha: string
  /** `ajuste_stock` · `venta` · `mortandad` · `cambio_categoria` · … */
  tipo: string
  cantidad: number
  /** El nombre de la categoría. Vacío = no se pudo resolver, y entonces **no se cuenta**. */
  categoria: string
}

export interface MovimientosPorTipo {
  tipo: string
  movimientos: number
  /** Suma de cantidades. Positivo = entra, negativo = sale. */
  cabezas: number
}

export interface CuadreHacienda {
  /** Σ cantidades de todo lo anterior al primer día del ejercicio. */
  existenciaInicio: number
  /** Los movimientos del ejercicio, abiertos por tipo y ordenados por peso. */
  porTipo: MovimientosPorTipo[]
  /** Σ cantidades de los movimientos del ejercicio. */
  movimientosDelEjercicio: number
  /** `existenciaInicio + movimientosDelEjercicio`. Lo que **debería** haber al cierre. */
  existenciaCierreCalculada: number
  /** Lo que la app está valuando. Si difiere, algo se contó distinto. */
  existenciaCierreDeclarada: number
  diferencia: number
  /**
   * 🛑 Movimientos que **no se pudieron contar** porque no tienen categoría. Hoy la pantalla los
   * saltea sin decir nada; acá se listan con sus cabezas.
   */
  sinCategoria: MovimientoDeHacienda[]
  /**
   * Movimientos **posteriores al cierre**. No son un error —el sistema sigue andando— pero hay que
   * saber que existen: explican por qué el stock de hoy no es el del balance.
   */
  posterioresAlCierre: number
  /** Los avisos en palabras, listos para mostrar. Vacío = el cuadre cierra y no falta nada. */
  avisos: string[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Cuadra la existencia de hacienda del ejercicio.
 *
 * @param movimientos    todos los de la empresa, sin filtrar por fecha
 * @param primerDia      `AAAA-MM-DD` del primer día del ejercicio
 * @param fechaCierre    `AAAA-MM-DD` del cierre
 * @param declarada      las cabezas que el papel está valuando
 */
export function cuadrarHacienda(
  movimientos: MovimientoDeHacienda[],
  primerDia: string,
  fechaCierre: string,
  declarada: number,
): CuadreHacienda {
  const sinCategoria = movimientos.filter(m => !m.categoria?.trim())
  const contables = movimientos.filter(m => m.categoria?.trim())

  const existenciaInicio = r2(contables
    .filter(m => m.fecha < primerDia)
    .reduce((s, m) => s + m.cantidad, 0))

  const delEjercicio = contables.filter(m => m.fecha >= primerDia && m.fecha <= fechaCierre)

  const porTipoMap = new Map<string, MovimientosPorTipo>()
  for (const m of delEjercicio) {
    const t = m.tipo || "(sin tipo)"
    const e = porTipoMap.get(t) ?? { tipo: t, movimientos: 0, cabezas: 0 }
    e.movimientos += 1
    e.cabezas += m.cantidad
    porTipoMap.set(t, e)
  }
  const porTipo = [...porTipoMap.values()]
    .map(e => ({ ...e, cabezas: r2(e.cabezas) }))
    .sort((a, b) => Math.abs(b.cabezas) - Math.abs(a.cabezas))

  const movimientosDelEjercicio = r2(delEjercicio.reduce((s, m) => s + m.cantidad, 0))
  const existenciaCierreCalculada = r2(existenciaInicio + movimientosDelEjercicio)
  const posterioresAlCierre = contables.filter(m => m.fecha > fechaCierre).length

  const avisos: string[] = []
  if (existenciaInicio === 0 && movimientosDelEjercicio > 0) {
    avisos.push(
      "La existencia al INICIO del ejercicio es CERO: no hay movimientos anteriores al " + primerDia +
      ". Si al empezar el ejercicio ya había hacienda en el campo, falta la carga inicial con su fecha " +
      "real — y entonces el papel no puede mostrar la variación del rodeo, sólo la existencia final.")
  }
  if (sinCategoria.length > 0) {
    avisos.push(
      `${sinCategoria.length} movimiento(s) sin categoría, con ` +
      `${r2(sinCategoria.reduce((s, m) => s + m.cantidad, 0))} cabeza(s): NO se cuentan en la existencia.`)
  }
  const diferencia = r2(existenciaCierreCalculada - declarada)
  if (diferencia !== 0) {
    avisos.push(
      `El cuadre NO cierra: inicio (${existenciaInicio}) + movimientos (${movimientosDelEjercicio}) = ` +
      `${existenciaCierreCalculada}, y el papel valúa ${declarada}. Diferencia de ${diferencia} cabeza(s).`)
  }
  if (posterioresAlCierre > 0) {
    avisos.push(
      `${posterioresAlCierre} movimiento(s) POSTERIORES al cierre: no entran al balance, pero explican ` +
      "por qué el stock de hoy no es el del balance.")
  }

  return {
    existenciaInicio, porTipo, movimientosDelEjercicio,
    existenciaCierreCalculada, existenciaCierreDeclarada: declarada, diferencia,
    sinCategoria, posterioresAlCierre, avisos,
  }
}
