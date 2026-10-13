/**
 * 🚦 ¿ESTA FILA DEL CASH FLOW TIENE CUENTA CONTABLE? — la regla de la marca (A-FEAT-1260).
 *
 * Pedido del usuario 2026-10-13: *«en cash flow debería poder ver la cuenta contable y si no tiene
 * ponerla, es un momento propicio para hacerlo. Tal vez algo chico que alerte que tiene o no tiene
 * cuenta contable. A la izquierda junto con lo que queda siempre a la vista»*.
 *
 * 🔑 **Es sólo para FACTURAS** (precisión del usuario, mismo día: *«esto es sólo para facturas, así
 * que con templates no hay que hacer nada: al ser templates ya están asignados»*). Templates,
 * sueldos, ventas y anticipos no llevan marca.
 *
 * 🔗 **La cuenta y su número son una sola cosa** (`lib/facturas/nro-de-cuenta.ts`, A-BUG-1249): la
 * pantalla muestra el nombre y nada más. El estado `a-medias` existe sólo para las facturas viejas
 * que quedaron con el nombre y sin el número (las que entraron antes del arreglo): mostrarlas en
 * verde sería decir que están imputadas cuando Egresos → Asignación las sigue contando como
 * pendientes. Cuando se completen, ese estado deja de aparecer.
 */

export interface FilaConCuenta {
  origen?: string | null
  /** El texto de la cuenta. `'SIN_CATEG'` o vacío = no tiene. */
  categ?: string | null
  /** El número de cuenta del plan (sólo facturas). */
  nro_cuenta?: string | null
  /** `> 1` = varias facturas pagadas juntas: cada una puede tener una cuenta distinta. */
  facturas_agrupadas?: number | null
}

export type EstadoCuenta = 'con' | 'a-medias' | 'sin' | 'grupo' | 'no-aplica'

export interface CuentaDeFila {
  estado: EstadoCuenta
  /** Lo que se lee al pasar el mouse, en lenguaje de la app. */
  titulo: string
  /** Si la cuenta se puede poner desde el Cash Flow (por empresa se decide en la pantalla). */
  asignable: boolean
}

const SIN = new Set(['', 'SIN_CATEG', 'SIN_CAT'])

function textoDeCuenta(categ?: string | null): string | null {
  const t = (categ ?? '').trim()
  return SIN.has(t.toUpperCase()) ? null : t
}

export function cuentaDeFila(fila: FilaConCuenta): CuentaDeFila {
  const texto = textoDeCuenta(fila.categ)

  if (fila.origen === 'ARCA') {
    // Primero el grupo: lo que se ve en la fila es la cuenta de la PRIMERA factura, no la de todas.
    if ((fila.facturas_agrupadas ?? 1) > 1) {
      return {
        estado: 'grupo',
        titulo: `Son ${fila.facturas_agrupadas} facturas pagadas juntas: cada una tiene su cuenta. Se asignan en Egresos → Asignación`,
        asignable: false,
      }
    }
    if (fila.nro_cuenta) {
      return { estado: 'con', titulo: `Cuenta contable: ${texto ?? fila.nro_cuenta} — tocá para cambiarla`, asignable: true }
    }
    if (texto) {
      return {
        estado: 'a-medias',
        titulo: `Cuenta contable: ${texto} (quedó incompleta) — tocá para confirmarla`,
        asignable: true,
      }
    }
    return { estado: 'sin', titulo: 'Sin cuenta contable — tocá para ponerla', asignable: true }
  }

  return { estado: 'no-aplica', titulo: '', asignable: false }
}

/** Color del punto de cada estado. `null` = no se dibuja nada. */
export const COLOR_CUENTA: Record<EstadoCuenta, string | null> = {
  'con': 'bg-emerald-400',
  'a-medias': 'bg-amber-400',
  'sin': 'bg-red-500',
  'grupo': 'bg-gray-300',
  'no-aplica': null,
}
