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
// ⚠️ cambió 02/11 — sin «Fijos Libertad» (ACA). JMS: «acá no debería ser un gasto de Libertad sino de PAM o MA respectivamente».
// ⚠️ cambió 03/11 — JMS: «Libertad es todo el gasto relacionado con ese inmueble: los impuestos, expensas, servicios de
// funcionamiento (internet, teléfonos)». Se suman LUZ y TELÉFONOS E INTERNET (Luz Libertad, Internet Libertad, Teléfono Fijo 812),
// y lo que se paga POR FACTURA con la marca LIB (Prosegur: no tiene template y no debe tenerlo — A-FEAT-1526).
const CATEG_FACTURA_LIB = "__factura_lib"
const CONCEPTOS: Record<string, string> = { "expensas": "Expensas", "agua": "Agua (AySA)", "gas": "Gas (Metrogas)", "abl": "ABL", "luz": "Luz",
  "telefonos e internet bs. as.": "Internet y teléfono", [CATEG_FACTURA_LIB]: "Pagado por factura (marca LIB: Prosegur…)" }
const SIN_PAGAR = new Set(["pendiente", "pagar", "preparado"])

const r2 = (n: number) => Math.round(n * 100) / 100
const norm = (s: string) => (s || "").trim().toLowerCase()
const resp1 = (r: string) => (r || "").split("/")[0].trim().toUpperCase()
const dmy = (f: string | null | undefined) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")

