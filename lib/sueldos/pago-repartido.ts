/**
 * 💸 **UN PAGO DE SUELDO REPARTIDO ENTRE VARIOS DESTINOS** (A-FEAT-1212).
 *
 * Pedido del usuario 2026-09-30: *«cuando quiero hacer un pago a un empleado tener la posibilidad de
 * anotar cuánto a Lucrecia, cuánto a Galicia, cuánto a Santander y cuánto desde caja Sigot como
 * programado. Cada pago con su cuenta, y si es banco o caja, y si pasa a qué estado. **Se guarda todo
 * junto. A cada carga de importe va mostrando el saldo.** Poder asignar a un pago saldo A o saldo
 * total»*.
 *
 * ## ✅ La base ya existía — esto es la lógica, no una tabla nueva
 *
 * `sueldos.pagos` **ya admite N pagos por período**, y cada fila ya tiene `cuenta_destino_id`,
 * `medio_pago`, `estado` y `grupo_pago_id`. Las **3 cuentas de Sigot ya están cargadas** —una es
 * **Lucrecia**—. Lo que faltaba era la pantalla que los cargue **juntos** mostrando el saldo, y eso
 * es lo que este módulo calcula.
 *
 * ## 🔑 «Pagar el saldo» es un ATAJO DE CARGA, no una regla viva
 *
 * Definido por el usuario el mismo día, y **corrige lo que yo había propuesto**:
 *
 * > *«El pago programado es que yo doy orden de pago, en este caso en efectivo, y lo sabré cuando me
 * > lo confirmen, básicamente conciliando caja. **Pero el monto es en firme y no cambia.** El tema de
 * > pago saldo es que la UI ve el saldo A o el saldo total, los muestra, y yo si pongo pago saldo el
 * > sistema llena con ese monto, y cuando se confirma **queda como monto, no como cálculo**.»*
 *
 * Entonces: **el pago es siempre un monto firme**; el botón sólo **rellena el campo** con el saldo de
 * ese momento. Lo que se desconoce de una orden en efectivo es **cuándo se confirma**, no cuánto es.
 *
 * 📌 **Y por eso no hace falta recalcular nada hacia atrás.** El aviso no viene del pago: viene del
 * **saldo**, que se calcula siempre. Al cargar los francos el bruto sube, el saldo pasa de cero a
 * *«falta tanto»*, el período reaparece en el Cash Flow y se puede volver a poner «pagar saldo» por
 * la diferencia — que es exactamente lo que el usuario preguntó y ya funciona así (`A-DEC-39`).
 *
 * ## 🚦 Qué frena y qué sólo avisa
 *
 * | Caso | Acción | Por qué |
 * |---|---|---|
 * | un renglón sin importe, o en cero | 🛑 **frena** | no es un pago |
 * | dos renglones a la **misma cuenta** | ⚠️ avisa | raro, pero puede ser a propósito |
 * | los renglones suman **más que el saldo** | ⚠️ **avisa y deja seguir** | *«es posible que yo tenga que pagar más o menos por algún motivo»* — es un hecho del negocio, no un bug (§ 🚦 de `CLAUDE.md`) |
 */

/** Los medios de pago que ya usa `sueldos.pagos`. */
export type MedioPago = "banco" | "caja_general" | "caja_ams" | "caja_sigot"

/** Los estados de Cash Flow que ya usa la pantalla. */
export type EstadoPago = "pagar" | "programado" | "pendiente" | "pagado" | "anterior"

/** Un renglón del reparto: a quién, por qué vía, cuánto y en qué estado queda. */
export interface RenglonPago {
  /** `cuenta_destino_id`. `null` = sin especificar (la pantalla lo permite hoy). */
  cuentaDestinoId: string | null
  medio: MedioPago
  monto: number
  estado: EstadoPago
  fecha: string
  descripcion?: string
}

/**
 * 🎚️ **El estado que corresponde por default a cada medio** — y se puede cambiar por renglón.
 *
 * 🔑 El motivo está en el pedido: *«cuánto desde caja Sigot **como programado**»*. Un pago por caja es
 * **una orden que se confirma después**, al conciliar la caja; una transferencia bancaria en cambio ya
 * queda lista para salir. Poner el default correcto ahorra un click por renglón, y § 🎚️ manda que
 * igual se pueda pisar.
 */
export function estadoPorDefectoDe(medio: MedioPago): EstadoPago {
  return medio === "banco" ? "pagar" : "programado"
}

