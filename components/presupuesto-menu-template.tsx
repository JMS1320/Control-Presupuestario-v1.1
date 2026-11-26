"use client"

/**
 * ⋯ **A-FEAT-1661 — editar un template DESDE SU FILA del presupuesto** (JMS 25/11: «abrir modal para corregir montos, abrir
 * link o desactivar el template debería ser desde la misma línea del presupuesto… no de un lugar aparte»).
 *
 * Las tres capas, de la más liviana a la que cambia el dato:
 *   1. **Sacar del presupuesto** (el template entero o un mes): marca `fuera` en `presupuesto_marcas`. NO toca el template.
 *   2. **Corregir el monto de una cuota cargada**: con el MISMO modal que Templates y Cash Flow
 *      (`ModalPropagarMontoCuota`: pregunta si propaga a las futuras). Ningún camino de escritura nuevo.
 *   3. **Lo estructural** (desactivar, fechas, responsable…): link a Egresos → Templates filtrado en ese template.
 */
import { useState } from "react"
import { MoreHorizontal, ExternalLink } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ModalPropagarMontoCuota } from "@/components/modal-propagar-monto-cuota"
import { linkTemplates } from "@/lib/impuestos/planilla"

const $ = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`
const parseAR = (t: string) => parseFloat(String(t).replace(/\./g, "").replace(",", ".")) || 0
const fmtAR = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nombreMes = (k: string) => { const [a, m] = k.split("-"); return `${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][Number(m) - 1]}-${a.slice(2)}` }

interface Cuota { id: string; fecha_estimada: string | null; monto: number; estado: string | null }

/** Estados que se pueden elegir desde el presupuesto. «conciliado» no: lo pone la conciliación (con su movimiento del banco). */
const ESTADOS: [string, string][] = [["pendiente", "pendiente"], ["pagar", "a pagar"], ["pagado", "pagado"], ["nada_a_pagar", "nada a pagar (dio cero)"]]

export function MenuFilaTemplate(p: {
  templateId: string
  /** 👪 Los templates de la familia (uno por campaña) que se muestran juntos en el renglón. */
  familiaIds?: string[]
  nombre: string
  /** Los meses de la grilla, desde el actual (claves YYYY-MM). */
  meses: string[]
  /** Lo que la grilla muestra hoy en cada mes (ya sin lo pagado del mes en curso). */
  montos: Record<string, number>
  fueraTemplate: boolean
  mesesFuera: Set<string>
  /** Saca o vuelve a poner: `mes` null = el template entero. */
  onAlternarFuera: (mes: string | null) => Promise<void>
  /** Volver a leer el presupuesto después de cambiar una cuota. */
  onRecargar: () => Promise<void> | void
}) {
  const [abierto, setAbierto] = useState(false)
  const [cuotas, setCuotas] = useState<Cuota[] | null>(null)
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [propagar, setPropagar] = useState<{ cuotaId: string; nuevoMonto: number } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState("")

  const cargar = async () => {
    const desde = `${p.meses[0]}-01`
    const ult = p.meses[p.meses.length - 1].split("-").map(Number)
    const hasta = `${new Date(ult[0], ult[1], 1).toISOString().slice(0, 10)}`
    const { data } = await supabase.from("cuotas_egresos_sin_factura")
      .select("id, fecha_estimada, monto, estado").in("egreso_id", p.familiaIds?.length ? p.familiaIds : [p.templateId])
      .gte("fecha_estimada", desde).lt("fecha_estimada", hasta).neq("estado", "desactivado").order("fecha_estimada")
    const cs = ((data || []) as any[]).map(c => ({ id: String(c.id), fecha_estimada: c.fecha_estimada, monto: Number(c.monto) || 0, estado: c.estado }))
    setCuotas(cs)
    setTextos(Object.fromEntries(cs.map(c => [c.id, fmtAR(c.monto)])))
  }
  const abrir = async () => { setAbierto(true); await cargar() }
  const porMes: Record<string, Cuota[]> = {}
  for (const c of cuotas || []) if (c.fecha_estimada) (porMes[c.fecha_estimada.slice(0, 7)] ??= []).push(c)

  const guardarMonto = (c: Cuota) => {
    const nuevo = parseAR(textos[c.id] ?? "")
    if (Math.abs(nuevo - c.monto) < 0.005) return
    setPropagar({ cuotaId: c.id, nuevoMonto: nuevo })
  }
  const alternar = async (mes: string | null) => {
    setOcupado(true)
    try { await p.onAlternarFuera(mes) } finally { setOcupado(false) }
  }

  return (
    <>
      <button type="button" title="Corregir cuotas, sacar del presupuesto o ir al template"
        onClick={e => { e.stopPropagation(); void abrir() }}
        className="ml-1 inline-flex items-center rounded px-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700">
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{p.nombre}</DialogTitle>
            <DialogDescription>
              Corregí el monto de una cuota cargada, o sacá del presupuesto un mes o el template entero (esto último no toca el template).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" disabled={ocupado} checked={p.fueraTemplate} onChange={() => void alternar(null)} />
              Sacar todo el template del presupuesto
            </label>
            <Button size="sm" variant="outline" className="h-7 gap-1"
              onClick={() => window.open(linkTemplates(p.familiaIds?.length ? p.familiaIds : [p.templateId]), "_blank", "noopener")}>
              <ExternalLink className="h-3.5 w-3.5" /> Ir al template (desactivar, fechas, responsable…)
            </Button>
          </div>
          {aviso && <p className="text-xs text-red-700">{aviso}</p>}
          {cuotas === null ? <p className="text-xs text-gray-500">Cargando cuotas…</p> : (
            <table className="mt-2 w-full text-xs">
              <thead><tr className="text-left text-gray-500">
                <th>Mes</th><th>Cuota cargada</th><th>Estado</th><th className="text-right">En el presupuesto</th><th className="text-center">No cuenta este mes</th>
              </tr></thead>
              <tbody>
                {p.meses.map(k => {
                  const cs = porMes[k] || []
                  const enPres = p.montos[k] || 0
                  if (!cs.length && !enPres && !p.mesesFuera.has(k)) return null
                  return (
                    <tr key={k} className="border-t border-slate-100">
                      <td className="py-1 pr-2">{nombreMes(k)}</td>
                      <td className="pr-2">
                        {cs.length ? cs.map(c => (
                          <Input key={c.id} type="text" className="my-0.5 h-6 w-32 text-right text-xs" value={textos[c.id] ?? ""}
                            onChange={e => setTextos(t => ({ ...t, [c.id]: e.target.value }))}
                            onBlur={() => guardarMonto(c)} onKeyDown={e => { if (e.key === "Enter") guardarMonto(c) }} />
                        )) : <span className="text-gray-400" title="No hay cuota cargada: el presupuesto proyecta este mes. Para cargar una cuota, ir al template.">proyectado</span>}
                      </td>
                      <td className="pr-2 text-gray-500">
                        {cs.length ? cs.map(c => (
                          // El estado se cambia acá mismo (JMS 25/11: «aquí no puedo cambiar el estado»). Ej.: Ganancias que dio 0 → «nada a pagar».
                          <select key={c.id} className="my-0.5 block h-6 rounded border border-gray-300 bg-white px-1 text-xs" value={c.estado || "pendiente"}
                            title={c.estado === "conciliado" ? "Está conciliada: si tiene un movimiento del banco, desvinculalo desde el extracto antes de cambiarla" : "Cambiar el estado de esta cuota"}
                            onChange={async e => {
                              const nuevo = e.target.value
                              const { error } = await supabase.from("cuotas_egresos_sin_factura").update({ estado: nuevo }).eq("id", c.id)
                              if (error) { setAviso("No se pudo cambiar el estado: " + error.message); return }
                              await cargar(); await p.onRecargar()
                            }}>
                            {c.estado === "conciliado" && <option value="conciliado">conciliado</option>}
                            {!ESTADOS.some(([v]) => v === c.estado) && c.estado && c.estado !== "conciliado" && <option value={c.estado}>{c.estado}</option>}
                            {ESTADOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                          </select>
                        )) : "—"}
                      </td>
                      <td className="text-right">{p.fueraTemplate || p.mesesFuera.has(k) ? <span className="text-gray-400 line-through">{$(enPres)}</span> : $(enPres)}</td>
                      <td className="text-center">
                        <input type="checkbox" disabled={ocupado || p.fueraTemplate} checked={p.mesesFuera.has(k)} onChange={() => void alternar(k)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </DialogContent>
      </Dialog>
      {propagar && (
        <ModalPropagarMontoCuota abierto cuotaId={propagar.cuotaId} nuevoMonto={propagar.nuevoMonto}
          onCancelar={() => { setPropagar(null); void cargar() }}
          onGuardado={async () => { setPropagar(null); await cargar(); await p.onRecargar() }} />
      )}
    </>
  )
}
