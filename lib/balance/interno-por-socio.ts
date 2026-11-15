/**
 * 👥 EL REPORTE INTERNO POR SOCIO — lo que va al BALANCE, la COMPENSACIÓN INTERNA y lo que da la REALIDAD (A-FEAT-1288). Pura.
 *
 * JMS 14/11: *«como siempre, es una tabla y debajo está el detalle… En el balance va esto, pero esta es nuestra compensación interna
 * de ciertas cosas, entonces la realidad da esto. Interno es un reporte muy importante»*.
 *
 * - **Balance** = el saldo de la 14.1 (la cuenta de la empresa con cada socio, la que se presenta). Sale de `cuentasConLosSocios`:
 *   el mismo cálculo que la solapa 14.1, así que se actualiza solo.
 * - **Compensación interna** = lo que la capa (`capaInterna`) mueve hacia cada socio, desde cualquier empresa del grupo, más los
 *   ajustes fijos (el sueldo de MA: en lo contable es haber de la 14.1; en lo real es dividendo — JMS 14/11).
 * - **Realidad** = balance − compensación (+ = la empresa le debe al socio · − = el socio se llevó de más).
 *
 * Una sola implementación: la usan la solapa «I · Interno por socio» de la app y el papel de research
 * (`scripts/excel-cuenta-interna-research.mts`), para que los dos den lo mismo.
 */
import { PROPIO, type AjusteFijo, type ResultadoCapa } from "./capa-interna"

/** Los socios del reporte, en el orden de JMS. */
export const SOCIOS_INTERNO = ["MA", "JMS", "AMS", "PAM"] as const
/** 👷 JMS 14/11: «lo que no es real de MA es el sueldo… es solamente contable». Los sueldos de JMS y AMS son reales. */
export const SUELDO_SOLO_CONTABLE = new Set(["MA"])

const r2 = (x: number) => Math.round(x * 100) / 100

/** Lo mínimo de una cuenta de la 14.1 que necesita el reporte (es `CuentaCorrienteDelBalance`). */
export interface CuentaSocio141 {
  contraparte: { clave: string }
  saldoAlCierre: number
  resumen: { asientos: Array<{ id: string; importe: number }> }
}

/**
 * De las cuentas de la 14.1: el saldo al cierre de cada socio y los ajustes fijos (el sueldo que es sólo contable, sumado de los
 * renglones `sueldo-…` de su cuenta — los que entran por `sueldosPendientesComoCompras`).
 */
export function entradaDesde141(socios: CuentaSocio141[], empresa: string): { saldos: Record<string, number>; fijos: AjusteFijo[] } {
  const saldos: Record<string, number> = {}, fijos: AjusteFijo[] = []
  for (const c of socios) {
    const q = c.contraparte.clave.toUpperCase()
    saldos[q] = r2(c.saldoAlCierre)
    if (SUELDO_SOLO_CONTABLE.has(q)) {
      const ss = c.resumen.asientos.filter(a => a.id.startsWith("sueldo-"))
      const tot = r2(ss.reduce((t, a) => t + a.importe, 0))
      if (tot) fijos.push({ empresa, socio: q, importe: tot, porque: `sueldo de ${q} (${ss.length} ${ss.length === 1 ? "mes" : "meses"} en la 14.1): sólo contable; en lo real es dividendo` })
    }
  }
  return { saldos, fijos }
}

export interface EntradaInterno {
  capa: ResultadoCapa
  /** El saldo de la 14.1 con cada socio (+ = la empresa le debe). */
  saldos: Record<string, number>
  /** Los mismos fijos que se le pasaron a `capaInterna` (para separarlos en la tabla y listarlos en el detalle). */
  fijos: AjusteFijo[]
  /** La empresa del balance (la de la 14.1). */
  empresa: string
  etiqueta: string
  cierre: string
  /** Cuentas que no se pudieron leer: el reporte lo dice arriba (§ 🧮: nada se descarta en silencio). */
  tablasQueFallaron?: string[]
}

/** Lo que la capa le pone (+) o le saca (−) a un socio, sumado sobre todas las empresas. */
export const compensacionDe = (capa: ResultadoCapa, q: string) => r2([...capa.porCuenta].filter(([k]) => k.split("→")[1] === q).reduce((t, [, x]) => t + x, 0))

const fmtFecha = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso

