"use client"

// Bloque de Análisis Productivo-Económico (engorde) — va DEBAJO de la segmentación,
// dentro del modal de historial de pesadas. Recibe los segmentos en vivo (props) para
// que mover los rangos recalcule el análisis. Modelo reconstruido del Excel
// "- Analisis Productivo-Economico.xlsx" (fórmulas leídas celda por celda).
//
// Inputs (amarillo): precios, conversión, desbaste%, CZ%, ración%, split.
// Vinculados (naranja): Cantidad y Peso Inicio (vienen del segmento, editables);
//   Días ↔ Fecha Fin y Maíz% ↔ Concentrado% (edito uno, se calcula el otro).
// v1: un solo bloque (sin escalonar etapas ni agrupar segmentos — pendiente).

import { useState } from "react"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export interface SegmentoAnalisis {
  label: string
  cantidad: number
  promedio: number
}

interface Props {
  secciones: SegmentoAnalisis[]
  total: { cantidad: number; promedio: number } | null
}

// ── Helpers de parseo (es-AR) ──────────────────────────────────────────────
const num = (s: string) => parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0
const pct = (s: string) => (parseFloat(String(s).replace(",", ".")) || 0) / 100
const money = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 })
const kg = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 })

// Fechas (yyyy-mm-dd) ↔ días
const addDays = (iso: string, d: number) => {
  const dt = new Date(iso + "T00:00:00")
  if (isNaN(dt.getTime())) return iso
  dt.setDate(dt.getDate() + d)
  return dt.toISOString().slice(0, 10)
}
const diffDays = (a: string, b: string) => {
  const da = new Date(a + "T00:00:00"), db = new Date(b + "T00:00:00")
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

// Inputs ya parseados (porcentajes como fracción, ej. 0.03). Función pura → se corre 1 vez por escenario.
interface CalcInputs {
  cant: number; d: number; conv: number; pIni: number
  desbEnt: number; desbSal: number; czEnt: number; czSal: number; mort: number
  precioCompra: number; precioVenta: number
  racionPV: number; maizPct: number; concPct: number; maizPrecio: number; concPrecio: number
}

function calcular(i: CalcInputs) {
  const kgGanados = i.d * i.conv                     // H17
  const pFin = i.pIni + kgGanados                    // L16
  const pProm = (pFin + i.pIni) / 2                  // H18
  // Entrada
  const mermaKgEnt = i.pIni * i.desbEnt
  const pNetoEnt = i.pIni - mermaKgEnt               // C17
  const brutoEnt = pNetoEnt * i.precioCompra         // C19
  const mermaCzEnt = brutoEnt * i.czEnt
  const netoEnt = brutoEnt - mermaCzEnt              // C20 = C28
  // Salida
  const mermaKgMort = pFin * i.mort                  // mortandad sobre bruto vendido
  const pTrasMort = pFin - mermaKgMort               // saldo tras mortandad
  const mermaKgSal = pTrasMort * i.desbSal           // desbaste sobre el saldo
  const pNetoSal = pTrasMort - mermaKgSal            // L17
  const brutoSal = pNetoSal * i.precioVenta          // L19
  const mermaCzSal = brutoSal * i.czSal
  const czNetoSal = brutoSal - mermaCzSal            // L20
  // Ración
  const racKgDia = pProm * i.racionPV                // H20
  const maizKgDia = racKgDia * i.maizPct             // H22
  const concKgDia = racKgDia * i.concPct             // H23
  const maizCosto = -i.maizPrecio * maizKgDia * i.d  // L22 (por cabeza)
  const concCosto = -concKgDia * i.d * i.concPrecio  // L23 (por cabeza)
  const costoRacion = maizCosto + concCosto          // L24
  const maizKgLote = maizKgDia * i.d * i.cant        // H24
  const concKgLote = concKgDia * i.d * i.cant        // H25
  // Resultado
  const netoSalida = czNetoSal + costoRacion         // L28
  const gananciaCab = netoSalida - netoEnt           // L30
  const gananciaTotal = gananciaCab * i.cant         // L31
  return {
    cant: i.cant, d: i.d, kgGanados, pFin, pProm,
    mermaKgEnt, pNetoEnt, brutoEnt, mermaCzEnt, netoEnt,
    mermaKgMort, pTrasMort, mermaKgSal, pNetoSal, brutoSal, mermaCzSal, czNetoSal,
    racKgDia, maizKgDia, concKgDia, maizCosto, concCosto, costoRacion, maizKgLote, concKgLote,
    netoSalida, gananciaCab, gananciaTotal,
  }
}

export function AnalisisProductivo({ secciones, total }: Props) {
  const [colapsado, setColapsado] = useState(true)
  const [fase, setFase] = useState("")
  const [notas, setNotas] = useState("")

  // Fuente: 'total' | índice de sección
  const [cantidad, setCantidad] = useState("0")
  const [pesoInicio, setPesoInicio] = useState("0")

  // Precios (inputs)
  const [maizPrecio, setMaizPrecio] = useState("270")
  const [concPrecio, setConcPrecio] = useState("745")
  const [tc, setTc] = useState("1450")
  const [precioCompra, setPrecioCompra] = useState("5.400")
  const [precioVenta, setPrecioVenta] = useState("5.000")

  // Período (fecha fin ↔ días)
  const hoy = new Date().toISOString().slice(0, 10)
  const [fechaInicio, setFechaInicio] = useState(hoy)
  const [fechaFin, setFechaFin] = useState(addDays(hoy, 74))
  const [dias, setDias] = useState("74")
  const [conversion, setConversion] = useState("0,7")

  // Mortandad (input %, solo salida — descuenta kg del bruto vendido)
  const [mortandad, setMortandad] = useState("0")
  // Desbaste / CZ (inputs %)
  const [desbEnt, setDesbEnt] = useState("3")
  const [desbSal, setDesbSal] = useState("5")
  const [czEnt, setCzEnt] = useState("4")
  const [czSal, setCzSal] = useState("4")

  // Ración
  const [racionPV, setRacionPV] = useState("1,5")
  const [maizPct, setMaizPct] = useState("85")
  const [concPct, setConcPct] = useState("15")

  // ── Handlers de pares vinculados ──
  const onDias = (v: string) => { setDias(v); setFechaFin(addDays(fechaInicio, parseInt(v) || 0)) }
  const onFechaFin = (v: string) => { setFechaFin(v); setDias(String(diffDays(fechaInicio, v))) }
  const onFechaInicio = (v: string) => { setFechaInicio(v); setFechaFin(addDays(v, parseInt(dias) || 0)) }
  const onMaizPct = (v: string) => { setMaizPct(v); setConcPct(String(100 - (parseFloat(v.replace(",", ".")) || 0))) }
  const onConcPct = (v: string) => { setConcPct(v); setMaizPct(String(100 - (parseFloat(v.replace(",", ".")) || 0))) }

  const usarFuente = (val: string) => {
    if (val === "total" && total) { setCantidad(String(total.cantidad)); setPesoInicio(String(Math.round(total.promedio))) }
    else {
      const s = secciones[parseInt(val)]
      if (s) { setCantidad(String(s.cantidad)); setPesoInicio(String(Math.round(s.promedio))) }
    }
  }

  // Overrides del escenario B (vacío = usa A)
  const [bPrecioVenta, setBPrecioVenta] = useState("")
  const [bPrecioCompra, setBPrecioCompra] = useState("")
  const [bMaiz, setBMaiz] = useState("")
  const [bConc, setBConc] = useState("")
  const [bMort, setBMort] = useState("")
  const [bConv, setBConv] = useState("")
  const [bDias, setBDias] = useState("")
  const [verB, setVerB] = useState(false)

  // ── Cálculo (mirror del Excel) — función pura, corrida por escenario ──
  const baseInputs: CalcInputs = {
    cant: num(cantidad), d: parseInt(dias) || 0, conv: num(conversion), pIni: num(pesoInicio),
    desbEnt: pct(desbEnt), desbSal: pct(desbSal), czEnt: pct(czEnt), czSal: pct(czSal), mort: pct(mortandad),
    precioCompra: num(precioCompra), precioVenta: num(precioVenta),
    racionPV: pct(racionPV), maizPct: pct(maizPct), concPct: pct(concPct), maizPrecio: num(maizPrecio), concPrecio: num(concPrecio),
  }
  const c = calcular(baseInputs)
  const cB = calcular({
    ...baseInputs,
    ...(bPrecioVenta.trim() ? { precioVenta: num(bPrecioVenta) } : {}),
    ...(bPrecioCompra.trim() ? { precioCompra: num(bPrecioCompra) } : {}),
    ...(bMaiz.trim() ? { maizPrecio: num(bMaiz) } : {}),
    ...(bConc.trim() ? { concPrecio: num(bConc) } : {}),
    ...(bMort.trim() ? { mort: pct(bMort) } : {}),
    ...(bConv.trim() ? { conv: num(bConv) } : {}),
    ...(bDias.trim() ? { d: parseInt(bDias) || 0 } : {}),
  })

  // ── Export Excel / PDF ──
  const round1 = (n: number) => Math.round(n * 10) / 10
  const nombreArch = () => `Analisis_${(fase || "engorde").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}`

  const filasExport = (): (string | number)[][] => [
    ["ANÁLISIS PRODUCTIVO-ECONÓMICO"],
    ["Fase", fase],
    [],
    ["Cantidad", c.cant],
    ["Maíz $/kg", num(maizPrecio)], ["Concentrado $/kg", num(concPrecio)], ["TC", num(tc)],
    ["Precio compra $/kg", num(precioCompra)], ["Precio venta $/kg", num(precioVenta)],
    ["Fecha inicio", fechaInicio], ["Fecha fin", fechaFin], ["Días", c.d],
    ["Conversión kg/día", num(conversion)], ["Kg ganados", round1(c.kgGanados)],
    [],
    ["", "ENTRADA (compra)", "SALIDA (venta)"],
    ["Peso", round1(num(pesoInicio)), round1(c.pFin)],
    ["Mortandad %", "", num(mortandad)],
    ["Merma kg (mortandad)", "", -round1(c.mermaKgMort)],
    ["Desbaste %", num(desbEnt), num(desbSal)],
    ["Merma kg", -round1(c.mermaKgEnt), -round1(c.mermaKgSal)],
    ["Peso neto (ref. precio)", round1(c.pNetoEnt), round1(c.pNetoSal)],
    ["Monto bruto", Math.round(c.brutoEnt), Math.round(c.brutoSal)],
    ["CZ (comerc.) %", num(czEnt), num(czSal)],
    ["Merma $", -Math.round(c.mermaCzEnt), -Math.round(c.mermaCzSal)],
    ["NETO", Math.round(c.netoEnt), Math.round(c.czNetoSal)],
    [],
    ["RACIÓN — peso prom.", round1(c.pProm)],
    ["Ración % PV", num(racionPV)], ["Ración kg/día", round1(c.racKgDia)],
    ["Maíz %", num(maizPct), "Concentrado %", num(concPct)],
    ["Maíz kg/día", round1(c.maizKgDia), "costo", Math.round(c.maizCosto), "Kg totales lote", Math.round(c.maizKgLote)],
    ["Concentrado kg/día", round1(c.concKgDia), "costo", Math.round(c.concCosto), "Kg totales lote", Math.round(c.concKgLote)],
    ["Costo ración total", Math.round(c.costoRacion)],
    [],
    ["Ganancia / cabeza", Math.round(c.gananciaCab)],
    ["Ganancia total", Math.round(c.gananciaTotal)],
    [],
    ["Notas", notas],
  ]

  const exportarExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet(filasExport())
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Análisis")
    XLSX.writeFile(wb, nombreArch() + ".xlsx")
  }

  const exportarPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(14); doc.text("Análisis productivo-económico", 14, 16)
    doc.setFontSize(10); doc.text(`Fase: ${fase || "—"}   ·   ${new Date().toLocaleDateString("es-AR")}`, 14, 23)
    autoTable(doc, {
      startY: 28, theme: "grid", styles: { fontSize: 8 }, head: [["Parámetro", "Valor"]],
      body: [
        ["Cantidad", String(c.cant)],
        ["Precio compra $/kg → neto", `$${money(num(precioCompra))}  (neto ${kg(c.pNetoEnt)} kg)`],
        ["Precio venta $/kg → neto", `$${money(num(precioVenta))}  (neto ${kg(c.pNetoSal)} kg)`],
        ["Período", `${fechaInicio} → ${fechaFin} (${c.d} días)`],
        ["Conversión kg/día", conversion], ["Kg ganados", kg(c.kgGanados)],
      ],
    })
    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4, theme: "grid", styles: { fontSize: 8 },
      head: [["", "Entrada (compra)", "Salida (venta)"]],
      body: [
        ["Peso", `${kg(num(pesoInicio))} kg`, `${kg(c.pFin)} kg`],
        ["Mortandad %", "—", `${mortandad}%  (-${kg(c.mermaKgMort)} kg)`],
        ["Desbaste %", `${desbEnt}%`, `${desbSal}%`],
        ["Merma kg", `-${kg(c.mermaKgEnt)}`, `-${kg(c.mermaKgSal)}`],
        ["Peso neto", `${kg(c.pNetoEnt)} kg`, `${kg(c.pNetoSal)} kg`],
        ["Monto bruto", `$${money(c.brutoEnt)}`, `$${money(c.brutoSal)}`],
        ["CZ %", `${czEnt}%`, `${czSal}%`],
        ["Merma $", `-$${money(c.mermaCzEnt)}`, `-$${money(c.mermaCzSal)}`],
        ["NETO", `$${money(c.netoEnt)}`, `$${money(c.czNetoSal)}`],
      ],
    })
    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4, theme: "grid", styles: { fontSize: 8 },
      head: [["Ración", "kg/día", "Costo/cab", "Kg totales lote"]],
      body: [
        ["Maíz", kg(c.maizKgDia), `-$${money(-c.maizCosto)}`, money(c.maizKgLote)],
        ["Concentrado", kg(c.concKgDia), `-$${money(-c.concCosto)}`, money(c.concKgLote)],
        ["Costo ración total", "", `-$${money(-c.costoRacion)}`, ""],
      ],
    })
    const yEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    doc.setFontSize(11)
    doc.text(`Ganancia / cabeza: $${money(c.gananciaCab)}`, 14, yEnd)
    doc.text(`Ganancia total (x${c.cant}): $${money(c.gananciaTotal)}`, 14, yEnd + 7)
    if (notas) { doc.setFontSize(9); doc.text("Notas:", 14, yEnd + 16); doc.text(doc.splitTextToSize(notas, 180) as string[], 14, yEnd + 21) }
    doc.save(nombreArch() + ".pdf")
  }

  const inp = "border rounded px-1 py-0.5 text-right"
  const lbl = "text-gray-500"

  return (
    <div className="mb-4 border rounded-lg p-3 bg-emerald-50/40">
      <div className="flex items-center gap-2 mb-2">
        <button type="button" onClick={() => setColapsado(v => !v)} className="flex items-center gap-2 flex-1 text-left font-semibold text-gray-700">
          <span className="text-gray-400">{colapsado ? "▶" : "▼"}</span>
          <span>Análisis productivo-económico</span>
          {!colapsado || c.cant > 0
            ? <span className="text-xs font-normal text-emerald-700">· Ganancia total: ${money(c.gananciaTotal)}</span>
            : null}
        </button>
        {!colapsado && (<>
          <button type="button" onClick={exportarExcel} className="text-xs px-2 py-1 rounded border border-emerald-400 text-emerald-700 hover:bg-emerald-50">⬇ Excel</button>
          <button type="button" onClick={exportarPDF} className="text-xs px-2 py-1 rounded border border-red-400 text-red-700 hover:bg-red-50">⬇ PDF</button>
        </>)}
      </div>

      {!colapsado && (
        <div className="text-sm space-y-3">
          {/* Fase + fuente */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-1">
              <span className={lbl}>Fase</span>
              <input value={fase} onChange={e => setFase(e.target.value)} placeholder="nombre" className="border rounded px-1 py-0.5 w-28" />
            </span>
            <span className="flex items-center gap-1">
              <span className={lbl}>Fuente</span>
              <select onChange={e => usarFuente(e.target.value)} defaultValue="" className="border rounded px-1 py-0.5">
                <option value="" disabled>elegí…</option>
                {total && <option value="total">Total rodeo ({total.cantidad} cab · {Math.round(total.promedio)} kg)</option>}
                {secciones.map((s, i) => s.cantidad > 0 && (
                  <option key={i} value={i}>{s.label} ({s.cantidad} cab · {Math.round(s.promedio)} kg)</option>
                ))}
              </select>
            </span>
            <span className="flex items-center gap-1">
              <span className={lbl}>Cantidad 🟠</span>
              <input value={cantidad} onChange={e => setCantidad(e.target.value)} className={`${inp} w-16`} />
            </span>
          </div>

          {/* Precios */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-medium text-gray-600">Precios</span>
            <span className="flex items-center gap-1"><span className={lbl}>Maíz $/kg</span><input value={maizPrecio} onChange={e => setMaizPrecio(e.target.value)} className={`${inp} w-20`} /></span>
            <span className="flex items-center gap-1"><span className={lbl}>Concentrado $/kg</span><input value={concPrecio} onChange={e => setConcPrecio(e.target.value)} className={`${inp} w-20`} /></span>
            <span className="flex items-center gap-1"><span className={lbl}>TC</span><input value={tc} onChange={e => setTc(e.target.value)} className={`${inp} w-20`} /></span>
            <span className="flex items-center gap-1"><span className={lbl}>Compra $/kg</span><input value={precioCompra} onChange={e => setPrecioCompra(e.target.value)} className={`${inp} w-20`} /><span className="text-xs text-gray-400">(neto {kg(c.pNetoEnt)} kg)</span></span>
            <span className="flex items-center gap-1"><span className={lbl}>Venta $/kg</span><input value={precioVenta} onChange={e => setPrecioVenta(e.target.value)} className={`${inp} w-20`} /><span className="text-xs text-gray-400">(neto {kg(c.pNetoSal)} kg)</span></span>
          </div>

          {/* Período */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-medium text-gray-600">Período</span>
            <span className="flex items-center gap-1"><span className={lbl}>Inicio</span><input type="date" value={fechaInicio} onChange={e => onFechaInicio(e.target.value)} className="border rounded px-1 py-0.5" /></span>
            <span className="flex items-center gap-1"><span className={lbl}>Fin 🟠</span><input type="date" value={fechaFin} onChange={e => onFechaFin(e.target.value)} className="border rounded px-1 py-0.5" /></span>
            <span className="flex items-center gap-1"><span className={lbl}>Días 🟠</span><input value={dias} onChange={e => onDias(e.target.value)} className={`${inp} w-14`} /></span>
            <span className="flex items-center gap-1"><span className={lbl}>Conversión kg/día</span><input value={conversion} onChange={e => setConversion(e.target.value)} className={`${inp} w-16`} /></span>
            <span className={lbl}>Kg ganados: <b className="text-gray-700">{kg(c.kgGanados)}</b></span>
          </div>

          {/* Cuadro Entrada / Salida */}
          <table className="text-sm">
            <thead>
              <tr className="text-gray-500 border-b">
                <th className="text-left pr-4 py-1"></th>
                <th className="text-right px-3">Entrada (compra)</th>
                <th className="text-right px-3">Salida (venta)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${lbl} pr-4`}>Peso {"🟠"}</td>
                <td className="text-right px-3"><input value={pesoInicio} onChange={e => setPesoInicio(e.target.value)} className={`${inp} w-16`} /> kg</td>
                <td className="text-right px-3">{kg(c.pFin)} kg</td>
              </tr>
              <tr>
                <td className={`${lbl} pr-4`}>Mortandad %</td>
                <td className="text-right px-3 text-gray-300">—</td>
                <td className="text-right px-3"><input value={mortandad} onChange={e => setMortandad(e.target.value)} className={`${inp} w-12`} /> %</td>
              </tr>
              <tr className="text-red-500">
                <td className="pr-4 pl-2 text-xs">merma kg</td>
                <td className="text-right px-3 text-gray-300">—</td>
                <td className="text-right px-3">−{kg(c.mermaKgMort)}</td>
              </tr>
              <tr>
                <td className={`${lbl} pr-4`}>Desbaste %</td>
                <td className="text-right px-3"><input value={desbEnt} onChange={e => setDesbEnt(e.target.value)} className={`${inp} w-12`} /> %</td>
                <td className="text-right px-3"><input value={desbSal} onChange={e => setDesbSal(e.target.value)} className={`${inp} w-12`} /> %</td>
              </tr>
              <tr className="text-red-500">
                <td className="pr-4 pl-2 text-xs">merma kg</td>
                <td className="text-right px-3">−{kg(c.mermaKgEnt)}</td>
                <td className="text-right px-3">−{kg(c.mermaKgSal)}</td>
              </tr>
              <tr>
                <td className={`${lbl} pr-4`}>Peso neto</td>
                <td className="text-right px-3">{kg(c.pNetoEnt)} kg</td>
                <td className="text-right px-3">{kg(c.pNetoSal)} kg</td>
              </tr>
              <tr>
                <td className={`${lbl} pr-4`}>Monto bruto</td>
                <td className="text-right px-3">${money(c.brutoEnt)}</td>
                <td className="text-right px-3">${money(c.brutoSal)}</td>
              </tr>
              <tr>
                <td className={`${lbl} pr-4`}>CZ (comerc.) %</td>
                <td className="text-right px-3"><input value={czEnt} onChange={e => setCzEnt(e.target.value)} className={`${inp} w-12`} /> %</td>
                <td className="text-right px-3"><input value={czSal} onChange={e => setCzSal(e.target.value)} className={`${inp} w-12`} /> %</td>
              </tr>
              <tr className="text-red-500">
                <td className="pr-4 pl-2 text-xs">merma $</td>
                <td className="text-right px-3">−${money(c.mermaCzEnt)}</td>
                <td className="text-right px-3">−${money(c.mermaCzSal)}</td>
              </tr>
              <tr className="font-semibold border-t">
                <td className="pr-4 py-1">NETO</td>
                <td className="text-right px-3">${money(c.netoEnt)}</td>
                <td className="text-right px-3">${money(c.czNetoSal)}</td>
              </tr>
            </tbody>
          </table>

          {/* Ración */}
          <div className="border-t pt-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-medium text-gray-600">Ración</span>
              <span className={lbl}>s/ peso prom. <b className="text-gray-700">{kg(c.pProm)}</b></span>
              <span className="flex items-center gap-1"><span className={lbl}>% PV</span><input value={racionPV} onChange={e => setRacionPV(e.target.value)} className={`${inp} w-12`} /> %</span>
              <span className={lbl}>= <b className="text-gray-700">{kg(c.racKgDia)}</b> kg/día</span>
              <span className="flex items-center gap-1"><span className={lbl}>Maíz % 🟠</span><input value={maizPct} onChange={e => onMaizPct(e.target.value)} className={`${inp} w-12`} /> %</span>
              <span className="flex items-center gap-1"><span className={lbl}>Concentrado % 🟠</span><input value={concPct} onChange={e => onConcPct(e.target.value)} className={`${inp} w-12`} /> %</span>
            </div>
            <table className="text-sm mt-1">
              <tbody>
                <tr>
                  <td className={`${lbl} pr-4`}>Maíz</td>
                  <td className="text-right px-3">{kg(c.maizKgDia)} kg/día</td>
                  <td className="text-right px-3 text-red-500">costo −${money(-c.maizCosto)}</td>
                  <td className="text-right px-3 text-gray-500">Kg totales lote: {money(c.maizKgLote)}</td>
                </tr>
                <tr>
                  <td className={`${lbl} pr-4`}>Concentrado</td>
                  <td className="text-right px-3">{kg(c.concKgDia)} kg/día</td>
                  <td className="text-right px-3 text-red-500">costo −${money(-c.concCosto)}</td>
                  <td className="text-right px-3 text-gray-500">Kg totales lote: {money(c.concKgLote)}</td>
                </tr>
                <tr className="font-medium border-t">
                  <td className="pr-4 py-1">Costo ración total</td>
                  <td></td>
                  <td className="text-right px-3 text-red-600">−${money(-c.costoRacion)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Resultado + comparador escenario B */}
          <div className="border-t pt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-gray-600">Resultado</span>
              <button type="button" onClick={() => setVerB(v => !v)} className="text-xs px-2 py-1 rounded border border-indigo-400 text-indigo-700 hover:bg-indigo-50">
                {verB ? "Ocultar escenario B" : "＋ Comparar escenario B"}
              </button>
            </div>

            {verB && (
              <div className="p-2 rounded-lg bg-indigo-50/60 border border-indigo-200">
                <div className="text-xs text-indigo-700 mb-1">Escenario B — cargá solo lo que cambia (vacío = usa A):</div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="flex items-center gap-1"><span className={lbl}>Venta $/kg</span><input placeholder={precioVenta} value={bPrecioVenta} onChange={e => setBPrecioVenta(e.target.value)} className={`${inp} w-20`} /></span>
                  <span className="flex items-center gap-1"><span className={lbl}>Compra $/kg</span><input placeholder={precioCompra} value={bPrecioCompra} onChange={e => setBPrecioCompra(e.target.value)} className={`${inp} w-20`} /></span>
                  <span className="flex items-center gap-1"><span className={lbl}>Maíz $/kg</span><input placeholder={maizPrecio} value={bMaiz} onChange={e => setBMaiz(e.target.value)} className={`${inp} w-20`} /></span>
                  <span className="flex items-center gap-1"><span className={lbl}>Concentrado $/kg</span><input placeholder={concPrecio} value={bConc} onChange={e => setBConc(e.target.value)} className={`${inp} w-20`} /></span>
                  <span className="flex items-center gap-1"><span className={lbl}>Mortandad %</span><input placeholder={mortandad} value={bMort} onChange={e => setBMort(e.target.value)} className={`${inp} w-12`} /></span>
                  <span className="flex items-center gap-1"><span className={lbl}>Conversión</span><input placeholder={conversion} value={bConv} onChange={e => setBConv(e.target.value)} className={`${inp} w-14`} /></span>
                  <span className="flex items-center gap-1"><span className={lbl}>Días</span><input placeholder={dias} value={bDias} onChange={e => setBDias(e.target.value)} className={`${inp} w-14`} /></span>
                  <button type="button" onClick={() => { setBPrecioVenta(""); setBPrecioCompra(""); setBMaiz(""); setBConc(""); setBMort(""); setBConv(""); setBDias("") }} className="text-xs text-indigo-600 hover:underline">Limpiar B</button>
                </div>
              </div>
            )}

            <table className="text-sm">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="text-left pr-4"></th>
                  <th className="text-right px-3">Escenario A</th>
                  {verB && <th className="text-right px-3 text-indigo-700">Escenario B</th>}
                  {verB && <th className="text-right px-3">Δ (B−A)</th>}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`${lbl} pr-4`}>Ganancia / cabeza</td>
                  <td className="text-right px-3"><b className={c.gananciaCab >= 0 ? "text-emerald-700" : "text-red-600"}>${money(c.gananciaCab)}</b></td>
                  {verB && <td className="text-right px-3"><b className={cB.gananciaCab >= 0 ? "text-emerald-700" : "text-red-600"}>${money(cB.gananciaCab)}</b></td>}
                  {verB && <td className={`text-right px-3 font-medium ${cB.gananciaCab - c.gananciaCab >= 0 ? "text-emerald-700" : "text-red-600"}`}>{cB.gananciaCab - c.gananciaCab >= 0 ? "+" : ""}{money(cB.gananciaCab - c.gananciaCab)}</td>}
                </tr>
                <tr>
                  <td className={`${lbl} pr-4`}>Ganancia total (×{c.cant})</td>
                  <td className="text-right px-3"><b className={`text-base ${c.gananciaTotal >= 0 ? "text-emerald-700" : "text-red-600"}`}>${money(c.gananciaTotal)}</b></td>
                  {verB && <td className="text-right px-3"><b className={`text-base ${cB.gananciaTotal >= 0 ? "text-emerald-700" : "text-red-600"}`}>${money(cB.gananciaTotal)}</b></td>}
                  {verB && <td className={`text-right px-3 font-semibold ${cB.gananciaTotal - c.gananciaTotal >= 0 ? "text-emerald-700" : "text-red-600"}`}>{cB.gananciaTotal - c.gananciaTotal >= 0 ? "+" : ""}{money(cB.gananciaTotal - c.gananciaTotal)}</td>}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notas */}
          <div className="border-t pt-2">
            <span className={lbl}>Notas</span>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Anotaciones del análisis (van al Excel y al PDF)…" className="w-full border rounded px-2 py-1 mt-1 text-sm" />
          </div>
        </div>
      )}
    </div>
  )
}
