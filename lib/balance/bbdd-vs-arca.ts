/**
 * 📋 **Compras y ventas — la BASE y ARCA, ahora** (planilla objetivo de JMS 27/10, «Objetivo para ahora.xlsx»).
 *
 * Cuatro hojas con las MISMAS 21 columnas y el total al pie:
 * - **Compras / Ventas BBDD ahora**: todos los comprobantes del ejercicio como están hoy en la base (los mismos del libro
 *   diario: por subdiario, compras de ARCA + histórico; ventas con el IVA del libro).
 * - **Compras / Ventas ARCA ahora**: todos los declarados, de los zips **tal cual** (*«en ARCA no hemos cambiado nada
 *   ahora… es ARCA igual que original»*): sin la rectificación y con las ventas como ARCA las informa (la retención de
 *   una liquidación resta como «otros tributos»).
 *
 * La última columna es el control que pidió: *«total menos partes = 0 está bien»*. El renglón que no da 0 va en rojo.
 * Antes del control, una columna más: **Sin crédito (B/C)** — una factura B o C no discrimina el IVA, su total no tiene
 * partes; lo que no está en ninguna columna va ahí (el mismo criterio que la columna «Sin crédito» del libro diario).
 * Tolerancia: la misma de la cuadratura del libro diario, 0,05 por comprobante (redondeo del emisor).
 */
import XLSX from "xlsx-js-style"
import type { LibroDiario, AsientoLibroDiario } from "./libro-diario"
import type { ComprobantePresentado } from "@/lib/subdiarios/libro-presentado"
import { agregarHoja, conEstilo, ESTILO_ERROR, ESTILO_TOTAL } from "./export-libro-diario"
import { conFormula, MONEDA, ENTERO, FECHA, type Columna } from "./formato-excel"
import { TIPOS_SIN_CREDITO_COMPRAS, TOLERANCIA_POR_COMPROBANTE as TOL } from "@/lib/subdiarios/cuadratura"
import { TIPOS_SIN_CREDITO_VENTAS } from "./libro-por-cuenta"

type Lado = "compras" | "ventas"
/** Lo declarado de un subdiario (`2026-03`), por lado — lo que devuelven los zips. */
export type DeclaradoPorSubdiario = Record<string, { compras: ComprobantePresentado[]; ventas: ComprobantePresentado[] }>

const r2 = (n: number) => Math.round(n * 100) / 100

export const ENCABEZADO_BBDD_ARCA = ["Subdiario", "Fecha", "Tipo", "Pto Vta", "Número", "CUIT", "Denominación",
  "Neto Gravado", "No Gravado", "Exentas", "Otros Tributos", "IVA", "Total", "Cuenta contable", "Nro cuenta",
  "Centro de costo", "Origen del dato", "Moneda", "Tipo de cambio", "Total en moneda original", "Sin crédito (B/C)", "Control de partes"]

const COLS: Columna[] = [
  { ancho: 9 }, { ancho: 11, z: FECHA }, { ancho: 6, z: ENTERO }, { ancho: 7, z: ENTERO }, { ancho: 11, z: ENTERO },
  { ancho: 13 }, { ancho: 36 },
  { ancho: 16, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 15, z: MONEDA }, { ancho: 14, z: MONEDA },
  { ancho: 15, z: MONEDA }, { ancho: 17, z: MONEDA },
  { ancho: 30 }, { ancho: 10 }, { ancho: 14 }, { ancho: 13 }, { ancho: 8 }, { ancho: 10, z: MONEDA }, { ancho: 16, z: MONEDA },
  { ancho: 15, z: MONEDA }, { ancho: 14, z: MONEDA },
]

