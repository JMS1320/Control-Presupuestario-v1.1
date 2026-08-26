// Consumo MEDIDO de un insumo — el lado real de la ración.
//
// ── Por qué existe ───────────────────────────────────────────────────────────
// `lib/productivo/racion.ts` estima cuánto van a comer: peso × % del peso vivo. Es una
// PROYECCIÓN, y es la que alimenta el presupuesto hacia adelante.
//
// Esto es lo otro: cuánto comieron DE VERDAD. Y no se estima, se mide:
//
//     consumo del tramo = lo que había + lo que entró − lo que quedó
//
// Los dos conviven y no compiten. Es el mismo idioma que ya usa la app en otros lados
// (`tc_presupuestado` / `tc_real`, `cantidad_calculada` / `cantidad`): el dato real es el
// default cuando existe, y la proyección queda como el presupuesto contra el que se compara.
//
// ── Las tres reglas del modelo (maqueta validada 2026-08-25/26) ──────────────
// 1. **Comprar no es consumir.** La compra entra a un stock; el costo es el consumo. Por eso
//    el sobrante se queda en el stock y no se le carga a nadie — y desaparece la necesidad de
//    inventariar en cada venta, que era el nudo del problema.
// 2. **Un corte existe cuando hay una MEDICIÓN, no cuando llega un camión.** Cada medición
//    corta un tramo. Con dos (apertura y cierre) hay un tramo; con cuatro, tres. Misma regla.
// 3. **La clave sólo reparte.** Como el total del tramo ya es real, las participaciones suman
//    1: cambiar el criterio de reparto no puede mover el total.
//
// Ver `MODULO_HACIENDA.md` § 14 y `PENDIENTES.md` § A-FEAT-43.

// ── Entradas ──────────────────────────────────────────────────────────────────

/** Lo que HABÍA a una fecha. Un nivel, no un movimiento. */
export interface Medicion {
  fecha: string
  cantidad: number
  notas?: string | null
}

/**
 * Una entrega recibida. **La fecha es la de RECEPCIÓN, no la de la factura.**
 *
 * No es un detalle: Longo facturó el 13/07 lo que había entregado el 24/06, y por 20,1 ton de
 * las 25 que entregó. Si el stock siguiera la fecha de factura, los tramos salen mal.
 */
export interface Entrega {
  fecha: string
  cantidad: number
  /** $ por unidad de ESTA entrega. Puede faltar si todavía no llegó la factura. */
  precioUnitario: number | null
  /** Para poder mostrar de dónde salió el número. */
  detalle?: string
}

/** Un grupo de animales que comió del mismo silo durante parte del tramo. */
export interface GrupoConsumidor {
  id: string
  nombre: string
  /**
   * Kilo-día del grupo dentro del tramo: Σ (cabezas × peso × días presentes).
   *
   * La clave es kilo-día **siempre**, tanto si la ración se sirve por día como a discreción.
   * El usuario lo fijó así: *"cuando se da la ración diaria se sabe que los más pesados comen
   * más que los livianos — no es invento mío"*. Y una sola regla, porque *"en la app yo no
   * puedo variar formas de cálculo en vivo"*.
   *
   * ⚠️ Va en **peso VIVO (bruto)**: el animal come según lo que pesa parado. El desbaste es
   * para la plata, no para la comida.
   */
  kiloDia: number
}

// ── Salidas ───────────────────────────────────────────────────────────────────

export interface RepartoGrupo {
  grupoId: string
  nombre: string
  kiloDia: number
  /** Fracción del tramo que le toca. Los `participacion` de un tramo suman 1. */
  participacion: number
  cantidad: number
  costo: number | null
}

export interface TramoConsumo {
  desde: string
  hasta: string
  dias: number
  /** Lo que había al abrir el tramo. */
  saldoInicial: number
  entregas: Entrega[]
  cantidadEntregada: number
  /** Lo que quedó al cerrarlo. */
  saldoFinal: number
  /** `inicial + entregas − final`. Es el número REAL, no una estimación. */
  consumo: number
  /**
   * $ por unidad del tramo. Sale de las entregas que entraron **en este tramo**, ponderadas.
   *
   * Un promedio del período entero le cargaría a lo vendido en agosto el maíz comprado en
   * septiembre. `null` cuando falta el precio de alguna entrega — y entonces el costo no se
   * inventa: se informa que falta.
   */
  precioUnitario: number | null
  /** `null` si falta algún precio. Nunca cero: cero es un número y "no sé" es otra cosa. */
  costo: number | null
  reparto: RepartoGrupo[]
  /** Lo que impide confiar en este tramo. Vacío = está completo. */
  faltantes: string[]
}

