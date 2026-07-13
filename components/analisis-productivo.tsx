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
import type { FilaMercado } from "@/app/api/precios-mercado/route"

const LS_ESTUDIOS = "analisis_engorde_estudios"
// Config de la segmentación (vive en tab-terneros; se guarda/restaura con el estudio)
// Foto congelada de lo que reportó un segmentador (mismo shape que SegPayload de segmentador.tsx,
// inline para evitar import circular de tipos).
export interface SegSnapshot {
  poblacion: string
  secciones: { label: string; cantidad: number; promedio: number }[]
  total: { cantidad: number; promedio: number } | null
}
export interface SegConfig {
  origen: string; grupos: string[]; ganancia: number; cada: number; desde: number | null; fecha: string; cortes: number[] | null
  // ── Reproducción del linkeo (opcional → estudios viejos no lo tienen) ──
  pesadaBaseFecha?: string | null   // fecha de la pesada base usada (la "última" al guardar, modo estimado)
  fechaCalculo?: string             // "hoy" (ISO) usado para el +ganancia×días — congela el drift de días
  snapshot?: SegSnapshot            // foto de los cortes/pesos calculados al guardar (no depende de la BD)
}
// Modo de carga del segmentado de un estudio: 'foto' = usar snapshot congelado · 'relink' = re-derivar anclado
export type ModoCarga = "foto" | "relink"
// Precios de mercado scrapeados, guardados con el estudio (opcional → estudios viejos no lo tienen)
export interface EstudioMercado { desde: string; hasta: string; prima: string; macho: FilaMercado[] | null; hembra: FilaMercado[] | null; fechaScraping?: string }
interface Estudio { version: number; fecha: string; segments: SegState[]; segConfigs?: SegConfig[]; segConfig?: SegConfig /* compat viejo */; mercado?: EstudioMercado }

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
  fase: string; notas: string; fuente: string
  cantidad: string; pesoInicio: string
  maizPrecio: string; concPrecio: string; tc: string; precioCompra: string; precioVenta: string
  fechaInicio: string; fechaFin: string; dias: string; conversion: string
  mortandad: string; desbEnt: string; desbSal: string; czEnt: string; czSal: string
  racionPV: string; maizPct: string; concPct: string
  bOv: Record<string, string>; verB: boolean
  etapas: StageForm[]
  incluido: boolean        // cuenta en la ganancia combinada (el "no elegido" queda pero suma 0)
  salidaEtapa: number      // hasta qué etapa se vende (índice en cadena.pasos; -1 = última/punta a punta)
}

interface SegProps extends Props {
  indice: number
  onRemove?: () => void
  onDuplicar?: () => void
  onTotal?: (v: number) => void
  initial?: Partial<SegState>
  onState?: (s: SegState) => void
  onRegisterExport?: (getter: (() => SegExportData) | null) => void
  mercado?: {
    precio: (sexo: "macho" | "hembra", peso: number) => { precio: number; cats: string[] } | null
    resaltar?: (sexo: "macho" | "hembra", cats: string[]) => void
    limpiar?: () => void
  }
}

// ── Helpers de parseo (es-AR) ──────────────────────────────────────────────
const num = (s: string) => parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0
const pct = (s: string) => (parseFloat(String(s).replace(",", ".")) || 0) / 100
const money = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 })
const kg = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 })

// ── PDF declarativo (bloques) — reusado por el export de cada segmento y el combinado ──
type PdfBlock =
  | { t: "title"; text: string }
  | { t: "sub"; text: string }
  | { t: "line"; text: string; size?: number }
  | { t: "wrap"; text: string; size?: number }
  | { t: "table"; head: string[][]; body: string[][] }
  | { t: "gap"; h: number }

// Dibuja los bloques en el doc a partir de startY, manejando saltos de página. Devuelve la Y final.
function renderPdfBlocks(doc: jsPDF, blocks: PdfBlock[], startY: number): number {
  let y = startY
  const pageH = doc.internal.pageSize.getHeight()
  const ensure = (need: number) => { if (y + need > pageH - 12) { doc.addPage(); y = 16 } }
  for (const b of blocks) {
    if (b.t === "title") { ensure(10); doc.setFontSize(14); doc.text(b.text, 14, y); y += 7 }
    else if (b.t === "sub") { ensure(8); doc.setFontSize(10); doc.text(b.text, 14, y); y += 6 }
    else if (b.t === "line") { ensure(8); doc.setFontSize(b.size ?? 11); doc.text(b.text, 14, y); y += 7 }
    else if (b.t === "wrap") { doc.setFontSize(b.size ?? 9); const lines = doc.splitTextToSize(b.text, 180) as string[]; ensure(lines.length * 5 + 2); doc.text(lines, 14, y); y += lines.length * 5 + 2 }
    else if (b.t === "gap") { y += b.h }
    else if (b.t === "table") {
      autoTable(doc, { startY: y, theme: "grid", styles: { fontSize: 8 }, head: b.head, body: b.body })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
    }
  }
  return y
}

// Datos que cada segmento expone para el export combinado del estudio.
export interface SegResumen { titulo: string; incluido: boolean; cant: number; pesoIni: number; pesoFin: number; gananciaCab: number; gananciaTotal: number }
export interface SegExportData { resumen: SegResumen; blocks: PdfBlock[]; filas: (string | number)[][] }

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

