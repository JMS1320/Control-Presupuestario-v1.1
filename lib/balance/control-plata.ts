/**
 * 💰 CONTROL DE LA PLATA — la solapa del libro H (A-FEAT-1533, JMS 11/11: «un cuadrito macro: saldo de inicio, ingresos en extracto
 * bancario, egresos, saldo final, plata que fue a caja, pagos por tarjeta y cheques… y el total de subdiarios y de templates»).
 * Se arma por ETAPAS, cada una con su control, y JMS la valida antes de la siguiente:
 *   1 · LA PLATA (esta): cuenta por cuenta, saldo de inicio + ingresos − egresos = saldo final, contra el saldo de la planilla del extracto.
 *   2 · ADÓNDE FUE cada movimiento (ventas cobradas, compras pagadas, templates, sueldos, socios, caja, tarjeta, cheques, financieros, sin
 *       vincular): sumados tienen que dar la etapa 1.
 *   3 · LO REGISTRADO (subdiarios + templates) y el puente con deudas y créditos al inicio y al cierre.
 *   4 · LO QUE NO CIERRA: diferencias conocidas (A-FEAT-1592) y sin explicar.
 * SÓLO LEE la base.
 */
import { TABLAS_CON_VINCULO_ARCA } from "../conciliacion/tablas-con-vinculo-arca"
import type { ClienteMinimo } from "./fechas-de-pago"
import { TITULO_TABLA, ENCABEZADO_TABLA, TOTAL_TEXTO } from "./auditoria-templates"

const r2 = (n: number) => Math.round(n * 100) / 100
const MONEDA = "#,##0.00;[Red]-#,##0.00;\"-\""
const dmy = (f: string) => f.slice(0, 10).split("-").reverse().join("/")

export interface MovimientoConSaldo { fecha: string; orden: number; descripcion: string; debitos: number; creditos: number; saldo: number | null }
export interface CuentaConSaldos { cuenta: string; enDolares: boolean; movimientos: MovimientoConSaldo[] }

/** Un salto del saldo de la planilla: el saldo de un renglón no es el anterior + crédito − débito. */
export interface SaltoDeSaldo { fecha: string; orden: number; descripcion: string; salto: number }

export interface ResumenDeCuenta {
  cuenta: string; enDolares: boolean
  /** Movimientos del ejercicio. */
  n: number
  inicio: number; inicioDeDonde: string
  ing1: number; egr1: number; ing2: number; egr2: number
  /** El saldo que dice la planilla al corte del semestre y al cierre (null si la planilla no trae saldo). */
  extractoMedio: number | null; extractoFin: number | null
  saltos: SaltoDeSaldo[]
  /** Cómo se ordenó para seguir el saldo: «fecha» (fecha y orden de carga) u «orden» (sólo el orden de la planilla). */
  ordenadoPor: "fecha" | "orden"
}

/**
 * Pura. Lo de una cuenta en el ejercicio: saldo de inicio, ingresos y egresos por semestre, el saldo de la planilla al 31/12 y al cierre,
 * y DÓNDE SE ROMPE el saldo de la planilla. El saldo se sigue en el orden que menos saltos da (la caja de Sigot se carga fuera de fecha:
 * por fecha da 16 saltos, por su orden da 1).
 */
export function resumirCuenta(c: CuentaConSaldos, desde: string, corte: string, hasta: string): ResumenDeCuenta {
  const porFecha = [...c.movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden)
  const porOrden = [...c.movimientos].sort((a, b) => a.orden - b.orden || a.fecha.localeCompare(b.fecha))
  const saltosDe = (ms: MovimientoConSaldo[]): SaltoDeSaldo[] => {
    const out: SaltoDeSaldo[] = []
    let ant: number | null = null
    for (const m of ms) {
      if (m.saldo == null) continue
      if (ant != null) { const s = r2(ant + m.creditos - m.debitos - m.saldo); if (Math.abs(s) >= 0.01 && m.fecha >= desde && m.fecha <= hasta) out.push({ fecha: m.fecha, orden: m.orden, descripcion: m.descripcion, salto: s }) }
      ant = m.saldo
    }
    return out
  }
  const sF = saltosDe(porFecha), sO = saltosDe(porOrden)
  const ordenadoPor = sO.length < sF.length ? "orden" : "fecha"
  const ms = ordenadoPor === "orden" ? porOrden : porFecha
  const conSaldo = ms.filter(m => m.saldo != null)
  const del = ms.filter(m => m.fecha >= desde && m.fecha <= hasta)
  const suma = (xs: MovimientoConSaldo[], k: "creditos" | "debitos") => r2(xs.reduce((t, m) => t + m[k], 0))
  const s1 = del.filter(m => m.fecha <= corte), s2 = del.filter(m => m.fecha > corte)
  // saldo de inicio: el último saldo antes del ejercicio; si no hay, el del primer movimiento del ejercicio menos su efecto
  const antes = conSaldo.filter(m => m.fecha < desde)
  const primero = conSaldo.find(m => m.fecha >= desde && m.fecha <= hasta)
  let inicio = 0, inicioDeDonde = "sin movimientos con saldo: arranca en 0"
  if (antes.length) { const u = antes[antes.length - 1]; inicio = u.saldo!; inicioDeDonde = `saldo de la planilla al ${dmy(u.fecha)}` }
  else if (primero) { inicio = r2(primero.saldo! - primero.creditos + primero.debitos); inicioDeDonde = primero.fecha > corte
    ? `la planilla arranca el ${dmy(primero.fecha)} con este saldo ya en la cuenta (no hay movimientos antes)`
    : `saldo del primer movimiento (${dmy(primero.fecha)}) menos ese movimiento` }
  else if (del.length) inicioDeDonde = "la planilla no trae saldo: arranca en 0"
  const ultimoHasta = (f: string) => { const xs = conSaldo.filter(m => m.fecha <= f); return xs.length ? xs[xs.length - 1].saldo! : null }
  const traeSaldo = del.some(m => m.saldo != null)
  return {
    cuenta: c.cuenta, enDolares: c.enDolares, n: del.length, inicio: r2(inicio), inicioDeDonde,
    ing1: suma(s1, "creditos"), egr1: suma(s1, "debitos"), ing2: suma(s2, "creditos"), egr2: suma(s2, "debitos"),
    extractoMedio: traeSaldo ? ultimoHasta(corte) : null, extractoFin: traeSaldo ? ultimoHasta(hasta) : null,
    saltos: ordenadoPor === "orden" ? sO : sF, ordenadoPor,
  }
}