/** ¿La cuota es un gasto de Libertad? Templates de PAM o MA, en sus agrupadoras, con una de sus categorías; nunca la cochera. */
export function esDeLibertad(c: CuotaTemplate): boolean {
  if (!["PAM", "MA"].includes(resp1(c.responsable))) return false
  if (!AGRUPADORAS.has(norm(c.agrupadoraTemplate ?? ""))) return false
  if (/cochera/i.test(c.concepto) || /cochera/i.test(c.categ) || /\baca\b/i.test(c.concepto)) return false
  // Duhau es otro inmueble (JMS 03/11: «AySA de Duhau», script 199): comparte cuenta y agrupadora con Libertad pero no es de Libertad
  if (/duhau/i.test(c.concepto)) return false
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
// ⚠️ cambió 11/11: 30 → 36 por el CUADRO FINAL de las cuentas por Libertad (6 filas más)
const ALTO_BLOQUE = 36
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
  // JMS 02/11: «¿pagó MSA + pagó PAM + pagó MA = total Libertad?» — explícito, y lo que falta para llegar.
  const tres = meses.map((_, j) => r2(pagos[0][j] + pagos[1][j] + pagos[2][j]))
  const rTres = r(f.length)
  f.push(fila("Pagó MSA + PAM + MA", (_j, c) => `${c}${rPago0}+${c}${rPago0 + 1}+${c}${rPago0 + 2}`, tres))
  f.push(fila("  diferencia con el costo (= varias cuentas + sin dato del banco + sin pagar: ver el detalle)", (_j, c) => `${c}${rCosto}-${c}${rTres}`, meses.map((_, j) => r2(costo[j] - tres[j]))))
  // Contra el BANCO: lo pagado según las cuotas contra lo que respaldan sus movimientos (otra fuente).
  const conBanco = (j: number) => enMes(meses[j].clave).filter(c => c.banco?.titular)
  const segunCuotas = meses.map((_, j) => r2(conBanco(j).reduce((t, c) => t + c.monto, 0)))
  const segunBanco = meses.map((_, j) => r2(conBanco(j).reduce((t, c) => t + (c.banco?.respaldo ?? 0), 0)))
  const rBanco = r(f.length)
  f.push(fila("Pagado según los movimientos del BANCO (otra fuente)", j => String(segunBanco[j]), segunBanco))
  f.push(fila("  diferencia (pagado según cuotas − según banco; tiene que dar 0)", (_j, c) => `${c}${rTres}+${c}${rPago0 + 3}-${c}${rBanco}`, meses.map((_, j) => r2(segunCuotas[j] - segunBanco[j]))))
  const cc = meses.map((_, j) => r2(pagos[0][j] - mitad[j]))
  const rCc = r(f.length)
  f.push(fila("MSA pagó − su 50%: lo que MSA puso de más (+) o de menos (−), con los dos — se reparte abajo entre PAM y MA", (_j, c) => `${c}${rPago0}-${c}${rMsa}`, cc))
  let acum = 0
  const acumulado = cc.map(v => (acum = r2(acum + v)))
  f.push(fila("  acumulado del ejercicio", (j, c) => (j === 0 ? `${c}${rCc}` : `${u.colMes(j - 1)}${r(f.length)}+${c}${rCc}`), acumulado, "ultimo"))
  // 🔺 EL REPARTO ENTRE TRES (JMS 03/11: «por ahí MA no toma gasto en un semestre porque lo toma PAM, pero justo pagó expensas: entonces
  // en ese movimiento MA hizo un aporte, 50% a cada uno de ellos»). Lo que paga el TERCERO del mes (el que no es socio ese mes) cubre la
  // mitad de MSA y la mitad del socio: aportó a MSA su 50%, y el socio, que se ahorró esa otra mitad, queda debiéndosela al tercero.
  //   MSA ↔ socio   = MSA pagó − su 50% + la mitad de lo del tercero   (+ el socio retiró / − aportó)
  //   MSA ↔ tercero = − la mitad de lo que pagó el tercero              (el tercero aportó)
  //   la suma de las dos = MSA pagó − su 50% (el renglón de arriba): sólo cambia A QUÉ CUENTA va.
  const rPam = rPago0 + 1, rMa = rPago0 + 2
  const tercero = meses.map((m, j) => (socioDelMes(m.clave) === "PAM" ? pagos[2][j] : pagos[1][j]))
  const rTer = r(f.length)
  f.push(fila("Pagó el TERCERO del mes (MA hasta dic-25 · PAM desde ene-26)", (j, c) => (socioDelMes(meses[j].clave) === "PAM" ? `${c}${rMa}` : `${c}${rPam}`), tercero))
  // Sin redondear la mitad (puede tener medio centavo): así las dos cuentas suman exacto el neto de MSA, como las fórmulas
  const ctaCon = (quien: "PAM" | "MA") => meses.map((m, j) => (socioDelMes(m.clave) === quien ? cc[j] + tercero[j] / 2 : -tercero[j] / 2))
  const fCta = (quien: "PAM" | "MA") => (j: number, c: string) => (socioDelMes(meses[j].clave) === quien ? `${c}${rCc}+${c}${rTer}/2` : `-${c}${rTer}/2`)
  const rCtaPam = r(f.length)
  f.push(fila("CUENTA MSA ↔ PAM por Libertad — PAM retiró (+) / aportó (−)", fCta("PAM"), ctaCon("PAM")))
  f.push(fila("CUENTA MSA ↔ MA por Libertad — MA retiró (+) / aportó (−)", fCta("MA"), ctaCon("MA")))
  f.push(fila("  control: MSA↔PAM + MSA↔MA − (MSA pagó − su 50%) — tiene que dar 0", (_j, c) => `${c}${rCtaPam}+${c}${rCtaPam + 1}-${c}${rCc}`,
    meses.map((_, j) => r2(ctaCon("PAM")[j] + ctaCon("MA")[j] - cc[j]))))
  f.push(fila("ENTRE PAM Y MA (no toca a MSA): el socio le debe al tercero la mitad de lo que pagó", (_j, c) => `${c}${rTer}/2`, tercero.map(v => r2(v / 2))))
  f.push(["", "⚠️ Lo «sin dato del banco» y lo «sin pagar» no tienen pagador: hasta conciliarlos, la cuenta corriente no los cuenta."])
  const casos = cs.filter(c => c.banco?.titular && c.banco.motivo).length
  f.push(["", casos ? `⚠️ ${casos} cuota(s) pagadas por otro importe que el del banco: ver «Contra el banco» al pie.` : "✓ Lo pagado coincide con el banco, cuota por cuota."])
  f.push([])
  // 🏁 JMS 11/11 (nota en «TOTAL»: «darle un formato de final… el retiro o aporte por LIB que va entre las cuentas MSA con MA y/o PAM y entre
  // los 3… Esos números deben salir de acá de forma semestral y anual (son 3 datos) y donde ese nro se vea se le debe dejar un cartel»).
  // El CUADRO FINAL: las 3 cuentas; el 1er semestre · 2do semestre · anual salen en las columnas A-C (las pone el resumen por semestre),
  // y cada renglón lleva su CARTEL (nota de Excel) con a dónde va el número.
  f.push(["CUADRO FINAL — LO QUE ALIMENTA LAS CUENTAS POR LIBERTAD: 1er semestre · 2do semestre · anual (columnas A, B y C)"])
  f.push(encab)
  const conCartel = (row: unknown[], t: string) => { row[1] = { t: "s", v: String(row[1]), c: [{ a: "Balance", t }], s: { font: { bold: true } } }; return row }
  const rEntre = rCtaPam + 3
  f.push(conCartel(fila("MSA ↔ PAM — PAM retiró (+) / aportó (−)", (_j, c) => `${c}${rCtaPam}`, ctaCon("PAM")),
    "Sale de «Gastos Libertad», cuadro final. Alimenta la cuenta MSA ↔ PAM: 1er semestre, 2do semestre y anual (columnas A, B y C). Es el dato que se toma: viaja a «H · Retiros y aportes» (bloque «LIBERTAD → LO QUE VIAJA A LAS CUENTAS»)."))
  f.push(conCartel(fila("MSA ↔ MA — MA retiró (+) / aportó (−)", (_j, c) => `${c}${rCtaPam + 1}`, ctaCon("MA")),
    "Sale de «Gastos Libertad», cuadro final. Alimenta la cuenta MSA ↔ MA: 1er semestre, 2do semestre y anual (columnas A, B y C). Es el dato que se toma: viaja a «H · Retiros y aportes» (bloque «LIBERTAD → LO QUE VIAJA A LAS CUENTAS»)."))
  f.push(conCartel(fila("PAM ↔ MA (no toca a MSA) — el socio le debe al tercero", (_j, c) => `${c}${rEntre}`, tercero.map(v => r2(v / 2))),
    "Sale de «Gastos Libertad», cuadro final. Es la cuenta entre PAM y MA por Libertad (no pasa por MSA): 1er semestre, 2do semestre y anual (columnas A, B y C). Es el dato que se toma: viaja a «H · Retiros y aportes» (bloque «LIBERTAD → LO QUE VIAJA A LAS CUENTAS»)."))
  f.push([])
  return f
}

