"use client"

/**
 * 👥 EL DASHBOARD «POR RESPONSABLE» — A-FEAT-1637 (JMS 22/11/2026, en evaluación: si sirve va a main, si no se descarta).
 *
 * *«La realidad de cómo viene el año y cuánto debo / me deben entre socios.»* Lo mismo que «Por caja», pero cada peso va a quien
 * le corresponde (código interno → Libertad → template → factura → empleado → quien pagó; ver `lib/dashboard/responsable.ts`):
 *   · las 4 secciones de siempre, con lo suyo aunque lo haya pagado otro («(pagó MSA)»);
 *   · **Financiado por los socios** (socio → canal → grupo → template) y **Pagado por cuenta de socios** (socio → grupo → template;
 *     las transferencias como «Retiros directos», Libertad un renglón) — ni ingreso ni gasto;
 *   · **Cuenta con socios**: el saldo con cada uno al cierre del período, y el botón a la cuenta mes por mes (`CuentaEntreSocios`);
 *   · el **control** a la vista (por empresa, las tres contra «Por caja», los pares) y Excel / PDF / Imprimir con el formato fijo.
 */
import React, { useEffect, useMemo, useState } from "react"
import { Loader2, FileSpreadsheet, FileText, Printer, BookOpen } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TablaResumenFinanciero } from "@/components/tabla-resumen-financiero"
import { CuentaEntreSocios, FichaMovimiento } from "@/components/cuenta-entre-socios"
import { useDashboardPorResponsable, periodoDashboard } from "@/hooks/useDashboardPorResponsable"
import { useModoPermisos } from "@/components/contexto-permisos"
import { formatNumber, getMonthName } from "@/lib/format"
import { hoyArgentina } from "@/lib/fechas"
import { completarMeses, saldoCon, RAZON, SOCIOS_RESPONSABLES, type ControlVisible, type NodoSocios, type VistaResponsable } from "@/lib/dashboard/responsable"
import type { ResumenFinanciero } from "@/lib/dashboard/resumen"

interface Props {
  año: number
  semestre?: number
  empresas: string[]
  mostrarDecimales: boolean
  orden: string[] | null
  onReordenar: (o: string[] | null) => void
}

const claveMes = (m: ResumenFinanciero) => `${m.año}-${String(m.mes).padStart(2, "0")}`
const color = (v: number) => (v > 0 ? "text-green-600" : v < 0 ? "text-red-600" : "")

