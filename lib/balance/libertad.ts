/**
 * 🏢 **GASTOS LIBERTAD — el costo, el reparto 50/50 y quién lo pagó** (A-FEAT-1521, JMS 02/11).
 *
 * JMS: *«Libertad es gasto siempre 50/50 de MSA con alguien. Hasta 31/12/25 lo tomó PAM al 50 del gasto; del 1/1/26 lo tomó MA
 * al 50; siempre MSA el otro 50… de lo que sume tomará el 50% cada parte. Es así de simple… siempre el detalle debe ir por mes.
 * Para determinar lo que toma MSA este ejercicio sí o sí hay que ver todo el gasto de LIB y compararlo contra quién pagó qué
 * cosa.»* Y de KNOWLEDGE (16/10): lo que MSA pagó por encima de su 50% es un RETIRO del socio (va a su cuenta corriente);
 * internamente MA toma el 100%.
 *
 * | Pieza | De dónde sale |
 * |---|---|
 * | **El gasto** | las cuotas de los templates de Libertad — las DOS versiones (responsable PAM hasta dic-25, MA desde ene-26) — con las categorías que marcó JMS: EXPENSAS, AGUA, GAS, ABL y Fijos Libertad, en las agrupadoras «Fijos Buenos Aires MA» e «Impuestos Buenos Aires MA». **Sin** la cochera (JMS: «eso es otra cosa») |
 * | **El socio de cada mes** | PAM hasta dic-25, MA desde ene-26 — por el mes de la cuota, no por el responsable del template |
 * | **Quién pagó** | el titular de la cuenta del movimiento con que se concilió la cuota. Lo que pagó PAM queda como pagado por PAM (JMS) |
 * | **La cuenta corriente Libertad** | lo que MSA pagó − su 50%: positivo = el socio RETIRÓ de MSA; negativo = APORTÓ |
 * | **El control LIB** | todo lo marcado LIB en el banco contra lo que pagaron estas cuotas |
 *
 * Pura: recibe las cuotas del ejercicio (con su banco) y, si se leyó, el extracto.
 */
import type { CuotaTemplate } from "./templates-libro"
import type { MovimientoExtractoH, DestinoMovimiento } from "./movimientos-de-cuotas"
import { hojaResumenPorMes, type UbicacionBloque } from "./resumen-por-mes"

/** Desde este mes el socio de Libertad es MA (PAM pasó a MA el 01/01/2026). */
export const MES_CAMBIO_SOCIO = "2026-01"

const AGRUPADORAS = new Set(["fijos buenos aires ma", "impuestos buenos aires ma"])
/** Las categorías de Libertad (las de JMS 02/11) → cómo se rotulan en el cuadro. */
const CONCEPTOS: Record<string, string> = { "expensas": "Expensas", "agua": "Agua (AySA)", "gas": "Gas (Metrogas)", "abl": "ABL", "fijos libertad": "Fijos Libertad (ACA)" }
const SIN_PAGAR = new Set(["pendiente", "pagar", "preparado"])

const r2 = (n: number) => Math.round(n * 100) / 100
const norm = (s: string) => (s || "").trim().toLowerCase()
const resp1 = (r: string) => (r || "").split("/")[0].trim().toUpperCase()
const dmy = (f: string | null | undefined) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")

/** ¿La cuota es un gasto de Libertad? Templates de PAM o MA, en sus agrupadoras, con una de sus categorías; nunca la cochera. */
export function esDeLibertad(c: CuotaTemplate): boolean {
  if (!["PAM", "MA"].includes(resp1(c.responsable))) return false
  if (!AGRUPADORAS.has(norm(c.agrupadoraTemplate ?? ""))) return false
  if (/cochera/i.test(c.concepto) || /cochera/i.test(c.categ)) return false
  return norm(c.categ) in CONCEPTOS
}

/** El socio de MSA en Libertad en un mes `AAAA-MM`. */
export const socioDelMes = (mes: string) => (mes < MES_CAMBIO_SOCIO ? "PAM" : "MA")

/** Quién pagó la cuota: el titular de su cuenta; o «sin pagar»; o «sin dato del banco» (pagada sin movimiento). */
export function quienPago(c: CuotaTemplate): string {
  const t = (c.banco?.titular ?? "").trim()
  if (t) return t.includes("+") ? "varios" : t
  if (SIN_PAGAR.has(norm(c.estado))) return "sin pagar"
  return "sin dato del banco"
}

