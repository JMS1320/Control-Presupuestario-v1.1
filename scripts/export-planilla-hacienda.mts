// Exporta las Planillas de Hacienda igual que el botón de la app, pero en lote.
//
// ⚠️ ESTE SCRIPT REPLICA LA LÓGICA DE LA APP **TAL CUAL ESTÁ**. El espejo es
// `components/vista-sector-productivo.tsx` → `calcularDatosPlanilla()` (~:1384) y
// `exportarPlanillaHacienda()` (~:1528).
//
// **Cada fix de la app hay que aplicarlo acá también, o el script queda mintiendo.**
// Aplicados hasta ahora:
//   · 2026-08-20 — A-BUG-44: `stockAnterior` mira el tipo en vez de sumar en crudo.
//
// 📸 La foto del estado ANTERIOR al fix quedó en `backup_planillas_hacienda_2026-08-20/`
// (generada con la versión que replicaba el bug). No regenerar sobre esa carpeta: es la
// referencia contra la que se comparan las correcciones.
//
//   npx tsx scripts/export-planilla-hacienda.mts [carpeta-destino]
//
// Genera una planilla por mes (desde el primer movimiento hasta hoy) + una punta a punta.

import * as XLSX from "xlsx"
// La app importa `jsPDF` por default; en Node/tsx ese default no es constructor,
// así que acá va el named export. Es la única diferencia con el código de la app.
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"

// Las credenciales salen de .env.local, igual que la app
function env(clave: string): string {
  try {
    const txt = readFileSync(join(process.cwd(), ".env.local"), "utf-8")
    const linea = txt.split(/\r?\n/).find(l => l.startsWith(clave + "="))
    if (linea) return linea.slice(clave.length + 1).trim().replace(/^["']|["']$/g, "")
  } catch { /* sigue con process.env */ }
  return process.env[clave] ?? ""
}

const supabase = createClient(
  env("NEXT_PUBLIC_SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY") || env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
)

// ── Copiado literal de vista-sector-productivo.tsx:1344-1359 ────────────────
const CATS_PLANILLA = [
  { db: "Vaca", label: "Vaca", grupo: "cria" },
  { db: "Vaquillona Preñada", label: "Vaq. Preñada", grupo: "cria" },
  { db: "Vaca CUT/Descarte", label: "CUT/Descarte", grupo: "cria" },
  { db: "Toro", label: "Toro", grupo: "cria" },
  { db: "Ternero Recria", label: "Ternero", grupo: "recria" },
  { db: "Ternera Recria", label: "Ternera", grupo: "recria" },
  { db: "Torito", label: "Torito", grupo: "recria" },
  { db: "Vaquillona de Reposicion", label: "Vaq. Reposición", grupo: "recria" },
  { db: "Novillo", label: "Novillo", grupo: "recria" },
  { db: "Vaquillona Engorde", label: "Vaq. Engorde", grupo: "recria" },
]
const CATS_TERNEROS = [
  { db: "Ternero al Pie", label: "Ternero al Pie", grupo: "terneros" },
  { db: "Ternera al Pie", label: "Ternera al Pie", grupo: "terneros" },
]

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
  "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

const ddmmyyyy = (f: string) => f ? f.split("-").reverse().join("/") : "-"

// Formato argentino, igual que la app (:1381): el cero se muestra como guión
const fmtNum = (n: number) => n === 0 ? "-" : n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })

// Los movimientos del período, compartidos por la hoja Detalle y por el PDF
async function traerDetalle(desde: string, hasta: string) {
  const { data } = await supabase.schema("productivo").from("movimientos_hacienda")
    .select("tipo, cantidad, categoria_id, fecha, peso_total_kg, precio_por_kg, monto_total, proveedor_cliente, observaciones")
    .gte("fecha", desde).lte("fecha", hasta)
    .order("fecha")
  return (data || []) as any[]
}

