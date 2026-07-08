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

import { useMemo, useState } from "react"

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

export function AnalisisProductivo({ secciones, total }: Props) {
  const [colapsado, setColapsado] = useState(true)
  const [fase, setFase] = useState("")

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

  // ── Cálculo (mirror del Excel) ──
  const c = useMemo(() => {
    const cant = num(cantidad)
    const d = parseInt(dias) || 0
    const conv = num(conversion)
    const pIni = num(pesoInicio)
    const kgGanados = d * conv                       // H17
    const pFin = pIni + kgGanados                    // L16
    const pProm = (pFin + pIni) / 2                  // H18

    // Entrada
    const dEnt = pct(desbEnt)
    const mermaKgEnt = pIni * dEnt
    const pNetoEnt = pIni - mermaKgEnt               // C17
    const brutoEnt = pNetoEnt * num(precioCompra)    // C19
    const czEntV = pct(czEnt)
    const mermaCzEnt = brutoEnt * czEntV
    const netoEnt = brutoEnt - mermaCzEnt            // C20 = C28

    // Salida
    const dSal = pct(desbSal)
    const mermaKgSal = pFin * dSal
    const pNetoSal = pFin - mermaKgSal               // L17
    const brutoSal = pNetoSal * num(precioVenta)     // L19
    const czSalV = pct(czSal)
    const mermaCzSal = brutoSal * czSalV
    const czNetoSal = brutoSal - mermaCzSal          // L20

    // Ración
    const racKgDia = pProm * pct(racionPV)           // H20
    const mPct = pct(maizPct), cPct = pct(concPct)
    const maizKgDia = racKgDia * mPct                // H22
    const concKgDia = racKgDia * cPct                // H23
    const maizCosto = -num(maizPrecio) * maizKgDia * d   // L22 (por cabeza)
    const concCosto = -concKgDia * d * num(concPrecio)   // L23 (por cabeza)
    const costoRacion = maizCosto + concCosto        // L24
    const maizKgLote = maizKgDia * d * cant          // H24
    const concKgLote = concKgDia * d * cant          // H25

    // Resultado
    const netoSalida = czNetoSal + costoRacion       // L28
    const gananciaCab = netoSalida - netoEnt         // L30
    const gananciaTotal = gananciaCab * cant         // L31

    return {
      cant, d, kgGanados, pFin, pProm,
      mermaKgEnt, pNetoEnt, brutoEnt, mermaCzEnt, netoEnt,
      mermaKgSal, pNetoSal, brutoSal, mermaCzSal, czNetoSal,
      racKgDia, maizKgDia, concKgDia, maizCosto, concCosto, costoRacion, maizKgLote, concKgLote,
      netoSalida, gananciaCab, gananciaTotal,
    }
  }, [cantidad, dias, conversion, pesoInicio, desbEnt, desbSal, czEnt, czSal, precioCompra, precioVenta, racionPV, maizPct, concPct, maizPrecio, concPrecio])

  const inp = "border rounded px-1 py-0.5 text-right"
  const lbl = "text-gray-500"

  return (
    <div className="mb-4 border rounded-lg p-3 bg-emerald-50/40">
      <button type="button" onClick={() => setColapsado(v => !v)} className="flex items-center gap-2 w-full text-left font-semibold text-gray-700 mb-2">
        <span className="text-gray-400">{colapsado ? "▶" : "▼"}</span>
        <span>Análisis productivo-económico</span>
        {!colapsado || c.cant > 0
          ? <span className="text-xs font-normal text-emerald-700">· Ganancia total: ${money(c.gananciaTotal)}</span>
          : null}
      </button>

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
            <span className="flex items-center gap-1"><span className={lbl}>Compra $/kg</span><input value={precioCompra} onChange={e => setPrecioCompra(e.target.value)} className={`${inp} w-20`} /></span>
            <span className="flex items-center gap-1"><span className={lbl}>Venta $/kg</span><input value={precioVenta} onChange={e => setPrecioVenta(e.target.value)} className={`${inp} w-20`} /></span>
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

          {/* Resultado */}
          <div className="flex flex-wrap items-center gap-6 border-t pt-2">
            <span className="font-medium text-gray-600">Resultado</span>
            <span className={lbl}>Ganancia / cabeza: <b className={c.gananciaCab >= 0 ? "text-emerald-700" : "text-red-600"}>${money(c.gananciaCab)}</b></span>
            <span className={lbl}>Ganancia total (×{c.cant}): <b className={`text-lg ${c.gananciaTotal >= 0 ? "text-emerald-700" : "text-red-600"}`}>${money(c.gananciaTotal)}</b></span>
          </div>
        </div>
      )}
    </div>
  )
}
