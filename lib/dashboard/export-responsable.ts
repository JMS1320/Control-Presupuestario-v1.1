/**
 * 📥 EL EXCEL DEL DASHBOARD «POR RESPONSABLE» — A-FEAT-1637. Las mismas reglas que el Excel «Por caja» (CLAUDE.md § ♻️):
 *   · **Resumen** por categoría y por mes con Nro → el detalle debajo (`armarResumenPorMes`), con las 6 secciones (Ingresos, Egresos,
 *     Financieros, Distribuciones, Financiado por los socios, Pagado por cuenta de socios), subtotal por sección, semestres con el año
 *     entero, fechas reales y fórmulas. Cada renglón del detalle con su ficha (quién pagó, canal, de quién es y por qué, códigos).
 *   · **Control**: por empresa (secciones + financiado + pagado por cuenta = su caja), el total contra «Por caja», los pares
 *     (lo que uno pagó por el otro = lo que el otro muestra como financiado; las transferencias vistas de los dos lados) y lo sin
 *     resolver / fuera de la tabla, listado.
 *   · **Cuenta entre socios**: el saldo de cada par mes por mes (saldo = anterior + movimiento, con fórmula) y su detalle.
 */
import XLSX from "xlsx-js-style"
import { armarResumenPorMes, type ItemDetalle } from "@/lib/balance/resumen-por-mes"
import { agregarHoja, vistasDe } from "@/lib/balance/export-libro-diario"
import { aplicarVistas, MONEDA } from "@/lib/balance/formato-excel"
import { fechasReales } from "@/lib/excel/fechas-reales"
import { descargarBlob } from "@/lib/descargar-archivo"
import { mesesDelPeriodo } from "./export-excel"
import type { ControlBancos } from "./control-bancos"
import { CATEGORIAS_CUENTA, RAZON, SALDO_INICIAL_FECHA, SECCIONES_VISTA, type ControlResponsable, type CuentaPar, type NodoSocios, type VistaResponsable } from "./responsable"

