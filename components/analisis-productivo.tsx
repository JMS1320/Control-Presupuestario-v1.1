"use client"

// Bloque de Análisis Productivo-Económico (engorde) — va DEBAJO de la segmentación,
// dentro del modal de historial de pesadas. Recibe los segmentos en vivo (props) para
// que mover los rangos recalcule el análisis. Modelo reconstruido del Excel
// "- Analisis Productivo-Economico.xlsx" (fórmulas leídas celda por celda).
//
// Inputs (amarillo): precios, conversión, desbaste%, CZ%, ración%, split.
// Vinculados (naranja): Cantidad y Peso Inicio (vienen del segmento, editables);
//   Días ↔ Fecha Fin y Maíz% ↔ Concentrado% (edito uno, se calcula el otro).
// Multi-segmento: cada columna = un segmento (AnalisisSegmento), en vertical el encadenamiento.
// El contenedor AnalisisProductivo pone los segmentos en horizontal y suma el total combinado.

import { useState, useEffect, useRef, type ChangeEvent } from "react"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { toast } from "sonner"

const LS_ESTUDIOS = "analisis_engorde_estudios"
interface Estudio { version: number; fecha: string; segments: SegState[] }

export interface SegmentoAnalisis {
  label: string
  cantidad: number
  promedio: number
}

interface Props {
  secciones: SegmentoAnalisis[]
  total: { cantidad: number; promedio: number } | null
}

// Estado serializable de un segmento (para guardar/cargar estudios)
interface SegState {
  fase: string; notas: string
  cantidad: string; pesoInicio: string
  maizPrecio: string; concPrecio: string; tc: string; precioCompra: string; precioVenta: string
  fechaInicio: string; fechaFin: string; dias: string; conversion: string
  mortandad: string; desbEnt: string; desbSal: string; czEnt: string; czSal: string
  racionPV: string; maizPct: string; concPct: string
  bPrecioVenta: string; bPrecioCompra: string; bMaiz: string; bConc: string; bMort: string; bConv: string; bDias: string; verB: boolean
  etapas: StageForm[]
}

