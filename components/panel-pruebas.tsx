"use client"

/**
 * 🧪 Botón PROBAR — A-FEAT-105.
 *
 * Corre los casos de `lib/pruebas/casos.ts` y muestra **esperado contra obtenido**. Nivel 1:
 * lógica pura, **no toca la base**.
 *
 * ## Por qué acá y no con Playwright
 * Corre **en el navegador del usuario, con su sesión**. El parser del romaneo se verificó en Node
 * —perfecto— y en su Chrome devolvía cero: un test que corre en la máquina del desarrollador
 * habría pasado ese bug por alto exactamente como lo pasé yo.
 *
 * ## Lo que NO hace, y conviene tenerlo claro
 * Verifica que 1.748 sea 1.748. **No** verifica que 1.748 tenga sentido para 7 vacas. Para eso
 * sigue haciendo falta que el usuario mire.
 */

import { useState } from "react"
import { correrCasos, type Resultado } from "@/lib/pruebas/casos"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, FlaskConical } from "lucide-react"

export function PanelPruebas() {
  const [abierto, setAbierto] = useState(false)
  const [corriendo, setCorriendo] = useState(false)
  const [res, setRes] = useState<Resultado[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ms, setMs] = useState(0)

  const correr = async () => {
    setCorriendo(true); setError(null); setRes(null)
    const t0 = performance.now()
    try {
      // Un respiro para que el modal pinte el "corriendo" antes de bloquear el hilo.
      await new Promise(r => setTimeout(r, 40))
      setRes(correrCasos())
    } catch (e) {
      // Que los casos EXPLOTEN también es un resultado, y hay que verlo: si esto queda mudo,
      // un cambio que rompe la carga del módulo se leería como "no hay fallas".
      setError((e as Error).message || String(e))
    } finally {
      setMs(Math.round(performance.now() - t0))
      setCorriendo(false)
    }
  }

  const abrir = () => { setAbierto(true); correr() }

  const fallan = res?.filter(x => !x.ok) ?? []
  const grupos = [...new Set(res?.map(x => x.grupo) ?? [])]

  return (
    <>
      <Button variant="outline" onClick={abrir} className="flex items-center gap-2 border-violet-400 text-violet-700">
        <FlaskConical className="h-4 w-4" />
        Probar
      </Button>

      <Dialog open={abierto} onOpenChange={o => { if (!o) setAbierto(false) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>🧪 Pruebas — lógica del romaneo y la carga</DialogTitle>
          </DialogHeader>

          <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] leading-4 text-blue-900">
            Corre <b>en tu navegador</b> con datos fijos escritos en el código. <b>No toca la base de
            datos</b>: no puede ensuciar nada ni cambiarte un número.
          </div>

          {corriendo && (
            <p className="flex items-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Corriendo…
            </p>
          )}

          {error && (
            <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <b>Los casos no llegaron a correr:</b> {error}
            </div>
          )}

          {res && (
            <>
              <div className={`rounded px-3 py-2 text-sm font-medium ${fallan.length ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>
                {fallan.length
                  ? `❌ ${fallan.length} de ${res.length} fallaron`
                  : `✅ ${res.length} de ${res.length} pasaron`}
                <span className="ml-2 font-normal text-gray-500">· {ms} ms</span>
              </div>

              {grupos.map(g => (
                <div key={g} className="rounded border">
                  <div className="border-b bg-gray-50 px-3 py-1 text-xs font-medium">{g}</div>
                  <div className="divide-y">
                    {res.filter(x => x.grupo === g).map((x, i) => (
                      <div key={i} className={`px-3 py-1.5 text-[11px] ${x.ok ? "" : "bg-rose-50"}`}>
                        <div className="flex items-start gap-2">
                          <span className={x.ok ? "text-emerald-600" : "text-rose-600"}>{x.ok ? "✓" : "✗"}</span>
                          <span className="flex-1">{x.caso}</span>
                          {x.cubre && <code className="rounded bg-gray-100 px-1 text-[9px] text-gray-500">{x.cubre}</code>}
                        </div>
                        {!x.ok && (
                          <div className="mt-1 pl-5 font-mono text-[10px] leading-4">
                            <div>esperado: <b>{x.esperado}</b></div>
                            <div className="text-rose-700">obtenido: <b>{x.obtenido}</b></div>
                          </div>
                        )}
                        {x.ok && (
                          <div className="pl-5 font-mono text-[10px] text-gray-500">{x.obtenido}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <p className="text-[10px] leading-4 text-muted-foreground">
                  Verifica que los números sean los que tienen que ser. <b>No</b> verifica que tengan
                  sentido — eso lo seguís mirando vos.
                </p>
                <Button size="sm" variant="outline" onClick={correr} disabled={corriendo}>↻ Correr de nuevo</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
