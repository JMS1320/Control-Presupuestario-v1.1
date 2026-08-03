"use client"

// Presupuesto → Margen por actividad. **Fase 0: lee, no duplica.**
//
// Esta pantalla no tiene tablas propias. Arma el margen leyendo de donde el dato ya vive:
// hectáreas de `campo_campana_actividad`, cabezas y % del rodeo de `stock_ciclos`, ventas de
// `stock_lotes`, precios de `precios_hacienda` y costos de `actividad_insumos`.
//
// El objetivo de la fase no es que el margen esté completo: es **ver qué falta**. Por eso cada
// actividad muestra sus faltantes en vez de rellenar con ceros — un margen redondo sobre datos
// incompletos es peor que uno que dice qué le falta, sobre todo si se le presenta a los socios.

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Scale, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import {
  calcularMargen, pctGastoVentaPorDefecto,
  type DatosMargen, type LoteVenta, type CostoDirecto, type MargenActividad,
} from "@/lib/presupuesto/margen"

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
const numAR = (n: number, dec = 0) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })

export function PanelMargen() {
  const [cargando, setCargando] = useState(true)
  const [campana, setCampana] = useState("26/27")
  const [campanas, setCampanas] = useState<string[]>([])
  const [datos, setDatos] = useState<DatosMargen | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  /** Actividades de `centros_costo` que no tienen par en `productivo.actividades`. */
  const [desalineadas, setDesalineadas] = useState<string[]>([])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [acts, asig, ciclos, lotes, cats, precios, actProd] = await Promise.all([
        supabase.from("centros_costo").select("id, nombre").eq("tipo", "actividad").eq("activo", true),
        supabase.from("campo_campana_actividad").select("campana, centro_costo_id, has_netas"),
        supabase.schema("productivo").from("stock_ciclos").select("id, campania, vacas_apertura"),
        supabase.schema("productivo").from("stock_lotes")
          .select("categoria, cantidad, cantidad_calculada, peso_base_kg, ganancia_diaria_kg, fecha_disponible, fecha_venta_estimada, precio_kg_override, pct_desbaste, ciclo_id"),
        supabase.schema("productivo").from("categorias_hacienda").select("nombre, centro_costo_id"),
        supabase.from("precios_hacienda").select("categoria, precio_pesos_kg, anio, mes"),
        supabase.schema("productivo").from("actividades").select("nombre, activo"),
      ])

      const actPorId = new Map((acts.data || []).map((a: any) => [a.id, String(a.nombre)]))
      const nombresAct = Array.from(actPorId.values())

      // Hectáreas por actividad, de la campaña elegida.
      const hasPorActividad: Record<string, number> = {}
      const setCamp = new Set<string>()
      for (const a of ((asig.data || []) as any[])) {
        setCamp.add(String(a.campana))
        if (String(a.campana) !== campana) continue
        const n = actPorId.get(a.centro_costo_id)
        if (!n) continue
        hasPorActividad[n] = (hasPorActividad[n] ?? 0) + (Number(a.has_netas) || 0)
      }
      setCampanas(Array.from(setCamp).sort())

      // La categoría dice a qué actividad va cada lote.
      const actDeCategoria = new Map(
        ((cats.data || []) as any[]).map(c => [String(c.nombre), actPorId.get(c.centro_costo_id) ?? null]))
      const campDeCiclo = new Map(((ciclos.data || []) as any[]).map(c => [c.id, String(c.campania)]))

      const lotesOut: LoteVenta[] = ((lotes.data || []) as any[]).map(l => ({
        categoria: String(l.categoria),
        cabezas: Number(l.cantidad_calculada ?? l.cantidad) || 0,
        peso_base_kg: Number(l.peso_base_kg) || 0,
        ganancia_diaria_kg: Number(l.ganancia_diaria_kg) || 0,
        fecha_disponible: l.fecha_disponible, fecha_venta_estimada: l.fecha_venta_estimada,
        precio_kg_override: l.precio_kg_override == null ? null : Number(l.precio_kg_override),
        pct_desbaste: Number(l.pct_desbaste) || 0,
        campania: campDeCiclo.get(l.ciclo_id) ?? null,
        actividad: actDeCategoria.get(String(l.categoria)) ?? null,
      }))

      // Precio más reciente por categoría.
      const preciosPorCategoria: Record<string, number> = {}
      const km = (p: any) => (Number(p.anio) || 0) * 12 + (Number(p.mes) || 0)
      for (const p of ((precios.data || []) as any[]).sort((a, b) => km(a) - km(b))) {
        preciosPorCategoria[String(p.categoria)] = Number(p.precio_pesos_kg) || 0
      }

      // ⚠️ Dos maestros de actividad conviviendo: `centros_costo` (el que usa el presupuesto) y
      // `productivo.actividades` (el que tiene la ración). Se compara por nombre y se avisa,
      // en vez de emparejarlos en silencio.
      const nombresProd = ((actProd.data || []) as any[])
        .filter(a => a.activo).map(a => String(a.nombre).toLowerCase())
      setDesalineadas(nombresAct.filter(n => !nombresProd.includes(n.toLowerCase())))

      // Fase 0: los costos directos todavía no se resuelven a pesos —hace falta la ración y los
      // tramos—, así que se listan como faltantes en vez de inventar un monto.
      const costos: CostoDirecto[] = nombresAct
        .filter(n => !nombresProd.includes(n.toLowerCase()))
        .map(n => ({
          actividad: n, concepto: "Costos directos", monto: null,
          motivo: `la actividad "${n}" no existe en Productivo, así que no tiene insumos cargados`,
        }))

      setDatos({
        campana, hasPorActividad, lotes: lotesOut, costos,
        preciosPorCategoria, pctGastoVenta: pctGastoVentaPorDefecto,
      })
    } finally { setCargando(false) }
  }, [campana])

  useEffect(() => { cargar() }, [cargar])

  const margenes: MargenActividad[] = useMemo(
    () => (datos ? calcularMargen(datos) : []), [datos])

  if (cargando || !datos) {
    return (
      <Card><CardContent className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Armando el margen…
      </CardContent></Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" /> Margen por actividad
              <Badge variant="outline" className="border-orange-300 text-[9px] text-orange-700">
                Fase 0 — lee, no duplica
              </Badge>
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              Sin tablas propias: lee hectáreas, rodeo, ventas, precios y costos de donde ya viven.
              <strong> En pesos</strong>, por unidad y en total.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Campaña</span>
            {campanas.map(c => (
              <button key={c} type="button" onClick={() => setCampana(c)}
                className={`rounded border px-2 py-0.5 text-xs ${
                  campana === c ? "border-gray-700 bg-gray-700 text-white" : "border-gray-200 hover:bg-gray-50"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {desalineadas.length > 0 && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            <strong>Dos maestros de actividad conviviendo.</strong> Estas existen en el presupuesto
            pero no en Productivo, así que no tienen costos: <strong>{desalineadas.join(" · ")}</strong>.
            Es lo que hay que resolver en la Fase 1.
          </div>
        )}

        {margenes.map(m => {
          const open = abierta === m.actividad
          return (
            <div key={m.actividad} className="rounded border">
              <button type="button" onClick={() => setAbierta(open ? null : m.actividad)}
                className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-gray-50">
                {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                <span className="text-sm font-medium text-gray-800">{m.actividad}</span>
                {m.has != null && (
                  <Badge variant="outline" className="text-[9px]">{numAR(m.has)} ha</Badge>
                )}
                {m.cabezas != null && (
                  <Badge variant="outline" className="text-[9px]">{numAR(m.cabezas)} cab</Badge>
                )}
                {m.faltantes.length > 0 && (
                  <span className="text-[10px] text-amber-600">
                    {m.faltantes.length} {m.faltantes.length === 1 ? "faltante" : "faltantes"}
                  </span>
                )}
                <span className="ml-auto text-right">
                  <span className="block text-xs font-semibold text-gray-800">
                    {pesos(m.margenBruto)}
                  </span>
                  {m.margenPorHa != null && (
                    <span className="block text-[10px] text-gray-500">
                      {pesos(m.margenPorHa)} / ha
                    </span>
                  )}
                </span>
              </button>

              {open && (
                <div className="space-y-2 border-t bg-slate-50 px-3 py-3">
                  {m.faltantes.length > 0 && (
                    <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
                      <p className="text-[11px] font-medium text-amber-900">Para que este margen sea confiable falta:</p>
                      <ul className="mt-0.5 space-y-0.5 text-[10px] text-amber-800">
                        {m.faltantes.map((f, i) => <li key={i}>· {f}</li>)}
                      </ul>
                    </div>
                  )}

                  <Bloque titulo="Ingresos" lineas={m.ingresos} total={m.totalIngresos} has={m.has} />
                  <Bloque titulo="Costos directos" lineas={m.costos} total={m.totalCostos} has={m.has} />

                  <div className="flex items-center justify-between rounded border bg-white px-2 py-1.5">
                    <span className="text-[11px] font-semibold text-gray-800">MARGEN BRUTO</span>
                    <span className="text-right">
                      <span className="block text-[11px] font-semibold text-gray-800">{pesos(m.margenBruto)}</span>
                      {m.margenPorHa != null && (
                        <span className="block text-[10px] text-gray-500">{pesos(m.margenPorHa)} / ha</span>
                      )}
                      {m.cabezas ? (
                        <span className="block text-[10px] text-gray-500">
                          {pesos(m.margenBruto / m.cabezas)} / cabeza
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {margenes.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">
            No hay nada cargado para {campana}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** Un bloque del margen, con el doble formato: por unidad y total. */
function Bloque({ titulo, lineas, total, has }: {
  titulo: string; lineas: MargenActividad["ingresos"]; total: number; has: number | null
}) {
  if (lineas.length === 0) {
    return (
      <div className="rounded border bg-white px-2 py-1.5">
        <p className="text-[11px] font-medium text-gray-700">{titulo}</p>
        <p className="text-[10px] text-gray-400">sin datos cargados</p>
      </div>
    )
  }
  return (
    <div className="rounded border bg-white px-2 py-1.5">
      <p className="mb-1 text-[11px] font-medium text-gray-700">{titulo}</p>
      <div className="space-y-0.5">
        {lineas.map((l, i) => (
          <div key={i} className={`flex items-baseline justify-between gap-2 ${l.confiable ? "" : "opacity-60"}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] text-gray-700">
                {l.concepto}
                {!l.confiable && <span className="ml-1 text-[9px] text-amber-600">sin calcular</span>}
              </p>
              <p className="truncate text-[9px] text-gray-400">{l.detalle}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className="block text-[11px] text-gray-800">{pesos(l.total)}</span>
              {l.porCabeza != null && (
                <span className="block text-[9px] text-gray-400">{pesos(l.porCabeza)} / cab</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-between border-t pt-1">
        <span className="text-[11px] font-medium text-gray-700">Total {titulo.toLowerCase()}</span>
        <span className="text-right">
          <span className="block text-[11px] font-semibold text-gray-800">{pesos(total)}</span>
          {has ? <span className="block text-[9px] text-gray-500">{pesos(total / has)} / ha</span> : null}
        </span>
      </div>
    </div>
  )
}
