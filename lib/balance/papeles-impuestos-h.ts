/**
 * 🏛️ **LIBRO H — el papel de INMOBILIARIO, RED VIAL y AUTOMOTORES, con su control cruzado** (A-FEAT-1516, JMS 01/11).
 *
 * JMS: *«tenemos en egresos, en templates, la planilla de impuestos… de ahí la planilla de inmobiliario, red vial y automotor.
 * Ese Excel debería también descargarse en este momento como una planilla de detalle adjunta… van a estar duplicadas las
 * planillas, con exposiciones diferentes, pero van a tener que cancelarse entre sí y dar lo mismo para los períodos que entran
 * en el balance»*.
 *
 * Por responsable, una solapa por impuesto con **los dos años calendario del ejercicio enteros** (decisión de JMS 01/11), tal
 * cual el papel de la app, con la estética de la planilla de JMS (`hojaPapelJms`: el mismo armado del botón «Excel»). Al pie, el CONTROL:
 *
 * | | Qué suma | Por qué fecha |
 * |---|---|---|
 * | **Papel** | las cuotas del papel de este responsable | **vencimiento** — dentro del ejercicio |
 * | **Templates** | las mismas categorías en las solapas de agrupadora | **pago** (o estimada) — dentro del ejercicio |
 *
 * Tienen que dar lo mismo. Si no, es una **discrepancia que se explica** (§ 🚦 avisa, no frena): una cuota que vence en junio y
 * se pagó en julio cae en un lado y no en el otro. Por eso se listan una por una, con su vencimiento y su pago.
 *
 * Pura: recibe las cuotas de impuestos (las de la planilla), sus auxiliares y las cuotas del responsable en el libro H.
 */
import type { CuotaTemplate } from "./templates-libro"
import { responsablePrincipal } from "./libros-del-balance"
import type { CuotaPlanilla } from "@/lib/impuestos/planilla"
import type { AuxiliaresPapel } from "@/lib/impuestos/datos-papel"
import { armarPapel, papelDeTemplate, vencimientoEnPapel, type Papel, type TipoPapel } from "@/lib/impuestos/papel-inmobiliario"
import { hojaPapelJms, type HojaConEstilo, type CeldaCuotaPapel, type RangoCuotasPapel } from "@/lib/impuestos/papel-formato-jms"
import { hoyArgentina } from "@/lib/fechas"

export interface DatosPapelesH extends AuxiliaresPapel {
  cuotas: CuotaPlanilla[]
  /** ✍️ A-FEAT-1207: lo que el balance anterior dejó para tomar como gasto de éste (pagos anuales adelantados), de `public.ajustes_balance`. */
  saldosAnteriores?: SaldoAnteriorH[]
}

/** Un saldo del ejercicio anterior (accion = saldo_anterior, vigente). */
export interface SaldoAnteriorH { empresa: string; concepto: string; categ: string; monto: number; motivo: string }

const IMPAGOS = new Set(["pendiente", "pagar", "preparado", "programado"])
const MONEDA_H = "#,##0.00;[Red]-#,##0.00;\"-\""
const N = (v: number) => ({ t: "n", v: r2(v), z: MONEDA_H })
const F = (f: string, v: number) => ({ t: "n", f, v: r2(v), z: MONEDA_H })
const NEGRITA = { font: { bold: true } }
const B = (v: string) => ({ t: "s", v, s: NEGRITA })

export interface SolapaPapelH { nombre: string; hoja: HojaConEstilo }


const TIPOS: TipoPapel[] = ["inmobiliario", "red-vial", "automotores"]
const CORTO: Record<TipoPapel, string> = { inmobiliario: "Inmobiliario", "red-vial": "Red Vial", automotores: "Automotores" }
const r2 = (n: number) => Math.round(n * 100) / 100
const dmy = (f: string | null | undefined) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")

/** El papel de un año con sólo los bloques de este responsable (el papel va por empresa del template). */
function delResponsable(p: Papel, resp: string): Papel {
  const bloques = p.bloques.filter(b => responsablePrincipal(b.empresa) === resp)
  return {
    ...p, bloques,
    total: r2(bloques.reduce((s, b) => s + b.total, 0)),
    totalAnterior: r2(bloques.reduce((s, b) => s + b.totalAnterior, 0)),
    maxCuotas: Math.max(0, ...bloques.flatMap(b => b.filas.map(f => f.cuotas.length))),
  }
}

