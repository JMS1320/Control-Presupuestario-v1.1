/**
 * 🚦 ¿ESTA FILA DEL CASH FLOW TIENE CUENTA CONTABLE? — la regla de la marca (A-FEAT-1260).
 *
 * Pedido del usuario 2026-10-13: *«en cash flow debería poder ver la cuenta contable y si no tiene
 * ponerla, es un momento propicio para hacerlo. Tal vez algo chico que alerte que tiene o no tiene
 * cuenta contable. A la izquierda junto con lo que queda siempre a la vista»*.
 *
 * 🔑 **«Tener cuenta» no es lo mismo en una factura que en un template**, y por eso hay regla:
 *
 * | Origen | Tiene cuenta cuando… | Por qué |
 * |---|---|---|
 * | factura (ARCA) | tiene el **número** de cuenta del plan | es lo que mira Egresos → Asignación, y lo que viaja al extracto y a los papeles del balance |
 * | template | su categoría **existe en el plan de cuentas** | § 🏷️ de `CLAUDE.md`: fuera del plan se asume gasto y queda «sin clasificar» |
 *
 * 🟡 **El estado del medio existe a propósito** (`a-medias`): una factura puede tener escrito el
 * NOMBRE de la cuenta y no el número —es lo que deja la edición de la columna CATEG de esta misma
 * pantalla, que escribe sólo el texto—. Mostrarla en verde sería decir que está imputada cuando la
 * pantalla de asignación la sigue contando como pendiente.
 *
 * ⚪ Lo que no es factura ni template (sueldos, ventas, anticipos) no lleva marca: su cuenta se
 * resuelve en otro lado y marcarlo en rojo sería inventarle un problema (mismo criterio que
 * `lib/facturas/archivo-digital.ts`).
 */

export interface FilaConCuenta {
  origen?: string | null
  /** El texto de la cuenta. `'SIN_CATEG'` o vacío = no tiene. */
  categ?: string | null
  /** El número de cuenta del plan (sólo facturas). */
  nro_cuenta?: string | null
  /** `> 1` = varias facturas pagadas juntas: cada una puede tener una cuenta distinta. */
  facturas_agrupadas?: number | null
  /** Templates: la categoría va por cuota (se puede cambiar acá) y no por template. */
  es_multi_cuenta?: boolean | null
}

export type EstadoCuenta = 'con' | 'a-medias' | 'sin' | 'fuera-del-plan' | 'grupo' | 'no-aplica'

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

/**
 * @param categsDelPlan las categorías del plan de cuentas, **en minúsculas**.
 */
export function cuentaDeFila(fila: FilaConCuenta, categsDelPlan: ReadonlySet<string>): CuentaDeFila {
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
      return { estado: 'con', titulo: `Cuenta contable: ${texto ?? fila.nro_cuenta} (${fila.nro_cuenta})`, asignable: true }
    }
    if (texto) {
      return {
        estado: 'a-medias',
        titulo: `Dice «${texto}» pero no tiene el número de cuenta del plan — tocá para asignarla`,
        asignable: true,
      }
    }
    return { estado: 'sin', titulo: 'Sin cuenta contable — tocá para ponerla', asignable: true }
  }

  if (fila.origen === 'TEMPLATE') {
    const porCuota = !!fila.es_multi_cuenta
    const donde = porCuota ? 'tocá para ponerla' : 'se cambia desde Templates'
    if (!texto) return { estado: 'sin', titulo: `Template sin cuenta contable — ${donde}`, asignable: porCuota }
    if (categsDelPlan.has(texto.toLowerCase())) {
      return { estado: 'con', titulo: `Cuenta contable: ${texto}`, asignable: porCuota }
    }
    return {
      estado: 'fuera-del-plan',
      titulo: `«${texto}» no está en el plan de cuentas: el presupuesto la toma como gasto sin clasificar — ${donde}`,
      asignable: porCuota,
    }
  }

  return { estado: 'no-aplica', titulo: '', asignable: false }
}

/** Color del punto de cada estado. `null` = no se dibuja nada. */
export const COLOR_CUENTA: Record<EstadoCuenta, string | null> = {
  'con': 'bg-emerald-400',
  'a-medias': 'bg-amber-400',
  'sin': 'bg-red-500',
  'fuera-del-plan': 'bg-amber-400',
  'grupo': 'bg-gray-300',
  'no-aplica': null,
}
