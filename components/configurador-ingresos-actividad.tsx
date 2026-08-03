"use client"

// Presupuesto → Ingresos por actividad.
//
// El eslabón que faltaba para el margen. Los costos ya se agrupan por actividad; los ingresos no
// decían de cuál eran, así que un margen no podía cerrar.
//
// La pantalla no pide cargar: pide CONFIRMAR. Casi todo se deriva de lo que ya está —el grano, la
// cuenta contable, la categoría de hacienda— y cada sugerencia viene con su motivo a la vista. Lo
// que no se puede derivar se dice, no se adivina: repartir plata entre actividades por una
// corazonada es peor que dejarla sin clasificar.

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, PieChart, AlertTriangle, CheckCircle2 } from "lucide-react"
import { fmtNumeroAR } from "@/lib/format/numero"
import {
  actividadDeVenta, actividadDeHacienda, resumenCobertura,
  type ActividadRef, type OrigenActividad,
} from "@/lib/presupuesto/ingresos-actividad"

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`

interface Venta {
  id: string; fecha_liquidacion: string | null; nro_comprobante: string | null
  grano: string | null; cuenta_contable: string | null; centro_costo: string | null
  imp_total: number | null; centro_costo_id: string | null
}
interface MovHacienda {
  id: string; fecha: string | null; tipo: string | null; cantidad: number | null
  monto_total: number | null; centro_costo_id: string | null
  categoria_nombre: string | null; categoria_centro_costo_id: string | null
}
interface CategoriaHacienda { id: string; nombre: string; centro_costo_id: string | null }

export function ConfiguradorIngresosActividad({ onCambio }: { onCambio?: () => void } = {}) {
  const [cargando, setCargando] = useState(true)
  const [actividades, setActividades] = useState<ActividadRef[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [hacienda, setHacienda] = useState<MovHacienda[]>([])
  const [categorias, setCategorias] = useState<CategoriaHacienda[]>([])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [act, cat] = await Promise.all([
        supabase.from("centros_costo").select("id, nombre").eq("tipo", "actividad").eq("activo", true).order("nombre"),
        supabase.schema("productivo").from("categorias_hacienda")
          .select("id, nombre, centro_costo_id").order("nombre"),
      ])
      setActividades((act.data || []) as ActividadRef[])
      setCategorias((cat.data || []) as CategoriaHacienda[])

      const { data: vs } = await supabase.schema("msa").from("comprobantes_venta")
        .select("id, fecha_liquidacion, nro_comprobante, grano, cuenta_contable, centro_costo, imp_total, centro_costo_id")
        .order("fecha_liquidacion", { ascending: false })
      setVentas(((vs || []) as any[]).map(v => ({ ...v, imp_total: Number(v.imp_total) || 0 })))

      const { data: mh } = await supabase.schema("productivo").from("movimientos_hacienda")
        .select("id, fecha, tipo, cantidad, monto_total, centro_costo_id, categoria_id")
        .order("fecha", { ascending: false })
      const porId = new Map((cat.data || []).map((c: any) => [c.id, c]))
      setHacienda(((mh || []) as any[]).map(m => {
        const c = porId.get(m.categoria_id) as any
        return {
          id: String(m.id), fecha: m.fecha, tipo: m.tipo,
          cantidad: m.cantidad == null ? null : Number(m.cantidad),
          monto_total: Number(m.monto_total) || 0,
          centro_costo_id: m.centro_costo_id,
          categoria_nombre: c?.nombre ?? null,
          categoria_centro_costo_id: c?.centro_costo_id ?? null,
        }
      }))
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const guardarCategoria = async (id: string, centroCostoId: string | null) => {
    await supabase.schema("productivo").from("categorias_hacienda")
      .update({ centro_costo_id: centroCostoId }).eq("id", id)
    await cargar(); onCambio?.()
  }
  const guardarVenta = async (id: string, centroCostoId: string | null) => {
    await supabase.schema("msa").from("comprobantes_venta")
      .update({ centro_costo_id: centroCostoId }).eq("id", id)
    await cargar(); onCambio?.()
  }
  const guardarHacienda = async (id: string, centroCostoId: string | null) => {
    await supabase.schema("productivo").from("movimientos_hacienda")
      .update({ centro_costo_id: centroCostoId }).eq("id", id)
    await cargar(); onCambio?.()
  }

  const filas = useMemo(() => {
    const v = ventas.map(x => ({
      tipo: "Venta" as const, id: x.id,
      etiqueta: x.nro_comprobante || x.cuenta_contable || x.grano || "(sin identificar)",
      detalle: [x.grano, x.cuenta_contable, x.fecha_liquidacion].filter(Boolean).join(" · "),
      monto: x.imp_total ?? 0,
      origen: actividadDeVenta(x, actividades),
      guardar: (cc: string | null) => guardarVenta(x.id, cc),
      asignadaAMano: !!x.centro_costo_id,
    }))
    const h = hacienda.map(x => ({
      tipo: "Hacienda" as const, id: x.id,
      etiqueta: `${x.tipo ?? "mov"} · ${x.categoria_nombre ?? "sin categoría"}`,
      detalle: [x.cantidad ? `${x.cantidad} cab` : null, x.fecha].filter(Boolean).join(" · "),
      monto: x.monto_total ?? 0,
      origen: actividadDeHacienda(x, actividades),
      guardar: (cc: string | null) => guardarHacienda(x.id, cc),
      asignadaAMano: !!x.centro_costo_id,
    }))
    return [...v, ...h].sort((a, b) => b.monto - a.monto)
  }, [ventas, hacienda, actividades])

  const cobertura = useMemo(() => resumenCobertura(filas), [filas])

  const porActividad = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of filas) {
      const k = f.origen.nombre ?? "— sin clasificar —"
      m.set(k, (m.get(k) ?? 0) + f.monto)
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [filas])

  const catsSinActividad = categorias.filter(c => !c.centro_costo_id)

  if (cargando) {
    return (
      <Card><CardContent className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leyendo ingresos…
      </CardContent></Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PieChart className="h-4 w-4" /> Ingresos por actividad
        </CardTitle>
        <p className="mt-1 text-xs text-gray-500">
          A qué actividad pertenece cada ingreso. Casi todo <strong>se deriva</strong> del grano, la
          cuenta o la categoría — acá se confirma y se corrige lo que no acertó. Es lo que permite
          que el margen cierre.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Cobertura: cuánto quedó sin clasificar */}
        {cobertura.sinResolver > 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
            <strong>{pesos(cobertura.sinResolver)}</strong> sin clasificar
            {" "}({fmtNumeroAR(cobertura.pctSinResolver, 0)} % de {pesos(cobertura.total)}).
            Un margen calculado sobre esto reparte mal.
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Todos los ingresos tienen actividad.
          </div>
        )}

        {/* El mapeo de categorías: se carga una vez y sirve para todos los movimientos */}
        <details className="rounded border" open={catsSinActividad.length > 0}>
          <summary className="cursor-pointer px-3 py-1.5 text-[11px] font-medium text-gray-700">
            Categorías de hacienda → actividad
            {catsSinActividad.length > 0 && (
              <span className="ml-1 text-amber-600">· {catsSinActividad.length} sin asignar</span>
            )}
          </summary>
          <div className="grid gap-1 px-3 pb-2 sm:grid-cols-2 lg:grid-cols-3">
            {categorias.map(c => (
              <div key={c.id} className="flex items-center gap-1.5">
                <span className="flex-1 text-[10px] text-gray-600">{c.nombre}</span>
                <select className="h-6 w-28 rounded border px-1 text-[10px]"
                  defaultValue={c.centro_costo_id ?? ""}
                  onChange={e => guardarCategoria(c.id, e.target.value || null)}>
                  <option value="">— sin asignar —</option>
                  {actividades.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
            ))}
          </div>
        </details>

        {/* Resumen por actividad */}
        <div className="rounded border bg-gray-50 px-3 py-2">
          <p className="mb-1 text-[11px] font-medium text-gray-700">Ingresos por actividad</p>
          <div className="space-y-0.5">
            {porActividad.map(([act, monto]) => (
              <div key={act} className="flex items-center justify-between text-[11px]">
                <span className={act.startsWith("—") ? "text-amber-700" : "text-gray-700"}>{act}</span>
                <span className="font-medium text-gray-800">{pesos(monto)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* El detalle, con el motivo de cada clasificación a la vista */}
        <div className="space-y-1">
          {filas.map(f => (
            <div key={`${f.tipo}-${f.id}`}
              className={`flex flex-wrap items-center gap-2 rounded border px-2 py-1.5 ${
                f.origen.fuente === "sin_resolver" ? "border-amber-200 bg-amber-50/40" : ""}`}>
              <Badge variant="outline" className="text-[9px] text-gray-500">{f.tipo}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] text-gray-800">{f.etiqueta}</p>
                <p className="truncate text-[10px] text-gray-400">{f.detalle}</p>
              </div>
              <span className="text-[11px] font-medium text-gray-700">{pesos(f.monto)}</span>
              <div className="flex items-center gap-1">
                <select className="h-6 w-32 rounded border px-1 text-[10px]"
                  value={f.origen.centroCostoId ?? ""}
                  onChange={e => f.guardar(e.target.value || null)}>
                  <option value="">— sin clasificar —</option>
                  {actividades.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
                {/* El motivo a la vista: si el margen sale raro hay que poder preguntar
                    "¿por qué esta venta cayó acá?" y que haya respuesta. */}
                <span className={`w-44 truncate text-[9px] ${
                  f.origen.fuente === "manual" ? "text-blue-600"
                    : f.origen.fuente === "sin_resolver" ? "text-amber-700" : "text-gray-400"}`}
                  title={f.origen.motivo}>
                  {f.origen.motivo}
                </span>
              </div>
            </div>
          ))}
          {filas.length === 0 && (
            <p className="py-6 text-center text-xs text-gray-400">No hay ingresos cargados.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
