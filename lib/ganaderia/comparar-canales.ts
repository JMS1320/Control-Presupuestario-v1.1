/**
 * 🐂 **Contra qué canal se comparó el negocio que YA se hizo** — A-FEAT-99.
 *
 * ## Qué agrega esto sobre `comercializacion.ts`
 * Aquel compara opciones **hacia adelante**, con las normas de tabla: desbaste por banda de peso,
 * rinde por categoría. Sirve para decidir a quién venderle.
 *
 * Acá el punto de partida es otro: **una venta que ya se liquidó**. De ella se conoce lo que
 * realmente pasó —el rinde de verdad, el desbaste de verdad, el importe cobrado— y usar las normas
 * de tabla para ese lado convertiría la comparación en una ficción. El romaneo del 04/09 lo muestra:
 * la tabla dice que el gordo desbasta 8 % y rinde 58 %, y lo que pasó fue **3,69 % de desbaste** y
 * rindes de **58,51 % en toros contra 45,02 % en una vaca**.
 *
 * ## La regla del usuario que define el modelo
 * > **«El rinde es sólo de Arrebeef; el resto siempre es a kg vivo.»**
 *
 * Por eso los canales hipotéticos **no llevan rinde ni romaneo**: pagan por kilo vivo. El rinde
 * aparece de un solo lado, que es el único donde existe.
 *
 * ## Lo que los hace comparables
 * Todos se llevan a **$ por kilo vivo de origen** — el kilo que pesamos nosotros en el campo, antes
 * de que nadie lo mueva. Es la única medición que **no depende del canal**: el peso del camión, el
 * del frigorífico y el desbaste que cada uno aplica son parte de lo que se está comparando, así que
 * no pueden ser también la vara.
 *
 * ⚠️ **Nada se completa con cero.** Si falta un dato, el canal lo declara y **no puede ganar**: un
 * comparador que corona a una opción porque le falta el flete es peor que uno que dice qué le falta.
 */

export interface Faltable {
  /** Lo que impide confiar en el número. Vacío = está completo. */
  faltantes: string[]
}

export interface CanalComparado extends Faltable {
  nombre: string
  /** `real` = salió de una venta ya liquidada. `hipotetico` = es un escenario del usuario. */
  origen: "real" | "hipotetico"
  /** Kilos vivos **de origen**: los que pesamos nosotros. La vara común. */
  kgVivoOrigen: number
  /** Sobre cuántos kilos paga este canal, después de su desbaste. */
  kgQueSePagan: number
  pctDesbaste: number
  /** Sólo el que compra a la res. `null` en los que pagan a kilo vivo. */
  rinde: number | null
  precio: number | null
  bruto: number
  comision: number
  gastos: number
  flete: number
  /** Bruto − comisión − gastos − flete. */
  ingresa: number
  /** Días hasta el cobro. `0` = contra camión. */
  plazoDias: number
  /** `ingresa` traído a hoy con la tasa. Igual a `ingresa` cuando la tasa es 0. */
  ingresaHoy: number
  /** 🔑 **El número que permite comparar**: $ por kilo vivo de origen, neto de todo y traído a hoy. */
  porKgVivo: number | null
  detalle: { concepto: string; monto: number; nota?: string }[]
}

/**
 * Traer plata futura a hoy.
 *
 * El usuario nombró tres plazos distintos —*«Arrebeef 21 días · matarife contra camión · Cañuelas a
 * 21 días de remate»*— y comparar tres cobros en fechas distintas como si fueran el mismo peso
 * favorece siempre al que paga más tarde.
 *
 * 🔴 **La tasa arranca en CERO a propósito.** Poner una por mi cuenta cambiaría el ganador con un
 * número que el usuario no eligió. El campo existe desde el día 1 y vacío significa *«no descuentes»*
 * (§ Default del dato real, siempre editable): así el día que quiera usarla, está.
 */
export function valorPresente(monto: number, dias: number, tasaMensual = 0): number {
  if (!tasaMensual || dias <= 0) return monto
  return monto / Math.pow(1 + tasaMensual, dias / 30)
}

export interface CanalReal {
  nombre: string
  /** Lo que pesamos NOSOTROS en el campo. La vara. */
  kgVivoOrigen: number
  /** Kilos de carne del romaneo (la liquidación, que es la fuente completa). */
  kgCarne: number
  /** Lo que liquidó el frigorífico, antes de descuentos nuestros. */
  importeLiquidado: number
  comision?: number
  gastos?: number
  flete?: number
  plazoDias?: number
}

