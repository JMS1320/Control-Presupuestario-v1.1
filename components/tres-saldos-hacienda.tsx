"use client"

/**
 * 🐄 Los tres saldos de la hacienda — sistema · SENASA · balance (A-FEAT-1386 (d), JMS 29/10).
 * La lógica vive en `lib/balance/tres-saldos-hacienda.ts`; acá sólo se muestra y se escribe.
 */
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { useDatosDelBalance, textoEstadoGuardado } from "@/lib/balance/datos-usuario"
import {
  armarTresSaldos, claveSaldo, type MomentoSaldo, type FuenteManual,
} from "@/lib/balance/tres-saldos-hacienda"

const ent = (n: number | null) => n == null ? "—" : Math.round(n).toLocaleString("es-AR")
const dif = (n: number | null) => n == null ? "—" : n === 0 ? "✓" : (n > 0 ? "+" : "") + ent(n)

export function TresSaldosHacienda({ empresa, anioCierre, sistema }: {
  empresa: string; anioCierre: number
  sistema: { inicio: Record<string, number>; cierre: Record<string, number> }
}) {
  const [momento, setMomento] = useState<MomentoSaldo>("inicio")
  const datos = useDatosDelBalance(empresa, anioCierre, "hacienda.saldos")
  const t = armarTresSaldos(momento, sistema[momento], datos.valores)
  const tentativas = Object.keys(datos.tentativos).filter(k => k.startsWith(momento + "."))
  const fuente = tentativas.length ? datos.tentativos[tentativas[0]] : null

  const celda = (fuenteM: FuenteManual, cat: string) => {
    const k = claveSaldo(momento, fuenteM, cat)
    return (
      <Input type="text" placeholder="—" className={`h-6 text-xs w-16 text-right ${datos.tentativos[k] ? "bg-amber-50" : ""}`}
        value={datos.valores[k] ?? ""} onChange={e => datos.cambiar(k, e.target.value)} />
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        🐄 Los tres saldos de la hacienda
        {(["inicio", "cierre"] as const).map(m => (
          <button key={m} type="button" onClick={() => setMomento(m)}
            className={`rounded border px-2 py-0.5 text-xs ${momento === m ? "bg-slate-800 text-white" : "bg-white"}`}>
            {m === "inicio" ? "Al inicio" : "Al cierre"}
          </button>
        ))}
        <span className="text-xs font-normal text-muted-foreground">· {textoEstadoGuardado(datos.estado, datos.error)}</span>
      </div>
      {fuente && (
        <div className="flex flex-wrap items-center gap-2 rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-900">
          <b>TENTATIVO</b> · lo puso Claude ({tentativas.length} datos, en amarillo) · <span className="italic">{fuente}</span>
          <button type="button" className="rounded border border-amber-400 bg-white px-1 font-medium hover:bg-amber-50"
            onClick={() => tentativas.forEach(k => datos.confirmar(k))}>✓ OK a todos</button>
        </div>
      )}
      <div className="overflow-x-auto border rounded">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-1.5">Categoría</th>
              <th className="text-right p-1.5">Sistema</th>
              <th className="text-right p-1.5">SENASA</th>
              <th className="text-right p-1.5">Balance</th>
              <th className="text-right p-1.5" title="Sistema − Balance">Sist. − Bal.</th>
              <th className="text-right p-1.5" title="SENASA − Balance">SENASA − Bal.</th>
            </tr>
          </thead>
          <tbody>
            {t.filas.map(f => (
              <tr key={f.clave}>
                <td className="p-1.5">{f.nombre}</td>
                <td className="p-1.5 text-right font-mono">{ent(f.sistema)}</td>
                <td className="p-1.5 text-right">{celda("senasa", f.clave)}</td>
                <td className="p-1.5 text-right">{celda("balance", f.clave)}</td>
                <td className={`p-1.5 text-right font-mono ${f.difSistema ? "text-amber-700" : ""}`}>{dif(f.difSistema)}</td>
                <td className={`p-1.5 text-right font-mono ${f.difSenasa ? "text-amber-700" : ""}`}>{dif(f.difSenasa)}</td>
              </tr>
            ))}
            <tr className="border-t font-semibold">
              <td className="p-1.5">TOTAL</td>
              <td className="p-1.5 text-right font-mono">{ent(t.total.sistema)}</td>
              <td className="p-1.5 text-right font-mono">{ent(t.total.senasa)}</td>
              <td className="p-1.5 text-right font-mono">{ent(t.total.balance)}</td>
              <td className={`p-1.5 text-right font-mono ${t.total.difSistema ? "text-amber-700" : ""}`}>{dif(t.total.difSistema)}</td>
              <td className={`p-1.5 text-right font-mono ${t.total.difSenasa ? "text-amber-700" : ""}`}>{dif(t.total.difSenasa)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {t.sinUbicar.length > 0 && (
        <p className="text-xs text-amber-800">
          Categorías de la app sin lugar en la planilla (están en el total del sistema): {t.sinUbicar.map(s => `${s.categoria} ${ent(s.cabezas)}`).join(" · ")}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Sistema = los movimientos de hacienda de la app. SENASA y Balance se escriben a mano. Las diferencias suelen ser mortandades sin registrar: se avisan, no frenan.
      </p>
    </div>
  )
}
