/**
 * 📗 EL EXCEL DE LOS PAPELES DE TRABAJO — A-FEAT-1184.
 *
 * Arma el archivo que se le manda al contador. **Una solapa por papel**, como el usuario los venía
 * mandando a mano, para que del otro lado no haya que aprender nada nuevo.
 *
 * ## 🧮 La primera solapa es el CONTROL, y eso es a propósito
 *
 * No es un anexo al final: es **lo primero que se abre**. Si el libro no se puede entregar, hay que
 * enterarse antes de mirar ningún número, no después de mandarlo (§ 🧮 de `CLAUDE.md`: *el control
 * se ve, y es proporcional*).
 *
 * ## ⚠️ Y el archivo SALE IGUAL aunque el control no cierre
 *
 * Instrucción explícita del usuario (2026-09-28): *«sería bueno que el export se termine y dé la
 * info. que estará mal hasta que yo después no corrija algunos datos como ya vimos»*. Entonces el
 * export **nunca se niega a generar**: lo que hace es **decir en la cara** qué está mal y por qué
 * ese número no se puede entregar todavía. Frenar la generación le sacaría la herramienta justo
 * cuando la necesita para encontrar el problema.
 */
import * as XLSX from "xlsx"
import type { LibroDiario, AsientoLibroDiario } from "./libro-diario"
import { nombreSubdiario } from "./ejercicio"
import { armarLibroPorCuenta, TIPOS_SIN_CREDITO_VENTAS, type LibroPorCuenta } from "./libro-por-cuenta"
import type { CuentasAlCierre, FilaCuenta } from "./cuentas-al-cierre"
import type { TemplatesDelEjercicio } from "./templates-libro"
import type { ValuacionHacienda, PrecioMag, PrecioMercado, PrecioCabeza } from "./hacienda-stock"
import { PAPELES_SIN_ORIGEN, type StockInsumos } from "./stock-insumos"
import type { CuadreGranos, ValuacionGranos, Sementeras } from "./granos-sementeras"
import {
  formatearHoja, conFormula, MONEDA, ENTERO, TONELADAS, COEFICIENTE, type Columna,
} from "./formato-excel"

const money = (n: number) => Math.round(n * 100) / 100

/** Cabecera + filas de un listado de asientos. Misma forma para compras, ventas y provisiones. */
function hojaDeAsientos(asientos: AsientoLibroDiario[]): unknown[][] {
  const filas: unknown[][] = [[
    "Subdiario", "Fecha", "Tipo", "Pto Vta", "Número", "CUIT", "Denominación",
    "Neto Gravado", "No Gravado", "Exentas", "Otros Tributos", "IVA", "Total",
    "Cuenta contable", "Nro cuenta", "Centro de costo", "Origen del dato",
  ]]
  for (const a of asientos) {
    filas.push([
      a.subdiario, a.fecha ?? "", a.tipo ?? "", a.punto_venta ?? "", a.numero ?? "",
      a.cuit, a.denominacion,
      money(a.neto_gravado), money(a.no_gravado), money(a.exento),
      money(a.otros_tributos), money(a.iva), money(a.total),
      a.cuenta_contable, a.nro_cuenta, a.centro_costo,
      a.fuente === "historico" ? "sistema anterior" : a.fuente === "arca" ? "ARCA" : "ventas",
    ])
  }
  return filas
}

