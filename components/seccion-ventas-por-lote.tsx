"use client"

// VENTAS → Ganadería · las ventas de hacienda, **separadas por actividad**.
//
// ── Por qué existe ───────────────────────────────────────────────────────────
// El usuario cargó una venta de recría y no la encontraba: *"en ingresos / ganadería tenemos las
// ventas presupuestadas… aquí debería estar esta de recría también"*. La venta **estaba cargada**
// —en los lotes de *Sector Productivo → Evolución Rodeo*— pero esta pantalla miraba sólo la
// proyección paramétrica de destete.
//
// ── ⚠️ Usa las MISMAS funciones que el presupuesto ───────────────────────────
// `valuarLoteConPrecios()` es, según su propio comentario, *"la función que usan tanto Productivo
// como Presupuesto, para que den lo mismo"*. Y `disponiblePorDiferencia()` es la que calcula lo
// que existe y todavía no tiene venta.
//
// La primera versión de esta pantalla calculaba por su cuenta —`cabezas × peso × precio_override`—
// y mostraba **"falta precio"** en lotes que el presupuesto sí valúa: el precio no está en el
// lote, está en la **tabla de precios por banda de peso** (*Presupuesto → Precios y TC*). Dos
// pantallas calculando lo mismo por caminos distintos es exactamente lo que hay que evitar.
//
// ── Las dos capas, igual que en el presupuesto ───────────────────────────────
//   1. **Presupuestadas** — lotes con fecha de venta, ya valuados.
//   2. **Sin venta presupuestada** — lo que existe y nadie decidió cuándo vender, por diferencia
//      contra la pesada viva. No es un faltante: es una decisión que no se tomó todavía.

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Package, AlertTriangle } from "lucide-react"
import { curvaDeLote, type TramoLote, type LoteCurva } from "@/lib/productivo/tramos"
import {
  valuarLoteConPrecios, calcularLineaTiempo,
  type LoteStock, type VentaStock,
} from "@/lib/ganaderia/ciclo"
import type { PrecioHacienda } from "@/lib/ganaderia/calculo"
import type { Actividad } from "@/lib/productivo/actividades"
import {
  existenciasDePesada, disponiblePorDiferencia,
  type DisponibleCategoria,
} from "@/lib/ganaderia/disponibilidad"
import {
  ModalConfirmarVentaHacienda, type LoteAConfirmar, type VentaAEditar,
} from "@/components/modal-confirmar-venta-hacienda"

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
const kg = (n: number) => `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })} kg`
const fecha = (f: string | null) => (f ? f.split("-").reverse().join("/") : "—")

interface FilaVenta {
  id: string
  actividad: string
  /** La campaña del ciclo del que sale el lote. La cría se lee campaña por campaña. */
  campania: string
  categoria: string
  cabezas: number
  peso: number
  kgNetos: number
  precio: number
  neto: number
  fechaVenta: string | null
  plazo: string | null
  ciclo: string | null
  /** El precio se arrastró de otro mes o no existe: el número no es firme. */
  estimado: boolean
  /** Condiciones proyectadas: son el punto de partida al confirmar. */
  pctDesbaste: number
  pctCz: number
}

/**
 * El desglose del destete de una campaña de cría: cuántos salen, cuántos se guardan y cuántos
 * quedan para vender.
 *
 * Lo pidió el usuario (2026-08-05) y es informativo, pero cierra una cuenta que hoy no se ve:
 * **destetados − reposición = saldo a vender**. Sin eso, ver 120 cabezas presupuestadas no dice
 * si falta vender o si el resto se guarda a propósito.
 */
interface DesgloseCampania {
  campania: string
  terneros: number
  terneras: number
  destetados: number
  /** Se guardan: terneras de reposición + toritos. NO se venden. */
  retenidas: number
  toritos: number
  /** destetados − retenidas − toritos */
  aVender: number
  /** Lo que ya tiene venta presupuestada en esta campaña. */
  presupuestado: number
}

const SIN_CAMPANA = "sin campaña"