// ── Espejo de calcularDatosPlanilla(desde, hasta) ───────────────────────────
async function calcularDatosPlanilla(desde: string, hasta: string) {
  const { data: allCats } = await supabase.schema("productivo").from("categorias_hacienda").select("id, nombre")
  if (!allCats) throw new Error("Error cargando categorías")
  const catIdMap: Record<string, string> = {}
  const catNameMap: Record<string, string> = {}
  allCats.forEach((c: any) => { catIdMap[c.nombre.toLowerCase()] = c.id; catNameMap[c.id] = c.nombre })

  const { data: todosMovs } = await supabase.schema("productivo").from("movimientos_hacienda")
    .select("tipo, cantidad, categoria_id, fecha")
    .lte("fecha", hasta).order("fecha")
  if (!todosMovs) throw new Error("Error cargando movimientos")

  const movsAnteriores = todosMovs.filter((m: any) => m.fecha < desde)
  const movsPeriodo = todosMovs.filter((m: any) => m.fecha >= desde && m.fecha <= hasta)

  const todasCats = [...CATS_PLANILLA, ...CATS_TERNEROS]
  const catToCol: Record<string, number> = {}
  todasCats.forEach((c, i) => {
    const id = catIdMap[c.db.toLowerCase()]
    if (id) catToCol[id] = i
  })
  const nCols = todasCats.length
  const nAdultos = CATS_PLANILLA.length
  const nTern = CATS_TERNEROS.length

  // Mira el TIPO, igual que la app (:1410) desde el fix de A-BUG-44: venta y mortandad se
  // guardan POSITIVAS, así que sumarlas en crudo inflaba el arranque en el doble de su tamaño.
  const stockAnterior = new Array(nCols).fill(0)
  movsAnteriores.forEach((m: any) => {
    const col = catToCol[m.categoria_id]
    if (col === undefined) return
    stockAnterior[col] += (m.tipo === "venta" || m.tipo === "mortandad") ? -m.cantidad : m.cantidad
  })

  const filas: Record<string, number[]> = {
    compras: new Array(nCols).fill(0), nacimientos: new Array(nCols).fill(0),
    reclasPos: new Array(nCols).fill(0), ventas: new Array(nCols).fill(0),
    mortandad: new Array(nCols).fill(0), reclasNeg: new Array(nCols).fill(0),
  }
  // Los movimientos cuya categoría no está entre las 12 columnas se descartan en silencio (:1418)
  const descartados: Record<string, number> = {}
  movsPeriodo.forEach((m: any) => {
    const col = catToCol[m.categoria_id]
    if (col === undefined) {
      const n = catNameMap[m.categoria_id] || m.categoria_id
      descartados[n] = (descartados[n] || 0) + 1
      return
    }
    switch (m.tipo) {
      case "compra": filas.compras[col] += m.cantidad; break
      case "nacimiento": filas.nacimientos[col] += m.cantidad; break
      case "venta": filas.ventas[col] += Math.abs(m.cantidad); break
      case "mortandad": filas.mortandad[col] += Math.abs(m.cantidad); break
      case "ajuste_stock":
        if (m.cantidad > 0) filas.compras[col] += m.cantidad
        else filas.mortandad[col] += Math.abs(m.cantidad)
        break
      case "cambio_categoria":
        if (m.cantidad > 0) filas.reclasPos[col] += m.cantidad
        else filas.reclasNeg[col] += Math.abs(m.cantidad)
        break
    }
  })

  const ingresos = new Array(nCols).fill(0)
  const egresos = new Array(nCols).fill(0)
  const existenciaFinal = new Array(nCols).fill(0)
  for (let i = 0; i < nCols; i++) {
    ingresos[i] = filas.compras[i] + filas.nacimientos[i] + filas.reclasPos[i]
    egresos[i] = filas.ventas[i] + filas.mortandad[i] + filas.reclasNeg[i]
    existenciaFinal[i] = stockAnterior[i] + ingresos[i] - egresos[i]
  }

  const sumar = (arr: number[], d: number, h: number) => arr.slice(d, h + 1).reduce((s, v) => s + v, 0)
  const buildRow = (label: string, vals: number[]) => {
    const subAdultos = sumar(vals, 0, nAdultos - 1)
    const subTern = sumar(vals, nAdultos, nAdultos + nTern - 1)
    return [label, ...vals.slice(0, nAdultos), subAdultos, ...vals.slice(nAdultos), subTern, subAdultos + subTern]
  }

  const cutCatId = catIdMap["vaca cut/descarte"]
  let cutData: { caravana: string; fechaAlta: string; tipo: string; pelo: string; motivo: string; estado: string }[] = []
  if (cutCatId) {
    const { data: cutTerneros } = await supabase.schema("productivo").from("terneros")
      .select("caravana_oficial, caravana_interna, categoria_previa, pelo, observaciones, fecha_baja, fecha_alta")
      .eq("categoria_id", cutCatId)
      .lte("fecha_alta", hasta)
    cutData = (cutTerneros || []).map((d: any) => ({
      caravana: d.caravana_oficial || d.caravana_interna || "Sin identificar",
      fechaAlta: d.fecha_alta ? ddmmyyyy(d.fecha_alta) : "-",
      tipo: d.categoria_previa || "-",
      pelo: d.pelo || "-",
      motivo: d.observaciones || "-",
      estado: (!d.fecha_baja || d.fecha_baja > hasta) ? "Activa" : "Baja",
    }))
  }

  const rowDefs = [
    { label: "Stock Anterior", vals: stockAnterior },
    { label: "Compras", vals: filas.compras },
    { label: "Nacimientos", vals: filas.nacimientos },
    { label: "Reclas. +", vals: filas.reclasPos },
    { label: "Ingresos", vals: ingresos },
    { label: "Ventas", vals: filas.ventas },
    { label: "Mortandad", vals: filas.mortandad },
    { label: "Reclas. -", vals: filas.reclasNeg },
    { label: "Egresos", vals: egresos },
    { label: "Existencia Final", vals: existenciaFinal },
  ]

  const builtRows = rowDefs.map(r => ({ label: r.label, vals: buildRow(r.label, r.vals) }))
  const totalVientres = existenciaFinal[0] + existenciaFinal[1]

  return { builtRows, cutData, totalVientres, catNameMap, filas,
    stockAnterior, existenciaFinal, nAdultos, nTern, descartados, desde, hasta }
}

