/**
 * 🏛️ **LIBRO H — el papel de INMOBILIARIO, RED VIAL y AUTOMOTORES, con su control cruzado** (A-FEAT-1516, JMS 01/11).
 *
 * JMS: *«tenemos en egresos, en templates, la planilla de impuestos… de ahí la planilla de inmobiliario, red vial y automotor.
 * Ese Excel debería también descargarse en este momento como una planilla de detalle adjunta… van a estar duplicadas las
 * planillas, con exposiciones diferentes, pero van a tener que cancelarse entre sí y dar lo mismo para los períodos que entran
 * en el balance»*.
 *
 * Por responsable, una solapa por impuesto con **los dos años calendario del ejercicio enteros** (decisión de JMS 01/11), tal
 * cual el papel de la app (`filasPapel`: el mismo armado del botón «Excel»). Al pie, el CONTROL:
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
import { armarPapel, encabezadoPapel, filasPapel, papelDeTemplate, vencimientoEnPapel, TITULO_PAPEL, type Papel, type TipoPapel } from "@/lib/impuestos/papel-inmobiliario"

export interface DatosPapelesH extends AuxiliaresPapel {
  cuotas: CuotaPlanilla[]
}

export interface SolapaPapelH { nombre: string; filas: unknown[][]; anchos: number[] }

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
    const filas: unknown[][] = []
    for (const p of papeles) {
      if (p.bloques.length === 0) { filas.push([`${TITULO_PAPEL[tipo]} ${p.anio}`], [`(${resp} no tiene cuotas de ${CORTO[tipo].toLowerCase()} en ${p.anio})`], [], []); continue }
      filas.push(...filasPapel(p, filas.length + 1), [], [])
    }
    filas.push(...controlCruzado(d.cuotas, tipo, resp, enEjercicio, cuotasH, filas.length + 1))
    const max = Math.max(...papeles.map(p => p.maxCuotas))
    out.push({ nombre: `H · ${resp} · Papel ${CORTO[tipo]}`.slice(0, 31), filas, anchos: [26, 15, 8, ...encabezadoPapel(max).slice(3).map(() => 14)] })
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
