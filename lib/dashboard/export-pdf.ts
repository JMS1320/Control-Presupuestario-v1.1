/**
 * 📄 EL PDF DEL DASHBOARD — A-FEAT-1637 (JMS 22/11/2026: «así MA cuando quiere se hace un print de sus cosas»).
 *
 * Sigue el «Protocolo de generación de reportes» (raíz del repo): una sola tabla con lo que está en pantalla, **cada número al
 * lado de las partes que lo forman** (sección → agrupadora → detalle, con su subtotal a la vista: ningún número se encuentra
 * filtrando), A4 apaisado, encabezado con empresas / año / semestre y pie «Página X de N», y **el control al final** (G9/G20).
 */
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { SECCIONES_DASHBOARD, type ResumenFinanciero, type SeccionDashboard } from "./resumen"
import type { ControlDashboard } from "./control"
import { ordenarAgrupadoras, rotuloAgrupadora } from "./orden"

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const fmt = (n: number, dec: boolean) => (Math.abs(n) < 0.005 ? "-" : n < 0
  ? `(${Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 })})`
  : n.toLocaleString("es-AR", { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 }))

/** La fuente estándar del PDF (WinAnsi) no tiene «−», «✓» ni «⚠»: se cambian por su equivalente legible. */
const pdfTexto = (s: string) => s.replace(/−/g, "-").replace(/✓/g, "OK").replace(/⚠️?/g, "REVISAR:")

export type FilaReporte = { nivel: "seccion" | "agrupadora" | "detalle" | "subtotal" | "total"; concepto: string; valores: number[]; total: number }

const TOTAL_KEY: Record<SeccionDashboard, "totalIngresos" | "totalEgresos" | "totalFinancieros" | "totalDistribuciones"> = {
  ingresos: "totalIngresos", egresos: "totalEgresos", financieros: "totalFinancieros", distribuciones: "totalDistribuciones",
}

/** Los renglones del reporte, en el orden de la pantalla, con todos los detalles abiertos. Pura. */
export function filasDelReporte(resumen: ResumenFinanciero[], orden: readonly string[] | null = null): FilaReporte[] {
  const out: FilaReporte[] = []
  const suma = (v: number[]) => v.reduce((a, b) => a + b, 0)
  for (const s of SECCIONES_DASHBOARD) {
    const agrups = ordenarAgrupadoras(s.key, resumen.flatMap(m => Object.keys(m[s.key])), orden)
    if (!agrups.length) continue
    out.push({ nivel: "seccion", concepto: s.titulo.toUpperCase(), valores: [], total: 0 })
    for (const a of agrups) {
      const v = resumen.map(m => m[s.key][a] || 0)
      const subs = [...new Set(resumen.flatMap(m => Object.keys(m.subCategorias?.[a] || {})))].sort((x, y) => x.localeCompare(y, "es"))
      const rot = rotuloAgrupadora(a, subs)
      out.push({ nivel: "agrupadora", concepto: rot.texto, valores: v, total: suma(v) })
      // ⚠️ `subCategorias` es por agrupadora (no por sección): si la misma agrupadora está en dos secciones, el detalle las junta —
      // igual que la pantalla. Sólo se abre cuando aporta (más de un detalle, o uno con otro nombre).
      if (rot.desplegable) {
        for (const d of subs) {
          const vd = resumen.map(m => m.subCategorias?.[a]?.[d] || 0)
          out.push({ nivel: "detalle", concepto: d, valores: vd, total: suma(vd) })
        }
      }
    }
    const vt = resumen.map(m => m[TOTAL_KEY[s.key]])
    out.push({ nivel: "subtotal", concepto: `Subtotal ${s.titulo}`, valores: vt, total: suma(vt) })
  }
  const ie = resumen.map(m => m.totalIngresos + m.totalEgresos)
  out.push({ nivel: "total", concepto: "Ingresos - Egresos", valores: ie, total: suma(ie) })
  const sal = resumen.map(m => m.saldoMensual)
  out.push({ nivel: "total", concepto: "Saldo total", valores: sal, total: suma(sal) })
  let acc = 0
  const acum = sal.map(x => (acc += x))
  out.push({ nivel: "total", concepto: "Saldo acumulado", valores: acum, total: acc })
  return out
}