/** Las filas del bloque REPARTO + QUIÉN PAGÓ (alto fijo), con fórmulas sobre el resumen y el detalle. */
const ALTO_BLOQUE = 20
function bloqueReparto(cs: CuotaTemplate[], meses: { clave: string; rotulo: string }[], u: UbicacionBloque): unknown[][] {
  const f: unknown[][] = []
  const r = (k: number) => u.fila + k
  const enMes = (m: string) => cs.filter(c => (c.fecha ?? "").slice(0, 7) === m)
  const costo = meses.map(m => r2(enMes(m.clave).reduce((t, c) => t + c.monto, 0)))
  const pagoDe = (quien: string) => meses.map(m => r2(enMes(m.clave).filter(c => quienPago(c) === quien).reduce((t, c) => t + c.monto, 0)))
  const tot = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0))
  const n = meses.length
  const encab = ["", "", ...meses.map(m => m.rotulo), "TOTAL"]
  /** Una fila de fórmulas por mes (+ el total), con su valor ya calculado. */
  const fila = (etiqueta: string, formula: (j: number, c: string) => string, valores: number[], total: "suma" | "ultimo" = "suma", fila0 = f.length) => {
    const rr = r(fila0)
    const celdas = meses.map((_, j) => ({ t: "n", f: formula(j, u.colMes(j)), v: valores[j] }))
    const vt = total === "suma" ? tot(valores) : valores[n - 1] ?? 0
    const ft = total === "suma" ? `SUM(${u.colMes(0)}${rr}:${u.colMes(n - 1)}${rr})` : `${u.colMes(n - 1)}${rr}`
    return ["", etiqueta, ...celdas, { t: "n", f: ft, v: vt }]
  }
  const det = (quien: string) => (j: number) => {
    const crit = `${u.rng(u.colDetalle(3))},"${quien}",${u.rng("B")},"${meses[j].clave}"`
    return u.colCredito ? `SUMIFS(${u.rng(u.colDebito)},${crit})-SUMIFS(${u.rng(u.colCredito)},${crit})` : `SUMIFS(${u.rng(u.colDebito)},${crit})`
  }

  // REPARTO
  f.push(["REPARTO DEL COSTO — 50% MSA y 50% el socio (PAM hasta dic-25, MA desde ene-26)"])
  f.push(encab)
  const rCosto = r(f.length)
  f.push(fila("Costo de Libertad del mes", (_j, c) => `${c}${u.filaTotal}`, costo))
  const rMsa = r(f.length)
  const mitad = costo.map(v => r2(v / 2))
  f.push(fila("MSA toma el 50%", (_j, c) => `${c}${rCosto}/2`, mitad))
  f.push(fila("PAM toma el 50% (hasta dic-25)", (j, c) => (socioDelMes(meses[j].clave) === "PAM" ? `${c}${rCosto}/2` : "0"), meses.map((m, j) => (socioDelMes(m.clave) === "PAM" ? mitad[j] : 0))))
  f.push(fila("MA toma el 50% (desde ene-26)", (j, c) => (socioDelMes(meses[j].clave) === "MA" ? `${c}${rCosto}/2` : "0"), meses.map((m, j) => (socioDelMes(m.clave) === "MA" ? mitad[j] : 0))))
  f.push([])
  // QUIÉN PAGÓ
  f.push(["QUIÉN PAGÓ — y la cuenta corriente Libertad"])
  f.push(encab)
  const quienes = ["MSA", "PAM", "MA", "varios", "sin dato del banco", "sin pagar"]
  const rotulo: Record<string, string> = { MSA: "Pagó MSA", PAM: "Pagó PAM", MA: "Pagó MA", varios: "Pagado desde varias cuentas", "sin dato del banco": "Pagado sin dato del banco (no se sabe quién)", "sin pagar": "Sin pagar al cierre" }
  const rPago0 = r(f.length)
  const pagos = quienes.map(q => pagoDe(q))
  quienes.forEach((q, k) => f.push(fila(rotulo[q], det(q), pagos[k])))
  const rPagoN = r(f.length) - 1
  const difControl = meses.map((_, j) => r2(costo[j] - pagos.reduce((t, p) => t + p[j], 0)))
  f.push(fila("Control: costo − todo lo de arriba (tiene que dar 0)", (_j, c) => `${c}${rCosto}-SUM(${c}${rPago0}:${c}${rPagoN})`, difControl))
  const cc = meses.map((_, j) => r2(pagos[0][j] - mitad[j]))
  const rCc = r(f.length)
  f.push(fila("CUENTA CORRIENTE LIBERTAD — el socio RETIRÓ de MSA (+) / APORTÓ (−): lo que MSA pagó − su 50%", (_j, c) => `${c}${rPago0}-${c}${rMsa}`, cc))
  let acum = 0
  const acumulado = cc.map(v => (acum = r2(acum + v)))
  f.push(fila("  acumulado del ejercicio", (j, c) => (j === 0 ? `${c}${rCc}` : `${u.colMes(j - 1)}${r(f.length)}+${c}${rCc}`), acumulado, "ultimo"))
  f.push(["", "⚠️ Lo «sin dato del banco» y lo «sin pagar» no tienen pagador: hasta conciliarlos, la cuenta corriente no los cuenta."])
  f.push([])
  return f
}