/** La solapa que se abre primero: qué se puede entregar y qué no. */
function hojaDeControl(libro: LibroDiario): unknown[][] {
  const { controles: c, ejercicio: ej } = libro
  const f: unknown[][] = []

  f.push([`PAPELES DE TRABAJO — EJERCICIO ${ej.etiqueta}`])
  f.push([`Cierre: ${ej.fechaCierre}`])
  f.push([`Los 12 subdiarios: ${nombreSubdiario(ej.subdiarios[0])} a ${nombreSubdiario(ej.subdiarios[11])}`])
  f.push([])
  f.push(["El período NO se corta por la fecha de las facturas, sino por el subdiario en el que entraron."])
  f.push([])

  f.push([c.sePuedeEntregar ? "CONTROL OK — se puede entregar" : "NO SE PUEDE ENTREGAR TODAVÍA"])
  if (!c.sePuedeEntregar) {
    f.push(["Motivo(s):"])
    c.motivos.forEach(m => f.push(["", m]))
    f.push([])
    f.push(["El archivo se genera igual, para que se pueda ver dónde está el problema."])
  }
  f.push([])

  f.push(["TOTALES POR MASA", "Comprobantes", "Total"])
  f.push(["Compras del ejercicio", c.compras.cantidad, money(c.compras.totalGeneral)])
  f.push(["Ventas del ejercicio", c.ventas.cantidad, money(c.ventas.totalGeneral)])
  f.push([])
  f.push(["Este es el número que tiene que coincidir con el del contador. La conformación (cómo"])
  f.push(["reagrupa cada cuenta) puede diferir legítimamente y no se controla."])
  f.push([])

  f.push(["APERTURA DE COMPRAS", "Importe"])
  f.push(["Neto gravado", money(c.compras.netoGravado)])
  f.push(["Exento / No gravado", money(c.compras.exentoNoGravado)])
  f.push(["IVA", money(c.compras.iva)])
  f.push(["Otros tributos", money(c.compras.otrosTributos)])
  f.push(["Sin crédito fiscal (Fac B y C)", money(c.compras.sinCredito)])
  f.push(["Diferencia contra el total", money(c.compras.diferencia),
    c.compras.ok ? (c.compras.soloRedondeo ? "cuadra, con residuo de redondeo" : "cuadra") : "NO CUADRA"])
  f.push([])

  if (c.subdiariosDuplicados.length > 0) {
    const nombreFuente = (x: string) =>
      x === "historico" ? "sistema anterior" : x === "arca" ? "ARCA" : x

    f.push(["SUBDIARIOS CARGADOS EN MÁS DE UNA FUENTE — sumarlos contaría doble"])
    f.push(["Subdiario", "Fuente", "Comprobantes", "Total", "Diferencia"])
    for (const d of c.subdiariosDuplicados) {
      d.porFuente.forEach((p, i) => f.push([
        i === 0 ? d.subdiario : "", nombreFuente(p.fuente),
        p.comprobantes, money(p.total), i === 0 ? money(d.diferencia) : "",
      ]))

      // 🔑 Lo que de verdad deja DECIDIR: si una fuente contiene a la otra, la elección es obvia.
      f.push(["", `${d.enComun} comprobante(s) están en las dos: son el mismo cargado dos veces.`])
      if (d.soloEn.length === 0) {
        f.push(["", "Ninguna fuente tiene nada que la otra no tenga: son idénticas, quedate con una."])
      } else if (d.soloEn.length === 1) {
        const u = d.soloEn[0]
        f.push(["", `Sólo «${nombreFuente(u.fuente)}» tiene ${u.asientos.length} comprobante(s) que la otra no.`])
        f.push(["", `Entonces «${nombreFuente(u.fuente)}» CONTIENE a la otra: quedate con ésa y descartá la otra.`])
      } else {
        f.push(["", "Cada fuente tiene comprobantes que la otra no: hay que fusionarlas, no elegir una."])
      }
      for (const u of d.soloEn) {
        f.push(["", `Sólo en ${nombreFuente(u.fuente)}:`, "Fecha", "Proveedor", "Tipo", "Importe"])
        u.asientos.forEach(a => f.push(["", "", a.fecha ?? "", a.denominacion, a.tipo ?? "sin código", money(a.total)]))
      }
      f.push([])
    }
  }

  if (c.choques.length > 0) {
    f.push(["COMPROBANTES QUE APARECEN MÁS DE UNA VEZ"])
    f.push(["Subdiario", "Tipo|PtoVta|Número|CUIT", "Denominación", "Total", "Fuentes"])
    c.choques.forEach(ch => f.push([ch.subdiario, ch.clave, ch.denominacion, money(ch.total), ch.fuentes.join(" + ")]))
    f.push([])
  }

  if (c.vacios.length > 0) {
    f.push(["SUBDIARIOS SIN NINGÚN COMPROBANTE — avisa, no frena"])
    f.push(["Puede ser un mes sin movimiento, o un mes que falta cargar. Un mes faltante NO se nota"])
    f.push(["mirando el total: por eso se listan."])
    c.vacios.forEach(s => f.push(["", nombreSubdiario(s)]))
    f.push([])
  }

  if (c.compras.descuadres.length > 0 || c.ventas.descuadres.length > 0) {
    f.push(["COMPROBANTES CUYAS PARTES NO SUMAN SU PROPIO TOTAL"])
    f.push(["Fecha", "Nombre", "Comprobante", "Total", "Suma de las partes", "Diferencia"])
    ;[...c.compras.descuadres, ...c.ventas.descuadres].forEach(d => f.push([
      d.fecha, d.nombre, d.comprobante, money(d.imp_total), money(d.suma_partes), money(d.diferencia),
    ]))
    f.push([])
  }

  f.push(["QUÉ HAY EN CADA SOLAPA"])
  f.push(["", "Compras", `${libro.compras.length} comprobante(s) de los 12 subdiarios`])
  f.push(["", "Ventas", `${libro.ventas.length} comprobante(s) de los 12 subdiarios`])
  f.push(["", "05 Provisión", `${libro.provisiones.length} — son del ejercicio por fecha pero entraron después`])
  f.push(["", "Sin subdiario", `${libro.sinSubdiario.length} en total, de los cuales ${c.sinSubdiarioQueAfectan.length} tienen fecha del ejercicio o anterior`])
  if (libro.sinSubdiario.length > 0 && c.sinSubdiarioQueAfectan.length === 0) {
    f.push(["", "", "Los sin subdiario son todos POSTERIORES al cierre: son del mes en curso y no tocan este balance."])
  }
  f.push([])
  f.push(["NO ESTÁ EN ESTE ARCHIVO, y va aparte como siempre: gastos bancarios e impuestos,"])
  f.push(["inmobiliario / red vial / automotor, retiros y aportes. Son los templates, que no"])
  f.push(["entran por subdiario."])

  return f
}

/**
 * Agrega una hoja, y **con su formato**: anchos y formato de número por columna.
 *
 * 📌 El formato es parte del entregable, no un adorno — se lo pidió el usuario pensando en quién
 * lo va a leer: *«que sea lo más amigable para el contador»*. Sin `columnas` la hoja entra sin
 * formato, que es lo correcto para las hojas de texto (Control).
 */
const hoja = (wb: XLSX.WorkBook, nombre: string, filas: unknown[][], columnas?: Columna[]) => {
  const ws = XLSX.utils.aoa_to_sheet(filas)
  if (columnas) formatearHoja(ws, columnas)
  // 31 caracteres es el máximo que acepta Excel para el nombre de una solapa.
  XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31))
}

/**
 * Las columnas de un listado de asientos (Compras, Ventas, Provisión, Sin subdiario).
 * Una sola definición para las cuatro: si se vieran distinto, el lector tendría que reaprender
 * la tabla en cada solapa.
 */
/** Templates, fila por cuota. */
const COLS_TEMPLATES: Columna[] = [
  { ancho: 11 },                    // Fecha
  { ancho: 34 },                    // Concepto
  { ancho: 30 },                    // Proveedor
  { ancho: 26 },                    // Categoría
  { ancho: 24 },                    // Cuenta contable
  { ancho: 12 },                    // Nro cuenta
  { ancho: 18 },                    // Centro de costo
  { ancho: 14 },                    // Responsable
  { ancho: 12 },                    // Estado
  { ancho: 16, z: MONEDA },         // Débito
  { ancho: 16, z: MONEDA },         // Crédito
]