/**
 * Las solapas de papel de un responsable. `mesesEjercicio` son las claves `AAAA-MM` del ejercicio; `cuotasH`, las cuotas de ese
 * responsable en el libro H (las de sus solapas de agrupadora). Sin cuotas de un impuesto, no hay solapa.
 */
export function solapasPapelesH(d: DatosPapelesH, resp: string, mesesEjercicio: string[], cuotasH: CuotaTemplate[]): SolapaPapelH[] {
  const enEjercicio = new Set(mesesEjercicio)
  const anios = [...new Set(mesesEjercicio.map(m => Number(m.slice(0, 4))))].sort()
  const out: SolapaPapelH[] = []
  for (const tipo of TIPOS) {
    const papeles = anios.map(a => delResponsable(armarPapel(tipo, d.cuotas as never, a, d.tcs, d.hectareas, d.cuentasRedVial), resp))
    if (papeles.every(p => p.bloques.length === 0)) continue
    // 🎨 02/11: con la estética de la planilla de JMS («la estética está perfecta»), los años apilados y al pie el control cruzado.
    // ✍️ JMS 11/11: arriba el saldo del ejercicio anterior, después la planilla, después la totalización (con fórmulas) y al final el control
    const saldos = saldosDelPapel(d, tipo, resp)
    const arriba = bloqueSaldoAnterior(saldos, resp, tipo)
    const ultimoMes = mesesEjercicio[mesesEjercicio.length - 1]
    const finEj = new Date(Date.UTC(+ultimoMes.slice(0, 4), +ultimoMes.slice(5, 7), 0)).toISOString().slice(0, 10)
    const hoja = hojaPapelJms(papeles, d.ubicacion ?? {}, hoyArgentina(), [], { paraH: true, antes: arriba.filas, ejercicio: { desde: `${mesesEjercicio[0]}-01`, hasta: finEj } })
    const rec = recuadroDelEjercicio(d, resp, tipo, mesesEjercicio, hoja.filas.length + 1, hoja.celdas, hoja.rangos, arriba.filaTotal, r2(saldos.reduce((a, x) => a + x.monto, 0)))
    hoja.filas.push(...rec.filas)
    const filaControl = hoja.filas.length + 1
    hoja.filas.push(...controlCruzado(d.cuotas, tipo, resp, enEjercicio, cuotasH, filaControl))
    // el recuadro se compara con la fila «Papel» del control (filaControl + 1, valor en D)
    rec.chequeo[12] = { t: "s", f: `IF(ABS(${rec.celdaCuotas}-G${filaControl + 1})<0.005,"✓ = «Papel» del control de abajo","⚠️ no da con el control de abajo")`, v: "✓ = «Papel» del control de abajo" }
    out.push({ nombre: `H · ${resp} · Papel ${CORTO[tipo]}`.slice(0, 31), hoja })
  }
  return out
}