/** Una venta ya cerrada. El stock ya bajó y está esperando la liquidación. */
interface VentaConfirmada {
  id: string
  actividad: string
  campania: string
  categoria: string
  cabezas: number
  kgTotales: number
  precio: number
  neto: number
  fechaVenta: string
  plazo: string | null
  /** Cuánto de la venta ya está facturado. Si es 0, todavía espera la liquidación. */
  facturado: number
  notas: string | null
  // Condiciones, para poder corregirlas sin volver a cargar nada.
  pctDesbaste: number
  pctCz: number
  flete: number | null
  cliente: string | null
}

/** Sin actividad asignada no se inventa: se agrupa aparte y se dice. */
const SIN_ACTIVIDAD = "— sin actividad —"

export function SeccionVentasPorLote() {
  const [cargando, setCargando] = useState(true)
  const [ventas, setVentas] = useState<FilaVenta[]>([])
  const [disponibles, setDisponibles] = useState<(DisponibleCategoria & { actividad: string })[]>([])
  const [desgloses, setDesgloses] = useState<DesgloseCampania[]>([])
  const [aConfirmar, setAConfirmar] = useState<LoteAConfirmar | null>(null)
  /**
   * Las ventas YA CONFIRMADAS.
   *
   * ⚠️ Sin esto la confirmación era invisible: el lote quedaba con 0 disponible, su fila
   * desaparecía de las presupuestadas, y no aparecía en ningún otro lado. El usuario confirmó una
   * venta de $91,7 M y creyó que **no se había guardado**. Guardar bien y borrar de la pantalla es
   * la peor combinación posible.
   */
  const [confirmadas, setConfirmadas] = useState<VentaConfirmada[]>([])
  const [aEditar, setAEditar] = useState<VentaAEditar | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const p = supabase.schema("productivo")
      const [{ data: lotes }, { data: precios }, { data: tra }, { data: acts },
             { data: pes }, { data: crs }, { data: cats }, { data: ciclosCria }] = await Promise.all([
        p.from("stock_lotes").select("*").eq("empresa", "MSA"),
        supabase.from("precios_hacienda")
          .select("categoria, anio, mes, precio_pesos_kg, peso_desde, peso_hasta"),
        p.from("lote_tramos").select("*").order("orden"),
        p.from("actividades").select("*"),
        p.from("pesadas_terneros")
          .select("ternero_id, fecha, peso_kg, ternero:terneros!inner(sexo, es_torito)"),
        p.from("ciclos_recria").select("id, campania"),
        p.from("categorias_hacienda").select("nombre, centro_costo_id"),
        p.from("stock_ciclos").select("*"),
      ])
      const { data: ccs } = await supabase.from("centros_costo").select("id, nombre")

      const listaLotes = ((lotes || []) as LoteStock[])
      const ids = listaLotes.map(l => l.id)
      const { data: vs } = ids.length
        ? await p.from("stock_ventas").select("lote_id, cantidad").in("lote_id", ids)
        : { data: [] as any[] }

      const listaVentas = (vs || []) as VentaStock[]

      // ── Las ventas ya confirmadas ──────────────────────────────────────────
      // `ventas_unificadas` trae lo facturado, así que se ve si todavía espera la liquidación.
      const [{ data: svs }, { data: unif }] = await Promise.all([
        ids.length
          ? p.from("stock_ventas")
              .select("id, lote_id, fecha_venta, cantidad, kg_totales, precio_kg, monto_neto, plazo_cobro, notas, pct_desbaste, pct_cz, flete, cliente_nombre")
              .in("lote_id", ids)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("ventas_unificadas").select("venta_id, facturado").eq("venta_tipo", "ganaderia"),
      ])
      const factPorVenta = new Map(((unif || []) as any[]).map(u => [u.venta_id, Number(u.facturado) || 0]))
      const lotePorId = new Map(listaLotes.map(l => [l.id, l]))
      setConfirmadas(((svs || []) as any[]).map(s => {
        const l = lotePorId.get(s.lote_id) as any
        return {
          id: s.id,
          actividad: l ? actividadDe(String(l.categoria)) : SIN_ACTIVIDAD,
          campania: l ? campaniaDe(l) : SIN_CAMPANA,
          categoria: l ? String(l.categoria) : "—",
          cabezas: Number(s.cantidad) || 0,
          kgTotales: Number(s.kg_totales) || 0,
          precio: Number(s.precio_kg) || 0,
          neto: Number(s.monto_neto) || 0,
          fechaVenta: s.fecha_venta,
          plazo: s.plazo_cobro,
          facturado: factPorVenta.get(s.id) ?? 0,
          notas: s.notas,
          pctDesbaste: Number(s.pct_desbaste) || 0,
          pctCz: Number(s.pct_cz) || 0,
          flete: s.flete == null ? null : Number(s.flete),
          cliente: s.cliente_nombre ?? null,
        }
      }))
      const listaPrecios = (precios || []) as PrecioHacienda[]
      const listaTramos = (tra || []) as TramoLote[]
      const listaActs = (acts || []) as Actividad[]
      const curvaDe = (l: LoteStock) =>
        curvaDeLote(l as unknown as LoteCurva, listaTramos.filter(t => t.lote_id === l.id), listaActs)

      // La actividad sale de la CATEGORÍA, que es el mapeo estable: una vaca es de cría, un
      // ternero de recría es de recría. Es el mismo criterio que usa Ingresos por actividad.
      const ccPorId = new Map(((ccs || []) as any[]).map(c => [c.id, String(c.nombre)]))
      const actPorCat = new Map(((cats || []) as any[]).map(
        c => [String(c.nombre), c.centro_costo_id ? ccPorId.get(c.centro_costo_id) ?? null : null]))
      const actividadDe = (categoria: string) => actPorCat.get(categoria) ?? SIN_ACTIVIDAD
      const cicloPorId = new Map(((crs || []) as any[]).map(c => [c.id, String(c.campania)]))
      // La campaña del lote sale de SU ciclo: el de cría o el de recría, según de dónde cuelgue.
      const campCriaPorId = new Map(((ciclosCria || []) as any[]).map(c => [c.id, String(c.campania)]))
      const campaniaDe = (l: any): string =>
        (l.ciclo_id ? campCriaPorId.get(l.ciclo_id) : null)
        ?? (l.ciclo_recria_id ? cicloPorId.get(l.ciclo_recria_id) : null)
        ?? SIN_CAMPANA

      // ── Capa 1: las presupuestadas, valuadas con la MISMA función del presupuesto ──
      const filas: FilaVenta[] = []
      for (const l of listaLotes) {
        const dellote = listaVentas.filter(v => v.lote_id === l.id)
        const v = valuarLoteConPrecios(l, dellote, listaPrecios, curvaDe(l))
        if (!v.proyectado) continue
        filas.push({
          id: l.id,
          actividad: actividadDe(String(l.categoria)),
          campania: campaniaDe(l),
          categoria: String(l.categoria),
          cabezas: v.cabezas, peso: v.peso_unitario,
          kgNetos: v.kg_netos, precio: v.precio_kg,
          neto: v.monto,
          fechaVenta: l.fecha_venta_estimada ?? null,
          plazo: (l as any).plazo_cobro ?? null,
          ciclo: (l as any).ciclo_recria_id ? cicloPorId.get((l as any).ciclo_recria_id) ?? null : null,
          estimado: v.estimado,
          pctDesbaste: Number((l as any).pct_desbaste) || 0,
          pctCz: Number((l as any).pct_cz) || 0,
        })
      }
      setVentas(filas.sort((a, b) => (a.fechaVenta ?? "").localeCompare(b.fechaVenta ?? "")))

      // ── Capa 2: lo que existe y NO tiene venta, por diferencia contra la pesada viva ──
      const ultima: Record<string, any> = {}
      for (const r of ((pes || []) as any[])) {
        const prev = ultima[r.ternero_id]
        if (!prev || r.fecha > prev.fecha) ultima[r.ternero_id] = r
      }
      const filasPesada = Object.values(ultima).map((r: any) => ({
        peso_kg: r.peso_kg, sexo: r.ternero?.sexo ?? "", es_torito: !!r.ternero?.es_torito,
      }))
      const fechaUltima = Object.values(ultima)
        .map((r: any) => r.fecha).sort().slice(-1)[0] as string | undefined
      const mesPesada = fechaUltima ? fechaUltima.slice(0, 7) : new Date().toISOString().slice(0, 7)

      const exist = existenciasDePesada(filasPesada, mesPesada,
        fechaUltima ? `pesada del ${fecha(fechaUltima)}` : undefined)
      const disp = disponiblePorDiferencia(exist, listaLotes, listaVentas)
      setDisponibles(disp.map(d => ({ ...d, actividad: actividadDe(d.categoria) })))

      // ── El desglose del destete, campaña por campaña ──────────────────────
      // `calcularLineaTiempo()` es la MISMA que usa Evolución del rodeo y el margen: el rodeo
      // rueda año a año y cada campaña abre con el cierre de la anterior.
      const linea = calcularLineaTiempo(((ciclosCria || []) as any[]))
      setDesgloses(linea.map(c => {
        const camp = String(c.ciclo.campania)
        const presupuestado = filas
          .filter(f => f.campania === camp && f.actividad === "Cria")
          .reduce((s, f) => s + f.cabezas, 0)
        return {
          campania: camp,
          terneros: c.terneros, terneras: c.terneras, destetados: c.destetados,
          retenidas: c.retenidas, toritos: c.toritos,
          // Lo que efectivamente queda para vender: lo destetado menos lo que se guarda.
          aVender: c.destetados - c.retenidas - c.toritos,
          presupuestado,
        }
      }))
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  /** Cría, Recría, Engorde… cada una con sus ventas y su disponible. */
  const porActividad = useMemo(() => {
    const nombres = Array.from(new Set([
      ...ventas.map(v => v.actividad),
      ...confirmadas.map(v => v.actividad),
      ...disponibles.map(d => d.actividad),
    ])).sort((a, b) => (a === SIN_ACTIVIDAD ? 1 : b === SIN_ACTIVIDAD ? -1 : a.localeCompare(b)))
    return nombres.map(n => {
      const mias = ventas.filter(v => v.actividad === n)
      // Dentro de cada actividad, POR CAMPAÑA. La cría vende un destete por año y mezclarlos
      // hacía que 2027 y 2028 se leyeran como un solo bloque de 309 cabezas.
      const camps = Array.from(new Set(mias.map(v => v.campania))).sort()
      return {
        actividad: n,
        campanias: camps.map(c => ({
          campania: c,
          ventas: mias.filter(v => v.campania === c),
          desglose: desgloses.find(d => d.campania === c) ?? null,
        })),
        disponibles: disponibles.filter(d => d.actividad === n),
        confirmadas: confirmadas.filter(v => v.actividad === n),
      }
    })
  }, [ventas, disponibles, desgloses, confirmadas])

  if (cargando) {
    return (
      <Card><CardContent className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leyendo las ventas de hacienda…
      </CardContent></Card>
    )
  }

  if (porActividad.length === 0) return null

  return (
    <div className="space-y-3">
      {porActividad.map(g => {
        const todas = g.campanias.flatMap(c => c.ventas)
        const totalNeto = todas.reduce((s, v) => s + v.neto, 0)
        const totalCab = todas.reduce((s, v) => s + v.cabezas, 0)
        const sinVender = g.disponibles.reduce((s, d) => s + d.cabezas, 0)

        return (
          <Card key={g.actividad}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  {g.actividad === "Cria" ? "🐮 Cría"
                    : g.actividad === "Recria" ? "🐄 Recría"
                    : g.actividad === "Engorde" ? "🐂 Engorde"
                    : g.actividad}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-1.5">
                  {totalCab > 0 && (
                    <Badge variant="outline" className="border-blue-300 text-[10px] text-blue-700">
                      {totalCab} cab presupuestadas
                    </Badge>
                  )}
                  {g.confirmadas.length > 0 && (
                    <Badge variant="outline" className="border-emerald-400 text-[10px] text-emerald-700">
                      {g.confirmadas.reduce((s, v) => s + v.cabezas, 0)} cab vendidas
                    </Badge>
                  )}
                  {sinVender > 0 && (
                    <Badge variant="outline" className="border-gray-300 text-[10px] text-gray-600">
                      {sinVender} sin venta
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* ── Capa 1: presupuestadas, UNA TABLA POR CAMPAÑA ──────────── */}
              {g.campanias.map(c => (
                <div key={c.campania} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-gray-400 text-[10px] font-medium">
                      Campaña {c.campania}
                    </Badge>
                    {c.desglose && (
                      <span className="text-[10px] text-gray-500">
                        destete {c.desglose.destetados} cab
                      </span>
                    )}
                  </div>

                  {/* El desglose del destete: qué sale, qué se guarda y qué queda para vender.
                      Sin esto, "120 presupuestadas" no dice si falta vender o si el resto se
                      guarda a propósito. */}
                  {c.desglose && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded border bg-slate-50 px-2 py-1.5 text-[11px]">
                      <span className="text-gray-600">
                        ♂ <strong className="text-gray-800">{c.desglose.terneros}</strong> terneros
                      </span>
                      <span className="text-gray-600">
                        ♀ <strong className="text-gray-800">{c.desglose.terneras}</strong> terneras
                      </span>
                      <span className="text-gray-400">=</span>
                      <span className="text-gray-700">
                        <strong>{c.desglose.destetados}</strong> destetados
                      </span>
                      <span className="text-gray-400">−</span>
                      <span className="text-amber-700">
                        <strong>{c.desglose.retenidas + c.desglose.toritos}</strong> se guardan
                        <span className="ml-1 text-[9px] text-amber-600">
                          ({c.desglose.retenidas} ♀ rep · {c.desglose.toritos} toritos)
                        </span>
                      </span>
                      <span className="text-gray-400">=</span>
                      <span className="text-emerald-800">
                        <strong>{c.desglose.aVender}</strong> a vender
                      </span>
                      {/* Si lo presupuestado no llega al saldo, falta decidir el resto. */}
                      {Math.abs(c.desglose.aVender - c.desglose.presupuestado) > 0.5 && (
                        <span className={c.desglose.presupuestado < c.desglose.aVender
                          ? "text-amber-700" : "text-red-600"}>
                          · {c.desglose.presupuestado < c.desglose.aVender
                            ? `faltan ${Math.round(c.desglose.aVender - c.desglose.presupuestado)} por presupuestar`
                            : `hay ${Math.round(c.desglose.presupuestado - c.desglose.aVender)} presupuestadas de más`}
                        </span>
                      )}
                    </div>
                  )}

                <div className="overflow-x-auto rounded border bg-white">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b bg-gray-50 text-[9px] uppercase text-gray-500">
                        <th className="px-2 py-1 text-left font-medium">Categoría</th>
                        <th className="px-2 py-1 text-right font-medium">Cab</th>
                        <th className="px-2 py-1 text-right font-medium">Peso</th>
                        <th className="px-2 py-1 text-right font-medium">Kg netos</th>
                        <th className="px-2 py-1 text-right font-medium">$/kg</th>
                        <th className="px-2 py-1 text-right font-medium">Neto</th>
                        <th className="px-2 py-1 text-left font-medium">Venta</th>
                        <th className="px-2 py-1 text-left font-medium">Plazo</th>
                        <th className="px-2 py-1 text-left font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.ventas.map(v => (
                        <tr key={v.id} className="border-b last:border-0">
                          <td className="px-2 py-1 text-gray-700">{v.categoria}</td>
                          <td className="px-2 py-1 text-right text-gray-800">{v.cabezas}</td>
                          <td className="px-2 py-1 text-right text-gray-500">{kg(v.peso)}</td>
                          <td className="px-2 py-1 text-right text-gray-600">{kg(v.kgNetos)}</td>
                          <td className="px-2 py-1 text-right text-gray-600">
                            {v.precio > 0 ? pesos(v.precio) : "—"}
                            {v.estimado && (
                              <span className="ml-0.5 text-[9px] text-amber-600"
                                title="El precio se arrastró de otro mes, o falta cargarlo">~</span>
                            )}
                          </td>
                          <td className="px-2 py-1 text-right font-medium text-gray-800">
                            {pesos(v.neto)}
                          </td>
                          <td className="px-2 py-1 text-gray-600">{fecha(v.fechaVenta)}</td>
                          <td className="px-2 py-1 text-gray-500">{v.plazo || "—"}</td>
                          <td className="px-2 py-1">
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge variant="outline" className="border-blue-300 text-[9px] text-blue-700">
                                presupuestada
                              </Badge>
                              {v.ciclo && (
                                <span className="text-[9px] text-gray-400">ciclo {v.ciclo}</span>
                              )}
                              {/* Confirmar donde se ve la proyección: confirmar es CERRAR esa
                                  proyección, no crear una venta nueva. */}
                              <button type="button"
                                onClick={() => setAConfirmar({
                                  id: v.id, categoria: v.categoria,
                                  cabezas: v.cabezas, pesoProyectado: v.peso,
                                  precioProyectado: v.precio,
                                  pctDesbaste: v.pctDesbaste, pctCz: v.pctCz,
                                  plazoCobro: v.plazo, fechaVentaEstimada: v.fechaVenta,
                                  empresa: "MSA",
                                  esGordo: /gordo|novillo|vaquillona engorde/i.test(v.categoria),
                                })}
                                className="rounded border border-emerald-400 bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-800 hover:bg-emerald-100">
                                Confirmar venta →
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-gray-50 font-medium">
                        <td className="px-2 py-1 text-gray-700">Total {c.campania}</td>
                        <td className="px-2 py-1 text-right text-gray-800">
                          {c.ventas.reduce((s, v) => s + v.cabezas, 0)}
                        </td>
                        <td colSpan={3} />
                        <td className="px-2 py-1 text-right text-gray-800">
                          {pesos(c.ventas.reduce((s, v) => s + v.neto, 0))}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                </div>
              ))}

              {/* ── Las CONFIRMADAS: el stock ya bajó ───────────────────────── */}
              {g.confirmadas.length > 0 && (
                <div className="overflow-x-auto rounded border border-emerald-200 bg-emerald-50/40">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-emerald-200 bg-emerald-50 text-[9px] uppercase text-emerald-800">
                        <th className="px-2 py-1 text-left font-medium">Confirmadas</th>
                        <th className="px-2 py-1 text-right font-medium">Cab</th>
                        <th className="px-2 py-1 text-right font-medium">Kg</th>
                        <th className="px-2 py-1 text-right font-medium">$/kg</th>
                        <th className="px-2 py-1 text-right font-medium">Neto</th>
                        <th className="px-2 py-1 text-left font-medium">Venta</th>
                        <th className="px-2 py-1 text-left font-medium">Plazo</th>
                        <th className="px-2 py-1 text-left font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.confirmadas.map(v => {
                        const pendiente = v.neto - v.facturado
                        return (
                          <tr key={v.id} className="border-b border-emerald-100 last:border-0">
                            <td className="px-2 py-1 text-gray-700">
                              {v.categoria}
                              <span className="ml-1 text-[9px] text-gray-400">{v.campania}</span>
                            </td>
                            <td className="px-2 py-1 text-right text-gray-800">{v.cabezas}</td>
                            <td className="px-2 py-1 text-right text-gray-600">{kg(v.kgTotales)}</td>
                            <td className="px-2 py-1 text-right text-gray-600">{pesos(v.precio)}</td>
                            <td className="px-2 py-1 text-right font-medium text-gray-800">{pesos(v.neto)}</td>
                            <td className="px-2 py-1 text-gray-600">{fecha(v.fechaVenta)}</td>
                            <td className="px-2 py-1 text-gray-500">{v.plazo || "—"}</td>
                            <td className="px-2 py-1">
                              {/* El gradiente termina acá: confirmada → fijada cuando llega la FC. */}
                              {pendiente <= 0.01 ? (
                                <Badge variant="outline" className="border-emerald-500 text-[9px] text-emerald-800">
                                  fijada · facturada
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-emerald-400 text-[9px] text-emerald-700">
                                  confirmada · espera liquidación
                                </Badge>
                              )}
                              {v.facturado > 0 && pendiente > 0.01 && (
                                <span className="ml-1 text-[9px] text-gray-500">
                                  parcial: falta {pesos(pendiente)}
                                </span>
                              )}
                              <button type="button"
                                onClick={() => setAEditar({
                                  id: v.id, categoria: v.categoria, cabezas: v.cabezas,
                                  kgTotales: v.kgTotales, precioKg: v.precio,
                                  pctDesbaste: v.pctDesbaste, pctCz: v.pctCz, flete: v.flete,
                                  plazoCobro: v.plazo, fechaVenta: v.fechaVenta,
                                  clienteNombre: v.cliente, notas: v.notas,
                                })}
                                className="ml-1 rounded border bg-white px-1.5 py-0.5 text-[9px] text-gray-600 hover:bg-gray-50">
                                Editar
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <p className="px-2 py-1 text-[9px] text-emerald-800">
                    El stock ya bajó y estas ventas están en el <strong>Cash Flow</strong> como
                    ingreso comprometido. Cuando llegue la liquidación se vinculan solas desde{" "}
                    <strong>Ventas</strong>.
                  </p>
                </div>
              )}

              {/* ── Capa 2: existe y nadie decidió cuándo venderlo ──────────── */}
              {g.disponibles.length > 0 && (
                <div className="rounded border bg-slate-50 px-2 py-1.5">
                  <p className="mb-1 text-[9px] uppercase tracking-wide text-gray-500">
                    Sin venta presupuestada
                    <span className="ml-1 normal-case text-gray-400">
                      — existen y todavía no se decidió cuándo venderlos
                    </span>
                  </p>
                  <div className="space-y-0.5">
                    {g.disponibles.map((d, k) => (
                      <div key={k} className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="text-gray-700">{d.categoria}</span>
                        <span className="font-medium text-gray-800">{d.cabezas} cab</span>
                        <span className="text-gray-500">{kg(d.peso_prom)} prom</span>
                        <span className="text-[9px] text-gray-400">
                          {d.existentes} existentes − {d.comprometidas} con venta
                          {d.detalle ? ` · ${d.detalle}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {g.campanias.length === 0 && g.disponibles.length === 0
                && g.confirmadas.length === 0 && (
                <p className="py-2 text-center text-[11px] text-gray-400">Sin movimientos.</p>
              )}
            </CardContent>
          </Card>
        )
      })}

      <p className="text-[10px] leading-tight text-gray-400">
        Los lotes se cargan en <strong>Sector Productivo → Evolución Rodeo</strong> y los precios
        <strong> $/kg</strong> en <strong>Presupuesto → Precios y TC</strong>. La valuación usa la
        misma función que el presupuesto, así que los números <strong>no pueden diferir</strong>.
        Un <strong className="text-amber-600">~</strong> en el precio significa que se arrastró de
        otro mes o que falta cargarlo.
      </p>

      <ModalConfirmarVentaHacienda
        lote={aConfirmar}
        editar={aEditar}
        onCerrar={() => { setAConfirmar(null); setAEditar(null) }}
        onConfirmado={cargar}
      />

      {porActividad.some(g => g.actividad === SIN_ACTIVIDAD) && (
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          Hay categorías <strong>sin actividad asignada</strong>: no se puede saber si su venta es
          de cría o de recría. Se asigna en <strong>Presupuesto → Ingresos por actividad</strong>.
        </p>
      )}
    </div>
  )
}
