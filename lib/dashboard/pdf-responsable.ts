/**
 * 📄 El PDF del Dashboard «Por responsable» — A-FEAT-1637. El mismo PDF de «Por caja» (`descargarPdfDashboard`, mismo formato
 * fijo y mismo orden guardado de los grupos), con dos secciones más al pie de la tabla: «Financiado por los socios» y «Pagado por
 * cuenta de socios», todo abierto, y el control en palabras.
 */
import { descargarPdfDashboard, filasDelReporte, type FilaReporte } from "./export-pdf"
import type { ResumenFinanciero } from "./resumen"
import type { ControlResponsable, NodoSocios, VistaResponsable } from "./responsable"

const claveMes = (m: ResumenFinanciero) => `${m.año}-${String(m.mes).padStart(2, "0")}`

/** Los renglones: las 4 secciones como en «Por caja» y debajo los socios, cada nivel con sus partes debajo. Pura. */
export function filasPorResponsable(resumen: ResumenFinanciero[], v: VistaResponsable, orden: readonly string[] | null): FilaReporte[] {
  const out = filasDelReporte(resumen, orden).filter(f => f.nivel !== "total")
  const valores = (n: NodoSocios) => resumen.map(m => n.porMes[claveMes(m)] ?? 0)
  const bajar = (n: NodoSocios, prof: number) => {
    out.push({ nivel: prof === 0 ? "agrupadora" : "detalle", concepto: `${"   ".repeat(prof)}${n.nombre}`, valores: valores(n), total: n.total })
    n.hijos.forEach(h => bajar(h, prof + 1))
  }
  for (const raiz of [v.financiado, v.porCuenta]) {
    if (!raiz.hijos.length) continue
    out.push({ nivel: "seccion", concepto: raiz.nombre.toUpperCase(), valores: [], total: 0 })
    raiz.hijos.forEach(h => bajar(h, 0))
    out.push({ nivel: "subtotal", concepto: `Subtotal ${raiz.nombre}`, valores: valores(raiz), total: raiz.total })
  }
  const tot = resumen.map(m => m.saldoMensual + (v.financiado.porMes[claveMes(m)] ?? 0) + (v.porCuenta.porMes[claveMes(m)] ?? 0))
  out.push({ nivel: "total", concepto: "Total (= lo que se movió en sus canales)", valores: tot, total: tot.reduce((a, b) => a + b, 0) })
  return out
}

export function lineasDeControl(v: VistaResponsable, c: ControlResponsable): string[] {
  const f = (x: number) => x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return [
    `${v.cierra ? "✓" : "⚠"} Secciones ${f(v.totalSecciones)} + financiado ${f(v.totalFinanciado)} + pagado por cuenta ${f(v.totalPorCuenta)} = ${f(v.totalSecciones + v.totalFinanciado + v.totalPorCuenta)} — lo que se movió en sus canales ${f(v.totalCaja)}${v.cierra ? " (cierra)" : ""}`,
    `${c.cierra ? "✓" : "⚠"} Las tres empresas: por responsable ${f(c.porResponsable)} — por caja ${f(c.porCaja)} — diferencia ${f(c.diferencia)}`,
    `Pares: ${c.pares.map(p => `${p.a}↔${p.b}: ${p.a} pagó por ${p.b} ${f(p.pagosAporB)}, ${p.b} por ${p.a} ${f(p.pagosBporA)}${p.diferenciaTransf === null ? "" : `, transferencias ${p.diferenciaTransf === 0 ? "espejo ✓" : `⚠ diferencia ${f(p.diferenciaTransf)}`}`}`).join(" · ")}`,
    `Sin resolver (interno «Desglosar» / «Ver»): ${c.sinResolver.length}. Fuera de la tabla (cuenta con tipo «NO» o vacío): ${c.fuera.length}. El detalle, en el Excel (hoja Control).`,
  ]
}

export function descargarPdfPorResponsable(d: { titulo: string; nota: string; resumen: ResumenFinanciero[]; vista: VistaResponsable; control: ControlResponsable; decimales: boolean; orden: string[] | null }, nombre: string): void {
  descargarPdfDashboard({ titulo: d.titulo, nota: d.nota, resumen: d.resumen, decimales: d.decimales, orden: d.orden,
    filas: filasPorResponsable(d.resumen, d.vista, d.orden), lineasControl: lineasDeControl(d.vista, d.control) }, nombre)
}
