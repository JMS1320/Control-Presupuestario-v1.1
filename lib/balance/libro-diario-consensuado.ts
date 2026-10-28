/**
 * 📗 EL LIBRO DIARIO CONSENSUADO — compras y ventas del ejercicio, como lo armaron JMS y Claude a mano (27/10/2026).
 *
 * ## Qué es y de dónde sale
 *
 * El 27/10/2026 se armó **fuera de la app** (PowerShell + Excel, carpeta «Sesion Claude Estanco/Libro Diario») el Libro
 * Diario que se le mandó al contador: «Libro Diario Compras MSA 25-26.xlsx» y «Libro Diario Ventas MSA 25-26.xlsx». Ese
 * armado quedó **consensuado** — cada número se explicó contra lo presentado a ARCA («CUADRO CONSENSUADO - Compras MSA
 * 25-26.md»). Este módulo lo reproduce desde los datos de la app, en UN solo libro con cinco solapas:
 * `Compras` · `Compras por cuenta` · `Ventas` · `Ventas por cuenta` · `Retenciones sufridas`.
 *
 * ## Las reglas, que son las del armado a mano (`generar_libro_diario_compras.ps1` / `…_ventas.ps1`)
 *
 * - **Compras** ordenadas por subdiario, fecha, tipo, punto de venta y número. ⚠️ El tipo se ordena **como texto**
 *   (`11` antes que `2`), porque así lo ordenaba la consulta de Supabase del armado a mano; el punto de venta y el número,
 *   como número. Ordenarlo distinto movería filas respecto del Excel que ya tiene el contador.
 * - **Factura C (tipo 11)**: no gravado y exento en 0, y **el total va a Monotributo**. Sólo el 11: las 12/13 (notas C)
 *   no, igual que el script.
 * - **Factura B NO es monotributo**: su total queda en «Dif. de algo más» (Aeropuertos, 6.300).
 * - **Dif. de algo más** = Total − (Neto + No grav. + Exento + Otros + IVA + Monotributo). Aglutina pequeños saldos.
 * - **Ventas, criterio DDJJ IVA**: Neto, IVA **vendido** (el de la app menos el de comisión y almacenaje, ya resuelto en
 *   `desdeVenta`) y Total. Las retenciones no van: tienen su solapa.
 * - **Por cuenta**: se agrupa por **número** de cuenta, un bloque por mes con su subtotal y el total de los 12 meses.
 *
 * ## 🧮 Fórmulas, no resultados
 *
 * Todos los totales, subtotales y controles van como **fórmula** de Excel (con el valor ya calculado, `conFormula`), así
 * el contador cambia un dato y el libro se recalcula — y los controles «debe dar 0» quedan vivos.
 *
 * ## 📌 Lo que fue fijo para 25/26 vive en `LIBRO_DIARIO_CONSENSUADO`
 *
 * La fila «Sistema» del cuadro consensuado, la composición de «Dif. de algo más», las 2 facturas de Federación Patronal
 * con signo distinto a ARCA y las notas de AFA son **hechos de ese ejercicio**. Están en una constante por empresa y año
 * de cierre (como `PRESENTADO_ARCA_COMPRAS`): otro ejercicio simplemente no muestra esos bloques. Todo lo demás se
 * calcula de los datos.
 *
 * ⚠️ **Lo que NO está** (y por qué): la columna «Pagos a cuenta en ARCA (info)» de Retenciones sufridas sale de los zips
 * del libro IVA de ARCA, que el navegador no tiene. Queda afuera hasta que la app guarde lo presentado.
 */
import XLSX from "xlsx-js-style"
import JSZip from "jszip"
import type { LibroDiario, AsientoLibroDiario } from "./libro-diario"
import { claveSubdiario, type Ejercicio } from "./ejercicio"
import { hoyArgentina } from "@/lib/fechas"
import { MONEDA } from "./formato-excel"

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Constantes por empresa y ejercicio
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Una factura identificada por punto de venta + número + CUIT (el mismo número se repite en varios puntos de venta). */
export interface FacturaMarcada { puntoVenta: number; numero: number; cuit: string }

export interface ConsensuadoDelEjercicio {
  compras?: {
    /** La fila «Sistema» del cuadro consensuado. No gravado y exento van juntos, como en el cuadro. */
    sistema: { neto: number; noGravadoYExento: number; monotributo: number; otros: number; iva: number; total: number; dif: number }
    /** Nota en el encabezado «Dif. de algo más». */
    notaDif: string
    /** Composición de «Dif. de algo más» al pie, con su control. */
    composicionDif: Array<{ texto: string; importe: number }>
    /** Facturas con signo distinto a lo presentado a ARCA: van en naranja, con nota, y marcan su mes y su cuenta. */
    signoDistinto: {
      facturas: FacturaMarcada[]
      notaFila: string
      referencia: string
      notaPie: string
      /** Texto en el subtotal del mes que tiene una de esas facturas. */
      textoMes: string
      leyendaMes: string
      leyendaCuenta: string
    }
  }
  ventas?: {
    sistema: { neto: number; noGravado: number; exentas: number; iva: number; total: number; dif: number }
    /** Notas al pie, en orden. La de índice `notaNaranja` va en naranja. */
    notas: string[]
    notaNaranja?: number
    /** Nota en el IVA de las ventas con IVA de comisión o almacenaje (las filas en naranja). */
    notaIvaFila: string
  }
  /** Notas al pie de «Retenciones sufridas» (en naranja). */
  notasRetenciones?: string[]
  /**
   * 🔍 Lo fijo del libro «Diferencias vs ARCA» (`diferencias-vs-arca.ts`): textos y links de casos puntuales. Las
   * diferencias y sus grupos se calculan de los datos; esto sólo agrega lo que no se puede deducir.
   */
  diferencias?: {
    compras?: {
      /** Cómo se nombra el grupo «Se le cambió el signo» (va entre paréntesis). */
      nombreGrupoSigno?: string
      /** La nota de arriba (fila 3, en naranja). */
      notaArriba?: string
      /** El PDF de cada factura, en la columna Q («Factura (PDF)»). */
      links?: Array<FacturaMarcada & { url: string }>
      /** La fila ARCA del cuadro consensuado: se controla contra lo leído de los zips. */
      arcaConsensuado?: { neto: number; noGravado: number; exento: number; otros: number; iva: number; total: number }
    }
    ventas?: {
      /** «Por qué» de un comprobante de «No entra en el cuadro», en lugar del texto que arma la app. */
      porQue?: Array<FacturaMarcada & { texto: string }>
    }
  }
}

/**
 * 📌 Lo fijo de cada ejercicio ya consensuado. Por empresa → año de cierre.
 * MSA 25/26: «CUADRO CONSENSUADO - Compras MSA 25-26.md» y «COMO SACAR EL LIBRO DIARIO DE VENTAS.md» (27/10/2026).
 */
