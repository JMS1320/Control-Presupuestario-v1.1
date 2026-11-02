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
import { armarResumenPorMes, hojaResumenPorMes } from "./resumen-por-mes"
import { MOTIVO_EN_CERO } from "./movimientos-de-cuotas"

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
export function nombreSolapaGrupo(g: Pick<GrupoTemplates, "responsable" | "agrupadora">, libro = "G"): string {
  const corto = g.agrupadora.replace(/Impuestos/gi, "Imp").replace(/Buenos Aires/gi, "BA").replace(/General/gi, "Gral")
    .replace(/Distribuci[oó]n/gi, "Distrib").replace(/Socios/gi, "soc").replace(/\s*\/\s*/g, "-")
  return `${libro} · ${g.responsable} · ${corto}`.slice(0, 31)
}

/** El grupo de los templates sin agrupadora en el libro H (JMS: «las sin agrupadora como un grupo sin etiqueta»). */
export const SIN_GRUPO = "(sin agrupadora)"

/**
 * 📗 A-FEAT-1514 — los grupos del LIBRO H para UN responsable: TODAS sus agrupadoras, sin filtros (también lo financiero, las de
 * una sola cuota y las sin agrupadora). Recibe las cuotas que ya están en su «Por mes», así las solapas suman lo mismo.
 * Orden: por nombre, y el grupo sin agrupadora al final (el mismo orden de «Por mes»).
 */
export function gruposDelResponsable(cuotas: CuotaTemplate[], responsable: string): GrupoTemplates[] {
  const m = new Map<string, GrupoTemplates>()
  for (const c of cuotas) {
    const ag = (c.agrupadoraTemplate ?? "").trim() || SIN_GRUPO
    const g = m.get(ag) ?? { responsable, agrupadora: ag, cuotas: [], total: 0 }
    g.cuotas.push(c); g.total = r2(g.total + c.monto); m.set(ag, g)
  }
  return [...m.values()].sort((a, b) => (a.agrupadora === SIN_GRUPO ? 1 : 0) - (b.agrupadora === SIN_GRUPO ? 1 : 0)
    || a.agrupadora.localeCompare(b.agrupadora, "es"))
}

const ESTADOS_PAGOS = /pagad|conciliad/i
const dmy = (f: string | null | undefined) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")

/** Una solapa de grupo (A-FEAT-1513): resumen categoría × mes con Nro, y abajo cada cuota con su Nro. */
export function hojaGrupo(g: GrupoTemplates, etiqueta: string, meses: { clave: string; rotulo: string }[] = [], opciones: OpcionesHojaGrupo = {}): unknown[][] {
  return armarHojaGrupo(g, etiqueta, meses, opciones).filas
}

export interface OpcionesHojaGrupo {
  /** 📗 A-FEAT-1515: la solapa «Por mes» del mismo responsable, para el control 2 (esta agrupadora vista desde allá). */
  hojaPorMes?: string
  /** Las cuentas que no se pudieron leer al buscar el banco de las cuotas (se dicen en el control 3). */
  tablasSinLeer?: string[]
}

/** Las columnas de «Por mes» (ver `hojaTemplatesPorMes`): B = agrupadora, C = categoría, P = TOTAL (12 meses desde la D). */
const POR_MES = { agrupadora: "B", categoria: "C", total: "P" }
/** Cómo se rotula en «Por mes» el grupo sin agrupadora (`SIN_AGRUPADORA` de templates-libro). */
const SIN_AGRUPADORA_POR_MES = "(sin agrupadora en el template)"
const ESTADOS_SIN_PAGAR = ["pendiente", "pagar", "preparado"]