interface SegProps extends Props {
  indice: number
  onRemove?: () => void
  onTotal?: (v: number) => void
  initial?: Partial<SegState>
  onState?: (s: SegState) => void
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

// Etapa encadenada (además de la etapa 1, que usa el estado top-level). Solo peso y fecha se propagan.
interface StageForm {
  nombre: string; dias: string; conversion: string
  precioVenta: string; maizPrecio: string; concPrecio: string
  desbSal: string; czSal: string; mort: string
  racionPV: string; maizPct: string; concPct: string
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

function AnalisisSegmento({ secciones, total, indice, onRemove, onTotal, initial, onState }: SegProps) {
  const letra = String.fromCharCode(65 + indice) // A, B, C…
  const hoy = new Date().toISOString().slice(0, 10)
  const g = <K extends keyof SegState>(k: K, def: SegState[K]): SegState[K] => (initial?.[k] ?? def) as SegState[K]
  const [colapsado, setColapsado] = useState(indice > 0)
  const [fase, setFase] = useState(g("fase", ""))
  const [notas, setNotas] = useState(g("notas", ""))

  // Fuente: 'total' | índice de sección
  const [cantidad, setCantidad] = useState(g("cantidad", "0"))
  const [pesoInicio, setPesoInicio] = useState(g("pesoInicio", "0"))

  // Precios (inputs)
  const [maizPrecio, setMaizPrecio] = useState(g("maizPrecio", "270"))
  const [concPrecio, setConcPrecio] = useState(g("concPrecio", "745"))
  const [tc, setTc] = useState(g("tc", "1450"))
  const [precioCompra, setPrecioCompra] = useState(g("precioCompra", "5.400"))
  const [precioVenta, setPrecioVenta] = useState(g("precioVenta", "5.000"))

  // Período (fecha fin ↔ días)
  const [fechaInicio, setFechaInicio] = useState(g("fechaInicio", hoy))
  const [fechaFin, setFechaFin] = useState(g("fechaFin", addDays(hoy, 74)))
  const [dias, setDias] = useState(g("dias", "74"))
  const [conversion, setConversion] = useState(g("conversion", "0,7"))

  // Mortandad (input %, solo salida — descuenta kg del bruto vendido)
  const [mortandad, setMortandad] = useState(g("mortandad", "0"))
  // Desbaste / CZ (inputs %)
  const [desbEnt, setDesbEnt] = useState(g("desbEnt", "3"))
  const [desbSal, setDesbSal] = useState(g("desbSal", "5"))
  const [czEnt, setCzEnt] = useState(g("czEnt", "4"))
  const [czSal, setCzSal] = useState(g("czSal", "4"))

  // Ración
  const [racionPV, setRacionPV] = useState(g("racionPV", "1,5"))
  const [maizPct, setMaizPct] = useState(g("maizPct", "85"))
  const [concPct, setConcPct] = useState(g("concPct", "15"))

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
  const [bPrecioVenta, setBPrecioVenta] = useState(g("bPrecioVenta", ""))
  const [bPrecioCompra, setBPrecioCompra] = useState(g("bPrecioCompra", ""))
  const [bMaiz, setBMaiz] = useState(g("bMaiz", ""))
  const [bConc, setBConc] = useState(g("bConc", ""))
  const [bMort, setBMort] = useState(g("bMort", ""))
  const [bConv, setBConv] = useState(g("bConv", ""))
  const [bDias, setBDias] = useState(g("bDias", ""))
  const [verB, setVerB] = useState(g("verB", false))

  // ── Cálculo (mirror del Excel) — función pura, corrida por escenario ──
  const baseInputs: CalcInputs = {
    cant: num(cantidad), d: parseInt(dias) || 0, conv: num(conversion), pIni: num(pesoInicio),
    desbEnt: pct(desbEnt), desbSal: pct(desbSal), czEnt: pct(czEnt), czSal: pct(czSal), mort: pct(mortandad),
    precioCompra: num(precioCompra), precioVenta: num(precioVenta),
    racionPV: pct(racionPV), maizPct: pct(maizPct), concPct: pct(concPct), maizPrecio: num(maizPrecio), concPrecio: num(concPrecio),
  }
  // Etapas encadenadas (v2). Etapa 1 = estado top-level; estas son las siguientes.
  const [etapas, setEtapas] = useState<StageForm[]>(g("etapas", []))
  const addEtapa = () => setEtapas(prev => [...prev, {
    nombre: `Etapa ${prev.length + 2}`, dias: "60", conversion, precioVenta,
    maizPrecio, concPrecio, desbSal, czSal, mort: mortandad, racionPV, maizPct, concPct,
  }])
  const updEtapa = (idx: number, campo: keyof StageForm, val: string) =>
    setEtapas(prev => prev.map((e, i) => i === idx ? { ...e, [campo]: val } : e))
  const delEtapa = (idx: number) => setEtapas(prev => prev.filter((_, i) => i !== idx))

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

  // ── Cadena de etapas (encadenamiento) ──
  // Etapa k: peso y fecha propagan; mortandad reduce la cantidad que pasa a la siguiente.
  // Ración de cada etapa usa la cantidad de INICIO (sin descontar su mortandad).
  // Ganancia etapa 1 = V1 − compra − ración1; etapa k = Vk − V(k−1) − ración_k (costo de oportunidad).
  interface PasoCadena {
    nombre: string; fechaIni: string; fechaFin: string
    pIni: number; pFin: number; cant: number; V: number; R: number; ganancia: number
  }
  const cadena: { pasos: PasoCadena[]; totalPunta: number } = (() => {
    const pasos: PasoCadena[] = []
    // Etapa 1 (del estado top-level, ya calculada en c)
    const V1 = c.czNetoSal * c.cant
    const R1 = -c.costoRacion * c.cant
    pasos.push({ nombre: fase || "Etapa 1", fechaIni: fechaInicio, fechaFin, pIni: num(pesoInicio), pFin: c.pFin, cant: c.cant, V: V1, R: R1, ganancia: c.gananciaTotal })
    let prevV = V1
    let cantAct = c.cant * (1 - pct(mortandad))
    let pesoAct = c.pFin
    let fechaAct = fechaFin
    etapas.forEach((e, idx) => {
      const ck = calcular({
        cant: cantAct, d: parseInt(e.dias) || 0, conv: num(e.conversion), pIni: pesoAct,
        desbEnt: 0, desbSal: pct(e.desbSal), czEnt: 0, czSal: pct(e.czSal), mort: pct(e.mort),
        precioCompra: 0, precioVenta: num(e.precioVenta),
        racionPV: pct(e.racionPV), maizPct: pct(e.maizPct), concPct: pct(e.concPct), maizPrecio: num(e.maizPrecio), concPrecio: num(e.concPrecio),
      })
      const Vk = ck.czNetoSal * ck.cant
      const Rk = -ck.costoRacion * ck.cant
      const gk = Vk - prevV - Rk
      const fFin = addDays(fechaAct, parseInt(e.dias) || 0)
      pasos.push({ nombre: e.nombre || `Etapa ${idx + 2}`, fechaIni: fechaAct, fechaFin: fFin, pIni: pesoAct, pFin: ck.pFin, cant: ck.cant, V: Vk, R: Rk, ganancia: gk })
      prevV = Vk
      cantAct = ck.cant * (1 - pct(e.mort))
      pesoAct = ck.pFin
      fechaAct = fFin
    })
    return { pasos, totalPunta: pasos.reduce((s, p) => s + p.ganancia, 0) }
  })()

  // Reportar el total de este segmento al contenedor (para el combinado)
  const totalSeg = etapas.length > 0 ? cadena.totalPunta : c.gananciaTotal
  useEffect(() => { onTotal?.(totalSeg) }, [totalSeg]) // eslint-disable-line react-hooks/exhaustive-deps

  // Snapshot serializable → reportar al contenedor (para guardar/cargar estudios)
  const snapshot: SegState = {
    fase, notas, cantidad, pesoInicio, maizPrecio, concPrecio, tc, precioCompra, precioVenta,
    fechaInicio, fechaFin, dias, conversion, mortandad, desbEnt, desbSal, czEnt, czSal,
    racionPV, maizPct, concPct, bPrecioVenta, bPrecioCompra, bMaiz, bConc, bMort, bConv, bDias, verB, etapas,
  }
  const snapKey = JSON.stringify(snapshot)
  useEffect(() => { onState?.(snapshot) }, [snapKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Contra-cálculo: punto de equilibrio (etapa 1 / decisión de entrada) ──
  // Coincide EXACTO con el modelo (test verificado). Precios NETOS = tras desbaste+CZ+mort.
  const pIniBE = num(pesoInicio)
  const convBE = num(conversion)
  const PcEf = pIniBE > 0 ? c.netoEnt / pIniBE : 0         // $/kg peso entrada, neto
  const PvEf = c.pFin > 0 ? c.czNetoSal / c.pFin : 0       // $/kg peso final, neto
  const perdidaIniCab = pIniBE * (PcEf - PvEf)             // pérdida por cab a recuperar
  const costoKgProd = c.kgGanados > 0 ? -c.costoRacion / c.kgGanados : 0
  const margenKg = PvEf - costoKgProd
  const kgRecuperar = margenKg !== 0 ? perdidaIniCab / margenKg : Infinity
  const diasRecuperar = convBE > 0 ? kgRecuperar / convBE : Infinity
  const diasRestantes = c.d - diasRecuperar
  const beValido = margenKg > 0 && c.kgGanados > 0 && pIniBE > 0
  const gananciaBECab = margenKg * convBE * diasRestantes  // = c.gananciaCab

  // ── Export Excel / PDF ──
  const round1 = (n: number) => Math.round(n * 10) / 10
  const nombreArch = () => `Analisis_${(fase || "engorde").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}`

  const filasExport = (): (string | number)[][] => {
    const rows: (string | number)[][] = [
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
      ["Precio neto $/kg vivo (sin desbaste)", pIniBE > 0 ? round1(c.netoEnt / pIniBE) : "", c.pFin > 0 ? round1(c.czNetoSal / c.pFin) : ""],
      ["Precio neto $/kg (con desbaste)", c.pNetoEnt > 0 ? round1(c.netoEnt / c.pNetoEnt) : "", c.pNetoSal > 0 ? round1(c.czNetoSal / c.pNetoSal) : ""],
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
      ["PUNTO DE EQUILIBRIO"],
      ...(beValido ? [
        ["Precio neto entrada $/kg", round1(PcEf)],
        ["Precio neto venta $/kg", round1(PvEf)],
        ["Costo por kg producido", round1(costoKgProd)],
        ["Margen por kg producido (venta − costo)", round1(margenKg)],
        ["Pérdida inicial por cabeza", Math.round(perdidaIniCab)],
        ["Kg para recuperarla (pérdida ÷ margen)", Math.round(kgRecuperar)],
        ["Días para recuperarla (kg ÷ conv.)", Math.round(diasRecuperar)],
        ["Días del ciclo", c.d, "Días productivos tuyos", Math.round(diasRestantes)],
        ["Ganancia por cabeza (equilibrio)", Math.round(gananciaBECab)],
        ["Ganancia total (× cab)", Math.round(gananciaBECab * c.cant)],
      ] as (string | number)[][] : [["Margen por kg ≤ 0 → operación perdedora (no recupera)"]]),
    ]
    if (verB) {
      rows.push([], ["COMPARACIÓN ESCENARIO B (overrides; vacío = usa A)"])
      if (bPrecioVenta.trim()) rows.push(["B · Venta $/kg", num(bPrecioVenta)])
      if (bPrecioCompra.trim()) rows.push(["B · Compra $/kg", num(bPrecioCompra)])
      if (bMaiz.trim()) rows.push(["B · Maíz $/kg", num(bMaiz)])
      if (bConc.trim()) rows.push(["B · Concentrado $/kg", num(bConc)])
      if (bMort.trim()) rows.push(["B · Mortandad %", num(bMort)])
      if (bConv.trim()) rows.push(["B · Conversión kg/día", num(bConv)])
      if (bDias.trim()) rows.push(["B · Días", parseInt(bDias) || 0])
      rows.push(
        ["", "A", "B", "Δ (B−A)"],
        ["Ganancia / cabeza", Math.round(c.gananciaCab), Math.round(cB.gananciaCab), Math.round(cB.gananciaCab - c.gananciaCab)],
        ["Ganancia total", Math.round(c.gananciaTotal), Math.round(cB.gananciaTotal), Math.round(cB.gananciaTotal - c.gananciaTotal)],
      )
    }
    if (etapas.length > 0) {
      rows.push([], ["CADENA DE ETAPAS"], ["Etapa", "Desde", "Hasta", "Peso ini", "Peso fin", "Cant", "Venta hipot.", "Ganancia"])
      cadena.pasos.forEach(p => rows.push([p.nombre, p.fechaIni, p.fechaFin, round1(p.pIni), round1(p.pFin), Math.round(p.cant), Math.round(p.V), Math.round(p.ganancia)]))
      rows.push(["Ganancia total punta a punta", "", "", "", "", "", "", Math.round(cadena.totalPunta)])
    }
    rows.push([], ["Notas", notas])
    return rows
  }

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
        ["$/kg vivo (sin desbaste)", pIniBE > 0 ? `$${money(c.netoEnt / pIniBE)}` : "—", c.pFin > 0 ? `$${money(c.czNetoSal / c.pFin)}` : "—"],
        ["$/kg neto (con desbaste)", c.pNetoEnt > 0 ? `$${money(c.netoEnt / c.pNetoEnt)}` : "—", c.pNetoSal > 0 ? `$${money(c.czNetoSal / c.pNetoSal)}` : "—"],
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
    let yCur = yEnd + 7
    if (beValido) {
      autoTable(doc, {
        startY: yCur + 5, theme: "grid", styles: { fontSize: 8 },
        head: [["Punto de equilibrio", "Valor", "Cuenta"]],
        body: [
          ["Precio neto entrada / venta", `$${money(PcEf)} / $${money(PvEf)} por kg`, "tras desbaste + CZ"],
          ["Costo por kg producido", `$${money(costoKgProd)}`, "ración ÷ kg ganados"],
          ["Margen por kg producido", `$${money(margenKg)}`, "venta − costo"],
          ["Pérdida inicial por cabeza", `$${money(perdidaIniCab)}`, `${kg(pIniBE)}kg × (ent−venta)`],
          ["Kg para recuperarla", `${Math.round(kgRecuperar)} kg`, "pérdida ÷ margen"],
          ["Días para recuperarla", `${Math.round(diasRecuperar)} días`, `kg ÷ ${convBE} conv.`],
          ["Días productivos tuyos", `${Math.round(diasRestantes)} de ${c.d}`, `ciclo − recuperar`],
          ["Ganancia por cabeza", `$${money(gananciaBECab)}`, `días × ${convBE} × margen`],
          ["Ganancia total (x" + c.cant + ")", `$${money(gananciaBECab * c.cant)}`, ""],
        ],
      })
      yCur = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    }
    if (verB) {
      autoTable(doc, {
        startY: yEnd + 12, theme: "grid", styles: { fontSize: 8 },
        head: [["Escenario B (overrides)", "A", "B", "Δ (B−A)"]],
        body: [
          ["Ganancia / cabeza", `$${money(c.gananciaCab)}`, `$${money(cB.gananciaCab)}`, `$${money(cB.gananciaCab - c.gananciaCab)}`],
          ["Ganancia total", `$${money(c.gananciaTotal)}`, `$${money(cB.gananciaTotal)}`, `$${money(cB.gananciaTotal - c.gananciaTotal)}`],
        ],
      })
      yCur = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    }
    if (etapas.length > 0) {
      autoTable(doc, {
        startY: yCur + 6, theme: "grid", styles: { fontSize: 8 },
        head: [["Etapa", "Período", "Peso ini→fin", "Cant", "Venta hipot.", "Ganancia"]],
        body: [
          ...cadena.pasos.map(p => [p.nombre, `${p.fechaIni}→${p.fechaFin}`, `${kg(p.pIni)}→${kg(p.pFin)}`, String(Math.round(p.cant)), `$${money(p.V)}`, `$${money(p.ganancia)}`]),
          ["TOTAL punta a punta", "", "", "", "", `$${money(cadena.totalPunta)}`],
        ],
      })
      yCur = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    }
    if (notas) { doc.setFontSize(9); doc.text("Notas:", 14, yCur + 9); doc.text(doc.splitTextToSize(notas, 180) as string[], 14, yCur + 14) }
    doc.save(nombreArch() + ".pdf")
  }

  const inp = "border rounded px-1 py-0.5 text-right"
  const lbl = "text-gray-500"

  return (
    <div className="border rounded-lg p-3 bg-emerald-50/40 shrink-0 w-[470px]">
      <div className="flex items-center gap-2 mb-2">
        <button type="button" onClick={() => setColapsado(v => !v)} className="flex items-center gap-2 flex-1 text-left font-semibold text-gray-700">
          <span className="text-gray-400">{colapsado ? "▶" : "▼"}</span>
          <span>Segmento {letra}</span>
          {!colapsado || c.cant > 0
            ? <span className="text-xs font-normal text-emerald-700">· ${money(etapas.length > 0 ? cadena.totalPunta : c.gananciaTotal)}</span>
            : null}
        </button>
        {!colapsado && (<>
          <button type="button" onClick={exportarExcel} className="text-xs px-1.5 py-1 rounded border border-emerald-400 text-emerald-700 hover:bg-emerald-50">⬇xls</button>
          <button type="button" onClick={exportarPDF} className="text-xs px-1.5 py-1 rounded border border-red-400 text-red-700 hover:bg-red-50">⬇pdf</button>
        </>)}
        {onRemove && <button type="button" onClick={onRemove} title="Quitar segmento" className="text-xs px-1.5 py-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">✕</button>}
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
              <tr className="text-gray-500 text-xs">
                <td className="pr-4 pl-2">↳ $/kg vivo (sin desbaste)</td>
                <td className="text-right px-3">{pIniBE > 0 ? `$${money(c.netoEnt / pIniBE)}` : "—"}</td>
                <td className="text-right px-3">{c.pFin > 0 ? `$${money(c.czNetoSal / c.pFin)}` : "—"}</td>
              </tr>
              <tr className="text-gray-500 text-xs">
                <td className="pr-4 pl-2">↳ $/kg neto (con desbaste)</td>
                <td className="text-right px-3">{c.pNetoEnt > 0 ? `$${money(c.netoEnt / c.pNetoEnt)}` : "—"}</td>
                <td className="text-right px-3">{c.pNetoSal > 0 ? `$${money(c.czNetoSal / c.pNetoSal)}` : "—"}</td>
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

            {/* Contra-cálculo: punto de equilibrio */}
            <div className="mt-2 p-2 rounded-lg bg-amber-50/60 border border-amber-200">
              <div className="font-medium text-gray-600 mb-1">Punto de equilibrio <span className="text-xs font-normal text-gray-400">(otra lectura del mismo número{etapas.length > 0 ? " · sobre la etapa 1" : ""})</span></div>
              {beValido ? (
                <div className="space-y-0.5">
                  <div className="flex justify-between gap-2"><span className={lbl}>Precio neto entrada / venta</span><span className="whitespace-nowrap">${money(PcEf)} / ${money(PvEf)} por kg</span></div>
                  <div className="flex justify-between gap-2"><span className={lbl}>Costo por kg producido</span><span>${money(costoKgProd)}</span></div>
                  <div className="flex justify-between gap-2"><span className={lbl}>Margen por kg producido <span className="text-gray-400">(venta − costo)</span></span><span className="text-emerald-700 font-medium">${money(margenKg)}</span></div>
                  <div className="flex justify-between gap-2 border-t pt-0.5 mt-0.5"><span className={lbl}>Pérdida inicial por cabeza <span className="text-gray-400">({kg(pIniBE)}kg × ({money(PcEf)}−{money(PvEf)}))</span></span><span className="text-red-600 whitespace-nowrap">${money(perdidaIniCab)}</span></div>
                  <div className="flex justify-between gap-2"><span className={lbl}>Kg para recuperarla <span className="text-gray-400">(pérdida ÷ margen)</span></span><span className="whitespace-nowrap">{Math.round(kgRecuperar)} kg</span></div>
                  <div className="flex justify-between gap-2"><span className={lbl}>Días para recuperarla <span className="text-gray-400">(kg ÷ {convBE} conv.)</span></span><span className="whitespace-nowrap">{Math.round(diasRecuperar)} días</span></div>
                  <div className="flex justify-between gap-2"><span className={lbl}>Días productivos "tuyos" <span className="text-gray-400">(ciclo {c.d} − {Math.round(diasRecuperar)})</span></span><span className={`whitespace-nowrap ${diasRestantes >= 0 ? "text-emerald-700 font-medium" : "text-red-600 font-medium"}`}>{Math.round(diasRestantes)} días</span></div>
                  <div className="flex justify-between gap-2 border-t pt-0.5 mt-0.5"><span className={lbl}>Ganancia por cabeza <span className="text-gray-400">(días × {convBE} × margen)</span></span><span className={`whitespace-nowrap ${gananciaBECab >= 0 ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"}`}>${money(gananciaBECab)} ✓</span></div>
                  <div className="flex justify-between gap-2"><span className={lbl}>Ganancia total (× {c.cant} cab)</span><span className={`whitespace-nowrap ${gananciaBECab >= 0 ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"}`}>${money(gananciaBECab * c.cant)}</span></div>
                </div>
              ) : (
                <div className="text-red-600 text-xs">
                  {c.kgGanados <= 0 || pIniBE <= 0
                    ? "Faltan peso inicial / días para calcular el equilibrio."
                    : `Margen por kg ≤ 0 ($${money(margenKg)}) → operación perdedora: no se recupera con más días de encierre.`}
                </div>
              )}
            </div>
          </div>

          {/* Cadena de etapas (encadenamiento) */}
          <div className="border-t pt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-gray-600">Cadena de etapas</span>
              <button type="button" onClick={addEtapa} className="text-xs px-2 py-1 rounded border border-teal-500 text-teal-700 hover:bg-teal-50">＋ Encadenar etapa</button>
              <span className="text-xs text-gray-400">peso y fecha se propagan · la mortandad reduce la cantidad que pasa a la siguiente</span>
            </div>

            {etapas.map((e, idx) => {
              const paso = cadena.pasos[idx + 1]
              return (
                <div key={idx} className="p-2 rounded-lg border border-teal-200 bg-white/60">
                  <div className="flex items-center gap-2 mb-1">
                    <input value={e.nombre} onChange={ev => updEtapa(idx, "nombre", ev.target.value)} className="border rounded px-1 py-0.5 text-sm font-medium w-32" />
                    <span className="text-xs text-gray-400">{paso.fechaIni} → {paso.fechaFin} · {kg(paso.pIni)}→{kg(paso.pFin)} kg · {Math.round(paso.cant)} cab</span>
                    <button type="button" onClick={() => delEtapa(idx)} className="ml-auto text-xs text-red-600 hover:underline">✕ quitar</button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="flex items-center gap-1"><span className={lbl}>Días</span><input value={e.dias} onChange={ev => updEtapa(idx, "dias", ev.target.value)} className={`${inp} w-14`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Conversión</span><input value={e.conversion} onChange={ev => updEtapa(idx, "conversion", ev.target.value)} className={`${inp} w-14`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Venta $/kg</span><input value={e.precioVenta} onChange={ev => updEtapa(idx, "precioVenta", ev.target.value)} className={`${inp} w-20`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Maíz $/kg</span><input value={e.maizPrecio} onChange={ev => updEtapa(idx, "maizPrecio", ev.target.value)} className={`${inp} w-20`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Conc. $/kg</span><input value={e.concPrecio} onChange={ev => updEtapa(idx, "concPrecio", ev.target.value)} className={`${inp} w-20`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Desbaste %</span><input value={e.desbSal} onChange={ev => updEtapa(idx, "desbSal", ev.target.value)} className={`${inp} w-12`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>CZ %</span><input value={e.czSal} onChange={ev => updEtapa(idx, "czSal", ev.target.value)} className={`${inp} w-12`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Mort. %</span><input value={e.mort} onChange={ev => updEtapa(idx, "mort", ev.target.value)} className={`${inp} w-12`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Ración %</span><input value={e.racionPV} onChange={ev => updEtapa(idx, "racionPV", ev.target.value)} className={`${inp} w-12`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Maíz %</span><input value={e.maizPct} onChange={ev => updEtapa(idx, "maizPct", ev.target.value)} className={`${inp} w-12`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Conc. %</span><input value={e.concPct} onChange={ev => updEtapa(idx, "concPct", ev.target.value)} className={`${inp} w-12`} /></span>
                  </div>
                  <div className="text-xs mt-1">Ganancia de la etapa (vs vender antes): <b className={paso.ganancia >= 0 ? "text-emerald-700" : "text-red-600"}>${money(paso.ganancia)}</b></div>
                </div>
              )
            })}

            {etapas.length > 0 && (
              <table className="text-sm">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="text-left pr-4 py-1">Etapa</th>
                    <th className="text-left px-3">Período</th>
                    <th className="text-right px-3">Peso ini→fin</th>
                    <th className="text-right px-3">Cant.</th>
                    <th className="text-right px-3">Venta hipot.</th>
                    <th className="text-right px-3">Ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {cadena.pasos.map((p, i) => (
                    <tr key={i} className="hover:bg-white">
                      <td className="pr-4 py-1">{p.nombre}</td>
                      <td className="px-3 text-gray-500 text-xs">{p.fechaIni} → {p.fechaFin}</td>
                      <td className="text-right px-3">{kg(p.pIni)} → {kg(p.pFin)}</td>
                      <td className="text-right px-3">{Math.round(p.cant)}</td>
                      <td className="text-right px-3">${money(p.V)}</td>
                      <td className={`text-right px-3 ${p.ganancia >= 0 ? "text-emerald-700" : "text-red-600"}`}>${money(p.ganancia)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold border-t">
                    <td className="pr-4 py-1" colSpan={5}>Ganancia total punta a punta</td>
                    <td className={`text-right px-3 text-base ${cadena.totalPunta >= 0 ? "text-emerald-700" : "text-red-600"}`}>${money(cadena.totalPunta)}</td>
                  </tr>
                </tbody>
              </table>
            )}
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

// ── Contenedor: segmentos en horizontal + total combinado + guardar/cargar estudios ──
export function AnalisisProductivo({ secciones, total }: Props) {
  const nextId = useRef(1)
  const [segIds, setSegIds] = useState<number[]>([0])
  const [totales, setTotales] = useState<Record<number, number>>({})
  const [initials, setInitials] = useState<Record<number, Partial<SegState>>>({})
  const segStatesRef = useRef<Record<number, SegState>>({})
  const [estudios, setEstudios] = useState<Record<string, Estudio>>({})
  const [sel, setSel] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { try { setEstudios(JSON.parse(localStorage.getItem(LS_ESTUDIOS) || "{}")) } catch { /* ignore */ } }, [])

  const addSeg = () => setSegIds(p => [...p, nextId.current++])
  const removeSeg = (id: number) => {
    setSegIds(p => p.filter(x => x !== id))
    setTotales(t => { const n = { ...t }; delete n[id]; return n })
    delete segStatesRef.current[id]
  }
  const reportTotal = (id: number, v: number) => setTotales(t => t[id] === v ? t : { ...t, [id]: v })
  const reportState = (id: number, s: SegState) => { segStatesRef.current[id] = s }
  const combinado = segIds.reduce((s, id) => s + (totales[id] || 0), 0)

  const snapshotEstudio = (): Estudio => ({
    version: 1, fecha: new Date().toISOString(),
    segments: segIds.map(id => segStatesRef.current[id]).filter(Boolean) as SegState[],
  })
  const cargarEstudio = (est: Estudio) => {
    const segs = est.segments || []
    if (!segs.length) return
    const ids = segs.map(() => nextId.current++)
    const ini: Record<number, Partial<SegState>> = {}
    ids.forEach((id, i) => { ini[id] = segs[i] })
    segStatesRef.current = {}
    setInitials(ini)
    setTotales({})
    setSegIds(ids)
  }

  // Descarga con selector de ruta (File System Access API) y fallback a carpeta Descargas.
  const descargarEstudio = async (est: Estudio, nombreArch: string) => {
    const json = JSON.stringify(est, null, 2)
    const w = window as unknown as { showSaveFilePicker?: (o: { suggestedName?: string; types?: unknown[] }) => Promise<{ createWritable: () => Promise<{ write: (d: string) => Promise<void>; close: () => Promise<void> }> }> }
    if (w.showSaveFilePicker) {
      try {
        const handle = await w.showSaveFilePicker({ suggestedName: nombreArch, types: [{ description: "Estudio de análisis", accept: { "application/json": [".json"] } }] })
        const wr = await handle.createWritable(); await wr.write(json); await wr.close()
        toast.success("Archivo guardado")
      } catch { /* el usuario canceló el diálogo */ }
    } else {
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob); const a = document.createElement("a")
      a.href = url; a.download = nombreArch; a.click(); URL.revokeObjectURL(url)
    }
  }

  const guardar = async () => {
    const nombre = (prompt("Nombre del estudio:", sel || "") || "").trim()
    if (!nombre) return
    const est = snapshotEstudio()
    const all = { ...estudios, [nombre]: est }
    localStorage.setItem(LS_ESTUDIOS, JSON.stringify(all))
    setEstudios(all); setSel(nombre)
    toast.success(`Estudio "${nombre}" guardado en la app`)
    if (confirm("¿Descargar también el archivo (backup portable, elegís la carpeta)?")) {
      await descargarEstudio(est, `Estudio_${nombre.replace(/\s+/g, "_")}.json`)
    }
  }
  const borrar = () => {
    if (!sel) return
    const all = { ...estudios }; delete all[sel]
    localStorage.setItem(LS_ESTUDIOS, JSON.stringify(all))
    setEstudios(all); setSel("")
    toast.success("Estudio borrado")
  }
  const descargarArchivo = () => descargarEstudio(snapshotEstudio(), `Estudio_engorde_${new Date().toISOString().slice(0, 10)}.json`)
  const cargarArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try { cargarEstudio(JSON.parse(reader.result as string) as Estudio); toast.success("Estudio cargado del archivo") }
      catch { toast.error("Archivo inválido") }
    }
    reader.readAsText(file); e.target.value = ""
  }

  return (
    <div className="mb-4">
      {/* Barra guardar/cargar estudios */}
      <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
        <span className="font-semibold text-gray-600">Estudio</span>
        <button type="button" onClick={guardar} className="px-2 py-1 rounded border border-emerald-500 text-emerald-700 hover:bg-emerald-50">💾 Guardar</button>
        <select value={sel} onChange={e => { setSel(e.target.value); if (e.target.value && estudios[e.target.value]) cargarEstudio(estudios[e.target.value]) }} className="border rounded px-1 py-1">
          <option value="">Cargar guardado…</option>
          {Object.keys(estudios).sort().map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {sel && <button type="button" onClick={borrar} title="Borrar este estudio guardado" className="px-1.5 py-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">🗑</button>}
        <span className="text-gray-300">·</span>
        <button type="button" onClick={descargarArchivo} className="px-2 py-1 rounded border border-slate-400 text-slate-700 hover:bg-slate-50">⬇ Archivo</button>
        <button type="button" onClick={() => fileRef.current?.click()} className="px-2 py-1 rounded border border-slate-400 text-slate-700 hover:bg-slate-50">⬆ Cargar archivo</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={cargarArchivo} />
        <span className="text-xs text-gray-400">guardado = en esta PC · archivo = portable/backup</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 items-start">
        {segIds.map((id, i) => (
          <AnalisisSegmento key={id} indice={i} secciones={secciones} total={total}
            initial={initials[id]}
            onRemove={segIds.length > 1 ? () => removeSeg(id) : undefined}
            onTotal={v => reportTotal(id, v)}
            onState={s => reportState(id, s)} />
        ))}
        <button type="button" onClick={addSeg} title="Agregar otro segmento a la derecha"
          className="shrink-0 self-start px-3 py-6 rounded-lg border-2 border-dashed border-emerald-400 text-emerald-700 hover:bg-emerald-50 text-sm font-medium whitespace-nowrap">
          ＋ Segmento
        </button>
      </div>
      {segIds.length > 1 && (
        <div className="mt-1 px-3 py-2 rounded-lg bg-emerald-100 border border-emerald-300 text-sm font-semibold text-emerald-800">
          Ganancia combinada ({segIds.length} segmentos): ${money(combinado)}
        </div>
      )}
    </div>
  )
}