export const LIBRO_DIARIO_CONSENSUADO: Record<string, Record<number, ConsensuadoDelEjercicio>> = {
  MSA: {
    2026: {
      compras: {
        sistema: {
          neto: 172305543.46, noGravadoYExento: 17639956.44, monotributo: 69367436.07, otros: 2701548.35,
          iva: 32125487.56, total: 294180363.99, dif: 40392.11,
        },
        notaDif: "Aglutina pequeños saldos: Factura B Aeropuertos 6.300,00 + tique Pan American 19.062,12 + tique Petrolnor 15.028,97 + tique Apellgran 1,00 + centavos 0,02 = 40.392,11. Ver composición al pie de la hoja.",
        composicionDif: [
          { texto: "Factura B (tipo 6) Aeropuertos Argentina 2000 - Pto Vta 468 N° 660266 - 28/06/2026: solo trae total; ARCA la declara en compras no fiscales", importe: 6300 },
          { texto: "Tique Pan American N° 3944 (02/2026): neto + IVA no llegan al total (impuesto no cargado en Otros Tributos)", importe: 19062.12 },
          { texto: "Tique Petrolnor N° 28683 (03/2026): ídem", importe: 15028.97 },
          { texto: "Tique Apellgran N° 44541 (07/2025): redondeo del comprobante", importe: 1 },
          { texto: "Centavos de redondeo en varias facturas", importe: 0.02 },
        ],
        signoDistinto: {
          facturas: [
            { puntoVenta: 1, numero: 670822, cuit: "33707366589" },
            { puntoVenta: 4, numero: 670821, cuit: "33707366589" },
          ],
          notaFila: 'A esta factura se le cambió el signo: en la app está en negativo y en lo presentado a ARCA en positivo. Impacto = factura x 2. Ver el reporte "Diferencias Compras - app vs ARCA" (con link a la factura).',
          referencia: "Referencia: filas en naranja = las 2 facturas de Federación Patronal a las que se les cambió el signo.",
          notaPie: 'Nota: a las 2 facturas de Federación Patronal (PV 1 N° 670822 y PV 4 N° 670821) se les cambió el signo: en la app están en negativo y en lo presentado a ARCA en positivo. Explica la diferencia de 259.296,60 del cuadro consensuado (cada factura x 2). Las facturas (PDF) están linkeadas en el reporte "Diferencias Compras - app vs ARCA".',
          textoMes: "Mes modificado: se le cambió el signo a una factura de Federación Patronal",
          leyendaMes: "Subtotal de un mes modificado (se le cambió el signo a una factura de Federación Patronal)",
          leyendaCuenta: "Cuenta que tiene la factura a la que se le cambió el signo",
        },
      },
      ventas: {
        sistema: { neto: 182273675.51, noGravado: 0, exentas: 265547012.29, iva: 19138735.93, total: 466959423.73, dif: 0 },
        notas: [
          'CRITERIO: se carga lo que va en la DDJJ de IVA ventas: Neto (gravado / no gravado / exento), IVA vendido y Total. Las retenciones no van (ver solapa "Retenciones sufridas").',
          "IVA: en las 3 certificaciones de granos de AFA (05/2026, en naranja) el campo IVA de la app suma el IVA de la comisión y del almacenaje; acá se toma el IVA vendido (columna T menos U).",
          "Se obvia la nota de débito de Pedro Genta 180-11-77393 (02/2026, -279.174,47, sólo total) que figura en las ventas presentadas a ARCA. En la app está en compras.",
          "Dif. de algo más: da 0 en todos los comprobantes. Columnas T y U son informativas: no suman en el cuadro.",
        ],
        notaNaranja: 1,
        notaIvaFila: "IVA vendido = IVA cargado en la app (col. T) - IVA de comisión/almacenaje (col. U). Coincide con lo presentado a ARCA (10,5% del neto). A corregir en la app.",
      },
      notasRetenciones: [
        "Ojo: en Sáenz Valiente lo de ARCA (330.665,50 y 270.618,00) no coincide con la retención de IIBB de la app (94.852,50 y 76.590,00); en Pedro Genta sí coincide (970.830,00).",
      ],
      // «Diferencias Compras / Ventas MSA 25-26 - app vs ARCA.xlsx» (27/10/2026). Los links: columna Q del de compras.
      diferencias: {
        compras: {
          nombreGrupoSigno: "Federación Patronal",
          notaArriba: "A las 2 facturas de Federación Patronal (grupo 1) se les cambió el signo: en la app están en negativo y en lo presentado a ARCA en positivo. Las facturas (PDF) están en la columna Q, con link a Google Drive.",
          links: [
            { puntoVenta: 1, numero: 670822, cuit: "33707366589", url: "https://drive.google.com/file/d/1cS33WYifiVa6FczvaE4ebfFEE82x8j1W/view?usp=drivesdk" },
            { puntoVenta: 4, numero: 670821, cuit: "33707366589", url: "https://drive.google.com/file/d/1JHLHmqATGmmd1JEAkG9K2mVTtxciWbGx/view?usp=drivesdk" },
          ],
          arcaConsensuado: { neto: 172305543.46, noGravado: 217144.86, exento: 17680561.68, otros: 2739187.69, iva: 32125487.55, total: 294439660.59 },
        },
        ventas: {
          porQue: [
            { puntoVenta: 11, numero: 77393, cuit: "30526554562", texto: "Nota de débito con sólo total (sin neto ni IVA): se obvia. En la app está en compras (2026-04, Comisiones, en positivo)." },
          ],
        },
      },
    },
  },
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Las filas (lógica pura, probada en lib/pruebas/casos.ts)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

const r2 = (x: number) => Math.round((Number(x) || 0) * 100) / 100
const soloDigitos = (s: string) => (s ?? "").replace(/\D/g, "")
/** Una cuenta sin número no se pierde: va agrupada como «(sin cuenta)», igual que en el Excel de ventas. */
export const SIN_CUENTA = "(sin cuenta)"

export interface FilaCompraConsensuada {
  asiento: AsientoLibroDiario
  subdiario: string
  fecha: string | null
  /** Código de ARCA, o el texto del histórico cuando no tiene código («Poliza Seguro»). */
  tipo: number | string | null
  puntoVenta: number | null
  numero: number | null
  cuit: string
  denominacion: string
  nroCuenta: string
  cuenta: string
  centroCosto: string
  origen: string
  moneda: string
  tipoCambio: number | null
  totalMonedaOriginal: number | null
  neto: number
  noGravado: number
  exento: number
  monotributo: number
  otros: number
  iva: number
  total: number
  dif: number
  /** Una de las facturas con signo distinto a ARCA (constante del ejercicio). */
  signoDistinto: boolean
}

export interface FilaVentaConsensuada {
  asiento: AsientoLibroDiario
  subdiario: string
  fecha: string | null
  tipo: number | null
  puntoVenta: number | null
  numero: number | null
  nroComprobante: string
  cuit: string
  cliente: string
  nroCuenta: string
  cuenta: string
  centroCosto: string
  ddjjIva: string
  estado: string
  neto: number
  noGravado: number
  exento: number
  /** IVA vendido: el de la app menos comisión y almacenaje. */
  iva: number
  total: number
  dif: number
  ivaCargado: number
  ivaGastos: number
  retIva: number
  retIibb: number
}

/** Compara con los nulos al final, como el `order by` de Postgres. */
const cmpNulo = <T>(a: T | null | undefined, b: T | null | undefined, cmp: (x: T, y: T) => number) =>
  a == null ? (b == null ? 0 : 1) : b == null ? -1 : cmp(a, b)
const cmpTexto = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const cmpNum = (a: number, b: number) => a - b

const esFactura = (f: FilaCompraConsensuada, m: FacturaMarcada) =>
  f.puntoVenta === m.puntoVenta && f.numero === m.numero && soloDigitos(f.cuit) === soloDigitos(m.cuit)

const monedaVisible = (m: string | undefined) => {
  const x = (m ?? "").trim().toUpperCase()
  if (x === "" || x === "PES" || x === "$") return "$"
  return x === "DOL" ? "USD" : x
}

/**
 * Compras del libro → filas del Libro Diario consensuado, ya ordenadas y con Monotributo y «Dif. de algo más».
 * `marcadas`: las facturas con signo distinto a ARCA del ejercicio (si hay).
 */
export function filasComprasConsensuado(compras: AsientoLibroDiario[], marcadas: FacturaMarcada[] = []): FilaCompraConsensuada[] {
  const filas = compras.map((a): FilaCompraConsensuada => {
    const es11 = a.tipo === 11
    const pesos = monedaVisible(a.moneda) === "$"
    const neto = r2(a.neto_gravado)
    const noGravado = es11 ? 0 : r2(a.no_gravado)
    const exento = es11 ? 0 : r2(a.exento)
    const otros = r2(a.otros_tributos)
    const iva = r2(a.iva)
    const total = r2(a.total)
    const monotributo = es11 ? total : 0
    const f: FilaCompraConsensuada = {
      asiento: a, subdiario: a.subdiario, fecha: a.fecha,
      tipo: a.tipo ?? a.tipo_original ?? null,
      puntoVenta: a.punto_venta, numero: a.numero,
      cuit: soloDigitos(a.cuit), denominacion: a.denominacion,
      nroCuenta: (a.nro_cuenta ?? "").trim() || SIN_CUENTA, cuenta: a.cuenta_contable ?? "",
      centroCosto: a.centro_costo ?? "",
      origen: a.fuente === "historico" ? "Histórico" : "Sistema - comprobantes ARCA",
      moneda: monedaVisible(a.moneda),
      tipoCambio: pesos ? null : (a.tipo_cambio ?? null),
      totalMonedaOriginal: pesos ? null : (a.total_moneda_original ?? null),
      neto, noGravado, exento, monotributo, otros, iva, total,
      dif: r2(total - (neto + noGravado + exento + otros + iva + monotributo)),
      signoDistinto: false,
    }
    f.signoDistinto = marcadas.some(m => esFactura(f, m))
    return f
  })
  return filas.sort((x, y) =>
    cmpTexto(x.subdiario, y.subdiario)
    || cmpNulo(x.fecha, y.fecha, cmpTexto)
    || cmpNulo(x.tipo == null ? null : String(x.tipo), y.tipo == null ? null : String(y.tipo), cmpTexto)
    || cmpNulo(x.puntoVenta, y.puntoVenta, cmpNum)
    || cmpNulo(x.numero, y.numero, cmpNum))
}

/** Ventas del libro → filas del Libro Diario consensuado (criterio DDJJ IVA), ordenadas. */
export function filasVentasConsensuado(ventas: AsientoLibroDiario[]): FilaVentaConsensuada[] {
  const filas = ventas.map((a): FilaVentaConsensuada => {
    const d = a.detalleVenta
    const neto = r2(a.neto_gravado), noGravado = r2(a.no_gravado), exento = r2(a.exento)
    const iva = r2(a.iva), total = r2(a.total)
    return {
      asiento: a, subdiario: a.subdiario, fecha: a.fecha, tipo: a.tipo, puntoVenta: a.punto_venta, numero: a.numero,
      nroComprobante: d?.nro_comprobante ?? "", cuit: soloDigitos(a.cuit), cliente: a.denominacion,
      nroCuenta: (a.nro_cuenta ?? "").trim() || SIN_CUENTA,
      cuenta: (a.cuenta_contable ?? "").trim() || "(sin cuenta asignada en la app)",
      centroCosto: a.centro_costo ?? "", ddjjIva: d?.ddjj_iva ?? "", estado: d?.estado ?? "",
      neto, noGravado, exento, iva, total,
      dif: r2(total - (neto + noGravado + exento + iva)),
      ivaCargado: r2(d ? d.iva_cargado : a.iva),
      ivaGastos: r2(d ? d.comision_iva + d.almacenaje_iva : 0),
      retIva: r2(d?.ret_iva ?? 0), retIibb: r2(d?.ret_iibb ?? 0),
    }
  })
  return filas.sort((x, y) =>
    cmpTexto(x.subdiario, y.subdiario)
    || cmpNulo(x.fecha, y.fecha, cmpTexto)
    || cmpNulo(x.tipo, y.tipo, cmpNum)
    || cmpTexto(x.nroComprobante, y.nroComprobante))
}

/** Las ventas con alguna retención (IVA o IIBB): la solapa «Retenciones sufridas». */
export const retencionesSufridas = (ventas: FilaVentaConsensuada[]) => ventas.filter(v => v.retIva !== 0 || v.retIibb !== 0)

/** Orden de las cuentas: por número; las que no son número («(sin cuenta)») al final. */
const ordenCuenta = (k: string) => (/^\d+$/.test(k) ? Number(k) : Number.MAX_SAFE_INTEGER)
const cmpCuenta = (a: string, b: string) => ordenCuenta(a) - ordenCuenta(b) || cmpTexto(a, b)

export interface CuentaPorMes<F> { subdiario: string; cuentas: Array<{ nroCuenta: string; filas: F[] }> }

/**
 * Agrupa por NÚMERO de cuenta: un bloque por mes (sólo los meses con comprobantes) y el total del año.
 * El nombre no agrupa: si una misma cuenta tiene dos nombres, es una sola fila.
 */
export function agruparPorCuenta<F extends { subdiario: string; nroCuenta: string }>(filas: F[]) {
  const meses = [...new Set(filas.map(f => f.subdiario))].sort(cmpTexto)
  const porMes: CuentaPorMes<F>[] = meses.map(m => {
    const del = filas.filter(f => f.subdiario === m)
    const ctas = [...new Set(del.map(f => f.nroCuenta))].sort(cmpCuenta)
    return { subdiario: m, cuentas: ctas.map(k => ({ nroCuenta: k, filas: del.filter(f => f.nroCuenta === k) })) }
  })
  const anio = [...new Set(filas.map(f => f.nroCuenta))].sort(cmpCuenta)
    .map(k => ({ nroCuenta: k, filas: filas.filter(f => f.nroCuenta === k) }))
  return { porMes, anio }
}

/**
 * Nombre de cada cuenta de compras: el de la app; si la cuenta sólo aparece en el histórico, el del histórico. Si hay
 * más de un nombre para el mismo número, van todos separados por « / » (así se ve que difieren).
 */
export function nombresDeCuentaCompras(filas: FilaCompraConsensuada[]): Map<string, string> {
  const app = new Map<string, string[]>(), hist = new Map<string, string[]>()
  for (const f of filas) {
    const m = f.asiento.fuente === "historico" ? hist : app
    const l = m.get(f.nroCuenta) ?? []
    if (!l.includes(f.cuenta)) l.push(f.cuenta)
    m.set(f.nroCuenta, l)
  }
  const out = new Map<string, string>()
  for (const k of new Set([...app.keys(), ...hist.keys()])) out.set(k, (app.get(k) ?? hist.get(k) ?? []).join(" / "))
  return out
}

/** Meses y cuentas que tienen una factura marcada (signo distinto a ARCA). */
export function marcasSignoDistinto(filas: FilaCompraConsensuada[]) {
  const marcadas = filas.filter(f => f.signoDistinto)
  return {
    filas: marcadas,
    meses: new Set(marcadas.map(f => f.subdiario)),
    cuentas: new Set(marcadas.map(f => f.nroCuenta)),
    mesCuenta: new Set(marcadas.map(f => `${f.subdiario}|${f.nroCuenta}`)),
  }
}

const sumar = <F>(filas: F[], campo: (f: F) => number) => r2(filas.reduce((s, f) => s + campo(f), 0))

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// El Excel
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** El formato de número: el de toda la app (`MONEDA`), con los negativos entre paréntesis — JMS 28/10. */
export const IMPORTE = MONEDA
export const CANT = "0"
const FECHA = "dd/mm/yyyy"
export const COLOR = {
  encabezadoCompras: "C6D9EF", azulOscuro: "1F4E79", azulSubtotal: "DDEBF7", azulTotal: "B4C6E7",
  naranjaClaro: "FCE4D6", naranjaSubtotal: "F4B57D", amarillo: "FFFF99", gris: "F2F2F2",
  textoGris: "595959", textoInfo: "7F7F7F", blanco: "FFFFFF",
}

export type Estilo = Record<string, unknown>
type Celda = XLSX.CellObject & { s?: Estilo }

const col = (c: string) => XLSX.utils.decode_col(c)
const L = (i: number) => XLSX.utils.encode_col(i)
const rango = (desde: string, hasta: string) => {
  const out: string[] = []
  for (let i = col(desde); i <= col(hasta); i++) out.push(L(i))
  return out
}
const serialFecha = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000
}
/** Texto que es sólo dígitos → número (CUIT, cuenta, tipo), como lo dejaba el armado a mano. */
export const numOTexto = (v: string | number | null | undefined): string | number | null => {
  if (v == null || v === "") return null
  if (typeof v === "number") return v
  return /^-?\d+$/.test(v) && v.length < 16 ? Number(v) : v
}

