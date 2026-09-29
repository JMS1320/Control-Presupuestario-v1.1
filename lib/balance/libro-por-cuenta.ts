/**
 * 📗 **El libro diario agrupado POR CUENTA CONTABLE — el formato del usuario.**
 *
 * Pedido explícito 2026-09-29:
 * > *«Seguí con los subdiarios. Cabe aclarar que **va por cuenta contable ordenado y totalizado**.
 * > Eso lo has visto, ¿verdad? Como no tenemos todo imputado a las cuentas, deberás dejarme como
 * > **no imputado** y los totales.»*
 *
 * ## 🔑 El formato NO se invento: se copio del suyo
 *
 * Sale de la solapa **«Excel - Compras»** de su `Libro Diario 24-25.xlsx`, que es la que él armaba a
 * mano cada mes. Columna por columna:
 *
 * ```
 * Año | Mes | Cuenta Contable | Suma de Neto Gravado | Suma de No Gravado | Suma de Exento |
 * Otros Tributos | Suma de IVA | Suma de Total | Diferencia Entre Total y suma de columnas
 * ```
 *
 * …con una fila **«Total general»** por mes y una **«Control»** al final. Se respeta hasta el nombre
 * de las columnas, porque es lo que él y el contador ya saben leer.
 *
 * ⚠️ **El error de esta semana fue inventar un formato teniendo el suyo a mano.** No se repite.
 *
 * ## 📌 Dos cosas que él dejó anotadas en su planilla y hay que conservar
 *
 * 1. **«Otros tributos» va al GASTO, no a percepciones.** Textual de su nota: *«dijimos que "otros
 *    tributos" lo mandaríamos al gasto, ya que contiene varios impuestos que NO son percepciones,
 *    pero sí a veces pueden estar mezcladas ahí dentro; a su vez las percepciones las tomarían uds
 *    de ARCA y las restarían aparte»*. O sea: la columna existe, se informa aparte, y **no se
 *    intenta separar las percepciones acá**.
 * 2. **El control contra la DDJJ de IVA.** En la fila «Total general» de cada mes él ponía, a mano,
 *    el neto gravado de la DDJJ y el exento+no gravado+monotributo del Libro IVA, y restaba: *«si da
 *    cero la diferencia está ok»*. Es el **camino inverso** de § 🧮, y el mejor control que hay acá.
 *    Se dejan **las dos columnas preparadas y vacías** para que las llene — no se inventa el número,
 *    porque sale de la DDJJ y la app no la tiene.
 *
 * ## 🕳️ Y lo que este formato NO es: el asiento con Debe y Haber
 *
 * Su otra solapa —**«Resumen Contador - sistema»**— es el libro diario de verdad: `Año | Mes | Tipo |
 * Cta. Contable | Detalle | Debe | Haber`, por **número** de cuenta, con `11101 CAJA`,
 * `112101 IVA CREDITO FISCAL`, `21101 CUENTAS CORRIENTES`. **Eso lo exportaba el sistema anterior y
 * hoy no lo podemos dar**, porque la app no lleva cuentas patrimoniales: sabe a qué cuenta de
 * resultado va un gasto, no contra qué cuenta de caja o de proveedores se acredita.
 *
 * 👉 Está dicho acá para que no se confunda una cosa con la otra: lo de abajo es **la apertura por
 * cuenta**, que es la mitad que sí tenemos y la que él usaba para chequear totales.
 */
import type { AsientoLibroDiario } from "./libro-diario"
import { TIPOS_SIN_CREDITO_COMPRAS, TIPOS_SIN_CREDITO_VENTAS } from "@/lib/subdiarios/cuadratura"

export { TIPOS_SIN_CREDITO_COMPRAS, TIPOS_SIN_CREDITO_VENTAS }

/** La etiqueta de lo que todavía no tiene cuenta contable. Se escribe UNA vez. */
export const SIN_IMPUTAR = "NO IMPUTADO"

