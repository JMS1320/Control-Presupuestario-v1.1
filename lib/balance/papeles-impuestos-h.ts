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
import { hojaPapelJms, type HojaConEstilo } from "@/lib/impuestos/papel-formato-jms"
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
    const hoja = hojaPapelJms(papeles, d.ubicacion ?? {}, hoyArgentina(), [], { paraH: true })
    const filaControl = hoja.filas.length + 1
    hoja.filas.push(...controlCruzado(d.cuotas, tipo, resp, enEjercicio, cuotasH, filaControl))
    // 🧾 JMS 11/11: el recuadro de lo que va al ejercicio (la fila «Papel» del control es filaControl + 1, valor en D)
    hoja.filas.push(...recuadroDelEjercicio(d, tipo, resp, mesesEjercicio, hoja.filas.length + 1, filaControl + 1))
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
    [`CONTROL — el papel contra las solapas de templates, para los meses del ejercicio (${resp})`],
    ["", "Papel: cuotas que VENCEN en el ejercicio", "", totalPapel],
    ["", "Solapas de templates: las mismas categorías, por fecha de PAGO", "", totalTemplates],
    ["", "Diferencia (tiene que dar 0)", "", { t: "n", f: `D${r}-D${r + 1}`, v: dif },
      { t: "s", f: `IF(ABS(D${r + 2})<0.005,"✓ cierra","⚠️ no cierra: ver los casos abajo (se explican por las fechas)")`, v: veredicto }],
  ]
  if (casos.length) f.push([], ["", "Casos", "Vencimiento", "Template", "En el papel", "En templates", "Por qué"], ...casos)
  return f
}

/** Los saldos del ejercicio anterior que van con este papel (por la cuenta del ajuste). */
const saldosDelPapel = (d: DatosPapelesH, tipo: TipoPapel, resp: string) =>
  (d.saldosAnteriores ?? []).filter(s => responsablePrincipal(s.empresa) === resp && papelDeTemplate(s.categ)?.papel === tipo)

/**
 * 🧾 JMS 11/11 (sobre el papel del inmobiliario: «hay que hacer una distinción de lo que es la planilla entera a lo que se manda al
 * ejercicio… un recuadro debajo: MSA 2do sem 2025 tanto, 1er sem 2026 tanto, total tanto, dejando afuera las cuotas post cierre, que
 * quedarían sólo de forma informativa. Pero ojo con lo que no está pago aún»). Por VENCIMIENTO (el criterio del papel): lo pagado y lo
 * sin pagar en columnas separadas; después, lo que el balance anterior dejó para este ejercicio (pago anual adelantado) y el GASTO DEL
 * EJERCICIO. Lo que vence fuera del ejercicio va aparte, informativo. Valores en G (pagado) · H (sin pagar) · I (total).
 */