/** Una hoja que se llena celda por celda, con estilos que se suman. */
export class Hoja {
  ws: XLSX.WorkSheet = {}
  private maxF = 0
  private maxC = 0
  comentarios = 0

  poner(ref: string, celda: Celda) {
    const { r, c } = XLSX.utils.decode_cell(ref)
    const prev = this.ws[ref] as Celda | undefined
    if (prev?.s) celda.s = { ...prev.s, ...(celda.s ?? {}), font: { ...((prev.s.font as object) ?? {}), ...((celda.s?.font as object) ?? {}) } }
    this.ws[ref] = celda
    this.maxF = Math.max(this.maxF, r)
    this.maxC = Math.max(this.maxC, c)
  }
  texto(ref: string, v: string | null | undefined, s?: Estilo) {
    if (v == null || v === "") return
    this.poner(ref, { t: "s", v, s: s ?? {} })
  }
  /** Texto con formato «@» (subdiarios, números de comprobante): Excel no lo convierte en fecha ni en número. */
  textoFijo(ref: string, v: string) { this.poner(ref, { t: "s", v, z: "@", s: { numFmt: "@" } }) }
  valor(ref: string, v: string | number | null | undefined, z?: string) {
    if (v == null || v === "") return
    if (typeof v === "number") this.poner(ref, { t: "n", v, ...(z ? { z, s: { numFmt: z } } : { s: {} }) })
    else this.poner(ref, { t: "s", v, s: {} })
  }
  fecha(ref: string, iso: string | null) {
    if (!iso) return
    this.poner(ref, { t: "n", v: serialFecha(iso), z: FECHA, s: { numFmt: FECHA } })
  }
  formula(ref: string, f: string, v: number | string, z = IMPORTE) {
    if (typeof v === "string") this.poner(ref, { t: "s", f, v, s: {} })
    else this.poner(ref, { t: "n", f, v, z, s: { numFmt: z } })
  }
  /** Suma un estilo a las celdas `desde..hasta` de una fila (las crea vacías si hace falta, para que se vea el fondo). */
  estilo(fila: number, desde: string, hasta: string, s: Estilo) {
    for (const c of rango(desde, hasta)) {
      const ref = `${c}${fila}`
      const prev = this.ws[ref] as Celda | undefined
      if (prev) {
        prev.s = { ...(prev.s ?? {}), ...s, font: { ...((prev.s?.font as object) ?? {}), ...((s.font as object) ?? {}) } }
      } else {
        this.poner(ref, { t: "s", v: "", s: { ...s } })
      }
    }
  }
  /** Como `estilo`, pero sólo sobre las celdas que ya tienen algo (la negrita o la itálica de una fila entera). */
  estiloLlenas(fila: number, desde: string, hasta: string, s: Estilo) {
    for (const c of rango(desde, hasta)) if (this.ws[`${c}${fila}`]) this.estilo(fila, c, c, s)
  }
  nota(ref: string, texto: string) {
    const c = this.ws[ref] as Celda | undefined
    if (!c) return
    const comentario: XLSX.Comments = [{ a: "Libro Diario", t: texto }]
    comentario.hidden = true
    c.c = comentario
    this.comentarios++
  }
  cerrar(anchos: Record<string, number>, filas?: Record<number, number>, filtro?: string): XLSX.WorkSheet {
    this.ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(this.maxF, 0), c: Math.max(this.maxC, 0) } })
    const cols: XLSX.ColInfo[] = []
    for (const [c, w] of Object.entries(anchos)) cols[col(c)] = { width: w }
    this.ws["!cols"] = cols
    if (filas) {
      const rows: XLSX.RowInfo[] = []
      for (const [f, h] of Object.entries(filas)) rows[Number(f) - 1] = { hpt: h }
      this.ws["!rows"] = rows
    }
    if (filtro) this.ws["!autofilter"] = { ref: filtro }
    return this.ws
  }
}

