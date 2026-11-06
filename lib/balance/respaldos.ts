/**
 * 📎 A-FEAT-1571 — EL DOCUMENTO QUE RESPALDA CADA NÚMERO QUE VA AL CONTADOR (etapa 1: sin tocar la base).
 *
 * JMS 06/11: *«hay que ir viendo que cada cosa que yo mando tiene un doc de respaldo. Los saldos son los extractos donde
 * figuran. Cada cosa el contador precisará la doc respaldatoria. Que la app la genere sola sería ideal… eso me permitirá
 * también a mí auditar más fácil»*.
 *
 * Para cada renglón de un papel se dice **qué documento lo prueba** y **si la app lo tiene**:
 * - ✅ `con_link`  — la app lo tiene archivado: va el link (hoy, el PDF de una factura de compra en el Drive).
 * - 🟡 `sin_archivar` — se sabe cuál es el documento, pero la app no lo guarda todavía (extractos, resúmenes, ventas).
 * - 🔴 `falta` — no hay documento: es lo primero que hay que conseguir antes de mandar.
 *
 * Pura: recibe lo que ya leyó la pantalla. La etapa 2 (que la app archive sola los PDF en el Drive) → A-FEAT-1504.
 */
import type { AsientoLibroDiario } from "./libro-diario"
import type { SaldoParaBalance } from "@/lib/dolares/posicion-cierre"

export type EstadoRespaldo = "con_link" | "sin_archivar" | "falta"

export interface Respaldo {
  /** Qué documento es, en el idioma del contador. */
  documento: string
  estado: EstadoRespaldo
  url?: string | null
  /** Por qué está así (qué falta o dónde se consigue). */
  nota?: string
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const mesDe = (fecha: string) => `${MESES[Number(fecha.slice(5, 7)) - 1]} ${fecha.slice(0, 4)}`
const dmy = (f: string) => f.slice(0, 10).split("-").reverse().join("/")
const SIN_ARCHIVAR = "no está archivado en la app todavía"

/**
 * 🏦 El saldo al cierre de una cuenta: el extracto (o el resumen) donde figura. Si el último movimiento dice de qué resumen
 * salió (`nro_resumen`), ése; si no, el extracto del mes del cierre. Una caja no tiene extracto: su respaldo es el arqueo.
 */
export function respaldoDeSaldo(cuenta: string, fechaCierre: string, nroResumen?: string | null, sinMovimientos = false): Respaldo {
  if (sinMovimientos) return { documento: `${cuenta}: no hay movimientos cargados`, estado: "falta", nota: "falta el dato y su documento" }
  const caja = /caja/i.test(cuenta) && !/caja de ahorro/i.test(cuenta)
  if (nroResumen) return { documento: `Resumen «${nroResumen}» (último movimiento del ejercicio)`, estado: "sin_archivar", nota: SIN_ARCHIVAR }
  if (caja) return { documento: `Arqueo / planilla de ${cuenta} al ${dmy(fechaCierre)}`, estado: "sin_archivar", nota: `${SIN_ARCHIVAR}: la caja no tiene extracto` }
  return { documento: `Extracto de ${cuenta} de ${mesDe(fechaCierre)} (saldo al ${dmy(fechaCierre)})`, estado: "sin_archivar", nota: SIN_ARCHIVAR }
}

/** 💹 El FCI: el resumen del fondo del mes (sale del texto de la fuente que dejó la carga: «… (Inv_26-06.pdf) …»). */
export function respaldoDeFci(nota: string | null | undefined, punta: "inicio" | "cierre", fecha: string): Respaldo {
  const archivo = /\(([^)]+\.pdf)\)/i.exec(nota ?? "")?.[1]
  if (archivo) return { documento: `Resumen del fondo «${archivo}» (${punta})`, estado: "sin_archivar", nota: SIN_ARCHIVAR }
  if (punta === "inicio") return { documento: `Balance anterior (apertura del contador al ${dmy(fecha)}) y resumen del fondo del primer mes`, estado: "sin_archivar", nota: SIN_ARCHIVAR }
  return { documento: `Resumen del fondo de ${mesDe(fecha)}`, estado: "sin_archivar", nota: SIN_ARCHIVAR }
}

/**
 * 🧾 Un comprobante (provisión, deuda): su factura. Las compras de ARCA guardan el PDF en el Drive (el 📎 de cada factura);
 * el histórico (sistema anterior) y las ventas no tienen dónde guardarlo todavía.
 */
export function respaldoDeComprobante(a: Pick<AsientoLibroDiario, "fuente" | "tipo" | "punto_venta" | "numero" | "denominacion" | "pdf_url" | "pdf_estado">): Respaldo {
  const comp = `${a.tipo ?? ""}-${a.punto_venta ?? ""}-${a.numero ?? ""}`
  if (a.fuente === "arca") {
    if (a.pdf_url) return { documento: `Factura ${comp} de ${a.denominacion} (PDF)`, estado: "con_link", url: a.pdf_url }
    return { documento: `Factura ${comp} de ${a.denominacion}`, estado: "falta",
      nota: a.pdf_estado === "no_encontrado" ? "el PDF no se encontró (ni en el mail ni en ARCA): pedirlo al proveedor" : "el PDF todavía no se buscó: «Buscar PDF» en Facturas ARCA" }
  }
  if (a.fuente === "venta") return { documento: `Factura emitida ${comp} a ${a.denominacion}`, estado: "sin_archivar", nota: "está en ARCA (Mis Comprobantes emitidos); la app no la guarda todavía" }
  return { documento: `Factura ${comp} de ${a.denominacion} (sistema anterior)`, estado: "sin_archivar", nota: "viene del sistema anterior: el PDF no está en la app" }
}