/** La fecha como fecha de Excel, para que ordene y filtre como fecha. */
function fechaExcel(iso: string | null | undefined): XLSX.CellObject | string {
  if (!iso) return ""
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return iso
  return { t: "n", v: (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000, z: FECHA }
}
/** ARCA dice `PES` / `DOL`; la planilla, «$» / «USD». */
const moneda = (m: string | undefined) => (!m || m === "PES" ? "$" : m === "DOL" ? "USD" : m)

interface Renglon {
  sub: string; fecha: string | null; tipo: number | null; pv: number | null; nro: number | null; cuit: string; razon: string
  neto: number; noGrav: number; exento: number; otros: number; iva: number; total: number
  cuenta: string; nroCuenta: string; cc: string; origen: string; moneda: string; tc: number; totalOriginal: number | null
}

const deApp = (a: AsientoLibroDiario): Renglon => ({
  sub: a.subdiario, fecha: a.fecha, tipo: a.tipo, pv: a.punto_venta, nro: a.numero, cuit: a.cuit, razon: a.denominacion,
  neto: a.neto_gravado, noGrav: a.no_gravado, exento: a.exento, otros: a.otros_tributos, iva: a.iva, total: a.total,
  cuenta: a.cuenta_contable, nroCuenta: a.nro_cuenta, cc: a.centro_costo,
  origen: a.fuente === "historico" ? "Histórico" : a.fuente === "venta" ? "Ventas" : a.no_informada ? "ARCA (a mano)" : "ARCA",
  moneda: moneda(a.moneda), tc: a.tipo_cambio ?? 1,
  totalOriginal: moneda(a.moneda) === "$" ? null : a.total_moneda_original ?? null,
})

const deArca = (sub: string, p: ComprobantePresentado): Renglon => {
  const tc = p.tipoCambio || 1
  return {
    sub, fecha: p.fecha, tipo: p.tipo, pv: p.puntoVenta, nro: p.numero, cuit: p.cuit, razon: p.denominacion,
    neto: p.netoGravado ?? 0, noGrav: p.noGravado ?? 0, exento: p.exento ?? 0, otros: p.otrosTributos ?? 0, iva: p.iva ?? 0,
    total: p.total, cuenta: "", nroCuenta: "", cc: "", origen: "ARCA (libro IVA)",
    // El libro de ARCA trae los importes YA en pesos: el original es total ÷ cotización.
    moneda: moneda(p.moneda), tc, totalOriginal: moneda(p.moneda) === "$" ? null : r2(p.total / tc),
  }
}

/** Una hoja: encabezado en la fila 1, un renglón por comprobante, el TOTAL al pie. */
function hoja(renglones: Renglon[], lado: Lado): unknown[][] {
  const sinCreditoTipos = lado === "compras" ? TIPOS_SIN_CREDITO_COMPRAS : TIPOS_SIN_CREDITO_VENTAS
  const partes = (r: Renglon) => r.neto + r.noGrav + r.exento + r.otros + r.iva
  // Una B o C: lo que no está en ninguna columna es el total sin discriminar.
  const sinCredito = (r: Renglon) => (r.tipo != null && sinCreditoTipos.includes(r.tipo) ? r2(r.total - partes(r)) : 0)
  const f: unknown[][] = [ENCABEZADO_BBDD_ARCA]
  const orden = [...renglones].sort((x, y) => x.sub.localeCompare(y.sub) || String(x.fecha ?? "").localeCompare(String(y.fecha ?? ""))
    || (x.pv ?? 0) - (y.pv ?? 0) || (x.nro ?? 0) - (y.nro ?? 0))
  for (const r of orden) {
    const n = f.length + 1
    const sc = sinCredito(r)
    const dif = r2(r.total - partes(r) - sc)
    const fila: unknown[] = [r.sub, fechaExcel(r.fecha), r.tipo ?? "", r.pv ?? "", r.nro ?? "", r.cuit, r.razon,
      r2(r.neto), r2(r.noGrav), r2(r.exento), r2(r.otros), r2(r.iva), r2(r.total), r.cuenta, r.nroCuenta, r.cc, r.origen,
      r.moneda, r.moneda === "$" ? "" : r.tc, r.totalOriginal ?? "", sc,
      conFormula(`M${n}-(H${n}+I${n}+J${n}+K${n}+L${n}+U${n})`, dif)]
    // 🛑 Las partes no suman el total: el renglón en rojo, se ve sin leer la columna.
    f.push(Math.abs(dif) > TOL ? conEstilo(fila, ESTILO_ERROR) : fila)
  }
  const hasta = f.length
  const suma = (col: string, valor: number) => conFormula(`SUM(${col}2:${col}${hasta})`, r2(valor))
  const s = (k: keyof Renglon) => orden.reduce((t, r) => t + (Number(r[k]) || 0), 0)
  const mal = orden.filter(r => Math.abs(r.total - partes(r) - sinCredito(r)) > TOL).length
  const totSc = orden.reduce((t, r) => t + sinCredito(r), 0)
  f.push(conEstilo(["TOTAL", "", "", "", "", "", `${orden.length} comprobante(s)`,
    suma("H", s("neto")), suma("I", s("noGrav")), suma("J", s("exento")), suma("K", s("otros")), suma("L", s("iva")), suma("M", s("total")),
    "", "", "", "", "", "", "", conFormula(`SUM(U2:U${hasta})`, r2(totSc)),
    conFormula(`SUM(V2:V${hasta})`, r2(s("total") - s("neto") - s("noGrav") - s("exento") - s("otros") - s("iva") - totSc))], ESTILO_TOTAL))
  f.push([])
  f.push([mal ? `CONTROL: ${mal} comprobante(s) cuyas partes no suman el total (en rojo; tolerancia ${TOL} por redondeo)`
    : `CONTROL: en todos los comprobantes total − partes = 0 (tolerancia ${TOL} por redondeo)`])
  return f
}

export function armarBbddVsArca(libro: LibroDiario, declarado: DeclaradoPorSubdiario): XLSX.WorkBook {
  const arca = (lado: Lado) => Object.entries(declarado).flatMap(([sub, d]) => d[lado].map(p => deArca(sub, p)))
  const wb = XLSX.utils.book_new()
  agregarHoja(wb, "Compras BBDD ahora", hoja(libro.compras.map(deApp), "compras"), COLS)
  agregarHoja(wb, "Compras ARCA ahora", hoja(arca("compras"), "compras"), COLS)
  agregarHoja(wb, "Ventas BBDD ahora", hoja(libro.ventas.map(deApp), "ventas"), COLS)
  agregarHoja(wb, "Ventas ARCA ahora", hoja(arca("ventas"), "ventas"), COLS)
  return wb
}