export const NEGRITA: Estilo = { font: { bold: true } }
export const ITALICA: Estilo = { font: { italic: true } }
export const GRIS: Estilo = { font: { italic: true, color: { rgb: COLOR.textoGris } } }
export const fondo = (rgb: string): Estilo => ({ fill: { patternType: "solid", fgColor: { rgb } } })
export const ENCABEZADO_OSCURO: Estilo = {
  font: { bold: true, color: { rgb: COLOR.blanco } }, ...fondo(COLOR.azulOscuro),
  alignment: { wrapText: true, vertical: "center" },
}
export const subtotal = (rgb: string, arriba = "thin"): Estilo => ({
  font: { bold: true }, ...fondo(rgb),
  border: { top: { style: arriba, color: { rgb: "000000" } }, bottom: { style: "double", color: { rgb: "000000" } } },
})
const CENTRO: Estilo = { alignment: { horizontal: "center" } }

/** Una celda de cantidad (centrada, entera). */
export const cant = (h: Hoja, ref: string, f: string, v: number, s?: Estilo) => {
  h.formula(ref, f, v, CANT)
  h.estilo(Number(ref.replace(/\D/g, "")), ref.replace(/\d/g, ""), ref.replace(/\d/g, ""), { ...CENTRO, ...(s ?? {}) })
}

// ─────────────────────────────── Compras ───────────────────────────────

/** Columnas de importes de Compras, en el orden que dejó el usuario (Monotributo después de Exentas). */
const COMPRAS_IMPORTES = [
  { c: "O", campo: (f: FilaCompraConsensuada) => f.neto, titulo: "Neto Gravado" },
  { c: "P", campo: (f: FilaCompraConsensuada) => f.noGravado, titulo: "No Gravado" },
  { c: "Q", campo: (f: FilaCompraConsensuada) => f.exento, titulo: "Exentas" },
  { c: "R", campo: (f: FilaCompraConsensuada) => f.monotributo, titulo: "Monotributo" },
  { c: "S", campo: (f: FilaCompraConsensuada) => f.otros, titulo: "Otros Tributos" },
  { c: "T", campo: (f: FilaCompraConsensuada) => f.iva, titulo: "IVA" },
  { c: "U", campo: (f: FilaCompraConsensuada) => f.total, titulo: "Total" },
  { c: "V", campo: (f: FilaCompraConsensuada) => f.dif, titulo: "Dif. de algo más" },
]

/** Lo que la hoja de Compras deja ubicado para que «Compras por cuenta» la referencie. */
interface UbicacionComprobantes { hoja: string; ultima: number; filaTotal: number; filaTotalAnio: number; colCant: string }

