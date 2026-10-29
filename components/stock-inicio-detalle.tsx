"use client"

/**
 * 📦 El stock DECLARADO al inicio, producto por producto, y las pasturas (A-FEAT-1420, JMS 29/10).
 * Sólo muestra; la lógica vive en `lib/balance/stock-inicio.ts`. No es la existencia de la app.
 */
import { useState } from "react"
import { agruparStockInicio, valuarPastura, type RenglonStockInicio, type Pastura } from "@/lib/balance/stock-inicio"

const pesos = (n: number | null) => n == null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (n: number | null) => n == null ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: 3 })

export function StockInicioDetalle({ renglones, pasturas, fecha }: { renglones: RenglonStockInicio[]; pasturas: Pastura[]; fecha: string }) {
  const [abierto, setAbierto] = useState(false)
  if (!renglones.length && !pasturas.length) return null
  const g = agruparStockInicio(renglones)
  const f = fecha.split("-").reverse().join("/")
  const pv = pasturas.map(p => valuarPastura(p, fecha))
  return (
    <div className="space-y-1.5">
      <button type="button" onClick={() => setAbierto(!abierto)} className="text-sm font-medium">
        {abierto ? "▾" : "▸"} 📦 Stock declarado al {f} — {renglones.length} productos · $ {pesos(g.total)}
        {g.aConfirmar > 0 && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-900">{g.aConfirmar} a confirmar con la app</span>}
        {pv.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">· {pv.length} pasturas</span>}
      </button>
      {abierto && (
        <>
          <p className="text-[11px] text-muted-foreground">
            Tal cual tu planilla (cada renglón dice de qué archivo, hoja y fila salió). No cambia el stock de la app, que arranca el 17/02/2026.
            «a confirmar» = lo até a un producto de la app pero el nombre o la unidad no coinciden del todo; «nuevo» = lo di de alta.
          </p>
          {g.grupos.map(gr => (
            <div key={gr.grupo} className="overflow-x-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr><th className="text-left p-1.5" colSpan={3}>{gr.grupo}</th>
                    <th className="text-right p-1.5">Cantidad</th><th className="text-left p-1.5">Unidad</th>
                    <th className="text-right p-1.5">Precio</th><th className="text-right p-1.5">Valor $</th></tr>
                </thead>
                <tbody>
                  {gr.renglones.map((r, i) => (
                    <tr key={i} className={r.emparejado === "a confirmar" ? "bg-amber-50" : ""} title={r.fuente + (r.nota ? " · " + r.nota : "")}>
                      <td className="p-1.5">{r.producto_planilla}</td>
                      <td className="p-1.5 text-muted-foreground">{r.producto_app && r.producto_app !== r.producto_planilla ? `→ ${r.producto_app}` : ""}</td>
                      <td className="p-1.5 text-muted-foreground">{r.emparejado}</td>
                      <td className="p-1.5 text-right font-mono">{num(r.cantidad)}</td>
                      <td className="p-1.5">{r.unidad ?? ""}</td>
                      <td className="p-1.5 text-right font-mono">{r.precio_unitario == null ? "—" : `${r.moneda === "USD" ? "US$ " : "$ "}${num(r.precio_unitario)}`}</td>
                      <td className="p-1.5 text-right font-mono">{pesos(r.valor_pesos)}</td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold"><td className="p-1.5" colSpan={6}>Total {gr.grupo}</td><td className="p-1.5 text-right font-mono">{pesos(gr.valor)}</td></tr>
                </tbody>
              </table>
            </div>
          ))}
          {pv.length > 0 && (
            <div className="overflow-x-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr><th className="text-left p-1.5">Pasturas</th><th className="text-right p-1.5">Siembra</th><th className="text-right p-1.5">Ha</th>
                    <th className="text-right p-1.5">US$/ha</th><th className="text-right p-1.5">Amortizado</th><th className="text-right p-1.5">Valor US$</th><th className="text-left p-1.5">Baja</th></tr>
                </thead>
                <tbody>
                  {pv.map(p => (
                    <tr key={p.lotes + p.anio_siembra} title={p.fuente + (p.nota ? " · " + p.nota : "")}>
                      <td className="p-1.5">{p.lotes}</td><td className="p-1.5 text-right">{p.anio_siembra}</td>
                      <td className="p-1.5 text-right">{num(p.hectareas)}</td><td className="p-1.5 text-right">{num(p.usd_por_ha)}</td>
                      <td className="p-1.5 text-right">{Math.round(p.amortizado * 100)} %</td>
                      <td className="p-1.5 text-right font-mono">{pesos(p.valorActualUsd)}</td>
                      <td className="p-1.5 text-muted-foreground">{p.dadaDeBaja ? p.baja_motivo ?? "sí" : ""}</td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold"><td className="p-1.5" colSpan={5}>Total pasturas</td>
                    <td className="p-1.5 text-right font-mono">{pesos(pv.reduce((s, p) => s + (p.valorActualUsd ?? 0), 0))}</td><td /></tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
