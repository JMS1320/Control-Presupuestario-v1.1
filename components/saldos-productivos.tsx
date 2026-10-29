"use client"

/**
 * 🌾 Saldos de insumos, gas oil y sementeras — sistema · balance (A-FEAT-1386 (e), JMS 29/10).
 * La lógica vive en `lib/balance/saldos-productivos.ts`; acá sólo se muestra y se escribe.
 */
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { useDatosDelBalance, textoEstadoGuardado } from "@/lib/balance/datos-usuario"
import { armarSaldosProductivos, claveSaldoProductivo } from "@/lib/balance/saldos-productivos"
import type { MomentoSaldo } from "@/lib/balance/tres-saldos-hacienda"

const pesos = (n: number | null) => n == null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function SaldosProductivos({ empresa, anioCierre, sistemaAlCierre }: {
  empresa: string; anioCierre: number; sistemaAlCierre: Record<string, number>
}) {
  const [momento, setMomento] = useState<MomentoSaldo>("inicio")
  const datos = useDatosDelBalance(empresa, anioCierre, "productivo.saldos")
  // La app guarda el stock de HOY, no su historia: al inicio no hay saldo del sistema (se muestra «—»).
  const t = armarSaldosProductivos(momento, momento === "cierre" ? sistemaAlCierre : null, datos.valores)
  const tentativas = Object.keys(datos.tentativos).filter(k => k.startsWith(momento + "."))

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
        <span className="text-xs font-normal text-muted-foreground">· {textoEstadoGuardado(datos.estado, datos.error)}</span>
      </div>
      {tentativas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-900">
          <b>TENTATIVO</b> · lo puso Claude ({tentativas.length} datos, en amarillo) · <span className="italic">{datos.tentativos[tentativas[0]]}</span>
          <button type="button" className="rounded border border-amber-400 bg-white px-1 font-medium hover:bg-amber-50"
            onClick={() => tentativas.forEach(k => datos.confirmar(k))}>✓ OK a todos</button>
        </div>
      )}
      <div className="overflow-x-auto border rounded">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-1.5">Rubro</th>
              <th className="text-right p-1.5">Sistema</th>
              <th className="text-right p-1.5">Balance</th>
              <th className="text-right p-1.5">Sist. − Bal.</th>
            </tr>
          </thead>
          <tbody>
            {t.filas.map(f => {
              const k = claveSaldoProductivo(momento, f.clave)
              return (
                <tr key={f.clave}>
                  <td className="p-1.5">{f.nombre}</td>
                  <td className="p-1.5 text-right font-mono">{pesos(f.sistema)}</td>
                  <td className="p-1.5 text-right">
                    {/* § 💰 es-AR: texto, nunca number */}
                    <Input type="text" placeholder="0,00" className={`h-6 text-xs w-32 text-right ${datos.tentativos[k] ? "bg-amber-50" : ""}`}
                      value={datos.valores[k] ?? ""} onChange={e => datos.cambiar(k, e.target.value)} />
                  </td>
                  <td className={`p-1.5 text-right font-mono ${f.dif ? "text-amber-700" : ""}`}>{f.dif == null ? "—" : f.dif === 0 ? "✓" : pesos(f.dif)}</td>
                </tr>
              )
            })}
            <tr className="border-t font-semibold">
              <td className="p-1.5">TOTAL</td>
              <td className="p-1.5 text-right font-mono">{pesos(t.total.sistema)}</td>
              <td className="p-1.5 text-right font-mono">{pesos(t.total.balance)}</td>
              <td className={`p-1.5 text-right font-mono ${t.total.dif ? "text-amber-700" : ""}`}>{t.total.dif == null ? "—" : pesos(t.total.dif)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Sistema = el stock valuado de la app y el costo de la sementera; sólo al cierre (la app no guarda el stock de fechas pasadas). Balance se escribe a mano.
      </p>
    </div>
  )
}