/** Hacienda: cabezas enteras, coeficientes con dos decimales, importes en Contabilidad. */
const COLS_HACIENDA: Columna[] = [
  { ancho: 26 },                    // Categoría
  { ancho: 9, z: ENTERO },          // Cabezas
  { ancho: 46 },                    // Criterio
  { ancho: 15, z: MONEDA },         // Precio de referencia
  { ancho: 44 },                    // Origen del precio
  { ancho: 8, z: COEFICIENTE },     // Factor
  { ancho: 9, z: ENTERO },          // Kg/cab
  { ancho: 17, z: MONEDA },         // $ por cabeza
  { ancho: 18, z: MONEDA },         // Valor total
  { ancho: 60 },                    // De dónde salen los kilos
]

/** Los precios de referencia de los dos mercados. */
const COLS_PRECIOS: Columna[] = [
  { ancho: 26 }, { ancho: 16 }, { ancho: 12 },
  { ancho: 14, z: MONEDA }, { ancho: 14, z: MONEDA },
  { ancho: 14, z: MONEDA }, { ancho: 14, z: MONEDA },
]

/** Stock de insumos. */
const COLS_INSUMOS: Columna[] = [
  { ancho: 22 },                    // Categoría
  { ancho: 46 },                    // Producto
  { ancho: 12, z: "#,##0.00" },     // Cantidad
  { ancho: 9 },                     // Unidad
  { ancho: 15, z: MONEDA },         // Precio unitario
  { ancho: 16, z: MONEDA },         // Valor total
  { ancho: 34 },                    // Observaciones
]

/** Granos: dos columnas, y las toneladas con tres decimales porque el cuadre se juega ahí. */
const COLS_GRANOS: Columna[] = [
  { ancho: 40 }, { ancho: 18, z: TONELADAS }, { ancho: 54 },
]

/** Sementeras. */
const COLS_SEMENTERAS: Columna[] = [
  { ancho: 11 },                    // Fecha
  { ancho: 34 },                    // Lote
  { ancho: 8, z: "#,##0.00" },      // Ha
  { ancho: 30 },                    // Insumo
  { ancho: 12, z: "#,##0.00" },     // Cantidad
  { ancho: 9 },                     // Unidad
  { ancho: 15, z: MONEDA },         // Precio unitario
  { ancho: 16, z: MONEDA },         // Costo
]

/**
 * 📗 La solapa **«Por cuenta contable»** — el formato de su «Excel - Compras».
 *
 * Columnas A..N **en su orden exacto**, porque es lo que él y el contador ya saben leer; lo que
 * agregamos va **a la derecha del todo** (Q y R), para no correr el bloque familiar de importes.
 *
 * 🧮 **Todo lo que es una cuenta va como FÓRMULA**, no como número pegado (pedido explícito): la
 * columna Diferencia, los «Total general» de cada mes, el total del ejercicio y el Control final.
 * Así él cambia un importe y el papel se recalcula solo.
 *
 * ## Las dos mitades del control, que son distintas (§ 🚦)
 *
 * - **Diferencia** (columna K) es **integridad**: `Total − (neto + no gravado + exento + otros
 *   tributos + IVA)`. Si no da cero, el papel se contradice solo. Frena.
 * - **DDJJ IVA** (M a P) es **discrepancia** contra un papel de afuera: él pega el neto gravado de
 *   la declaración y la app le resta el del libro. Avisa, no frena — y las celdas van **vacías**
 *   porque ese número sale de la DDJJ, que la app no tiene.
 */