export interface FilaPorCuenta {
  anio: number
  mes: number
  /** Nombre de la cuenta como se imputó, o `NO IMPUTADO`. */
  cuenta: string
  /** El número del plan de cuentas, si lo tiene. Vacío en lo no imputado. */
  nroCuenta: string
  comprobantes: number
  netoGravado: number
  noGravado: number
  exento: number
  otrosTributos: number
  iva: number
  /**
   * 🧾 **Lo que NO se abre por columnas: las Fac B y C.**
   *
   * Una factura B o C no discrimina IVA, así que su total **no se descompone** en neto + IVA: va
   * entero acá. Los tipos son los de `lib/subdiarios/cuadratura` —los mismos que usa el control de
   * los subdiarios—, **no una lista nueva**: dos listas de «qué no da crédito fiscal» que algún día
   * difieran es exactamente el bug que nadie encuentra.
   *
   * 🧨 **Sin esta columna la Diferencia mentía a lo grande.** La primera versión no la tenía y el
   * ejercicio 25/26 de MSA marcaba **$25.948.119,79** de descuadre, con junio solo en $17,8 M —
   * no era un descuadre, eran las Fac B y C contadas como si abrieran. El control existente ya
   * tenía la regla bien; yo la volví a escribir de memoria y la escribí mal.
   */
  sinCredito: number
  total: number
  /**
   * `Total − (neto + no gravado + exento + otros tributos + IVA + sin crédito fiscal)`.
   *
   * 🔑 **Es la columna «Diferencia» de su planilla, y es un control de INTEGRIDAD** (§ 🚦): las
   * partes tienen que sumar el total que el propio comprobante declara. Si no da cero, el papel se
   * contradice solo. En su planilla daba centavos de redondeo, y un mes dio $101.257,67 — que es la
   * clase de número que esta columna existe para encontrar.
   */
  diferencia: number
  /** `false` en la fila de lo no imputado. Las filas de total no la usan. */
  imputada: boolean
}

export interface MesPorCuenta {
  anio: number
  mes: number
  /** Las cuentas del mes, ordenadas, con **`NO IMPUTADO` siempre al final**. */
  filas: FilaPorCuenta[]
  /** La fila «Total general» del mes. */
  total: FilaPorCuenta
}

export interface LibroPorCuenta {
  meses: MesPorCuenta[]
  /** El «Total general» de todo el ejercicio. */
  totalGeneral: FilaPorCuenta
  /** Lo que falta imputar, para saber cuánto trabajo queda antes de entregar. */
  sinImputar: {
    comprobantes: number
    total: number
    /** Sobre el total del ejercicio. `0` si no hay nada que imputar. */
    porcentaje: number
    /** Los meses donde aparece, para saber por dónde empezar. */
    meses: string[]
  }
}

const cero = (): Omit<FilaPorCuenta, "anio" | "mes" | "cuenta" | "nroCuenta" | "imputada"> => ({
  comprobantes: 0, netoGravado: 0, noGravado: 0, exento: 0,
  otrosTributos: 0, iva: 0, sinCredito: 0, total: 0, diferencia: 0,
})

function sumarEn(acc: FilaPorCuenta, a: AsientoLibroDiario, tiposSinCredito: number[]): void {
  acc.comprobantes += 1
  acc.total += a.total
  // Una Fac B o C no discrimina: su total entero va a «sin crédito fiscal» y no se abre.
  if (a.tipo != null && tiposSinCredito.includes(Number(a.tipo))) {
    acc.sinCredito += a.total
    return
  }
  acc.netoGravado += a.neto_gravado
  acc.noGravado += a.no_gravado
  acc.exento += a.exento
  acc.otrosTributos += a.otros_tributos
  acc.iva += a.iva
}

/** Dos decimales. Sin esto las sumas dejan colas de centavo que la columna Diferencia delata. */
const r2 = (n: number) => Math.round(n * 100) / 100

function cerrar(f: FilaPorCuenta): FilaPorCuenta {
  f.netoGravado = r2(f.netoGravado)
  f.noGravado = r2(f.noGravado)
  f.exento = r2(f.exento)
  f.otrosTributos = r2(f.otrosTributos)
  f.iva = r2(f.iva)
  f.sinCredito = r2(f.sinCredito)
  f.total = r2(f.total)
  f.diferencia = r2(
    f.total - (f.netoGravado + f.noGravado + f.exento + f.otrosTributos + f.iva + f.sinCredito),
  )
  return f
}

/**
 * Arma la apertura por cuenta contable de un conjunto de asientos.
 *
 * El corte es **el subdiario** (`a.subdiario`, formato `2026-06`), no la fecha del comprobante:
 * es la regla del ejercicio y la razón de que exista la provisión de facturas.
 *
 * @param asientos        compras o ventas de un ejercicio, ya filtradas
 * @param tiposSinCredito los tipos que no discriminan IVA. **Difieren entre compras y ventas**:
 *                        en compras una Fac B tampoco da crédito, en ventas sí genera débito.
 *                        Por eso se pasa y no se asume — usar el de compras en ventas contaría
 *                        como «sin crédito» plata que sí abre.
 */