/** El control del papel contra las solapas de templates, para los meses del ejercicio. Los valores en la columna D. */
function controlCruzado(cuotas: CuotaPlanilla[], tipo: TipoPapel, resp: string, enEjercicio: Set<string>, cuotasH: CuotaTemplate[], filaInicial: number): unknown[][] {
  // Lado del papel: las cuotas que el papel cuenta (su criterio), de este responsable, con vencimiento en el ejercicio.
  const delPapel = new Map<string, { c: CuotaPlanilla; venc: string }>()
  for (const c of cuotas) {
    if (papelDeTemplate(c.template.categ)?.papel !== tipo || responsablePrincipal(c.template.responsable ?? "") !== resp) continue
    const venc = vencimientoEnPapel(c)
    if (venc && enEjercicio.has(venc.slice(0, 7))) delPapel.set(c.id, { c, venc })
  }
  // Lado de templates: las cuotas de las solapas de agrupadora de esas categorías (ya son las del ejercicio, por fecha de pago).
  const deTemplates = new Map(cuotasH.filter(c => papelDeTemplate(c.categ)?.papel === tipo).map(c => [c.id, c]))
  const totalPapel = r2([...delPapel.values()].reduce((s, x) => s + Number(x.c.monto ?? 0), 0))
  const totalTemplates = r2([...deTemplates.values()].reduce((s, c) => s + c.monto, 0))
  const dif = r2(totalPapel - totalTemplates)
  const porId = new Map(cuotas.map(c => [c.id, c]))

  const casos: unknown[][] = []
  for (const [id, x] of delPapel) {
    const h = deTemplates.get(id)
    if (!h) casos.push(["", "", dmy(x.venc), x.c.template.nombre_referencia ?? "", Number(x.c.monto ?? 0), "",
      x.c.fecha_pago ? `vence en el ejercicio y se pagó el ${dmy(x.c.fecha_pago)}, fuera del ejercicio` : "vence en el ejercicio y no está en las solapas de templates"])
    else if (Math.abs(h.monto - Number(x.c.monto ?? 0)) > 0.005) casos.push(["", "", dmy(x.venc), h.concepto, Number(x.c.monto ?? 0), h.monto, "el importe es distinto en un lado y en el otro"])
  }
  for (const [id, h] of deTemplates) {
    if (delPapel.has(id)) continue
    const c = porId.get(id)
    const venc = c ? vencimientoEnPapel(c) : null
    casos.push(["", "", venc ? dmy(venc) : "", h.concepto, "", h.monto,
      venc ? `se pagó el ${dmy(h.fecha)} (en el ejercicio) y vence el ${dmy(venc)}, fuera del ejercicio` : `está en las solapas de templates y no en el papel (estado «${h.estado}» o template dado de baja)`])
  }

  const r = filaInicial + 1
  const veredicto = Math.abs(dif) < 0.005 ? "✓ cierra" : "⚠️ no cierra: ver los casos abajo (se explican por las fechas)"
  const f: unknown[][] = [
    ["", { t: "s", v: `CONTROL — el papel contra las solapas de templates, para los meses del ejercicio (${resp})`, s: { font: { bold: true, sz: 11 } } }],
    ["", "Papel: cuotas que VENCEN en el ejercicio", "", "", "", "", N(totalPapel)],
    ["", "Solapas de templates: las mismas categorías, por fecha de PAGO", "", "", "", "", N(totalTemplates)],
    ["", "Diferencia (tiene que dar 0)", "", "", "", "", { t: "n", f: `G${r}-G${r + 1}`, v: dif, z: MONEDA_H }, "",
      { t: "s", f: `IF(ABS(G${r + 2})<0.005,"✓ cierra","⚠️ no cierra: ver los casos abajo (se explican por las fechas)")`, v: veredicto }],
  ]
  if (casos.length) f.push([], ["", "Casos", "Vencimiento", "Template", "En el papel", "En templates", "Por qué"], ...casos)
  return f
}

/** Los saldos del ejercicio anterior que van con este papel (por la cuenta del ajuste). */
const saldosDelPapel = (d: DatosPapelesH, tipo: TipoPapel, resp: string) =>
  (d.saldosAnteriores ?? []).filter(s => responsablePrincipal(s.empresa) === resp && papelDeTemplate(s.categ)?.papel === tipo)

const RESALTE = { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "FFFFE699" } } }
const TIT = (v: string) => ({ t: "s", v, s: { font: { bold: true, sz: 12 } } })
const ENC = (v: string) => ({ t: "s", v, s: { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "FFB7DEE8" } }, alignment: { horizontal: "center" } } })

/**
 * ✍️ JMS 11/11 («antes mencionar lo anterior, luego va el cuadro y luego va la totalización»): ARRIBA del papel, el saldo que dejó el
 * balance anterior (pago anual adelantado) — resaltado y con su total. Valores en G. Devuelve las filas y dónde quedó el total.
 */