function hojaCompras(filas: FilaCompraConsensuada[], ej: Ejercicio, k: ConsensuadoDelEjercicio["compras"]) {
  const h = new Hoja()
  const n = filas.length
  const last = n + 1
  const encab = ["Subdiario", "Fecha", "Tipo", "Pto Vta", "Número", "CUIT", "Denominación", "Nro cuenta", "Cuenta contable",
    "Centro de costo", "Origen del dato", "Moneda", "Tipo de cambio", "Total en moneda original", ...COMPRAS_IMPORTES.map(x => x.titulo)]
  encab.forEach((t, i) => h.texto(`${L(i)}1`, t))
  h.estilo(1, "A", "V", { ...NEGRITA, ...fondo(COLOR.encabezadoCompras) })

  filas.forEach((f, i) => {
    const r = i + 2
    h.textoFijo(`A${r}`, f.subdiario)
    h.fecha(`B${r}`, f.fecha)
    h.valor(`C${r}`, numOTexto(f.tipo))
    h.valor(`D${r}`, f.puntoVenta)
    h.valor(`E${r}`, f.numero)
    h.valor(`F${r}`, numOTexto(f.cuit))
    h.texto(`G${r}`, f.denominacion)
    h.valor(`H${r}`, numOTexto(f.nroCuenta))
    h.texto(`I${r}`, f.cuenta)
    h.texto(`J${r}`, f.centroCosto)
    h.texto(`K${r}`, f.origen)
    h.texto(`L${r}`, f.moneda)
    h.valor(`M${r}`, f.tipoCambio, IMPORTE)
    h.valor(`N${r}`, f.totalMonedaOriginal, IMPORTE)
    for (const x of COMPRAS_IMPORTES.slice(0, 7)) h.valor(`${x.c}${r}`, x.campo(f), IMPORTE)
    h.formula(`V${r}`, `U${r}-(O${r}+P${r}+Q${r}+S${r}+T${r}+R${r})`, f.dif)
  })

  const tr = last + 1
  h.texto(`A${tr}`, "TOTAL", NEGRITA)
  h.formula(`G${tr}`, `COUNTA(A2:A${last})&" comprobantes"`, `${n} comprobantes`)
  const tot: Record<string, number> = {}
  for (const x of COMPRAS_IMPORTES) {
    tot[x.c] = sumar(filas, x.campo)
    h.formula(`${x.c}${tr}`, `SUM(${x.c}2:${x.c}${last})`, tot[x.c])
  }
  h.estiloLlenas(tr, "A", "V", NEGRITA)

  // Totales por mes: el mes en J y la cantidad en M (como lo dejó el usuario).
  const mh = tr + 3, mh2 = mh + 1, m1 = mh2 + 1
  h.texto(`J${mh}`, "TOTALES POR MES (SUBDIARIO)", NEGRITA)
  h.texto(`J${mh2}`, "Subdiario"); h.texto(`M${mh2}`, "Comprobantes")
  for (const x of COMPRAS_IMPORTES) h.texto(`${x.c}${mh2}`, x.titulo)
  h.estilo(mh2, "A", "V", { ...NEGRITA, ...fondo(COLOR.encabezadoCompras) })
  const meses = ej.subdiarios.map(s => claveSubdiario(s.anio, s.mes))
  meses.forEach((m, i) => {
    const r = m1 + i
    const del = filas.filter(f => f.subdiario === m)
    h.textoFijo(`J${r}`, m)
    cant(h, `M${r}`, `COUNTIF($A$2:$A$${last},$J${r})`, del.length)
    for (const x of COMPRAS_IMPORTES) h.formula(`${x.c}${r}`, `SUMIF($A$2:$A$${last},$J${r},${x.c}$2:${x.c}$${last})`, sumar(del, x.campo))
  })
  const mN = m1 + meses.length - 1, ta = mN + 1, ck = ta + 1
  const delEjercicio = filas.filter(f => meses.includes(f.subdiario))
  const totAnio: Record<string, number> = {}
  h.texto(`J${ta}`, "TOTAL AÑO", NEGRITA)
  cant(h, `M${ta}`, `SUM(M${m1}:M${mN})`, delEjercicio.length, NEGRITA)
  for (const x of COMPRAS_IMPORTES) {
    totAnio[x.c] = sumar(delEjercicio, x.campo)
    h.formula(`${x.c}${ta}`, `SUM(${x.c}${m1}:${x.c}${mN})`, totAnio[x.c])
  }
  h.estiloLlenas(ta, "J", "V", NEGRITA)
  h.texto(`J${ck}`, "Control: Total año - fila TOTAL (debe dar 0)")
  cant(h, `M${ck}`, `M${ta}-COUNTA(A2:A${last})`, delEjercicio.length - n)
  for (const x of COMPRAS_IMPORTES) h.formula(`${x.c}${ck}`, `ROUND(${x.c}${ta}-${x.c}${tr},2)`, r2(totAnio[x.c] - tot[x.c]))
  h.estiloLlenas(ck, "J", "V", ITALICA)

  let fin = ck
  if (k) {
    // Cuadro consensuado: la fila «Sistema» y su control contra el TOTAL AÑO.
    const cs = ck + 2, cd = cs + 1
    const sis = k.sistema
    h.texto(`A${cs}`, "Sistema")
    h.texto(`I${cs}`, "(No Gravado + Exentas juntos en la columna No Gravado)")
    const valores: Record<string, number> = { O: sis.neto, P: sis.noGravadoYExento, R: sis.monotributo, S: sis.otros, T: sis.iva, U: sis.total, V: sis.dif }
    for (const [c, v] of Object.entries(valores)) h.valor(`${c}${cs}`, v, IMPORTE)
    h.estilo(cs, "A", "V", { ...NEGRITA, ...fondo(COLOR.amarillo) })
    h.texto(`A${cd}`, "Control: Total año - consensuado (debe dar 0)")
    for (const c of ["O", "R", "S", "T", "U", "V"]) h.formula(`${c}${cd}`, `ROUND(${c}${ta}-${c}${cs},2)`, r2(totAnio[c] - valores[c]))
    h.formula(`P${cd}`, `ROUND(P${ta}+Q${ta}-P${cs},2)`, r2(totAnio.P + totAnio.Q - valores.P))
    h.estiloLlenas(cd, "A", "V", ITALICA)

    // Composición de «Dif. de algo más».
    const dx = cd + 2
    h.texto(`A${dx}`, 'COMPOSICIÓN DE "DIF. DE ALGO MÁS"', NEGRITA)
    h.estilo(dx, "A", "V", fondo(COLOR.gris))
    h.texto(`A${dx + 1}`, "Es un monto que aglutina pequeños saldos: comprobantes cuyo total no se abre en conceptos del cuadro. Sabemos que en parte es por lo siguiente:", ITALICA)
    let j = dx + 2
    for (const it of k.composicionDif) { h.texto(`A${j}`, it.texto); h.valor(`V${j}`, it.importe, IMPORTE); j++ }
    const explicado = r2(k.composicionDif.reduce((s, it) => s + it.importe, 0))
    h.texto(`A${j}`, "Total explicado", NEGRITA)
    h.formula(`V${j}`, `SUM(V${dx + 2}:V${j - 1})`, explicado)
    h.estilo(j, "V", "V", NEGRITA)
    h.texto(`A${j + 1}`, "Control: Dif. de algo más del TOTAL - total explicado (debe dar 0)", ITALICA)
    h.formula(`V${j + 1}`, `ROUND(V${tr}-V${j},2)`, r2(tot.V - explicado))
    h.nota("V1", k.notaDif)

    // Las facturas con signo distinto a ARCA: fila en naranja + nota, y la referencia al pie.
    filas.forEach((f, i) => {
      if (!f.signoDistinto) return
      h.estilo(i + 2, "A", "V", fondo(COLOR.naranjaClaro))
      h.nota(`G${i + 2}`, k.signoDistinto.notaFila)
    })
    const ley = j + 3
    h.texto(`A${ley}`, k.signoDistinto.referencia, { ...ITALICA, ...fondo(COLOR.naranjaClaro) })
    h.texto(`A${ley + 1}`, k.signoDistinto.notaPie, NEGRITA)
    fin = ley + 1
    // ⚠️ Nada en silencio: si una factura marcada no está en los datos, se dice.
    const faltan = k.signoDistinto.facturas.filter(m => !filas.some(f => esFactura(f, m)))
    if (faltan.length) {
      h.texto(`A${fin + 1}`, `⚠️ No se encontró en los datos: ${faltan.map(m => `PV ${m.puntoVenta} N° ${m.numero} (CUIT ${m.cuit})`).join(" · ")}.`, { font: { bold: true, color: { rgb: "A12B2B" } } })
      fin++
    }
  }

  const ws = h.cerrar({
    A: 10, B: 10.71, C: 7.29, D: 5.29, E: 10.57, F: 12, G: 37.43, H: 9, I: 24.86, J: 8.29, K: 8.57, L: 3.71, M: 9.43,
    N: 12.14, O: 14.14, P: 13.71, Q: 12.71, R: 14.71, S: 15.86, T: 12.71, U: 13.71, V: 17.29,
  }, undefined, `A1:V${last}`)
  return { ws, ubic: { hoja: "Compras", ultima: last, filaTotal: tr, filaTotalAnio: ta, colCant: "M" } as UbicacionComprobantes, tot, comentarios: h.comentarios }
}

// ─────────────────────────────── Por cuenta (compras y ventas) ───────────────────────────────

interface ColPorCuenta<F> { c: string; origen: string; campo: (f: F) => number }