function AnalisisSegmento({ secciones, total, indice, onRemove, onDuplicar, onTotal, initial, onState, onRegisterExport, mercado }: SegProps) {
  const letra = String.fromCharCode(65 + indice) // A, B, C…
  const hoy = new Date().toISOString().slice(0, 10)
  const g = <K extends keyof SegState>(k: K, def: SegState[K]): SegState[K] => (initial?.[k] ?? def) as SegState[K]
  const [colapsado, setColapsado] = useState(indice > 0)
  const [fase, setFase] = useState(g("fase", ""))
  const [notas, setNotas] = useState(g("notas", ""))
  const [fuente, setFuente] = useState(g("fuente", "")) // etiqueta de la sección/total elegida (persiste el vínculo)

  // Fuente: 'total' | label de sección
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
    setFuente(val)
    if (val === "total" && total) { setCantidad(String(total.cantidad)); setPesoInicio(String(Math.round(total.promedio))) }
    else {
      const s = secciones.find(x => x.label === val)
      if (s) { setCantidad(String(s.cantidad)); setPesoInicio(String(Math.round(s.promedio))) }
    }
  }

  // Overrides del escenario B: mapa variable→valor (ausente/vacío = usa A)
  const [bOv, setBOv] = useState<Record<string, string>>(() => {
    const ov: Record<string, string> = { ...(initial?.bOv ?? {}) }
    // migración de estudios viejos (campos b* individuales)
    const viejos: Record<string, string> = { bPrecioVenta: "precioVenta", bPrecioCompra: "precioCompra", bMaiz: "maizPrecio", bConc: "concPrecio", bMort: "mortandad", bConv: "conversion", bDias: "dias" }
    for (const [o, nk] of Object.entries(viejos)) { const v = (initial as Record<string, unknown> | undefined)?.[o]; if (typeof v === "string" && v) ov[nk] = v }
    return ov
  })
  const [verB, setVerB] = useState(g("verB", false))
  const [incluido, setIncluido] = useState(g("incluido", true))   // cuenta en la combinada
  const [salidaEtapa, setSalidaEtapa] = useState<number>(g("salidaEtapa", -1)) // -1 = última etapa
  // Análisis de sensibilidad (sesión): variables a analizar con su base y paso; escalones global
  const [verSens, setVerSens] = useState(false)
  const [sensEscalones, setSensEscalones] = useState("2")
  const [sensVars, setSensVars] = useState<Record<string, { base: string; delta: string }>>({})

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

  // Config de variables (palancas) — compartida por Escenario B y (futuro) sensibilidad
  const parseVal = (tipo: string, v: string) => tipo === "pct" ? pct(v) : tipo === "int" ? (parseInt(v) || 0) : num(v)
  const VARS: { key: string; label: string; campo: keyof CalcInputs; tipo: "money" | "num" | "int" | "pct"; base: string; w: string }[] = [
    { key: "cantidad", label: "Cantidad", campo: "cant", tipo: "int", base: cantidad, w: "w-16" },
    { key: "pesoInicio", label: "Peso inicio", campo: "pIni", tipo: "num", base: pesoInicio, w: "w-16" },
    { key: "dias", label: "Días", campo: "d", tipo: "int", base: dias, w: "w-14" },
    { key: "conversion", label: "Conversión", campo: "conv", tipo: "num", base: conversion, w: "w-14" },
    { key: "precioCompra", label: "Compra $/kg", campo: "precioCompra", tipo: "money", base: precioCompra, w: "w-20" },
    { key: "precioVenta", label: "Venta $/kg", campo: "precioVenta", tipo: "money", base: precioVenta, w: "w-20" },
    { key: "maizPrecio", label: "Maíz $/kg", campo: "maizPrecio", tipo: "money", base: maizPrecio, w: "w-20" },
    { key: "concPrecio", label: "Concentrado $/kg", campo: "concPrecio", tipo: "money", base: concPrecio, w: "w-20" },
    { key: "desbEnt", label: "Desbaste ent %", campo: "desbEnt", tipo: "pct", base: desbEnt, w: "w-12" },
    { key: "desbSal", label: "Desbaste sal %", campo: "desbSal", tipo: "pct", base: desbSal, w: "w-12" },
    { key: "czEnt", label: "CZ ent %", campo: "czEnt", tipo: "pct", base: czEnt, w: "w-12" },
    { key: "czSal", label: "CZ sal %", campo: "czSal", tipo: "pct", base: czSal, w: "w-12" },
    { key: "mortandad", label: "Mortandad %", campo: "mort", tipo: "pct", base: mortandad, w: "w-12" },
    { key: "racionPV", label: "Ración %PV", campo: "racionPV", tipo: "pct", base: racionPV, w: "w-12" },
    { key: "maizPct", label: "Maíz %", campo: "maizPct", tipo: "pct", base: maizPct, w: "w-12" },
    { key: "concPct", label: "Concentrado %", campo: "concPct", tipo: "pct", base: concPct, w: "w-12" },
  ]
  const applyOverrides = (b: CalcInputs, ov: Record<string, string>): CalcInputs => {
    const o = { ...b }
    for (const vd of VARS) { const val = ov[vd.key]; if (val && val.trim()) o[vd.campo] = parseVal(vd.tipo, val) }
    return o
  }

  const c = calcular(baseInputs)
  const cB = calcular(applyOverrides(baseInputs, bOv))

  // ── Cadena de etapas (encadenamiento) ──
  // Etapa k: peso y fecha propagan; mortandad reduce la cantidad que pasa a la siguiente.
  // Ración de cada etapa usa la cantidad de INICIO (sin descontar su mortandad).
  // Ganancia etapa 1 = V1 − compra − ración1; etapa k = Vk − V(k−1) − ración_k (costo de oportunidad).
  interface PasoCadena {
    nombre: string; fechaIni: string; fechaFin: string
    pIni: number; pFin: number; cant: number; V: number; R: number; vPrev: number; ganancia: number
    calc: ReturnType<typeof calcular>
  }
  const cadena: { pasos: PasoCadena[]; totalPunta: number } = (() => {
    const pasos: PasoCadena[] = []
    // Etapa 1 (del estado top-level, ya calculada en c)
    const V1 = c.czNetoSal * c.cant
    const R1 = -c.costoRacion * c.cant
    const P = c.netoEnt * c.cant // compra (costo de entrada de la etapa 1)
    pasos.push({ nombre: fase || "Etapa 1", fechaIni: fechaInicio, fechaFin, pIni: num(pesoInicio), pFin: c.pFin, cant: c.cant, V: V1, R: R1, vPrev: P, ganancia: c.gananciaTotal, calc: c })
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
      pasos.push({ nombre: e.nombre || `Etapa ${idx + 2}`, fechaIni: fechaAct, fechaFin: fFin, pIni: pesoAct, pFin: ck.pFin, cant: ck.cant, V: Vk, R: Rk, vPrev: prevV, ganancia: gk, calc: ck })
      prevV = Vk
      cantAct = ck.cant * (1 - pct(e.mort))
      pesoAct = ck.pFin
      fechaAct = fFin
    })
    return { pasos, totalPunta: pasos.reduce((s, p) => s + p.ganancia, 0) }
  })()

  // Punto de salida: hasta qué etapa se vende (ganancia acumulada hasta ahí)
  const exitIdx = (salidaEtapa < 0 || salidaEtapa >= cadena.pasos.length) ? cadena.pasos.length - 1 : salidaEtapa
  const gananciaHastaSalida = cadena.pasos.slice(0, exitIdx + 1).reduce((s, p) => s + p.ganancia, 0)
  // Reportar a la combinada: 0 si el segmento no está incluido (alternativa no elegida)
  const totalSeg = incluido ? gananciaHastaSalida : 0
  useEffect(() => { onTotal?.(totalSeg) }, [totalSeg]) // eslint-disable-line react-hooks/exhaustive-deps

  // Snapshot serializable → reportar al contenedor (para guardar/cargar estudios)
  const snapshot: SegState = {
    fase, notas, fuente, cantidad, pesoInicio, maizPrecio, concPrecio, tc, precioCompra, precioVenta,
    fechaInicio, fechaFin, dias, conversion, mortandad, desbEnt, desbSal, czEnt, czSal,
    racionPV, maizPct, concPct, bOv, verB, etapas, incluido, salidaEtapa,
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
      for (const v of VARS) if (bOv[v.key]?.trim()) rows.push([`B · ${v.label}`, v.tipo === "money" || v.tipo === "num" ? num(bOv[v.key]) : v.tipo === "int" ? (parseInt(bOv[v.key]) || 0) : (parseFloat(bOv[v.key].replace(",", ".")) || 0)])
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

  // Detalle del segmento como bloques declarativos (reusado por el PDF individual y el combinado).
  const pdfBlocks = (): PdfBlock[] => {
    const blocks: PdfBlock[] = [
      { t: "title", text: "Análisis productivo-económico" },
      { t: "sub", text: `Fase: ${fase || "—"}   ·   ${new Date().toLocaleDateString("es-AR")}` },
      { t: "gap", h: 3 },
      { t: "table", head: [["Parámetro", "Valor"]], body: [
        ["Cantidad", String(c.cant)],
        ["Precio compra $/kg → neto", `$${money(num(precioCompra))}  (neto ${kg(c.pNetoEnt)} kg)`],
        ["Precio venta $/kg → neto", `$${money(num(precioVenta))}  (neto ${kg(c.pNetoSal)} kg)`],
        ["Período", `${fechaInicio} → ${fechaFin} (${c.d} días)`],
        ["Conversión kg/día", String(conversion)], ["Kg ganados", kg(c.kgGanados)],
      ] },
      { t: "table", head: [["", "Entrada (compra)", "Salida (venta)"]], body: [
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
      ] },
      { t: "table", head: [["Ración", "kg/día", "Costo/cab", "Kg totales lote"]], body: [
        ["Maíz", kg(c.maizKgDia), `-$${money(-c.maizCosto)}`, money(c.maizKgLote)],
        ["Concentrado", kg(c.concKgDia), `-$${money(-c.concCosto)}`, money(c.concKgLote)],
        ["Costo ración total", "", `-$${money(-c.costoRacion)}`, ""],
      ] },
      { t: "gap", h: 4 },
      { t: "line", text: `Ganancia / cabeza: $${money(c.gananciaCab)}` },
      { t: "line", text: `Ganancia total (x${c.cant}): $${money(c.gananciaTotal)}` },
    ]
    if (beValido) blocks.push({ t: "table", head: [["Punto de equilibrio", "Valor", "Cuenta"]], body: [
      ["Precio neto entrada / venta", `$${money(PcEf)} / $${money(PvEf)} por kg`, "tras desbaste + CZ"],
      ["Costo por kg producido", `$${money(costoKgProd)}`, "ración ÷ kg ganados"],
      ["Margen por kg producido", `$${money(margenKg)}`, "venta − costo"],
      ["Pérdida inicial por cabeza", `$${money(perdidaIniCab)}`, `${kg(pIniBE)}kg × (ent−venta)`],
      ["Kg para recuperarla", `${Math.round(kgRecuperar)} kg`, "pérdida ÷ margen"],
      ["Días para recuperarla", `${Math.round(diasRecuperar)} días`, `kg ÷ ${convBE} conv.`],
      ["Días productivos tuyos", `${Math.round(diasRestantes)} de ${c.d}`, `ciclo − recuperar`],
      ["Ganancia por cabeza", `$${money(gananciaBECab)}`, `días × ${convBE} × margen`],
      [`Ganancia total (x${c.cant})`, `$${money(gananciaBECab * c.cant)}`, ""],
    ] })
    if (verB) blocks.push({ t: "table", head: [["Escenario B (overrides)", "A", "B", "Δ (B−A)"]], body: [
      ["Ganancia / cabeza", `$${money(c.gananciaCab)}`, `$${money(cB.gananciaCab)}`, `$${money(cB.gananciaCab - c.gananciaCab)}`],
      ["Ganancia total", `$${money(c.gananciaTotal)}`, `$${money(cB.gananciaTotal)}`, `$${money(cB.gananciaTotal - c.gananciaTotal)}`],
    ] })
    if (etapas.length > 0) {
      // Resumen de la cadena
      blocks.push({ t: "table", head: [["Etapa", "Período", "Peso ini→fin", "Cant", "Venta hipot.", "Ganancia"]], body: [
        ...cadena.pasos.map(p => [p.nombre, `${p.fechaIni}→${p.fechaFin}`, `${kg(p.pIni)}→${kg(p.pFin)}`, String(Math.round(p.cant)), `$${money(p.V)}`, `$${money(p.ganancia)}`]),
        ["TOTAL punta a punta", "", "", "", "", `$${money(cadena.totalPunta)}`],
      ] })
      // Detalle por etapa de la cadena (la etapa 1 ya tiene su detalle completo arriba).
      // Las etapas 2+ son continuación (no compran): se muestra productivo + ración + económico incremental.
      cadena.pasos.forEach((p, k) => {
        if (k === 0) return
        const e = etapas[k - 1]; const cc = p.calc
        blocks.push(
          { t: "sub", text: `Etapa ${k + 1}: ${p.nombre}   (${p.fechaIni} → ${p.fechaFin})` },
          { t: "table", head: [["Parámetro", "Valor"]], body: [
            ["Cantidad", String(Math.round(cc.cant))],
            ["Peso ini → fin", `${kg(p.pIni)} → ${kg(p.pFin)} kg`],
            ["Días", String(e.dias)], ["Conversión kg/día", String(e.conversion)],
            ["Kg ganados", kg(cc.kgGanados)],
            ["Mortandad %", `${e.mort}%`], ["Desbaste salida %", `${e.desbSal}%`],
            ["Peso neto salida", `${kg(cc.pNetoSal)} kg`],
          ] },
          { t: "table", head: [["Ración", "kg/día", "Costo/cab", "Kg totales lote"]], body: [
            ["Maíz", kg(cc.maizKgDia), `-$${money(-cc.maizCosto)}`, money(cc.maizKgLote)],
            ["Concentrado", kg(cc.concKgDia), `-$${money(-cc.concCosto)}`, money(cc.concKgLote)],
            ["Costo ración total", "", `-$${money(-cc.costoRacion)}`, ""],
          ] },
          { t: "line", text: `Venta hipotética: $${money(p.V)}   ·   Costo ración: -$${money(-p.R)}`, size: 10 },
          { t: "line", text: `Ganancia de la etapa (incremental): $${money(p.ganancia)}`, size: 10 },
        )
      })
    }
    if (notas) blocks.push({ t: "gap", h: 3 }, { t: "line", text: "Notas:", size: 9 }, { t: "wrap", text: notas })
    return blocks
  }

  const exportarPDF = () => {
    const doc = new jsPDF()
    renderPdfBlocks(doc, pdfBlocks(), 16)
    doc.save(nombreArch() + ".pdf")
  }

  // Exponer los datos de export al contenedor (para el PDF/Excel combinado del estudio).
  const exportDataRef = useRef<() => SegExportData>(() => ({ resumen: { titulo: "", incluido: true, cant: 0, pesoIni: 0, pesoFin: 0, gananciaCab: 0, gananciaTotal: 0 }, blocks: [], filas: [] }))
  exportDataRef.current = () => ({
    resumen: { titulo: fase || fuente || `Segmento ${letra}`, incluido, cant: c.cant, pesoIni: num(pesoInicio), pesoFin: c.pFin, gananciaCab: c.gananciaCab, gananciaTotal: c.gananciaTotal },
    blocks: pdfBlocks(),
    filas: filasExport(),
  })
  useEffect(() => {
    onRegisterExport?.(() => exportDataRef.current())
    return () => onRegisterExport?.(null)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Precio de mercado: sexo derivado de la Fuente (label "A·Machos: …" / "A·Hembras: …")
  const sexoSeg: "macho" | "hembra" | null = /achos|orito/i.test(fuente) ? "macho" : /embra|ernera/i.test(fuente) ? "hembra" : null
  const puedeMercado = !!(mercado && sexoSeg)
  const fmtNum = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 })
  // Se busca por kg NETOS (post-desbaste), que es el peso al que cotiza el mercado.
  const usarMercadoCompra = () => { const r = mercado?.precio(sexoSeg!, c.pNetoEnt); if (r) { setPrecioCompra(fmtNum(r.precio)); mercado?.resaltar?.(sexoSeg!, r.cats) } else toast.error("Sin precio de mercado para ese peso/sexo") }
  const usarMercadoVenta = () => { const r = mercado?.precio(sexoSeg!, c.pNetoSal); if (r) { setPrecioVenta(fmtNum(r.precio)); mercado?.resaltar?.(sexoSeg!, r.cats) } else toast.error("Sin precio de mercado para ese peso/sexo") }
  const usarMercadoEtapa = (idx: number, pesoNetoSal: number) => { const r = mercado?.precio(sexoSeg!, pesoNetoSal); if (r) { updEtapa(idx, "precioVenta", fmtNum(r.precio)); mercado?.resaltar?.(sexoSeg!, r.cats) } else toast.error("Sin precio de mercado para ese peso/sexo") }

  const inp = "border rounded px-1 py-0.5 text-right"
  const lbl = "text-gray-500"

  return (
    <div className="border rounded-lg p-3 bg-emerald-50/40 shrink-0 w-[470px]">
      <div className="flex items-center gap-2 mb-2">
        <input type="checkbox" checked={incluido} onChange={e => setIncluido(e.target.checked)} title="Incluir en la ganancia combinada (destildá la alternativa que no elegís)" className="shrink-0" />
        <button type="button" onClick={() => setColapsado(v => !v)} className={`flex items-center gap-2 flex-1 text-left font-semibold ${incluido ? "text-gray-700" : "text-gray-400"}`}>
          <span className="text-gray-400">{colapsado ? "▶" : "▼"}</span>
          <span>Segmento {letra}</span>
          {!colapsado || c.cant > 0
            ? <span className={`text-xs font-normal ${incluido ? "text-emerald-700" : "text-gray-400 line-through"}`}>· ${money(gananciaHastaSalida)}{cadena.pasos.length > 1 ? ` (hasta ${cadena.pasos[exitIdx]?.nombre})` : ""}</span>
            : null}
        </button>
        {!colapsado && (<>
          <button type="button" onClick={exportarExcel} className="text-xs px-1.5 py-1 rounded border border-emerald-400 text-emerald-700 hover:bg-emerald-50">⬇xls</button>
          <button type="button" onClick={exportarPDF} className="text-xs px-1.5 py-1 rounded border border-red-400 text-red-700 hover:bg-red-50">⬇pdf</button>
        </>)}
        {onDuplicar && <button type="button" onClick={onDuplicar} title="Duplicar este segmento (para armar la alternativa B)" className="text-xs px-1.5 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50">⧉ dup</button>}
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
              <select value={fuente} onChange={e => usarFuente(e.target.value)} className="border rounded px-1 py-0.5">
                <option value="">elegí…</option>
                {total && <option value="total">Total rodeo ({total.cantidad} cab · {Math.round(total.promedio)} kg)</option>}
                {/* Fuente guardada que ya no está en la lista actual (cambió la segmentación) → la muestro igual */}
                {fuente && fuente !== "total" && !secciones.some(s => s.label === fuente) && (
                  <option value={fuente}>{fuente} · (del estudio)</option>
                )}
                {secciones.map((s, i) => s.cantidad > 0 && (
                  <option key={i} value={s.label}>{s.label} ({s.cantidad} cab · {Math.round(s.promedio)} kg)</option>
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
            <span className="flex items-center gap-1"><span className={lbl}>Compra $/kg</span><input value={precioCompra} onChange={e => { setPrecioCompra(e.target.value); mercado?.limpiar?.() }} className={`${inp} w-20`} />{puedeMercado && <button type="button" onClick={usarMercadoCompra} title={`Precio de mercado (${sexoSeg}, ${Math.round(c.pNetoEnt)} kg netos)`} className="text-xs px-1 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200">mkt</button>}<span className="text-xs text-gray-400">(neto {kg(c.pNetoEnt)} kg)</span></span>
            <span className="flex items-center gap-1"><span className={lbl}>Venta $/kg</span><input value={precioVenta} onChange={e => { setPrecioVenta(e.target.value); mercado?.limpiar?.() }} className={`${inp} w-20`} />{puedeMercado && <button type="button" onClick={usarMercadoVenta} title={`Precio de mercado (${sexoSeg}, ${Math.round(c.pNetoSal)} kg netos)`} className="text-xs px-1 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200">mkt</button>}<span className="text-xs text-gray-400">(neto {kg(c.pNetoSal)} kg)</span></span>
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

            {verB && (() => {
              const activas = VARS.filter(v => bOv[v.key] !== undefined)
              const disponibles = VARS.filter(v => bOv[v.key] === undefined)
              return (
                <div className="p-2 rounded-lg bg-indigo-50/60 border border-indigo-200">
                  <div className="text-xs text-indigo-700 mb-1">Escenario B — agregá las variables que querés cambiar (el resto usa A):</div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {activas.map(v => (
                      <span key={v.key} className="flex items-center gap-1">
                        <span className={lbl}>{v.label}</span>
                        <input placeholder={v.base} value={bOv[v.key]} onChange={e => setBOv(o => ({ ...o, [v.key]: e.target.value }))} className={`${inp} ${v.w}`} />
                        <button type="button" onClick={() => setBOv(o => { const n = { ...o }; delete n[v.key]; return n })} className="text-xs text-gray-400 hover:text-red-600" title="Sacar variable">✕</button>
                      </span>
                    ))}
                    {disponibles.length > 0 && (
                      <select value="" onChange={e => { if (e.target.value) setBOv(o => ({ ...o, [e.target.value]: "" })) }} className="border border-indigo-300 rounded px-1 py-0.5 text-indigo-700 text-xs">
                        <option value="">＋ agregar variable…</option>
                        {disponibles.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
                      </select>
                    )}
                    {!activas.length && <span className="text-xs text-gray-400">(sin variables — B = A)</span>}
                  </div>
                </div>
              )
            })()}

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
                  <div className="flex justify-between gap-2"><span className={lbl}>Días productivos "tuyos" <span className="text-gray-400">(ciclo {c.d} − {Math.round(diasRecuperar)})</span></span><span className={`whitespace-nowrap ${diasRestantes >= 0 ? "text-emerald-700 font-medium" : "text-red-600 font-medium"}`}>{Math.round(diasRestantes)} días ({c.d > 0 ? Math.round((diasRestantes / c.d) * 100) : 0}%)</span></div>
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

          {/* Análisis de sensibilidad */}
          <div className="border-t pt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-gray-600">Análisis de sensibilidad</span>
              <button type="button" onClick={() => setVerSens(v => !v)} className="text-xs px-2 py-1 rounded border border-violet-400 text-violet-700 hover:bg-violet-50">{verSens ? "Ocultar" : "＋ Ver sensibilidad"}</button>
              {verSens && <span className="flex items-center gap-1 text-sm"><span className={lbl}>escalones por lado</span><input value={sensEscalones} onChange={e => setSensEscalones(e.target.value)} className={`${inp} w-12`} /></span>}
            </div>
            {verSens && (() => {
              const N = Math.max(1, Math.min(5, parseInt(sensEscalones) || 2))
              const offs = Array.from({ length: 2 * N + 1 }, (_, i) => i - N)
              // Parseo tolerante: acepta coma o punto como decimal; punto como miles solo si son 3 dígitos.
              const parseDisp = (s: string) => {
                const t = String(s).trim(); if (!t) return 0
                if (t.includes(",")) return parseFloat(t.replace(/\./g, "").replace(",", ".")) || 0
                if (/^\d+\.\d{1,2}$/.test(t)) return parseFloat(t) || 0 // "0.1", "1.25" = decimal
                return parseFloat(t.replace(/\./g, "")) || 0            // "5.400" = 5400 · "10" = 10
              }
              const gananciaCon = (v: typeof VARS[number], valDisp: number) =>
                calcular({ ...baseInputs, [v.campo]: v.tipo === "pct" ? valDisp / 100 : valDisp }).gananciaCab
              const deltaDefault = (v: typeof VARS[number]) => v.tipo === "money" ? "50" : v.key === "conversion" ? "0,1" : v.key === "dias" ? "10" : v.tipo === "pct" ? "1" : v.key === "cantidad" ? "5" : "10"
              const activas = VARS.filter(v => sensVars[v.key])
              const disponibles = VARS.filter(v => !sensVars[v.key])
              return (
                <div className="space-y-2">
                  <div className="text-xs text-gray-500">Base = Escenario A. Cada fila mueve SOLO esa variable (el resto queda en A). Ganancia por cabeza. <span className="text-gray-400">Sumar filas es aproximado (hay interacciones).</span></div>
                  {disponibles.length > 0 && (
                    <select value="" onChange={e => { const k = e.target.value; if (k) setSensVars(s => ({ ...s, [k]: { base: "", delta: deltaDefault(VARS.find(v => v.key === k)!) } })) }} className="border border-violet-300 rounded px-1 py-0.5 text-violet-700 text-xs">
                      <option value="">＋ agregar variable…</option>
                      {disponibles.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
                    </select>
                  )}
                  {activas.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="text-sm">
                        <thead>
                          <tr className="text-gray-500 border-b">
                            <th className="text-left pr-2 py-1">Variable</th>
                            <th className="text-right px-1">base</th>
                            <th className="text-right px-1">paso ±</th>
                            {offs.map(o => <th key={o} className="text-right px-2">{o === 0 ? "BASE" : (o > 0 ? "+" : "") + o}</th>)}
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {activas.map(v => {
                            const baseD = (sensVars[v.key].base.trim() ? parseDisp(sensVars[v.key].base) : parseDisp(v.base))
                            const deltaD = parseDisp(sensVars[v.key].delta)
                            const gBase = gananciaCon(v, baseD)
                            return (
                              <tr key={v.key} className="border-b border-slate-100">
                                <td className="pr-2 py-1 text-gray-600">{v.label}</td>
                                <td className="text-right px-1"><input value={sensVars[v.key].base} placeholder={v.base} onChange={e => setSensVars(s => ({ ...s, [v.key]: { ...s[v.key], base: e.target.value } }))} className={`${inp} w-16`} /></td>
                                <td className="text-right px-1"><input value={sensVars[v.key].delta} onChange={e => setSensVars(s => ({ ...s, [v.key]: { ...s[v.key], delta: e.target.value } }))} className={`${inp} w-14`} /></td>
                                {offs.map(o => {
                                  const val = baseD + o * deltaD
                                  const g = gananciaCon(v, val)
                                  const diff = g - gBase
                                  return <td key={o} className={`text-right px-2 whitespace-nowrap ${o === 0 ? "bg-violet-100 font-semibold" : diff > 0 ? "text-emerald-700" : diff < 0 ? "text-red-600" : ""}`} title={`${v.label} = ${val}`}>${money(g)}</td>
                                })}
                                <td className="pl-1"><button type="button" onClick={() => setSensVars(s => { const n = { ...s }; delete n[v.key]; return n })} className="text-xs text-gray-400 hover:text-red-600">✕</button></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })()}
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
              const pc = paso.calc
              const gCab = paso.cant > 0 ? paso.ganancia / paso.cant : 0
              const vPrevCab = paso.cant > 0 ? paso.vPrev / paso.cant : 0
              return (
                <div key={idx} className="p-2 rounded-lg border border-teal-200 bg-white/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={e.nombre} onChange={ev => updEtapa(idx, "nombre", ev.target.value)} className="border rounded px-1 py-0.5 text-sm font-medium w-32" />
                    <span className="text-xs text-gray-400">{paso.fechaIni} → {paso.fechaFin} · {Math.round(paso.cant)} cab heredadas</span>
                    <button type="button" onClick={() => delEtapa(idx)} className="ml-auto text-xs text-red-600 hover:underline">✕ quitar</button>
                  </div>
                  {/* Inputs agrupados (mismo estilo que la etapa 1) */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-medium text-gray-600">Período</span>
                    <span className="flex items-center gap-1"><span className={lbl}>Días</span><input value={e.dias} onChange={ev => updEtapa(idx, "dias", ev.target.value)} className={`${inp} w-14`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Conversión kg/día</span><input value={e.conversion} onChange={ev => updEtapa(idx, "conversion", ev.target.value)} className={`${inp} w-16`} /></span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-medium text-gray-600">Venta</span>
                    <span className="flex items-center gap-1"><span className={lbl}>$/kg</span><input value={e.precioVenta} onChange={ev => { updEtapa(idx, "precioVenta", ev.target.value); mercado?.limpiar?.() }} className={`${inp} w-20`} />{puedeMercado && <button type="button" onClick={() => usarMercadoEtapa(idx, pc.pNetoSal)} title={`Precio de mercado (${sexoSeg}, ${Math.round(pc.pNetoSal)} kg netos)`} className="text-xs px-1 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200">mkt</button>}</span>
                    <span className="flex items-center gap-1"><span className={lbl}>Desbaste %</span><input value={e.desbSal} onChange={ev => updEtapa(idx, "desbSal", ev.target.value)} className={`${inp} w-12`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>CZ %</span><input value={e.czSal} onChange={ev => updEtapa(idx, "czSal", ev.target.value)} className={`${inp} w-12`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Mort. %</span><input value={e.mort} onChange={ev => updEtapa(idx, "mort", ev.target.value)} className={`${inp} w-12`} /></span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-medium text-gray-600">Ración</span>
                    <span className="flex items-center gap-1"><span className={lbl}>% PV</span><input value={e.racionPV} onChange={ev => updEtapa(idx, "racionPV", ev.target.value)} className={`${inp} w-12`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Maíz $/kg</span><input value={e.maizPrecio} onChange={ev => updEtapa(idx, "maizPrecio", ev.target.value)} className={`${inp} w-20`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Conc. $/kg</span><input value={e.concPrecio} onChange={ev => updEtapa(idx, "concPrecio", ev.target.value)} className={`${inp} w-20`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Maíz %</span><input value={e.maizPct} onChange={ev => updEtapa(idx, "maizPct", ev.target.value)} className={`${inp} w-12`} /></span>
                    <span className="flex items-center gap-1"><span className={lbl}>Conc. %</span><input value={e.concPct} onChange={ev => updEtapa(idx, "concPct", ev.target.value)} className={`${inp} w-12`} /></span>
                  </div>
                  {/* Desglose de la etapa (por cabeza) — mismo formato que la etapa 1 */}
                  <table className="text-sm w-full">
                    <tbody>
                      <tr><td className={`${lbl} pr-4`}>Peso heredado → fin</td><td className="text-right">{kg(paso.pIni)} → {kg(pc.pFin)} kg</td></tr>
                      <tr className="text-red-500"><td className="pr-4 pl-2 text-xs">merma mortandad ({e.mort || 0}%)</td><td className="text-right">−{kg(pc.mermaKgMort)} kg</td></tr>
                      <tr className="text-red-500"><td className="pr-4 pl-2 text-xs">merma desbaste ({e.desbSal || 0}%)</td><td className="text-right">−{kg(pc.mermaKgSal)} kg</td></tr>
                      <tr><td className={`${lbl} pr-4`}>Peso neto</td><td className="text-right">{kg(pc.pNetoSal)} kg</td></tr>
                      <tr><td className={`${lbl} pr-4`}>Monto bruto / cab</td><td className="text-right">${money(pc.brutoSal)}</td></tr>
                      <tr className="text-red-500"><td className="pr-4 pl-2 text-xs">merma CZ ({e.czSal || 0}%)</td><td className="text-right">−${money(pc.mermaCzSal)}</td></tr>
                      <tr className="font-medium border-t"><td className="pr-4 py-0.5">Venta hipotética / cab</td><td className="text-right">${money(pc.czNetoSal)}</td></tr>
                      <tr className="text-red-500"><td className="pr-4 pl-2 text-xs">− ración / cab</td><td className="text-right">−${money(-pc.costoRacion)}</td></tr>
                      <tr className="text-red-500"><td className="pr-4 pl-2 text-xs">− venta etapa anterior / cab <span className="text-gray-400">(costo oport.)</span></td><td className="text-right">−${money(vPrevCab)}</td></tr>
                      <tr className="font-semibold border-t"><td className="pr-4 py-0.5">Ganancia etapa / cab</td><td className={`text-right ${gCab >= 0 ? "text-emerald-700" : "text-red-600"}`}>${money(gCab)}</td></tr>
                      <tr className="font-semibold"><td className="pr-4">Ganancia etapa total (× {Math.round(paso.cant)})</td><td className={`text-right ${paso.ganancia >= 0 ? "text-emerald-700" : "text-red-600"}`}>${money(paso.ganancia)}</td></tr>
                    </tbody>
                  </table>
                </div>
              )
            })}

            {etapas.length > 0 && (
              <table className="text-sm">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="text-center px-1 py-1" title="Vendés al final de esta etapa">Salida</th>
                    <th className="text-left pr-4">Etapa</th>
                    <th className="text-left px-3">Período</th>
                    <th className="text-right px-3">Peso ini→fin</th>
                    <th className="text-right px-3">Cant.</th>
                    <th className="text-right px-3">Venta hipot.</th>
                    <th className="text-right px-3">Ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {cadena.pasos.map((p, i) => {
                    const incluida = i <= exitIdx
                    return (
                      <tr key={i} className={incluida ? "" : "text-gray-300"}>
                        <td className="text-center px-1"><input type="radio" name={`salida-seg-${indice}`} checked={exitIdx === i} onChange={() => setSalidaEtapa(i === cadena.pasos.length - 1 ? -1 : i)} title="Vender al final de esta etapa" /></td>
                        <td className="pr-4 py-1">{p.nombre}</td>
                        <td className="px-3 text-gray-500 text-xs">{p.fechaIni} → {p.fechaFin}</td>
                        <td className="text-right px-3">{kg(p.pIni)} → {kg(p.pFin)}</td>
                        <td className="text-right px-3">{Math.round(p.cant)}</td>
                        <td className="text-right px-3">${money(p.V)}</td>
                        <td className={`text-right px-3 ${!incluida ? "" : p.ganancia >= 0 ? "text-emerald-700" : "text-red-600"}`}>${money(p.ganancia)}</td>
                      </tr>
                    )
                  })}
                  <tr className="font-semibold border-t">
                    <td colSpan={6} className="pr-4 py-1">Ganancia hasta la salida ({cadena.pasos[exitIdx]?.nombre})</td>
                    <td className={`text-right px-3 text-base ${gananciaHastaSalida >= 0 ? "text-emerald-700" : "text-red-600"}`}>${money(gananciaHastaSalida)}</td>
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
interface ContainerProps extends Props {
  segConfigs?: SegConfig[]
  onRestoreSegConfigs?: (c: SegConfig[], modo: ModoCarga) => void
}
export function AnalisisProductivo({ secciones, total, segConfigs, onRestoreSegConfigs }: ContainerProps) {
  const nextId = useRef(1)
  const [segIds, setSegIds] = useState<number[]>([0])
  const [totales, setTotales] = useState<Record<number, number>>({})
  const [initials, setInitials] = useState<Record<number, Partial<SegState>>>({})
  const segStatesRef = useRef<Record<number, SegState>>({})
  const [estudios, setEstudios] = useState<Record<string, Estudio>>({})
  const [sel, setSel] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  // Precios de mercado (referencia, scraping entresurcosycorralesya)
  // Default: ventana que termina unos días atrás (el sitio publica con demora; los días más recientes vienen vacíos)
  const isoDias = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)
  const [mercDesde, setMercDesde] = useState(isoDias(13))
  const [mercHasta, setMercHasta] = useState(isoDias(3))
  const [mercMacho, setMercMacho] = useState<FilaMercado[] | null>(null)
  const [mercHembra, setMercHembra] = useState<FilaMercado[] | null>(null)
  const [mercFecha, setMercFecha] = useState<string | null>(null) // cuándo se scrapearon (para guardar con el estudio)
  const [mercSexoVer, setMercSexoVer] = useState<"macho" | "hembra">("macho")
  const [prima, setPrima] = useState("") // % de calidad sobre el precio calculado (vacío = 0)
  const [mercLoading, setMercLoading] = useState(false)
  const [mercOpen, setMercOpen] = useState(false)
  const mercFilas = mercSexoVer === "hembra" ? mercHembra : mercMacho
  const traerMercado = async () => {
    setMercLoading(true)
    try {
      const [rm, rh] = await Promise.all([
        fetch(`/api/precios-mercado?sexo=macho&desde=${mercDesde}&hasta=${mercHasta}`),
        fetch(`/api/precios-mercado?sexo=hembra&desde=${mercDesde}&hasta=${mercHasta}`),
      ])
      const dm = await rm.json(), dh = await rh.json()
      if (!rm.ok) throw new Error(dm.error || "Error (machos)")
      setMercMacho(dm.filas)
      setMercHembra(rh.ok ? dh.filas : null)
      setMercFecha(new Date().toISOString())
      setMercOpen(true)
    } catch (e) { toast.error("Precios de mercado: " + (e as Error).message) }
    finally { setMercLoading(false) }
  }
  // Precio de mercado interpolado: base = Kilo+ (máximo) del rango en su extremo liviano (pesoLo),
  // interpolado por peso; × (1 + prima%). Fuera de los extremos → ancla del extremo (no extrapola).
  const primaFactor = 1 + (parseFloat(prima.replace(",", ".")) || 0) / 100
  const precioMercado = (sexo: "macho" | "hembra", peso: number): { precio: number; cats: string[] } | null => {
    const filas = sexo === "hembra" ? mercHembra : mercMacho
    if (!filas || !filas.length || !peso) return null
    const anclas = filas.map(f => ({ w: f.pesoLo, p: f.kiloMax, cat: f.categoria })).filter(a => a.p > 0).sort((a, b) => a.w - b.w)
    if (!anclas.length) return null
    let base: number, cats: string[]
    if (peso <= anclas[0].w) { base = anclas[0].p; cats = [anclas[0].cat] }
    else if (peso >= anclas[anclas.length - 1].w) { base = anclas[anclas.length - 1].p; cats = [anclas[anclas.length - 1].cat] }
    else {
      let i = 0; while (i < anclas.length - 1 && anclas[i + 1].w <= peso) i++
      const a = anclas[i], b = anclas[i + 1]
      base = a.p + ((peso - a.w) / (b.w - a.w)) * (b.p - a.p)
      cats = [a.cat] // el rango que contiene el peso (a.pesoLo ≤ peso < b.pesoLo)
    }
    return { precio: base * primaFactor, cats }
  }
  const mercadoDisponible = !!(mercMacho || mercHembra)
  // Resaltar en el panel los rangos usados por el último "mkt"
  const [mercResaltar, setMercResaltar] = useState<{ sexo: "macho" | "hembra"; cats: string[] } | null>(null)
  const resaltarMercado = (sexo: "macho" | "hembra", cats: string[]) => { setMercSexoVer(sexo); setMercResaltar({ sexo, cats }); setMercOpen(true) }
  const limpiarResaltar = () => setMercResaltar(null)

  useEffect(() => { try { setEstudios(JSON.parse(localStorage.getItem(LS_ESTUDIOS) || "{}")) } catch { /* ignore */ } }, [])

  const addSeg = () => setSegIds(p => [...p, nextId.current++])
  const removeSeg = (id: number) => {
    setSegIds(p => p.filter(x => x !== id))
    setTotales(t => { const n = { ...t }; delete n[id]; return n })
    delete segStatesRef.current[id]
  }
  const reportTotal = (id: number, v: number) => setTotales(t => t[id] === v ? t : { ...t, [id]: v })
  const reportState = (id: number, s: SegState) => { segStatesRef.current[id] = s }
  // Getters de export por segmento (para el PDF/Excel combinado del estudio)
  const exportGettersRef = useRef<Record<number, () => SegExportData>>({})
  const registerExport = (id: number, getter: (() => SegExportData) | null) => {
    if (getter) exportGettersRef.current[id] = getter; else delete exportGettersRef.current[id]
  }
  const duplicarSeg = (id: number) => {
    const st = segStatesRef.current[id]
    if (!st) return
    const nid = nextId.current++
    setInitials(ini => ({ ...ini, [nid]: JSON.parse(JSON.stringify(st)) }))
    setSegIds(p => { const i = p.indexOf(id); const n = [...p]; n.splice(i + 1, 0, nid); return n })
  }
  const combinado = segIds.reduce((s, id) => s + (totales[id] || 0), 0)

  const snapshotEstudio = (): Estudio => ({
    version: 1, fecha: new Date().toISOString(),
    segments: segIds.map(id => segStatesRef.current[id]).filter(Boolean) as SegState[],
    segConfigs,
    // Precios de mercado scrapeados → se guardan con el estudio (solo si hay datos traídos)
    mercado: (mercMacho || mercHembra)
      ? { desde: mercDesde, hasta: mercHasta, prima, macho: mercMacho, hembra: mercHembra, fechaScraping: mercFecha ?? undefined }
      : undefined,
  })
  const cargarEstudio = (est: Estudio) => {
    const segs = est.segments || []
    if (!segs.length) return
    const cfgs = est.segConfigs ?? (est.segConfig ? [est.segConfig] : undefined)
    if (cfgs) {
      // Si el estudio guardó foto/receta, dejar elegir cómo linkear el segmentado.
      const conReceta = cfgs.some(c => c?.pesadaBaseFecha || c?.fechaCalculo)
      const conFoto = cfgs.some(c => c?.snapshot)
      let modo: ModoCarga = "relink"
      if (conFoto || conReceta) {
        const fBase = cfgs.find(c => c?.pesadaBaseFecha)?.pesadaBaseFecha
        const relink = window.confirm(
          "¿Cómo cargar el segmentado por peso?\n\n" +
          "• Aceptar → 🔄 RE-LINKEAR con el rodeo" + (fBase ? ` (recalcula anclado a la pesada del ${fBase.split("-").reverse().join("/")})` : "") + ".\n" +
          "• Cancelar → 📌 DATOS GUARDADOS (foto congelada — no depende de la base, a prueba de bugs)."
        )
        modo = relink ? "relink" : "foto"
      }
      onRestoreSegConfigs?.(cfgs, modo) // reconstruye los segmentadores
    }
    // Restaurar precios de mercado guardados con el estudio (si los tiene)
    if (est.mercado) {
      setMercDesde(est.mercado.desde)
      setMercHasta(est.mercado.hasta)
      setPrima(est.mercado.prima ?? "")
      setMercMacho(est.mercado.macho ?? null)
      setMercHembra(est.mercado.hembra ?? null)
      setMercFecha(est.mercado.fechaScraping ?? null)
      if (est.mercado.macho || est.mercado.hembra) setMercOpen(true)
    }
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

  // Sobrescribe el estudio ABIERTO (sin re-tipear el nombre) → evita ir acumulando duplicados.
  const actualizar = () => {
    if (!sel || !estudios[sel]) return
    if (!confirm(`¿Sobrescribir el estudio "${sel}" con el estado actual?`)) return
    const est = snapshotEstudio()
    const all = { ...estudios, [sel]: est }
    localStorage.setItem(LS_ESTUDIOS, JSON.stringify(all))
    setEstudios(all)
    toast.success(`Estudio "${sel}" actualizado`)
  }
  // Guardar como… → crea un estudio nuevo (pide nombre; pre-carga vacío para no pisar sin querer).
  const guardar = async () => {
    const nombre = (prompt("Guardar como (nombre del estudio nuevo):", "") || "").trim()
    if (!nombre) return
    if (estudios[nombre] && !confirm(`Ya existe un estudio "${nombre}". ¿Sobrescribirlo?`)) return
    const est = snapshotEstudio()
    const all = { ...estudios, [nombre]: est }
    localStorage.setItem(LS_ESTUDIOS, JSON.stringify(all))
    setEstudios(all); setSel(nombre)
    toast.success(`Estudio "${nombre}" guardado en la app`)
    if (confirm("¿Descargar también el archivo (backup portable, elegís la carpeta)?")) {
      await descargarEstudio(est, `Estudio_${nombre.replace(/\s+/g, "_")}.json`)
    }
  }
  const borrarEstudio = (nombre: string) => {
    if (!nombre || !confirm(`¿Borrar el estudio "${nombre}"? (no se puede deshacer)`)) return
    const all = { ...estudios }; delete all[nombre]
    localStorage.setItem(LS_ESTUDIOS, JSON.stringify(all))
    setEstudios(all); if (sel === nombre) setSel("")
    toast.success(`Estudio "${nombre}" borrado`)
  }
  const descargarArchivo = () => descargarEstudio(snapshotEstudio(), `Estudio_engorde_${new Date().toISOString().slice(0, 10)}.json`)

  // ── Export COMBINADO del estudio (todos los segmentos: resumen + detalle) ──
  const nombreEstudioArch = () => (sel || `engorde_${new Date().toISOString().slice(0, 10)}`).replace(/\s+/g, "_")
  const datosExport = (): SegExportData[] => segIds.map(id => exportGettersRef.current[id]?.()).filter(Boolean) as SegExportData[]

  const exportarPDFTotal = () => {
    const datos = datosExport()
    if (!datos.length) { toast.error("No hay segmentos para exportar"); return }
    const doc = new jsPDF()
    doc.setFontSize(15); doc.text(`Estudio${sel ? `: ${sel}` : ""}`, 14, 16)
    doc.setFontSize(10); doc.text(new Date().toLocaleDateString("es-AR"), 14, 22)
    const incl = datos.filter(d => d.resumen.incluido)
    const totCant = incl.reduce((s, d) => s + d.resumen.cant, 0)
    const totGan = incl.reduce((s, d) => s + d.resumen.gananciaTotal, 0)
    autoTable(doc, {
      startY: 27, theme: "grid", styles: { fontSize: 8 },
      head: [["Segmento", "Cant", "Peso ini→fin", "$/cab", "$ total"]],
      body: [
        ...datos.map(d => [
          d.resumen.titulo + (d.resumen.incluido ? "" : " (no incl.)"),
          String(Math.round(d.resumen.cant)),
          `${kg(d.resumen.pesoIni)}→${kg(d.resumen.pesoFin)}`,
          `$${money(d.resumen.gananciaCab)}`,
          `$${money(d.resumen.gananciaTotal)}`,
        ]),
        ["TOTAL (incluidos)", String(totCant), "", "", `$${money(totGan)}`],
      ],
    })
    datos.forEach(d => { doc.addPage(); renderPdfBlocks(doc, d.blocks, 16) })
    doc.save(`Estudio_${nombreEstudioArch()}.pdf`)
  }

  const exportarExcelTotal = () => {
    const datos = datosExport()
    if (!datos.length) { toast.error("No hay segmentos para exportar"); return }
    const wb = XLSX.utils.book_new()
    const incl = datos.filter(d => d.resumen.incluido)
    const resumenAOA: (string | number)[][] = [
      ["ESTUDIO", sel || ""],
      [],
      ["Segmento", "Incluido", "Cant", "Peso ini", "Peso fin", "$/cab", "$ total"],
      ...datos.map(d => [d.resumen.titulo, d.resumen.incluido ? "Sí" : "No", Math.round(d.resumen.cant), Math.round(d.resumen.pesoIni), Math.round(d.resumen.pesoFin), Math.round(d.resumen.gananciaCab), Math.round(d.resumen.gananciaTotal)]),
      ["TOTAL (incluidos)", "", incl.reduce((s, d) => s + d.resumen.cant, 0), "", "", "", incl.reduce((s, d) => s + d.resumen.gananciaTotal, 0)],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumenAOA), "Resumen")
    const usados = new Set<string>()
    datos.forEach((d, i) => {
      const base = (d.resumen.titulo || `Seg ${i + 1}`).replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || `Seg ${i + 1}`
      let n = base, k = 2; while (usados.has(n)) n = `${base.slice(0, 26)} ${k++}`
      usados.add(n)
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d.filas), n)
    })
    XLSX.writeFile(wb, `Estudio_${nombreEstudioArch()}.xlsx`)
  }
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
        {sel && estudios[sel] && (
          <button type="button" onClick={actualizar} title={`Sobrescribir el estudio abierto "${sel}"`} className="px-2 py-1 rounded border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700">💾 Actualizar «{sel}»</button>
        )}
        <button type="button" onClick={guardar} title="Guardar como un estudio nuevo (pide nombre)" className="px-2 py-1 rounded border border-emerald-500 text-emerald-700 hover:bg-emerald-50">💾 Guardar como…</button>
        <select value={sel} onChange={e => { setSel(e.target.value); if (e.target.value && estudios[e.target.value]) cargarEstudio(estudios[e.target.value]) }} className="border rounded px-1 py-1">
          <option value="">Cargar guardado…</option>
          {Object.keys(estudios).sort().map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {Object.keys(estudios).length > 0 && (
          <select value="" onChange={e => { const n = e.target.value; e.target.value = ""; if (n) borrarEstudio(n) }} className="border border-red-200 rounded px-1 py-1 text-red-600" title="Borrar un estudio guardado (sin cargarlo)">
            <option value="">🗑 borrar…</option>
            {Object.keys(estudios).sort().map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <span className="text-gray-300">·</span>
        <button type="button" onClick={descargarArchivo} className="px-2 py-1 rounded border border-slate-400 text-slate-700 hover:bg-slate-50">⬇ Archivo</button>
        <button type="button" onClick={() => fileRef.current?.click()} className="px-2 py-1 rounded border border-slate-400 text-slate-700 hover:bg-slate-50">⬆ Cargar archivo</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={cargarArchivo} />
        <span className="text-gray-300">·</span>
        <button type="button" onClick={exportarPDFTotal} title="PDF del estudio completo: resumen + detalle de cada segmento" className="px-2 py-1 rounded border border-red-400 text-red-700 hover:bg-red-50">⬇ PDF total</button>
        <button type="button" onClick={exportarExcelTotal} title="Excel del estudio completo: hoja Resumen + una hoja por segmento" className="px-2 py-1 rounded border border-emerald-500 text-emerald-700 hover:bg-emerald-50">⬇ Excel total</button>
        <span className="text-xs text-gray-400">guardado = en esta PC · archivo = portable/backup</span>
      </div>

      {/* Precios de mercado (referencia) */}
      <div className="mb-3 border rounded-lg bg-white">
        <div className="flex flex-wrap items-center gap-2 p-2 text-sm">
          <button type="button" onClick={() => setMercOpen(v => !v)} className="font-semibold text-gray-700 flex items-center gap-1">
            <span className="text-gray-400">{mercOpen ? "▼" : "▶"}</span>Precios de mercado (referencia)
          </button>
          <span className="text-gray-500 ml-2">Desde</span>
          <input type="date" value={mercDesde} onChange={e => setMercDesde(e.target.value)} className="border rounded px-1 py-0.5" />
          <span className="text-gray-500">Hasta</span>
          <input type="date" value={mercHasta} onChange={e => setMercHasta(e.target.value)} className="border rounded px-1 py-0.5" />
          <button type="button" onClick={traerMercado} disabled={mercLoading} className="px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">{mercLoading ? "Trayendo…" : "Traer precios"}</button>
          {mercadoDisponible && (<>
            <span className="ml-2 flex items-center gap-1">
              {(["macho", "hembra"] as const).map(s => (
                <button key={s} type="button" onClick={() => setMercSexoVer(s)} className={`px-2 py-0.5 rounded-full border text-xs ${mercSexoVer === s ? "bg-slate-700 text-white border-slate-700" : "bg-white border-gray-300 text-gray-500"}`}>{s === "macho" ? "♂ Machos" : "♀ Hembras"}</button>
              ))}
            </span>
            <span className="flex items-center gap-1"><span className="text-gray-500">Prima calidad %</span><input value={prima} onChange={e => setPrima(e.target.value)} placeholder="0" className="border rounded px-1 py-0.5 w-14 text-right" /></span>
          </>)}
          {mercFilas && <span className="text-xs text-gray-400">{mercFilas.length} cat · fuente: entresurcosycorralesya.com{mercFecha ? ` · traídos ${new Date(mercFecha).toLocaleDateString("es-AR")}` : ""}</span>}
        </div>
        {mercOpen && mercFilas && (
          <div className="px-2 pb-2 overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-gray-500 border-b">
                  <th className="text-left pr-3 py-1">Categoría</th><th className="text-right px-2">Cant.</th>
                  <th className="text-right px-2">Prom. Kilo</th><th className="text-right px-2">Kilo+</th><th className="text-right px-2">Kilo−</th>
                  <th className="text-right px-2">Prom. Bulto</th><th className="text-right px-2">Bulto+</th><th className="text-right px-2">Bulto−</th>
                </tr>
              </thead>
              <tbody>
                {mercFilas.map((f, i) => (
                  <tr key={i} className={`border-b border-slate-100 ${mercResaltar && mercResaltar.sexo === mercSexoVer && mercResaltar.cats.includes(f.categoria) ? "bg-amber-100 font-medium" : "hover:bg-slate-50"}`}>
                    <td className="pr-3 py-1">{f.categoria}</td>
                    <td className="text-right px-2">{f.cantidad}</td>
                    <td className="text-right px-2 font-medium">${money(f.promKilo)}</td>
                    <td className="text-right px-2 text-emerald-700">${money(f.kiloMax)}</td>
                    <td className="text-right px-2 text-red-600">${money(f.kiloMin)}</td>
                    <td className="text-right px-2 text-gray-500">${money(f.promBulto)}</td>
                    <td className="text-right px-2 text-gray-500">${money(f.bultoMax)}</td>
                    <td className="text-right px-2 text-gray-500">${money(f.bultoMin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 items-start">
        {segIds.map((id, i) => (
          <AnalisisSegmento key={id} indice={i} secciones={secciones} total={total}
            initial={initials[id]}
            mercado={mercadoDisponible ? { precio: precioMercado, resaltar: resaltarMercado, limpiar: limpiarResaltar } : undefined}
            onDuplicar={() => duplicarSeg(id)}
            onRemove={segIds.length > 1 ? () => removeSeg(id) : undefined}
            onTotal={v => reportTotal(id, v)}
            onState={s => reportState(id, s)}
            onRegisterExport={g => registerExport(id, g)} />
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