/** Una de las dos secciones de socios: socio → … → template, con los meses de la tabla de arriba. Las hojas se abren hasta el movimiento. */
function TablaSocios({ raiz, meses, decimales, todoAbierto, claseTitulo, explicacion }: {
  raiz: NodoSocios; meses: ResumenFinanciero[]; decimales: boolean; todoAbierto?: boolean; claseTitulo: string; explicacion: string
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const alternar = (k: string) => setAbiertos(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const prom = (n: NodoSocios) => n.total / (meses.length || 1)
  const fila = (n: NodoSocios, prof: number, camino: string): React.ReactNode => {
    const k = `${camino}/${n.nombre}`
    const tieneHijos = n.hijos.length > 0, tieneMovs = n.movs.length > 0
    const abierto = abiertos.has(k) || (todoAbierto && tieneHijos)
    return (
      <React.Fragment key={k}>
        <tr className={`border-t ${tieneHijos || tieneMovs ? "cursor-pointer hover:bg-muted/40" : ""}`} onClick={() => (tieneHijos || tieneMovs) && alternar(k)}>
          <td className="py-1 pr-2" style={{ paddingLeft: 16 + prof * 14 }}>
            {(tieneHijos || (tieneMovs && !todoAbierto)) && <span className="mr-1 text-[10px] text-gray-400 print:hidden">{abierto ? "▼" : "▶"}</span>}
            <span className={prof === 0 ? "font-medium" : ""}>{n.nombre}</span>
          </td>
          {meses.map(m => { const x = n.porMes[claveMes(m)]; return <td key={claveMes(m)} className="text-center">{x ? <span className={color(x)}>{formatNumber(x, decimales)}</span> : "-"}</td> })}
          <td className="bg-blue-50 text-center"><span className={color(n.total)}>{formatNumber(n.total, decimales)}</span></td>
          <td className="bg-green-50 text-center"><span className={color(prom(n))}>{formatNumber(prom(n), decimales)}</span></td>
        </tr>
        {abierto && n.hijos.map(h => fila(h, prof + 1, k))}
        {abierto && !todoAbierto && !tieneHijos && n.movs.map((x, i) => (
          <tr key={`${k}-m${i}`}><td colSpan={meses.length + 3} className="p-0">
            <table className="w-full"><tbody><FichaMovimiento m={x.m} importe={x.importe} decimales={decimales} nivel={prof + 2} /></tbody></table>
          </td></tr>
        ))}
      </React.Fragment>
    )
  }
  if (!raiz.hijos.length) return null
  return (
    <>
      <tr className={claseTitulo}>
        <td colSpan={meses.length + 3} className="py-1.5 pl-2 font-semibold">{raiz.nombre.toUpperCase()} <span className="ml-2 text-[11px] font-normal text-gray-600">{explicacion}</span></td>
      </tr>
      {raiz.hijos.map(h => fila(h, 0, raiz.nombre))}
      <tr className="border-t font-semibold">
        <td className="py-1 pl-2">Subtotal {raiz.nombre}</td>
        {meses.map(m => { const x = raiz.porMes[claveMes(m)] ?? 0; return <td key={claveMes(m)} className="text-center"><span className={color(x)}>{formatNumber(x, decimales)}</span></td> })}
        <td className="bg-blue-50 text-center"><span className={color(raiz.total)}>{formatNumber(raiz.total, decimales)}</span></td>
        <td className="bg-green-50 text-center">{formatNumber(prom(raiz), decimales)}</td>
      </tr>
    </>
  )
}

export function DashboardPorResponsable(p: Props) {
  // 👁️ En «Ver como lo ve ella» (modo permisos) se pide lo mismo que recibe un rol que no es admin: sólo lo de MA.
  const modo = useModoPermisos()
  const comoMA = !!modo?.soloLoQueVe
  const { resultado, problemas, loading, error } = useDashboardPorResponsable(p.año, p.semestre, p.empresas, comoMA)
  const { hasta } = periodoDashboard(p.año, p.semestre)
  const [verCuenta, setVerCuenta] = useState<string | null>(null)
  const [exportando, setExportando] = useState<"" | "excel" | "pdf">("")
  const [imprimiendo, setImprimiendo] = useState(false)
  useEffect(() => {
    if (!imprimiendo) return
    const t = setTimeout(() => { window.print(); setImprimiendo(false) }, 50)
    return () => clearTimeout(t)
  }, [imprimiendo])

  const vista = resultado?.vista ?? null
  const empresas = resultado?.empresas ?? p.empresas
  const meses = useMemo(() => (vista ? completarMeses(vista) : []), [vista])

  const periodo = p.semestre === 1 ? "1er semestre" : p.semestre === 2 ? "2do semestre" : "año entero"
  const titulo = `Dashboard por responsable — ${empresas.join(" + ")} — ${p.año} (${periodo})`
  const nota = "Cada peso va a quien le corresponde: código interno (o el contable si el interno está vacío) → Libertad (MA) → responsable del template → factura → empleado → quien pagó. Sumando las tres empresas da lo mismo que «Por caja». Importe = créditos − débitos."
  const nombreArchivo = (ext: string) => `Dashboard por responsable ${empresas.join("+")} ${p.año}${p.semestre ? ` S${p.semestre}` : ""} (${hoyArgentina()}).${ext}`

  if (error) return <Card><CardContent className="py-6 text-sm text-red-700">No se pudo leer: {error}</CardContent></Card>
  if (loading || !vista || !resultado) return (
    <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="mr-2 h-8 w-8 animate-spin" />Leyendo los canales de las tres empresas…</CardContent></Card>
  )
  const ctl = resultado.control
  const cuentas = resultado.cuentas

  const bajarExcel = async () => {
    setExportando("excel")
    try {
      const { descargarExcelPorResponsable } = await import("@/lib/dashboard/export-responsable")
      await descargarExcelPorResponsable({ empresas, año: p.año, semestre: p.semestre, vista, control: ctl, cuentas }, nombreArchivo("xlsx"))
    } catch (e) { console.error(e); toast.error(`No se pudo armar el Excel: ${e instanceof Error ? e.message : String(e)}`) } finally { setExportando("") }
  }
  const bajarPdf = async () => {
    setExportando("pdf")
    try {
      const { descargarPdfPorResponsable } = await import("@/lib/dashboard/pdf-responsable")
      descargarPdfPorResponsable({ titulo, nota, resumen: meses, vista, control: ctl, decimales: p.mostrarDecimales, orden: p.orden }, nombreArchivo("pdf"))
    } catch (e) { console.error(e); toast.error(`No se pudo armar el PDF: ${e instanceof Error ? e.message : String(e)}`) } finally { setExportando("") }
  }

  // 🤝 El saldo con cada socio al cierre del período (+ me debe / − le debo)
  const socios = SOCIOS_RESPONSABLES.filter(s => !empresas.includes(s))
  const saldos = empresas.flatMap(e => socios.map(s => ({ e, s, v: saldoCon(cuentas, e, s) }))).filter(x => Math.abs(x.v) >= 0.005)

  const tablaSocios = (todoAbierto: boolean) => (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead><tr className="bg-muted">
          <th className="py-1 pl-2 text-left">Socios</th>
          {meses.map(m => <th key={claveMes(m)} className="text-center">{getMonthName(m.mes).slice(0, 3)} {String(m.año).slice(2)}</th>)}
          <th className="bg-blue-50 text-center">Total</th><th className="bg-green-50 text-center">Promedio</th>
        </tr></thead>
        <tbody>
          <TablaSocios raiz={vista.financiado} meses={meses} decimales={p.mostrarDecimales} todoAbierto={todoAbierto} claseTitulo="bg-sky-50 text-sky-900"
            explicacion="lo que otro socio pagó por esta empresa o le transfirió (ni ingreso ni gasto)" />
          <TablaSocios raiz={vista.porCuenta} meses={meses} decimales={p.mostrarDecimales} todoAbierto={todoAbierto} claseTitulo="bg-orange-50 text-orange-900"
            explicacion="lo que esta empresa pagó o transfirió por otro socio (ni ingreso ni gasto)" />
          <tr className="border-t-2 bg-gray-100 font-semibold">
            <td className="py-1 pl-2">Total (= lo que se movió en sus canales)</td>
            {meses.map(m => { const x = m.saldoMensual + (vista.financiado.porMes[claveMes(m)] ?? 0) + (vista.porCuenta.porMes[claveMes(m)] ?? 0); return <td key={claveMes(m)} className="text-center"><span className={color(x)}>{formatNumber(x, p.mostrarDecimales)}</span></td> })}
            <td className="bg-blue-50 text-center">{formatNumber(vista.totalCaja, p.mostrarDecimales)}</td><td />
          </tr>
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-3">
      {imprimiendo && <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body * { visibility: hidden !important; }
          #dashboard-responsable-imprimible, #dashboard-responsable-imprimible * { visibility: visible !important; }
          #dashboard-responsable-imprimible { position: absolute; left: 0; top: 0; width: 100%; }
          #dashboard-responsable-imprimible .overflow-x-auto { overflow: visible !important; }
          #dashboard-responsable-imprimible table { font-size: 8px; }
        }
      `}</style>}
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <Button size="sm" variant="outline" disabled={!!exportando} onClick={bajarExcel}>
          {exportando === "excel" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}Excel
        </Button>
        <Button size="sm" variant="outline" disabled={!!exportando} onClick={bajarPdf}>
          {exportando === "pdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => setImprimiendo(true)}><Printer className="mr-1 h-4 w-4" />Imprimir</Button>
      </div>
      {comoMA && <p className="text-xs text-sky-800 print:hidden">👁️ Como lo ve un rol que no es admin: sólo lo de MA (sus cuentas, lo que otros pagaron por ella y sus cuentas con cada socio).</p>}
      {problemas.length > 0 && <p className="rounded border border-amber-400 bg-amber-50 p-2 text-xs text-amber-900">⚠️ No se leyó todo: {problemas.join(" · ")}. Los números pueden quedar cortos.</p>}

      <div id="dashboard-responsable-imprimible" className="space-y-3">
        <h2 className="hidden text-base font-semibold print:block">{titulo}</h2>
        <div className="print:hidden"><TablaResumenFinanciero resumen={meses} mostrarDecimales={p.mostrarDecimales} orden={p.orden} onReordenar={(o) => p.onReordenar(o)} /></div>
        {imprimiendo && <div className="hidden print:block"><TablaResumenFinanciero resumen={meses} mostrarDecimales={p.mostrarDecimales} todoAbierto orden={p.orden} /></div>}
        <div className="print:hidden">{tablaSocios(false)}</div>
        {imprimiendo && <div className="hidden print:block">{tablaSocios(true)}</div>}

        {/* 🤝 Cuenta con socios: el número, y el acceso directo a la cuenta */}
        <div className="rounded-md border p-2 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold">Cuenta con socios al {hasta.split("-").reverse().join("/")}:</span>
            {saldos.length === 0 && <span className="text-gray-500">sin saldo con nadie</span>}
            {saldos.map(x => (
              <span key={`${x.e}-${x.s}`} className="tabular-nums">
                {empresas.length > 1 ? `${x.e} con ` : ""}{x.s}: <b className={color(x.v)}>{formatNumber(x.v, p.mostrarDecimales)}</b>
                <span className="ml-1 text-gray-500">({x.v > 0 ? `${x.s} le debe` : `le debe a ${x.s}`})</span>
              </span>
            ))}
            <Button size="sm" variant="secondary" className="ml-auto print:hidden" onClick={() => {
              const x = saldos[0]
              const c = x ? cuentas.find(k => (k.a === x.e && k.b === x.s) || (k.a === x.s && k.b === x.e)) : undefined
              setVerCuenta(c ? `${c.a}|${c.b}` : "")
            }}><BookOpen className="mr-1 h-4 w-4" />Ver la cuenta</Button>
          </div>
          <p className="mt-1 text-gray-500">+ = el socio le debe a la empresa · − = la empresa le debe al socio. Desde el 31/12/2024 (saldo 0), con todo lo que cada uno pagó o transfirió por el otro; Libertad entera de MA.</p>
        </div>

        <ControlPorResponsable vista={vista} control={ctl} decimales={p.mostrarDecimales} nota={nota} />
      </div>

      <Dialog open={verCuenta !== null} onOpenChange={(o) => { if (!o) setVerCuenta(null) }}>
        <DialogContent className="max-w-6xl">
          <DialogHeader><DialogTitle>Cuenta entre socios — al {hasta.split("-").reverse().join("/")}</DialogTitle></DialogHeader>
          {verCuenta !== null && <CuentaEntreSocios cuentas={cuentas} desdeCanal={resultado.desdeCanal} decimales={p.mostrarDecimales} parInicial={verCuenta || undefined} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ControlPorResponsable({ vista: v, control: c, decimales, nota }: {
  vista: VistaResponsable; control: ControlVisible; decimales: boolean; nota: string
}) {
  const n = (x: number) => formatNumber(x, decimales)
  const paresMal = c.pares.filter(p => p.diferenciaTransf !== null && Math.abs(p.diferenciaTransf) >= 0.005)
  return (
    <div className="space-y-2 text-xs">
      {v.cierra
        ? <p className="text-emerald-700">✓ Secciones ({n(v.totalSecciones)}) + financiado ({n(v.totalFinanciado)}) + pagado por cuenta ({n(v.totalPorCuenta)}) = lo que se movió en sus canales ({n(v.totalCaja)}).</p>
        : <p className="rounded border-2 border-red-400 bg-red-50 p-2 font-semibold text-red-900">⚠️ Secciones + financiado + pagado por cuenta ({n(v.totalSecciones + v.totalFinanciado + v.totalPorCuenta)}) no da lo que se movió en sus canales ({n(v.totalCaja)}): es un error de la app.</p>}
      {c.alcance === "MA" ? null : c.cierra
        ? <p className="text-emerald-700">✓ Las tres empresas por responsable ({n(c.porResponsable)}) = por caja ({n(c.porCaja)}): sólo cambia quién se lleva cada peso.</p>
        : <p className="rounded border-2 border-red-400 bg-red-50 p-2 font-semibold text-red-900">⚠️ Por responsable ({n(c.porResponsable)}) ≠ por caja ({n(c.porCaja)}): diferencia {n(c.diferencia)}.</p>}
      <table className="w-auto border-collapse">
        <thead><tr className="text-left text-gray-500">
          <th className="pr-3 font-medium">Socios</th><th className="pr-3 text-right font-medium">A pagó por B</th><th className="pr-3 text-right font-medium">B lo ve financiado</th>
          <th className="pr-3 text-right font-medium">B pagó por A</th><th className="pr-3 text-right font-medium">Transferencias desde A</th><th className="pr-3 text-right font-medium">Desde B</th><th className="pr-3 font-medium">Espejo</th>
        </tr></thead>
        <tbody>
          {c.pares.map(p => (
            <tr key={`${p.a}-${p.b}`} className="border-t">
              <td className="pr-3">{p.a} ↔ {p.b}</td>
              <td className="pr-3 text-right tabular-nums">{n(p.pagosAporB)}</td>
              <td className="pr-3 text-right tabular-nums">{p.financiadoEnB === null ? <span className="text-gray-400">no tiene canales</span> : n(p.financiadoEnB)}</td>
              <td className="pr-3 text-right tabular-nums">{n(p.pagosBporA)}</td>
              <td className="pr-3 text-right tabular-nums">{n(p.transfLadoA)}</td>
              <td className="pr-3 text-right tabular-nums">{p.transfLadoB === null ? "—" : n(p.transfLadoB)}</td>
              <td className="pr-3">{p.diferenciaTransf === null ? "" : Math.abs(p.diferenciaTransf) < 0.005 ? <span className="text-emerald-700">✓</span>
                : <span className="text-amber-700" title={p.mesesConDiferencia.map(x => `${x.mes}: ${p.a} ${n(x.ladoA)} / ${p.b} ${n(x.ladoB)}`).join("\n")}>⚠️ {n(p.diferenciaTransf)} ({p.mesesConDiferencia.map(x => x.mes).join(", ")})</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {paresMal.length > 0 && <p className="text-amber-700">⚠️ Una transferencia entre socios que se ve de un lado y no del otro (o con otro importe): falta la marca del lado que no la ve, o el canal todavía no tiene ese mes. Está en el Excel, hoja Control.</p>}
      {c.sinResolver.length > 0 && (
        <details className="text-gray-700"><summary className="cursor-pointer">{c.sinResolver.length} movimientos con interno «Desglosar» / «Ver» (no dice de quién es): se atribuyeron por el template, la factura o quien pagó</summary>
          <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5">
            {c.sinResolver.slice(0, 80).map(m => <li key={`${m.canal}-${m.id}`}>{m.fecha.split("-").reverse().join("/")} · {m.canal} · {m.descripcion} · interno «{m.interno}» · {n(m.importe)} → {m.responsable} ({RAZON[m.por]})</li>)}
          </ul>
        </details>
      )}
      {c.fuera.length > 0 && <p className="text-amber-700">⚠️ {c.fuera.length} movimiento{c.fuera.length === 1 ? "" : "s"} con tipo «NO» o vacío no entra{c.fuera.length === 1 ? "" : "n"} en ninguna vista (igual que en «Por caja»): {c.fuera.slice(0, 5).map(f => `${String(f.mov.fecha).split("-").reverse().join("/")} ${f.mov._canal} ${formatNumber(f.clasificacion.monto, decimales)} (tipo ${f.clasificacion.tipo ?? "vacío"}${f.clasificacion.origenTipo ? `, de ${f.clasificacion.origenTipo}` : ""})`).join(" · ")}</p>}
      <p className="text-gray-500">{nota}</p>
    </div>
  )
}
