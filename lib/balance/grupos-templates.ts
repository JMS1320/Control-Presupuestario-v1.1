/**
 * 📚 **LIBRO G — los grupos de templates con el formato de «impuestos bancarios»** (A-FEAT-1512, JMS 01/11).
 *
 * JMS: *«fijate para MA y PAM dónde aplicar este mismo formato de reporte… fijos Buenos Aires, lo que lleva contable LIB
 * como paralelo… armate un libro aparte… y a cuál de MSA le puede servir hacer el desglose; yo después te digo cuál sirve»*.
 * Es una PROPUESTA: una solapa por grupo (responsable + agrupadora del template), con arriba una línea por categoría y su
 * total —fórmulas sobre el detalle— y abajo cada cuota. Más la solapa de lo marcado «LIB» en los bancos.
 *
 * Pura: recibe las cuotas del ejercicio (las del libro de templates) y los movimientos LIB ya leídos.
 */
import type { CuotaTemplate } from "./templates-libro"

/** Lo que NO se arma como grupo: lo financiero (no es gasto) y lo bancario (ya está en el libro C). */
export const AGRUPADORAS_FUERA = new Set(["inversiones", "movimientos internos empresa", "tarjetas", "créditos bancarios", "creditos bancarios",
  "gastos bancarios", "impuestos bancarios"])

export interface GrupoTemplates { responsable: string; agrupadora: string; cuotas: CuotaTemplate[]; total: number }

const r2 = (n: number) => Math.round(n * 100) / 100
const resp1 = (r: string) => (r || "").split("/")[0].trim().toUpperCase() || "(sin responsable)"

/** Los grupos: responsable + agrupadora del template, sin los de afuera. Orden: MA, PAM, MSA (lo pidió primero para MA y PAM). */
export function armarGruposTemplates(cuotas: CuotaTemplate[]): GrupoTemplates[] {
  const m = new Map<string, GrupoTemplates>()
  for (const c of cuotas) {
    const ag = (c.agrupadoraTemplate ?? "").trim()
    if (!ag || AGRUPADORAS_FUERA.has(ag.toLowerCase())) continue
    const k = `${resp1(c.responsable)}|${ag}`
    const g = m.get(k) ?? { responsable: resp1(c.responsable), agrupadora: ag, cuotas: [], total: 0 }
    g.cuotas.push(c); g.total = r2(g.total + c.monto); m.set(k, g)
  }
  const orden = ["MA", "PAM", "MSA"]
  const pos = (r: string) => { const i = orden.indexOf(r); return i < 0 ? 99 : i }
  return [...m.values()].filter(g => g.cuotas.length >= 2)
    .sort((a, b) => pos(a.responsable) - pos(b.responsable) || a.agrupadora.localeCompare(b.agrupadora))
}

/** Un nombre de solapa corto y único (Excel admite 31 caracteres). */
export function nombreSolapaGrupo(g: Pick<GrupoTemplates, "responsable" | "agrupadora">): string {
  const corto = g.agrupadora.replace(/Impuestos/gi, "Imp").replace(/Buenos Aires/gi, "BA").replace(/General/gi, "Gral")
    .replace(/Distribuci[oó]n/gi, "Distrib").replace(/Socios/gi, "soc").replace(/\s*\/\s*/g, "-")
  return `G · ${g.responsable} · ${corto}`.slice(0, 31)
}

const ESTADOS_PAGOS = /pagad|conciliad/i
const dmy = (f: string | null | undefined) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")

/**
 * Una solapa de grupo: arriba una línea por categoría (total con fórmula sobre el detalle, cuántas cuotas y cuánto pagado),
 * abajo cada cuota.
 */
export function hojaGrupo(g: GrupoTemplates, etiqueta: string): unknown[][] {
  const cats = [...new Set(g.cuotas.map(c => c.categ || "(sin categoría)"))].sort((a, b) => a.localeCompare(b))
  const filaDet1 = 1 + 2 + 1 + cats.length + 1 + 2 + 1 + 1
  const ultima = filaDet1 + g.cuotas.length + 5
  const rng = (col: string) => `${col}$${filaDet1}:${col}$${ultima}`
  const h: unknown[][] = [[`${g.agrupadora.toUpperCase()} — ${g.responsable} — ejercicio ${etiqueta}`],
    ["Una línea por categoría con el total del año (fórmula sobre el detalle de abajo). Las cuotas cuentan por fecha de pago, o la estimada si no se pagó."], [],
    ["Categoría", "Total del ejercicio", "Cuotas", "Pagadas", "Pagado", "Pendiente"]]
  const r1 = h.length + 1
  for (const c of cats) {
    const xs = g.cuotas.filter(q => (q.categ || "(sin categoría)") === c)
    const pag = xs.filter(q => ESTADOS_PAGOS.test(q.estado || ""))
    const n = h.length + 1
    h.push([c, { t: "n", f: `SUMIFS(${rng("E")},${rng("C")},A${n})`, v: r2(xs.reduce((t, q) => t + q.monto, 0)) }, xs.length, pag.length,
      r2(pag.reduce((t, q) => t + q.monto, 0)), r2(xs.reduce((t, q) => t + q.monto, 0) - pag.reduce((t, q) => t + q.monto, 0))])
  }
  const r2_ = h.length
  h.push(["TOTAL", { t: "n", f: `SUM(B${r1}:B${r2_})`, v: g.total }, g.cuotas.length])
  h.push([], [])
  h.push(["Fecha", "Template", "Categoría", "Estado", "Importe", "Proveedor"])
  for (const c of [...g.cuotas].sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? "") || a.concepto.localeCompare(b.concepto))) {
    h.push([dmy(c.fecha), c.concepto, c.categ || "(sin categoría)", c.estado, r2(c.monto), c.proveedor])
  }
  return h
}

