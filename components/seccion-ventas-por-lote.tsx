"use client"

// VENTAS → Ganadería · las ventas POR LOTE (recría y engorde).
//
// ── Por qué existe ───────────────────────────────────────────────────────────
// El usuario cargó una venta de recría y no la encontraba: *"en ingresos / ganadería tenemos las
// ventas presupuestadas; hasta ahora sólo están las de cría… aquí debería estar esta de recría
// también"*. La venta **estaba cargada** —en `productivo.stock_lotes`— pero esta pantalla miraba
// sólo `presupuesto_ganaderia`.
//
// ── Dos formas de proyectar una venta, y las dos son correctas ───────────────
//   · **Cría** → paramétrica: vientres × % destete × peso × precio. Los animales todavía no
//     existen, así que se proyectan por porcentajes.
//   · **Recría / engorde** → por lote: *estos* 55 animales de 275 kg. Los animales ya existen y
//     tienen caravana.
//
// **No se unifican a propósito.** Fusionarlas obligaría a describir la cría como si sus terneros
// ya existieran, o la recría como un porcentaje de algo. El usuario ya avisó del riesgo de
// "crear lugares nuevos para las mismas cosas": acá no se crea nada — se LEE lo que ya está.
//
// ── Detalle que sorprende ────────────────────────────────────────────────────
// La venta por lote está **mejor descripta** que la paramétrica: `presupuesto_ganaderia` no tiene
// desbaste, CZ ni plazo de cobro; el lote tiene los tres.

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Package, AlertTriangle } from "lucide-react"