/** Una de las 3 cuentas del CUADRO FINAL de «Gastos Libertad»: dónde quedó (fila de Excel) y sus 3 datos. */
export interface CuentaDeLibertad { etiqueta: string; fila: number; s1: number; s2: number; anual: number }

/**
 * 🏁 JMS 11/11 (*«ese número tiene que quedar resaltado en la solapa Libertad, y ése es el número que viaja a Retiros y aportes»*): busca en
 * las filas ya armadas de «Gastos Libertad» las 3 cuentas del cuadro final, las RESALTA (1er sem · 2do sem · anual, columnas A-C) y devuelve
 * dónde quedaron, para que Retiros y aportes las tome por fórmula.
 */
export function cuentasDeLibertad(filas: unknown[][]): CuentaDeLibertad[] {
  const txt = (x: unknown) => String(x && typeof x === "object" ? (x as { v?: unknown }).v ?? "" : x ?? "")
  const i0 = filas.findIndex(r => r?.some(x => txt(x).startsWith("CUADRO FINAL —")))
  if (i0 < 0) return []
  const RES = { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "FFE699" } } }
  const out: CuentaDeLibertad[] = []
  for (let i = i0 + 1; i < filas.length && out.length < 3; i++) {
    const r = filas[i], k = r?.findIndex(x => /↔/.test(txt(x))) ?? -1
    if (!r || k < 0) continue
    const v = [0, 1, 2].map(j => { const c = r[j] as { v?: number; s?: object } | undefined; if (c && typeof c === "object") c.s = { ...(c.s ?? {}), ...RES }; return Number(c?.v ?? 0) })
    out.push({ etiqueta: txt(r[k]), fila: i + 1, s1: v[0], s2: v[1], anual: v[2] })
  }
  return out
}