function recuadroDelEjercicio(d: DatosPapelesH, tipo: TipoPapel, resp: string, meses: string[], filaInicial: number, filaPapel: number): unknown[][] {
  const primero = meses[0], ultimo = meses[meses.length - 1]
  const sem = (m: string) => (Number(m.slice(5, 7)) >= 7 ? `2do sem ${m.slice(0, 4)} (jul–dic)` : `1er sem ${m.slice(0, 4)} (ene–jun)`)
  const semestres = [...new Set(meses.map(sem))]
  const tot = new Map(semestres.map(x => [x, { pag: 0, sin: 0 }]))
  const sinPagar: { venc: string; nombre: string; monto: number }[] = []
  let antes = 0, despues = 0, nAntes = 0, nDespues = 0
  for (const c of d.cuotas) {
    if (papelDeTemplate(c.template.categ)?.papel !== tipo || responsablePrincipal(c.template.responsable ?? "") !== resp) continue
    const venc = vencimientoEnPapel(c); if (!venc) continue
    const m = venc.slice(0, 7), monto = Number(c.monto ?? 0)
    if (m < primero) { antes += monto; nAntes++; continue }
    if (m > ultimo) { despues += monto; nDespues++; continue }
    const x = tot.get(sem(m))!
    if (IMPAGOS.has(String(c.estado).toLowerCase())) { x.sin += monto; sinPagar.push({ venc, nombre: c.template.nombre_referencia ?? "", monto }) } else x.pag += monto
  }
  const out: unknown[][] = []
  const fila = (etiqueta: unknown, g: unknown, h: unknown, i: unknown, nota = "") => out.push(["", etiqueta, "", "", "", "", g, "", h, "", i, "", nota])
  const r = () => filaInicial + out.length   // la fila (1-based) del renglón que se va a agregar
  out.push([])
  out.push(["", B(`LO QUE VA AL EJERCICIO — ${resp} (por vencimiento, como el papel). El resto de la planilla es INFORMATIVO.`)])
  fila("", B("Pagado"), B("Sin pagar"), B("Total"))
  const s0 = r()
  for (const x of semestres) { const n = r(), t = tot.get(x)!; fila(x, N(t.pag), N(t.sin), F(`G${n}+I${n}`, t.pag + t.sin)) }
  const sN = r() - 1, nC = r()
  const pag = semestres.reduce((a, x) => a + tot.get(x)!.pag, 0), sin = semestres.reduce((a, x) => a + tot.get(x)!.sin, 0)
  fila(B("= Cuotas del ejercicio"), F(`SUM(G${s0}:G${sN})`, pag), F(`SUM(I${s0}:I${sN})`, sin), F(`SUM(K${s0}:K${sN})`, pag + sin))
  out[out.length - 1][12] = { t: "s", f: `IF(ABS(K${nC}-D${filaPapel})<0.005,"✓ = «Papel» del control de arriba","⚠️ no da con el control de arriba")`, v: "✓ = «Papel» del control de arriba" }
  const saldos = saldosDelPapel(d, tipo, resp)
  const k0 = r()
  for (const sa of saldos) fila(`+ Saldo del ejercicio anterior: ${sa.concepto}`, N(sa.monto), "", F(`G${r()}+I${r()}`, sa.monto), sa.motivo)
  const kN = r() - 1
  const totSaldos = saldos.reduce((a, x) => a + x.monto, 0)
  fila(B("= GASTO DEL EJERCICIO (cuotas + saldo anterior)"), F(saldos.length ? `G${nC}+SUM(G${k0}:G${kN})` : `G${nC}`, pag + totSaldos),
    F(`I${nC}`, sin), F(saldos.length ? `K${nC}+SUM(K${k0}:K${kN})` : `K${nC}`, pag + sin + totSaldos),
    saldos.length ? "" : "sin saldos del ejercicio anterior para este impuesto")
  if (sinPagar.length) {
    out.push(["", `🔴 Sin pagar al cierre (${sinPagar.length}): están en el total del ejercicio pero todavía no se pagaron — son deuda.`])
    for (const x of sinPagar.sort((a, b) => a.venc.localeCompare(b.venc))) out.push(["", `   ${dmy(x.venc)} · ${x.nombre}`, "", "", "", "", "", "", N(x.monto)])
  }
  out.push([])
  out.push(["", B("INFORMATIVO — NO va al ejercicio")])
  fila(`Cuotas que vencen ANTES del ejercicio (${nAntes})`, "", "", N(antes))
  fila(`Cuotas que vencen DESPUÉS del cierre (${nDespues})`, "", "", N(despues))
  return out
}

/**
 * ✍️ JMS 11/11 (*«y otros anticipos que figuren en las pestañas de sus templates»*): en la solapa de agrupadora, la información ANEXA de lo
 * que el balance anterior dejó para este ejercicio en las cuentas de esa solapa — así se entiende por qué un impuesto casi no tiene pagos
 * (se pagó anual el ejercicio anterior). No suma a las cuotas: se muestra al lado, con el gasto del ejercicio de esa cuenta.
 */
export function anexoSaldosAnteriores(cuotas: CuotaTemplate[], saldos: SaldoAnteriorH[], resp: string): unknown[][] {
  const norm = (x: string) => x.trim().toLowerCase()
  const cats = new Set(cuotas.map(c => norm(c.categ ?? "")))
  const xs = saldos.filter(s => responsablePrincipal(s.empresa) === resp && cats.has(norm(s.categ)))
  if (!xs.length) return []
  const out: unknown[][] = [[], [B("INFORMACIÓN ANEXA — saldo del ejercicio anterior (pagado por adelantado en el balance anterior, es gasto de ESTE ejercicio)")],
    [B("Cuenta"), B("Concepto"), B("Saldo anterior"), B("Cuotas de esta solapa"), B("= Gasto del ejercicio"), B("De dónde sale")]]
  for (const s of xs) {
    const deCuotas = r2(cuotas.filter(c => norm(c.categ ?? "") === norm(s.categ)).reduce((a, c) => a + c.monto, 0))
    out.push([s.categ, s.concepto, N(s.monto), N(deCuotas), N(s.monto + deCuotas), s.motivo])
  }
  out.push(["ⓘ No suma al total de la solapa: las cuotas son lo pagado en el ejercicio; el saldo anterior es un pago del ejercicio pasado que se toma ahora."])
  return out
}
