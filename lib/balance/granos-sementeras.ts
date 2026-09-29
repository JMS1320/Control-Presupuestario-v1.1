/**
 * 🌾 GRANOS Y SEMENTERAS AL CIERRE — A-FEAT-1184.
 *
 * Los dos papeles que en el estudio del 2026-09-28 figuraban como *«no tienen de dónde salir»*.
 * Ahora salen **en la parte que la app sabe**, con lo que falta **declarado y con su lugar para
 * cargarlo** — no inventado.
 *
 * ## 🧮 Granos: la gracia no es la valuación, es EL CUADRE DE KILOS
 *
 * En su planilla, al lado de la valuación hay un cuadre que **no cierra y él lo deja escrito**:
 *
 * ```
 * stock inicio (DDJJ)   305.133
 * + cosecha             232.150
 * − ventas del ejercicio 308.741
 * − venta extra         219.230
 * = saldo                 9.312
 * − stock según empresa  -6.926
 * = DIFERENCIA            2.386   ← no cierra, y queda a la vista
 * ```
 *
 * 🔑 **Eso es exactamente la § 🧮 de `CLAUDE.md`**: el número global avisa que algo pasa y la lista
 * deja arreglarlo. Acá se reproduce igual: **la diferencia se muestra, no se fuerza a cero**.
 *
 * ⚠️ **De las cinco entradas, la app hoy sabe UNA**: las ventas. El stock inicial y la cosecha no
 * están en ninguna tabla, así que se cargan a mano y el cuadre lo dice.
 *
 * ## 🌱 Sementeras: es el costo SEMBRADO y todavía no cosechado
 *
 * Sale de las **órdenes agrícolas ejecutadas** hasta el cierre: qué se aplicó, cuánto y en qué
 * lotes. El detalle físico está completo; **el costo no**, porque los insumos no tienen precio
 * cargado (mismo hueco que el stock de insumos) y las labores no tienen tarifa.
 *
 * 🛑 **Una orden `planificada` NO es costo.** Todavía no se gastó nada: contarla inflaría el
 * activo con algo que no ocurrió. Y una `eliminada` tampoco. Sólo `ejecutada`.
 */

// ════════════════════════════════════════════════════════════════════════════
// GRANOS
// ════════════════════════════════════════════════════════════════════════════

/** Las cinco entradas del cuadre. En toneladas. */
export interface EntradasGranos {
  /** Existencia al inicio del ejercicio. **Hoy se carga a mano.** */
  stockInicioTn: number | null
  /** Lo cosechado en el ejercicio. **Hoy se carga a mano.** */
  cosechaTn: number | null
  /** Lo vendido. **Esto sí lo sabe la app**, de los comprobantes de venta. */
  ventasTn: number
  /** La existencia que declara la empresa al cierre. **Hoy se carga a mano.** */
  stockEmpresaTn: number | null
}

export interface CuadreGranos {
  stockInicioTn: number | null
  cosechaTn: number | null
  ventasTn: number
  /** `inicio + cosecha − ventas`. `null` si falta alguna entrada. */
  saldoTn: number | null
  stockEmpresaTn: number | null
  /** `saldo − stock de la empresa`. **Se muestra aunque no dé cero.** */
  diferenciaTn: number | null
  /** true = el cuadre cierra dentro de la tolerancia. */
  cierra: boolean
  /** Qué entradas faltan para poder cuadrar, en palabras. */
  faltan: string[]
}

/** Cómo se valúa, con las mismas fórmulas de su planilla. */
export interface ValuacionGranos {
  toneladas: number
  precioPorTn: number | null
  /** `tn × precio`. */
  montoBruto: number | null
  /** El castigo de calidad, como coeficiente: 1 = sin castigo. */
  pctCalidad: number
  /** `bruto × %calidad`. */
  montoNeto: number | null
  /** Comisión + flete + otros, como coeficiente sobre el bruto. */
  pctCz: number
  /** `neto − bruto × %CZ`. Es el número que va al papel. */
  netoFinal: number | null
  esHueco: boolean
}

/**
 * Tolerancia del cuadre, en toneladas.
 *
 * 📌 No es cero a propósito: se pesa en balanza y se redondea en cada operación. Lo que importa
 * es que la diferencia **se vea**, no que sea exactamente cero — en su planilla 2025 fue de
 * 2,386 tn y la dejó escrita.
 */
export const TOLERANCIA_TN = 0.5

const redondear = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d

export function cuadrarGranos(e: EntradasGranos): CuadreGranos {
  const faltan: string[] = []
  if (e.stockInicioTn == null) faltan.push("el stock al inicio del ejercicio")
  if (e.cosechaTn == null) faltan.push("lo cosechado en el ejercicio")
  if (e.stockEmpresaTn == null) faltan.push("la existencia declarada al cierre")

  const sePuede = e.stockInicioTn != null && e.cosechaTn != null
  const saldoTn = sePuede ? redondear(e.stockInicioTn! + e.cosechaTn! - e.ventasTn, 3) : null
  const diferenciaTn = saldoTn != null && e.stockEmpresaTn != null
    ? redondear(saldoTn - e.stockEmpresaTn, 3)
    : null

  return {
    stockInicioTn: e.stockInicioTn, cosechaTn: e.cosechaTn, ventasTn: e.ventasTn,
    saldoTn, stockEmpresaTn: e.stockEmpresaTn, diferenciaTn,
    // Sin todas las entradas NO se declara que cierra: eso sería un verde falso.
    cierra: diferenciaTn != null && Math.abs(diferenciaTn) <= TOLERANCIA_TN,
    faltan,
  }
}

