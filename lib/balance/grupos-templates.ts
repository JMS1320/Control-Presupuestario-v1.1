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
import type { CuotaTemplate, ExtractoParaH } from "./templates-libro"
import type { MovimientoExtractoH } from "./movimientos-de-cuotas"
import { armarResumenPorMes, hojaResumenPorMes } from "./resumen-por-mes"
import { MOTIVO_EN_CERO } from "./movimientos-de-cuotas"
import { auditarCuota, controlPorTemplate, CENTRADO } from "./auditoria-templates"
import { congelarColumnasEn, pintarFila } from "./formato-excel"

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
    .replace(/Distribuci[oó]n/gi, "Distrib").replace(/Socios/gi, "soc").replace(/Movimientos Internos( empresa)?/gi, "Mov internos").replace(/\s*\/\s*/g, "-")
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

/** 🔍 Para el orden del H para auditar: la familia del impuesto (Inmobiliario, Complementario, Red Vial) o el template. */
export function familiaDe(concepto: string): string {
  const n = concepto.toLowerCase()
  if (/complementario/.test(n)) return "2 Inmobiliario Complementario"
  if (/inmobiliario/.test(n)) return "1 Inmobiliario"
  if (/red vial/.test(n)) return "3 Red Vial"
  return `9 ${concepto}`
}
/** …y la partida (Casco, Lima, Tapera 1…): el nombre sin la familia ni «cuota» / «anual». */
export const partidaDe = (concepto: string) => concepto.replace(/inmobiliario|complementario|red vial|cuota|anual/gi, "").replace(/\s+/g, " ").trim()
/**
 * 🔍 JMS 09/11 (D1.2 «siempre mostrar agrupadas»): el renglón del RESUMEN del H para auditar — impuesto → establecimiento → partida
 * («Inmobiliario — Nazarenas — Casco», «Inmobiliario — Lima», «Red Vial — Rojas»); fuera de los impuestos, el template.
 */
export function renglonAuditoria(concepto: string, establecimientoDe?: (partida: string) => string): string {
  const fam = familiaDe(concepto)
  if (fam.startsWith("9 ")) return concepto
  const partida = partidaDe(concepto), est = establecimientoDe?.(partida) || partida
  return [fam.slice(2), est, est !== partida ? partida : ""].filter(Boolean).join(" — ")
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
  /** 🔎 A-FEAT-1518: el extracto del ejercicio, para el control 4 (desde el extracto). Sin esto, el control no se hace y se dice. */
  extracto?: ExtractoParaH
  /** 🔍 A-FEAT-1579: el H PARA AUDITAR — cada cuota suma Quién pagó · Código contable · Efecto · Marca (después de Débito y Crédito). */
  auditoria?: boolean
  /** 🔍 JMS 09/11: el ESTABLECIMIENTO de cada partida (Nazarenas, Rojas, Lima…) — de `public.partidas`; sin dato, la partida misma. */
  establecimientoDe?: (partida: string) => string
}

