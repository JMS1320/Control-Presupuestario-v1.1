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
import { hojaResumenPorMes } from "./resumen-por-mes"

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

/** Una solapa de grupo (A-FEAT-1513): resumen categoría × mes con Nro, y abajo cada cuota con su Nro. */
export function hojaGrupo(g: GrupoTemplates, etiqueta: string, meses: { clave: string; rotulo: string }[] = []): unknown[][] {
  return hojaResumenPorMes(g.cuotas.map(c => ({
    categoria: c.categ || "(sin categoría)", mes: (c.fecha ?? "").slice(0, 7), importe: c.monto,
    columnas: [dmy(c.fecha), c.concepto, c.estado, c.proveedor],
  })), {
    titulo: `${g.agrupadora.toUpperCase()} — ${g.responsable} — ejercicio ${etiqueta}`,
    notas: ["Por categoría y por mes (fórmulas sobre el detalle). Las cuotas cuentan por fecha de pago, o la estimada si no se pagó."],
    meses, encabezadoDetalle: ["Fecha", "Template", "Estado", "Proveedor"],
  })
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

/** La solapa LIB (A-FEAT-1513): lo marcado «LIB» en los bancos, por categoría y por mes, con Nro; abajo cada movimiento. */
export function hojaLib(ms: MovimientoLib[], etiqueta: string, meses: { clave: string; rotulo: string }[] = []): unknown[][] {
  return hojaResumenPorMes(ms.map(m => ({
    categoria: m.categ || "(sin categoría)", mes: m.fecha.slice(0, 7), importe: m.debitos - m.creditos,
    columnas: [m.empresa, m.cuenta, dmy(m.fecha), m.descripcion, m.detalle, m.debitos || "", m.creditos || ""],
  })), {
    titulo: `LIB — lo marcado «LIB» en la columna contable de los bancos — ejercicio ${etiqueta}`,
    notas: ["Agrupado en paralelo, por categoría del movimiento y por mes. Neto = débitos − créditos. La empresa de cada banco, en el detalle."],
    meses, rotuloImporte: "Neto", encabezadoDetalle: ["Empresa", "Cuenta", "Fecha", "Descripción", "Detalle", "Débito", "Crédito"],
  })
}