const COLOR: Record<EstadoRespaldo, string> = { con_link: "0563C1", sin_archivar: "9C6500", falta: "C00000" }
const ICONO: Record<EstadoRespaldo, string> = { con_link: "✅", sin_archivar: "🟡", falta: "🔴" }

/** La celda «Respaldo» de un renglón: el link si lo hay; si no, el documento y qué le falta, con su color. */
export function celdaRespaldo(r: Respaldo): Record<string, unknown> {
  const texto = r.url ? `${ICONO[r.estado]} ${r.documento}` : `${ICONO[r.estado]} ${r.documento}${r.nota ? ` — ${r.nota}` : ""}`
  return { t: "s", v: texto, ...(r.url ? { l: { Target: r.url } } : {}), s: { font: { color: { rgb: COLOR[r.estado] }, ...(r.url ? { underline: true } : {}) } } }
}

export interface RenglonRespaldado { papel: string; renglon: string; importe: number | null; respaldo: Respaldo }

/**
 * 📋 La solapa «00 Respaldos»: un renglón por número enviado, con su documento — primero lo que FALTA (hay que conseguirlo),
 * después lo que existe pero no está archivado, y al final lo que ya tiene link. Arriba, cuántos hay de cada uno.
 */
export function hojaDeRespaldos(renglones: RenglonRespaldado[]): unknown[][] {
  const orden: EstadoRespaldo[] = ["falta", "sin_archivar", "con_link"]
  const cuenta = (e: EstadoRespaldo) => renglones.filter(r => r.respaldo.estado === e).length
  const f: unknown[][] = [
    ["00 — RESPALDOS: el documento que prueba cada número de los papeles (07 Bancos y provisiones)"],
    ["Para mandar con cada papel y para auditar: 🔴 falta conseguirlo · 🟡 se sabe cuál es pero la app no lo guarda todavía · ✅ archivado, con link."],
    [`🔴 falta: ${cuenta("falta")} · 🟡 sin archivar: ${cuenta("sin_archivar")} · ✅ con link: ${cuenta("con_link")} — de ${renglones.length} renglones`],
    [],
    ["Papel", "Renglón", "Importe", "Estado", "Documento que lo respalda", "Qué falta / dónde está"],
  ]
  for (const e of orden) {
    for (const r of renglones.filter(x => x.respaldo.estado === e)) {
      f.push([r.papel, r.renglon, r.importe == null ? "" : { t: "n", v: r.importe, z: "#,##0.00;(#,##0.00)" },
        { t: "s", v: `${ICONO[e]} ${e === "falta" ? "falta" : e === "sin_archivar" ? "sin archivar" : "con link"}`, s: { font: { bold: true, color: { rgb: COLOR[e] } } } },
        r.respaldo.url ? { t: "s", v: r.respaldo.documento, l: { Target: r.respaldo.url }, s: { font: { color: { rgb: "0563C1" }, underline: true } } } : r.respaldo.documento,
        r.respaldo.nota ?? ""])
    }
  }
  f.push([])
  f.push(["Etapa 2 (A-FEAT-1504): que la app archive sola en el Drive los extractos y resúmenes que hoy se cargan a mano, y estos renglones pasen a ✅ con su link."])
  return f
}

/**
 * Los renglones de «00 Respaldos» para el 07 y las provisiones: cada saldo (pesos y dólares), el FCI en sus dos puntas,
 * y cada factura de la 05 (este ejercicio y el anterior) y de la 03.1.
 */
export function renglonesDeRespaldo(d: {
  fechaCierre: string
  saldos?: SaldoParaBalance[]
  fci?: { notaInicio?: string | null; notaCierre?: string | null; cuotasInicio?: number | null; valorInicio?: number | null; cuotasCierre?: number | null; valorCierre?: number | null } | null
  fechaInicio?: string
  provision?: AsientoLibroDiario[]
  provisionAnterior?: AsientoLibroDiario[]
  provisionCobros?: AsientoLibroDiario[]
}): RenglonRespaldado[] {
  const out: RenglonRespaldado[] = []
  for (const s of d.saldos ?? []) {
    const usd = s.moneda === "USD"
    out.push({ papel: "07 Bancos", renglon: `${s.cuenta ?? s.nombre} — saldo al cierre${usd ? " (U$S)" : ""}`, importe: usd ? (s.usd ?? null) : s.saldo,
      respaldo: respaldoDeSaldo(s.cuenta ?? s.nombre, d.fechaCierre, s.nroResumen, usd ? s.usd == null : s.saldo == null) })
  }
  if (d.fci) {
    const m = (a?: number | null, b?: number | null) => (a == null || b == null ? null : Math.round(a * b * 100) / 100)
    out.push({ papel: "07 Bancos", renglon: "Fondo común — tenencia al inicio", importe: m(d.fci.cuotasInicio, d.fci.valorInicio), respaldo: respaldoDeFci(d.fci.notaInicio, "inicio", d.fechaInicio ?? "") })
    out.push({ papel: "07 Bancos", renglon: "Fondo común — tenencia al cierre", importe: m(d.fci.cuotasCierre, d.fci.valorCierre), respaldo: respaldoDeFci(d.fci.notaCierre, "cierre", d.fechaCierre) })
  }
  const comp = (papel: string, l?: AsientoLibroDiario[]) => { for (const a of l ?? []) out.push({ papel, renglon: `${a.denominacion} ${a.punto_venta ?? ""}-${a.numero ?? ""}`, importe: a.total, respaldo: respaldoDeComprobante(a) }) }
  comp("05 Provisión", d.provision)
  comp("05 Provisión (ejercicio anterior)", d.provisionAnterior)
  comp("03.1 Provisión cobros", d.provisionCobros)
  return out
}