export interface ResultadoConsumo {
  tramos: TramoConsumo[]
  consumoTotal: number
  costoTotal: number | null
  /** Lo que se compró en todo el período, esté consumido o no. */
  compradoTotal: number
  /** Lo que quedó en el stock al final. No es costo de nadie: es un activo. */
  remanente: number
  faltantes: string[]
  controles: Control[]
}

/**
 * Un control es una identidad que tiene que cerrar. Se muestra SIEMPRE, cierre o no:
 * un control que nadie ve no es un control.
 */
export interface Control {
  nombre: string
  izquierda: number
  derecha: number
  diferencia: number
  cierra: boolean
  detalle: string
}

// ── Cálculo ───────────────────────────────────────────────────────────────────

const dias = (a: string, b: string) =>
  Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)

/** Redondeo a la milésima, para que los controles no fallen por el error de punto flotante. */
const r3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * Parte el período en tramos según las mediciones y calcula el consumo real de cada uno.
 *
 * `grupoDe(tramo)` devuelve los grupos que comieron en ese tramo con su kilo-día. Se pide por
 * tramo y no una vez, porque los grupos cambian: los vendidos dejan de comer.
 *
 * ⚠️ **Una entrega que llega EL DÍA del corte pertenece al tramo SIGUIENTE.** El stock se mide
 * al recibirla, antes de descargar: si se contara en el tramo que cierra, aparecería como
 * consumida sin haber entrado al silo.
 */
export function calcularConsumo(
  mediciones: Medicion[],
  entregas: Entrega[],
  grupoDe: (desde: string, hasta: string) => GrupoConsumidor[],
): ResultadoConsumo {
  const ms = [...mediciones].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const faltantes: string[] = []

  if (ms.length < 2) {
    faltantes.push(ms.length === 0
      ? 'no hay ninguna medición de stock: sin eso el consumo no se puede medir, sólo estimar'
      : 'hay una sola medición: hace falta al menos el cierre para saber cuánto se consumió')
    const comprado = entregas.reduce((s, e) => s + e.cantidad, 0)
    return {
      tramos: [], consumoTotal: 0, costoTotal: null,
      compradoTotal: r3(comprado), remanente: r3(comprado),
      faltantes, controles: [],
    }
  }

  const tramos: TramoConsumo[] = []

  for (let i = 0; i < ms.length - 1; i++) {
    const ini = ms[i]!
    const fin = ms[i + 1]!
    const propias = entregas
      .filter(e => e.fecha >= ini.fecha && e.fecha < fin.fecha)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))

    const cantidadEntregada = propias.reduce((s, e) => s + e.cantidad, 0)
    const consumo = r3(ini.cantidad + cantidadEntregada - fin.cantidad)

    const falta: string[] = []
    if (consumo < 0) {
      falta.push(`el consumo da negativo (${consumo}): sobra stock al cerrar, falta declarar una entrega`)
    }

    // Precio del tramo: ponderado por las entregas que entraron acá.
    const sinPrecio = propias.filter(e => e.precioUnitario == null)
    let precioUnitario: number | null = null
    if (sinPrecio.length > 0) {
      falta.push(`${sinPrecio.length} ${sinPrecio.length === 1 ? 'entrega' : 'entregas'} sin precio (falta la factura)`)
    } else if (cantidadEntregada > 0) {
      precioUnitario = propias.reduce((s, e) => s + e.cantidad * (e.precioUnitario ?? 0), 0) / cantidadEntregada
    } else if (i > 0) {
      // Tramo sin entregas: se consume lo que quedó del anterior, a su precio.
      precioUnitario = tramos[i - 1]?.precioUnitario ?? null
      if (precioUnitario == null) falta.push('no entró nada en el tramo y el anterior tampoco tiene precio')
    } else {
      falta.push('el primer tramo no tiene entregas: falta el precio del stock de apertura')
    }

    const costo = precioUnitario == null ? null : r3(consumo * precioUnitario)

    // ── El reparto. La clave sólo distribuye: las participaciones suman 1.
    const grupos = grupoDe(ini.fecha, fin.fecha)
    const totalKD = grupos.reduce((s, g) => s + g.kiloDia, 0)
    if (grupos.length === 0) {
      falta.push('no hay ningún grupo declarado comiendo en este tramo')
    } else if (totalKD <= 0) {
      falta.push('los grupos suman kilo-día cero: falta el peso o los días')
    }
    const reparto: RepartoGrupo[] = grupos.map(g => {
      const participacion = totalKD > 0 ? g.kiloDia / totalKD : 0
      return {
        grupoId: g.id, nombre: g.nombre, kiloDia: g.kiloDia, participacion,
        cantidad: r3(consumo * participacion),
        costo: costo == null ? null : r3(costo * participacion),
      }
    })

    tramos.push({
      desde: ini.fecha, hasta: fin.fecha, dias: dias(ini.fecha, fin.fecha),
      saldoInicial: ini.cantidad,
      entregas: propias, cantidadEntregada: r3(cantidadEntregada),
      saldoFinal: fin.cantidad,
      consumo, precioUnitario, costo, reparto,
      faltantes: falta,
    })
  }

  for (const t of tramos) {
    for (const f of t.faltantes) faltantes.push(`${t.desde} → ${t.hasta}: ${f}`)
  }

  const consumoTotal = r3(tramos.reduce((s, t) => s + t.consumo, 0))
  const costoTotal = tramos.some(t => t.costo == null)
    ? null
    : r3(tramos.reduce((s, t) => s + (t.costo ?? 0), 0))
  const compradoTotal = r3(entregas.reduce((s, e) => s + e.cantidad, 0))
  const remanente = ms[ms.length - 1]!.cantidad

  return {
    tramos, consumoTotal, costoTotal, compradoTotal, remanente,
    faltantes,
    controles: controlesDe(tramos, ms, entregas, consumoTotal, compradoTotal),
  }
}

