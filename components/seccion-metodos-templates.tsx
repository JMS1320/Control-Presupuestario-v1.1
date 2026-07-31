"use client"

// Con qué método el presupuesto completa los meses donde un template no tiene cuota cargada.
//
// Vive dentro del panel "Cuentas contables" porque el usuario piensa las dos cosas juntas:
// cómo se llenan las cuentas y cómo se llenan los templates.
//
// El método se HEREDA de `egresos_sin_factura.cuotas` (número de cuotas al año, ya cargado en
// 64 de 66 templates). Esta pantalla existe para las excepciones: ver qué se heredó y
// cambiarlo cuando no corresponde. La jerarquía completa está en `lib/presupuesto/templates.ts`.

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Wand2, AlertTriangle } from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import type { PuntoSerie } from "@/lib/precios/serie"
import {
  proyectarTemplate, ETIQUETA_METODO,
  type MetodoTemplate, type TemplateInfo, type CuotaMes, type ConfigTemplate,
  type MetodoResuelto, type CeldaTemplate,
} from "@/lib/presupuesto/templates"

const METODOS = Object.keys(ETIQUETA_METODO) as MetodoTemplate[]
const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`

interface Fila {
  info: TemplateInfo
  agrupador: string
  metodo: MetodoResuelto
  celdas: CeldaTemplate[]
  avisoCuotas: string | null
  mesesProyectados: number
  montoProyectado: number
  mesesConCuota: number
  cfg: ConfigTemplate | undefined
}

export function SeccionMetodosTemplates({ meses, ipc }: {
  meses: { anio: number; mes: number }[]
  ipc: PuntoSerie[]
}) {
  const [cargando, setCargando] = useState(true)
  const [templates, setTemplates] = useState<any[]>([])
  const [historia, setHistoria] = useState<Record<string, CuotaMes[]>>({})
  const [cfgs, setCfgs] = useState<Record<string, ConfigTemplate>>({})
  const [soloProyectados, setSoloProyectados] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const { data: tpl, error } = await supabase
        .from("egresos_sin_factura")
        .select("id, nombre_referencia, cuenta_agrupadora, cuotas, tipo_recurrencia, periodicidad, aplica_generacion")
        .eq("activo", true)
        .or("responsable.ilike.%MSA%,responsable.eq.ambas")
        .not("cuenta_agrupadora", "is", null)
      if (error) { alert("Error: " + error.message); return }
      setTemplates((tpl || []) as any[])

      const ids = ((tpl || []) as any[]).map(t => t.id)
      const [{ data: cuotas }, { data: conf }] = await Promise.all([
        ids.length
          ? supabase.from("cuotas_egresos_sin_factura")
              .select("egreso_id, fecha_estimada, fecha_vencimiento, monto")
              .in("egreso_id", ids).neq("estado", "desactivado")
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("presupuesto_template_config")
          .select("template_id, metodo, monto_manual").eq("empresa", "MSA"),
      ])

      const h: Record<string, CuotaMes[]> = {}
      for (const c of ((cuotas || []) as any[])) {
        const fecha = c.fecha_estimada || c.fecha_vencimiento
        if (!fecha) continue
        ;(h[c.egreso_id] ??= []).push({
          egreso_id: c.egreso_id, mes: String(fecha).slice(0, 7), monto: Number(c.monto) || 0,
        })
      }
      setHistoria(h)

      const m: Record<string, ConfigTemplate> = {}
      for (const c of ((conf || []) as any[])) {
        m[String(c.template_id)] = {
          metodo: c.metodo, monto_manual: c.monto_manual == null ? null : Number(c.monto_manual),
        }
      }
      setCfgs(m)
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filas: Fila[] = useMemo(() => {
    return templates.map(t => {
      const info: TemplateInfo = {
        id: t.id, nombre: t.nombre_referencia,
        cuotas: t.cuotas ?? null,
        tipo_recurrencia: t.tipo_recurrencia ?? null,
        periodicidad: t.periodicidad ?? null,
        aplica_generacion: t.aplica_generacion ?? null,
      }
      const hist = historia[t.id] || []
      const r = proyectarTemplate(info, hist, meses, { ipc, config: cfgs[t.id] })
      const proyectadas = r.celdas.filter(c => c.origen === "proyectado" && c.monto !== 0)
      return {
        info, agrupador: t.cuenta_agrupadora || "Sin agrupador",
        metodo: r.metodo, celdas: r.celdas, avisoCuotas: r.avisoCuotas,
        mesesProyectados: proyectadas.length,
        montoProyectado: proyectadas.reduce((s, c) => s + c.monto, 0),
        mesesConCuota: r.celdas.filter(c => c.origen === "cuota").length,
        cfg: cfgs[t.id],
      }
    }).sort((a, b) => b.montoProyectado - a.montoProyectado)
  }, [templates, historia, cfgs, meses, ipc])

  const visibles = soloProyectados ? filas.filter(f => f.mesesProyectados > 0) : filas
  const totalProyectado = filas.reduce((s, f) => s + f.montoProyectado, 0)
  const conAviso = filas.filter(f => f.avisoCuotas).length

  const guardar = async (id: string, cambios: Partial<ConfigTemplate>) => {
    const base = cfgs[id] ?? { metodo: filas.find(f => f.info.id === id)!.metodo.metodo }
    const v = { ...base, ...cambios }
    setCfgs(prev => ({ ...prev, [id]: v }))
    const { error } = await supabase.from("presupuesto_template_config").upsert({
      empresa: "MSA", template_id: id, metodo: v.metodo,
      monto_manual: v.monto_manual ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: "empresa,template_id" })
    if (error) { alert("Error: " + error.message); await cargar() }
  }

  const volverAuto = async (id: string) => {
    setCfgs(prev => { const n = { ...prev }; delete n[id]; return n })
    await supabase.from("presupuesto_template_config")
      .delete().eq("empresa", "MSA").eq("template_id", id)
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-6 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando templates…
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-gray-800">🧾 Cómo se completan los templates</h3>
          <p className="text-xs text-gray-500">
            Donde hay cuota cargada manda la cuota. Estos son los meses que el presupuesto
            completa solo — <strong>{pesos(totalProyectado)}</strong> en total.
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={soloProyectados} className="h-3.5 w-3.5"
            onChange={e => setSoloProyectados(e.target.checked)} />
          sólo los que se proyectan
        </label>
      </div>

      {conAviso > 0 && (
        <p className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          <strong>{conAviso}</strong> {conAviso === 1 ? "template declara" : "templates declaran"} más
          cuotas de las que hay cargadas. Se proyectan las conocidas, así que el presupuesto
          puede estar corto — mirá el ⚠ de cada fila.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-gray-50 text-[10px] text-gray-500">
              <th className="px-2 py-1.5 text-left font-medium">Template</th>
              <th className="px-2 py-1.5 text-right font-medium" title="Cuotas al año que declara el template">Declara</th>
              <th className="px-2 py-1.5 text-right font-medium">Con cuota</th>
              <th className="px-2 py-1.5 text-left font-medium">Método</th>
              <th className="px-2 py-1.5 text-right font-medium">Proyecta</th>
              <th className="px-2 py-1.5 text-right font-medium">Monto</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {visibles.map(f => (
              <tr key={f.info.id} className="border-b hover:bg-gray-50">
                <td className="px-2 py-1.5">
                  <span className="text-gray-700">{f.info.nombre}</span>
                  <span className="ml-1.5 text-[10px] text-gray-400">{f.agrupador}</span>
                  {f.info.aplica_generacion === true && (
                    <Badge variant="outline" className="ml-1 border-amber-200 text-[9px] text-amber-700">
                      se carga a mano
                    </Badge>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right text-gray-500">
                  {f.info.tipo_recurrencia === "abierto"
                    ? <span title="Gasto abierto: sin periodicidad fija">abierto</span>
                    : f.info.cuotas == null ? "—" : f.info.cuotas}
                </td>
                <td className="px-2 py-1.5 text-right text-gray-500">{f.mesesConCuota}</td>
                <td className="px-2 py-1.5">
                  <select className="h-6 w-full min-w-[13rem] rounded border border-gray-200 px-1 text-[11px]"
                    value={f.metodo.metodo}
                    onChange={e => guardar(f.info.id, { metodo: e.target.value as MetodoTemplate })}>
                    {METODOS.map(m => <option key={m} value={m}>{ETIQUETA_METODO[m]}</option>)}
                  </select>
                  <p className={`mt-0.5 text-[10px] ${f.metodo.manual ? "text-blue-600" : "text-gray-400"}`}
                    title={f.metodo.motivo}>
                    {f.metodo.manual ? "elegido a mano" : `auto — ${f.metodo.motivo}`}
                  </p>
                  {f.metodo.metodo === "manual" && (
                    <Input className="mt-1 h-6 w-28 text-right text-[11px]"
                      defaultValue={fmtNumeroAR(f.cfg?.monto_manual ?? 0)}
                      onBlur={e => guardar(f.info.id, { monto_manual: parseNumeroAR(e.target.value) })} />
                  )}
                </td>
                <td className="px-2 py-1.5 text-right text-gray-500">
                  {f.mesesProyectados > 0 ? `${f.mesesProyectados} meses` : "—"}
                </td>
                <td className="px-2 py-1.5 text-right text-gray-700">
                  {f.montoProyectado > 0 ? pesos(f.montoProyectado) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {f.avisoCuotas && (
                    <span title={f.avisoCuotas} className="mr-1 cursor-help text-amber-500">⚠</span>
                  )}
                  {f.metodo.manual && (
                    <button type="button" className="text-blue-600" title="Volver al automático"
                      onClick={() => volverAuto(f.info.id)}>
                      <Wand2 className="h-3 w-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-gray-500">
        <strong>Declara</strong> son las cuotas al año que tiene cargado el template
        (<code>cuotas</code>), y de ahí sale el método automático: 12 → todos los meses ·
        1 a 11 → esas cuotas, en los meses que muestra la historia · 0 o abierto → promedio.
        Cambiarlo acá pisa lo heredado; el <Wand2 className="inline h-3 w-3" /> lo devuelve.
      </p>
    </div>
  )
}
