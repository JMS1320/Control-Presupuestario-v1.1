"use client"

/**
 * 🔒 ¿Con qué cuota se cierra sola esta tarea? — A-FEAT-1449 tanda 2.
 *
 * Una tarea atada a una cuota (`revisiones.cierre_auto = 'cuota_conciliada:<id>'`) se cierra sola cuando esa cuota
 * queda CONCILIADA (trigger del script 152). Desde un mail se elige acá: viene propuesto el template que más se parece
 * al asunto y, si el asunto dice «cuota N», esa cuota (aunque esté vencida: es el caso de la mora). Todo se cambia.
 */
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { templateSugerido, cuotaParaCierre, type TemplateSimple, type CuotaSimple } from "@/lib/mails/leer-documento"

const dia = (f: string | null | undefined) => f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(2, 4)}` : "—"
const pesos = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function SelectorCuotaCierre({ pistas, fechaRef, onCambio }: {
  /** Textos para proponer template y cuota (el asunto, el remitente). */
  pistas: string[]
  fechaRef: string
  onCambio: (c: { id: string; texto: string } | null) => void
}) {
  const [activo, setActivo] = useState(false)
  const [templates, setTemplates] = useState<TemplateSimple[]>([])
  const [templateId, setTemplateId] = useState("")
  const [cuotas, setCuotas] = useState<CuotaSimple[]>([])
  const [cuotaId, setCuotaId] = useState("")

  useEffect(() => {
    if (!activo || templates.length) return
    supabase.from("egresos_sin_factura").select("id, nombre_referencia, responsable").eq("activo", true).order("nombre_referencia")
      .then(({ data }) => {
        const ts = (data ?? []) as TemplateSimple[]
        setTemplates(ts)
        const t = templateSugerido(ts, null, pistas)
        if (t) void cargarCuotas(t.id, ts)
      })
  }, [activo]) // eslint-disable-line react-hooks/exhaustive-deps

  const cargarCuotas = async (tid: string, ts = templates) => {
    setTemplateId(tid); setCuotas([]); setCuotaId(""); onCambio(null)
    if (!tid) return
    const { data } = await supabase.from("cuotas_egresos_sin_factura")
      .select("id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, grupo_pago_id").eq("egreso_id", tid).order("fecha_vencimiento")
    const cs = (data ?? []) as CuotaSimple[]
    setCuotas(cs)
    const c = cuotaParaCierre(cs, pistas.join(" "), fechaRef)
    if (c) elegir(c.id, cs, ts.find(t => t.id === tid)?.nombre_referencia ?? "")
  }
  const elegir = (id: string, cs = cuotas, nombre = templates.find(t => t.id === templateId)?.nombre_referencia ?? "") => {
    setCuotaId(id)
    const c = cs.find(x => x.id === id)
    onCambio(c ? { id: c.id, texto: `${nombre} · cuota ${c.numero_cuota ?? "?"} (vence ${dia(c.fecha_vencimiento)})` } : null)
  }

  return (
    <div className="space-y-1 text-xs">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={activo} onChange={e => { setActivo(e.target.checked); if (!e.target.checked) onCambio(null) }} />
        🔒 Se cierra sola cuando se concilie el pago de una cuota
      </label>
      {activo && (
        <div className="flex flex-wrap items-center gap-1 pl-5">
          <select className="h-7 max-w-[240px] rounded border bg-white px-1" value={templateId} onChange={e => void cargarCuotas(e.target.value)}>
            <option value="">— template —</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.nombre_referencia}{t.responsable ? ` (${t.responsable})` : ""}</option>)}
          </select>
          <select className="h-7 rounded border bg-white px-1" value={cuotaId} onChange={e => elegir(e.target.value)} disabled={!cuotas.length}>
            <option value="">— cuota —</option>
            {cuotas.map(c => <option key={c.id} value={c.id}>c{c.numero_cuota ?? "?"} · vence {dia(c.fecha_vencimiento ?? c.fecha_estimada)} · {pesos(c.monto)} · {c.estado}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