/**
 * 📗 A-FEAT-1515 — la solapa de una agrupadora del libro H, escrita para AUDITARLA (JMS 01/11: *«el primer usuario del
 * reporte soy yo… tiene que tener sentido para mí»*).
 *
 * Detalle como un renglón del extracto: Fecha · Template · Cuenta · Comprobante · Proveedor · Detalle · Estado · Débito ·
 * Crédito (sin la descripción del banco: JMS, «descripción de banco no pondría»). Proveedor: el del template; si no tiene,
 * la cuenta donde se pagó (Créditos Bancarios no tenía ninguno).
 *
 * Y al pie, el CONTROL (§ 🧮), con fórmulas vivas:
 * 1. **Interno** — el detalle suma el total del resumen. Si no, la hoja se contradice: 🛑.
 * 2. **Contra «Por mes»** — la misma agrupadora sumada en la otra solapa (las cuotas agrupadas por otro camino). 🛑 si no da.
 * 3. **Contra el banco** — lo conciliado según las cuotas vs. lo que respaldan sus movimientos. ⚠️ avisa y lista los casos
 *    (un pago agrupado, una cuota en $ 0): puede tener explicación. Y lo pagado sin banco y lo sin pagar, como renglones.
 */
export function armarHojaGrupo(g: GrupoTemplates, etiqueta: string, meses: { clave: string; rotulo: string }[] = [], opciones: OpcionesHojaGrupo = {}): { filas: unknown[][]; celdaTotal: string | null } {
  const { filas: h, ubicacion: u } = armarResumenPorMes(g.cuotas.map(c => ({
    categoria: c.categ || "(sin categoría)", mes: (c.fecha ?? "").slice(0, 7), importe: c.monto,
    columnas: [dmy(c.fecha), c.concepto, c.banco?.cuenta ?? "", c.banco?.comprobante ?? "",
      c.proveedor || c.banco?.cuenta || "", c.detalle ?? "", c.estado],
  })), {
    titulo: `${g.agrupadora.toUpperCase()} — ${g.responsable} — ejercicio ${etiqueta}`,
    notas: ["Por categoría y por mes (fórmulas sobre el detalle). Las cuotas cuentan por fecha de pago, o la estimada si no se pagó.",
      "Cuenta y comprobante: los del movimiento del banco con el que se concilió la cuota. Al pie, el CONTROL."],
    meses, encabezadoDetalle: ["Fecha", "Template", "Cuenta", "Comprobante", "Proveedor", "Detalle", "Estado"],
    debeHaber: true,
  })
  if (!u.celdaTotal || !u.colDebito || !u.colCredito) return { filas: h, celdaTotal: u.celdaTotal }

  const deb = `${u.colDebito}${u.det1}:${u.colDebito}${u.detN}`, cred = `${u.colCredito}${u.det1}:${u.colCredito}${u.detN}`
  const est = `${u.colDetalle(6)}${u.det1}:${u.colDetalle(6)}${u.detN}`
  const netoSi = (estado: string) => `SUMIFS(${deb},${est},"${estado}")-SUMIFS(${cred},${est},"${estado}")`
  const total = r2(g.cuotas.reduce((t, c) => t + c.monto, 0))
  const conciliadas = g.cuotas.filter(c => /^conciliad/i.test(c.estado))
  const conciliado = r2(conciliadas.reduce((t, c) => t + c.monto, 0))
  const sinPagar = r2(g.cuotas.filter(c => ESTADOS_SIN_PAGAR.includes(c.estado.toLowerCase())).reduce((t, c) => t + c.monto, 0))
  const miroBanco = g.cuotas.some(c => c.banco !== undefined)
  const respaldo = r2(conciliadas.reduce((t, c) => t + (c.banco?.respaldo ?? 0), 0))
  /** El veredicto, con el valor ya calculado (el que se ve si Excel no recalcula al abrir). */
  const ok = (dif: string, valor: number, siNo: string) => ({ t: "s", f: `IF(ABS(${dif})<0.005,"✓ cierra","${siNo}")`, v: Math.abs(valor) < 0.005 ? "✓ cierra" : siNo })
  const fila = () => h.length + 1

  h.push([], ["CONTROL — todo cruzado (§ controles de la app): 1 frena si no da, 2 frena si no da, 3 avisa"])
  // 1 · Interno
  const r1 = fila()
  h.push(["", "1 · Interno", "Detalle (débitos − créditos)", { t: "n", f: `SUM(${deb})-SUM(${cred})`, v: total }])
  h.push(["", "", "Total del resumen de arriba", { t: "n", f: u.celdaTotal, v: total }])
  h.push(["", "", "Diferencia (tiene que dar 0)", { t: "n", f: `D${r1}-D${r1 + 1}`, v: 0 }, ok(`D${r1}-D${r1 + 1}`, 0, "🛑 NO CIERRA: la hoja se contradice")])
  // 2 · Contra «Por mes»
  if (opciones.hojaPorMes) {
    const ref = (c: string) => `'${opciones.hojaPorMes!.replace(/'/g, "''")}'!${c}:${c}`
    const agr = g.agrupadora === SIN_GRUPO ? SIN_AGRUPADORA_POR_MES : g.agrupadora
    const r2f = fila()
    h.push(["", "2 · Contra «Por mes»", `Esta agrupadora en «${opciones.hojaPorMes}»`,
      { t: "n", f: `SUMIFS(${ref(POR_MES.total)},${ref(POR_MES.agrupadora)},"${agr.replace(/"/g, '""')}",${ref(POR_MES.categoria)},"<>")`, v: total }])
    h.push(["", "", "Diferencia con esta solapa (tiene que dar 0)", { t: "n", f: `D${r1 + 1}-D${r2f}`, v: 0 }, ok(`D${r1 + 1}-D${r2f}`, 0, "🛑 NO CIERRA: una cuota quedó afuera o contada dos veces")])
  }
  // 3 · Contra el banco
  const r3 = fila()
  h.push(["", "3 · Contra el banco", "Conciliado (según las cuotas)", { t: "n", f: netoSi("conciliado"), v: conciliado }])
  if (miroBanco) {
    h.push(["", "", "Lo que respaldan los movimientos del banco", respaldo])
    h.push(["", "", "Diferencia", { t: "n", f: `D${r3}-D${r3 + 1}`, v: r2(conciliado - respaldo) }, ok(`D${r3}-D${r3 + 1}`, r2(conciliado - respaldo), "⚠️ no cierra: ver los casos abajo")])
  } else {
    h.push(["", "", "No se leyó el banco: este control no se hizo", ""])
  }
  if (opciones.tablasSinLeer?.length) h.push(["", "", `⚠️ No se pudieron leer: ${opciones.tablasSinLeer.join(", ")}`])
  const rP = fila()
  h.push(["", "", "Pagado sin banco (anterior, pagado, débito…)", { t: "n", f: `D${r1 + 1}-D${r3}-D${rP + 1}`, v: r2(total - conciliado - sinPagar) }])
  h.push(["", "", "Sin pagar al cierre (pendiente, a pagar, preparado)", { t: "n", f: ESTADOS_SIN_PAGAR.map(netoSi).join("+"), v: sinPagar }])
  h.push(["", "", "= Total de la solapa", { t: "n", f: `D${r3}+D${rP}+D${rP + 1}`, v: total }])

  // Primero los que mueven plata; las conciliadas en $ 0 sin movimiento, al final (no cambian el control).
  const casos = g.cuotas.filter(c => c.banco?.motivo)
    .sort((a, b) => Number(a.banco!.motivo === MOTIVO_EN_CERO) - Number(b.banco!.motivo === MOTIVO_EN_CERO))
  if (casos.length) {
    h.push([], ["", "Casos que no cierran con el banco", "Fecha", "Template", "Cuota", "Respalda el banco", "Diferencia", "Por qué"])
    for (const c of casos) {
      const rb = c.banco!.respaldo
      h.push(["", "", dmy(c.fecha), c.concepto, c.monto, rb ?? "", rb === null ? "" : r2(c.monto - rb), c.banco!.motivo])
    }
  }
  return { filas: h, celdaTotal: u.celdaTotal }
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