function hojaPorCuenta<F extends { subdiario: string; nroCuenta: string }>(
  filas: F[], u: UbicacionComprobantes, colCuenta: string, cols: ColPorCuenta<F>[],
  nombre: (k: string) => string, titulos: string[],
  marcas?: { mesCuenta: Set<string>; meses: Set<string>; cuentas: Set<string>; textoMes: string; leyendas?: { mes: string; cuenta: string } },
  pieVentas?: string,
) {
  const h = new Hoja()
  const ult = colsUltima(cols)
  ;["Subdiario", "Nro cuenta", "Cuenta contable", "Cant.", ...titulos].forEach((t, i) => h.texto(`${L(i)}1`, t))
  h.estilo(1, "A", ult, ENCABEZADO_OSCURO)
  const S = `${u.hoja}!`
  const A = `${S}$A$2:$A$${u.ultima}`, K = `${S}$${colCuenta}$2:$${colCuenta}$${u.ultima}`
  const rng = (c: string) => `${S}${c}$2:${c}$${u.ultima}`
  const { porMes, anio } = agruparPorCuenta(filas)

  let r = 2
  const subRows: number[] = []
  for (const bloque of porMes) {
    const start = r
    for (const cta of bloque.cuentas) {
      h.textoFijo(`A${r}`, bloque.subdiario)
      h.valor(`B${r}`, numOTexto(cta.nroCuenta))
      h.texto(`C${r}`, nombre(cta.nroCuenta))
      cant(h, `D${r}`, `COUNTIFS(${A},$A${r},${K},$B${r})`, cta.filas.length)
      for (const x of cols) h.formula(`${x.c}${r}`, `SUMIFS(${rng(x.origen)},${A},$A${r},${K},$B${r})`, sumar(cta.filas, x.campo))
      if (marcas?.mesCuenta.has(`${bloque.subdiario}|${cta.nroCuenta}`)) h.estilo(r, "A", ult, fondo(COLOR.naranjaClaro))
      r++
    }
    const end = r - 1
    const del = bloque.cuentas.flatMap(c => c.filas)
    h.textoFijo(`A${r}`, `Subtotal ${bloque.subdiario}`)
    cant(h, `D${r}`, `SUM(D${start}:D${end})`, del.length)
    for (const x of cols) h.formula(`${x.c}${r}`, `SUM(${x.c}${start}:${x.c}${end})`, sumar(del, x.campo))
    const modificado = marcas?.meses.has(bloque.subdiario)
    h.estilo(r, "A", ult, subtotal(modificado ? COLOR.naranjaSubtotal : COLOR.azulSubtotal))
    if (modificado && marcas) h.texto(`C${r}`, marcas.textoMes, { font: { bold: true, italic: true } })
    subRows.push(r)
    r += 2
  }

  h.texto(`A${r}`, "TOTAL 12 MESES POR CUENTA")
  h.estilo(r, "A", ult, { font: { bold: true, color: { rgb: COLOR.blanco } }, ...fondo(COLOR.azulOscuro) })
  r++
  const tStart = r
  for (const cta of anio) {
    h.texto(`A${r}`, "Año")
    h.valor(`B${r}`, numOTexto(cta.nroCuenta))
    h.texto(`C${r}`, nombre(cta.nroCuenta))
    cant(h, `D${r}`, `COUNTIFS(${K},$B${r})`, cta.filas.length)
    for (const x of cols) h.formula(`${x.c}${r}`, `SUMIFS(${rng(x.origen)},${K},$B${r})`, sumar(cta.filas, x.campo))
    if (marcas?.cuentas.has(cta.nroCuenta)) h.estilo(r, "A", ult, fondo(COLOR.naranjaClaro))
    r++
  }
  const tEnd = r - 1, tg = r
  const tot: Record<string, number> = {}
  h.texto(`A${tg}`, "TOTAL GENERAL")
  cant(h, `D${tg}`, `SUM(D${tStart}:D${tEnd})`, filas.length)
  for (const x of cols) { tot[x.c] = sumar(filas, x.campo); h.formula(`${x.c}${tg}`, `SUM(${x.c}${tStart}:${x.c}${tEnd})`, tot[x.c]) }
  h.estilo(tg, "A", ult, subtotal(COLOR.azulTotal, marcas ? "medium" : "thin"))

  // Los tres controles.
  const c1 = tg + 2
  h.texto(`A${c1}`, `Suma de los ${marcas ? "12 " : ""}subtotales mensuales`)
  h.texto(`A${c1 + 1}`, "Control: Total general - suma de subtotales (debe dar 0)")
  h.texto(`A${c1 + 2}`, "Control: Total general - fila TOTAL de Comprobantes (debe dar 0)")
  h.texto(`A${c1 + 3}`, "Control: Total general - TOTAL AÑO de Comprobantes (debe dar 0)")
  const sumaSub = (f: (x: F) => number) => sumar(filas, f)
  const sumaD = subRows.length ? subRows.map(x => `D${x}`).join("+") : "0"
  cant(h, `D${c1}`, sumaD, filas.length)
  cant(h, `D${c1 + 1}`, `ROUND(D${tg}-D${c1},2)`, 0)
  cant(h, `D${c1 + 2}`, `D${tg}-COUNTA(${S}A2:A${u.ultima})`, 0)
  cant(h, `D${c1 + 3}`, `D${tg}-${S}${u.colCant}${u.filaTotalAnio}`, 0)
  for (const x of cols) {
    h.formula(`${x.c}${c1}`, subRows.length ? subRows.map(s => `${x.c}${s}`).join("+") : "0", sumaSub(x.campo))
    h.formula(`${x.c}${c1 + 1}`, `ROUND(${x.c}${tg}-${x.c}${c1},2)`, 0)
    h.formula(`${x.c}${c1 + 2}`, `ROUND(${x.c}${tg}-${S}${x.origen}${u.filaTotal},2)`, 0)
    h.formula(`${x.c}${c1 + 3}`, `ROUND(${x.c}${tg}-${S}${x.origen}${u.filaTotalAnio},2)`, 0)
  }
  h.estilo(c1, "A", ult, marcas ? { font: { color: { rgb: COLOR.textoGris } } } : GRIS)
  for (let q = 1; q <= 3; q++) h.estilo(c1 + q, "A", ult, GRIS)

  if (marcas?.leyendas) {
    const lr = c1 + 5
    h.texto(`A${lr}`, "Referencias:", NEGRITA)
    h.estilo(lr + 1, "B", "B", fondo(COLOR.azulSubtotal)); h.texto(`C${lr + 1}`, "Subtotal del mes")
    h.estilo(lr + 2, "B", "B", fondo(COLOR.naranjaSubtotal)); h.texto(`C${lr + 2}`, marcas.leyendas.mes)
    h.estilo(lr + 3, "B", "B", fondo(COLOR.naranjaClaro)); h.texto(`C${lr + 3}`, marcas.leyendas.cuenta)
  }
  if (pieVentas) h.texto(`A${c1 + 5}`, pieVentas, ITALICA)
  return { h, tot }
}
const colsUltima = (cols: Array<{ c: string }>) => cols[cols.length - 1].c

// ─────────────────────────────── Ventas ───────────────────────────────

const VENTAS_IMPORTES = [
  { c: "N", campo: (f: FilaVentaConsensuada) => f.neto, titulo: "Neto Gravado" },
  { c: "O", campo: (f: FilaVentaConsensuada) => f.noGravado, titulo: "No Gravado" },
  { c: "P", campo: (f: FilaVentaConsensuada) => f.exento, titulo: "Exentas" },
  { c: "Q", campo: (f: FilaVentaConsensuada) => f.iva, titulo: "IVA" },
  { c: "R", campo: (f: FilaVentaConsensuada) => f.total, titulo: "Total" },
  { c: "S", campo: (f: FilaVentaConsensuada) => f.dif, titulo: "Dif. de algo más" },
]