/** El índice del libro G: cada grupo con su total; el control es que la suma dé el total de las cuotas agrupadas. */
export function hojaIndiceGrupos(gs: GrupoTemplates[], cuotas: CuotaTemplate[], etiqueta: string, lib: MovimientoLib[] | null): unknown[][] {
  const afuera = cuotas.filter(c => { const a = (c.agrupadoraTemplate ?? "").trim(); return !a || AGRUPADORAS_FUERA.has(a.toLowerCase()) })
  const h: unknown[][] = [[`GRUPOS DE TEMPLATES — propuesta para revisar (ejercicio ${etiqueta})`],
    ["Una solapa por grupo (responsable + agrupadora del template), con el formato de «impuestos bancarios»: arriba por categoría, abajo cada cuota."],
    ["Decime cuáles sirven y cuáles no. No se incluyen inversiones, tarjetas, movimientos internos ni lo bancario (está en el libro C)."], [],
    ["Responsable", "Grupo", "Solapa", "Cuotas", "Total del ejercicio"]]
  const d = h.length + 1
  for (const g of gs) h.push([g.responsable, g.agrupadora, nombreSolapaGrupo(g), g.cuotas.length, g.total])
  const hh = h.length
  h.push(["", "TOTAL de los grupos", "", gs.reduce((t, g) => t + g.cuotas.length, 0), { t: "n", f: `SUM(E${d}:E${hh})`, v: r2(gs.reduce((t, g) => t + g.total, 0)) }])
  const sueltas = cuotas.length - afuera.length - gs.reduce((t, g) => t + g.cuotas.length, 0)
  h.push([], ["Control", "", "", "", ""],
    ["", "Cuotas del ejercicio (todas)", "", cuotas.length, r2(cuotas.reduce((t, c) => t + c.monto, 0))],
    ["", "  − fuera (financiero, bancario o sin agrupadora)", "", afuera.length, r2(afuera.reduce((t, c) => t + c.monto, 0))],
    ["", "  − grupos de una sola cuota (no se arman)", "", sueltas, ""],
    ["", "  = en los grupos de arriba", "", cuotas.length - afuera.length - sueltas, ""])
  if (lib) h.push([], ["", "Lo marcado «LIB» en los bancos", "G · LIB (paralelo)", lib.length, r2(lib.reduce((t, m) => t + m.debitos - m.creditos, 0))])
  return h
}

export interface MovimientoLib { empresa: string; cuenta: string; fecha: string; descripcion: string; categ: string; detalle: string; debitos: number; creditos: number }

/** La solapa LIB: lo que en los bancos lleva la marca «LIB» (contable), como paralelo — por categoría arriba, el detalle abajo. */
export function hojaLib(ms: MovimientoLib[], etiqueta: string): unknown[][] {
  const cats = [...new Set(ms.map(m => m.categ || "(sin categoría)"))].sort((a, b) => a.localeCompare(b))
  const filaDet1 = 1 + 2 + 1 + cats.length + 1 + 2 + 1 + 1
  const ultima = filaDet1 + ms.length + 5
  const rng = (col: string) => `${col}$${filaDet1}:${col}$${ultima}`
  const emp = ["MSA", "PAM", "MA"]
  const h: unknown[][] = [[`LIB — lo marcado «LIB» en la columna contable de los bancos — ejercicio ${etiqueta}`],
    ["Agrupado en paralelo: por categoría del movimiento y por empresa del banco. Neto = débitos − créditos."], [],
    ["Categoría", "Total", ...emp.map(e => `de ${e}`), "Movimientos"]]
  const r1 = h.length + 1
  for (const c of cats) {
    const xs = ms.filter(m => (m.categ || "(sin categoría)") === c)
    const n = h.length + 1
    const neto = (ys: MovimientoLib[]) => r2(ys.reduce((t, m) => t + m.debitos - m.creditos, 0))
    h.push([c, { t: "n", f: `SUMIFS(${rng("F")},${rng("E")},A${n})-SUMIFS(${rng("G")},${rng("E")},A${n})`, v: neto(xs) },
      ...emp.map(e => neto(xs.filter(m => m.empresa === e))), xs.length])
  }
  const r2_ = h.length
  h.push(["TOTAL", { t: "n", f: `SUM(B${r1}:B${r2_})`, v: r2(ms.reduce((t, m) => t + m.debitos - m.creditos, 0)) }, "", "", "", ms.length])
  h.push([], [])
  h.push(["Empresa", "Cuenta", "Fecha", "Descripción", "Categoría", "Débito", "Crédito", "Detalle"])
  if (!ms.length) h.push(["(no hay movimientos marcados LIB en el ejercicio)"])
  for (const m of [...ms].sort((a, b) => a.fecha.localeCompare(b.fecha))) h.push([m.empresa, m.cuenta, dmy(m.fecha), m.descripcion, m.categ || "(sin categoría)", m.debitos || "", m.creditos || "", m.detalle])
  return h
}