export function armarLibroPorCuenta(
  asientos: AsientoLibroDiario[],
  tiposSinCredito: number[] = TIPOS_SIN_CREDITO_COMPRAS,
): LibroPorCuenta {
  // Clave: año-mes del subdiario → cuenta.
  const porMes = new Map<string, Map<string, FilaPorCuenta>>()

  for (const a of asientos) {
    const [anioStr, mesStr] = a.subdiario.split("-")
    const anio = Number(anioStr)
    const mes = Number(mesStr)
    // ⚠️ Un subdiario ilegible no se descarta en silencio (§ 🧮): cae en el mes 0, que salta a la
    //    vista en la planilla. Tirarlo haría que los totales no cerraran sin decir por qué.
    const clave = `${Number.isFinite(anio) ? anio : 0}-${String(Number.isFinite(mes) ? mes : 0).padStart(2, "0")}`

    const cuentas = porMes.get(clave) ?? new Map<string, FilaPorCuenta>()
    const imputada = Boolean(a.cuenta_contable?.trim())
    const nombre = imputada ? a.cuenta_contable.trim() : SIN_IMPUTAR

    const fila = cuentas.get(nombre) ?? {
      anio: Number.isFinite(anio) ? anio : 0,
      mes: Number.isFinite(mes) ? mes : 0,
      cuenta: nombre,
      nroCuenta: imputada ? (a.nro_cuenta || "").trim() : "",
      imputada,
      ...cero(),
    }
    // Si la misma cuenta llega con y sin número, gana el que lo tenga: el número es el identificador
    // del plan de cuentas y el nombre es sólo la etiqueta (ver el plan de cuentas, texto → número).
    if (imputada && !fila.nroCuenta && a.nro_cuenta) fila.nroCuenta = a.nro_cuenta.trim()

    sumarEn(fila, a, tiposSinCredito)
    cuentas.set(nombre, fila)
    porMes.set(clave, cuentas)
  }

  const meses: MesPorCuenta[] = []
  for (const clave of [...porMes.keys()].sort()) {
    const cuentas = porMes.get(clave)!
    const [anio, mes] = clave.split("-").map(Number)

    const filas = [...cuentas.values()]
      .map(cerrar)
      .sort((a, b) => {
        // 🔑 `NO IMPUTADO` va SIEMPRE al final del mes, pegado al total: es lo que falta hacer y
        //    tiene que quedar a la vista, no perdido en orden alfabético entre las cuentas buenas.
        if (a.cuenta === SIN_IMPUTAR) return 1
        if (b.cuenta === SIN_IMPUTAR) return -1
        return a.cuenta.localeCompare(b.cuenta, "es")
      })

    const total: FilaPorCuenta = {
      anio, mes, cuenta: "Total general", nroCuenta: "", imputada: true, ...cero(),
    }
    for (const f of filas) {
      total.comprobantes += f.comprobantes
      total.netoGravado += f.netoGravado
      total.noGravado += f.noGravado
      total.exento += f.exento
      total.otrosTributos += f.otrosTributos
      total.iva += f.iva
      total.sinCredito += f.sinCredito
      total.total += f.total
    }
    meses.push({ anio, mes, filas, total: cerrar(total) })
  }

  const totalGeneral: FilaPorCuenta = {
    anio: 0, mes: 0, cuenta: "Total general", nroCuenta: "", imputada: true, ...cero(),
  }
  for (const m of meses) {
    totalGeneral.comprobantes += m.total.comprobantes
    totalGeneral.netoGravado += m.total.netoGravado
    totalGeneral.noGravado += m.total.noGravado
    totalGeneral.exento += m.total.exento
    totalGeneral.otrosTributos += m.total.otrosTributos
    totalGeneral.iva += m.total.iva
    totalGeneral.sinCredito += m.total.sinCredito
    totalGeneral.total += m.total.total
  }
  cerrar(totalGeneral)

  const filasSin = meses.flatMap(m => m.filas.filter(f => f.cuenta === SIN_IMPUTAR))
  const totalSin = r2(filasSin.reduce((s, f) => s + f.total, 0))
  const sinImputar = {
    comprobantes: filasSin.reduce((s, f) => s + f.comprobantes, 0),
    total: totalSin,
    porcentaje: totalGeneral.total === 0 ? 0 : r2((totalSin / totalGeneral.total) * 100),
    meses: filasSin.map(f => `${String(f.mes).padStart(2, "0")}/${f.anio}`),
  }

  return { meses, totalGeneral, sinImputar }
}