function bloqueSaldoAnterior(saldos: SaldoAnteriorH[], resp: string, tipo: TipoPapel): { filas: unknown[][]; filaTotal: number | null } {
  // 🎨 JMS 11/11: tres secciones de IGUAL peso (saldo anterior · año 1 · año 2): el título del mismo tamaño que «INMOBILIARIO 2025», la
  // explicación como subtítulo, y una tablita SIN colores (negrita y bordes finos) — «así no funciona… se ve raro y feo»
  const fino = { style: "thin", color: { rgb: "FFA6A6A6" } }
  const borde = { top: fino, bottom: fino, left: fino, right: fino }
  // 🎨 JMS 11/11 (lo pintó así en el v12): encabezado salmón claro, conceptos en negrita, el TOTAL salmón fuerte con «A tomar en este Balance como gasto»
  const SALMON = { patternType: "solid", fgColor: { rgb: "FFFCE4D6" } }, SALMON_F = { patternType: "solid", fgColor: { rgb: "FFF8CBAD" } }
  const txt = (v: string, extra: Record<string, unknown> = {}, fill?: object) => ({ t: "s", v, s: { font: { name: "Calibri", sz: 10, ...((extra.font as object) ?? {}) }, border: borde, ...(fill ? { fill } : {}) } })
  const mon = (f: string, v: number, negrita = false, fill?: object) => ({ t: "n", f, v: r2(v), z: MONEDA_H, s: { font: { name: "Calibri", sz: 10, bold: negrita }, numFmt: MONEDA_H, border: borde, ...(fill ? { fill } : {}) } })
  const f: unknown[][] = [[null, { t: "s", v: "SALDO DEL EJERCICIO ANTERIOR", s: { font: { name: "Calibri", bold: true, sz: tipo === "inmobiliario" ? 20 : 18 } } }],
    [null, { t: "s", v: `${resp} — gasto que viene del balance anterior (pago anual adelantado) y se toma en ESTE ejercicio`, s: { font: { name: "Calibri", italic: true, sz: 11 } } }], []]
  if (!saldos.length) { f.push([null, "No hay saldo del ejercicio anterior para este impuesto."], [], []); return { filas: f, filaTotal: null } }
  f.push([null, txt("Concepto", { font: { bold: true } }, SALMON), txt("", {}, SALMON), txt("", {}, SALMON), txt("", {}, SALMON), txt("", {}, SALMON), txt("Saldo anterior", { font: { bold: true } }, SALMON), txt("", {}, SALMON), txt("De dónde sale", { font: { bold: true } }, SALMON)])
  const s0 = f.length + 1
  for (const sa of saldos) f.push([null, txt(sa.concepto, { font: { bold: true } }), txt(""), txt(""), txt(""), txt(""), { t: "n", v: r2(sa.monto), z: MONEDA_H, s: { font: { name: "Calibri", sz: 10, bold: true }, numFmt: MONEDA_H, border: borde } }, txt(""), txt(`${sa.motivo} — cargado en el sistema (ajustes del balance)`, { font: { italic: true, sz: 9 } })])
  const filaTotal = f.length + 1
  f.push([null, txt("TOTAL saldo del ejercicio anterior", { font: { bold: true } }, SALMON_F), txt("", {}, SALMON_F), txt("", {}, SALMON_F), txt("", {}, SALMON_F), txt("", {}, SALMON_F),
    mon(`SUM(G${s0}:G${filaTotal - 1})`, saldos.reduce((a, x) => a + x.monto, 0), true, SALMON_F), txt("", {}, SALMON_F), { t: "s", v: "A tomar en este Balance como gasto", s: { font: { name: "Calibri", sz: 10 } } }])
  f.push([], [])
  return { filas: f, filaTotal }
}

/**
 * 🧾 JMS 11/11 (sobre el papel del inmobiliario: «hay que hacer una distinción de lo que es la planilla entera a lo que se manda al
 * ejercicio… un recuadro debajo: MSA 2do sem 2025 tanto, 1er sem 2026 tanto, total tanto, dejando afuera las cuotas post cierre, que
 * quedarían sólo de forma informativa. Pero ojo con lo que no está pago aún» · «sin fórmulas ojo… la idea es que estén las fórmulas a la
 * vista: hago doble clic y veo de dónde sale»). Por VENCIMIENTO (el criterio del papel), TODO con fórmulas sobre las cuotas de la planilla
 * de arriba: el total de cada semestre con SUMAR.SI.CONJUNTO por la fecha de vencimiento, lo sin pagar apuntando a cada cuota y lo pagado
 * como la resta. Después el saldo anterior (el bloque de arriba) y el COSTO PARA ESTE BALANCE. Valores en G (pagado) · I (sin pagar) · K (total).
 */
