/**
 * 📄 El PDF del Dashboard «Por responsable» — A-FEAT-1637. El mismo PDF de «Por caja» (`descargarPdfDashboard`, mismo formato
 * fijo y mismo orden guardado de los grupos), con dos secciones más al pie de la tabla: «Financiado por los socios» y «Pagado por
 * cuenta de socios», todo abierto, y el control en palabras.
 */
import { descargarPdfDashboard, filasDelReporte, type FilaReporte } from "./export-pdf"
import type { ResumenFinanciero } from "./resumen"
import type { ControlResponsable, NodoSocios, VistaResponsable } from "./responsable"
import type { ControlBancos } from "./control-bancos"

const claveMes = (m: ResumenFinanciero) => `${m.año}-${String(m.mes).padStart(2, "0")}`

/** Los renglones: las 4 secciones como en «Por caja» y debajo los socios, cada nivel con sus partes debajo. Pura. */
export function filasPorResponsable(resumen: ResumenFinanciero[], v: VistaResponsable, orden: readonly string[] | null): FilaReporte[] {
  const out = filasDelReporte(resumen, orden).filter(f => f.nivel !== "total")
  const valores = (n: NodoSocios) => resumen.map(m => n.porMes[claveMes(m)] ?? 0)
  const bajar = (n: NodoSocios, prof: number) => {
    out.push({ nivel: prof === 0 ? "agrupadora" : "detalle", concepto: `${"   ".repeat(prof)}${n.nombre}`, valores: valores(n), total: n.total })
    n.hijos.forEach(h => bajar(h, prof + 1))
  }
  // 💰 Ingresos: los propios y lo recibido de cada socio (neto), abierto por canal → template
  const suma = (x: number[]) => x.reduce((a, b) => a + b, 0)
  const prop = resumen.map(m => m.totalIngresos), rec = valores(v.recibidoNeto)
  out.push({ nivel: "seccion", concepto: "INGRESOS — LO PROPIO Y LO DE LOS SOCIOS", valores: [], total: 0 })
  out.push({ nivel: "agrupadora", concepto: "Ingresos propios", valores: prop, total: suma(prop) })
  v.recibidoNeto.hijos.forEach(h => bajar(h, 0))
  out.push({ nivel: "subtotal", concepto: "Recibido de los socios (neto)", valores: rec, total: v.recibidoNeto.total })
  const it = prop.map((x, i) => x + rec[i])
  out.push({ nivel: "subtotal", concepto: "= Ingresos totales", valores: it, total: suma(it) })
  const eg = resumen.map(m => m.totalEgresos)
  out.push({ nivel: "subtotal", concepto: "Egresos (con lo que pagó otro y los retiros a caja)", valores: eg, total: suma(eg) })
  const tot = resumen.map(m => m.saldoMensual + (v.financiado.porMes[claveMes(m)] ?? 0) + (v.porCuenta.porMes[claveMes(m)] ?? 0))
  out.push({ nivel: "total", concepto: "Total (= lo que se movió en sus canales)", valores: tot, total: tot.reduce((a, b) => a + b, 0) })
  return out
}

export function lineasDeControl(v: VistaResponsable, c: ControlResponsable, b?: ControlBancos | null): string[] {
  const f = (x: number) => x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return [
    ...(b ? [`${b.cierra ? "✓" : "⚠"} Contra los bancos: saldo inicial ${f(b.saldoInicial)} + ingresos propios ${f(b.ingresosPropios)} + recibido de los socios ${f(b.recibidoSocios)} + egresos ${f(b.egresos)} + financieros ${f(b.financieros)} + distribuciones ${f(b.distribuciones)} + sin categoría ${f(b.sinCategoria)} + tipo NO ${f(b.fuera)} = ${f(b.saldoFinalCalculado)} — bancos ${f(b.saldoFinalBancos)} — diferencia ${f(b.diferencia)}`,
      `Saldos: ${b.canales.map(k => `${k.canal} ${f(k.inicial)} → ${f(k.final)}${k.inicialEstimado ? " (inicial del primer dato)" : ""}`).join(" · ")}. La tarjeta: −(consumos − pagos). Dólares aparte.`] : []),
    `${v.cierra ? "✓" : "⚠"} Secciones ${f(v.totalSecciones)} + financiado ${f(v.totalFinanciado)} + pagado por cuenta ${f(v.totalPorCuenta)} = ${f(v.totalSecciones + v.totalFinanciado + v.totalPorCuenta)} — lo que se movió en sus canales ${f(v.totalCaja)}${v.cierra ? " (cierra)" : ""}`,
    `${c.cierra ? "✓" : "⚠"} Las tres empresas: por responsable ${f(c.porResponsable)} — por caja ${f(c.porCaja)} — diferencia ${f(c.diferencia)}`,
    `Pares: ${c.pares.map(p => `${p.a}↔${p.b}: ${p.a} pagó por ${p.b} ${f(p.pagosAporB)}, ${p.b} por ${p.a} ${f(p.pagosBporA)}${p.diferenciaTransf === null ? "" : `, transferencias ${p.diferenciaTransf === 0 ? "espejo ✓" : `⚠ diferencia ${f(p.diferenciaTransf)}`}`}`).join(" · ")}`,
    `Sin resolver (interno «Desglosar» / «Ver»): ${c.sinResolver.length}. Fuera de la tabla (cuenta con tipo «NO» o vacío): ${c.fuera.length}. El detalle, en el Excel (hoja Control).`,
  ]
}

export function descargarPdfPorResponsable(d: { titulo: string; nota: string; resumen: ResumenFinanciero[]; vista: VistaResponsable; control: ControlResponsable; bancos?: ControlBancos | null; decimales: boolean; orden: string[] | null }, nombre: string): void {
  descargarPdfDashboard({ titulo: d.titulo, nota: d.nota, resumen: d.resumen, decimales: d.decimales, orden: d.orden,
    filas: filasPorResponsable(d.resumen, d.vista, d.orden), lineasControl: lineasDeControl(d.vista, d.control, d.bancos) }, nombre)
}