function hojaVentas(filas: FilaVentaConsensuada[], ej: Ejercicio, k: ConsensuadoDelEjercicio["ventas"]) {
  const h = new Hoja()
  const n = filas.length, last = n + 1
  const encab = ["Subdiario", "Fecha", "Tipo", "Pto Vta", "Número", "Nro comprobante", "CUIT", "Cliente", "Nro cuenta", "Cuenta contable",
    "Centro de costo", "DDJJ IVA (app)", "Estado (app)", ...VENTAS_IMPORTES.map(x => x.titulo), "IVA cargado en la app (info)", "IVA comisión + almacenaje (info)"]
  encab.forEach((t, i) => h.texto(`${L(i)}1`, t))
  h.estilo(1, "A", "U", ENCABEZADO_OSCURO)
  const INFO: Estilo = { font: { color: { rgb: COLOR.textoInfo } } }

  filas.forEach((f, i) => {
    const r = i + 2
    h.textoFijo(`A${r}`, f.subdiario)
    h.fecha(`B${r}`, f.fecha)
    h.valor(`C${r}`, f.tipo); h.valor(`D${r}`, f.puntoVenta); h.valor(`E${r}`, f.numero)
    if (f.nroComprobante) h.textoFijo(`F${r}`, f.nroComprobante)
    h.valor(`G${r}`, numOTexto(f.cuit))
    h.texto(`H${r}`, f.cliente)
    h.valor(`I${r}`, numOTexto(f.nroCuenta))
    h.texto(`J${r}`, f.cuenta)
    h.texto(`K${r}`, f.centroCosto)
    h.texto(`L${r}`, f.ddjjIva); h.texto(`M${r}`, f.estado)
    for (const x of VENTAS_IMPORTES.slice(0, 5)) h.valor(`${x.c}${r}`, x.campo(f), IMPORTE)
    h.formula(`S${r}`, `R${r}-(N${r}+O${r}+P${r}+Q${r})`, f.dif)
    h.valor(`T${r}`, f.ivaCargado, IMPORTE); h.valor(`U${r}`, f.ivaGastos, IMPORTE)
    h.estilo(r, "T", "U", INFO)
    if (f.ivaGastos !== 0) {
      h.estilo(r, "A", "U", fondo(COLOR.naranjaClaro))
      h.nota(`Q${r}`, k?.notaIvaFila ?? "IVA vendido = IVA cargado en la app (col. T) - IVA de comisión/almacenaje (col. U).")
    }
  })

  const tr = last + 1
  const tot: Record<string, number> = {}
  h.texto(`A${tr}`, "TOTAL")
  h.formula(`H${tr}`, `COUNTA(A2:A${last})&" comprobantes"`, `${n} comprobantes`)
  for (const x of VENTAS_IMPORTES) { tot[x.c] = sumar(filas, x.campo); h.formula(`${x.c}${tr}`, `SUM(${x.c}2:${x.c}${last})`, tot[x.c]) }
  h.formula(`T${tr}`, `SUM(T2:T${last})`, sumar(filas, f => f.ivaCargado))
  h.formula(`U${tr}`, `SUM(U2:U${last})`, sumar(filas, f => f.ivaGastos))
  h.estilo(tr, "A", "U", subtotal(COLOR.azulTotal))
  h.estilo(tr, "T", "U", INFO)

  const mh = tr + 3, mh2 = mh + 1, m1 = mh2 + 1
  h.texto(`A${mh}`, "TOTALES POR MES (SUBDIARIO)", NEGRITA)
  h.texto(`A${mh2}`, "Subdiario"); h.texto(`H${mh2}`, "Comprobantes")
  for (const x of VENTAS_IMPORTES) h.texto(`${x.c}${mh2}`, x.titulo)
  h.estilo(mh2, "A", "S", ENCABEZADO_OSCURO)
  const meses = ej.subdiarios.map(s => claveSubdiario(s.anio, s.mes))
  meses.forEach((m, i) => {
    const r = m1 + i
    const del = filas.filter(f => f.subdiario === m)
    h.textoFijo(`A${r}`, m)
    cant(h, `H${r}`, `COUNTIF($A$2:$A$${last},$A${r})`, del.length)
    for (const x of VENTAS_IMPORTES) h.formula(`${x.c}${r}`, `SUMIF($A$2:$A$${last},$A${r},${x.c}$2:${x.c}$${last})`, sumar(del, x.campo))
  })
  const mN = m1 + meses.length - 1, ta = mN + 1, ck = ta + 1
  const delEj = filas.filter(f => meses.includes(f.subdiario))
  const totAnio: Record<string, number> = {}
  h.texto(`A${ta}`, "TOTAL AÑO")
  cant(h, `H${ta}`, `SUM(H${m1}:H${mN})`, delEj.length)
  for (const x of VENTAS_IMPORTES) { totAnio[x.c] = sumar(delEj, x.campo); h.formula(`${x.c}${ta}`, `SUM(${x.c}${m1}:${x.c}${mN})`, totAnio[x.c]) }
  h.estilo(ta, "A", "S", subtotal(COLOR.azulTotal))
  h.texto(`A${ck}`, "Control: Total año - fila TOTAL (debe dar 0)")
  cant(h, `H${ck}`, `H${ta}-COUNTA(A2:A${last})`, delEj.length - n)
  for (const x of VENTAS_IMPORTES) h.formula(`${x.c}${ck}`, `ROUND(${x.c}${ta}-${x.c}${tr},2)`, r2(totAnio[x.c] - tot[x.c]))
  h.estilo(ck, "A", "U", GRIS)

  let nt = ck + 2
  if (k) {
    const cs = ck + 2, cd = cs + 1
    h.texto(`A${cs}`, "Sistema", NEGRITA)
    h.texto(`J${cs}`, "(cuadro de control ventas - criterio DDJJ IVA)")
    const sis = k.sistema
    const v: Record<string, number> = { N: sis.neto, O: sis.noGravado, P: sis.exentas, Q: sis.iva, R: sis.total, S: sis.dif }
    for (const [c, x] of Object.entries(v)) h.valor(`${c}${cs}`, x, IMPORTE)
    h.estilo(cs, "A", "S", fondo(COLOR.amarillo))
    h.texto(`A${cd}`, "Control: Total año - cuadro de control (debe dar 0)")
    for (const x of VENTAS_IMPORTES) h.formula(`${x.c}${cd}`, `ROUND(${x.c}${ta}-${x.c}${cs},2)`, r2(totAnio[x.c] - v[x.c]))
    h.estilo(cd, "A", "U", GRIS)
    nt = cd + 2
  }
  const notas = k?.notas ?? [
    'CRITERIO: se carga lo que va en la DDJJ de IVA ventas: Neto (gravado / no gravado / exento), IVA vendido y Total. Las retenciones no van (ver solapa "Retenciones sufridas").',
    "Columnas T y U son informativas: no suman en el cuadro.",
  ]
  notas.forEach((t, q) => h.texto(`A${nt + q}`, t, q === 0 ? NEGRITA : q === k?.notaNaranja ? fondo(COLOR.naranjaClaro) : undefined))

  const ws = h.cerrar({
    A: 10.71, B: 11.41, C: 6.71, D: 6.71, E: 10.71, F: 16.71, G: 12.71, H: 36.71, I: 9.71, J: 30.71, K: 16.71, L: 9.71, M: 10.71,
    N: 15.71, O: 12.71, P: 15.71, Q: 14.71, R: 15.71, S: 11.71, T: 13.71, U: 13.71,
  }, { 1: 45 }, `A1:U${last}`)
  return { ws, ubic: { hoja: "Ventas", ultima: last, filaTotal: tr, filaTotalAnio: ta, colCant: "H" } as UbicacionComprobantes, tot, comentarios: h.comentarios }
}

function hojaRetenciones(ret: FilaVentaConsensuada[], empresa: string, ej: Ejercicio, notas: string[] = []) {
  const h = new Hoja()
  // «2025-26» (el ejercicio partido con el primer año entero), o «2025» si es calendario.
  const primero = ej.subdiarios[0].anio
  const periodo = primero === ej.anioCierre ? String(primero) : `${primero}-${String(ej.anioCierre).slice(-2)}`
  h.texto("A1", `RETENCIONES SUFRIDAS EN VENTAS - ${empresa} ${periodo} (no van en la DDJJ de IVA ventas)`, { font: { bold: true, sz: 13 } })
  ;["Subdiario", "Fecha", "Cliente", "CUIT", "Comprobante (app)", "Ret. IVA", "Ret. IIBB", "Total retenido"].forEach((t, i) => h.texto(`${L(i)}3`, t))
  h.estilo(3, "A", "H", ENCABEZADO_OSCURO)
  let r = 4
  for (const f of ret) {
    h.textoFijo(`A${r}`, f.subdiario)
    h.fecha(`B${r}`, f.fecha)
    h.texto(`C${r}`, f.cliente)
    h.textoFijo(`D${r}`, f.cuit)
    h.texto(`E${r}`, `tipo ${f.tipo ?? "?"} / ${f.nroComprobante || `${f.puntoVenta ?? ""}-${f.numero ?? ""}`}`)
    h.valor(`F${r}`, f.retIva, IMPORTE); h.valor(`G${r}`, f.retIibb, IMPORTE)
    h.formula(`H${r}`, `F${r}+G${r}`, r2(f.retIva + f.retIibb))
    r++
  }
  const tot = { iva: sumar(ret, f => f.retIva), iibb: sumar(ret, f => f.retIibb) }
  h.texto(`A${r}`, "TOTAL")
  if (ret.length) {
    h.formula(`F${r}`, `SUM(F4:F${r - 1})`, tot.iva)
    h.formula(`G${r}`, `SUM(G4:G${r - 1})`, tot.iibb)
    h.formula(`H${r}`, `SUM(H4:H${r - 1})`, r2(tot.iva + tot.iibb))
  }
  h.estilo(r, "A", "H", subtotal(COLOR.azulTotal))
  h.texto(`A${r + 2}`, "Datos de la app (ret_iva / ret_iibb de cada liquidación).", GRIS)
  notas.forEach((t, q) => h.texto(`A${r + 3 + q}`, t, fondo(COLOR.naranjaClaro)))
  const ws = h.cerrar({ A: 10.71, B: 11.71, C: 44.71, D: 13.71, E: 18.71, F: 15.71, G: 15.71, H: 15.71 }, { 1: 17.25, 3: 32.1 })
  return { ws, tot }
}