function hojaPorCuenta(libro: LibroPorCuenta, titulo: string): unknown[][] {
  const f: unknown[][] = []

  f.push([titulo])
  f.push(['Otros tributos va AL GASTO: adentro hay impuestos que no son percepciones (nota del usuario).'])
  f.push(['Las percepciones se toman de ARCA y se restan aparte.'])
  f.push([])
  f.push(["", "", "", "", "", "", "", "", "", "", "", "", "DDJJ IVA — lo llena el usuario"])
  f.push([
    "Año", "Mes", "Cuenta Contable",
    "Suma de Neto Gravado", "Suma de No Gravado", "Suma de Exento",
    "Otros Tributos", "Suma de IVA", "Suma de Total",
    "Sin crédito fiscal (Fac B y C)", "Diferencia Entre Total y suma de columnas", "",
    "Neto Gravado DDJJ", "Diferencia", "Exento + No gravado + Monotributo", "Diferencia",
    "Nro cuenta", "Comprobantes",
  ])

  /** Las filas (1-based, como las ve Excel) de cada «Total general» de mes, para el Control final. */
  const filasTotalMes: number[] = []

  for (const m of libro.meses) {
    for (const fila of m.filas) {
      const n = f.length + 1
      f.push([
        fila.anio, fila.mes, fila.cuenta,
        money(fila.netoGravado), money(fila.noGravado), money(fila.exento),
        money(fila.otrosTributos), money(fila.iva), money(fila.total),
        money(fila.sinCredito),
        conFormula(`I${n}-(D${n}+E${n}+F${n}+G${n}+H${n}+J${n})`, fila.diferencia), "",
        "", "", "", "",
        fila.nroCuenta, fila.comprobantes,
      ])
    }

    // «Total general» del mes: suma de las filas de arriba, como fórmula.
    const desde = f.length + 1 - m.filas.length
    const hasta = f.length
    const n = f.length + 1
    filasTotalMes.push(n)
    f.push([
      m.anio, m.mes, "Total general",
      ...(["D", "E", "F", "G", "H", "I", "J"] as const).map((col, i) =>
        conFormula(`SUM(${col}${desde}:${col}${hasta})`, [
          m.total.netoGravado, m.total.noGravado, m.total.exento,
          m.total.otrosTributos, m.total.iva, m.total.total, m.total.sinCredito,
        ][i]),
      ),
      conFormula(`I${n}-(D${n}+E${n}+F${n}+G${n}+H${n}+J${n})`, m.total.diferencia), "",
      // 🔑 M y O van VACÍAS a propósito: las llena él con la DDJJ. N y P se calculan solas — es la
      //    mejora sobre su planilla, donde la resta también la hacía a mano.
      "", { t: "n", f: `IF(M${n}="","",M${n}-D${n})`, z: MONEDA },
      "", { t: "n", f: `IF(O${n}="","",O${n}-(E${n}+F${n}))`, z: MONEDA },
      "", m.total.comprobantes,
    ])
    f.push([])
  }

  // El total del ejercicio y el Control, que es el camino inverso: si la suma de los totales
  // mensuales no da el total del ejercicio, la apertura perdió algo por el camino.
  const nTotal = f.length + 1
  f.push([
    "", "", "TOTAL DEL EJERCICIO",
    ...(["D", "E", "F", "G", "H", "I", "J"] as const).map((col, i) =>
      conFormula(filasTotalMes.map(r => `${col}${r}`).join("+") || "0", [
        libro.totalGeneral.netoGravado, libro.totalGeneral.noGravado, libro.totalGeneral.exento,
        libro.totalGeneral.otrosTributos, libro.totalGeneral.iva, libro.totalGeneral.total,
        libro.totalGeneral.sinCredito,
      ][i]),
    ),
    conFormula(`I${nTotal}-(D${nTotal}+E${nTotal}+F${nTotal}+G${nTotal}+H${nTotal}+J${nTotal})`, libro.totalGeneral.diferencia),
    "", "", "", "", "", "", libro.totalGeneral.comprobantes,
  ])

  const nCtrl = f.length + 1
  f.push([
    "", "", "Control (tiene que dar 0)",
    ...(["D", "E", "F", "G", "H", "I", "J"] as const).map(col =>
      conFormula(`${col}${nTotal}-(${filasTotalMes.map(r => `${col}${r}`).join("+") || "0"})`, 0),
    ),
  ])
  f.push([])

  // Lo que falta imputar, dicho en una línea y con su peso. § 🧮: el control se ve.
  if (libro.sinImputar.comprobantes > 0) {
    f.push([`FALTA IMPUTAR: ${libro.sinImputar.comprobantes} comprobante(s) por ${money(libro.sinImputar.total)} — ${libro.sinImputar.porcentaje}% del total`])
    f.push([`Aparece en: ${[...new Set(libro.sinImputar.meses)].join(" · ")}`])
    f.push(["Se imputa en Egresos → Facturas → Asignación Cuentas. Hasta entonces sale como NO IMPUTADO."])
  } else {
    f.push(["TODO IMPUTADO — no hay comprobantes sin cuenta contable."])
  }

  return f
}

const COLS_POR_CUENTA: Columna[] = [
  { ancho: 7, z: ENTERO },          // A Año
  { ancho: 5, z: ENTERO },          // B Mes
  { ancho: 34 },                    // C Cuenta Contable
  { ancho: 17, z: MONEDA },         // D Neto Gravado
  { ancho: 15, z: MONEDA },         // E No Gravado
  { ancho: 15, z: MONEDA },         // F Exento
  { ancho: 15, z: MONEDA },         // G Otros Tributos
  { ancho: 15, z: MONEDA },         // H IVA
  { ancho: 17, z: MONEDA },         // I Total
  { ancho: 20, z: MONEDA },         // J Sin crédito fiscal (Fac B y C)
  { ancho: 19, z: MONEDA },         // K Diferencia
  { ancho: 3 },                     // L separador
  { ancho: 17, z: MONEDA },         // M DDJJ Neto Gravado
  { ancho: 14, z: MONEDA },         // N Diferencia
  { ancho: 22, z: MONEDA },         // O DDJJ Exento + No grav + Mono
  { ancho: 14, z: MONEDA },         // P Diferencia
  { ancho: 12 },                    // Q Nro cuenta
  { ancho: 13, z: ENTERO },         // R Comprobantes
]

/**
 * 💳 Las solapas **03 - Cuentas a cobrar** y **04 - Cuentas a pagar**.
 *
 * Mismo formato de fila que el libro de IVA —el que usan sus papeles originales— más la columna
 * **Motivo**, que dice **por qué** cada comprobante está en el papel. Es lo que lo hace auditable:
 * *«no se pagó nunca»* y *«se pagó DESPUÉS del cierre»* son cosas distintas y el contador puede
 * querer mirarlas distinto.
 *
 * 🧮 **Y abajo van los tres bloques de lo que NO se pudo determinar**, con sus totales. No son un
 * apéndice: son la parte que dice hasta dónde llega lo que el papel afirma.
 */
