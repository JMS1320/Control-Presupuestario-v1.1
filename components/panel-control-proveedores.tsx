"use client"

// Control de subas de proveedores contra el IPC.
//
// Mira la cartera entera de los que facturan todos los meses, no un proveedor por vez: el
// aumento por encima de la inflación es la excepción y hay que poder encontrarla sin saber de
// antemano dónde buscar.
//
// Lo importante del criterio está en `lib/proveedores/control-subas.ts`: el monto de una
// factura mezcla precio y cantidad, y sólo el precio se compara con el IPC.

import { useState, useEffect, useCallback, useMemo } from "react"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, ChevronDown, ChevronRight, Download, FileText, TrendingUp, Building2 } from "lucide-react"
import { ModalFichaProveedor } from "@/components/proveedores/modal-ficha-proveedor"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import {
  analizarProveedores, resumenCartera, ETIQUETA_SEMAFORO,
  type FacturaMes, type PuntoIpc, type AnalisisProveedor, type Semaforo,
} from "@/lib/proveedores/control-subas"

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
const pct = (n: number | null, dec = 1) => (n == null ? "—" : `${n >= 0 ? "" : "−"}${fmtNumeroAR(Math.abs(n) * 100, dec)} %`)

const COLOR: Record<Semaforo, string> = {
  alerta: "bg-red-100 text-red-800 border-red-200",
  atencion: "bg-amber-100 text-amber-800 border-amber-200",
  ok: "bg-emerald-100 text-emerald-800 border-emerald-200",
  sin_ipc: "bg-gray-100 text-gray-600 border-gray-200",
  volumen: "bg-slate-100 text-slate-600 border-slate-200",
}

