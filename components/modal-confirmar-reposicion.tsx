"use client"

/**
 * 🐄 Confirmar la reposición desde un Excel — A-FEAT-1251.
 *
 * El usuario sube la planilla de las hembras confirmadas; la ventana muestra el PLAN (a marcar, a
 * desmarcar, no encontradas, ambiguas) y recién al confirmar escribe la marca «rep». Lo que no se pudo
 * cruzar queda a la vista: no se descarta nada en silencio. Los toritos no se tocan (sólo hembras).
 */

import { useState } from "react"
import * as XLSX from "xlsx"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import { caravanasDeHoja, planReposicion, cierraPlan, type HembraRep, type PlanReposicion } from "@/lib/productivo/reposicion"

const etiqueta = (h: HembraRep) =>
  `${h.caravana_oficial || '(sin oficial)'}${h.caravana_interna ? ` · ${h.caravana_interna}` : ''}`

function Lista({ titulo, items, color }: { titulo: string; items: string[]; color: string }) {
  if (!items.length) return null
  return (
    <details className={`rounded border p-2 ${color}`} open={items.length <= 12}>
      <summary className="cursor-pointer text-sm font-medium">{titulo} ({items.length})</summary>
      <div className="mt-1 max-h-40 overflow-y-auto font-mono text-xs leading-5">
        {items.map((x, i) => <div key={i}>{x}</div>)}
      </div>
    </details>
  )
}

export function ModalConfirmarReposicion({
  abierto, onCerrar, hembras, onAplicado,
}: {
  abierto: boolean
  onCerrar: () => void
  hembras: HembraRep[]
  onAplicado: () => void
}) {
  const [archivo, setArchivo] = useState('')
  const [columnas, setColumnas] = useState('')
  const [leidas, setLeidas] = useState(0)
  const [plan, setPlan] = useState<PlanReposicion | null>(null)
  const [guardando, setGuardando] = useState(false)

  const leer = async (f: File) => {
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
      // La primera hoja que traiga caravanas.
      for (const nombre of wb.SheetNames) {
        const filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre], { header: 1, raw: false, defval: '' })
        const r = caravanasDeHoja(filas)
        if (r.caravanas.length) {
          setArchivo(`${f.name} · hoja «${nombre}»`)
          setColumnas(r.columnas)
          setLeidas(r.caravanas.length)
          setPlan(planReposicion(r.caravanas, hembras))
          return
        }
      }
      toast.error('No encontré caravanas en ninguna hoja')
    } catch (e: any) {
      toast.error('No se pudo leer el archivo: ' + (e?.message || e))
    }
  }

  const aplicar = async () => {
    if (!plan) return
    setGuardando(true)
    const prod = supabase.schema('productivo')
    const m = plan.marcar.map(h => h.id)
    const d = plan.desmarcar.map(h => h.id)
    const r1 = m.length ? await prod.from('terneros').update({ es_torito: true }).in('id', m) : { error: null }
    const r2 = d.length ? await prod.from('terneros').update({ es_torito: false }).in('id', d) : { error: null }
    setGuardando(false)
    const err = r1.error || r2.error
    if (err) { toast.error('Error al guardar: ' + err.message); return }
    toast.success(`Reposición confirmada: quedan ${plan.yaBien.length + m.length} (${m.length} nuevas, ${d.length} quitadas)`)
    setPlan(null)
    setArchivo('')
    onAplicado()
    onCerrar()
  }

  const totalRep = plan ? plan.yaBien.length + plan.marcar.length : 0
  const sinCruzar = plan ? plan.noEncontradas.length + plan.ambiguas.length : 0
  return (
    <Dialog open={abierto} onOpenChange={v => { if (!v) onCerrar() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>🐄 Confirmar reposición desde Excel</DialogTitle></DialogHeader>
        <TestsDelProceso proceso="productivo/reposicion" pantalla="productivo" />
        <p className="text-sm text-gray-600">
          Subí la planilla con las hembras confirmadas. Leo la columna que diga <b>«caravana»</b> o <b>«IDV»</b> (oficial, del lector o
          interna); si no hay encabezado, la primera columna. Antes de guardar te muestro qué cambia.
        </p>
        <input type="file" accept=".xlsx,.xls,.csv" className="text-sm"
          onChange={e => { const f = e.target.files?.[0]; if (f) leer(f) }} />
        {plan && (
          <div className="space-y-2 text-sm">
            <p className="text-gray-600">{archivo} — columna: <b>{columnas}</b> — {leidas} caravanas leídas.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded bg-emerald-50 p-2"><div className="text-lg font-semibold">{plan.yaBien.length}</div>ya marcadas</div>
              <div className="rounded bg-pink-50 p-2"><div className="text-lg font-semibold">+{plan.marcar.length}</div>a marcar</div>
              <div className="rounded bg-gray-100 p-2"><div className="text-lg font-semibold">−{plan.desmarcar.length}</div>a quitar</div>
              <div className="rounded bg-amber-50 p-2"><div className="text-lg font-semibold">{sinCruzar}</div>sin cruzar</div>
            </div>
            {/* Control: lo que queda marcado + lo que no se pudo cruzar + repetidas = lo leído. */}
            {cierraPlan(plan, leidas)
              ? <p className="text-xs text-emerald-700">✓ Cierra: {totalRep} quedan rep + {sinCruzar} sin cruzar + {plan.repetidas.length} repetidas = {leidas} leídas.</p>
              : <p className="text-sm font-semibold text-red-700">⚠️ No cierra contra las {leidas} leídas — no guardes y avisame.</p>}
            <Lista titulo="➕ A marcar como rep" items={plan.marcar.map(etiqueta)} color="border-pink-200" />
            <Lista titulo="➖ Tienen rep y NO están en la planilla: se les quita" items={plan.desmarcar.map(etiqueta)} color="border-gray-300" />
            <Lista titulo="⚠️ No encontradas en el sistema" items={plan.noEncontradas} color="border-amber-300 bg-amber-50/50" />
            <Lista titulo="⚠️ Ambiguas (coinciden con más de una — no se tocan)"
              items={plan.ambiguas.map(a => `${a.dato} → ${a.candidatas.map(etiqueta).join(' / ')}`)} color="border-amber-300 bg-amber-50/50" />
            <Lista titulo="Repetidas en la planilla" items={plan.repetidas} color="border-gray-200" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
              <Button disabled={guardando || !cierraPlan(plan, leidas) || (!plan.marcar.length && !plan.desmarcar.length)} onClick={aplicar}
                className="bg-pink-600 hover:bg-pink-700 text-white">
                {guardando ? 'Guardando…' : `Confirmar: quedan ${totalRep} de reposición`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