function hojaDeCuentas(c: CuentasAlCierre, titulo: string, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([titulo])
  f.push([`Al ${fechaCierre}`])
  f.push(["Entra lo que NO estaba pagado al cierre. Manda la fecha de pago, no el estado de hoy:"])
  f.push(["una factura que hoy figura paga pero se pagó despues del cierre, al cierre era deuda."])
  f.push([])
  f.push([
    "Subdiario", "Fecha", "Tipo", "Pto Vta", "Número", "CUIT", "Denominación",
    "Neto Gravado", "No Gravado", "Exentas", "Otros Tributos", "IVA", "Total",
    "Cuenta contable", "Estado hoy", "Fecha de pago", "Motivo",
  ])

  const fila = (x: FilaCuenta) => {
    const a = x.asiento
    return [
      a.subdiario, a.fecha ?? "", a.tipo ?? "", a.punto_venta ?? "", a.numero ?? "",
      a.cuit, a.denominacion,
      money(a.neto_gravado), money(a.no_gravado), money(a.exento),
      money(a.otros_tributos), money(a.iva), money(a.total),
      a.cuenta_contable, x.estado, x.fechaPago ?? "", x.motivo,
    ]
  }

  c.filas.forEach(x => f.push(fila(x)))
  const desde = 7
  const hasta = 6 + c.filas.length
  if (c.filas.length > 0) {
    f.push(["", "", "", "", "", "", "TOTAL",
      ...(["H", "I", "J", "K", "L", "M"] as const).map((col, i) =>
        conFormula(`SUM(${col}${desde}:${col}${hasta})`, [0, 0, 0, 0, 0, c.total][i])),
    ])
  } else {
    f.push(["", "", "", "", "", "", "TOTAL", "", "", "", "", "", 0])
  }
  f.push([])

  /** Los tres bloques de lo que no se pudo afirmar. Cada uno dice por qué y cuánto pesa. */
  const bloque = (t: string[], filas: FilaCuenta[], total: number) => {
    if (filas.length === 0) return
    f.push([])
    t.forEach(l => f.push([l]))
    f.push([`${filas.length} comprobante(s) — total ${money(total)}`])
    filas.forEach(x => f.push(fila(x)))
  }

  bloque([
    "DEL SISTEMA ANTERIOR — no se puede decir si estaban pagos",
    "El histórico migró los comprobantes pero NO su estado de pago ni su fecha.",
    "No se cuentan como deuda ni como pagados: hace falta el dato de afuera.",
  ], c.sinEstadoDePago, c.totalSinEstado)

  bloque([
    "CONCILIADOS PERO SIN NINGUNA FECHA — no se puede ubicar el pago en el tiempo",
    "Dicen estar pagados, pero no tienen fecha de pago ni movimiento bancario enganchado.",
  ], c.sinDatoDePago, c.totalSinDato)

  bloque([
    `ESTADO NO RECONOCIDO — ${c.estadosSinClasificar.join(", ")}`,
    "No se descartan: hay que decidir de qué lado van.",
  ], c.estadoDesconocido, c.totalDesconocido)

  f.push([])
  f.push([`Se miraron ${c.mirados} comprobantes del ejercicio.`])
  return f
}

const COLS_CUENTAS: Columna[] = [
  { ancho: 10 },                    // Subdiario
  { ancho: 11 },                    // Fecha
  { ancho: 6, z: ENTERO },          // Tipo
  { ancho: 8, z: ENTERO },          // Pto Vta
  { ancho: 11, z: ENTERO },         // Número
  { ancho: 13 },                    // CUIT
  { ancho: 42 },                    // Denominación
  { ancho: 15, z: MONEDA },         // Neto Gravado
  { ancho: 14, z: MONEDA },         // No Gravado
  { ancho: 13, z: MONEDA },         // Exentas
  { ancho: 14, z: MONEDA },         // Otros Tributos
  { ancho: 13, z: MONEDA },         // IVA
  { ancho: 16, z: MONEDA },         // Total
  { ancho: 26 },                    // Cuenta contable
  { ancho: 13 },                    // Estado hoy
  { ancho: 13 },                    // Fecha de pago
  { ancho: 34 },                    // Motivo
]

const COLS_ASIENTOS: Columna[] = [
  { ancho: 10 },                    // Subdiario
  { ancho: 11 },                    // Fecha
  { ancho: 6, z: ENTERO },          // Tipo
  { ancho: 8, z: ENTERO },          // Pto Vta
  { ancho: 11, z: ENTERO },         // Número
  { ancho: 13 },                    // CUIT
  { ancho: 42 },                    // Denominación
  { ancho: 15, z: MONEDA },         // Neto Gravado
  { ancho: 14, z: MONEDA },         // No Gravado
  { ancho: 13, z: MONEDA },         // Exentas
  { ancho: 14, z: MONEDA },         // Otros Tributos
  { ancho: 13, z: MONEDA },         // IVA
  { ancho: 16, z: MONEDA },         // Total
  { ancho: 26 },                    // Cuenta contable
  { ancho: 12 },                    // Nro cuenta
  { ancho: 18 },                    // Centro de costo
  { ancho: 17 },                    // Origen del dato
]

/**
 * Las cuotas de templates, en el mismo formato de fila que el libro diario — pedido del usuario:
 * *«replicar formato de libro diario con los templates»*.
 */
function hojaDeTemplates(t: TemplatesDelEjercicio): unknown[][] {
  const f: unknown[][] = [[
    "Fecha", "Concepto", "Proveedor", "Categoría", "Cuenta contable", "Nro cuenta",
    "Centro de costo", "Responsable", "Estado", "Débito", "Crédito",
  ]]
  for (const c of t.detalle) {
    f.push([
      c.fecha ?? "", c.concepto, c.proveedor, c.categ, c.cuenta_contable, c.nro_cuenta,
      c.centro_costo, c.responsable, c.estado,
      c.monto >= 0 ? money(c.monto) : "", c.monto < 0 ? money(-c.monto) : "",
    ])
  }
  f.push([])
  f.push(["TOTAL", "", "", "", "", "", "", "", "", money(t.totalDebitos), money(t.totalCreditos)])
  return f
}

/**
 * El resumen `concepto × los 12 meses` — **la forma exacta de su planilla** *«detalle completo
 * gastos bancarios e impuestos por mes»*: filas de concepto, columnas jul→jun con «Suma de
 * Débitos / Suma de Créditos», y el total del ejercicio al final.
 */