/**
 * El canal que **realmente pasó**, armado con lo medido y no con las normas.
 *
 * 🔑 El **rinde y el desbaste se DERIVAN**, no se suponen: el rinde es `kg carne ÷ kg vivo de
 * origen` y no hace falta preguntarlo. Es el mismo criterio del romaneo — el papel trae el importe
 * y los kilos, así que el precio y el rinde son consecuencia, no un dato que alguien tipea.
 */
export function canalReal(v: CanalReal, tasaMensual = 0): CanalComparado {
  const faltantes: string[] = []
  if (!v.kgVivoOrigen) faltantes.push("falta el peso que tomamos nosotros en el campo, que es la vara para comparar")
  if (!v.kgCarne) faltantes.push("faltan los kilos de carne del romaneo")

  const comision = v.comision ?? 0
  const gastos = v.gastos ?? 0
  const flete = v.flete ?? 0
  const bruto = v.importeLiquidado
  const ingresa = bruto - comision - gastos - flete
  const plazoDias = v.plazoDias ?? 0
  const ingresaHoy = valorPresente(ingresa, plazoDias, tasaMensual)
  const rinde = v.kgVivoOrigen > 0 ? v.kgCarne / v.kgVivoOrigen : null

  const detalle: { concepto: string; monto: number; nota?: string }[] = [
    { concepto: "Liquidado", monto: bruto, nota: `${Math.round(v.kgCarne).toLocaleString("es-AR")} kg de carne` },
  ]
  if (comision > 0) detalle.push({ concepto: "Comisión", monto: -comision })
  if (gastos > 0) detalle.push({ concepto: "Gastos", monto: -gastos })
  if (flete > 0) detalle.push({ concepto: "Flete", monto: -flete })
  detalle.push({ concepto: "INGRESA", monto: ingresa })
  if (ingresaHoy !== ingresa) {
    detalle.push({ concepto: `A hoy (${plazoDias} días)`, monto: ingresaHoy, nota: "traído con la tasa" })
  }

  return {
    nombre: v.nombre, origen: "real",
    kgVivoOrigen: v.kgVivoOrigen,
    // Paga por kilo de carne: el "desbaste" de este canal ya está adentro del rinde medido.
    kgQueSePagan: v.kgCarne,
    pctDesbaste: 0,
    rinde,
    precio: v.kgCarne > 0 ? bruto / v.kgCarne : null,
    bruto, comision, gastos, flete, ingresa, plazoDias, ingresaHoy,
    porKgVivo: faltantes.length === 0 && v.kgVivoOrigen > 0 ? ingresaHoy / v.kgVivoOrigen : null,
    detalle, faltantes,
  }
}

export interface CanalHipotetico {
  nombre: string
  kgVivoOrigen: number
  /** $/kg **vivo**: el resto de los canales no compra a la res (regla del usuario). */
  precioVivo: number | null
  /** El desbaste que se acordaría o que sucedería. `0,03` = 3 %. */
  pctDesbaste: number
  /** Comisión del que comercializa, sobre el bruto. */
  pctComision?: number
  /** Gasto propio del destino, sobre el bruto. */
  pctGastos?: number
  /** Monto absoluto: no es un porcentaje y no escala con el precio. */
  flete?: number
  plazoDias?: number
}

/**
 * Un canal **hipotético** — Cañuelas, un matarife zonal — a kilo vivo.
 *
 * Sin rinde y sin romaneo: *«el resto siempre es a kg vivo»*. Lo que se le pone es lo que el usuario
 * cree que pasaría: *«yo pongo precios según cómo yo creo que sucedería»*.
 */