// ── Espejo del armado del Excel (:1541-1642) ────────────────────────────────
async function construirLibro(datos: any, periodoLabel: string, movsDetalle: any[]) {
  const { builtRows, cutData, totalVientres, catNameMap, nAdultos, nTern } = datos
  const nCria = CATS_PLANILLA.filter(c => c.grupo === "cria").length
  const nRecria = CATS_PLANILLA.filter(c => c.grupo === "recria").length

  const aoa: any[][] = []
  aoa.push(["Ea. Nazarenas"])
  aoa.push(["de Martinez Sobrado"])
  aoa.push(["PLANILLA DE HACIENDA"])
  aoa.push([`Período: ${periodoLabel}`])
  aoa.push([])

  const grupoRow: string[] = [""]
  grupoRow.push("CRÍA")
  for (let i = 1; i < nCria; i++) grupoRow.push("")
  grupoRow.push("RECRÍA / ENGORDE")
  for (let i = 1; i < nRecria; i++) grupoRow.push("")
  grupoRow.push(""); grupoRow.push(""); grupoRow.push(""); grupoRow.push(""); grupoRow.push("")
  aoa.push(grupoRow)

  aoa.push(["", ...CATS_PLANILLA.map(c => c.label), "Subtotal Adultos",
    ...CATS_TERNEROS.map(c => c.label), "Subtotal Terneros", "Total General"])

  builtRows.forEach((r: any) => aoa.push(r.vals))

  aoa.push([])
  aoa.push(["", "Total Vientres", `Vaca + Vaquillona = ${totalVientres}`])

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws["!cols"] = [{ wch: 18 }, ...Array(nAdultos).fill({ wch: 14 }), { wch: 16 },
    ...Array(nTern).fill({ wch: 18 }), { wch: 16 }, { wch: 14 }]
  const lastCol = 1 + nAdultos + 1 + nTern + 1 + 1 - 1
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } },
    { s: { r: 5, c: 1 }, e: { r: 5, c: nCria } },
    { s: { r: 5, c: nCria + 1 }, e: { r: 5, c: nCria + nRecria } },
  ]

  // ── Hoja 2: Detalle ──
  const detalleAoa: any[][] = []
  detalleAoa.push(["DETALLE DE MOVIMIENTOS"])
  detalleAoa.push([`Período: ${periodoLabel}`])
  detalleAoa.push([])
  detalleAoa.push(["Fecha", "Tipo", "Categoría", "Cantidad", "Peso Total (kg)", "Precio/kg",
    "Monto Total", "Proveedor/Cliente", "Observaciones"])

  for (const m of movsDetalle) {
    const tipoLabel = m.tipo === "cambio_categoria" ? (m.cantidad > 0 ? "Reclas. +" : "Reclas. -") :
      m.tipo === "ajuste_stock" ? (m.cantidad > 0 ? "Ajuste + (en Compras)" : "Ajuste - (en Mortandad)") :
      m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1)
    detalleAoa.push([ddmmyyyy(m.fecha), tipoLabel, catNameMap[m.categoria_id] || "",
      m.cantidad, m.peso_total_kg || "", m.precio_por_kg || "", m.monto_total || "",
      m.proveedor_cliente || "", m.observaciones || ""])
  }

  if (cutData.length > 0) {
    detalleAoa.push([])
    detalleAoa.push(["DETALLE CUT/DESCARTE"])
    detalleAoa.push(["Caravana", "Fecha Alta", "Tipo", "Pelo", "Motivo", "Estado"])
    for (const d of cutData) detalleAoa.push([d.caravana, d.fechaAlta, d.tipo, d.pelo, d.motivo, d.estado])
  }

  const ws2 = XLSX.utils.aoa_to_sheet(detalleAoa)
  ws2["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 14 },
    { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 30 }]
  ws2["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Planilla")
  XLSX.utils.book_append_sheet(wb, ws2, "Detalle")
  return wb
}

