"use client"

// Presupuesto → Inversiones.
//
// Bloque aparte de gastos y costos, y por dos razones que no son de presentación:
//   · Una inversión NO se proyecta desde la historia — no existe "la última factura de silos".
//     Se carga a mano, una por una, con nombre específico ("2 silos de autoconsumo 7 Ton c/u"),
//     no con una categoría.
//   · Una inversión SE JUSTIFICA. Por eso la justificación es un campo del modelo y no una nota
//     al pie: es lo que se le explica a los socios cuando preguntan por qué se puso plata ahí.
//
// Mezclarlas con el egreso operativo distorsiona las dos cosas: el gasto del año parece más
// grande de lo que es, y la inversión pierde el único dato que la hace discutible.

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, Plus, Trash2, ChevronDown, ChevronRight, Hammer, AlertTriangle,
} from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"

const MESES_TXT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
const ESTADOS = ["prevista", "aprobada", "en curso", "hecha", "descartada"] as const
const pesos = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("es-AR")}`)

interface Inversion {
  id: string
  campana: string | null
  nombre: string
  centro_costo_id: string | null
  justificacion: string | null
  monto: number | null
  mes: number | null
  anio: number | null
  plazo_meses: number | null
  estado: string
  notas: string | null
}
interface CentroCosto { id: string; nombre: string; tipo: string | null }

export function ConfiguradorInversiones() {
  const [cargando, setCargando] = useState(true)
  const [items, setItems] = useState<Inversion[]>([])
  const [centros, setCentros] = useState<CentroCosto[]>([])
  const [campana, setCampana] = useState("26/27")
  const [abierta, setAbierta] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [inv, cc] = await Promise.all([
        supabase.from("presupuesto_inversiones").select("*")
          .eq("empresa", "MSA").eq("escenario", "base").eq("activo", true).order("nombre"),
        supabase.from("centros_costo").select("id, nombre, tipo").eq("activo", true).order("nombre"),
      ])
      setItems((inv.data || []) as Inversion[])
      setCentros((cc.data || []) as CentroCosto[])
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const campanas = useMemo(() => {
    const s = new Set(items.map(i => i.campana).filter(Boolean) as string[])
    s.add(campana)
    return Array.from(s).sort()
  }, [items, campana])

  const visibles = useMemo(
    () => items.filter(i => i.campana === campana || i.campana == null),
    [items, campana])

  /** Sólo cuenta lo que se va a hacer: una descartada no es presupuesto. */
  const total = visibles
    .filter(i => i.estado !== "descartada")
    .reduce((s, i) => s + (i.monto ?? 0), 0)

  const sinJustificar = visibles.filter(
    i => i.estado !== "descartada" && !i.justificacion?.trim()).length

  const guardar = async (id: string, cambios: Partial<Inversion>) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...cambios } : i)))
    const { error } = await supabase.from("presupuesto_inversiones")
      .update({ ...cambios, updated_at: new Date().toISOString() }).eq("id", id)
    if (error) { alert("Error: " + error.message); await cargar() }
  }

  const crear = async () => {
    const { data, error } = await supabase.from("presupuesto_inversiones").insert({
      empresa: "MSA", campana, escenario: "base", nombre: "Inversión nueva", estado: "prevista",
    }).select().single()
    if (error) { alert("Error: " + error.message); return }
    await cargar()
    setAbierta((data as any).id)
  }

  const borrar = async (id: string) => {
    if (!confirm("¿Borrar esta inversión?")) return
    await supabase.from("presupuesto_inversiones").delete().eq("id", id)
    await cargar()
  }

  if (cargando) {
    return (
      <Card><CardContent className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leyendo inversiones…
      </CardContent></Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hammer className="h-4 w-4" /> Inversiones
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              Aparte de gastos y costos. Se cargan a mano, con <strong>nombre específico</strong> y
              el <strong>porqué</strong>: una inversión se justifica, no sólo se registra.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Campaña</span>
              {campanas.map(c => (
                <button key={c} type="button" onClick={() => setCampana(c)}
                  className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                    campana === c ? "border-gray-700 bg-gray-700 text-white" : "border-gray-200 hover:bg-gray-50"}`}>
                  {c}
                </button>
              ))}
            </div>
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={crear}>
              <Plus className="h-3 w-3" /> Nueva inversión
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded border bg-gray-50 px-3 py-2">
          <span className="text-xs text-gray-600">
            {visibles.filter(i => i.estado !== "descartada").length} inversiones previstas en {campana}
          </span>
          <span className="text-sm font-semibold text-gray-800">{pesos(total)}</span>
        </div>

        {sinJustificar > 0 && (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            <strong>{sinJustificar}</strong> sin justificar. La justificación es lo que se le explica
            a los socios cuando preguntan por qué se puso plata ahí.
          </p>
        )}

        {visibles.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">
            Todavía no hay inversiones cargadas en {campana}.
          </p>
        )}

        <div className="space-y-1.5">
          {visibles.map(inv => {
            const open = abierta === inv.id
            const centro = centros.find(c => c.id === inv.centro_costo_id)
            return (
              <div key={inv.id} className={`rounded border ${inv.estado === "descartada" ? "opacity-50" : ""}`}>
                <button type="button" onClick={() => setAbierta(open ? null : inv.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50">
                  {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                  <span className="text-sm font-medium text-gray-800">{inv.nombre}</span>
                  {centro && <Badge variant="outline" className="text-[9px]">{centro.nombre}</Badge>}
                  <Badge variant="outline" className="text-[9px] text-gray-500">{inv.estado}</Badge>
                  {!inv.justificacion?.trim() && inv.estado !== "descartada" && (
                    <span className="text-[10px] text-amber-600">sin justificar</span>
                  )}
                  <span className="ml-auto text-xs font-medium text-gray-700">
                    {pesos(inv.monto)}
                    {inv.mes && <span className="ml-1 text-gray-400">{MESES_TXT[inv.mes - 1]}</span>}
                  </span>
                </button>

                {open && (
                  <div className="space-y-3 border-t bg-slate-50 px-3 py-3">
                    <div>
                      <label className="block text-[10px] text-gray-500">
                        Nombre específico
                        <span className="ml-1 text-gray-400">no una categoría — ej. "2 silos de autoconsumo 7 Ton c/u"</span>
                      </label>
                      <Input className="h-7 text-xs" defaultValue={inv.nombre}
                        onBlur={e => guardar(inv.id, { nombre: e.target.value })} />
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                      <div className="w-44">
                        <label className="block text-[10px] text-gray-500">Centro de costo</label>
                        <select className="h-7 w-full rounded border px-1 text-xs"
                          defaultValue={inv.centro_costo_id ?? ""}
                          onChange={e => guardar(inv.id, { centro_costo_id: e.target.value || null })}>
                          <option value="">— sin asignar —</option>
                          {centros.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.nombre}{c.tipo ? ` (${c.tipo})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-32">
                        <label className="block text-[10px] text-gray-500">Monto</label>
                        <Input className="h-7 text-right text-xs" placeholder="0,00"
                          defaultValue={inv.monto != null ? fmtNumeroAR(inv.monto) : ""}
                          onBlur={e => guardar(inv.id, { monto: parseNumeroAR(e.target.value) })} />
                      </div>
                      <div className="w-24">
                        <label className="block text-[10px] text-gray-500" title="En cuántos meses se paga. Vacío o 1 = en un solo mes.">
                          Plazo (meses) <span className="text-gray-300">ⓘ</span>
                        </label>
                        <Input className="h-7 text-right text-xs" placeholder="1"
                          defaultValue={inv.plazo_meses != null ? String(inv.plazo_meses) : ""}
                          onBlur={e => guardar(inv.id, {
                            plazo_meses: e.target.value.trim() === "" ? null : Math.round(parseNumeroAR(e.target.value)),
                          })} />
                      </div>
                      <div className="w-32">
                        <label className="block text-[10px] text-gray-500">Estado</label>
                        <select className="h-7 w-full rounded border px-1 text-xs" defaultValue={inv.estado}
                          onChange={e => guardar(inv.id, { estado: e.target.value })}>
                          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-500">Mes en que arranca</label>
                      <div className="flex flex-wrap gap-0.5">
                        {MESES_TXT.map((txt, i) => {
                          const n = i + 1
                          return (
                            <button key={n} type="button"
                              onClick={() => guardar(inv.id, { mes: inv.mes === n ? null : n })}
                              className={`rounded border px-1.5 py-0.5 text-[9px] ${
                                inv.mes === n ? "border-gray-700 bg-gray-700 text-white" : "border-gray-200 hover:bg-gray-50"}`}>
                              {txt}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-gray-500">
                        Justificación — <strong>por qué se invierte en esa área</strong>
                      </label>
                      <textarea
                        className="min-h-[52px] w-full rounded border px-2 py-1 text-xs"
                        placeholder="Ej.: los silos de autoconsumo bajan el costo de ración y evitan el flete semanal en invierno."
                        defaultValue={inv.justificacion ?? ""}
                        onBlur={e => guardar(inv.id, { justificacion: e.target.value || null })} />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Input className="h-7 flex-1 text-xs" placeholder="notas (opcional)"
                        defaultValue={inv.notas ?? ""}
                        onBlur={e => guardar(inv.id, { notas: e.target.value || null })} />
                      <Button size="sm" variant="ghost" className="h-6 gap-1 text-[11px] text-red-600"
                        onClick={() => borrar(inv.id)}>
                        <Trash2 className="h-3 w-3" /> Borrar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
