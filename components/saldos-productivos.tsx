"use client"

/**
 * 🌾 Saldos de insumos, gas oil y sementeras — sistema · campo · balance (A-FEAT-1386 (e), JMS 29/10).
 * Sólo muestra: las tablas las arma `hacienda-al-cierre` (que también las manda al Excel), con Campo y Balance
 * leídos de la foto del Balance propio (versiones jms y contador; se cargan allá).
 */
import { useState } from "react"
import type { FilaSaldoProductivo, MomentoSaldo } from "@/lib/balance/saldos-productivos"

type Tabla = { filas: FilaSaldoProductivo[]; total: FilaSaldoProductivo }
const pesos = (n: number | null) => n == null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dif = (n: number | null) => n == null ? "—" : n === 0 ? "✓" : pesos(n)

export function SaldosProductivos({ tablas, fechas, hayFoto, error }: {
  tablas: { inicio: Tabla; cierre: Tabla }
  fechas: { inicio: string; cierre: string }
  hayFoto: { inicio: boolean; cierre: boolean }
  error: string | null
}) {
  const [momento, setMomento] = useState<MomentoSaldo>("inicio")
  const t = tablas[momento]
  const fecha = fechas[momento]

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        🌾 Saldos de insumos, gas oil y sementeras ($)
        {(["inicio", "cierre"] as const).map(m => (
          <button key={m} type="button" onClick={() => setMomento(m)}
            className={`rounded border px-2 py-0.5 text-xs ${momento === m ? "bg-slate-800 text-white" : "bg-white"}`}>
            {m === "inicio" ? "Al inicio" : "Al cierre"}
          </button>
        ))}
        <span className="text-xs font-normal text-muted-foreground">
          · foto del {fecha.split("-").reverse().join("/")} {hayFoto[momento] ? "" : "— todavía no existe"}
        </span>
      </div>
      {error && <p className="text-xs text-red-700">No se pudo leer la foto del balance: {error}</p>}
      <div className="overflow-x-auto border rounded">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-1.5">Rubro</th>
              <th className="text-right p-1.5">Sistema</th>
              <th className="text-right p-1.5" title="Tu dato (balance interno)">Campo</th>
              <th className="text-right p-1.5" title="El dato del contador (forma contable)">Balance</th>
              <th className="text-right p-1.5">Sist. − Campo</th>
              <th className="text-right p-1.5">Campo − Bal.</th>
            </tr>
          </thead>
          <tbody>
            {[...t.filas, t.total].map(f => (
              <tr key={f.clave} className={f.clave === "total" ? "border-t font-semibold" : ""}>
                <td className="p-1.5">{f.nombre}</td>
                <td className="p-1.5 text-right font-mono">{pesos(f.sistema)}</td>
                <td className="p-1.5 text-right font-mono">{pesos(f.campo)}</td>
                <td className="p-1.5 text-right font-mono">{pesos(f.balance)}</td>
                <td className={`p-1.5 text-right font-mono ${f.difSistema ? "text-amber-700" : ""}`}>{dif(f.difSistema)}</td>
                <td className={`p-1.5 text-right font-mono ${f.difBalance ? "text-amber-700" : ""}`}>{dif(f.difBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Campo = tu dato y Balance = el del contador: salen de la foto del <strong>Balance propio</strong> (ahí se cargan y corrigen).
        Sistema = el stock valuado de la app, sólo al cierre. La diferencia Campo − Balance suele ser tratamiento contable: se avisa, no frena.
      </p>
    </div>
  )
}