/**
 * Los controles que tienen que cerrar. Son identidades, no opiniones.
 *
 * El mejor control es el camino inverso: recalcular al revés y comparar. Por eso el de
 * cantidades va del stock, y el del reparto va de los grupos hacia el total.
 */
function controlesDe(
  tramos: TramoConsumo[], ms: Medicion[], entregas: Entrega[],
  consumoTotal: number, compradoTotal: number,
): Control[] {
  const out: Control[] = []
  const cerca = (a: number, b: number) => Math.abs(a - b) < 0.5

  // 1 · La cantidad, punta a punta. Lo que había al principio más lo que entró tiene que ser
  //     lo consumido más lo que queda. Es la identidad que hace real al total.
  const apertura = ms[0]!.cantidad
  const cierre = ms[ms.length - 1]!.cantidad
  // Sólo las entregas que caen DENTRO del período medido: una anterior a la apertura ya está
  // adentro de ese saldo, y contarla otra vez la duplicaría.
  const dentro = entregas
    .filter(e => e.fecha >= ms[0]!.fecha && e.fecha < ms[ms.length - 1]!.fecha)
    .reduce((s, e) => s + e.cantidad, 0)
  const izq = r3(apertura + dentro)
  const der = r3(consumoTotal + cierre)
  out.push({
    nombre: 'Cantidad punta a punta',
    izquierda: izq, derecha: der, diferencia: r3(izq - der), cierra: cerca(izq, der),
    detalle: 'lo que había + lo que entró = lo consumido + lo que queda',
  })

  // 2 · El reparto no puede crear ni perder: los grupos de cada tramo suman el tramo.
  const repartido = r3(tramos.reduce((s, t) => s + t.reparto.reduce((x, g) => x + g.cantidad, 0), 0))
  out.push({
    nombre: 'El reparto suma el consumo',
    izquierda: repartido, derecha: consumoTotal,
    diferencia: r3(repartido - consumoTotal), cierra: cerca(repartido, consumoTotal),
    detalle: 'la suma de todos los grupos, en todos los tramos, es el consumo total',
  })

  // 3 · Lo comprado se explica entero: o se consumió, o está en el stock. Nada se evapora.
  const explicado = r3(consumoTotal + cierre - apertura)
  out.push({
    nombre: 'Lo comprado está explicado',
    izquierda: compradoTotal, derecha: explicado,
    diferencia: r3(compradoTotal - explicado), cierra: cerca(compradoTotal, explicado),
    detalle: 'todo lo que entró está consumido o en el stock — nada se pierde por el camino',
  })

  return out
}

/**
 * El % del peso vivo que resultó de verdad. **Sale de dividir, no se carga.**
 *
 * Es el mismo número que `actividades.racion_pct_pv` usa para PROYECTAR, pero al revés: allá
 * es un supuesto, acá es un resultado. Y como resultado sirve de control — con los datos reales
 * de la recría 2026 dio 1,07 / 1,46 / 1,54 %, creciente y coherente. Si diera 0,4 %, falta una
 * entrega; si diera 6 %, sobra.
 *
 * ⚠️ Sobre el kilo-día del rodeo ENTERO, no el de un grupo.
 */
export function pctPesoVivoReal(consumo: number, kiloDiaTotal: number): number | null {
  return kiloDiaTotal > 0 ? consumo / kiloDiaTotal : null
}

/**
 * Kilo-día de un grupo entre dos fechas.
 *
 * `presencia` describe cuántas cabezas hubo y con qué peso en cada sub-período: los animales
 * entran, mueren y se venden, así que ni las cabezas ni el peso son constantes.
 */
export function kiloDia(
  presencia: { desde: string; hasta: string; cabezas: number; pesoPromedioKg: number }[],
): number {
  return presencia.reduce((s, p) => {
    const d = dias(p.desde, p.hasta)
    return d > 0 ? s + p.cabezas * p.pesoPromedioKg * d : s
  }, 0)
}