// ── Espejo del PDF (:1678-1870) ─────────────────────────────────────────────
function construirPDF(datos: any, periodoLabel: string, movsDetalle: any[]) {
  const { builtRows, cutData, totalVientres, catNameMap, existenciaFinal, nAdultos, nTern } = datos

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()

  const sepia = [101, 67, 33] as [number, number, number]
  const sepiaClaro = [180, 150, 110] as [number, number, number]
  const fondoHeader = [245, 240, 230] as [number, number, number]
  const fondoResaltado = [235, 228, 215] as [number, number, number]

  doc.setFontSize(16)
  doc.setTextColor(...sepia)
  doc.text("Ea. Nazarenas", pageW / 2, 15, { align: "center" })
  doc.setFontSize(11)
  doc.text("de Martinez Sobrado", pageW / 2, 21, { align: "center" })
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.text("PLANILLA DE HACIENDA", pageW / 2, 29, { align: "center" })
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`Período: ${periodoLabel}`, pageW / 2, 35, { align: "center" })

  doc.setDrawColor(...sepiaClaro)
  doc.setLineWidth(0.5)
  doc.line(15, 38, pageW - 15, 38)

  // Sin doble header: el grupo va como prefijo en la 1ra columna de cada grupo
  const criaLabels = CATS_PLANILLA.filter(c => c.grupo === "cria").map(c => c.label)
  const recriaLabels = CATS_PLANILLA.filter(c => c.grupo === "recria").map(c => c.label)
  const ternLabels = CATS_TERNEROS.map(c => c.label)
  const pdfCatHeaders = [
    "",
    ...criaLabels.map((l, i) => i === 0 ? `CRÍA\n${l}` : l),
    ...recriaLabels.map((l, i) => i === 0 ? `RECRÍA\n${l}` : l),
    "Subt.\nAdultos",
    ...ternLabels,
    "Subt.\nTern.",
    "Total\nGral.",
  ]

  const pdfBody = builtRows.map((r: any) =>
    (r.vals as (string | number)[]).map((v, i) => i === 0 ? v : fmtNum(v as number)))

  autoTable(doc, {
    startY: 42,
    head: [pdfCatHeaders],
    body: pdfBody,
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 1.5, textColor: [40, 30, 20], lineColor: [180, 160, 130], lineWidth: 0.2 },
    headStyles: { fillColor: fondoHeader, textColor: sepia, fontStyle: "bold", halign: "center", fontSize: 6 },
    columnStyles: { 0: { fontStyle: "bold", halign: "left", cellWidth: 22 } },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index > 0) data.cell.styles.halign = "right"
      const highlightRows = [0, 4, 8, 9]
      if (data.section === "body" && highlightRows.includes(data.row.index)) {
        data.cell.styles.fillColor = fondoResaltado
        data.cell.styles.fontStyle = "bold"
      }
      const subtotalCols = [nAdultos + 1, nAdultos + 1 + nTern + 1, nAdultos + 1 + nTern + 2]
      if (data.section === "body" && subtotalCols.includes(data.column.index)) {
        data.cell.styles.fontStyle = "bold"
      }
    },
  })

  const finalY = (doc as any).lastAutoTable?.finalY || 150
  doc.setFontSize(9)
  doc.setTextColor(...sepia)
  doc.setFont("helvetica", "bold")
  doc.text(`Total Vientres: Vaca (${fmtNum(existenciaFinal[0])}) + Vaq. Preñada (${fmtNum(existenciaFinal[1])}) = ${fmtNum(totalVientres)}`, 15, finalY + 7)

  // ── Página 2: detalle de movimientos (sólo si hay) ──
  const sanitizarPDF = (t: string) => t.replace(/[→←↑↓↔►◄▲▼•]/g, "-").replace(/[^\x00-\xFF]/g, "")
  const detalleBody = movsDetalle.map(m => {
    const tipoLabel = m.tipo === "cambio_categoria" ? (m.cantidad > 0 ? "Reclas. +" : "Reclas. -") :
      m.tipo === "ajuste_stock" ? (m.cantidad > 0 ? "Ajuste +" : "Ajuste -") :
      m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1)
    return [
      ddmmyyyy(m.fecha), tipoLabel, catNameMap[m.categoria_id] || "", String(m.cantidad),
      m.peso_total_kg ? fmtNum(m.peso_total_kg) : "-",
      m.precio_por_kg ? m.precio_por_kg.toLocaleString("es-AR", { minimumFractionDigits: 2 }) : "-",
      m.monto_total ? m.monto_total.toLocaleString("es-AR", { minimumFractionDigits: 2 }) : "-",
      sanitizarPDF(m.proveedor_cliente || ""),
      sanitizarPDF(m.observaciones || ""),
    ]
  })

  if (detalleBody.length > 0) {
    doc.addPage("a4", "landscape")
    doc.setFontSize(13)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...sepia)
    doc.text("DETALLE DE MOVIMIENTOS", pageW / 2, 15, { align: "center" })
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Período: ${periodoLabel}`, pageW / 2, 21, { align: "center" })
    doc.setDrawColor(...sepiaClaro)
    doc.line(15, 24, pageW - 15, 24)

    autoTable(doc, {
      startY: 28,
      head: [["Fecha", "Tipo", "Categoría", "Cant.", "Peso (kg)", "$/kg", "Monto $", "Proveedor/Cliente", "Observaciones"]],
      body: detalleBody,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 1.5, textColor: [40, 30, 20], lineColor: [180, 160, 130], lineWidth: 0.2 },
      headStyles: { fillColor: fondoHeader, textColor: sepia, fontStyle: "bold", halign: "center", fontSize: 7 },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
    })
  }

  // ── Página CUT/Descarte (siempre en hoja propia) ──
  if (cutData.length > 0) {
    doc.addPage("a4", "landscape")
    doc.setFontSize(13)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...sepia)
    doc.text("DETALLE CUT / DESCARTE", pageW / 2, 15, { align: "center" })
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Período: ${periodoLabel}`, pageW / 2, 21, { align: "center" })
    doc.setDrawColor(...sepiaClaro)
    doc.line(15, 24, pageW - 15, 24)

    autoTable(doc, {
      startY: 28,
      head: [["Caravana", "Fecha Alta", "Tipo (Cat. Previa)", "Pelo", "Motivo", "Estado"]],
      body: cutData.map((d: any) => [d.caravana, d.fechaAlta, d.tipo, d.pelo, d.motivo, d.estado]),
      theme: "grid",
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [40, 30, 20], lineColor: [180, 160, 130], lineWidth: 0.2 },
      headStyles: { fillColor: fondoHeader, textColor: sepia, fontStyle: "bold", halign: "center" },
      columnStyles: { 5: { halign: "center" } },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 5 && data.cell.raw === "Baja") {
          data.cell.styles.textColor = [160, 60, 60]
        }
      },
    })
  }

  // Pie en todas las páginas
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(150, 140, 130)
    doc.text(`Ea. Nazarenas — Planilla de Hacienda — ${periodoLabel}`, 15, doc.internal.pageSize.getHeight() - 5)
    doc.text(`Pág. ${p}/${totalPages}`, pageW - 15, doc.internal.pageSize.getHeight() - 5, { align: "right" })
  }

  return { doc, paginas: totalPages }
}

