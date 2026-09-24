/**
 * 👥 **A-FEAT-155 — cuando un pago va a VARIOS beneficiarios, el extracto dice cuánto a cada uno.**
 *
 * Pedido del usuario 2026-09-19, sobre el pago de haberes de $2.699.370 que el banco agrupó:
 *
 * > *«Siempre hay que concatenar en temas de datos agrupados distintos (…) para el lector, si ve que
 * > se pagaron 2.700.000 a Sigot y Barreto, pensará cuánto a cada uno. Sería bueno que diga 1,9M con
 * > el de Sigot y 800K a Wilson. Manejando redondeo a 100K y usando M para millón y K para miles.»*
 *
 * 🔑 **Es informativo, no contable.** Para los cálculos el sistema entra al grupo y toma los importes
 * exactos; el redondeo existe **sólo para que el renglón se lea de un vistazo**. Por eso se redondea
 * fuerte (a 100.000) en vez de mostrar centavos que nadie va a sumar a mano.
 *
 * ⚠️ **Y por eso mismo no se usa para ningún total**: si estos números se sumaran, no darían el pago.
 */

/** Un beneficiario del pago agrupado. */
export interface Beneficiario {
  nombre: string
  monto: number
}

/**
 * El importe en la escala corta: **redondeado a 100.000**, con `M` para millones y `K` para miles.
 *
 * | | |
 * |---|---|
 * | 1.612.477 | `1,6M` |
 * | 1.086.893 | `1,1M` |
 * | 588.333 | `600K` |
 * | 125.000 | `100K` |
 * | 40.000 | `<100K` |
 *
 * 📌 Lo que redondea a cero se muestra como `<100K` y no como `0K`: un renglón que dice cero al lado
 * de un nombre hace pensar que no se le pagó nada.
 */
export function montoCorto(n: number): string {
  const v = Math.abs(Number(n) || 0)
  const redondeado = Math.round(v / 100000) * 100000
  if (redondeado === 0) return '<100K'
  if (redondeado >= 1000000) {
    const millones = redondeado / 1000000
    // Sin decimal cuando es redondo: `2M`, no `2,0M`.
    const txt = Number.isInteger(millones) ? String(millones) : millones.toFixed(1).replace('.', ',')
    return `${txt}M`
  }
  return `${redondeado / 1000}K`
}

/**
 * Agrupa por beneficiario y arma el renglón: `Ruben Sigot 1,6M + Wilson Barreto 1,1M`.
 *
 * 🔑 **Se suma por nombre primero.** En el caso real Sigot aparece **dos veces** (1.487.477 y
 * 125.000); mostrarlo dos veces en el mismo renglón haría pensar que son dos personas distintas.
 *
 * Con **un solo** beneficiario devuelve sólo el nombre, sin importe: ahí el monto ya es el del
 * movimiento y repetirlo sería ruido (§ el detalle no repite lo que ya dice otra columna).
 */
export function repartoDelGrupo(beneficiarios: Beneficiario[]): string {
  const porNombre = new Map<string, number>()
  for (const b of beneficiarios) {
    const n = (b.nombre ?? '').trim()
    if (!n) continue
    porNombre.set(n, (porNombre.get(n) ?? 0) + (Number(b.monto) || 0))
  }

  const lista = [...porNombre.entries()].sort((a, b) => b[1] - a[1])
  if (lista.length === 0) return ''
  if (lista.length === 1) return lista[0][0]

  return lista.map(([nombre, monto]) => `${nombre} ${montoCorto(monto)}`).join(' + ')
}