function hojaTemplatesPorMes(t: TemplatesDelEjercicio): unknown[][] {
  const f: unknown[][] = []
  f.push(["TEMPLATES POR MES — lo que no entra por subdiario y se informa aparte"])
  f.push(["⚠️ Estas cuotas se cortan por FECHA DE PAGO (o estimada si no hay), no por subdiario:"])
  f.push(["un template no tiene factura de ARCA, así que no tiene subdiario."])
  f.push([])

  const cab: unknown[] = ["Categoría"]
  t.columnas.forEach(c => { cab.push(`${c} Déb.`, `${c} Créd.`) })
  cab.push("Total Débitos", "Total Créditos")
  f.push(cab)

  for (const fila of t.porMes) {
    const r: unknown[] = [fila.categ]
    for (let i = 0; i < 12; i++) r.push(fila.debitos[i] || "", fila.creditos[i] || "")
    r.push(fila.totalDebitos, fila.totalCreditos)
    f.push(r)
  }

  const tot: unknown[] = ["TOTAL"]
  for (let i = 0; i < 12; i++) {
    tot.push(
      money(t.porMes.reduce((s, x) => s + x.debitos[i], 0)),
      money(t.porMes.reduce((s, x) => s + x.creditos[i], 0)),
    )
  }
  tot.push(t.totalDebitos, t.totalCreditos)
  f.push(tot)

  if (t.sinCategoria.length > 0 || t.sinFecha.length > 0) {
    f.push([])
    f.push(["LO QUE NO SE PUDO UBICAR"])
    if (t.sinCategoria.length > 0) {
      f.push(["", `${t.sinCategoria.length} cuota(s) SIN CATEGORÍA contable: no se pueden ubicar en el balance.`])
    }
    if (t.sinFecha.length > 0) {
      f.push(["", `${t.sinFecha.length} cuota(s) SIN FECHA (ni de pago ni estimada): no se pueden asignar a un período.`])
    }
  }
  return f
}

/**
 * `02 - HACIENDA` — existencia al cierre y su valuación, con el criterio de cada categoría a la
 * vista y **los huecos listados**, no escondidos en un total.
 */
function hojaDeHacienda(h: ValuacionHacienda, fechaCierre: string, mesPrecios: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`02 - HACIENDA — existencia al ${fechaCierre}`])
  f.push([`Precios de referencia: mes completo de ${mesPrecios} (Cañuelas y Entresurcos)`])
  f.push([])
  f.push(["Categoría", "Cabezas", "Criterio de valuación", "Precio de referencia", "Origen del precio",
    "Factor", "Kg/cab", "$ por cabeza", "Valor total", "De dónde salen los kilos"])

  /**
   * 🧮 **Fórmulas, no resultados** — pedido textual del usuario en este mismo papel:
   * *«si son fórmulas deben quedar las fórmulas en el excel y no los datos»*.
   *
   * `$ por cabeza` = precio × factor × kg (o precio × factor cuando ya viene por cabeza)
   * `Valor total`  = cabezas × $ por cabeza
   *
   * 🔑 Así él cambia un precio en la columna D y **el papel se recalcula solo**. Con el número
   * pegado tendría que rehacer la cuenta a mano, y el Excel dejaría de ser una herramienta para
   * pasar a ser una foto.
   *
   * ⚠️ Las filas **sin precio siguen diciendo «FALTA EL PRECIO» en texto**: una fórmula sobre una
   * celda vacía daría **0**, y un cero se lee como *«vale cero»*, que es justo lo contrario de lo
   * que pasa.
   */
  for (const x of h.filas) {
    const fila = f.length + 1  // 1-based, la fila donde va a caer ésta
    f.push([
      x.categoria, x.cabezas, x.criterio,
      x.precioReferencia ?? "", x.origenPrecio,
      x.factor, x.pesoKg ?? "",
      x.valorPorCabeza == null
        ? "FALTA EL PRECIO"
        : conFormula(
            x.pesoKg ? `D${fila}*F${fila}*G${fila}` : `D${fila}*F${fila}`,
            x.valorPorCabeza,
          ),
      x.valorTotal == null
        ? "FALTA EL PRECIO"
        : conFormula(`B${fila}*H${fila}`, x.valorTotal),
      // El origen del peso va al lado: un kilo estimado y uno medido no valen lo mismo, y el
      // papel tiene que poder decir cuál es cuál sin preguntarle a nadie.
      x.origenPeso,
    ])
  }
  f.push([])
  f.push(["TOTAL", h.cabezas, "", "", "", "", "", "", money(h.valuado)])
  f.push([])
  if (h.huecos.length > 0) {
    f.push(["🕳️ LO QUE FALTA VALUAR — el total de arriba NO lo incluye"])
    f.push(["", `${h.huecos.length} categoría(s) y ${h.cabezasSinValuar} cabezas sin precio.`])
    f.push(["", "No se valúan en cero a propósito: un supuesto silencioso daría un total completo y mal."])
    h.huecos.forEach(x => f.push(["", x.categoria, x.cabezas, x.criterio]))
    f.push([])
  }
  if (h.sinCriterio.length > 0) {
    f.push(["⚠️ CATEGORÍAS CON EXISTENCIA Y SIN CRITERIO DEFINIDO"])
    h.sinCriterio.forEach(c => f.push(["", c]))
  }
  return f
}

/** Los precios que se usaron, para que la valuación se pueda auditar y no haya que creerle. */
function hojaDePrecios(
  mag: PrecioMag[],
  mercado: { macho: PrecioMercado[]; hembra: PrecioMercado[] },
  porCabeza: { vientres: PrecioCabeza[]; toros: PrecioCabeza[] },
  mesPrecios: string,
): unknown[][] {
  const f: unknown[][] = []
  f.push([`PRECIOS DE REFERENCIA — mes completo de ${mesPrecios}`])
  f.push(["Se toma el mes entero, no un día, para que sea representativo."])
  f.push([])
  f.push(["MERCADO AGROGANADERO DE CAÑUELAS — categorías comerciales"])
  f.push(["Familia", "Calidad", "Corte", "Mínimo", "Máximo", "Promedio", "Mediana"])
  mag.forEach(m => f.push([m.familia, m.calidad, m.corte ?? "", m.minimo, m.maximo, m.promedio, m.mediana]))
  f.push([])
  f.push(["ENTRESURCOS Y CORRALES — POR CABEZA (vientres y toros)"])
  f.push(["Un vientre o un toro NO se valúan por kilo: valen lo que valen."])
  f.push(["Categoría", "Cabezas operadas", "Promedio", "Máximo", "Mínimo"])
  for (const [tipo, filas] of Object.entries(porCabeza)) {
    filas.forEach(m => f.push([`${tipo} · ${m.categoria}`, m.cantidad, m.promedio, m.maximo, m.minimo]))
  }
  f.push([])
  f.push(["ENTRESURCOS Y CORRALES — por rango de kilos"])
  f.push(["Categoría", "Desde kg", "Hasta kg", "Prom. $/kg", "Máx. $/kg", "Mín. $/kg"])
  for (const [sexo, filas] of Object.entries(mercado)) {
    filas.forEach(m => f.push([`${sexo} · ${m.categoria}`, m.pesoLo, m.pesoHi ?? "sin tope", m.promKilo, m.kiloMax, m.kiloMin]))
  }
  return f
}