/** La solapa «Gastos Libertad» del libro H. */
export function hojaLibertad(cuotas: CuotaTemplate[], etiqueta: string, meses: { clave: string; rotulo: string }[],
  extracto?: { movimientos: MovimientoExtractoH[]; destinos: Map<string, DestinoMovimiento> }): unknown[][] {
  const enEj = (f: string | null | undefined) => meses.some(m => m.clave === (f ?? "").slice(0, 7))
  // JMS 03/11 sobre las cuotas en $ 0 («es algo que no se usó en realidad, ¿verdad?»): sí — el ABL anual (se pagó por cuota) y las
  // cuotas de enero del template de MA mientras pagaba el de PAM. No son gasto ni pago: no van al cuadro.
  const deTemplates = cuotas.filter(esDeLibertad).filter(c => enEj(c.fecha) && Math.abs(c.monto) >= 0.005)
  const cs = [...deTemplates, ...pagosPorFacturaLib(deTemplates, extracto).filter(c => enEj(c.fecha))]
  const h = hojaResumenPorMes(cs.map(c => ({
    // Lo pagado por factura va con su nombre (JMS: «poner cada cosa»), no en un renglón genérico
    categoria: c.categ === CATEG_FACTURA_LIB ? `${c.concepto} (por factura)` : CONCEPTOS[norm(c.categ)], mes: (c.fecha ?? "").slice(0, 7), importe: c.monto,
    columnas: [dmy(c.fecha), c.concepto, c.responsable, quienPago(c), c.banco?.cuenta ?? "", c.banco?.comprobante ?? "", c.estado],
  })), {
    titulo: `GASTOS LIBERTAD — costo, reparto 50/50 y quién lo pagó — ejercicio ${etiqueta}`,
    notas: ["Costo de estructura de las oficinas: siempre 50% MSA y 50% el socio — PAM hasta el 31/12/2025, MA desde el 01/01/2026.",
      "Gasto = todo lo del inmueble: las cuotas de los templates de Libertad (Expensas, AySA, Metrogas, ABL, Luz, Internet y teléfono; las dos versiones, PAM y MA; sin la cochera, ACA ni Duhau) + lo pagado por factura con la marca LIB en el banco (Prosegur).",
      "Quién pagó = el titular de la cuenta con que se concilió cada cuota. Internamente MA toma el 100% (todo LIB es DIST MA)."],
    meses, encabezadoDetalle: ["Fecha", "Template", "Responsable del template", "Pagó", "Cuenta", "Comprobante", "Estado"], debeHaber: true, semestres: true,
    bloqueExtra: { alto: ALTO_BLOQUE, armar: u => bloqueReparto(cs, meses, u) },
  })
  h.push(...controlLib(cs, meses, extracto))
  const difBanco = cs.filter(c => c.banco?.titular && c.banco.motivo)
  if (difBanco.length) {
    h.push([], ["CONTRA EL BANCO — cuotas de Libertad pagadas por otro importe que el del movimiento"], ["", "Fecha", "Template", "Pagó", "Cuota", "Respalda el banco", "Por qué"])
    for (const c of difBanco) h.push(["", dmy(c.fecha), c.concepto, quienPago(c), c.monto, c.banco?.respaldo ?? "", c.banco?.motivo])
  }
  return h
}

/**
 * 🧾 Lo de Libertad que se paga POR FACTURA, no por template (Prosegur, A-FEAT-1526): los movimientos con la marca LIB que pagaron
 * una factura y no están atados a una cuota de Libertad. Entran al gasto como una cuota más, pagada por el titular de la cuenta.
 */