export interface DatosPdfDashboard {
  titulo: string
  nota: string
  resumen: ResumenFinanciero[]
  control: ControlDashboard
  decimales: boolean
  /** 🔀 El orden de los grupos que dejó el usuario (el mismo de la pantalla). */
  orden?: string[] | null
}

export function descargarPdfDashboard(d: DatosPdfDashboard, nombre: string): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const filas = filasDelReporte(d.resumen, d.orden ?? null)
  const head = [["Concepto", ...d.resumen.map(m => `${NOMBRES_MES[m.mes - 1]} ${String(m.año).slice(2)}`), "Total"]]
  const body = filas.map(f => f.nivel === "seccion"
    ? [{ content: f.concepto, colSpan: d.resumen.length + 2, styles: { fontStyle: "bold" as const, fillColor: [235, 240, 247] as [number, number, number] } }]
    : [pdfTexto(f.nivel === "detalle" ? `      ${f.concepto}` : f.nivel === "agrupadora" ? `  ${f.concepto}` : f.concepto), ...f.valores.map(v => fmt(v, d.decimales)), fmt(f.total, d.decimales)])
  const estilos = filas.map(f => f.nivel)

  autoTable(doc, {
    head, body: body as any,
    startY: 22,
    margin: { left: 10, right: 10, top: 22, bottom: 14 },
    styles: { font: "helvetica", fontSize: d.resumen.length > 6 ? 6.5 : 8, cellPadding: 1, lineColor: [210, 210, 210], lineWidth: 0.1 },
    headStyles: { fillColor: [60, 72, 88], textColor: 255, halign: "center" },
    columnStyles: Object.fromEntries([[0, { cellWidth: 60 }], ...Array.from({ length: d.resumen.length + 1 }, (_, i) => [i + 1, { halign: "right" }])]),
    didParseCell: (h) => {
      if (h.section !== "body") return
      const n = estilos[h.row.index]
      if (n === "subtotal" || n === "total") { h.cell.styles.fontStyle = "bold"; h.cell.styles.fillColor = n === "total" ? [225, 230, 238] : [243, 245, 248] }
      if (n === "detalle") { h.cell.styles.textColor = [100, 100, 100] }
      if (h.column.index === d.resumen.length + 1 && n !== "seccion") h.cell.styles.fontStyle = "bold"
    },
  })

  // 🧮 El control, al pie (G9 / G20)
  let y = ((doc as any).lastAutoTable?.finalY ?? 30) + 6
  if (y > 185) { doc.addPage(); y = 26 }
  const c = d.control
  const lineas = [
    `${c.cierra ? "✓" : "⚠"} Control: total de la tabla ${fmt(c.totalTabla, true)} — suma de los movimientos de los canales ${fmt(c.totalMovimientos, true)} — diferencia ${fmt(c.diferencia, true)}${c.cierra ? " (cierra)" : ""}`,
    ...(c.fueraTotal ? [`⚠ Quedaron fuera de la tabla ${fmt(c.fueraTotal, true)} (movimientos con cuenta de tipo «NO» o vacío)${c.explicada ? ": explican toda la diferencia" : ""}.`] : []),
    `Canales: ${c.canales.map(k => `${k.nombre} ${k.movimientos} mov. ${fmt(k.neto, true)}${k.sinCateg ? ` (+${k.sinCateg} sin categoría)` : ""}${k.incompleta ? " ⚠ lectura incompleta" : ""}`).join(" · ")}`,
    d.nota,
  ]
  doc.setFontSize(7.5)
  for (const l of lineas) {
    const partes = doc.splitTextToSize(pdfTexto(l), 277)
    if (y + partes.length * 3.6 > 200) { doc.addPage(); y = 26 }
    doc.text(partes, 10, y)
    y += partes.length * 3.6 + 1
  }

  // Encabezado y pie en todas las páginas
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFontSize(11); doc.setFont("helvetica", "bold")
    doc.text(pdfTexto(d.titulo), 10, 14)
    doc.setFont("helvetica", "normal"); doc.setFontSize(7)
    doc.text(`Página ${p} de ${total}`, 287, 205, { align: "right" })
    doc.text("Importes: créditos - débitos; negativos entre paréntesis.", 10, 205)
  }
  doc.save(nombre)
}
