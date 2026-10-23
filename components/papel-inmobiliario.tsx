"use client"

/**
 * 🏛️ DETALLE DE INMOBILIARIO, RED VIAL Y AUTOMOTORES — A-FEAT-1320 punto (5) / A-FEAT-1201.
 *
 * Se abre desde la Planilla de impuestos. El formato es el de la planilla del usuario: por empresa,
 * una fila por campo con su partida, el total del año anterior, el pago anual, el total en cuotas, el
 * aumento, cada cuota con su vencimiento y el costo anual en $ y en U$S; el complementario y los
 * totales abajo. La lógica (y el porqué de cada columna) vive en `lib/impuestos/papel-inmobiliario.ts`.
 *
 * Sólo lectura. El Excel lleva las fórmulas de la planilla (aumento, totales, U$S, por hectárea y el
 * CONTROL que tiene que dar cero), para que se pueda seguir trabajando sobre él.
 */
import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { armarPapel, TITULO_PAPEL, type TipoPapel, type Papel } from "@/lib/impuestos/papel-inmobiliario"
import type { CuotaPlanilla } from "@/lib/impuestos/planilla"
import type { TipoCambio } from "@/lib/arrendamientos/calculo"

const plata = (n: number | null | undefined) => n == null ? "" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (iso: string) => iso.split("-").reverse().join("/")
const pct = (n: number | null) => n == null ? "—" : `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`
const TIPOS: TipoPapel[] = ["inmobiliario", "red-vial", "automotores"]

export interface PropsPapel {
  open: boolean
  onOpenChange: (v: boolean) => void
  tipoInicial: TipoPapel
  anioInicial: number
  cuotas: CuotaPlanilla[]
  tcs: TipoCambio[]
  hectareas: Record<string, number>
  /** El total de esas mismas filas en la Planilla, para el control (por año y tipo). */
  totalEnPlanilla: (tipo: TipoPapel, anio: number) => number
}

