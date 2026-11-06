"use client"

/**
 * 🛑 «No va más» — A-FEAT-1572. Desde una cuota de template en el Cash Flow: se elige el alcance (sólo esta · esta y las
 * siguientes), se deja el motivo, y las cuotas pendientes pasan a «desactivado»; con «esta y las siguientes» también se
 * desactiva el template (para que no se renueve). Lo pagado no se toca. Un «Deshacer» en el aviso lo vuelve atrás.
 * La regla de qué se toca vive en `lib/templates/no-va-mas.ts`.
 */

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import { hoyArgentina, ahoraISO } from "@/lib/fechas"
import { linkTemplates } from "@/lib/impuestos/planilla"
import { planNoVaMas, notaNoVaMas, type AlcanceNoVaMas, type CuotaNoVaMas } from "@/lib/templates/no-va-mas"

const fmt = (n: number | null | undefined) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (f: string) => f.split('-').reverse().join('/')

interface Template { id: string; nombre_referencia: string | null; activo: boolean | null; observaciones_template: string | null }

export function ModalNoVaMas({ cuotaId, egresoId, onCerrar, onHecho }: {
  cuotaId: string; egresoId: string; onCerrar: () => void; onHecho: () => void
}) {
  const [template, setTemplate] = useState<Template | null>(null)
  const [cuotas, setCuotas] = useState<CuotaNoVaMas[]>([])
  const [alcance, setAlcance] = useState<AlcanceNoVaMas>('siguientes')
  const [motivo, setMotivo] = useState('')
  const [conTemplate, setConTemplate] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [{ data: t }, { data: cs }] = await Promise.all([
        supabase.from('egresos_sin_factura').select('id, nombre_referencia, activo, observaciones_template').eq('id', egresoId).single(),
        supabase.from('cuotas_egresos_sin_factura').select('id, fecha_estimada, estado, monto').eq('egreso_id', egresoId).order('fecha_estimada'),
      ])
      setTemplate(t as Template)
      setCuotas((cs || []) as CuotaNoVaMas[])
    })()
  }, [egresoId])

  const plan = useMemo(() => planNoVaMas(cuotas, cuotaId, alcance), [cuotas, cuotaId, alcance])
  // El tilde del template arranca con lo que propone el plan (no, si hay anteriores abiertas) y se puede cambiar.
  useEffect(() => { setConTemplate(plan.desactivarTemplate) }, [plan.desactivarTemplate])
  const tocaTemplate = alcance === 'siguientes' && conTemplate && template?.activo !== false

  const aplicar = async () => {
    if (!template || (!plan.desactivar.length && !tocaTemplate)) return
    setGuardando(true)
    try {
      const ids = plan.desactivar.map(c => c.id)
      if (ids.length) {
        // Guarda doble: sólo las que siguen pendientes (si alguien la pagó recién, no se pisa)
        const { error } = await supabase.from('cuotas_egresos_sin_factura')
          .update({ estado: 'desactivado', updated_at: ahoraISO() }).in('id', ids).eq('estado', 'pendiente')
        if (error) throw error
      }
      const obsPrevia = template.observaciones_template
      const cambioTemplate: Record<string, unknown> = {
        observaciones_template: notaNoVaMas(obsPrevia, hoyArgentina(), alcance, ids.length, motivo), updated_at: ahoraISO(),
      }
      if (tocaTemplate) cambioTemplate.activo = false
      const { error: e2 } = await supabase.from('egresos_sin_factura').update(cambioTemplate).eq('id', template.id)
      if (e2) throw e2

      const deshacer = async () => {
        if (ids.length) await supabase.from('cuotas_egresos_sin_factura').update({ estado: 'pendiente', updated_at: ahoraISO() }).in('id', ids).eq('estado', 'desactivado')
        await supabase.from('egresos_sin_factura').update({ observaciones_template: obsPrevia, ...(tocaTemplate ? { activo: true } : {}), updated_at: ahoraISO() }).eq('id', template.id)
        toast.success('Deshecho: las cuotas y el template quedaron como estaban')
        onHecho()
      }
      toast.success(`🛑 ${template.nombre_referencia || 'Template'}: ${ids.length} cuota(s) desactivada(s)${tocaTemplate ? ' y el template desactivado (no se renueva)' : ''}`,
        { action: { label: 'Deshacer', onClick: () => { void deshacer() } }, duration: 15000 })
      onHecho()
      onCerrar()
    } catch (e) {
      toast.error('No se pudo aplicar: ' + (e as Error).message)
    } finally { setGuardando(false) }
  }

  const lista = (titulo: string, cs: CuotaNoVaMas[], clase: string) => cs.length > 0 && (
    <div className={`rounded border p-2 text-xs ${clase}`}>
      <p className="font-medium">{titulo}</p>
      {cs.map(c => <div key={c.id}>{fecha(c.fecha_estimada)} · $ {fmt(c.monto)} · {c.estado}</div>)}
    </div>
  )

  return (
    <Dialog open onOpenChange={v => { if (!v) onCerrar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>🛑 No va más — {template?.nombre_referencia || '…'}</DialogTitle></DialogHeader>
        <TestsDelProceso proceso="cashflow/no-va-mas" pantalla="cashflow" />
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <label className="flex items-center gap-2">
              <input type="radio" checked={alcance === 'esta'} onChange={() => setAlcance('esta')} />
              <span><b>Sólo esta cuota</b> — el template sigue (las demás cuotas no cambian)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={alcance === 'siguientes'} onChange={() => setAlcance('siguientes')} />
              <span><b>Esta y las siguientes</b> — ya no corresponde este gasto</span>
            </label>
          </div>

          {lista(`Pasan a «Desactivado» (${plan.desactivar.length}) — no se borran: quedan en el historial`, plan.desactivar, 'border-red-200 bg-red-50 text-red-900')}
          {lista('No se tocan (ya están en un lote, pagadas o conciliadas)', plan.noSeTocan, 'border-gray-200 bg-gray-50 text-gray-700')}

          {alcance === 'siguientes' && template?.activo !== false && (
            <div className="space-y-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={conTemplate} onChange={e => setConTemplate(e.target.checked)} />
                <span>Desactivar también el template (así <b>«Renovar campaña»</b> no lo vuelve a crear)</span>
              </label>
              {plan.anterioresAbiertas.length > 0 && lista(
                `⚠️ Ojo: el template tiene ${plan.anterioresAbiertas.length} cuota(s) anterior(es) todavía abierta(s). Si lo desactivás, dejan de verse en el Cash Flow aunque no estén pagadas:`,
                plan.anterioresAbiertas, 'border-amber-300 bg-amber-50 text-amber-900')}
              {!conTemplate && <p className="text-xs text-amber-700">Sin desactivarlo, la próxima «Renovar campaña» lo puede volver a crear.</p>}
            </div>
          )}

          <label className="block text-xs text-gray-600">Motivo (queda anotado en el template)
            <textarea className="mt-1 w-full rounded border p-1 text-sm" rows={2} value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ej.: se dio de baja el seguro" />
          </label>

          <div className="flex items-center justify-between gap-2">
            <button type="button" className="text-xs text-blue-700 underline" onClick={() => window.open(linkTemplates([egresoId]), '_blank')}>
              ir al template ↗
            </button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
              <Button variant="destructive" disabled={guardando || !template || (!plan.desactivar.length && !tocaTemplate)} onClick={aplicar}>
                {guardando ? 'Aplicando…' : 'No va más'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