/** Las columnas de «Por mes» (ver `hojaTemplatesPorMes`): B = agrupadora, C = categoría, P = TOTAL (12 meses desde la D). */
const POR_MES = { agrupadora: "B", categoria: "C", total: "P" }
/** Cómo se rotula en «Por mes» el grupo sin agrupadora (`SIN_AGRUPADORA` de templates-libro). */
const SIN_AGRUPADORA_POR_MES = "(sin agrupadora en el template)"
const ESTADOS_SIN_PAGAR = ["pendiente", "pagar", "preparado"]
/** 📗 A-FEAT-1539: sin pago en el ejercicio = pendiente (o a pagar), o una cuota en $ 0 (no se pagó nada). */
export const cuotaSinPago = (c: CuotaTemplate) => ESTADOS_SIN_PAGAR.includes((c.estado || "").toLowerCase()) || Math.abs(c.monto) < 0.005

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
  /**
   * 📗 A-FEAT-1539 (JMS 04/11: *«en general siempre segmentalo por banco, así uno puede seguir una lógica al leer, y por fecha»*):
   * cada línea del resumen es categoría × banco, y el detalle va por banco y por fecha. Lo que no tiene pago (pendiente, en
   * $ 0, sin movimiento) queda como su propio segmento, «sin pago», al final. Sin subtítulos (*«borrar subtítulos en todo el libro»*).
   */
  const bancoDe = (c: CuotaTemplate) => cuotaSinPago(c) ? "" : (c.banco?.cuenta || "pagado sin movimiento del banco")
  const { filas: h, ubicacion: u } = armarResumenPorMes(g.cuotas.map(c => ({
    categoria: opciones.auditoria ? renglonAuditoria(c.concepto, opciones.establecimientoDe) : `${c.categ || "(sin categoría)"} — ${bancoDe(c) || "sin pago"}`, mes: (c.fecha ?? "").slice(0, 7), importe: c.monto,
    // 🔍 JMS 09/11 (auditar): por IMPUESTO → PARTIDA → FECHA (Inmobiliario partida por partida, Complementario aparte, Red Vial partida por
    // partida); fuera de los impuestos, por template y fecha. El H del contador sigue por banco y fecha (04/11).
    orden: opciones.auditoria ? `${familiaDe(c.concepto)}|${renglonAuditoria(c.concepto, opciones.establecimientoDe)}|${c.fecha ?? ""}|${c.concepto}` : `${bancoDe(c) ? "0" + bancoDe(c) : "1"}|${c.fecha ?? ""}|${c.concepto}`,
    columnas: [dmy(c.fecha), c.concepto, bancoDe(c) || "sin pago", c.banco?.comprobante ?? "",
      c.proveedor || c.banco?.cuenta || "", c.detalle ?? "", c.estado,
      ...(opciones.auditoria ? (a => [a.quienPago, a.codigo, a.efecto, CENTRADO(a.marca), a.descripcion, a.beneficiario, a.factura, a.interno])(auditarCuota(c)) : [])],
  })), {
    titulo: `${g.agrupadora.toUpperCase()} — ${g.responsable} — ejercicio ${etiqueta}`,
    meses, encabezadoDetalle: ["Fecha", "Concepto", "Banco / cuenta", "Comprobante", "Proveedor", "Detalle", "Estado",
      ...(opciones.auditoria ? ["Quién pagó", "Código contable", "Efecto", "Marca", "Descripción del banco", "Beneficiario / CUIT", "Factura vinculada", "Interno"] : [])],
    debeHaber: true, ...(opciones.auditoria ? { importeEn: 7,
      // 🔍 JMS 09/11: subtotal por establecimiento cuando tiene varias partidas (Nazarenas); Lima y Rojas, partida única, no
      subtotalDe: (cat: string) => { const p = cat.split(" — "); return p.length === 3 ? `${p[0]} — ${p[1]}` : null } } : {}),
  })
  if (!u.celdaTotal || !u.colDebito || !u.colCredito) return { filas: h, celdaTotal: u.celdaTotal }

  const deb = `${u.colDebito}${u.det1}:${u.colDebito}${u.detN}`, cred = `${u.colCredito}${u.det1}:${u.colCredito}${u.detN}`
  const est = `${u.colDetalle(6)}${u.det1}:${u.colDetalle(6)}${u.detN}`
  const netoSi = (estado: string) => `SUMIFS(${deb},${est},"${estado}")-SUMIFS(${cred},${est},"${estado}")`
  const total = r2(g.cuotas.reduce((t, c) => t + c.monto, 0))
  // 🔍 JMS 09/11 (auditar): el control 3 cuenta toda cuota CON MOVIMIENTO del banco, también las «anterior» (antes sólo «conciliado»)
  const conciliadas = g.cuotas.filter(c => opciones.auditoria ? !cuotaSinPago(c) && !!c.banco?.cuenta : /^conciliad/i.test(c.estado))
  const conciliado = r2(conciliadas.reduce((t, c) => t + c.monto, 0))
  const sinPagar = r2(g.cuotas.filter(c => ESTADOS_SIN_PAGAR.includes(c.estado.toLowerCase())).reduce((t, c) => t + c.monto, 0))
  const miroBanco = g.cuotas.some(c => c.banco !== undefined)
  const respaldo = r2(conciliadas.reduce((t, c) => t + (c.banco?.respaldo ?? 0), 0))
  /** El veredicto, con el valor ya calculado (el que se ve si Excel no recalcula al abrir). */
  const ok = (dif: string, valor: number, siNo: string) => ({ t: "s", f: `IF(ABS(${dif})<0.005,"✓ cierra","${siNo}")`, v: Math.abs(valor) < 0.005 ? "✓ cierra" : siNo })
  const fila = () => h.length + 1

  // 🔍 JMS 09/11: «Por efecto» y «Por establecimiento» van como TERCERA tabla — después del detalle y antes del control
  if (opciones.auditoria) {
    const lit = (x: string) => x.replace(/[~*?]/g, m => `~${m}`).replace(/"/g, "\"\"")
    // 🔍 JMS 09/11 (punto 4): el SUBTOTAL POR EFECTO — quién pagó lo de esta agrupadora (fórmulas sobre la columna Efecto)
    const cE = `${u.colDetalle(9)}${u.det1}:${u.colDetalle(9)}${u.detN}`
    const porEfecto = new Map<string, number>()
    for (const c of g.cuotas) { const e = auditarCuota(c).efecto; porEfecto.set(e, r2((porEfecto.get(e) ?? 0) + c.monto)) }
    h.push([], ["", "POR EFECTO — quién pagó lo de esta agrupadora"], ["", "Efecto", "Total"].map(x => x ? CENTRADO(x) : x))
    for (const [e, v] of [...porEfecto].sort((a, b) => a[0].localeCompare(b[0], "es")))
      h.push(["", e, { t: "n", f: `SUMIFS(${deb},${cE},"${lit(e)}")-SUMIFS(${cred},${cE},"${lit(e)}")`, v }])
    h.push(["", "= Total de la solapa", { t: "n", f: `SUM(${deb})-SUM(${cred})`, v: total }])
    // 🔍 JMS 09/11 (D1.2 «siempre mostrar agrupadas»): POR ESTABLECIMIENTO — cada impuesto en cada establecimiento (Nazarenas, Lima,
    // Rojas…), sumando los renglones del resumen de arriba
    const iEnc = h.findIndex(r => Array.isArray(r) && r[0] === "Nro" && r[1] === "Categoría")
    const imp = g.cuotas.filter(c => !familiaDe(c.concepto).startsWith("9 "))
    if (iEnc >= 0 && imp.length) {
      const enc = h[iEnc] as unknown[], colTot = String.fromCharCode(65 + enc.indexOf("TOTAL"))
      // hasta el TOTAL del resumen (los renglones «Subtotal …» no empiezan igual: el SUMIF no los toma)
      let fin = iEnc + 1
      while (fin < h.length && (h[fin] as unknown[])?.[1] !== "TOTAL") fin++
      const rango = (col: string) => `$${col}$${iEnc + 2}:$${col}$${fin}`
      const porEst = new Map<string, number>()
      for (const c of imp) {
        const k = renglonAuditoria(c.concepto, opciones.establecimientoDe).split(" — ").slice(0, 2).join(" — ")
        porEst.set(k, r2((porEst.get(k) ?? 0) + c.monto))
      }
      h.push([], ["", "POR ESTABLECIMIENTO — cada impuesto, por establecimiento (suma los renglones del resumen de arriba)"],
        ["", "Impuesto — establecimiento", "Total"].map(x => x ? CENTRADO(x) : x))
      for (const [k, v] of [...porEst].sort((a, b) => a[0].localeCompare(b[0], "es")))
        h.push(["", k, { t: "n", f: `SUMIF(${rango("B")},"${lit(k)}*",${rango(colTot)})`, v }])
    }
  }
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
  const colBanco = `${u.colDetalle(2)}${u.det1}:${u.colDetalle(2)}${u.detN}`
  const conMovimiento = `SUMIFS(${deb},${colBanco},"<>sin pago",${colBanco},"<>pagado sin movimiento del banco")-SUMIFS(${cred},${colBanco},"<>sin pago",${colBanco},"<>pagado sin movimiento del banco")`
  h.push(["", "3 · Contra el banco", opciones.auditoria ? "Con movimiento del banco (según las cuotas, también «anterior»)" : "Conciliado (según las cuotas)",
    { t: "n", f: opciones.auditoria ? conMovimiento : netoSi("conciliado"), v: conciliado }])
  if (miroBanco) {
    h.push(["", "", "Lo que respaldan los movimientos del banco", respaldo])
    h.push(["", "", "Diferencia", { t: "n", f: `D${r3}-D${r3 + 1}`, v: r2(conciliado - respaldo) }, ok(`D${r3}-D${r3 + 1}`, r2(conciliado - respaldo), "⚠️ no cierra: ver los casos abajo")])
  } else {
    h.push(["", "", "No se leyó el banco: este control no se hizo", ""])
  }
  if (opciones.tablasSinLeer?.length) h.push(["", "", `⚠️ No se pudieron leer: ${opciones.tablasSinLeer.join(", ")}`])
  const rP = fila()
  h.push(["", "", opciones.auditoria ? "Pagado sin movimiento del banco" : "Pagado sin banco (anterior, pagado, débito…)", { t: "n", f: `D${r1 + 1}-D${r3}-D${rP + 1}`, v: r2(total - conciliado - sinPagar) }])
  h.push(["", "", "Sin pagar al cierre (pendiente, a pagar, preparado)", { t: "n", f: ESTADOS_SIN_PAGAR.map(netoSi).join("+"), v: sinPagar }])
  h.push(["", "", "= Total de la solapa", { t: "n", f: `D${r3}+D${rP}+D${rP + 1}`, v: total }])

  // Primero los que mueven plata; las conciliadas en $ 0 sin movimiento, al final (no cambian el control).
  h.push(...control4(g, opciones, fila()))

  const casos = g.cuotas.filter(c => c.banco?.motivo)
    .sort((a, b) => Number(a.banco!.motivo === MOTIVO_EN_CERO) - Number(b.banco!.motivo === MOTIVO_EN_CERO))
  if (casos.length) {
    h.push([], ["", "Casos que no cierran con el banco", "Fecha", "Template", "Cuota", "Respalda el banco", "Diferencia", "Por qué"])
    for (const c of casos) {
      const rb = c.banco!.respaldo
      h.push(["", "", dmy(c.fecha), c.concepto, c.monto, rb ?? "", rb === null ? "" : r2(c.monto - rb), c.banco!.motivo])
    }
  }
  // 🔍 A-FEAT-1579: en el H para auditar, un renglón por template al pie (¿se pagaron todas sus cuotas?)
  if (opciones.auditoria) {
    congelarColumnasEn(h, 4)  // Nro · Mes · Fecha · Concepto quedan a la vista al ir a la derecha (Marca y el contexto)
    // 🎨 JMS 09/11 (B3): las cuotas 🔴 sin pagar, con el renglón entero en rojo suave
    h.forEach((r, i) => { if (i >= u.det1 - 1 && i <= u.detN - 1 && Array.isArray(r) && r.some(x => String((x as { v?: unknown })?.v ?? x ?? "").startsWith("🔴"))) pintarFila(h, i, "FFFBE4E4") })
    const cC = `${u.colDetalle(1)}${u.det1}:${u.colDetalle(1)}${u.detN}`
    const lit = (x: string) => x.replace(/[~*?]/g, m => `~${m}`).replace(/"/g, "\"\"")
    h.push(...controlPorTemplate(g.cuotas, u.colDetalle(1), u.colDetalle(10), u.det1, u.detN,
      t => `SUMIFS(${deb},${cC},"${lit(t)}")-SUMIFS(${cred},${cC},"${lit(t)}")`, h.length + 1))
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

const fmtFecha = (f: string) => f.split("-").reverse().join("/")
const normCateg = (c: string) => c.trim().toLowerCase()

/**
 * 🔎 A-FEAT-1518 — **control 4 · desde el extracto**: los movimientos de las cuentas DE ESTE RESPONSABLE con las categorías de
 * esta solapa, y a qué quedó atado cada uno. ⚠️ si pagó algo de otra empresa (por cuenta y orden) o no está atado a nada;
 * ℹ️ si está en otra solapa o pagó una factura (ya figura en otro lado). Los valores van en la columna D, como el resto.
 */
function control4(g: GrupoTemplates, o: OpcionesHojaGrupo, filaInicial: number): unknown[][] {
  const f: unknown[][] = []
  if (!o.extracto) return [["", "4 · Desde el extracto", "No se leyó el extracto: este control no se hizo", ""]]
  const categs = new Set(g.cuotas.map(c => normCateg(c.categ)).filter(Boolean))
  const propios = new Set(g.cuotas.flatMap(c => [c.id, c.grupoPagoId]).filter((x): x is string => !!x))
  const ms = o.extracto.movimientos.filter(m => m.titular === g.responsable && !m.enDolares && categs.has(normCateg(m.categ)))
  type Clase = "esta" | "otraEmpresa" | "otraSolapa" | "factura" | "nada"
  const clase = (m: (typeof ms)[number]): { c: Clase; a: string } => {
    if (m.templateCuotaId && propios.has(m.templateCuotaId)) return { c: "esta", a: "" }
    const d = m.templateCuotaId ? o.extracto!.destinos.get(m.templateCuotaId) : undefined
    if (d && d.responsable !== g.responsable) return { c: "otraEmpresa", a: `pagó «${d.concepto}» de ${d.responsable}` }
    if (d) return { c: "otraSolapa", a: `está en la solapa «${d.agrupadora || "sin agrupadora"}» («${d.concepto}»)` }
    if (m.templateCuotaId) return { c: "nada", a: "atado a una cuota que no está en el libro (otro ejercicio o desactivada)" }
    if (m.comprobanteArcaId) return { c: "factura", a: "pagó una factura (va por el subdiario)" }
    if (m.otroVinculo) return { c: "factura", a: "pagó un sueldo, cobró una venta o es un anticipo (va por su papel)" }
    return { c: "nada", a: "sin template ni factura" }
  }
  const neto = (xs: typeof ms) => r2(xs.reduce((t, m) => t + m.debitos - m.creditos, 0))
  const porClase = new Map<Clase, { m: (typeof ms)[number]; a: string }[]>()
  for (const m of ms) { const k = clase(m); porClase.set(k.c, [...(porClase.get(k.c) ?? []), { m, a: k.a }]) }
  const de = (c: Clase) => (porClase.get(c) ?? []).map(x => x.m)
  const r = filaInicial
  f.push(["", "4 · Desde el extracto", `Movimientos de las cuentas de ${g.responsable} con las categorías de esta solapa (${ms.length})`, neto(ms)])
  f.push(["", "", "  − atados a cuotas de esta solapa", neto(de("esta"))])
  f.push(["", "", "  − pagaron algo de OTRA empresa (por cuenta y orden) — a mirar", neto(de("otraEmpresa"))])
  f.push(["", "", "  − sin template ni factura — a mirar", neto(de("nada"))])
  f.push(["", "", "  − están en otra solapa de este libro (ya figuran)", neto(de("otraSolapa"))])
  f.push(["", "", "  − pagaron una factura, un sueldo o un anticipo (ya figuran en su papel)", neto(de("factura"))])
  const avisos = (porClase.get("otraEmpresa")?.length ?? 0) + (porClase.get("nada")?.length ?? 0)
  const v = avisos ? `⚠️ ${avisos} movimiento(s) para mirar: ver la lista abajo` : "✓ cierra"
  f.push(["", "", "= Diferencia (tiene que dar 0)", { t: "n", f: `D${r}-SUM(D${r + 1}:D${r + 5})`, v: 0 }, { t: "s", v }])
  if (o.extracto.tablasQueFallaron.length) f.push(["", "", `⚠️ No se pudieron leer: ${o.extracto.tablasQueFallaron.join(", ")}`])
  const lista = (["otraEmpresa", "nada", "otraSolapa", "factura"] as Clase[]).flatMap(c => porClase.get(c) ?? [])
  if (lista.length) {
    f.push([], ["", "Movimientos del extracto que no están en esta solapa", "Fecha", "Cuenta", "Descripción del banco", "Importe", "Adónde fue"])
    for (const x of lista) f.push(["", "", fmtFecha(x.m.fecha), x.m.cuenta, x.m.descripcion, r2(x.m.debitos - x.m.creditos), x.a])
  }
  return f
}

/**
 * 🔎 A-FEAT-1518 (02/11) — la solapa de lo que el extracto tiene SIN categoría ni vínculo, de un responsable: no entra en ningún
 * control por categoría del libro, así que se muestra aparte (resumen por cuenta y por mes, y abajo cada movimiento). Es lo que
 * falta conciliar. Caso que la originó: los 12 pagos de la VISA de MSA del histórico (script 175).
 */
export function hojaExtractoSinCategoria(ms: MovimientoExtractoH[], responsable: string, etiqueta: string,
  meses: { clave: string; rotulo: string }[] = []): unknown[][] {
  return hojaResumenPorMes(ms.map(m => ({
    categoria: m.cuenta, mes: m.fecha.slice(0, 7), importe: m.debitos - m.creditos, moneda: m.enDolares ? "USD" as const : "ARS" as const,
    columnas: [fmtFecha(m.fecha), m.descripcion, m.estado],
  })), {
    titulo: `EXTRACTO SIN CATEGORÍA NI VÍNCULO — cuentas de ${responsable} — ejercicio ${etiqueta}`,
    notas: ["Movimientos del banco sin categoría y sin cuota, factura, sueldo, venta ni anticipo: no entran en ningún control del libro.",
      "Es lo que falta conciliar (el histórico jul-25 → ene-26 se cargó así). Por cuenta y por mes; abajo cada movimiento."],
    meses, encabezadoDetalle: ["Fecha", "Descripción del banco", "Estado"], debeHaber: true, porMoneda: true,
  })
}