/** La solapa «Gastos Libertad» del libro H. */
export function hojaLibertad(cuotas: CuotaTemplate[], etiqueta: string, meses: { clave: string; rotulo: string }[],
  extracto?: { movimientos: MovimientoExtractoH[]; destinos: Map<string, DestinoMovimiento> }): unknown[][] {
  const cs = cuotas.filter(esDeLibertad).filter(c => meses.some(m => m.clave === (c.fecha ?? "").slice(0, 7)))
  const h = hojaResumenPorMes(cs.map(c => ({
    categoria: CONCEPTOS[norm(c.categ)], mes: (c.fecha ?? "").slice(0, 7), importe: c.monto,
    columnas: [dmy(c.fecha), c.concepto, c.responsable, quienPago(c), c.banco?.cuenta ?? "", c.banco?.comprobante ?? "", c.estado],
  })), {
    titulo: `GASTOS LIBERTAD — costo, reparto 50/50 y quién lo pagó — ejercicio ${etiqueta}`,
    notas: ["Costo de estructura de las oficinas: siempre 50% MSA y 50% el socio — PAM hasta el 31/12/2025, MA desde el 01/01/2026.",
      "Gasto = las cuotas de los templates de Libertad (Expensas, AySA, Metrogas, ABL, ACA; las dos versiones, PAM y MA; sin la cochera).",
      "Quién pagó = el titular de la cuenta con que se concilió cada cuota. Internamente MA toma el 100% (todo LIB es DIST MA)."],
    meses, encabezadoDetalle: ["Fecha", "Template", "Responsable del template", "Pagó", "Cuenta", "Comprobante", "Estado"], debeHaber: true,
    bloqueExtra: { alto: ALTO_BLOQUE, armar: u => bloqueReparto(cs, meses, u) },
  })
  h.push(...controlLib(cs, meses, extracto))
  return h
}

/**
 * 🔎 El control LIB (JMS: «sí o sí hay que ver todo el gasto de LIB»): todo lo marcado LIB en el banco, en el ejercicio, contra
 * lo que pagaron las cuotas de Libertad. Lo marcado LIB que no es una cuota de Libertad, y lo que pagó Libertad sin marca LIB.
 */
function controlLib(cs: CuotaTemplate[], meses: { clave: string; rotulo: string }[],
  extracto?: { movimientos: MovimientoExtractoH[]; destinos: Map<string, DestinoMovimiento> }): unknown[][] {
  const f: unknown[][] = [[], ["CONTROL LIB — lo marcado «LIB» en el banco contra lo que pagaron las cuotas de Libertad"]]
  if (!extracto) return [...f, ["", "⚠️ No se leyó el extracto: este control no se hizo."]]
  const ids = new Set(cs.flatMap(c => [c.id, c.grupoPagoId]).filter((x): x is string => !!x))
  const enEj = (m: MovimientoExtractoH) => meses.some(x => x.clave === m.fecha.slice(0, 7))
  const lib = extracto.movimientos.filter(m => enEj(m) && norm(m.contable) === "lib" && !m.enDolares)
  const neto = (xs: MovimientoExtractoH[]) => r2(xs.reduce((t, m) => t + m.debitos - m.creditos, 0))
  const deLib = lib.filter(m => m.templateCuotaId && ids.has(m.templateCuotaId))
  const otros = lib.filter(m => !(m.templateCuotaId && ids.has(m.templateCuotaId)))
  const pagadoCuotas = r2(cs.filter(c => c.banco?.titular).reduce((t, c) => t + c.monto, 0))
  const sinMarca = extracto.movimientos.filter(m => enEj(m) && m.templateCuotaId && ids.has(m.templateCuotaId) && norm(m.contable) !== "lib")
  f.push(["", "Movimientos marcados LIB en el ejercicio", lib.length, neto(lib)])
  f.push(["", "  − atados a cuotas de Libertad", deLib.length, neto(deLib)])
  f.push(["", "  − marcados LIB pero de OTRA cosa o sin vínculo — a mirar", otros.length, neto(otros)])
  f.push(["", "Lo que pagaron las cuotas de Libertad (con banco)", "", pagadoCuotas])
  f.push(["", "  de eso, pagado con movimientos SIN la marca LIB", sinMarca.length, neto(sinMarca)])
  f.push(["", otros.length ? "⚠️ Hay movimientos LIB que no son de Libertad: ver la lista." : "✓ Todo lo marcado LIB es de Libertad."])
  const lista: unknown[][] = [
    ...otros.map(m => ["", "LIB que no es de Libertad", dmy(m.fecha), m.cuenta, m.descripcion, r2(m.debitos - m.creditos),
      m.templateCuotaId ? `atado a «${extracto.destinos.get(m.templateCuotaId)?.concepto ?? "otra cuota"}»` : "sin vínculo"]),
    ...sinMarca.map(m => ["", "Libertad sin marca LIB", dmy(m.fecha), m.cuenta, m.descripcion, r2(m.debitos - m.creditos), `contable «${m.contable || "vacío"}»`]),
  ]
  if (lista.length) f.push([], ["", "Caso", "Fecha", "Cuenta", "Descripción del banco", "Importe", "Qué es"], ...lista)
  return f
}