export function canalHipotetico(c: CanalHipotetico, tasaMensual = 0): CanalComparado {
  const faltantes: string[] = []
  if (!c.kgVivoOrigen) faltantes.push("falta el peso de origen")
  if (c.precioVivo == null) faltantes.push(`falta el precio que pagaría ${c.nombre}`)

  const kgQueSePagan = c.kgVivoOrigen * (1 - c.pctDesbaste)
  const precio = c.precioVivo ?? 0
  const bruto = kgQueSePagan * precio
  const comision = bruto * (c.pctComision ?? 0)
  const gastos = bruto * (c.pctGastos ?? 0)
  const flete = c.flete ?? 0
  const ingresa = bruto - comision - gastos - flete
  const plazoDias = c.plazoDias ?? 0
  const ingresaHoy = valorPresente(ingresa, plazoDias, tasaMensual)

  const detalle: { concepto: string; monto: number; nota?: string }[] = [
    { concepto: "Kg vivo de origen", monto: c.kgVivoOrigen },
    { concepto: `Desbaste ${(c.pctDesbaste * 100).toFixed(2)} %`, monto: -(c.kgVivoOrigen - kgQueSePagan) },
    { concepto: "Bruto", monto: bruto, nota: `${Math.round(kgQueSePagan).toLocaleString("es-AR")} kg vivo × $${precio}` },
  ]
  if (comision > 0) detalle.push({ concepto: `Comisión ${((c.pctComision ?? 0) * 100).toFixed(2)} %`, monto: -comision })
  if (gastos > 0) detalle.push({ concepto: `Gastos ${((c.pctGastos ?? 0) * 100).toFixed(2)} %`, monto: -gastos })
  if (flete > 0) detalle.push({ concepto: "Flete", monto: -flete })
  detalle.push({ concepto: "INGRESA", monto: ingresa })
  if (ingresaHoy !== ingresa) {
    detalle.push({ concepto: `A hoy (${plazoDias} días)`, monto: ingresaHoy, nota: "traído con la tasa" })
  }

  return {
    nombre: c.nombre, origen: "hipotetico",
    kgVivoOrigen: c.kgVivoOrigen, kgQueSePagan,
    pctDesbaste: c.pctDesbaste,
    // 🔑 Sin rinde a propósito: este canal no compra a la res.
    rinde: null,
    precio: c.precioVivo,
    bruto, comision, gastos, flete, ingresa, plazoDias, ingresaHoy,
    porKgVivo: faltantes.length === 0 && c.kgVivoOrigen > 0 ? ingresaHoy / c.kgVivoOrigen : null,
    detalle, faltantes,
  }
}

export interface Comparacion {
  canales: CanalComparado[]
  /** El que más deja por kilo vivo, entre los completos. `null` si ninguno está completo. */
  mejor: CanalComparado | null
  /** La venta que realmente se hizo, si estaba entre los canales. */
  real: CanalComparado | null
  /**
   * Qué se dejó de ganar (o se ganó) contra el mejor hipotético. **Positivo = el real ganó.**
   * `null` cuando no hay con qué comparar.
   */
  contraElMejor: { diferencia: number; porKgVivo: number; contra: string } | null
  /** ⚠️ Los canales no comparten la vara: comparar sería mentir. */
  avisoVara: string | null
}

/**
 * Ordena los canales por lo que dejan **por kilo vivo**, y dice cuánto se dejó de ganar.
 *
 * ⚠️ **Los incompletos nunca ganan** y van al final. Y si dos canales no arrancan del mismo peso de
 * origen, la comparación **no es válida** —cada uno estaría midiendo otra hacienda— y se avisa en
 * vez de mostrar un ganador.
 */
export function compararCanales(canales: CanalComparado[]): Comparacion {
  const ordenados = [...canales].sort((a, b) => {
    if (a.faltantes.length !== b.faltantes.length) return a.faltantes.length - b.faltantes.length
    return (b.porKgVivo ?? -Infinity) - (a.porKgVivo ?? -Infinity)
  })
  const completos = ordenados.filter(c => c.faltantes.length === 0 && c.porKgVivo != null)
  const real = ordenados.find(c => c.origen === "real") ?? null

  const varas = new Set(canales.filter(c => c.kgVivoOrigen > 0).map(c => Math.round(c.kgVivoOrigen)))
  const avisoVara = varas.size > 1
    ? `Los canales no arrancan del mismo peso de origen (${[...varas].map(v => v.toLocaleString("es-AR")).join(" · ")} kg): así no se pueden comparar.`
    : null

  let contraElMejor: Comparacion["contraElMejor"] = null
  if (real && real.faltantes.length === 0 && !avisoVara) {
    const rival = completos.find(c => c !== real)
    if (rival) {
      contraElMejor = {
        diferencia: real.ingresaHoy - rival.ingresaHoy,
        porKgVivo: (real.porKgVivo ?? 0) - (rival.porKgVivo ?? 0),
        contra: rival.nombre,
      }
    }
  }

  return { canales: ordenados, mejor: avisoVara ? null : (completos[0] ?? null), real, contraElMejor, avisoVara }
}

/**
 * Los plazos de cobro que dio el usuario, para arrancar. **Todos editables.**
 *
 * *«Arrebeef son 21 días por default. Matarife es contra camión. Cañuelas es a 21 días de remate.
 * Pero deberían ser editables.»*
 */
export const PLAZOS_POR_DEFECTO: Record<string, number> = {
  arrebeef: 21,
  matarife: 0,   // «contra camión» = se cobra al entregar
  canuelas: 21,
}