const fechaAR = (iso: string) => { const [a, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}/${a}` }
const n = (v: number) => ({ t: "n", v, z: MONEDA })

export interface DatosExcelResponsable {
  empresas: readonly string[]
  año: number
  semestre?: number
  vista: VistaResponsable
  control: ControlResponsable
  cuentas: CuentaPar[]
  bancos?: ControlBancos | null
}

export function itemsDeLaVista(v: VistaResponsable): ItemDetalle[] {
  return v.renglones.map(r => ({
    categoria: `${r.seccion} · ${r.grupo}`,
    orden: `${r.m.fecha}|${r.m.canal}|${r.m.id.padStart(12, "0")}`,
    mes: r.m.mes,
    importe: r.importe,
    columnas: [fechaAR(r.m.fecha), r.m.pagador, r.m.canal, r.m.responsable, RAZON[r.m.por], r.m.descripcion, r.m.detalle, r.m.categ, r.m.template, r.detalle, r.m.contable, r.m.interno],
  }))
}

const ordenCategoria = (cat: string) => {
  const [sec, ...resto] = cat.split(" · ")
  const i = SECCIONES_VISTA.indexOf(sec as (typeof SECCIONES_VISTA)[number])
  const g = resto.join(" · ")
  return `${i < 0 ? 9 : i}|${g.startsWith("(") ? 1 : 0}|${g.toLowerCase()}`
}

export function libroPorResponsable(d: DatosExcelResponsable): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const per = d.semestre === 1 ? "1er semestre" : d.semestre === 2 ? "2do semestre" : "año entero"
  const titulo = `Dashboard POR RESPONSABLE — ${d.empresas.join(" + ")} — ${d.año} (${per})`
  const nota = "De quién es cada peso: código interno (o contable si el interno está vacío) > Libertad (MA) > responsable del template > factura > empleado > quien pagó. «Financiado por los socios» = lo que otro pagó por esta empresa o le transfirió; «Pagado por cuenta de socios» = lo que esta empresa pagó o transfirió por otro. Ni ingreso ni gasto."
  const { filas } = armarResumenPorMes(itemsDeLaVista(d.vista), {
    titulo, notas: [nota], meses: mesesDelPeriodo(d.año, d.semestre), semestres: d.semestre === undefined,
    encabezadoDetalle: ["Fecha", "Pagó", "Canal", "De quién es", "Por qué", "Descripción del banco", "Detalle", "Categ", "Template", "Cuenta", "Contable", "Interno"],
    rotuloImporte: "Importe", subtotalDe: (cat) => cat.split(" · ")[0], ordenCategoria,
  })
  agregarHoja(wb, "Resumen", filas)

  // 🧮 Control
  const c = d.control, v = d.vista
  const h: unknown[][] = [[`Control — ${titulo}`], [],
    ["1 · LA VISTA: secciones + financiado + pagado por cuenta = lo que se movió en sus canales"],
    ["Secciones (ingresos, egresos, financieros, distribuciones)", "", "", n(v.totalSecciones)],
    ["Financiado por los socios", "", "", n(v.totalFinanciado)], ["Pagado por cuenta de socios", "", "", n(v.totalPorCuenta)]]
  const fS = h.length - 2, fF = h.length - 1, fP = h.length
  h.push(["Suma", "", "", { t: "n", f: `D${fS}+D${fF}+D${fP}`, v: v.totalSecciones + v.totalFinanciado + v.totalPorCuenta, z: MONEDA }])
  const fSuma = h.length
  h.push([`Lo que se movió en los canales de ${d.empresas.join(" + ")} («Por caja»)`, "", "", n(v.totalCaja)])
  const fCaja = h.length
  h.push(["Estado", "", "", { t: "s", f: `IF(ABS(D${fSuma}-D${fCaja})<0.01,"✓ cierra","⚠️ REVISAR")`, v: v.cierra ? "✓ cierra" : "⚠️ REVISAR" }], [])
  h.push(["2 · LAS TRES EMPRESAS: el total por responsable = el total por caja (sólo cambia quién se lleva cada peso)"],
    ["Empresa", "Su caja", "Secciones", "Financiado", "Pagado por cuenta", "Suma", "Estado"])
  const f1 = h.length + 1
  for (const e of c.porEmpresa) {
    const r = h.length + 1
    h.push([e.empresa, n(e.caja), n(e.secciones), n(e.financiado), n(e.porCuenta), { t: "n", f: `C${r}+D${r}+E${r}`, v: e.secciones + e.financiado + e.porCuenta, z: MONEDA },
      { t: "s", f: `IF(ABS(F${r}-B${r})<0.01,"✓","⚠️")`, v: e.cierra ? "✓" : "⚠️" }])
  }
  const fN = h.length
  h.push(["Total", { t: "n", f: `SUM(B${f1}:B${fN})`, v: c.porCaja, z: MONEDA }, "", "", "", { t: "n", f: `SUM(F${f1}:F${fN})`, v: c.porResponsable, z: MONEDA },
    { t: "s", f: `IF(ABS(F${fN + 1}-B${fN + 1})<0.01,"✓ por responsable = por caja","⚠️ REVISAR")`, v: c.cierra ? "✓ por responsable = por caja" : "⚠️ REVISAR" }], [])
  h.push(["3 · LOS PARES: lo que uno pagó por el otro = lo que el otro muestra como financiado · las transferencias vistas desde las dos puntas"],
    ["A", "B", "A pagó por B", "B lo muestra como financiado", "B pagó por A", "A lo muestra como financiado", "Transferencias vistas desde A", "Vistas desde B", "Diferencia", "Meses con diferencia"])
  for (const p of c.pares) h.push([p.a, p.b, n(p.pagosAporB), p.financiadoEnB === null ? `${p.b} no tiene canales` : n(p.financiadoEnB), n(p.pagosBporA),
    p.financiadoEnA === null ? "—" : n(p.financiadoEnA), n(p.transfLadoA), p.transfLadoB === null ? "—" : n(p.transfLadoB),
    p.diferenciaTransf === null ? "—" : n(p.diferenciaTransf), p.mesesConDiferencia.map(x => `${x.mes}: ${x.ladoA} / ${x.ladoB}`).join(" · ") || (p.diferenciaTransf === null ? "" : "✓ espejo")])
  h.push([], ["4 · SIN RESOLVER — el interno dice «Desglosar» o «Ver»: se atribuyó por el template / la factura / quien pagó"],
    ["Fecha", "Canal", "Descripción", "Interno", "Contable", "Importe", "Quedó de", "Por qué"])
  if (!c.sinResolver.length) h.push(["(ninguno)"])
  for (const m of c.sinResolver) h.push([fechaAR(m.fecha), m.canal, m.descripcion, m.interno, m.contable, n(m.importe), m.responsable, RAZON[m.por]])
  h.push([], ["5 · FUERA DE LA TABLA — cuenta con tipo «NO» o vacío (igual que en «Por caja»)"], ["Fecha", "Canal", "Descripción", "Categ", "Importe", "Tipo y de dónde sale"])
  if (!c.fuera.length) h.push(["(ninguno)"])
  for (const f of c.fuera) h.push([fechaAR(f.mov.fecha), f.mov._canal ?? "", f.mov.descripcion ?? "", f.mov.categ ?? "", n(f.clasificacion.monto), `${f.clasificacion.tipo ?? "vacío"}${f.clasificacion.origenTipo ? ` (de ${f.clasificacion.origenTipo})` : ""}`])
  // 🏦 6 · Contra los bancos (con fórmulas: el calculado suma sus renglones y la diferencia se ve)
  const b = d.bancos
  if (b) {
    h.push([], ["6 · CONTROL CONTRA LOS BANCOS — saldo inicial + ingresos totales − egresos ± lo demás = saldo final de los bancos"])
    const f0 = h.length + 1
    const rs: Array<[string, number]> = [["Saldo inicial de sus cuentas en pesos", b.saldoInicial], ["+ Ingresos propios", b.ingresosPropios], ["+ Recibido de los socios (neto)", b.recibidoSocios],
      ["+ Egresos (con los retiros a caja y lo que pagó otro)", b.egresos], ["+ Financieros propios (FCI, pagos de tarjeta, entre cuentas)", b.financieros], ["+ Distribuciones", b.distribuciones],
      ["+ Movimientos sin categoría (no entran al Dashboard)", b.sinCategoria], ["+ Movimientos con tipo «NO»", b.fuera]]
    for (const [r, v0] of rs) h.push([r, "", "", n(v0)])
    const fN2 = h.length
    h.push(["= Saldo final calculado", "", "", { t: "n", f: `SUM(D${f0}:D${fN2})`, v: b.saldoFinalCalculado, z: MONEDA }])
    const fCalc = h.length
    h.push(["Saldo final de los bancos", "", "", n(b.saldoFinalBancos)])
    const fBan = h.length
    h.push(["Diferencia", "", "", { t: "n", f: `D${fBan}-D${fCalc}`, v: b.diferencia, z: MONEDA }, { t: "s", f: `IF(ABS(D${fBan + 1})<0.01,"✓ cierra contra los bancos","⚠️ NO CIERRA")`, v: b.cierra ? "✓ cierra contra los bancos" : "⚠️ NO CIERRA" }])
    h.push([], ["Cuenta", "Saldo inicial", "Movimientos", "Saldo final", "De dónde sale el saldo", "Diferencia del extracto"])
    for (const k of b.canales) h.push([k.canal, n(k.inicial), n(k.netoMovimientos), n(k.final), k.nota, n(k.diferenciaCanal)])
    for (const a of b.avisos) h.push([`⚠️ ${a}`])
    h.push([], ["Movimientos sin categoría de sus cuentas"], ["Fecha", "Cuenta", "Descripción", "Importe"])
    for (const k of b.canales) for (const x of k.sinCategoria) h.push([fechaAR(x.fecha), k.canal, x.descripcion, n(x.importe)])
    h.push(["Las cuentas en dólares no entran (pesos y dólares nunca mezclados)."])
  }
  agregarHoja(wb, "Control", h)

  // 🤝 Cuenta entre socios
  const s: unknown[][] = [[`Cuenta entre socios — saldo inicial ${fechaAR(SALDO_INICIAL_FECHA)} = 0 · + = B le debe a A`],
    ["Lo que A paga o transfiere por B suma; lo que B paga por A resta («Aportes»). Libertad entera de MA. Lo recibido es el espejo y no se suma. Los meses sin datos de algún canal llevan ⚠️ (no se sabe lo de antes)."], []]
  for (const cp of d.cuentas) {
    s.push([`${cp.a} ↔ ${cp.b}`], ["Mes", ...CATEGORIAS_CUENTA, "Movimiento", "Saldo", "Sin datos de"])
    s.push([`Saldo inicial ${fechaAR(SALDO_INICIAL_FECHA)}`, "", "", "", "", "", n(cp.saldoInicial)])
    for (const m of cp.meses) {
      const r = s.length + 1
      s.push([m.mes, ...CATEGORIAS_CUENTA.map(k => n(m.porCategoria[k])), { t: "n", f: `SUM(B${r}:E${r})`, v: m.movimiento, z: MONEDA },
        { t: "n", f: `G${r - 1}+F${r}`, v: m.saldo, z: MONEDA }, m.sinDatos.length ? `⚠️ ${m.sinDatos.join(", ")}` : ""])
    }
    s.push([`Saldo al cierre (${cp.saldoFinal > 0 ? `${cp.b} le debe a ${cp.a}` : cp.saldoFinal < 0 ? `${cp.a} le debe a ${cp.b}` : "en cero"})`, "", "", "", "", "",
      { t: "n", f: `G${s.length}`, v: cp.saldoFinal, z: MONEDA }], [])
  }
  s.push(["DETALLE — cada movimiento de cada cuenta"], ["Par", "Mes", "Categoría", "Grupo", "Fecha", "Canal", "Pagó", "Descripción", "Template", "Cuenta", "Contable", "Interno", "Importe en la cuenta"])
  const hojas = (n0: NodoSocios, camino: string[], out: Array<{ camino: string[]; x: NodoSocios["movs"][number] }>) => {
    n0.movs.forEach(x => out.push({ camino, x })); n0.hijos.forEach(h2 => hojas(h2, [...camino, h2.nombre], out)); return out
  }
  for (const cp of d.cuentas) for (const m of cp.meses) for (const { camino, x } of hojas(m.arbol, [], [])) {
    s.push([`${cp.a} ↔ ${cp.b}`, m.mes, camino[0] ?? "", camino.slice(1).join(" ▸ "), fechaAR(x.m.fecha), x.m.canal, x.m.pagador, x.m.descripcion, x.m.template, x.m.cuenta, x.m.contable, x.m.interno, n(x.importe)])
  }
  agregarHoja(wb, "Cuenta entre socios", s)
  return wb
}

export async function descargarExcelPorResponsable(d: DatosExcelResponsable, nombre: string): Promise<void> {
  const wb = libroPorResponsable(d)
  fechasReales(wb)
  const out = await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistasDe(wb))
  descargarBlob(new Blob([out as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nombre)
}
