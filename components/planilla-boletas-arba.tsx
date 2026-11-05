"use client"

/**
 * 🗂️ Boletas de ARBA en la PLANILLA de Inmobiliario — A-FEAT-1565.
 *
 * Se abre desde el panel de Boletas ARBA cuando ya se leyeron las boletas. Por responsable, cada partida con sus cuotas
 * anteriores, la presupuestada, la que vino (con su 📎) y las dos diferencias; en cada fila se decide: aceptar la boleta,
 * dejar la presupuestada o escribir otra. Las partidas que no vinieron también están («¿faltan boletas?»), y las boletas
 * «Sin asignar» se asignan a su partida acá. «Aplicar» usa el mismo aplicar del panel (escribe la cuota y guarda la
 * boleta con su huella). La lógica vive en `lib/arba/planilla-boletas.ts`.
 */
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import {
  armarPlanillaBoletas, decisionPropuesta, importeElegido,
  type Decision, type TemplateParaPlanilla, type CuotaParaPlanilla, type BoletaParaPlanilla, type FilaPlanillaBoleta,
} from "@/lib/arba/planilla-boletas"

const plata = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const montoAR = (t: string) => { const n = parseFloat(String(t).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null }

export interface BoletaDelPanel {
  archivo: string
  egresoId: string | null
  cuotaId: string | null
  cuotaNro: number | null
  importe: number | null
  vencimiento: string | null
  aplicada: boolean
  problema: string | null
  lote: string | null
}

export function PlanillaBoletasArba({ open, onOpenChange, boletas, urlDe, onAsignar, onAplicar, aplicando }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  boletas: BoletaDelPanel[]
  urlDe: (archivo: string) => string | null
  /** Asigna una boleta «Sin asignar» a un template (el panel la casa con su cuota). */
  onAsignar: (idx: number, egresoId: string) => Promise<void>
  /** Aplica: por índice del panel, la decisión y el importe escrito (`otra`). */
  onAplicar: (decisiones: { idx: number; decision: Decision; otra: string }[]) => Promise<void>
  aplicando: boolean
}) {
  const [templates, setTemplates] = useState<TemplateParaPlanilla[]>([])
  const [cuotas, setCuotas] = useState<CuotaParaPlanilla[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Por template: la decisión y lo escrito a mano. */
  const [dec, setDec] = useState<Record<string, { decision: Decision; otra: string }>>({})

  useEffect(() => {
    if (!open) return
    let vivo = true
    ;(async () => {
      setCargando(true); setError(null)
      const { data: ts, error: e1 } = await supabase.from("egresos_sin_factura")
        .select("id, nombre_referencia, partida_arba, responsable, activo, categ")
        .eq("activo", true).or("partida_arba.not.is.null,nombre_referencia.ilike.%Complementario%")
      if (e1) { if (vivo) { setError(e1.message); setCargando(false) } return }
      const lista = ((ts ?? []) as { id: string; nombre_referencia: string; partida_arba: string | null; responsable: string | null; categ: string | null }[])
        .filter(t => t.responsable && /inmobiliario/i.test(`${t.categ ?? ""} ${t.nombre_referencia}`) && !/anual/i.test(t.nombre_referencia))
        .map(t => ({ id: t.id, nombre: t.nombre_referencia, responsable: t.responsable!, partida: t.partida_arba }))
      const ids = lista.map(t => t.id)
      const cs: CuotaParaPlanilla[] = []
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error: e2 } = await supabase.from("cuotas_egresos_sin_factura")
          .select("id, egreso_id, numero_cuota, monto, fecha_vencimiento, estado").in("egreso_id", ids.slice(i, i + 100))
        if (e2) { if (vivo) { setError(e2.message); setCargando(false) } return }
        cs.push(...((data ?? []) as { id: string; egreso_id: string; numero_cuota: number | null; monto: number; fecha_vencimiento: string | null; estado: string }[])
          .map(c => ({ id: c.id, egresoId: c.egreso_id, numero: c.numero_cuota, monto: Number(c.monto), vencimiento: c.fecha_vencimiento, estado: c.estado })))
      }
      if (!vivo) return
      setTemplates(lista); setCuotas(cs); setCargando(false)
    })()
    return () => { vivo = false }
  }, [open])

  const paraPlanilla: BoletaParaPlanilla[] = useMemo(() => boletas.map((b, idx) => ({
    idx, egresoId: b.egresoId, cuotaId: b.cuotaId, cuotaNro: b.cuotaNro, importe: b.importe, vencimiento: b.vencimiento,
    url: urlDe(b.archivo), aplicada: b.aplicada, problema: b.problema,
  })), [boletas, urlDe])
  const bloques = useMemo(() => armarPlanillaBoletas(templates, cuotas, paraPlanilla), [templates, cuotas, paraPlanilla])
  const sinAsignar = boletas.map((b, idx) => ({ b, idx })).filter(x => !x.b.egresoId)
  const maxAnteriores = Math.max(0, ...bloques.flatMap(b => b.filas.map(f => f.anteriores.length)))

  const decisionDe = (f: FilaPlanillaBoleta) => dec[f.templateId] ?? { decision: decisionPropuesta(f), otra: "" }
  const elegir = (f: FilaPlanillaBoleta, d: Partial<{ decision: Decision; otra: string }>) =>
    setDec(prev => ({ ...prev, [f.templateId]: { ...decisionDe(f), ...d } }))

  const aplicar = async () => {
    const lista = bloques.flatMap(b => b.filas).filter(f => f.idx != null && !f.aplicada)
      .map(f => ({ idx: f.idx!, ...decisionDe(f) }))
    await onAplicar(lista)
  }

  const colDif = (d: number | null, p: number | null) => d == null ? <span className="text-gray-300">—</span>
    : <span className={Math.abs(p ?? 0) > 20 ? "font-semibold text-red-700" : d > 0 ? "text-amber-800" : "text-emerald-700"}>{d > 0 ? "+" : ""}{plata(d)} <span className="text-[10px]">({p != null ? `${p > 0 ? "+" : ""}${p.toLocaleString("es-AR")} %` : "—"})</span></span>

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[97vw] max-w-[97vw] overflow-auto">
        <DialogHeader>
          <DialogTitle>🗂️ Boletas de ARBA en la planilla — por responsable</DialogTitle>
          <DialogDescription>
            Cada partida con sus cuotas anteriores, la presupuestada y la que vino. Elegí en cada una: aceptar la boleta, dejar la
            presupuestada o escribir otra. Nada se cambia hasta «Aplicar».
          </DialogDescription>
        </DialogHeader>
        {cargando && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Leyendo las cuotas…</p>}
        {error && <p className="text-sm text-red-600">⚠️ {error}</p>}

        {sinAsignar.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs">
            <p className="mb-1 font-medium text-amber-900">⚠️ {sinAsignar.length} boleta(s) sin partida reconocida — asignalas a su campo:</p>
            {sinAsignar.map(({ b, idx }) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 py-0.5">
                <span className="max-w-[420px] truncate" title={b.archivo}>{b.archivo}</span>
                <span className="tabular-nums">$ {plata(b.importe)}</span>
                {urlDe(b.archivo) && <a href={urlDe(b.archivo)!} target="_blank" rel="noreferrer" className="text-blue-700 underline">📎 ver</a>}
                <select className="h-7 rounded border bg-background px-1" defaultValue="" onChange={e => { if (e.target.value) void onAsignar(idx, e.target.value) }}>
                  <option value="">— elegí el campo —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.responsable} · {t.nombre}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

        {bloques.map(bl => {
          const totalElegido = bl.filas.reduce((s, f) => { const d = decisionDe(f); return s + (importeElegido(f, d.decision, montoAR(d.otra)) ?? 0) }, 0)
          return (
            <div key={bl.responsable} className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">{bl.responsable}</h3>
                <span className="text-xs text-muted-foreground">
                  presupuestado $ {plata(bl.totalPresup)} · vino $ {plata(bl.totalVino)} · <b>queda $ {plata(totalElegido)}</b>
                  {bl.faltan > 0 && <span className="ml-2 font-semibold text-red-700">· {bl.faltan} sin boleta</span>}
                </span>
              </div>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-xs tabular-nums">
                  <thead className="bg-gray-50 text-[11px] text-gray-600">
                    <tr>
                      <th className="p-1.5 text-left">Campo · partida</th>
                      {Array.from({ length: maxAnteriores }, (_, i) => <th key={i} className="p-1.5 text-right">Cuota {i + 1}</th>)}
                      <th className="p-1.5 text-right">Presupuestada</th>
                      <th className="p-1.5 text-right">Vino</th>
                      <th className="p-1.5 text-right">Dif. vs presupuestada</th>
                      <th className="p-1.5 text-right">Dif. vs anterior</th>
                      <th className="p-1.5 text-left">Qué queda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bl.filas.map(f => {
                      const d = decisionDe(f)
                      return (
                        <tr key={f.templateId} className={f.idx == null ? "bg-red-50/40" : f.aplicada ? "bg-emerald-50/50" : undefined}>
                          <td className="p-1.5">
                            <div className="font-medium">{f.campo}</div>
                            <div className="text-[10px] text-gray-400">{f.partida ?? ""}{f.cuotaNro ? ` · cuota ${f.cuotaNro}` : ""}</div>
                          </td>
                          {Array.from({ length: maxAnteriores }, (_, i) => {
                            const a = f.anteriores.find(x => x.numero === i + 1)
                            return <td key={i} className="p-1.5 text-right text-gray-500" title={a?.estado}>{a ? plata(a.monto) : ""}</td>
                          })}
                          <td className="p-1.5 text-right">{plata(f.presupuestada)}</td>
                          <td className="p-1.5 text-right font-medium">
                            {f.idx == null ? <span className="text-red-700">no vino</span> : <>{plata(f.vino)}{f.url && <a href={f.url} target="_blank" rel="noreferrer" className="ml-1 text-blue-700" title="Ver la boleta">📎</a>}</>}
                            {f.vencVino && <div className="text-[10px] font-normal text-gray-400">vence {f.vencVino.split("-").reverse().join("/")}</div>}
                          </td>
                          <td className="p-1.5 text-right">{colDif(f.difPresup, f.pctPresup)}</td>
                          <td className="p-1.5 text-right">{colDif(f.difAnterior, f.pctAnterior)}</td>
                          <td className="p-1.5">
                            {f.aplicada ? <span className="text-emerald-700">✓ aplicada</span> : f.idx == null ? <span className="text-gray-400">queda la presupuestada</span> : (
                              <div className="flex flex-wrap items-center gap-1">
                                {(["aceptar", "presupuestada", "otra"] as Decision[]).map(op => (
                                  <label key={op} className={`cursor-pointer rounded border px-1.5 py-0.5 ${d.decision === op ? "border-primary bg-primary/10" : ""}`}>
                                    <input type="radio" className="sr-only" name={`d-${f.templateId}`} checked={d.decision === op} onChange={() => elegir(f, { decision: op })} />
                                    {op === "aceptar" ? "Boleta" : op === "presupuestada" ? "Presupuestada" : "Otra"}
                                  </label>
                                ))}
                                {d.decision === "otra" && <Input type="text" inputMode="decimal" placeholder="0,00" value={d.otra} onChange={e => elegir(f, { otra: e.target.value })} className="h-6 w-28 text-xs" />}
                                {f.estadoCuota === "conciliado" && <span className="text-[10px] text-amber-700" title="Ya se pagó por ese importe">⚠️ conciliada</span>}
                                {f.problema && <span className="text-[10px] text-amber-700" title={f.problema}>⚠️</span>}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}

        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-background pt-2">
          <span className="text-xs text-muted-foreground">«Boleta» y «Otra» cambian la cuota (importe y vencimiento de la boleta); «Presupuestada» la deja como está.</span>
          <Button onClick={() => void aplicar()} disabled={aplicando || cargando}>
            {aplicando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Aplicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