/** Las cuentas de PLATA de un titular (bancos, cajas, cartera de echeqs). La tarjeta no: es deuda, va en la etapa 2. */
export async function leerCuentasConSaldo(cliente: ClienteMinimo, titular: string, hasta: string): Promise<{ cuentas: CuentaConSaldos[]; tablasQueFallaron: string[] }> {
  const cuentas: CuentaConSaldos[] = [], tablasQueFallaron: string[] = []
  for (const t of TABLAS_CON_VINCULO_ARCA.filter(x => x.titular === titular && !/tarjeta/i.test(x.tabla))) {
    const movimientos: MovimientoConSaldo[] = []
    let fallo = false
    for (let d = 0; ; d += 1000) {
      const q = t.schema === "public" ? cliente.from(t.tabla) : cliente.schema(t.schema).from(t.tabla)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (q.select("fecha, orden, descripcion, debitos, creditos, saldo, estado") as any).lte("fecha", hasta).order("id").range(d, d + 999)
      if (error) { fallo = true; break }
      for (const m of (data ?? []) as Array<Record<string, unknown>>) {
        if (String(m.estado ?? "").toLowerCase() === "total") continue
        movimientos.push({ fecha: String(m.fecha ?? "").slice(0, 10), orden: Number(m.orden) || 0, descripcion: String(m.descripcion ?? ""),
          debitos: Number(m.debitos) || 0, creditos: Number(m.creditos) || 0, saldo: m.saldo == null ? null : Number(m.saldo) })
      }
      if (!data || data.length < 1000) break
    }
    if (fallo) tablasQueFallaron.push(t.cuenta ?? t.tabla)
    else cuentas.push({ cuenta: t.cuenta ?? t.tabla, enDolares: !!t.enDolares, movimientos })
  }
  return { cuentas, tablasQueFallaron }
}