function recuadroDelEjercicio(d: DatosPapelesH, resp: string, tipo: TipoPapel, meses: string[], filaInicial: number, celdas: CeldaCuotaPapel[], rangos: RangoCuotasPapel[],
  filaTotalSaldo: number | null, totalSaldo: number): { filas: unknown[][]; celdaCuotas: string; chequeo: unknown[] } {
  const primero = meses[0], ultimo = meses[meses.length - 1]
  const finDeMes = (m: string) => { const [a, mm] = m.split("-").map(Number); return new Date(Date.UTC(a, mm, 0)).toISOString().slice(0, 10) }
  const DATE = (f: string) => `DATE(${+f.slice(0, 4)},${+f.slice(5, 7)},${+f.slice(8, 10)})`
  /** La suma de las cuotas del papel que vencen entre dos fechas, con fórmula (todas las columnas de cuotas de todos los años). */
  const sumaEntre = (desde: string | null, hasta: string | null) => rangos.flatMap(rg => rg.pares.map(([a, v]) => {
    const A = `${a}${rg.desde}:${a}${rg.hasta}`, V = `${v}${rg.desde}:${v}${rg.hasta}`
    return `SUMIFS(${A},${V},"<>"${desde ? `,${V},">="&${DATE(desde)}` : ""}${hasta ? `,${V},"<="&${DATE(hasta)}` : ""})`
  })).join("+") || "0"
  const entre = (x: CeldaCuotaPapel, desde: string | null, hasta: string | null) => (!desde || x.vencimiento >= desde) && (!hasta || x.vencimiento <= hasta)
  const impaga = (x: CeldaCuotaPapel) => IMPAGOS.has(String(x.estado).toLowerCase())
  const nombre = new Map(d.cuotas.map(c => [c.id, c.template.nombre_referencia ?? ""]))
  // los semestres del ejercicio, por sus meses
  const sems: { rotulo: string; desde: string; hasta: string }[] = []
  for (const m of meses) {
    const rot = Number(m.slice(5, 7)) >= 7 ? `2do sem ${m.slice(0, 4)} (jul–dic)` : `1er sem ${m.slice(0, 4)} (ene–jun)`
    const s = sems.find(x => x.rotulo === rot)
    if (s) s.hasta = finDeMes(m); else sems.push({ rotulo: rot, desde: `${m}-01`, hasta: finDeMes(m) })
  }
  const out: unknown[][] = []
  const r = () => filaInicial + out.length
  // 🎨 JMS 11/11 («quedó medio feo»): una sección más, como el saldo anterior y los años — título del mismo tamaño, subtítulo, y una
  // tablita sin colores: negrita y bordes finos; el costo del balance con la doble raya de los totales del papel.
  const fino = { style: "thin", color: { rgb: "FFA6A6A6" } }, borde = { top: fino, bottom: fino, left: fino, right: fino }
  const conBorde = (x: unknown, negrita = false, extra: Record<string, unknown> = {}) => {
    if (x === "" || x == null) return { t: "s", v: "", s: { border: borde, ...extra } }
    if (typeof x === "string") return { t: "s", v: x, s: { font: { name: "Calibri", sz: 10, bold: negrita }, border: borde, ...extra } }
    const o = x as { s?: Record<string, unknown>; z?: string }
    return { ...o, s: { ...(o.s ?? {}), font: { name: "Calibri", sz: 10, bold: negrita || !!(o.s?.font as { bold?: boolean } | undefined)?.bold }, border: borde, ...(o.z ? { numFmt: o.z } : {}), ...extra } }
  }
  const fila = (etiqueta: unknown, g: unknown, i: unknown, k: unknown, nota: unknown = "", negrita = false) =>
    out.push(["", conBorde(etiqueta, negrita), conBorde(""), conBorde(""), conBorde(""), conBorde(""), conBorde(g, negrita), conBorde(""), conBorde(i, negrita), conBorde(""), conBorde(k, negrita), "", nota])
  out.push([], [], ["", { t: "s", v: "LO QUE VA AL EJERCICIO", s: { font: { name: "Calibri", bold: true, sz: tipo === "inmobiliario" ? 20 : 18 } } }],
    ["", { t: "s", v: `${resp} — por vencimiento, como el papel: lo que entra en este balance. El resto de la planilla es informativo.`, s: { font: { name: "Calibri", italic: true, sz: 11 } } }], [])
  fila("", "Pagado", "Sin pagar", "Total", "", true)
  const s0 = r()
  for (const s of sems) {
    const n = r()
    const xs = celdas.filter(x => entre(x, s.desde, s.hasta))
    const sin = xs.filter(impaga)
    const vTot = r2(xs.reduce((a, x) => a + x.monto, 0)), vSin = r2(sin.reduce((a, x) => a + x.monto, 0))
    fila(s.rotulo, F(`K${n}-I${n}`, vTot - vSin), F(sin.length ? sin.map(x => x.monto_dir).join("+") : "0", vSin), F(sumaEntre(s.desde, s.hasta), vTot))
  }
  const sN = r() - 1, nC = r()
  const tot = (c: string) => celdas.filter(x => entre(x, `${primero}-01`, finDeMes(ultimo)))
  const vT = r2(tot("").reduce((a, x) => a + x.monto, 0)), vS = r2(tot("").filter(impaga).reduce((a, x) => a + x.monto, 0))
  fila("= Cuotas del ejercicio", F(`SUM(G${s0}:G${sN})`, vT - vS), F(`SUM(I${s0}:I${sN})`, vS), F(`SUM(K${s0}:K${sN})`, vT), "", true)
  const chequeo = out[out.length - 1]
  const nS = r()
  fila("+ Saldo del ejercicio anterior (el bloque de arriba)", filaTotalSaldo ? F(`G${filaTotalSaldo}`, totalSaldo) : N(0), "", F(`G${nS}+I${nS}`, totalSaldo),
    filaTotalSaldo ? "" : "no hay saldo del ejercicio anterior para este impuesto")
  const nB = r()
  const medio = { style: "medium", color: { rgb: "FF000000" } }, doble = { style: "double", color: { rgb: "FF000000" } }
  const totC = (x: Record<string, unknown>) => ({ ...x, s: { font: { name: "Calibri", sz: 10, bold: true }, numFmt: MONEDA_H, border: { ...borde, top: medio, bottom: doble } } })
  out.push(["", { t: "s", v: "= COSTO PARA ESTE BALANCE (saldo anterior + cuotas del ejercicio)", s: { font: { name: "Calibri", sz: 10, bold: true }, border: { ...borde, top: medio, bottom: doble } } },
    "", "", "", "", totC(F(`G${nC}+G${nS}`, vT - vS + totalSaldo)), "", totC(F(`I${nC}`, vS)), "", totC(F(`K${nC}+K${nS}`, vT + totalSaldo))])
  void nB
  const sinPagar = celdas.filter(x => entre(x, `${primero}-01`, finDeMes(ultimo)) && impaga(x)).sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))
  if (sinPagar.length) {
    out.push(["", `🔴 Sin pagar al cierre (${sinPagar.length}): están en el total del ejercicio pero todavía no se pagaron — son deuda.`])
    for (const x of sinPagar) out.push(["", `   ${dmy(x.vencimiento)} · ${x.id ? nombre.get(x.id) ?? "" : ""}`, "", "", "", "", "", "", F(x.monto_dir, x.monto)])
  }
  out.push([], ["", { t: "s", v: "INFORMATIVO — NO va al ejercicio", s: { font: { name: "Calibri", bold: true, sz: 11 } } }])
  const antes = celdas.filter(x => x.vencimiento < `${primero}-01`), despues = celdas.filter(x => x.vencimiento > finDeMes(ultimo))
  const diaAntes = new Date(Date.parse(`${primero}-01`) - 86_400_000).toISOString().slice(0, 10), diaDespues = new Date(Date.parse(finDeMes(ultimo)) + 86_400_000).toISOString().slice(0, 10)
  fila(`Cuotas que vencen ANTES del ejercicio (${antes.length})`, "", "", F(sumaEntre(null, diaAntes), antes.reduce((a, x) => a + x.monto, 0)))
  fila(`Cuotas que vencen DESPUÉS del cierre (${despues.length})`, "", "", F(sumaEntre(diaDespues, null), despues.reduce((a, x) => a + x.monto, 0)))
  out.push([])
  return { filas: out, celdaCuotas: `K${nC}`, chequeo }
}