// ─────────────────────────────── El libro ───────────────────────────────

/** Qué se arma, para el control del script y de la pantalla. */
export interface ResumenConsensuado {
  compras: { comprobantes: number; totales: Record<string, number> }
  ventas: { comprobantes: number; totales: Record<string, number> }
  retenciones: { comprobantes: number; iva: number; iibb: number }
  /** true si había constantes del ejercicio (cuadro consensuado, marcas, notas). */
  conConsensuado: boolean
}

/** Vista de cada solapa que `xlsx-js-style` no sabe escribir: encabezado inmovilizado y cuadrícula. */
export interface Vista { congelarFilas?: number; sinCuadricula?: boolean }

export interface LibroConsensuado { wb: XLSX.WorkBook; vistas: Vista[]; resumen: ResumenConsensuado }

/**
 * Arma el libro de cinco solapas. Recibe el `LibroDiario` ya armado (los 12 subdiarios, histórico superado afuera,
 * dólares en pesos, IVA de ventas ya vendido) y no vuelve a filtrar nada.
 */
export function armarLibroDiarioConsensuado(libro: LibroDiario, empresa: string): LibroConsensuado {
  const ej = libro.ejercicio
  const k = LIBRO_DIARIO_CONSENSUADO[empresa]?.[ej.anioCierre]
  const compras = filasComprasConsensuado(libro.compras, k?.compras?.signoDistinto.facturas ?? [])
  const ventas = filasVentasConsensuado(libro.ventas)
  const ret = retencionesSufridas(ventas)
  const wb = XLSX.utils.book_new()

  const c = hojaCompras(compras, ej, k?.compras)
  XLSX.utils.book_append_sheet(wb, c.ws, "Compras")
  const nombres = nombresDeCuentaCompras(compras)
  const m = marcasSignoDistinto(compras)
  const pc = hojaPorCuenta(compras, c.ubic, "H",
    COMPRAS_IMPORTES.map((x, i) => ({ c: L(4 + i), origen: x.c, campo: x.campo })),
    kk => nombres.get(kk) ?? "", COMPRAS_IMPORTES.map(x => x.titulo),
    {
      mesCuenta: m.mesCuenta, meses: m.meses, cuentas: m.cuentas, textoMes: k?.compras?.signoDistinto.textoMes ?? "",
      leyendas: k?.compras ? { mes: k.compras.signoDistinto.leyendaMes, cuenta: k.compras.signoDistinto.leyendaCuenta } : undefined,
    })
  XLSX.utils.book_append_sheet(wb, pc.h.cerrar({ A: 18.71, B: 10.71, C: 40.71, D: 5.57, E: 15.71, F: 15.71, G: 15.71, H: 15.71, I: 15.71, J: 15.71, K: 15.71, L: 15.71 }, { 1: 32.1 }), "Compras por cuenta")

  const v = hojaVentas(ventas, ej, k?.ventas)
  XLSX.utils.book_append_sheet(wb, v.ws, "Ventas")
  const nomVenta = new Map<string, string>()
  for (const f of ventas) nomVenta.set(f.nroCuenta, f.cuenta)   // el último gana, como en el armado a mano
  const mesesEj = ej.subdiarios.map(s => claveSubdiario(s.anio, s.mes))
  const sinVentas = mesesEj.filter(mm => !ventas.some(f => f.subdiario === mm))
  const pv = hojaPorCuenta(ventas, v.ubic, "I",
    VENTAS_IMPORTES.map((x, i) => ({ c: L(4 + i), origen: x.c, campo: x.campo })),
    kk => nomVenta.get(kk) ?? "", VENTAS_IMPORTES.map(x => x.titulo), undefined,
    sinVentas.length ? `Meses sin ventas en la app: ${sinVentas.join(", ")}.` : undefined)
  XLSX.utils.book_append_sheet(wb, pv.h.cerrar({ A: 18.71, B: 13.71, C: 40.71, D: 7.71, E: 15.71, F: 15.71, G: 15.71, H: 15.71, I: 15.71, J: 15.71 }, { 1: 32.1 }), "Ventas por cuenta")

  const rt = hojaRetenciones(ret, empresa, ej, k?.notasRetenciones)
  XLSX.utils.book_append_sheet(wb, rt.ws, "Retenciones sufridas")

  return {
    wb,
    vistas: [
      { congelarFilas: 1 }, { congelarFilas: 1, sinCuadricula: true },
      { congelarFilas: 1 }, { congelarFilas: 1, sinCuadricula: true },
      { sinCuadricula: true },
    ],
    resumen: {
      compras: { comprobantes: compras.length, totales: c.tot },
      ventas: { comprobantes: ventas.length, totales: v.tot },
      retenciones: { comprobantes: ret.length, ...rt.tot },
      conConsensuado: !!k,
    },
  }
}

/**
 * 🪟 Encabezado inmovilizado y cuadrícula apagada. `xlsx-js-style` (SheetJS 0.18 libre) no escribe `<pane>` ni
 * `showGridLines` — `!freeze` lo ignora —, así que se agregan al XML de cada solapa después de escribir el archivo.
 */
export async function aplicarVistas(datos: Uint8Array | ArrayBuffer, vistas: Vista[]): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(datos)
  for (let i = 0; i < vistas.length; i++) {
    const v = vistas[i]
    if (!v.congelarFilas && !v.sinCuadricula) continue
    const ruta = `xl/worksheets/sheet${i + 1}.xml`
    const f = zip.file(ruta)
    if (!f) continue
    const xml = await f.async("string")
    const atrib = v.sinCuadricula ? ' showGridLines="0"' : ""
    const pane = v.congelarFilas
      ? `<pane ySplit="${v.congelarFilas}" topLeftCell="A${v.congelarFilas + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${v.congelarFilas + 1}" sqref="A${v.congelarFilas + 1}"/>`
      : ""
    const nuevo = xml.replace(/<sheetView ([^>]*?)\/>/, (_m, a: string) => `<sheetView ${a}${atrib}>${pane}</sheetView>`)
    zip.file(ruta, nuevo)
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })
}

/** Los bytes del .xlsx, listos para bajar o guardar. */
export async function bytesLibroDiarioConsensuado(l: LibroConsensuado): Promise<Uint8Array> {
  const out = XLSX.write(l.wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer
  return aplicarVistas(out, l.vistas)
}

/** `Libro_Diario_MSA_25-26_2026-10-28.xlsx` — el día en hora argentina. */
export function nombreArchivoConsensuado(libro: LibroDiario, empresa: string, hoy: string): string {
  return `Libro_Diario_${empresa}_${libro.ejercicio.etiqueta.replace("/", "-")}_${hoy}.xlsx`
}

/** Baja el Libro Diario consensuado en el navegador. */
export async function descargarLibroDiarioConsensuado(libro: LibroDiario, empresa: string): Promise<ResumenConsensuado> {
  const l = armarLibroDiarioConsensuado(libro, empresa)
  const bytes = await bytesLibroDiarioConsensuado(l)
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
  const a = document.createElement("a")
  a.href = url
  a.download = nombreArchivoConsensuado(libro, empresa, hoyArgentina())
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 0)
  return l.resumen
}
