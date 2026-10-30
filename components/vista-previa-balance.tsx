"use client"

/**
 * 👁️ **VISTA PREVIA DEL BALANCE — el Excel, antes de bajarlo** (A-FEAT-1427, JMS 30/10).
 *
 * *«Sería interesante que todo uno lo pueda visualizar antes de exportarlo. Yo, en vez de exportarlo para ir a
 * revisar las solapas, empezaría a ver en las preview… si hay una inconsistencia, el sistema debería notarlo y ya
 * advertirlo.»*
 *
 * 🔑 **Es el MISMO libro que se baja**: recibe el `WorkBook` que arma `armarWorkbook` — la función que usa la
 * descarga — y lo muestra. No hay una segunda forma de calcular nada: la vista previa y el Excel no pueden diferir
 * (§ ♻️). Lo único propio de esta pantalla es **encontrar las alertas** que ya escribió cada papel (⚠️, NO CIERRA,
 * NO CUADRA, FALTA…) y ponerlas arriba, por solapa, para no tener que abrir las 35 para saber dónde mirar.
 */
import { useMemo, useState } from "react"
import type * as XLSX from "xlsx"
import { esFilaDeAlerta, solapasDelLibro } from "@/lib/balance/vista-previa"

const MAX_FILAS = 400

export function VistaPreviaBalance({ wb, onCerrar }: { wb: XLSX.WorkBook; onCerrar: () => void }) {
  const solapas = useMemo(() => solapasDelLibro(wb), [wb])
  const [actual, setActual] = useState(0)
  const [soloAlertas, setSoloAlertas] = useState(false)
  const s = solapas[actual]
  const conAlerta = solapas.filter(x => x.alertas > 0)
  const filas = s ? (soloAlertas ? s.filas.filter((f, i) => i === 0 || esFilaDeAlerta(f)) : s.filas) : []
  const ancho = Math.max(1, ...filas.slice(0, MAX_FILAS).map(f => f.length))

  return (
    <div className="border rounded-md p-3 space-y-3 bg-white" data-test="vista-previa-balance">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="font-medium">👁️ Vista previa — el mismo Excel que se baja, solapa por solapa</div>
        <button className="text-xs underline text-muted-foreground" onClick={onCerrar}>cerrar</button>
      </div>

      {/* 🚦 Dónde mirar: las solapas con alertas, arriba. */}
      <div className="text-xs">
        {conAlerta.length === 0
          ? <span className="text-green-700">✓ Ninguna solapa marca alertas.</span>
          : (
            <div className="space-y-1">
              <div><strong>{conAlerta.length}</strong> de {solapas.length} solapas marcan algo para revisar:</div>
              <div className="flex flex-wrap gap-1">
                {conAlerta.map(x => (
                  <button key={x.nombre} onClick={() => { setActual(solapas.indexOf(x)); setSoloAlertas(true) }}
                    className="px-2 py-0.5 rounded border border-red-300 bg-red-50 text-red-800 hover:bg-red-100">
                    ⚠️ {x.nombre} · {x.alertas}
                  </button>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Las solapas, en el orden del Excel. */}
      <div className="flex flex-wrap gap-1 border-b pb-2">
        {solapas.map((x, i) => (
          <button key={x.nombre} onClick={() => { setActual(i); setSoloAlertas(false) }}
            className={`px-2 py-0.5 rounded text-xs border ${i === actual ? "bg-slate-800 text-white border-slate-800" : "bg-slate-50 hover:bg-slate-100"}`}>
            {x.nombre}{x.alertas > 0 ? ` ⚠️${x.alertas}` : ""}
          </button>
        ))}
      </div>

      {s && (
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span><strong>{s.nombre}</strong> · {s.filas.length} fila(s)</span>
            {s.alertas > 0 && (
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={soloAlertas} onChange={e => setSoloAlertas(e.target.checked)} />
                sólo las {s.alertas} fila(s) con alerta
              </label>
            )}
          </div>
          <div className="overflow-auto max-h-[60vh] border rounded">
            <table className="text-xs border-collapse">
              <tbody>
                {filas.slice(0, MAX_FILAS).map((f, i) => {
                  const alerta = esFilaDeAlerta(f)
                  return (
                    <tr key={i} className={alerta ? "bg-red-50 text-red-900" : i % 2 ? "bg-slate-50/50" : ""}>
                      {Array.from({ length: ancho }, (_, j) => (
                        <td key={j} className="border px-1.5 py-0.5 whitespace-nowrap max-w-[28rem] overflow-hidden text-ellipsis align-top"
                          title={f[j] == null ? "" : String(f[j])}>
                          {f[j] == null ? "" : String(f[j])}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filas.length > MAX_FILAS && (
            <div className="text-xs text-muted-foreground">Se muestran las primeras {MAX_FILAS} de {filas.length} filas; el Excel las trae todas.</div>
          )}
        </div>
      )}
    </div>
  )
}