/** La solapa: la tabla por socio arriba, el detalle de cada socio abajo (con su subtotal = la tabla), y lo sin resolver al final. */
export function hojaInternoPorSocio(e: EntradaInterno): unknown[][] {
  const { capa, saldos, fijos, empresa } = e
  const fijoDe = (q: string) => r2(fijos.filter(f => f.socio === q).reduce((t, f) => t + f.importe, 0))
  const f: unknown[][] = [
    [`INTERNO — lo que va al BALANCE, la COMPENSACIÓN INTERNA y lo que da la REALIDAD, socio por socio · ejercicio ${e.etiqueta} · al ${fmtFecha(e.cierre)}`],
    [`Saldo con ${empresa}: + = ${empresa} le debe al socio · − = el socio se llevó de más. Compensación interna: + = en lo real el socio se llevó MÁS (de MSA, PAM o MA). Realidad = balance − compensación.`],
    [`Control: lo que la compensación le pone a unos se lo saca a otros o a la empresa → ${capa.control === 0 ? "✅ 0" : "🔴 " + capa.control}. Sin resolver (quedan como en el balance): ${capa.sinResolver.length}, al pie. Transferencias entre cuentas de la app contadas del otro lado: ${capa.espejos}.`],
  ]
  if (e.tablasQueFallaron?.length) f.push([`⚠️ No se pudieron leer: ${e.tablasQueFallaron.join(", ")}. Sus movimientos NO están en la compensación.`])
  f.push([], ["Socio", `En el BALANCE (14.1, saldo con ${empresa})`, "Compensación interna (movimientos)", "Ajustes fijos", "Compensación total", "La REALIDAD", "Movimientos"])
  for (const q of SOCIOS_INTERNO) {
    const tot = compensacionDe(capa, q), fijo = fijoDe(q), saldo = saldos[q] ?? 0
    f.push([q, saldo, r2(tot - fijo), fijo, tot, r2(saldo - tot), capa.ajustes.filter(a => a.a === q || a.de === q).length])
  }
  const otras = [...capa.porCuenta].filter(([k]) => !(SOCIOS_INTERNO as readonly string[]).includes(k.split("→")[1]))
  f.push(["Empresas (gasto propio) y Libertad", "", r2(otras.reduce((t, [, x]) => t + x, 0)), "", "", "", "lo que sale de la empresa o de LIB y va a un socio (o al revés)"])
  for (const [k, x] of otras.sort((a, b) => a[0].localeCompare(b[0]))) f.push([`   ${k.replace(PROPIO, "gasto propio")}`, "", x])

  for (const q of SOCIOS_INTERNO) {
    f.push([], [`DETALLE — ${q}`], ["Fecha", "Empresa / cuenta", "Detalle", "CATEG", "Contable", "Interno", "En lo real (+ se llevó · − se le saca)", "Viene de / va a", "Por qué"])
    let sub = 0
    for (const a of capa.ajustes.filter(a => a.a === q || a.de === q)) {
      const m = a.mov!, imp = a.a === q ? a.importe : -a.importe; sub += imp
      f.push([m.fecha, `${m.titular} · ${m.cuenta}`, m.detalle || m.desc || "", m.categ ?? "", m.contable, m.interno, imp, a.a === q ? `viene de ${a.de}` : `va a ${a.a}`, a.porque])
    }
    for (const x of fijos.filter(x => x.socio === q)) { sub += x.importe; f.push([e.cierre, `${x.empresa} · 14.1`, x.porque, "", "haber de la 14.1", "", x.importe, "ajuste fijo", "en lo real no es sueldo: es dividendo (JMS 14/11)"]) }
    f.push(["", "", `Subtotal ${q}`, "", "", "", r2(sub), r2(sub) === compensacionDe(capa, q) ? "✓ = la tabla de arriba" : "🔴 no cuadra con la tabla", ""])
  }

  f.push([], ["SIN RESOLVER — la compensación no los mueve (quedan como en el balance) hasta que se decida"],
    ["Fecha", "Empresa / cuenta", "Detalle", "CATEG", "Contable", "Interno", "Débito", "Crédito", "Por qué"])
  for (const x of capa.sinResolver) { const m = x.mov; f.push([m.fecha, `${m.titular} · ${m.cuenta}`, m.detalle || m.desc || "", m.categ ?? "", m.contable, m.interno, m.deb, m.cred, x.porque]) }
  if (!capa.sinResolver.length) f.push(["", "", "(ninguno)"])
  return f
}