/**
 * Valúa el stock de granos con las fórmulas de su planilla:
 * `bruto = tn × precio` · `neto = bruto × %calidad` · `final = neto − bruto × %CZ`.
 */
export function valuarGranos(
  toneladas: number,
  precioPorTn: number | null,
  pctCalidad = 1,
  pctCz = 0,
): ValuacionGranos {
  if (precioPorTn == null || precioPorTn <= 0) {
    return {
      toneladas, precioPorTn: null, montoBruto: null, pctCalidad,
      montoNeto: null, pctCz, netoFinal: null, esHueco: true,
    }
  }
  const montoBruto = redondear(toneladas * precioPorTn)
  const montoNeto = redondear(montoBruto * pctCalidad)
  return {
    toneladas, precioPorTn, montoBruto, pctCalidad, montoNeto, pctCz,
    netoFinal: redondear(montoNeto - montoBruto * pctCz),
    esHueco: false,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SEMENTERAS
// ════════════════════════════════════════════════════════════════════════════

/** Una orden agrícola con sus líneas de insumo. */
export interface OrdenAgricola {
  id: string
  fecha: string | null
  lote: string
  hectareas: number
  /** `ejecutada` · `planificada` · `eliminada`. **Sólo la primera es costo.** */
  estado: string
  lineas: Array<{
    insumo: string
    cantidad: number | null
    unidad: string
    /** Precio unitario si existe. Hoy, en la práctica, siempre `null`. */
    precioUnitario: number | null
  }>
}

export interface LineaSementera {
  fecha: string | null
  lote: string
  hectareas: number
  insumo: string
  cantidad: number | null
  unidad: string
  precioUnitario: number | null
  costo: number | null
  esHueco: boolean
}

export interface Sementeras {
  lineas: LineaSementera[]
  /** Hectáreas trabajadas en las órdenes ejecutadas, sin repetir el lote. */
  hectareas: number
  ordenesEjecutadas: number
  /** Órdenes que NO se cuentan, y por qué. Se informan para que no parezca que se perdieron. */
  ordenesNoContadas: Array<{ lote: string; fecha: string | null; estado: string; motivo: string }>
  costo: number
  huecos: LineaSementera[]
  /** Lo que falta para que el costo esté completo, en palabras. */
  faltan: string[]
}

/**
 * Arma la sementera al cierre.
 *
 * 🛑 **Sólo cuenta las órdenes `ejecutada` con fecha ≤ cierre.** Una `planificada` todavía no
 * costó nada y contarla inflaría el activo con un gasto que no ocurrió; una `eliminada` no existió.
 * Las dos se informan en `ordenesNoContadas` para que se vea **que se miraron y por qué quedaron
 * afuera** — no que se perdieron.
 */
export function armarSementeras(ordenes: OrdenAgricola[], fechaCierre: string): Sementeras {
  const lineas: LineaSementera[] = []
  const noContadas: Sementeras["ordenesNoContadas"] = []
  const lotes = new Map<string, number>()
  let ejecutadas = 0

  for (const o of ordenes) {
    const estado = (o.estado ?? "").toLowerCase()
    if (estado !== "ejecutada") {
      noContadas.push({
        lote: o.lote, fecha: o.fecha, estado: o.estado,
        motivo: estado === "planificada"
          ? "todavía no se ejecutó: no es costo incurrido"
          : "no se ejecutó",
      })
      continue
    }
    if (!o.fecha || o.fecha > fechaCierre) {
      noContadas.push({
        lote: o.lote, fecha: o.fecha, estado: o.estado,
        motivo: o.fecha ? "es posterior al cierre" : "no tiene fecha",
      })
      continue
    }

    ejecutadas++
    lotes.set(o.lote, o.hectareas)
    for (const l of o.lineas) {
      const precio = l.precioUnitario != null && l.precioUnitario > 0 ? l.precioUnitario : null
      const costo = precio != null && l.cantidad != null ? redondear(l.cantidad * precio) : null
      lineas.push({
        fecha: o.fecha, lote: o.lote, hectareas: o.hectareas,
        insumo: l.insumo, cantidad: l.cantidad, unidad: l.unidad,
        precioUnitario: precio, costo, esHueco: costo == null,
      })
    }
  }

  const huecos = lineas.filter(l => l.esHueco)
  const faltan: string[] = []
  if (huecos.length > 0) {
    faltan.push(`el precio de ${huecos.length} línea(s) de insumo`)
  }
  // Las labores no tienen tarifa en ninguna tabla: sin eso, el costo de sementera está incompleto
  // aunque todos los insumos tuvieran precio. Decirlo evita un total que parece completo.
  faltan.push("la tarifa de las labores (siembra, pulverización): no hay dónde cargarla todavía")

  return {
    lineas,
    hectareas: redondear([...lotes.values()].reduce((s, h) => s + h, 0)),
    ordenesEjecutadas: ejecutadas,
    ordenesNoContadas: noContadas,
    costo: redondear(lineas.reduce((s, l) => s + (l.costo ?? 0), 0)),
    huecos, faltan,
  }
}
