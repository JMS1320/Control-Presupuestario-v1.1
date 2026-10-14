"use client"

/**
 * 📝 El editor de VARIOS ECHEQS de un pago — A-FEAT-1282 (2026-10-14). Va adentro del modal
 * «Pago con ECHEQ» del Cash Flow: cuántos echeqs, cómo se reparte (iguales / % / montos, que son
 * partes del TOTAL) y la fecha de cobro de cada uno. La cuenta vive en `lib/pagos/echeqs-multiples.ts`.
 *
 * Sin plazos por default (usuario: *«no pongas 15, 30 y 60 porque eso varía»*): las fechas las pone él.
 */

import { pesosDelPlan, repartirMonto, problemasDelPlan, type ModoReparto, type PlanEcheqs } from "@/lib/pagos/echeqs-multiples"

export interface PlanEcheqsUI {
  modo: ModoReparto
  echeqs: { fechaCobro: string; parte: string; numero: string }[]
}

export const planVacio = (fechaCobro = ''): PlanEcheqsUI => ({ modo: 'iguales', echeqs: [{ fechaCobro, parte: '', numero: '' }] })

const parsearAR = (s: string) => parseFloat(String(s || '').replace(/\./g, '').replace(',', '.')) || 0
const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** El plan como lo usa la cuenta (montos y % parseados en formato es-AR). */
export function planDesdeUI(p: PlanEcheqsUI): PlanEcheqs {
  return {
    modo: p.modo,
    echeqs: p.echeqs.map(e => ({ fechaCobro: e.fechaCobro, parte: p.modo === 'iguales' ? undefined : parsearAR(e.parte), numero: e.numero.trim() || undefined })),
  }
}

export function EditorPlanEcheqs({ plan, onChange, total, varios }: {
  plan: PlanEcheqsUI
  onChange: (p: PlanEcheqsUI) => void
  /** Total del pago (antes de la retención), para mostrar las partes y validar «montos». `null` si no se sabe (lote). */
  total: number | null
  /** Pagando varias facturas a la vez: cada una se parte igual, y «por montos» no aplica. */
  varios?: boolean
}) {
  const n = plan.echeqs.length
  const setCantidad = (c: number) => {
    const k = Math.max(1, Math.min(250, Math.floor(c) || 1))
    const echeqs = Array.from({ length: k }, (_, i) => plan.echeqs[i] ?? { fechaCobro: '', parte: '', numero: '' })
    onChange({ ...plan, echeqs, modo: k === 1 ? 'iguales' : plan.modo })
  }
  const setEcheq = (i: number, campo: 'fechaCobro' | 'parte' | 'numero', v: string) =>
    onChange({ ...plan, echeqs: plan.echeqs.map((e, j) => (j === i ? { ...e, [campo]: v } : e)) })

  const planCalc = planDesdeUI(plan)
  const partes = total != null ? repartirMonto(total, pesosDelPlan(planCalc)) : []
  const problemas = problemasDelPlan(planCalc, total ?? 0)

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-3">
        <label className="text-sm font-medium">Cantidad de echeqs
          <input type="number" min={1} max={250} className="block w-20 border rounded px-2 py-1.5 text-sm mt-1" value={n} onChange={e => setCantidad(Number(e.target.value))} />
        </label>
        {n > 1 && (
          <div className="text-sm">
            <div className="font-medium mb-1">Cómo se reparte el total</div>
            <div className="flex gap-3">
              {([['iguales', 'Partes iguales'], ['porcentaje', 'Por %'], ['montos', 'Por montos']] as const)
                .filter(([m]) => !(varios && m === 'montos'))
                .map(([m, t]) => (
                  <label key={m} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" checked={plan.modo === m} onChange={() => onChange({ ...plan, modo: m })} />{t}
                  </label>
                ))}
            </div>
          </div>
        )}
      </div>
      {n > 1 && <p className="text-xs text-gray-500">Las partes son del <b>total</b> del pago; la retención SICORE se descuenta de cada echeq en la misma proporción.</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500">
            {n > 1 && <th className="text-left font-normal">#</th>}
            <th className="text-left font-normal">Fecha de cobro *</th>
            {plan.modo === 'porcentaje' && <th className="text-right font-normal">%</th>}
            {plan.modo === 'montos' && <th className="text-right font-normal">Monto (parte del total)</th>}
            <th className="text-left font-normal">Nº echeq <span className="text-gray-400">(opcional)</span></th>
            {total != null && n > 1 && <th className="text-right font-normal">Parte del total</th>}
          </tr>
        </thead>
        <tbody>
          {plan.echeqs.map((e, i) => (
            <tr key={i}>
              {n > 1 && <td className="pr-1 text-gray-500">{i + 1}</td>}
              <td className="pr-1"><input type="date" className="border rounded px-1.5 py-1 text-sm" value={e.fechaCobro} onChange={ev => setEcheq(i, 'fechaCobro', ev.target.value)} /></td>
              {plan.modo !== 'iguales' && (
                <td className="pr-1"><input type="text" className="w-28 border rounded px-1.5 py-1 text-sm text-right" placeholder={plan.modo === 'porcentaje' ? '33,33' : '0,00'} value={e.parte} onChange={ev => setEcheq(i, 'parte', ev.target.value)} /></td>
              )}
              <td className="pr-1"><input type="text" className="w-28 border rounded px-1.5 py-1 text-sm" placeholder="lo asigna el banco" value={e.numero} onChange={ev => setEcheq(i, 'numero', ev.target.value)} /></td>
              {total != null && n > 1 && <td className="text-right tabular-nums text-gray-600">${fmt(partes[i] ?? 0)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {total != null && n > 1 && <p className="text-xs text-gray-500 text-right">Total del pago: <b>${fmt(total)}</b></p>}
      {problemas.length > 0 && (
        <ul className="text-xs text-red-700 list-disc pl-4">{problemas.map((p, i) => <li key={i}>{p}</li>)}</ul>
      )}
    </div>
  )
}