interface LoteVentaPresupuestada {
  id: string
  empresa: string
  categoria: string
  cantidad: number
  peso_base_kg: number
  fecha_venta_estimada: string | null
  precio_kg_override: number | null
  pct_desbaste: number
  pct_cz: number
  plazo_cobro: string | null
  alicuota_iva: number | null
  alicuota_iibb: number | null
  notas: string | null
  /** De qué ciclo de recría cuelga. NULL = todavía suelto. */
  ciclo: string | null
  actividad: string | null
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
const kg = (n: number) => `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })} kg`
const pc = (n: number) => `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })} %`
const fecha = (f: string | null) => (f ? f.split("-").reverse().join("/") : "—")

export function SeccionVentasPorLote() {
  const [cargando, setCargando] = useState(true)
  const [lotes, setLotes] = useState<LoteVentaPresupuestada[]>([])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const p = supabase.schema("productivo")
      const [{ data: ls }, { data: crs }, { data: cats }] = await Promise.all([
        p.from("stock_lotes")
          .select("id, empresa, categoria, cantidad, cantidad_calculada, peso_base_kg, fecha_venta_estimada, precio_kg_override, pct_desbaste, pct_cz, plazo_cobro, alicuota_iva, alicuota_iibb, notas, ciclo_recria_id")
          .not("fecha_venta_estimada", "is", null)
          .order("fecha_venta_estimada"),
        p.from("ciclos_recria").select("id, campania"),
        p.from("categorias_hacienda").select("nombre, centro_costo_id"),
      ])
      const { data: ccs } = await supabase.from("centros_costo").select("id, nombre")

      const cicloPorId = new Map(((crs || []) as any[]).map(c => [c.id, String(c.campania)]))
      const ccPorId = new Map(((ccs || []) as any[]).map(c => [c.id, String(c.nombre)]))
      const actPorCat = new Map(((cats || []) as any[]).map(
        c => [String(c.nombre), ccPorId.get(c.centro_costo_id) ?? null]))

      const n = (x: any) => (x == null ? null : Number(x))
      setLotes(((ls || []) as any[]).map(l => ({
        id: l.id, empresa: String(l.empresa ?? "MSA"), categoria: String(l.categoria),
        cantidad: Number(l.cantidad_calculada ?? l.cantidad) || 0,
        peso_base_kg: Number(l.peso_base_kg) || 0,
        fecha_venta_estimada: l.fecha_venta_estimada,
        precio_kg_override: n(l.precio_kg_override),
        pct_desbaste: Number(l.pct_desbaste) || 0,
        pct_cz: Number(l.pct_cz) || 0,
        plazo_cobro: l.plazo_cobro,
        alicuota_iva: n(l.alicuota_iva), alicuota_iibb: n(l.alicuota_iibb),
        notas: l.notas,
        ciclo: l.ciclo_recria_id ? cicloPorId.get(l.ciclo_recria_id) ?? null : null,
        actividad: actPorCat.get(String(l.categoria)) ?? null,
      })))
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (cargando) {
    return (
      <Card><CardContent className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leyendo ventas por lote…
      </CardContent></Card>
    )
  }

  if (lotes.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4" /> Ventas por lote — recría y engorde
        </CardTitle>
        <p className="mt-1 text-xs text-gray-500">
          Se cargan en <strong>Productivo → Lotes</strong> y se ven acá. A diferencia de la venta
          de destete —que se proyecta por porcentajes porque los animales todavía no existen—
          acá son <strong>animales concretos</strong>, con su peso y sus condiciones ya pactadas.
        </p>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b bg-gray-50 text-[9px] uppercase text-gray-500">
                <th className="px-2 py-1 text-left font-medium">Categoría</th>
                <th className="px-2 py-1 text-right font-medium">Cab</th>
                <th className="px-2 py-1 text-right font-medium">Peso</th>
                <th className="px-2 py-1 text-right font-medium">Desb.</th>
                <th className="px-2 py-1 text-right font-medium">Kg netos</th>
                <th className="px-2 py-1 text-right font-medium">$/kg</th>
                <th className="px-2 py-1 text-right font-medium">CZ</th>
                <th className="px-2 py-1 text-right font-medium">Neto</th>
                <th className="px-2 py-1 text-left font-medium">Venta</th>
                <th className="px-2 py-1 text-left font-medium">Plazo</th>
                <th className="px-2 py-1 text-left font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map(l => {
                // Las condiciones son LAS DEL LOTE, no las de la tabla de normas: acá ya están
                // pactadas para esta venta puntual. Las normas sirven para proponerlas, no para
                // pisarlas después.
                const kgNetos = l.cantidad * l.peso_base_kg * (1 - l.pct_desbaste)
                const bruto = l.precio_kg_override != null ? kgNetos * l.precio_kg_override : null
                const neto = bruto != null ? bruto * (1 - l.pct_cz) : null
                return (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-2 py-1 text-gray-700">
                      {l.categoria}
                      {l.actividad && (
                        <span className="ml-1 text-[9px] text-gray-400">{l.actividad}</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-800">{l.cantidad}</td>
                    <td className="px-2 py-1 text-right text-gray-500">{kg(l.peso_base_kg)}</td>
                    <td className="px-2 py-1 text-right text-gray-500">{pc(l.pct_desbaste)}</td>
                    <td className="px-2 py-1 text-right text-gray-600">{kg(kgNetos)}</td>
                    <td className="px-2 py-1 text-right text-gray-600">
                      {l.precio_kg_override != null ? pesos(l.precio_kg_override) : "—"}
                    </td>
                    <td className="px-2 py-1 text-right text-gray-500">{pc(l.pct_cz)}</td>
                    <td className="px-2 py-1 text-right font-medium text-gray-800">
                      {neto != null ? pesos(neto) : (
                        <span className="text-amber-600" title="Sin precio no se puede valuar">
                          falta precio
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-gray-600">{fecha(l.fecha_venta_estimada)}</td>
                    <td className="px-2 py-1 text-gray-500">{l.plazo_cobro || "—"}</td>
                    <td className="px-2 py-1">
                      <Badge variant="outline" className="border-blue-300 text-[9px] text-blue-700">
                        presupuestada
                      </Badge>
                      {l.ciclo && (
                        <span className="ml-1 text-[9px] text-gray-400">ciclo {l.ciclo}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-gray-50 font-medium">
                <td className="px-2 py-1 text-gray-700">Total</td>
                <td className="px-2 py-1 text-right text-gray-800">
                  {lotes.reduce((s, l) => s + l.cantidad, 0)}
                </td>
                <td colSpan={5} />
                <td className="px-2 py-1 text-right text-gray-800">
                  {pesos(lotes.reduce((s, l) => {
                    const kgN = l.cantidad * l.peso_base_kg * (1 - l.pct_desbaste)
                    return s + (l.precio_kg_override != null
                      ? kgN * l.precio_kg_override * (1 - l.pct_cz) : 0)
                  }, 0))}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Los lotes sin ciclo no tienen campaña, y sin campaña el presupuesto no sabe a qué
            año mandarlos. */}
        {lotes.some(l => !l.ciclo) && (
          <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            Hay lotes <strong>sin ciclo asignado</strong>. Sin ciclo no tienen campaña, y el
            presupuesto no sabe a qué año imputarlos.
          </p>
        )}

        <p className="text-[10px] leading-tight text-gray-400">
          <strong>Presupuestada</strong> = todavía no se ejecutó. El estado avanza sobre el
          <strong> mismo registro</strong> —afinada → ejecutada → fijada con la factura—, sin
          duplicarlo en otra tabla.
        </p>
      </CardContent>
    </Card>
  )
}
