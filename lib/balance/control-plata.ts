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
  tablasQueFallaron: string[] = []): unknown[][] {
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
  const bloque = (titulo: string, xs: ResumenDeCuenta[]) => {
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
  }
  const pesos = rs.filter(r => !r.enDolares), usd = rs.filter(r => r.enDolares)
  bloque("EN PESOS", pesos)
  if (usd.length) bloque("EN DÓLARES (US$) — no se suman a los pesos", usd)
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
  return h
}