/** El saldo de un período, visto desde los dos lados que el usuario pidió. */
export interface SaldosDelPeriodo {
  bruto: number
  /** Lo que ya se le pagó (anticipos y pagos anteriores). */
  yaPagado: number
  /** `bruto − yaPagado`. Es el saldo total. */
  saldoTotal: number
  /**
   * La parte del saldo que corresponde a la **categoría A** del convenio.
   *
   * 🔑 Existe porque el usuario pidió *«poder asignar a un pago saldo A o saldo total»*: **A es lo que
   * va por el banco del convenio** y el resto suele ir por otra vía. Se acota al saldo: si ya se pagó
   * más que B, lo que queda de A es menos que A.
   */
  saldoA: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Los dos saldos de un período.
 *
 * @param bruto     el bruto calculado del período
 * @param yaPagado  `anticipos_descontados` — lo que ya se le pagó
 * @param montoA    `monto_a` del período
 */
export function saldosDelPeriodo(bruto: number, yaPagado: number, montoA: number): SaldosDelPeriodo {
  const saldoTotal = r2(bruto - yaPagado)
  /**
   * 🧮 A se consume **último**: primero se descuenta lo pagado contra B (el resto), y lo que sobra
   * baja A. Así, mientras haya B sin pagar, «saldo A» sigue siendo A completo — que es como el
   * usuario lo lee: A es el número del convenio, no una proporción.
   */
  const saldoA = r2(Math.max(0, Math.min(montoA, saldoTotal)))
  return { bruto: r2(bruto), yaPagado: r2(yaPagado), saldoTotal, saldoA }
}

/** Cómo queda el saldo después de cada renglón — es lo que la pantalla muestra al pie de cada uno. */
export interface PasoDelReparto {
  renglon: RenglonPago
  /** El saldo que queda **después** de este renglón. */
  saldoDespues: number
}

export interface ControlDelReparto {
  pasos: PasoDelReparto[]
  /** La suma de los renglones. */
  total: number
  /** El saldo que queda al final. Cero = quedó saldado. */
  saldoFinal: number
  /** 🛑 Frena: renglones sin importe. Son los índices, para marcarlos. */
  sinImporte: number[]
  /** ⚠️ Avisa: dos renglones a la misma cuenta. */
  cuentasRepetidas: string[]
  /** ⚠️ Avisa: se paga más que el saldo. Puede ser a propósito. */
  pagaDeMas: boolean
  /** `true` si se puede guardar. Sólo lo impide `sinImporte`. */
  sePuedeGuardar: boolean
}

/**
 * 🧮 **El control del reparto, que es lo que el usuario pidió ver: «a cada carga de importe va
 * mostrando el saldo».**
 *
 * Devuelve el saldo **después de cada renglón**, no sólo el total: así se ve cómo se va agotando
 * mientras se carga, que es la forma de darse cuenta de que falta o sobra antes de guardar.
 */
export function controlarReparto(
  saldos: SaldosDelPeriodo,
  renglones: RenglonPago[],
): ControlDelReparto {
  const pasos: PasoDelReparto[] = []
  let saldo = saldos.saldoTotal
  for (const renglon of renglones) {
    saldo = r2(saldo - (renglon.monto || 0))
    pasos.push({ renglon, saldoDespues: saldo })
  }

  const total = r2(renglones.reduce((s, x) => s + (x.monto || 0), 0))
  const sinImporte = renglones
    .map((x, i) => (!x.monto || x.monto <= 0 ? i : -1))
    .filter(i => i >= 0)

  const vistas = new Map<string, number>()
  for (const x of renglones) {
    if (!x.cuentaDestinoId) continue
    vistas.set(x.cuentaDestinoId, (vistas.get(x.cuentaDestinoId) ?? 0) + 1)
  }

  return {
    pasos,
    total,
    saldoFinal: saldo,
    sinImporte,
    cuentasRepetidas: [...vistas.entries()].filter(([, n]) => n > 1).map(([id]) => id),
    // ⚠️ Pagar de más NO frena: § 🚦, es un hecho del negocio que sólo el usuario conoce.
    pagaDeMas: saldo < -0.01,
    sePuedeGuardar: renglones.length > 0 && sinImporte.length === 0,
  }
}

/**
 * 🔘 **Cuánto poner en un renglón para que el botón «pagar saldo» lo complete.**
 *
 * Es lo que falta **teniendo en cuenta los otros renglones ya cargados**, no el saldo del período a
 * secas: si ya se anotó una parte a Lucrecia, «pagar el saldo» en el renglón de la caja tiene que
 * completar **el resto**, no repetir el total.
 *
 * @param cual  `"total"` o `"A"` — los dos botones que pidió el usuario
 * @param indice  el renglón que se está completando (se excluye de la suma)
 */
export function montoParaSaldo(
  saldos: SaldosDelPeriodo,
  renglones: RenglonPago[],
  indice: number,
  cual: "total" | "A",
): number {
  const otros = r2(renglones.reduce((s, x, i) => (i === indice ? s : s + (x.monto || 0)), 0))
  const objetivo = cual === "A" ? saldos.saldoA : saldos.saldoTotal
  // Nunca negativo: si los otros renglones ya cubren el objetivo, no hay nada que completar.
  return r2(Math.max(0, objetivo - otros))
}
