/**
 * ↕️ **SÓLO DÉBITOS / SÓLO CRÉDITOS — en el Extracto y en el Cash Flow.**
 *
 * Pedido del usuario 2026-10-01: *«preciso tener un filtro de sólo créditos o sólo débitos para
 * extracto bancario y cash flow»*.
 *
 * ## Por qué vive acá y no en cada pantalla
 * Las dos pantallas deciden lo mismo —¿este movimiento es un débito o un crédito?— y si cada una
 * lo decide por su cuenta, el día que una cambie dejan de coincidir (§ ♻️ de `CLAUDE.md`).
 *
 * ## ⚠️ El hallazgo que vino con el pedido: el RANGO DE MONTOS del Extracto sólo miraba débitos
 * La pantalla dice **«💵 Rango de Montos»**, pero la consulta comparaba **sólo contra la columna de
 * débitos** (`hooks/useMovimientosBancarios.ts`, comentado como «monto desde (débitos)»). Dos
 * consecuencias, las dos silenciosas:
 *   1. **Un crédito nunca aparecía buscándolo por monto.** Tiene débitos = 0, así que no pasa un
 *      «desde 100.000».
 *   2. **«Hasta» traía TODOS los créditos.** Débitos = 0 cumple cualquier «hasta».
 * Y combinado con el filtro nuevo, «sólo créditos» + un monto habría dado **siempre vacío**: el
 * filtro nacía roto. Por eso el rango ahora mira **la columna que corresponde al sentido**, y con
 * «todos» mira las dos.
 *
 * ## 🔑 El monto de un movimiento es la columna que NO está en cero
 * Un movimiento bancario tiene el importe en `debitos` **o** en `creditos`, y la otra en 0. Por eso
 * cada condición de rango lleva también `> 0`: sin eso, el cero de la otra columna se cuela en
 * cualquier «hasta».
 */

export type Sentido = 'todos' | 'debitos' | 'creditos'
export type Columna = 'debitos' | 'creditos'

/** Lo que hay que pedirle a la base — sin tocar Supabase, para poder probarlo solo. */
export interface FiltroDeMonto {
  /** El movimiento tiene que tener importe en ESTA columna (`> 0`). */
  soloColumna?: Columna
  /** Rango sobre una sola columna (cuando se eligió un sentido). */
  rango?: { columna: Columna; desde?: number; hasta?: number }
  /**
   * Rango sobre CUALQUIERA de las dos columnas (sentido «todos»), en la sintaxis de `or` de
   * PostgREST. Se combina bien con los otros dos `or` de la misma consulta (sin categ, sin nota):
   * PostgREST suma cada `or` como una condición más.
   */
  rangoEnCualquiera?: string
}

const hay = (n?: number) => typeof n === 'number' && Number.isFinite(n) && n > 0

function condicionDeColumna(col: Columna, desde?: number, hasta?: number): string {
  const partes = [`${col}.gt.0`]
  if (hay(desde)) partes.push(`${col}.gte.${desde}`)
  if (hay(hasta)) partes.push(`${col}.lte.${hasta}`)
  return `and(${partes.join(',')})`
}

/**
 * Traduce el sentido elegido y el rango de montos a lo que la consulta tiene que aplicar.
 * Igual que antes, un monto en 0 o vacío **no** filtra.
 */
export function filtroDeSentidoYMonto(sentido: Sentido, desde?: number, hasta?: number): FiltroDeMonto {
  const hayRango = hay(desde) || hay(hasta)

  if (sentido === 'debitos' || sentido === 'creditos') {
    return {
      soloColumna: sentido,
      ...(hayRango ? { rango: { columna: sentido, desde: hay(desde) ? desde : undefined, hasta: hay(hasta) ? hasta : undefined } } : {}),
    }
  }

  if (!hayRango) return {}
  return {
    rangoEnCualquiera: [
      condicionDeColumna('debitos', desde, hasta),
      condicionDeColumna('creditos', desde, hasta),
    ].join(','),
  }
}

/**
 * Para el Cash Flow, que filtra lo que ya trajo: ¿esta fila pasa con estos chips prendidos?
 *
 * - **Los dos prendidos → pasa todo**, incluidas las filas en cero. Es el estado de arranque, y
 *   prender los dos no puede esconder nada.
 * - **Uno solo → sólo las filas con importe en esa columna.**
 * - **Ninguno → no pasa nada.** Es lo mismo que hacen los chips de Estado y Origen al apagarlos todos.
 */
export function pasaSentido(
  fila: { debitos?: number | null; creditos?: number | null },
  prendidos: Set<Columna>,
): boolean {
  const deb = prendidos.has('debitos')
  const cre = prendidos.has('creditos')
  if (deb && cre) return true
  if (deb) return (Number(fila.debitos) || 0) > 0
  if (cre) return (Number(fila.creditos) || 0) > 0
  return false
}

/** Cómo se lee el sentido en el cartel de filtros activos del Extracto. */
export const ETIQUETA_SENTIDO: Record<Sentido, string> = {
  todos: 'débitos y créditos',
  debitos: 'sólo débitos',
  creditos: 'sólo créditos',
}