export function PapelInmobiliario({ open, onOpenChange, tipoInicial, anioInicial, cuotas, tcs, hectareas, totalEnPlanilla }: PropsPapel) {
  const [tipo, setTipo] = useState<TipoPapel>(tipoInicial)
  const [anio, setAnio] = useState(anioInicial)
  const [abiertoCon, setAbiertoCon] = useState<string>("")
  // Cada vez que se abre desde la planilla, arranca en lo que se pidió.
  const clave = `${open}|${tipoInicial}|${anioInicial}`
  if (open && abiertoCon !== clave) { setAbiertoCon(clave); setTipo(tipoInicial); setAnio(anioInicial) }

  const papel = useMemo(() => armarPapel(tipo, cuotas as any, anio, tcs, hectareas), [tipo, cuotas, anio, tcs, hectareas])
  const enPlanilla = totalEnPlanilla(tipo, anio)
  const cierra = Math.abs(enPlanilla - papel.total) <= 0.01

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[99vw] w-[99vw] h-[94vh] max-h-[94vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            🏛️ {TITULO_PAPEL[tipo]}
            <span className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setAnio(a => a - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="min-w-[3.5rem] text-center text-xl font-bold">{anio}</span>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setAnio(a => a + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </span>
            <span className="flex gap-1">
              {TIPOS.map(t => (
                <Button key={t} size="sm" variant={t === tipo ? "default" : "outline"} onClick={() => setTipo(t)}>{TITULO_PAPEL[t]}</Button>
              ))}
            </span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => exportarPapel(papel)} disabled={papel.bloques.length === 0}>
              <Download className="mr-1 h-4 w-4" />Excel
            </Button>
          </DialogTitle>
          <DialogDescription>
            Por empresa, una fila por campo. Sale de los templates y sus cuotas; el costo anual es lo que se pagó o se va a pagar en {anio}.
            {papel.tcPromedio ? <> TC promedio de los meses de las cuotas: <b>${plata(papel.tcPromedio)}</b>.</> : <> Sin TC en la base para esos meses: no hay columna en U$S.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {papel.faltaHas && (
            <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-800">
              Faltan las <b>hectáreas</b> de las partidas: sin ellas no hay costo por hectárea (ni quintales de soja o kg de carne por ha).
            </span>
          )}
          <span className="ml-auto">
            {cierra
              ? <span className="text-green-700" title="El total de este papel es igual a la suma de las mismas filas en la Planilla de impuestos">✓ control: igual a la Planilla (${plata(enPlanilla)})</span>
              : <span className="font-semibold text-red-700">⚠️ no cierra con la Planilla: papel ${plata(papel.total)} vs planilla ${plata(enPlanilla)}</span>}
          </span>
        </div>

        {papel.bloques.length === 0 ? (
          <p className="rounded border bg-gray-50 p-6 text-center text-sm text-gray-600">No hay cuotas de {TITULO_PAPEL[tipo].toLowerCase()} en {anio}.</p>
        ) : (
          <div className="overflow-x-auto rounded border">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100">
                <tr>
                  <th className="px-2 py-1 text-left">Campo</th>
                  <th className="px-2 py-1 text-left">Partida</th>
                  <th className="px-2 py-1 text-right">Has</th>
                  <th className="px-2 py-1 text-right">Total {anio - 1}</th>
                  <th className="px-2 py-1 text-right">Pago anual</th>
                  <th className="px-2 py-1 text-right">Total en cuotas</th>
                  <th className="px-2 py-1 text-right">Aumento</th>
                  {Array.from({ length: papel.maxCuotas }, (_, i) => <th key={i} className="px-2 py-1 text-right">Cuota {i + 1}</th>)}
                  <th className="px-2 py-1 text-right bg-slate-200">Costo anual $</th>
                  <th className="px-2 py-1 text-right bg-slate-200">x ha $</th>
                  <th className="px-2 py-1 text-right bg-slate-200">Costo U$S</th>
                  <th className="px-2 py-1 text-right bg-slate-200">x ha U$S</th>
                </tr>
              </thead>
              <tbody>
                {papel.bloques.map(b => (
                  <BloqueFilas key={b.empresa} b={b} anio={anio} max={papel.maxCuotas} />
                ))}
                <tr className="border-t-2 border-slate-500 bg-slate-100 text-sm font-bold">
                  <td className="px-2 py-1" colSpan={3}>TOTAL {papel.bloques.map(b => b.empresa).join(" + ")}</td>
                  <td className="px-2 py-1 text-right">{plata(papel.totalAnterior)}</td>
                  <td colSpan={2} />
                  <td className="px-2 py-1 text-right">{papel.bloques.some(b => b.filas.some(f => f.anteriorIncompleto || (f.totalAnterior === 0 && f.costoAnual > 0))) ? "—" : pct(papel.totalAnterior > 0 ? papel.total / papel.totalAnterior - 1 : null)}</td>
                  <td colSpan={papel.maxCuotas} />
                  <td className="px-2 py-1 text-right">{plata(papel.total)}</td>
                  <td />
                  <td className="px-2 py-1 text-right">{papel.tcPromedio ? plata(papel.total / papel.tcPromedio) : ""}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function BloqueFilas({ b, anio, max }: { b: Papel["bloques"][number]; anio: number; max: number }) {
  return (
    <>
      <tr className="bg-slate-50"><td colSpan={11 + max} className="px-2 py-1 text-sm font-semibold">{b.empresa}</td></tr>
      {b.filas.map(f => (
        <tr key={`${f.campo}|${f.partida}`} className={`border-t ${f.complementario ? "bg-amber-50/50 font-medium" : ""}`}>
          <td className="px-2 py-1">{f.campo}</td>
          <td className="px-2 py-1 font-mono text-[11px]">{f.partida ?? ""}</td>
          <td className="px-2 py-1 text-right text-gray-400">{f.has ?? "—"}</td>
          <td className="px-2 py-1 text-right">{plata(f.totalAnterior)}</td>
          <td className="px-2 py-1 text-right">{plata(f.pagoAnual)}</td>
          <td className="px-2 py-1 text-right">{plata(f.totalCuotas)}</td>
          <td className={`px-2 py-1 text-right ${(f.aumento ?? 0) > 0.5 ? "font-semibold text-red-700" : ""}`}
            title={f.anteriorIncompleto ? `En la app el año ${anio - 1} tiene menos cuotas de esta partida que ${anio} (el histórico arranca en jul-2025): el aumento no se puede calcular` : undefined}>
            {f.anteriorIncompleto ? <span className="text-[10px] text-gray-400">año ant. incompleto</span> : pct(f.aumento)}
          </td>
          {Array.from({ length: max }, (_, i) => {
            const c = f.cuotas[i]
            return <td key={i} className="px-2 py-1 text-right" title={c ? `${c.estado}` : undefined}>
              {c ? <><div>{plata(c.monto)}</div><div className="text-[10px] text-gray-500">{fecha(c.vencimiento)}</div></> : ""}
            </td>
          })}
          <td className="px-2 py-1 text-right font-semibold bg-slate-50">{plata(f.costoAnual)}</td>
          <td className="px-2 py-1 text-right bg-slate-50">{plata(f.costoHa)}</td>
          <td className="px-2 py-1 text-right bg-slate-50">{plata(f.costoUsd)}</td>
          <td className="px-2 py-1 text-right bg-slate-50">{plata(f.costoHaUsd)}</td>
        </tr>
      ))}
      <tr className="border-t bg-slate-100 font-semibold">
        <td className="px-2 py-1" colSpan={3}>TOTAL {b.empresa}</td>
        <td className="px-2 py-1 text-right">{plata(b.totalAnterior)}</td>
        <td colSpan={2} />
        <td className="px-2 py-1 text-right">{b.filas.some(f => f.anteriorIncompleto || (f.totalAnterior === 0 && f.costoAnual > 0)) ? "—" : pct(b.totalAnterior > 0 ? b.total / b.totalAnterior - 1 : null)}</td>
        <td colSpan={max} />
        <td className="px-2 py-1 text-right">{plata(b.total)}</td>
        <td />
        <td className="px-2 py-1 text-right">{plata(b.totalUsd)}</td>
        <td />
      </tr>
      <tr><td colSpan={11 + max} className="h-2" /></tr>
    </>
  )
}

/** Columna de Excel (0 → A). */
const col = (i: number) => { let s = ""; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26) } return s }

/**
 * Excel con las fórmulas de la planilla: Costo anual = Pago anual + Total en cuotas · Aumento =
 * Costo / Total anterior − 1 · U$S = Costo / TC promedio · por hectárea = / Has · totales con SUMA ·
 * y un CONTROL que resta el total general de la suma de las empresas (tiene que dar 0).
 */
function exportarPapel(p: Papel) {
  const n = p.maxCuotas
  const cab = ["Campo", "Partida", "Has", `Total ${p.anio - 1}`, "Pago anual", "Total en cuotas", "Costo anual $", "Aumento",
    ...Array.from({ length: n }, (_, i) => [`Cuota ${i + 1}`, `Vto. ${i + 1}`]).flat(), "Costo x ha $", "Costo U$S", "Costo x ha U$S"]
  const cG = col(6), cD = col(3), cC = col(2), cE = col(4), cF = col(5)
  const cTc = "B2"
  const filas: any[][] = [
    [`${TITULO_PAPEL[p.tipo]} ${p.anio}`],
    ["TC promedio", p.tcPromedio ?? ""],
    [],
    cab,
  ]
  const totalesEmpresa: number[] = []
  for (const b of p.bloques) {
    filas.push([b.empresa])
    const desde = filas.length + 1
    for (const f of b.filas) {
      const r = filas.length + 1
      filas.push([
        f.campo, f.partida ?? "", f.has ?? "", f.totalAnterior, f.pagoAnual ?? 0, f.totalCuotas,
        { f: `${cE}${r}+${cF}${r}` }, { f: `IF(${cD}${r}>0,${cG}${r}/${cD}${r}-1,"")` },
        ...Array.from({ length: n }, (_, i) => f.cuotas[i] ? [f.cuotas[i].monto, f.cuotas[i].vencimiento.split("-").reverse().join("/")] : ["", ""]).flat(),
        { f: `IF(N(${cC}${r})>0,${cG}${r}/${cC}${r},"")` }, { f: `IF(N(${cTc})>0,${cG}${r}/${cTc},"")` }, { f: `IF(AND(N(${cC}${r})>0,N(${cTc})>0),${cG}${r}/${cTc}/${cC}${r},"")` },
      ])
    }
    const hasta = filas.length
    const r = filas.length + 1
    totalesEmpresa.push(r)
    filas.push([`TOTAL ${b.empresa}`, "", "", { f: `SUM(${cD}${desde}:${cD}${hasta})` }, { f: `SUM(${cE}${desde}:${cE}${hasta})` }, { f: `SUM(${cF}${desde}:${cF}${hasta})` },
      { f: `SUM(${cG}${desde}:${cG}${hasta})` }, { f: `IF(${cD}${r}>0,${cG}${r}/${cD}${r}-1,"")` }])
    filas.push([])
  }
  const rTot = filas.length + 1
  filas.push(["TOTAL GENERAL", "", "", { f: totalesEmpresa.map(r => `${cD}${r}`).join("+") || "0" }, "", "", { f: totalesEmpresa.map(r => `${cG}${r}`).join("+") || "0" }])
  filas.push(["CONTROL (tiene que dar 0)", "", "", "", "", "", { f: `${cG}${rTot}-(SUM(${cG}5:${cG}${rTot - 1})-SUMIF(A5:A${rTot - 1},"TOTAL *",${cG}5:${cG}${rTot - 1}))` }])
  const ws = XLSX.utils.aoa_to_sheet(filas)
  ws["!cols"] = [{ wch: 26 }, { wch: 15 }, { wch: 8 }, ...cab.slice(3).map(() => ({ wch: 14 }))]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, TITULO_PAPEL[p.tipo].slice(0, 28))
  XLSX.writeFile(wb, `${TITULO_PAPEL[p.tipo].split(" ")[0]}_${p.anio}.xlsx`)
}