export function PanelControlProveedores() {
  const [cargando, setCargando] = useState(true)
  const [facturas, setFacturas] = useState<FacturaMes[]>([])
  const [ipc, setIpc] = useState<PuntoIpc[]>([])
  const [ventana, setVentana] = useState("12")
  const [abierto, setAbierto] = useState<string | null>(null)
  const [soloPrecio, setSoloPrecio] = useState(true)
  /** CUIT cuya ficha se está mirando (null = modal cerrado) */
  const [fichaCuit, setFichaCuit] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [{ data: fc, error: e1 }, { data: ip, error: e2 }] = await Promise.all([
        supabase.schema("msa").from("comprobantes_arca")
          .select("cuit, denominacion_emisor, año_contable, mes_contable, imp_total, cuenta_contable")
          .not("año_contable", "is", null),
        supabase.from("indices_ipc").select("anio, mes, valor_ipc"),
      ])
      if (e1 || e2) { alert("Error cargando: " + (e1 || e2)!.message); return }

      // Un renglón por proveedor y mes: la comparación es mensual, no por factura
      const acc = new Map<string, FacturaMes>()
      for (const r of ((fc || []) as any[])) {
        const cuit = String(r.cuit ?? "").replace(/\D/g, "")
        if (!cuit) continue
        const k = `${cuit}|${r.año_contable}-${r.mes_contable}`
        const prev = acc.get(k)
        if (prev) {
          prev.monto += Number(r.imp_total) || 0
          prev.facturas += 1
        } else {
          acc.set(k, {
            cuit, proveedor: String(r.denominacion_emisor ?? cuit),
            anio: Number(r.año_contable), mes: Number(r.mes_contable),
            monto: Number(r.imp_total) || 0, facturas: 1,
            cuenta: r.cuenta_contable ?? null,
          })
        }
      }
      setFacturas([...acc.values()])
      // `valor_ipc` se carga en Precios y TC como la variación mensual en %
      setIpc(((ip || []) as any[]).map(r => ({
        anio: Number(r.anio), mes: Number(r.mes), variacion: (Number(r.valor_ipc) || 0) / 100,
      })))
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const analisis = useMemo(
    () => analizarProveedores(facturas, ipc, { ventanaMeses: Math.max(3, Math.round(parseNumeroAR(ventana))) }),
    [facturas, ipc, ventana],
  )
  const visibles = useMemo(
    () => (soloPrecio ? analisis.filter(a => a.esPrecio) : analisis),
    [analisis, soloPrecio],
  )
  const resumen = useMemo(() => resumenCartera(analisis), [analisis])

  // ── Exports ─────────────────────────────────────────────────────────────────

  const filasExport = () => visibles.map(a => ({
    "Proveedor": a.proveedor,
    "CUIT": a.cuit,
    "Meses con factura": a.mesesConFactura,
    "Desde": a.primerMes,
    "Hasta": a.ultimoMes,
    "Primer monto": Math.round(a.primerMonto),
    "Último monto": Math.round(a.ultimoMonto),
    "Suba total %": Number((a.subaTotal * 100).toFixed(1)),
    "Suba mensual %": Number((a.subaMensual * 100).toFixed(2)),
    "IPC acumulado %": a.ipcAcumulado == null ? "" : Number((a.ipcAcumulado * 100).toFixed(1)),
    "Brecha vs IPC (puntos)": a.brecha == null ? "" : Number((a.brecha * 100).toFixed(1)),
    "Situación": ETIQUETA_SEMAFORO[a.semaforo],
    "Total facturado": Math.round(a.total),
  }))

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(filasExport())
    ws["!cols"] = [{ wch: 42 }, { wch: 13 }, { wch: 8 }, { wch: 9 }, { wch: 9 }, { wch: 14 },
      { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 20 }, { wch: 28 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, ws, "Resumen")

    // Una solapa con el detalle mes a mes de todos, para poder auditar el número
    const detalle = visibles.flatMap(a => a.serie.map(s => ({
      "Proveedor": a.proveedor,
      "Mes": s.mes,
      "Monto": Math.round(s.monto),
      "Variación %": s.variacion == null ? "" : Number((s.variacion * 100).toFixed(1)),
      "IPC del mes %": s.ipcMes == null ? "" : Number((s.ipcMes * 100).toFixed(1)),
      "Brecha del mes": s.brechaMes == null ? "" : Number((s.brechaMes * 100).toFixed(1)),
    })))
    const ws2 = XLSX.utils.json_to_sheet(detalle)
    ws2["!cols"] = [{ wch: 42 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws2, "Detalle mensual")

    XLSX.writeFile(wb, `Control_proveedores_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const exportarPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" })
    doc.setFontSize(14)
    doc.text("Control de subas de proveedores vs IPC", 14, 15)
    doc.setFontSize(9)
    doc.text(
      `MSA · ${new Date().toLocaleDateString("es-AR")} · ventana ${ventana} meses · `
      + `${resumen.dePrecio} proveedores de precio, ${resumen.porEncima} por encima del IPC`,
      14, 21)
    if (resumen.sinIpc > 0) {
      doc.setTextColor(180, 90, 0)
      doc.text(`Faltan datos de IPC: ${resumen.sinIpc} proveedores no se pudieron comparar.`, 14, 26)
      doc.setTextColor(0, 0, 0)
    }

    autoTable(doc, {
      startY: resumen.sinIpc > 0 ? 30 : 26,
      theme: "grid",
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [55, 65, 81] },
      head: [["Proveedor", "Meses", "Primero", "Último", "Suba", "Suba/mes", "IPC", "Brecha", "Situación", "Total"]],
      body: visibles.map(a => [
        a.proveedor.slice(0, 44),
        `${a.mesesConFactura}`,
        pesos(a.primerMonto),
        pesos(a.ultimoMonto),
        pct(a.subaTotal),
        pct(a.subaMensual, 2),
        pct(a.ipcAcumulado),
        pct(a.brecha),
        ETIQUETA_SEMAFORO[a.semaforo],
        pesos(a.total),
      ]),
      didParseCell: d => {
        if (d.section !== "body") return
        const a = visibles[d.row.index]
        if (!a) return
        if (a.semaforo === "alerta") d.cell.styles.textColor = [180, 30, 30]
        else if (a.semaforo === "atencion") d.cell.styles.textColor = [170, 110, 0]
        else if (a.semaforo === "volumen") d.cell.styles.textColor = [130, 130, 130]
      },
    })

    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
    doc.setFontSize(7.5)
    doc.text([
      "Cómo se lee: la suba es de punta a punta (primer mes con factura contra el último cerrado), no mínimo contra máximo.",
      "El monto de una factura mezcla precio y cantidad: los proveedores cuyo importe baja seguido se marcan como variación por",
      "consumo y no se comparan con el IPC, porque ahí el número no habla de un aumento.",
    ], 14, y)

    doc.save(`Control_proveedores_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  if (cargando) {
    return (
      <Card><CardContent className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analizando la cartera…
      </CardContent></Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" /> Control de subas de proveedores
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              Los que facturan todos los meses, comparados contra el IPC del mismo período.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Últimos</span>
            <Input className="h-7 w-14 text-right text-xs" value={ventana}
              onChange={e => setVentana(e.target.value)} />
            <span className="text-xs text-gray-500">meses</span>
            <Button size="sm" variant="secondary" onClick={exportarExcel} disabled={visibles.length === 0}>
              <Download className="mr-1 h-3.5 w-3.5" /> Excel
            </Button>
            <Button size="sm" variant="secondary" onClick={exportarPdf} disabled={visibles.length === 0}>
              <FileText className="mr-1 h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Resumen */}
        <div className="flex flex-wrap items-center gap-3 rounded border bg-gray-50 px-3 py-2 text-xs">
          <span><strong>{resumen.dePrecio}</strong> proveedores de precio</span>
          <span className="text-gray-400">·</span>
          <span className={resumen.porEncima > 0 ? "text-red-700" : "text-emerald-700"}>
            <strong>{resumen.porEncima}</strong> por encima del IPC
            {resumen.porEncima > 0 && <> ({pesos(resumen.montoPorEncima)} facturados)</>}
          </span>
          {resumen.porVolumen > 0 && (
            <>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">{resumen.porVolumen} varían por consumo</span>
            </>
          )}
          <label className="ml-auto flex items-center gap-1.5 text-gray-600">
            <input type="checkbox" checked={soloPrecio} onChange={e => setSoloPrecio(e.target.checked)}
              className="h-3.5 w-3.5" />
            sólo los de precio
          </label>
        </div>

        {ipc.length === 0 && (
          <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>No hay IPC cargado.</strong> Sin él se ve cuánto subió cada proveedor pero no
            contra qué compararlo. Se carga en <strong>Precios y TC</strong>, columna IPC —
            la variación mensual en %.
          </p>
        )}

        {visibles.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            No hay proveedores con facturación regular en la ventana elegida.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50 text-[10px] text-gray-500">
                  <th className="px-2 py-1.5 text-left font-medium">Proveedor</th>
                  <th className="px-2 py-1.5 text-right font-medium">Meses</th>
                  <th className="px-2 py-1.5 text-right font-medium">Primero</th>
                  <th className="px-2 py-1.5 text-right font-medium">Último</th>
                  <th className="px-2 py-1.5 text-right font-medium">Suba</th>
                  <th className="px-2 py-1.5 text-right font-medium">/mes</th>
                  <th className="px-2 py-1.5 text-right font-medium">IPC</th>
                  <th className="px-2 py-1.5 text-right font-medium">Brecha</th>
                  <th className="px-2 py-1.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(a => {
                  const ab = abierto === a.cuit
                  return (
                    <FilaProveedor key={a.cuit} a={a} abierto={ab}
                      onToggle={() => setAbierto(ab ? null : a.cuit)}
                      onFicha={() => setFichaCuit(a.cuit)} />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[10px] text-gray-500">
          La suba se mide de <strong>punta a punta</strong> (primer mes con factura contra el
          último cerrado), no mínimo contra máximo: dos outliers cualesquiera darían cualquier
          cosa. El monto de una factura mezcla precio y cantidad, así que los proveedores cuyo
          importe <strong>baja seguido</strong> se marcan como variación por consumo — ahí el
          número no habla de un aumento.
        </p>
      </CardContent>

      <ModalFichaProveedor
        open={fichaCuit !== null}
        cuitInicial={fichaCuit}
        onClose={() => setFichaCuit(null)}
      />
    </Card>
  )
}

function FilaProveedor({ a, abierto, onToggle, onFicha }: {
  a: AnalisisProveedor; abierto: boolean; onToggle: () => void; onFicha: () => void
}) {
  return (
    <>
      <tr className="cursor-pointer border-b hover:bg-gray-50" onClick={onToggle}>
        <td className="px-2 py-1.5">
          <div className="flex items-center gap-1">
            {abierto ? <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" /> : <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />}
            <span className="text-gray-700">{a.proveedor}</span>
            <button
              className="shrink-0 text-gray-300 hover:text-gray-600"
              title="Ver ficha del proveedor"
              onClick={e => { e.stopPropagation(); onFicha() }}
            >
              <Building2 className="h-3 w-3" />
            </button>
            <Badge variant="outline" className={`ml-1 text-[9px] ${COLOR[a.semaforo]}`}>
              {ETIQUETA_SEMAFORO[a.semaforo]}
            </Badge>
          </div>
        </td>
        <td className="px-2 py-1.5 text-right text-gray-500">{a.mesesConFactura}</td>
        <td className="px-2 py-1.5 text-right text-gray-600">{pesos(a.primerMonto)}</td>
        <td className="px-2 py-1.5 text-right text-gray-800">{pesos(a.ultimoMonto)}</td>
        <td className={`px-2 py-1.5 text-right font-medium ${a.subaTotal > 0 ? "text-gray-800" : "text-emerald-700"}`}>
          {pct(a.subaTotal)}
        </td>
        <td className="px-2 py-1.5 text-right text-gray-500">{pct(a.subaMensual, 2)}</td>
        <td className="px-2 py-1.5 text-right text-gray-500">{pct(a.ipcAcumulado)}</td>
        <td className={`px-2 py-1.5 text-right font-semibold ${
          a.brecha == null ? "text-gray-300"
            : a.brecha > 0.05 ? "text-red-700" : a.brecha < -0.05 ? "text-emerald-700" : "text-gray-600"}`}>
          {pct(a.brecha)}
        </td>
        <td className="px-2 py-1.5 text-right text-gray-600">{pesos(a.total)}</td>
      </tr>

      {abierto && (
        <tr className="border-b bg-slate-50">
          <td colSpan={9} className="px-3 py-2">
            <p className="mb-1.5 text-[11px] text-gray-600">
              {a.mesesConFactura} facturas en {a.mesesPeriodo} meses
              {" "}({Math.round(a.regularidad * 100)} % de regularidad)
              {a.bajas > 0 && <> · bajó {a.bajas} {a.bajas === 1 ? "vez" : "veces"}</>}
              {!a.esPrecio && (
                <span className="ml-1 text-slate-600">
                  — por eso se toma como variación de consumo y no como aumento de precio
                </span>
              )}
            </p>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-[10px] text-gray-500">
                  <th className="py-0.5 text-left font-medium">Mes</th>
                  <th className="py-0.5 text-right font-medium">Monto</th>
                  <th className="py-0.5 text-right font-medium">Variación</th>
                  <th className="py-0.5 text-right font-medium">IPC del mes</th>
                  <th className="py-0.5 text-right font-medium">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {a.serie.map(s => (
                  <tr key={s.mes} className="border-b border-gray-100 last:border-0">
                    <td className="py-0.5 text-gray-600">{s.mes}</td>
                    <td className="py-0.5 text-right text-gray-800">{pesos(s.monto)}</td>
                    <td className={`py-0.5 text-right ${
                      s.variacion == null ? "text-gray-300"
                        : s.variacion > 0 ? "text-gray-700" : "text-emerald-700"}`}>
                      {pct(s.variacion)}
                    </td>
                    <td className="py-0.5 text-right text-gray-500">{pct(s.ipcMes)}</td>
                    <td className={`py-0.5 text-right ${
                      s.brechaMes == null ? "text-gray-300"
                        : s.brechaMes > 0.02 ? "text-red-600" : "text-gray-500"}`}>
                      {pct(s.brechaMes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}