/** Pura. La solapa «Control de la plata» (etapa 1). */
export function hojaControlPlata(rs: ResumenDeCuenta[], titular: string, etiqueta: string, fechas: { desde: string; corte: string; hasta: string },
  tablasQueFallaron: string[] = [], etapa2?: { e: Etapa2; hojaDetalle: string }, etapa3?: FilaEtapa3[],
  etapa4?: { compras: ReturnType<typeof puenteDeComprobantes>; ventas: ReturnType<typeof puenteDeComprobantes>;
    otros?: Array<{ titulo: string; nroE: string; codD: CodigoDestino; lado: "F" | "G" | "neto"; que: string; p: ReturnType<typeof puenteDeComprobantes> }>; extra?: unknown[][] }): unknown[][] {
  const h: unknown[][] = []
  const num = (v: number) => ({ t: "n", v: r2(v), z: MONEDA })
  const f = (formula: string, v: number) => ({ t: "n", f: formula, v: r2(v), z: MONEDA })
  const ini = dmy(new Date(Date.parse(fechas.desde) - 86_400_000).toISOString()), cor = dmy(fechas.corte), fin = dmy(fechas.hasta)
  h.push([{ t: "s", v: `⬅ Índice  ·  CONTROL DE LA PLATA — ${titular} — ejercicio ${etiqueta}`, l: { Target: "#'Índice'!A1" } }])
  h.push(["Se arma por etapas, cada una con su control. ETAPA 1 (ésta): LA PLATA — en cada cuenta, saldo de inicio + ingresos − egresos = saldo final, contra el saldo que dice la planilla del extracto."])
  h.push(["Próximas: 2 · adónde fue cada movimiento (tienen que sumar lo de acá) · 3 · lo registrado (subdiarios y templates) y el puente de deudas y créditos · 4 · lo que no cierra (conocido y sin explicar)."])
  h.push([])
  const ENC = ["Cuenta", `Saldo al ${ini}`, "+ Ingresos 1er sem", "− Egresos 1er sem", `= Saldo al ${cor}`, `Planilla al ${cor}`, "Diferencia",
    "+ Ingresos 2do sem", "− Egresos 2do sem", `= Saldo al ${fin}`, `Planilla al ${fin}`, "Diferencia", "Control", "Movimientos", "De dónde sale el saldo de inicio"]
  const bloque = (titulo: string, xs: ResumenDeCuenta[]): number => {
    h.push([TITULO_TABLA(titulo)])
    h.push(ENC.map(ENCABEZADO_TABLA))
    const d0 = h.length + 1
    for (const r of xs) {
      const n = h.length + 1
      const calcMedio = r2(r.inicio + r.ing1 - r.egr1), calcFin = r2(calcMedio + r.ing2 - r.egr2)
      const sinSaldo = r.extractoFin == null
      const sinMedio = sinSaldo || r.extractoMedio == null
      const difM = sinMedio ? 0 : r2(r.extractoMedio! - calcMedio), difF = sinSaldo ? 0 : r2(r.extractoFin! - calcFin)
      const veredicto = !r.n ? "sin movimientos en el ejercicio" : sinSaldo ? "la planilla no trae saldo: sólo la cuenta"
        : Math.abs(difM) < 0.01 && Math.abs(difF) < 0.01 ? "✓ cierra al peso" : `⚠️ no da: ${r.saltos.length} salto(s) del saldo de la planilla (ver abajo)`
      h.push([r.cuenta, num(r.inicio), num(r.ing1), num(r.egr1), f(`B${n}+C${n}-D${n}`, calcMedio),
        sinMedio ? "—" : num(r.extractoMedio!), sinMedio ? "" : f(`F${n}-E${n}`, difM),
        num(r.ing2), num(r.egr2), f(`E${n}+H${n}-I${n}`, calcFin),
        sinSaldo ? "—" : num(r.extractoFin!), sinSaldo ? "" : f(`K${n}-J${n}`, difF),
        sinSaldo || !r.n ? veredicto : { t: "s", f: `IF(AND(${sinMedio ? "TRUE" : `ABS(G${n})<0.01`},ABS(L${n})<0.01),"✓ cierra al peso","⚠️ no da: ${r.saltos.length} salto(s) del saldo de la planilla (ver abajo)")`, v: veredicto },
        { t: "n", v: r.n, z: "0" }, r.inicioDeDonde])
    }
    const dN = h.length, n = h.length + 1
    const S = (c: string) => `SUM(${c}${d0}:${c}${dN})`, sum = (k: (r: ResumenDeCuenta) => number) => r2(xs.reduce((t, r) => t + k(r), 0))
    const medio = (r: ResumenDeCuenta) => r2(r.inicio + r.ing1 - r.egr1), fn = (r: ResumenDeCuenta) => r2(medio(r) + r.ing2 - r.egr2)
    h.push([TOTAL_TEXTO("TOTAL"), f(S("B"), sum(r => r.inicio)), f(S("C"), sum(r => r.ing1)), f(S("D"), sum(r => r.egr1)), f(`B${n}+C${n}-D${n}`, sum(medio)), "", "",
      f(S("H"), sum(r => r.ing2)), f(S("I"), sum(r => r.egr2)), f(`E${n}+H${n}-I${n}`, sum(fn)), "", "", "", { t: "n", f: S("N"), v: sum(r => r.n), z: "0" }])
    h.push([])
    return n
  }
  const pesos = rs.filter(r => !r.enDolares), usd = rs.filter(r => r.enDolares)
  const totPesos = bloque("EN PESOS", pesos)
  const totUsd = usd.length ? bloque("EN DÓLARES (US$) — no se suman a los pesos", usd) : null
  if (tablasQueFallaron.length) h.push([`⚠️ No se pudieron leer: ${tablasQueFallaron.join(", ")} — el cuadro está incompleto.`], [])
  // dónde se rompe el saldo de la planilla
  const saltos = rs.flatMap(r => r.saltos.map(s => ({ ...s, cuenta: r.cuenta, ordenadoPor: r.ordenadoPor })))
  h.push([TITULO_TABLA("DÓNDE SE ROMPE EL SALDO DE LA PLANILLA — el saldo de ese renglón no es el anterior + crédito − débito")])
  if (!saltos.length) h.push(["✓ Ninguno: en todas las cuentas cada saldo sigue al anterior."])
  else {
    h.push(["Cuenta", "Fecha", "Orden en la planilla", "Descripción", "Salto: lo que la planilla suma (+) o resta (−) sin movimiento"].map(ENCABEZADO_TABLA))
    for (const s of saltos) h.push([s.cuenta, dmy(s.fecha), { t: "n", v: s.orden, z: "0" }, s.descripcion, num(-s.salto)])
    const porOrden = [...new Set(saltos.filter(s => s.ordenadoPor === "orden").map(s => s.cuenta))]
    if (porOrden.length) h.push([`ⓘ ${porOrden.join(", ")}: la planilla está cargada fuera de fecha, así que el saldo se sigue por su ORDEN (por fecha daría saltos que no son errores).`])
  }
  h.push([])
  h.push(["ⓘ La tarjeta no está acá porque no es plata, es deuda: su pago sale del banco y se ve en la etapa 2 («adónde fue cada movimiento»)."])
  if (etapa2) {
    h.push([], [], [TITULO_TABLA("ETAPA 2 — ADÓNDE FUE CADA MOVIMIENTO de estas cuentas: cada uno en un solo destino, sólo por lo que ya tiene cargado. Sumados tienen que dar la etapa 1.")])
    h.push([`El detalle, movimiento por movimiento con su ficha, en «${etapa2.hojaDetalle}» (filtrá por Nro). Los destinos D11 (entre cuentas propias) no son gasto: la plata sigue en la empresa.`], [])
    const filasDe = new Map<string, number>()
    h.push(...bloqueEtapa2(etapa2.e.pesos, "EN PESOS", h.length + 1, totPesos, etapa2.hojaDetalle, filasDe))
    if (etapa2.e.dolares.size) h.push(...bloqueEtapa2(etapa2.e.dolares, "EN DÓLARES (US$)", h.length + 1, totUsd, etapa2.hojaDetalle))
    h.push(...bloqueDosPuntas(etapa2.e, h.length + 1))
    const filasE = new Map<string, number>()
    if (etapa3?.length) h.push(...bloqueEtapa3(etapa3, filasDe, h.length + 1, etapa2.e.pesos, filasE))
    if (etapa4) {
      h.push([], [TITULO_TABLA("ETAPA 4 — QUÉ EXPLICA LA DIFERENCIA. Por dónde se pagó o cobró cada comprobante del ejercicio (primero compras y ventas, que son las grandes).")], [])
      const ok = (a: number, b: number) => Math.abs(a - b) < 0.01
      const reg = (nro: string) => etapa3?.find(x => x.nro === nro)?.registrado ?? 0
      const banco = (cod: CodigoDestino, lado: "ing" | "egr") => { const y = etapa2.e.pesos.get(cod); return y ? (lado === "ing" ? y.ing1 + y.ing2 : y.egr1 + y.egr2) : 0 }
      h.push(...bloquePuente("E2 · COMPRAS: por dónde se pagó cada factura del ejercicio", etapa4.compras, h.length + 1, filasE.get("E2") ?? null, filasDe.get("D1") ?? null, "G",
        { libro: ok(etapa4.compras.totalLibro, reg("E2")), banco: ok(etapa4.compras.enBanco, banco("D1", "egr")) }))
      h.push(...bloquePuente("E1 · VENTAS: por dónde se cobró cada factura del ejercicio", etapa4.ventas, h.length + 1, filasE.get("E1") ?? null, filasDe.get("D2") ?? null, "F",
        { libro: ok(etapa4.ventas.totalLibro, reg("E1")), banco: ok(etapa4.ventas.enBanco, banco("D2", "ing")) }))
      for (const o of etapa4.otros ?? []) {
        const y = etapa2.e.pesos.get(o.codD), vD = y ? (o.lado === "F" ? y.ing1 + y.ing2 : o.lado === "G" ? y.egr1 + y.egr2 : y.egr1 + y.egr2 - y.ing1 - y.ing2) : 0
        // el neto (egresos − ingresos) se compara contra la etapa 3, que ya lo tiene en su columna C
        const filaD = o.lado === "neto" ? null : filasDe.get(o.codD) ?? null
        h.push(...bloquePuente(o.titulo, o.p, h.length + 1, filasE.get(o.nroE) ?? null, filaD, o.lado === "neto" ? "G" : o.lado,
          { libro: ok(o.p.totalLibro, reg(o.nroE)), banco: ok(o.p.enBanco, vD), que: o.que }))
      }
      if (etapa4.extra?.length) h.push(...etapa4.extra)
      h.push(["ⓘ La lista de los comprobantes de E2.5 / E2.6 y E1.5 / E1.6, con su ficha y su situación, en «Plata · facturas»."])
    }
  }
  return h
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// ETAPA 2 — ADÓNDE FUE CADA MOVIMIENTO (JMS 11/11: «podés avanzar con la etapa 2»)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Los destinos, en el orden del cuadro. El código (D1…) es el Nro para filtrar el detalle. */
export const DESTINOS = [
  ["D1", "Pago a proveedores (factura de compra)", "el movimiento tiene una factura de compra atada"],
  ["D2", "Cobro de clientes (venta)", "el movimiento tiene una venta atada"],
  ["D3", "Gastos por template", "atado a una cuota de un template de GASTO"],
  ["D4", "Ingresos por template", "atado a una cuota de un template de INGRESO"],
  ["D5", "Sueldos", "atado a un pago de sueldo"],
  ["D6", "Anticipos", "atado a un anticipo"],
  ["D7", "Socios: retiros y aportes (templates de distribución)", "atado a una cuota de un template de DISTRIBUCIÓN"],
  ["D8", "Pago de la tarjeta", "atado a una cuota de un template de la agrupadora «Tarjetas»"],
  ["D9", "Inversiones: FCI, plazo fijo, compra y venta de dólares", "atado a una cuota de la agrupadora «Inversiones»"],
  ["D10", "Créditos bancarios", "atado a una cuota de la agrupadora «Créditos Bancarios»"],
  ["D11", "Entre cuentas propias y extracciones a caja", "atado a una cuota de «Movimientos Internos empresa» (no sale plata de la empresa)"],
  ["D12", "Otros financieros", "atado a una cuota de otro template FINANCIERO"],
  ["D13", "Atado a una cuota de otro ejercicio o desactivada", "la cuota no está entre las del libro"],
  ["D14", "Con categoría, sin vínculo", "tiene categoría pero ninguna cuota, factura, sueldo, venta ni anticipo"],
  ["D15", "Sin vincular", "ni categoría ni vínculo (el histórico jul-25 → ene-26 y lo que falte)"],
] as const
export type CodigoDestino = (typeof DESTINOS)[number][0]

export interface MovimientoParaDestino {
  cuenta: string; titular: string; fecha: string; descripcion: string; categ: string; contable: string; estado: string
  debitos: number; creditos: number; enDolares: boolean
  templateCuotaId: string | null; comprobanteArcaId: string | null; otroTipo?: "sueldo" | "venta" | "anticipo" | null; comprobanteVentaId?: string | null
}
export interface DestinoDeCuota { responsable: string; agrupadora: string; concepto: string; tipo?: string }

/** Pura. El destino de UN movimiento, sólo por lo que ya tiene cargado (no se adivina). */
export function destinoDeMovimiento(m: MovimientoParaDestino, destinos: Map<string, DestinoDeCuota>): { codigo: CodigoDestino; atadoA: string; concepto?: string } {
  if (m.comprobanteArcaId) return { codigo: "D1", atadoA: "factura de compra" }
  if (m.otroTipo === "venta") return { codigo: "D2", atadoA: "venta" }
  if (m.otroTipo === "sueldo") return { codigo: "D5", atadoA: "sueldo" }
  if (m.otroTipo === "anticipo") return { codigo: "D6", atadoA: "anticipo" }
  if (m.templateCuotaId) {
    const d = destinos.get(m.templateCuotaId)
    if (!d) return { codigo: "D13", atadoA: "cuota fuera del libro" }
    const que = `${d.concepto} (${d.responsable}${d.agrupadora ? ` · ${d.agrupadora}` : ""})`
    const con = (codigo: CodigoDestino) => ({ codigo, atadoA: que, concepto: d.concepto })
    const ag = d.agrupadora.toLowerCase(), tipo = (d.tipo ?? "").toLowerCase()
    if (tipo === "distribucion") return con("D7")
    if (/tarjeta/.test(ag)) return con("D8")
    if (/inversi/.test(ag)) return con("D9")
    if (/cr[eé]dito/.test(ag)) return con("D10")
    if (/movimientos internos/.test(ag)) return con("D11")
    if (tipo === "financiero") return con("D12")
    if (tipo === "ingreso") return con("D4")
    return con("D3")
  }
  if (m.categ.trim()) return { codigo: "D14", atadoA: `categoría «${m.categ}»` }
  return { codigo: "D15", atadoA: "" }
}

export interface Etapa2 {
  /** Por moneda: código → ingresos y egresos por semestre y cantidad. */
  pesos: Map<CodigoDestino, { ing1: number; egr1: number; ing2: number; egr2: number; n: number }>
  dolares: Map<CodigoDestino, { ing1: number; egr1: number; ing2: number; egr2: number; n: number }>
  detalle: Array<MovimientoParaDestino & { codigo: CodigoDestino; atadoA: string; concepto?: string; ficha: string }>
}

/** Pura. Arma la etapa 2 con los movimientos de las cuentas de PLATA del titular (las de la etapa 1: la tarjeta no). */
export function armarEtapa2(movs: MovimientoParaDestino[], titular: string, cuentasDePlata: Set<string>, destinos: Map<string, DestinoDeCuota>,
  fechas: { desde: string; corte: string; hasta: string }, fichaDe: (m: MovimientoParaDestino) => string = () => ""): Etapa2 {
  const vacio = () => new Map<CodigoDestino, { ing1: number; egr1: number; ing2: number; egr2: number; n: number }>()
  const out: Etapa2 = { pesos: vacio(), dolares: vacio(), detalle: [] }
  for (const m of movs) {
    if (m.titular !== titular || !cuentasDePlata.has(m.cuenta) || m.fecha < fechas.desde || m.fecha > fechas.hasta) continue
    if (m.estado.toLowerCase() === "total" || (Math.abs(m.debitos) < 0.005 && Math.abs(m.creditos) < 0.005)) continue
    const { codigo, atadoA, concepto } = destinoDeMovimiento(m, destinos)
    const t = m.enDolares ? out.dolares : out.pesos
    const x = t.get(codigo) ?? { ing1: 0, egr1: 0, ing2: 0, egr2: 0, n: 0 }
    if (m.fecha <= fechas.corte) { x.ing1 = r2(x.ing1 + m.creditos); x.egr1 = r2(x.egr1 + m.debitos) } else { x.ing2 = r2(x.ing2 + m.creditos); x.egr2 = r2(x.egr2 + m.debitos) }
    x.n++
    t.set(codigo, x)
    out.detalle.push({ ...m, codigo, atadoA, concepto, ficha: fichaDe(m) })
  }
  out.detalle.sort((a, b) => Number(a.codigo.slice(1)) - Number(b.codigo.slice(1)) || a.cuenta.localeCompare(b.cuenta) || a.fecha.localeCompare(b.fecha))
  return out
}

/**
 * El bloque de la etapa 2 en la solapa «Control de la plata»: por destino, ingresos y egresos por semestre, y el CONTROL contra la etapa 1
 * (los totales del bloque de la plata de arriba, por fórmula). `filaTotalE1` es la fila del TOTAL de la etapa 1 de esa moneda.
 */
export function bloqueEtapa2(t: Etapa2["pesos"], titulo: string, filaInicial: number, filaTotalE1: number | null, hojaDetalle: string, filasDe?: Map<string, number>): unknown[][] {
  const h: unknown[][] = []
  const f = (formula: string, v: number) => ({ t: "n", f: formula, v: r2(v), z: MONEDA })
  const num = (v: number) => ({ t: "n", v: r2(v), z: MONEDA })
  const r = () => filaInicial + h.length
  h.push([TITULO_TABLA(titulo)])
  h.push(["Destino (Nro para filtrar el detalle)", "+ Ingresos 1er sem", "− Egresos 1er sem", "+ Ingresos 2do sem", "− Egresos 2do sem", "+ Ingresos del ejercicio", "− Egresos del ejercicio", "Movimientos", "Cómo se sabe"].map(ENCABEZADO_TABLA))
  const d0 = r()
  for (const [cod, nombre, como] of DESTINOS) {
    const x = t.get(cod); if (!x) continue
    const n = r()
    filasDe?.set(cod, n)
    h.push([{ t: "s", v: `${cod} · ${nombre}`, l: { Target: `#'${hojaDetalle}'!A1`, Tooltip: `Filtrá «Nro» = ${cod} en «${hojaDetalle}»` } },
      num(x.ing1), num(x.egr1), num(x.ing2), num(x.egr2), f(`B${n}+D${n}`, x.ing1 + x.ing2), f(`C${n}+E${n}`, x.egr1 + x.egr2), { t: "n", v: x.n, z: "0" }, como])
  }
  const dN = r() - 1, nT = r()
  const S = (c: string) => `SUM(${c}${d0}:${c}${dN})`
  const sum = (k: "ing1" | "egr1" | "ing2" | "egr2") => r2([...t.values()].reduce((a, x) => a + x[k], 0))
  h.push([TOTAL_TEXTO("TOTAL"), f(S("B"), sum("ing1")), f(S("C"), sum("egr1")), f(S("D"), sum("ing2")), f(S("E"), sum("egr2")), f(S("F"), sum("ing1") + sum("ing2")), f(S("G"), sum("egr1") + sum("egr2")), { t: "n", f: S("H"), v: [...t.values()].reduce((a, x) => a + x.n, 0), z: "0" }])
  if (filaTotalE1) {
    // etapa 1: C = ingresos 1er sem · D = egresos 1er sem · H = ingresos 2do sem · I = egresos 2do sem
    const nC = r()
    h.push(["Control: etapa 2 − etapa 1 (tiene que dar 0)", f(`B${nT}-C${filaTotalE1}`, 0), f(`C${nT}-D${filaTotalE1}`, 0), f(`D${nT}-H${filaTotalE1}`, 0), f(`E${nT}-I${filaTotalE1}`, 0), "", "", "",
      { t: "s", f: `IF(AND(ABS(B${nC})<0.01,ABS(C${nC})<0.01,ABS(D${nC})<0.01,ABS(E${nC})<0.01),"✓ cada movimiento está en un solo destino y suman lo de la etapa 1","⚠️ no da con la etapa 1")`, v: "✓ cada movimiento está en un solo destino y suman lo de la etapa 1" }])
  }
  h.push([])
  return h
}

/** La solapa del DETALLE de la etapa 2: cada movimiento con su destino y su ficha, para filtrar por Nro. */
export function hojaDetalleEtapa2(e: Etapa2, titular: string, etiqueta: string): unknown[][] {
  const h: unknown[][] = [[{ t: "s", v: `⬅ Control de la plata  ·  ADÓNDE FUE CADA MOVIMIENTO — detalle — ${titular} — ejercicio ${etiqueta}`, l: { Target: "#'Control de la plata'!A1" } }],
    ["Cada movimiento de las cuentas de plata en un solo destino (Nro D1…D15 del cuadro). Filtrá por «Nro» para ver qué forma cada línea."], []]
  h.push(["Nro", "Destino", "Cuenta", "Fecha", "Descripción del banco", "Débito", "Crédito", "Moneda", "Atado a", "Ficha (proveedor / cliente / comprobante)", "Categoría", "Código contable", "Estado"].map(ENCABEZADO_TABLA))
  const nombre = new Map(DESTINOS.map(([c, n]) => [c, n]))
  for (const m of e.detalle) h.push([m.codigo, nombre.get(m.codigo) ?? "", m.cuenta, dmy(m.fecha), m.descripcion,
    m.debitos ? { t: "n", v: r2(m.debitos), z: MONEDA } : "", m.creditos ? { t: "n", v: r2(m.creditos), z: MONEDA } : "", m.enDolares ? "US$" : "$", m.atadoA, m.ficha, m.categ, m.contable, m.estado])
  return h
}

/**
 * 🔁 Las DOS PUNTAS de lo que se movió entre cuentas propias (D11): por concepto, lo que SALIÓ de una cuenta y lo que ENTRÓ a otra. Tiene
 * que dar lo mismo; lo que va a la Caja General (las extracciones) no tiene la otra punta porque la caja general no tiene planilla.
 */
export function bloqueDosPuntas(e: Etapa2, filaInicial: number): unknown[][] {
  const xs = e.detalle.filter(m => m.codigo === "D11" && !m.enDolares)
  if (!xs.length) return []
  const h: unknown[][] = []
  const num = (v: number) => ({ t: "n", v: r2(v), z: MONEDA })
  const r = () => filaInicial + h.length
  const porConcepto = new Map<string, { sale: Map<string, number>; entra: Map<string, number> }>()
  for (const m of xs) {
    const k = m.concepto ?? m.atadoA
    const x = porConcepto.get(k) ?? { sale: new Map(), entra: new Map() }
    if (m.debitos) x.sale.set(m.cuenta, r2((x.sale.get(m.cuenta) ?? 0) + m.debitos))
    if (m.creditos) x.entra.set(m.cuenta, r2((x.entra.get(m.cuenta) ?? 0) + m.creditos))
    porConcepto.set(k, x)
  }
  const lista = (mp: Map<string, number>) => [...mp].map(([c, v]) => `${c} ${v.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`).join(" · ")
  const suma = (mp: Map<string, number>) => r2([...mp.values()].reduce((a, b) => a + b, 0))
  h.push([TITULO_TABLA("LAS DOS PUNTAS de lo que se movió entre cuentas propias (D11): lo que salió de una cuenta tiene que entrar a otra")])
  h.push(["Concepto (template)", "Salió", "Entró", "Diferencia", "", "", "", "", "", "", "", "", "Control", "", "De qué cuenta salió · a cuál entró"].map(x => x ? ENCABEZADO_TABLA(x) : x))
  for (const [k, x] of [...porConcepto].sort((a, b) => suma(b[1].sale) - suma(a[1].sale))) {
    const n = r(), sale = suma(x.sale), entra = suma(x.entra)
    const caja = /^caja$/i.test(k.trim())
    const veredicto = caja ? "va a la CAJA GENERAL: no tiene planilla, no hay otra punta (A-DAT-101)" : Math.abs(sale - entra) < 0.01 ? "✓ las dos puntas coinciden" : "⚠️ una punta no está (o es de otro concepto)"
    h.push([k, num(sale), num(entra), { t: "n", f: `B${n}-C${n}`, v: r2(sale - entra), z: MONEDA }, "", "", "", "", "", "", "", "",
      caja ? veredicto : { t: "s", f: `IF(ABS(D${n})<0.01,"✓ las dos puntas coinciden","⚠️ una punta no está (o es de otro concepto)")`, v: veredicto },
      "", `salió: ${lista(x.sale) || "—"} ‖ entró: ${lista(x.entra) || "—"}`])
  }
  h.push([])
  return h
}

/** Un renglón de la etapa 3: lo REGISTRADO (subdiario, templates, sueldos) contra lo que movió el banco según la etapa 2. */
export interface FilaEtapa3 {
  nro: string
  concepto: string
  registrado: number
  deDondeRegistrado: string
  /** Qué destinos de la etapa 2 lo pagan o lo cobran, y de qué lado: ingresos, egresos o egresos − ingresos. */
  banco: { codigos: CodigoDestino[]; lado: "ing" | "egr" | "neto" }
  /** Qué suele explicar la diferencia (es lo que mide la etapa 4). */
  explica: string
}

/** ETAPA 3: lo registrado al lado de lo que movió el banco, con la diferencia que la etapa 4 tiene que explicar. Fórmulas sobre la etapa 2. */
export function bloqueEtapa3(filas: FilaEtapa3[], filasDe: Map<string, number>, filaInicial: number, t: Etapa2["pesos"], filasE?: Map<string, number>): unknown[][] {
  const h: unknown[][] = []
  const r = () => filaInicial + h.length
  const num = (v: number) => ({ t: "n", v: r2(v), z: MONEDA })
  h.push([], [TITULO_TABLA("ETAPA 3 — LO REGISTRADO (subdiarios, templates, sueldos) contra lo que movió el banco (etapa 2). La diferencia es lo que explica la etapa 4.")])
  h.push(["Concepto", "Lo registrado", "Lo que movió el banco", "Diferencia", "", "", "", "", "", "", "", "", "Qué suele explicarla", "", "De dónde sale lo registrado · y lo del banco"].map(x => x ? ENCABEZADO_TABLA(x) : x))
  for (const x of filas) {
    const n = r()
    filasE?.set(x.nro, n)
    const celdas = x.banco.codigos.filter(c => filasDe.has(c)).map(c => filasDe.get(c)!)
    const fBanco = celdas.length ? celdas.map(f => (x.banco.lado === "ing" ? `F${f}` : x.banco.lado === "egr" ? `G${f}` : `(G${f}-F${f})`)).join("+") : "0"
    const vBanco = r2(x.banco.codigos.reduce((a, c) => { const y = t.get(c); if (!y) return a; const ing = y.ing1 + y.ing2, egr = y.egr1 + y.egr2; return a + (x.banco.lado === "ing" ? ing : x.banco.lado === "egr" ? egr : egr - ing) }, 0))
    h.push([`${x.nro} · ${x.concepto}`, num(x.registrado), { t: "n", f: fBanco, v: vBanco, z: MONEDA }, { t: "n", f: `B${n}-C${n}`, v: r2(x.registrado - vBanco), z: MONEDA }, "", "", "", "", "", "", "", "",
      x.explica, "", `${x.deDondeRegistrado} · banco: ${x.banco.codigos.join(" + ")} (${x.banco.lado === "ing" ? "ingresos" : x.banco.lado === "egr" ? "egresos" : "egresos − ingresos"})`])
  }
  h.push(["ⓘ Lo del banco es por fórmula sobre la etapa 2. Las diferencias NO son errores: son lo que pasa por otro lado (tarjeta, caja, otra empresa, deuda al inicio o al cierre, el histórico sin vincular) y es lo que mide la etapa 4."])
  h.push([])
  return h
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// ETAPA 4 — QUÉ EXPLICA LA DIFERENCIA (JMS 11/11: «avanzá con las etapas siguientes»). Primero compras y ventas, que son las grandes.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Un comprobante del libro diario del ejercicio: su id, de dónde viene y su total con signo (las NC restan). */
export interface ComprobanteDelLibro { id: string; fuente: string; total: number; ficha?: string; fecha?: string | null }
/** Un comprobante que explica el «resto»: sin pago en el ejercicio, o pagado por otro importe (con dónde se pagó). */
export interface CasoPuente { nro: string; c: ComprobanteDelLibro; pagado: number; donde: string }
/** Un movimiento de CUALQUIER cuenta (de las tres empresas, la tarjeta incluida) con el comprobante que paga o cobra. */
export interface MovimientoConComprobante { id: string; cuenta: string; titular: string; importe: number }

export interface RenglonPuente { nro: string; concepto: string; valor: number; como: string }

/**
 * Pura. El PUENTE entre lo facturado del ejercicio y lo que movió el banco de la empresa (D1 compras / D2 ventas), por DÓNDE se pagó o
 * cobró cada comprobante. Las partes suman lo facturado por construcción; lo que da la información es cuánto cae en cada camino.
 *   lo facturado = por las cuentas de la empresa + por la tarjeta + por otra empresa + histórico sin pago atado + resto (sin pago en el
 *                  ejercicio o por otro importe)
 *   lo del banco (D1 / D2) = lo facturado del ejercicio que pasó por las cuentas de la empresa + lo de comprobantes de OTROS ejercicios
 */
export function puenteDeComprobantes(compr: ComprobanteDelLibro[], movs: MovimientoConComprobante[], titular: string, cuentasDePlata: Set<string>,
  esTarjeta: (cuenta: string) => boolean, prefijo: string, verbo: { hecho: string; sin: string }): { renglones: RenglonPuente[]; totalLibro: number; enBanco: number; casos: CasoPuente[] } {
  const ids = new Set(compr.map(c => c.id))
  let propias = 0, tarjeta = 0, otra = 0, deOtrosEjercicios = 0, nOtros = 0
  const atados = new Set<string>()
  const pagadoDe = new Map<string, number>(), dondeDe = new Map<string, Set<string>>()
  for (const m of movs) {
    const enPlata = m.titular === titular && cuentasDePlata.has(m.cuenta)
    if (!ids.has(m.id)) { if (enPlata) { deOtrosEjercicios = r2(deOtrosEjercicios + m.importe); nOtros++ } continue }
    atados.add(m.id)
    pagadoDe.set(m.id, r2((pagadoDe.get(m.id) ?? 0) + m.importe))
    dondeDe.set(m.id, new Set([...(dondeDe.get(m.id) ?? []), m.titular === titular ? m.cuenta : `${m.cuenta} (${m.titular})`]))
    if (enPlata) propias = r2(propias + m.importe)
    else if (m.titular === titular && esTarjeta(m.cuenta)) tarjeta = r2(tarjeta + m.importe)
    else otra = r2(otra + m.importe)
  }
  const totalLibro = r2(compr.reduce((t, c) => t + c.total, 0))
  const historico = r2(compr.filter(c => c.fuente === "historico" && !atados.has(c.id)).reduce((t, c) => t + c.total, 0))
  const nHist = compr.filter(c => c.fuente === "historico" && !atados.has(c.id)).length
  const nSin = compr.filter(c => c.fuente !== "historico" && !atados.has(c.id)).length
  const resto = r2(totalLibro - propias - tarjeta - otra - historico)
  // 🔎 el resto, separado: lo que NO tiene ningún pago atado (deuda al cierre, o se pagó después) y lo pagado por OTRO importe
  const casos: CasoPuente[] = []
  for (const c of compr) {
    if (c.fuente === "historico" && !atados.has(c.id)) continue
    if (!atados.has(c.id)) { casos.push({ nro: `${prefijo}.5`, c, pagado: 0, donde: "" }); continue }
    const pg = pagadoDe.get(c.id) ?? 0
    if (Math.abs(c.total - pg) >= 0.01) casos.push({ nro: `${prefijo}.6`, c, pagado: pg, donde: [...(dondeDe.get(c.id) ?? [])].join(", ") })
  }
  const sinPago = r2(casos.filter(x => x.pagado === 0 && x.nro.endsWith(".5")).reduce((t, x) => t + x.c.total, 0))
  const nDif = casos.filter(x => x.nro.endsWith(".6")).length
  const renglones: RenglonPuente[] = [
    { nro: `${prefijo}.1`, concepto: `${verbo.hecho} por las cuentas de ${titular} en el ejercicio`, valor: propias, como: "movimientos de las cuentas de plata (etapa 1) atados al comprobante" },
    { nro: `${prefijo}.2`, concepto: `${verbo.hecho} con la tarjeta de ${titular}`, valor: tarjeta, como: "renglón del resumen de la tarjeta atado al comprobante" },
    { nro: `${prefijo}.3`, concepto: `${verbo.hecho} por OTRA empresa (PAM, MA, Cotitulares)`, valor: otra, como: "movimiento de una cuenta de otro titular atado al comprobante — va a la cuenta con ese socio" },
    { nro: `${prefijo}.4`, concepto: `del histórico jul–dic sin ${verbo.sin} atado (${nHist} comprobantes)`, valor: historico, como: "comprobantes del histórico: el pago no se vinculó (A-DEC-1028)" },
    { nro: `${prefijo}.5`, concepto: `SIN ${verbo.sin} atado en el ejercicio (${nSin} comprobantes): deuda al cierre, o se ${verbo.hecho.toLowerCase()} después`, valor: sinPago, como: "ningún movimiento atado; ver la lista en «Plata · facturas»" },
    { nro: `${prefijo}.6`, concepto: `${verbo.hecho} por OTRO importe que el del comprobante (${nDif} comprobantes): retenciones, pagos parciales, redondeos`, valor: r2(resto - sinPago), como: "lo facturado menos lo atado, en los comprobantes que sí tienen pago; ver la lista en «Plata · facturas»" },
  ]
  return { casos, renglones: [...renglones, { nro: `${prefijo}.7`, concepto: `aparte: el banco ${verbo.hecho.toLowerCase()} comprobantes de OTROS ejercicios o de otra empresa (${nOtros} movimientos)`, valor: deOtrosEjercicios, como: "movimientos de las cuentas de plata atados a un comprobante que no es de este ejercicio" }],
    totalLibro, enBanco: r2(propias + deOtrosEjercicios) }
}

/** El bloque de la etapa 4 de un puente: los renglones, la suma contra lo facturado (E1/E2) y lo del banco contra D1/D2, por fórmula. */
export function bloquePuente(titulo: string, p: ReturnType<typeof puenteDeComprobantes>, filaInicial: number, filaE3: number | null, filaD: number | null, ladoD: "F" | "G",
  cierra: { libro: boolean; banco: boolean; que?: string } = { libro: true, banco: true }): unknown[][] {
  const h: unknown[][] = []
  const r = () => filaInicial + h.length
  const num = (v: number) => ({ t: "n", v: r2(v), z: MONEDA })
  h.push([TITULO_TABLA(titulo)])
  const d0 = r()
  for (const x of p.renglones.slice(0, -1)) h.push([`${x.nro} · ${x.concepto}`, num(x.valor), "", "", "", "", "", "", "", "", "", "", "", "", x.como])
  const n = r()
  const ctrl = (f: string, ok: string, mal: string, v: boolean) => ({ t: "s", f: `IF(ABS(${f})<0.01,"${ok}","${mal}")`, v: v ? ok : mal })
  h.push([TOTAL_TEXTO(`= suma (tiene que dar ${cierra.que ?? "lo facturado"})`), { t: "n", f: `SUM(B${d0}:B${n - 1})`, v: p.totalLibro, z: MONEDA }, filaE3 ? { t: "n", f: `B${n}-B${filaE3}`, v: 0, z: MONEDA } : "", "", "", "", "", "", "", "", "", "",
    filaE3 ? ctrl(`C${n}`, "✓ = lo registrado de la etapa 3", "⚠️ no da con la etapa 3", cierra.libro) : ""])
  const o = p.renglones[p.renglones.length - 1], nO = r()
  h.push([`${o.nro} · ${o.concepto}`, num(o.valor), "", "", "", "", "", "", "", "", "", "", "", "", o.como])
  const nB = r()
  h.push([TOTAL_TEXTO(`= lo que movió el banco (${p.renglones[0].nro} + ${o.nro})`), { t: "n", f: `B${d0}+B${nO}`, v: p.enBanco, z: MONEDA }, filaD ? { t: "n", f: `B${nB}-${ladoD}${filaD}`, v: 0, z: MONEDA } : "", "", "", "", "", "", "", "", "", "",
    filaD ? ctrl(`C${nB}`, "✓ = lo del banco de la etapa 2", "⚠️ no da con la etapa 2: hay movimientos atados a un comprobante que no es factura de compra / venta", cierra.banco) : ""])
  h.push([])
  return h
}

/** La solapa «Plata · facturas»: los comprobantes del ejercicio que explican el resto (sin pago atado, o por otro importe), con su ficha. */
export function hojaFacturasPuente(compras: CasoPuente[], ventas: CasoPuente[], titular: string, etiqueta: string): unknown[][] {
  const h: unknown[][] = [[{ t: "s", v: `⬅ Control de la plata  ·  FACTURAS QUE EXPLICAN LA DIFERENCIA (etapa 4) — ${titular} — ejercicio ${etiqueta}`, l: { Target: "#'Control de la plata'!A1" } }],
    ["Las compras y ventas del ejercicio sin pago / cobro atado (E2.5 / E1.5) o pagadas por otro importe (E2.6 / E1.6). Filtrá por «Nro»."], []]
  h.push(["Nro", "Compra o venta", "Proveedor / cliente · comprobante", "Fecha", "Total del comprobante", "Pagado / cobrado (atado)", "Diferencia", "Dónde se pagó / cobró"].map(ENCABEZADO_TABLA))
  const num = (v: number) => ({ t: "n", v: r2(v), z: MONEDA })
  for (const [tipo, xs] of [["compra", compras], ["venta", ventas]] as const) for (const x of [...xs].sort((a, b) => a.nro.localeCompare(b.nro) || Math.abs(b.c.total - b.pagado) - Math.abs(a.c.total - a.pagado))) {
    const n = h.length + 1
    h.push([x.nro, tipo, x.c.ficha ?? x.c.id, x.c.fecha ? dmy(x.c.fecha) : "", num(x.c.total), num(x.pagado), { t: "n", f: `E${n}-F${n}`, v: r2(x.c.total - x.pagado), z: MONEDA }, x.donde])
  }
  return h
}