/** Los stocks de insumos, un bloque por papel, con los huecos contados. */
function hojaDeInsumos(st: StockInsumos, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`STOCK DE INSUMOS al ${fechaCierre}`])
  f.push([])
  for (const g of st.grupos) {
    f.push([g.papel])
    f.push(["Categoría", "Producto", "Cantidad", "Unidad", "Precio unitario", "Valor total", "Observaciones"])
    for (const x of g.filas) {
      f.push([
        x.categoria, x.producto, x.cantidad, x.unidad,
        x.costoUnitario ?? "FALTA EL PRECIO",
        x.valorTotal ?? "FALTA EL PRECIO",
        x.observaciones,
      ])
    }
    f.push(["", `Subtotal ${g.papel}`, "", "", "", money(g.valuado),
      g.huecos > 0 ? `⚠️ ${g.huecos} producto(s) sin precio, NO incluidos` : ""])
    f.push([])
  }
  f.push(["TOTAL VALUADO", money(st.valuado)])
  f.push(["Productos con existencia", st.productos])
  f.push(["Productos SIN PRECIO", st.huecos.length])
  f.push([])
  if (st.huecos.length > 0) {
    f.push(["🕳️ LO QUE FALTA VALUAR — el total de arriba NO lo incluye"])
    f.push(["Categoría", "Producto", "Cantidad", "Unidad"])
    st.huecos.forEach(x => f.push([x.categoria, x.producto, x.cantidad, x.unidad]))
    f.push([])
  }
  f.push(["🕳️ LO QUE TODAVÍA LE FALTA A CADA PAPEL"])
  PAPELES_SIN_ORIGEN.forEach(p => f.push(["", p.papel, p.falta]))
  return f
}

/** `1 - GRANOS`: el cuadre de kilos y la valuación, con la diferencia a la vista. */
function hojaDeGranos(c: CuadreGranos, v: ValuacionGranos, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`1 - GRANOS al ${fechaCierre}`])
  f.push([])
  f.push(["CUADRE DE KILOS (toneladas)"])
  f.push(["Stock al inicio del ejercicio", c.stockInicioTn ?? "FALTA"])
  f.push(["+ Cosecha del ejercicio", c.cosechaTn ?? "FALTA"])
  f.push(["− Ventas del ejercicio", c.ventasTn, "← esto lo sabe la app, de los comprobantes de venta"])
  f.push(["= Saldo", c.saldoTn ?? "no se puede calcular"])
  f.push(["− Existencia declarada al cierre", c.stockEmpresaTn ?? "FALTA"])
  f.push(["= DIFERENCIA", c.diferenciaTn ?? "no se puede calcular",
    c.diferenciaTn == null ? "" : c.cierra ? "cierra dentro de la tolerancia" : "NO CIERRA — hay que explicarla"])
  f.push([])
  if (c.faltan.length > 0) {
    f.push(["Para poder cuadrar falta cargar:"])
    c.faltan.forEach(x => f.push(["", x]))
    f.push([])
  }
  f.push(["VALUACIÓN"])
  f.push(["Toneladas", v.toneladas])
  f.push(["Precio por tonelada", v.precioPorTn ?? "FALTA EL PRECIO"])
  f.push(["Monto bruto", v.montoBruto ?? ""])
  f.push(["% calidad", v.pctCalidad])
  f.push(["Monto neto", v.montoNeto ?? ""])
  f.push(["% CZ (comisión + flete + otros)", v.pctCz])
  f.push(["NETO FINAL", v.netoFinal ?? "FALTA EL PRECIO"])
  return f
}

/** `3 - SEMENTERAS`: lo sembrado y no cosechado, con lo que no entró y por qué. */
function hojaDeSementeras(s: Sementeras, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`3 - SEMENTERAS al ${fechaCierre}`])
  f.push(["Sólo cuenta las órdenes EJECUTADAS hasta el cierre: una planificada todavía no costó nada."])
  f.push([])
  f.push([`${s.ordenesEjecutadas} orden(es) ejecutada(s) · ${s.hectareas} ha`])
  f.push([])
  f.push(["Fecha", "Lote", "Ha", "Insumo", "Cantidad", "Unidad", "Precio unitario", "Costo"])
  s.lineas.forEach(l => f.push([
    l.fecha ?? "", l.lote, l.hectareas, l.insumo, l.cantidad ?? "", l.unidad,
    l.precioUnitario ?? "FALTA EL PRECIO", l.costo ?? "FALTA EL PRECIO",
  ]))
  f.push([])
  f.push(["COSTO", money(s.costo)])
  f.push([])
  f.push(["⚠️ EL COSTO ESTÁ INCOMPLETO — falta:"])
  s.faltan.forEach(x => f.push(["", x]))
  f.push([])
  if (s.ordenesNoContadas.length > 0) {
    f.push(["ÓRDENES QUE NO SE CONTARON, Y POR QUÉ"])
    f.push(["Fecha", "Lote", "Estado", "Motivo"])
    s.ordenesNoContadas.forEach(o => f.push([o.fecha ?? "", o.lote, o.estado, o.motivo]))
  }
  return f
}

