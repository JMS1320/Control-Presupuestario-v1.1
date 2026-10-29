"use client"

/**
 * 🌾 Saldos de insumos, gas oil y sementeras — sistema · campo · balance (A-FEAT-1386 (e), JMS 29/10).
 * Campo y Balance se LEEN de la foto del Balance propio (versiones jms y contador); se cargan allá.
 * La lógica vive en `lib/balance/saldos-productivos.ts`.
 */
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  armarSaldosProductivos, RENGLONES_PRODUCTIVOS, type MomentoSaldo, type ValoresFoto,
} from "@/lib/balance/saldos-productivos"

const pesos = (n: number | null) => n == null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dif = (n: number | null) => n == null ? "—" : n === 0 ? "✓" : pesos(n)

export function SaldosProductivos({ empresa, fechaInicio, fechaCierre, sistemaAlCierre }: {
  empresa: string
  /** la fecha de la foto del inicio (= cierre anterior) */
  fechaInicio: string
  fechaCierre: string
  sistemaAlCierre: Record<string, number>
}) {
  const [momento, setMomento] = useState<MomentoSaldo>("inicio")
  const [fotos, setFotos] = useState<Record<string, ValoresFoto | null>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data: fs, error: e1 } = await supabase.from("balance_fotos").select("id, fecha_cierre")
        .eq("empresa", empresa).in("fecha_cierre", [fechaInicio, fechaCierre])
      if (e1) { if (vivo) setError(e1.message); return }
      const res: Record<string, ValoresFoto | null> = { [fechaInicio]: null, [fechaCierre]: null }
      if (fs?.length) {
        const { data: vs, error: e2 } = await supabase.from("balance_foto_valores").select("foto_id, renglon, version, importe")
          .in("foto_id", fs.map(f => f.id)).in("renglon", RENGLONES_PRODUCTIVOS)
        if (e2) { if (vivo) setError(e2.message); return }
        for (const f of fs) {
          const v: ValoresFoto = {}
          for (const x of (vs ?? []).filter(x => x.foto_id === f.id)) {
            if (x.version !== "jms" && x.version !== "contador") continue
            v[x.renglon] = { ...(v[x.renglon] ?? {}), [x.version]: x.importe == null ? null : Number(x.importe) }
          }
          res[String(f.fecha_cierre).slice(0, 10)] = v
        }
      }
      if (vivo) { setFotos(res); setError(null) }
    })()
    return () => { vivo = false }
  }, [empresa, fechaInicio, fechaCierre])

  const fecha = momento === "inicio" ? fechaInicio : fechaCierre
  const foto = fotos[fecha] ?? null
  // La app guarda el stock de HOY, no su historia: al inicio no hay saldo del sistema («—»).
  const t = armarSaldosProductivos(momento === "cierre" ? sistemaAlCierre : null, foto)

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
          · foto del {fecha.split("-").reverse().join("/")} {foto ? "" : "— todavía no existe"}
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