export function pagosPorFacturaLib(cuotasLib: CuotaTemplate[],
  extracto?: { movimientos: MovimientoExtractoH[] }): CuotaTemplate[] {
  if (!extracto) return []
  const ids = new Set(cuotasLib.flatMap(c => [c.id, c.grupoPagoId]).filter((x): x is string => !!x))
  return extracto.movimientos
    .filter(m => norm(m.contable) === "lib" && !m.enDolares && m.comprobanteArcaId && !(m.templateCuotaId && ids.has(m.templateCuotaId)))
    .map(m => {
      const monto = r2(m.debitos - m.creditos)
      // «MELI PROSEGUR 000056695740521» → «Prosegur»: el nombre del comercio, sin el canal ni el número de operación
      const nombre = m.descripcion.replace(/^(meli|mercadopago|mp)\s*\*?\s*/i, "").replace(/\s+\d{5,}.*$/, "").trim()
      const concepto = nombre ? nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase() : m.descripcion
      return { id: `factura-lib:${m.comprobanteArcaId}:${m.fecha}`, fecha: m.fecha, concepto, detalle: m.descripcion, proveedor: "", categ: CATEG_FACTURA_LIB,
        cuenta_contable: "", nro_cuenta: "", centro_costo: "", responsable: m.titular, estado: m.estado || "conciliado", monto,
        banco: { cuenta: m.cuenta, titular: m.titular, comprobante: "factura", respaldo: monto, motivo: null } } as CuotaTemplate
    })
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
  // Atado a una cuota de Libertad, o pagó una factura con la marca LIB (entró al gasto por `pagosPorFacturaLib`)
  const esDeLib = (m: MovimientoExtractoH) => (m.templateCuotaId && ids.has(m.templateCuotaId)) || (!m.templateCuotaId && !!m.comprobanteArcaId)
  const deLib = lib.filter(esDeLib)
  const otros = lib.filter(m => !esDeLib(m))
  const pagadoCuotas = r2(cs.filter(c => c.banco?.titular).reduce((t, c) => t + c.monto, 0))
  const sinMarca = extracto.movimientos.filter(m => enEj(m) && m.templateCuotaId && ids.has(m.templateCuotaId) && norm(m.contable) !== "lib")
  f.push(["", "Movimientos marcados LIB en el ejercicio", lib.length, neto(lib)])
  f.push(["", "  − atados a cuotas de Libertad o pagando una factura (Prosegur)", deLib.length, neto(deLib)])
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

/**
 * 👥 A-FEAT-1595 (JMS 11/11: «avanzá con Libertad en el 14.1»): las cuentas entre socios del libro B llevan el renglón POR LIBERTAD, tomado
 * del CUADRO FINAL de «Gastos Libertad» (el mismo número que «H · Retiros y aportes»): un asiento por semestre en la cuenta con MA y otro en la
 * de PAM. Signo de la cuenta del 14.1: + = le debemos · − = nos debe. Libertad + = el socio retiró (nos debe) → resta; − = aportó → suma.
 * La de PAM ↔ MA no es de MSA: no va al 14.1. Pura: devuelve las cuentas con los asientos agregados y el saldo recalculado.
 */
export function conLibertadEnSocios<T extends { contraparte: { clave: string }; saldoInicio: number; saldoAlCierre: number; ajusteCierre?: { importe: number; motivo: string };
  resumen: { asientos: Array<{ id: string; fecha: string; tipo: "compra" | "pago" | "venta"; concepto: string; importe: number; saldo: number; cuenta?: string; grupo?: string }>; saldo: number; totalComprado?: number; totalPagado?: number; totalVendido?: number } }>(
  socios: T[], cuentas: CuentaDeLibertad[], fechas: { corte: string; cierre: string }): T[] {
  const deQuien = (etiqueta: string) => (/^MSA ↔ PAM/.test(etiqueta) ? "PAM" : /^MSA ↔ MA/.test(etiqueta) ? "MA" : null)
  return socios.map(c => {
    const l = cuentas.find(x => deQuien(x.etiqueta) === c.contraparte.clave)
    if (!l) return c
    const nuevos = ([["1er semestre", fechas.corte, l.s1], ["2do semestre", fechas.cierre, l.s2]] as const)
      .filter(([, , v]) => Math.abs(v) >= 0.005)
      .map(([sem, fecha, v]) => ({ id: `libertad:${c.contraparte.clave}:${sem}`, fecha, tipo: (v > 0 ? "pago" : "compra") as "pago" | "compra",
        concepto: `Libertad ${sem}: ${v > 0 ? "retiró" : "aportó"} ${c.contraparte.clave} — sale de «Gastos Libertad», cuadro final (libro H)`, importe: -v, saldo: 0,
        cuenta: "Gastos Libertad (cuadro final)", grupo: "Libertad" }))
    if (!nuevos.length) return c
    const asientos = [...c.resumen.asientos.map(a => ({ ...a })), ...nuevos].sort((a, b) => a.fecha.localeCompare(b.fecha))
    let s = 0
    for (const a of asientos) { s = Math.round((s + a.importe) * 100) / 100; a.saldo = s }
    // con un saldo al cierre DECIDIDO por el usuario, el saldo no se toca: Libertad mueve el ajuste (y queda a la vista)
    const tot = (t: "compra" | "pago" | "venta") => Math.round(asientos.filter(a => a.tipo === t).reduce((x, a) => x + a.importe, 0) * 100) / 100
    const totales = { totalComprado: tot("compra"), totalPagado: Math.round(-tot("pago") * 100) / 100, totalVendido: Math.round(-tot("venta") * 100) / 100 }
    if (c.ajusteCierre) return { ...c, resumen: { ...c.resumen, ...totales, asientos, saldo: s }, ajusteCierre: { ...c.ajusteCierre, importe: Math.round((c.ajusteCierre.importe - (s - c.resumen.saldo)) * 100) / 100 } }
    return { ...c, resumen: { ...c.resumen, ...totales, asientos, saldo: s }, saldoAlCierre: Math.round((c.saldoInicio + s) * 100) / 100 }
  })
}