/** Arma el workbook. Separado de la descarga para poder probarlo sin navegador. */
export function armarWorkbook(
  libro: LibroDiario,
  templates?: TemplatesDelEjercicio,
  hacienda?: {
    valuacion: ValuacionHacienda; mag: PrecioMag[]
    mercado: { macho: PrecioMercado[]; hembra: PrecioMercado[] }
    porCabeza: { vientres: PrecioCabeza[]; toros: PrecioCabeza[] }
    mesPrecios: string
  },
  insumos?: StockInsumos,
  campo?: { granos: CuadreGranos; valuacionGranos: ValuacionGranos; sementeras: Sementeras },
  /** Papeles 03 y 04. Van sólo si la pantalla pudo averiguar CUÁNDO se pagó cada comprobante. */
  cuentas?: { pagar?: CuentasAlCierre; cobrar?: CuentasAlCierre },
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  hoja(wb, "Control", hojaDeControl(libro))
  hoja(wb, "Compras", hojaDeAsientos(libro.compras), COLS_ASIENTOS)
  hoja(wb, "Ventas", hojaDeAsientos(libro.ventas), COLS_ASIENTOS)
  // 📗 La apertura por cuenta contable — el formato que el usuario ya usaba (A-FEAT-1187).
  //    Van pegadas a su listado: primero el detalle, después el resumen que se le manda al contador.
  hoja(wb, "Compras por cuenta", hojaPorCuenta(armarLibroPorCuenta(libro.compras),
    `LIBRO DIARIO MENSUAL (Compras) — ejercicio ${libro.ejercicio.etiqueta}`), COLS_POR_CUENTA)
  hoja(wb, "Ventas por cuenta", hojaPorCuenta(armarLibroPorCuenta(libro.ventas, TIPOS_SIN_CREDITO_VENTAS),
    `LIBRO DIARIO MENSUAL (Ventas) — ejercicio ${libro.ejercicio.etiqueta}`), COLS_POR_CUENTA)
  hoja(wb, "05 Provision", hojaDeAsientos(libro.provisiones), COLS_ASIENTOS)
  // 💳 Cuentas a pagar y a cobrar al cierre — papeles 03 y 04 (A-FEAT-1187).
  if (cuentas?.pagar) {
    hoja(wb, "04 Cuentas a pagar",
      hojaDeCuentas(cuentas.pagar, `CUENTAS A PAGAR — ejercicio ${libro.ejercicio.etiqueta}`,
        libro.ejercicio.fechaCierre), COLS_CUENTAS)
  }
  if (cuentas?.cobrar) {
    hoja(wb, "03 Cuentas a cobrar",
      hojaDeCuentas(cuentas.cobrar, `CUENTAS A COBRAR — ejercicio ${libro.ejercicio.etiqueta}`,
        libro.ejercicio.fechaCierre), COLS_CUENTAS)
  }
  // ⚠️ Se incluye SIEMPRE, aunque esté vacía: una solapa vacía dice «no hay», y que falte dice
  // «no se miró». No es lo mismo (§ 🧮: nada se descarta en silencio).
  hoja(wb, "Sin subdiario", hojaDeAsientos(libro.sinSubdiario), COLS_ASIENTOS)
  if (templates) {
    hoja(wb, "Templates", hojaDeTemplates(templates), COLS_TEMPLATES)
    hoja(wb, "Templates por mes", hojaTemplatesPorMes(templates))
  }
  if (hacienda) {
    hoja(wb, "02 Hacienda", hojaDeHacienda(hacienda.valuacion, libro.ejercicio.fechaCierre, hacienda.mesPrecios), COLS_HACIENDA)
    hoja(wb, "Precios", hojaDePrecios(hacienda.mag, hacienda.mercado, hacienda.porCabeza, hacienda.mesPrecios), COLS_PRECIOS)
  }
  if (insumos) hoja(wb, "Stock insumos", hojaDeInsumos(insumos, libro.ejercicio.fechaCierre), COLS_INSUMOS)
  if (campo) {
    hoja(wb, "1 Granos", hojaDeGranos(campo.granos, campo.valuacionGranos, libro.ejercicio.fechaCierre), COLS_GRANOS)
    hoja(wb, "3 Sementeras", hojaDeSementeras(campo.sementeras, libro.ejercicio.fechaCierre), COLS_SEMENTERAS)
  }
  return wb
}

export function nombreArchivo(libro: LibroDiario, empresa: string): string {
  const hoy = new Date().toISOString().slice(0, 10)
  const estado = libro.controles.sePuedeEntregar ? "" : "_REVISAR"
  return `Papeles_balance_${empresa}_${libro.ejercicio.etiqueta.replace("/", "-")}_${hoy}${estado}.xlsx`
}

/** Descarga el archivo en el navegador. */
export function descargarLibroDiario(
  libro: LibroDiario, empresa: string,
  templates?: TemplatesDelEjercicio,
  hacienda?: {
    valuacion: ValuacionHacienda; mag: PrecioMag[]
    mercado: { macho: PrecioMercado[]; hembra: PrecioMercado[] }
    porCabeza: { vientres: PrecioCabeza[]; toros: PrecioCabeza[] }
    mesPrecios: string
  },
  insumos?: StockInsumos,
  campo?: { granos: CuadreGranos; valuacionGranos: ValuacionGranos; sementeras: Sementeras },
  cuentas?: { pagar?: CuentasAlCierre; cobrar?: CuentasAlCierre },
) {
  const wb = armarWorkbook(libro, templates, hacienda, insumos, campo, cuentas)
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  const url = URL.createObjectURL(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  )
  const a = document.createElement("a")
  a.href = url
  a.download = nombreArchivo(libro, empresa)
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 0)
}