async function main() {
  const destino = process.argv[2] || `backup_planillas_hacienda_${new Date().toISOString().slice(0, 10)}`
  mkdirSync(destino, { recursive: true })

  const { data: rango } = await supabase.schema("productivo").from("movimientos_hacienda")
    .select("fecha").order("fecha").limit(1)
  if (!rango?.length) { console.log("No hay movimientos."); return }

  const primera = (rango[0] as any).fecha as string
  const hoy = new Date().toISOString().slice(0, 10)

  console.log(`\nPrimer movimiento: ${primera}   ·   Hoy: ${hoy}`)
  console.log(`Destino: ${destino}\n`)
  console.log("Archivo (.xlsx + .pdf)              Movs  Págs  StockAnt  ExistFinal  Vientres")
  console.log("─".repeat(80))

  // Escribe el par Excel + PDF de un período y devuelve la línea de resumen
  const emitir = async (desde: string, hasta: string, periodoLabel: string, base: string) => {
    const datos = await calcularDatosPlanilla(desde, hasta)
    const movsDetalle = await traerDetalle(desde, hasta)

    XLSX.writeFile(await construirLibro(datos, periodoLabel, movsDetalle), join(destino, `${base}.xlsx`))

    const { doc, paginas } = construirPDF(datos, periodoLabel, movsDetalle)
    writeFileSync(join(destino, `${base}.pdf`), Buffer.from(doc.output("arraybuffer")))

    const sAnt = datos.stockAnterior.reduce((s: number, v: number) => s + v, 0)
    const eFin = datos.existenciaFinal.reduce((s: number, v: number) => s + v, 0)
    console.log(`${base.padEnd(35)} ${String(movsDetalle.length).padStart(4)} ${String(paginas).padStart(5)} ${String(sAnt).padStart(9)} ${String(eFin).padStart(11)} ${String(datos.totalVientres).padStart(9)}`)
    return datos
  }

  // Una planilla por mes
  let a = parseInt(primera.slice(0, 4)), m = parseInt(primera.slice(5, 7)) - 1
  const aFin = parseInt(hoy.slice(0, 4)), mFin = parseInt(hoy.slice(5, 7)) - 1
  const avisos: string[] = []

  while (a < aFin || (a === aFin && m <= mFin)) {
    const desde = `${a}-${String(m + 1).padStart(2, "0")}-01`
    const ultimoDia = new Date(a, m + 1, 0).getDate()
    const hasta = `${a}-${String(m + 1).padStart(2, "0")}-${ultimoDia}`
    const periodoLabel = `${MESES[m]} ${a}`

    const datos = await emitir(desde, hasta, periodoLabel, `Planilla_Hacienda_${a}-${String(m + 1).padStart(2, "0")}`)
    if (Object.keys(datos.descartados).length) avisos.push(`${periodoLabel}: descartados ${JSON.stringify(datos.descartados)}`)
    if (datos.existenciaFinal.some((v: number) => v < 0)) avisos.push(`${periodoLabel}: hay existencia final NEGATIVA`)

    m++; if (m > 11) { m = 0; a++ }
  }

  // Punta a punta
  console.log("─".repeat(80))
  await emitir(primera, hoy, `${ddmmyyyy(primera)} al ${ddmmyyyy(hoy)}`, `Planilla_Hacienda_${primera}_${hoy}`)
  console.log("   ↑ punta a punta")

  if (avisos.length) {
    console.log("\n⚠️  Avisos:")
    avisos.forEach(a => console.log("   " + a))
  }
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
