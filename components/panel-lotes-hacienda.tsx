"use client"

// Cabezas disponibles para vender. Dos orígenes:
//   · stock_inicial → la foto de arranque (la recría que se retuvo y no se vendió)
//   · destete / descarte → generados desde cada período de la línea de tiempo
// El peso crece con `ganancia_diaria_kg` si se vende después de la fecha disponible.
// Ver PENDIENTES § CICLO GANADERO.

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Trash2, PackageOpen, Wand2, Scale, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import {
  segmentosCurva, curvaDeLote, tramosParaCosto, solapamientos, gananciaEsManual,
  type TramoLote, type LoteCurva,
} from "@/lib/productivo/tramos"
import {
  consumoMensual, type Actividad, type InsumoActividad,
} from "@/lib/productivo/actividades"
import {
  pesoEstimado, cantidadDisponible, fechaDestete, pesoDestete,
  categoriaSegunFecha, valuarLoteConPrecios, CATEGORIAS_VENTA,
  type LoteStock, type VentaStock, type CicloCalculado,
} from "@/lib/ganaderia/ciclo"
import {
  type PrecioHacienda, pctDesbaste, pctCz, brutoDesdeNeto, netoDesdeBruto, categoriaPrecio,
} from "@/lib/ganaderia/calculo"

// Parser único del proyecto: entiende "5.700", "5700", "0,5" y "0.5". Ver
// lib/format/numero.ts — el punto de miles rompía el round-trip con fmtAR.
const parseNum = parseNumeroAR
const n1 = (n: number) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: 1 })
const fmtAR = (n: number) => Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
const n0 = (n: number) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })

/** Categorías vendibles — de la lib, para no duplicar la lista. */
const CATEGORIAS = [...CATEGORIAS_VENTA]

/** Ajustes editables por fila antes de generar el lote. */
interface AjusteFila {
  cantidad: string
  peso: string
  ganancia: string
  fecha_venta: string
  plazo: string
  precio: string
  desbaste: string
  cz: string
}

export function PanelLotesHacienda({ linea, onCambio }: {
  linea: CicloCalculado[]
  onCambio?: () => void
}) {
  const [cargando, setCargando] = useState(true)
  const [lotes, setLotes] = useState<LoteStock[]>([])
  const [ventas, setVentas] = useState<VentaStock[]>([])
  const [modal, setModal] = useState<any>(null)
  const [modalPesada, setModalPesada] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [modalGenerar, setModalGenerar] = useState(false)
  /**
   * Foto ACTUAL de las pesadas, por `fecha|categoria`. Se compara contra lo que quedó
   * guardado en el lote para avisar cuando el origen cambió (p.ej. se marcaron más
   * terneras de reposición). NO se actualiza solo: el presupuesto no debe moverse bajo
   * los pies del usuario — se avisa y él decide (misma lección que los templates
   * auto-modificables en KNOWLEDGE.md).
   */
  const [fotoPesada, setFotoPesada] = useState<Record<string, { cabezas: number; peso: number }>>({})
  const [precios, setPrecios] = useState<PrecioHacienda[]>([])
  // Actividades y tramos: definen la curva de peso del lote y su costo de alimentacion
  const [tramos, setTramos] = useState<TramoLote[]>([])
  /** Las actividades a las que un lote puede PASAR en vez de venderse afuera. */
  const [centrosCosto, setCentrosCosto] = useState<{ id: string; nombre: string }[]>([])
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [insumosAct, setInsumosAct] = useState<InsumoActividad[]>([])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const { data: ls, error } = await supabase.schema("productivo")
        .from("stock_lotes").select("*").eq("empresa", "MSA").order("fecha_disponible")
      if (error) console.error("Error cargando lotes:", error)

      const ids = (ls || []).map((l: any) => l.id)
      const { data: vs } = ids.length
        ? await supabase.schema("productivo").from("stock_ventas").select("*").in("lote_id", ids)
        : { data: [] as any[] }

      setLotes((ls || []) as LoteStock[])
      setVentas((vs || []) as VentaStock[])

      const [{ data: tr }, { data: ccs }, { data: acts }, { data: insAct }] = await Promise.all([
        supabase.schema("productivo").from("lote_tramos").select("*").order("orden"),
        // Para poder decir "este lote no se vende: pasa a Cría".
        supabase.from("centros_costo").select("id, nombre").eq("tipo", "actividad").eq("activo", true),
        supabase.schema("productivo").from("actividades").select("*").eq("activo", true).order("nombre"),
        supabase.schema("productivo").from("actividad_insumos").select("*").order("orden"),
      ])
      setTramos((tr || []) as TramoLote[])
      setCentrosCosto(((ccs || []) as any[]).map(c => ({ id: String(c.id), nombre: String(c.nombre) })))
      setActividades((acts || []) as Actividad[])
      setInsumosAct((insAct || []) as InsumoActividad[])

      const { data: pr } = await supabase.from("precios_hacienda")
        .select("categoria, anio, mes, precio_pesos_kg, peso_desde, peso_hasta")
      setPrecios((pr || []) as PrecioHacienda[])

      // Foto viva de las pesadas, para detectar lotes desactualizados
      const { data: pes } = await supabase.schema("productivo")
        .from("pesadas_terneros")
        .select("fecha, peso_kg, ternero:terneros!inner(sexo, es_torito, activo)")
      const acc: Record<string, { n: number; kg: number }> = {}
      for (const r of (pes || []) as any[]) {
        const t = r.ternero
        // Un animal vendido o muerto sigue teniendo pesadas: si no se lo saca, la foto del
        // stock queda inflada y los lotes parecen desactualizados cuando no lo están.
        if (!t || t.activo === false) continue
        const esMacho = /macho/i.test(String(t.sexo ?? ""))
        const categoria = esMacho
          ? (t.es_torito ? "Torito" : "Ternero Recria")
          : (t.es_torito ? "__reposicion__" : "Ternera Recria")
        const k = `${r.fecha}|${categoria}`
        acc[k] = acc[k] ?? { n: 0, kg: 0 }
        acc[k].n += 1
        acc[k].kg += Number(r.peso_kg) || 0
      }
      const foto: Record<string, { cabezas: number; peso: number }> = {}
      for (const [k, v] of Object.entries(acc)) {
        foto[k] = { cabezas: v.n, peso: v.n ? v.kg / v.n : 0 }
      }
      setFotoPesada(foto)
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const ventasDe = (loteId: string) => ventas.filter(v => v.lote_id === loteId)
  const tramosDe = (loteId: string) => tramos.filter(t => t.lote_id === loteId)
  /** Curva de peso del lote: quebrada si tiene tramos de actividad, recta si no. */
  const curvaDe = (l: LoteStock) => curvaDeLote(l as unknown as LoteCurva, tramosDe(l.id), actividades)

  const guardar = async (f: any) => {
    if (!f.categoria || !f.fecha_disponible || !f.cantidad) {
      alert("Categoría, cantidad y fecha disponible son obligatorias"); return
    }
    const payload = {
      empresa: "MSA",
      ciclo_id: f.ciclo_id || null,
      categoria: f.categoria,
      origen: f.origen || "stock_inicial",
      cantidad: parseNum(String(f.cantidad)),
      fecha_disponible: f.fecha_disponible,
      peso_base_kg: parseNum(String(f.peso_base_kg)),
      fecha_peso: f.fecha_peso || f.fecha_disponible || null,
      ganancia_diaria_kg: parseNum(String(f.ganancia_diaria_kg)),
      ganancia_override: Boolean(f.ganancia_override),
      fecha_venta_estimada: f.fecha_venta_estimada || null,
      // Vacío = venta externa. Con actividad, el lote es un traspaso interno y no genera caja.
      destino_actividad_id: f.destino_actividad_id || null,
      precio_kg_override: String(f.precio_kg_override ?? "").trim() === ""
        ? null : parseNum(String(f.precio_kg_override)),
      plazo_cobro: String(f.plazo_cobro ?? "0").trim() || "0",
      pct_desbaste: parseNum(String(f.pct_desbaste ?? "5")) / 100,
      pct_cz: parseNum(String(f.pct_cz ?? "4")) / 100,
      alicuota_iva: parseNum(String(f.alicuota_iva ?? "10,5")) / 100,
      alicuota_iibb: parseNum(String(f.alicuota_iibb ?? "1")) / 100,
      notas: f.notas || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = f.id
      ? await supabase.schema("productivo").from("stock_lotes").update(payload).eq("id", f.id)
      : await supabase.schema("productivo").from("stock_lotes").insert(payload)
    if (error) { alert("Error: " + error.message); return }
    setModal(null)
    await cargar(); onCambio?.()
  }

  const borrar = async (id: string) => {
    if (!confirm("¿Borrar este lote? Se borran también sus ventas.")) return
    await supabase.schema("productivo").from("stock_lotes").delete().eq("id", id)
    await cargar(); onCambio?.()
  }

  /**
   * Genera los lotes vendibles de cada período: vaca de descarte, terneros y las
   * terneras que no se retuvieron. Idempotente por (ciclo, categoría, origen):
   * re-correrlo actualiza la cantidad en vez de duplicar.
   */
  /** Arma la propuesta para previsualizar, sin tocar nada. */
  const filasGenerar = (): FilaGenerar[] => {
    const out: FilaGenerar[] = []
    for (const c of linea) {
      const fecha = fechaDestete(c.ciclo)
      if (!fecha) continue
      const items = [
        { categoria: categoriaSegunFecha("macho", fecha, fecha), origen: "destete" as const,
          cantidad: c.terneros_venta, peso: pesoDestete(c.ciclo, "macho"),
          procedencia: `Terneros del destete (${n1(c.terneros)}) − ${n1(c.toritos)} toritos retenidos` },
        { categoria: categoriaSegunFecha("hembra", fecha, fecha), origen: "destete" as const,
          cantidad: c.terneras_venta, peso: pesoDestete(c.ciclo, "hembra"),
          procedencia: `Terneras del destete (${n1(c.terneras)}) − ${n1(c.retenidas)} de reposición` },
        { categoria: "Vaca CUT/Descarte", origen: "descarte" as const,
          cantidad: c.descarte, peso: Number(c.ciclo.peso_descarte_kg) || 450,
          procedencia: `Refugo + mortandad del período (incluye las que se mueren — descontalas)` },
      ]
      for (const it of items) {
        if (it.cantidad <= 0.01) continue
        const ex = lotes.find(l => l.ciclo_id === c.ciclo.id && l.categoria === it.categoria && l.origen === it.origen)
        out.push({
          clave: `${c.ciclo.id}|${it.categoria}|${it.origen}`,
          campania: c.ciclo.campania, ciclo_id: c.ciclo.id,
          categoria: it.categoria, origen: it.origen,
          cantidad: it.cantidad, peso: it.peso, fecha_disponible: fecha,
          procedencia: it.procedencia,
          yaExiste: !!ex, tieneVentas: !!ex && ventasDe(ex.id).length > 0,
        })
      }
    }
    return out
  }

  const aplicarGenerar = async (sel: { fila: FilaGenerar; ajustes: AjusteFila }[]) => {
    setGenerando(true)
    try {
      for (const { fila, ajustes } of sel) {
        const existente = lotes.find(l =>
          l.ciclo_id === fila.ciclo_id && l.categoria === fila.categoria && l.origen === fila.origen)
        if (existente && ventasDe(existente.id).length > 0) continue

        const cantidad = parseNum(ajustes.cantidad)
        const payload = {
          cantidad,
          cantidad_calculada: fila.cantidad,
          fecha_disponible: fila.fecha_disponible,
          peso_base_kg: parseNum(ajustes.peso),
          ganancia_diaria_kg: parseNum(ajustes.ganancia),
          fecha_venta_estimada: ajustes.fecha_venta || null,
          plazo_cobro: ajustes.plazo || "0",
          precio_kg_override: ajustes.precio.trim() === "" ? null : parseNum(ajustes.precio),
          pct_desbaste: parseNum(ajustes.desbaste) / 100,
          pct_cz: parseNum(ajustes.cz) / 100,
          updated_at: new Date().toISOString(),
        }

        // La categoria depende de CUANDO se vende: al pie en el destete, recria despues.
        const categoria = fila.origen === "destete"
          ? categoriaSegunFecha(
              /ternera|hembra/i.test(fila.categoria) ? "hembra" : "macho",
              fila.fecha_disponible, ajustes.fecha_venta || fila.fecha_disponible)
          : fila.categoria

        const { error } = existente
          ? await supabase.schema("productivo").from("stock_lotes")
              .update({ ...payload, categoria }).eq("id", existente.id)
          : await supabase.schema("productivo").from("stock_lotes").insert({
              empresa: "MSA", ciclo_id: fila.ciclo_id,
              categoria, origen: fila.origen,
              notas: `Generado desde el período ${fila.campania}`,
              ...payload,
            })
        if (error) { alert(`Error en ${fila.categoria}: ${error.message}`); return }
      }
      setModalGenerar(false)
      await cargar(); onCambio?.()
    } finally { setGenerando(false) }
  }

  /** Precarga la foto de arranque: la recría que se retuvo y no se vendió. */
  const cargarStockInicial = () => setModal({
    origen: "stock_inicial",
    categoria: "Ternero Recria",
    cantidad: "", peso_base_kg: "197,34", ganancia_diaria_kg: "0,5",
    fecha_disponible: "2026-02-23",
    fecha_venta_estimada: "", precio_kg_override: "", plazo_cobro: "0",
    pct_desbaste: "5", pct_cz: "4", alicuota_iva: "10,5", alicuota_iibb: "1",
    notas: "Stock inicial — retenido para recría",
  })

  /**
   * Un lote de stock inicial está desactualizado si la pesada hoy dice otra cosa.
   *
   * ⚠️ **Un lote ya VENDIDO no se compara.** Con saldo 0 la comparación no significa nada: los
   * animales que quedan en la pesada son justamente **los que NO se vendieron**, así que el lote
   * siempre iba a "diferir". Y el aviso invitaba a correr «Desde pesada», que **reescribiría una
   * venta ya hecha** — el caso real: 55 terneros vendidos por $91,7 M y el panel ofreciendo
   * actualizarlos a 40 cabezas de 227,7 kg.
   */
  const desactualizado = (l: LoteStock) => {
    if (l.origen !== "stock_inicial") return null
    if (cantidadDisponible(l, ventasDe(l.id)) <= 0.01) return null
    const f = fotoPesada[`${l.fecha_disponible}|${l.categoria}`]
    if (!f) return null
    const difCab = Math.abs(f.cabezas - Number(l.cantidad)) > 0.01
    const difPeso = Math.abs(f.peso - Number(l.peso_base_kg)) > 0.5
    return (difCab || difPeso) ? f : null
  }

  const hayDesactualizados = lotes.some(l => desactualizado(l))
  const totalDisponible = lotes.reduce((s, l) => s + cantidadDisponible(l, ventasDe(l.id)), 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <PackageOpen className="h-4 w-4" />
            Cabezas disponibles para vender
            {totalDisponible > 0 && <Badge variant="outline">{n0(totalDisponible)}</Badge>}
          </span>
          <div className="flex gap-2">
            {linea.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setModalGenerar(true)}>
                <Wand2 className="mr-1 h-3.5 w-3.5" />
                Generar desde los períodos
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setModalPesada(true)}>
              <Scale className="mr-1 h-3.5 w-3.5" /> Desde pesada
            </Button>
            <Button size="sm" variant="outline" onClick={cargarStockInicial}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Manual
            </Button>
          </div>
        </CardTitle>
        <p className="text-xs text-gray-500">
          Lo que sale del rodeo (destete no retenido y vaca de descarte) más la recría que ya
          tenías. Si se vende después de la fecha disponible, el peso crece por la ganancia diaria.
        </p>
      </CardHeader>

      <CardContent className="p-0">
        {hayDesactualizados && (
          <p className="mx-4 mb-2 flex items-start gap-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Hay lotes <strong>desactualizados</strong>: la pesada de origen cambió (por
              ejemplo, se marcaron más terneras para reposición). El presupuesto{" "}
              <strong>no se actualiza solo</strong> a propósito — corré{" "}
              <strong>«Desde pesada»</strong> cuando quieras traer los números nuevos.
            </span>
          </p>
        )}
        {cargando ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : lotes.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            Todavía no hay lotes. Usá <strong>Desde pesada</strong> para traer la recría de la
            pesada de destete con sus pesos reales por sexo, y{" "}
            <strong>Generar desde los períodos</strong> para lo que viene.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr className="border-y">
                  <th className="px-3 py-2 text-left">Categoría</th>
                  <th className="px-3 py-2 text-left">Origen</th>
                  <th className="px-3 py-2 text-left">Disponible desde</th>
                  <th className="px-3 py-2 text-right">Cabezas</th>
                  <th className="px-3 py-2 text-right">Vendidas</th>
                  <th className="px-3 py-2 text-right">Quedan</th>
                  <th className="px-3 py-2 text-right">Peso base</th>
                  <th className="px-3 py-2 text-right">kg/día</th>
                  <th className="px-3 py-2 text-left">Fecha venta</th>
                  <th className="px-3 py-2 text-right">Peso venta</th>
                  <th className="px-3 py-2 text-right">$/kg</th>
                  <th className="px-3 py-2 text-right">MONTO</th>
                  <th className="px-3 py-2 text-left">Cobro</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {lotes.map(l => {
                  const vs = ventasDe(l.id)
                  const vendidas = vs.reduce((s, v) => s + Number(v.cantidad || 0), 0)
                  const quedan = cantidadDisponible(l, vs)
                  const hoy = new Date().toISOString().slice(0, 10)
                  const curva = curvaDe(l)
                  const pesoHoy = pesoEstimado(l, hoy, curva)
                  const des = desactualizado(l)
                  const val = valuarLoteConPrecios(l, vs, precios, curva)
                  return (
                    <tr key={l.id} className={`border-b hover:bg-gray-50 ${des ? "bg-amber-50/40" : ""}`}>
                      <td className="px-3 py-2">{l.categoria}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">{l.origen}</Badge>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {new Date(l.fecha_disponible + "T00:00:00").toLocaleDateString("es-AR")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {n1(l.cantidad)}
                        {l.cantidad_calculada != null
                          && Math.abs(Number(l.cantidad) - Number(l.cantidad_calculada)) > 0.01 && (
                          <span className="ml-1 text-[10px] text-blue-600"
                            title={`Ajustado a mano. El cálculo da ${n1(Number(l.cantidad_calculada))}`}>
                            ✎
                          </span>
                        )}
                        {des && Math.abs(des.cabezas - Number(l.cantidad)) > 0.01 && (
                          <span className="ml-1 text-[10px] text-amber-600"
                            title="La pesada hoy dice otra cantidad">
                            → {n1(des.cabezas)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {vendidas > 0 ? n1(vendidas) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-emerald-700">{n1(quedan)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {n1(l.peso_base_kg)}
                        {des && Math.abs(des.peso - Number(l.peso_base_kg)) > 0.5 && (
                          <span className="ml-1 text-[10px] text-amber-600"
                            title="La pesada hoy da otro promedio">
                            → {n1(des.peso)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {Number(l.ganancia_diaria_kg) > 0 ? n1(l.ganancia_diaria_kg) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {l.fecha_venta_estimada
                          ? new Date(l.fecha_venta_estimada + "T00:00:00").toLocaleDateString("es-AR")
                          : <span className="text-amber-600">sin fecha</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {val.proyectado ? n1(val.peso_unitario) : n1(pesoHoy)}
                        {val.banda && (
                          <span className="ml-1 text-[9px] text-gray-400" title={`Banda de precio: ${val.banda}`}>
                            ⓘ
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {val.proyectado
                          ? (val.precio_kg > 0
                              ? <span title={l.precio_kg_override != null
                                  ? "precio puesto a mano en el lote"
                                  : val.estimado
                                    ? `propagado — no hay precio cargado en ese mes para ${val.banda}`
                                    : `cargado para ${val.banda} en ese mes`}>
                                  {fmtAR(val.precio_kg)}
                                  {l.precio_kg_override != null
                                    ? <span className="ml-1 text-[10px] text-blue-600">manual</span>
                                    : val.estimado
                                      ? <span className="ml-1 text-[10px] text-gray-400">↓ propag.</span>
                                      : <span className="ml-1 text-[10px] text-emerald-600">✓</span>}
                                </span>
                              : <span className="text-red-500">sin precio</span>)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-800"
                        title={val.proyectado
                          ? `${n0(val.kg_brutos)} kg brutos − ${n0(val.kg_desbaste)} desbaste = ${n0(val.kg_netos)} netos
`
                            + `venta ${fmtPesos(val.venta_neta)} + IVA ${fmtPesos(val.iva)} − CZ ${fmtPesos(val.cz)}
`
                            + `IIBB ${fmtPesos(val.iibb)} en ${val.mes_iibb}`
                          : undefined}>
                        {val.proyectado && val.monto > 0 ? fmtPesos(val.monto) : "—"}
                        {val.proyectado && val.estimado && <span className="text-amber-500">*</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {val.mes_cobro ?? "—"}
                        {val.cuotas.length > 1 && (
                          <span className="ml-1 text-[10px] text-blue-600"
                            title={val.cuotas.map(c => `${c.mes}: ${fmtPesos(c.monto)}`).join(" · ")}>
                            {val.cuotas.length} cuotas
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-6 text-xs"
                            onClick={() => setModal({
                              ...l,
                              cantidad: String(l.cantidad),
                              peso_base_kg: String(l.peso_base_kg),
                              ganancia_diaria_kg: String(l.ganancia_diaria_kg),
                              precio_kg_override: l.precio_kg_override ?? "",
                              plazo_cobro: String(l.plazo_cobro ?? "0"),
                              pct_desbaste: fmtAR(Number(l.pct_desbaste ?? 0.05) * 100),
                              pct_cz: fmtAR(Number(l.pct_cz ?? 0.04) * 100),
                              alicuota_iva: fmtAR(Number(l.alicuota_iva ?? 0.105) * 100),
                              alicuota_iibb: fmtAR(Number(l.alicuota_iibb ?? 0.01) * 100),
                            })}>Editar</Button>
                          <Button variant="ghost" size="sm" className="h-6 px-1"
                            onClick={() => borrar(l.id)}>
                            <Trash2 className="h-3 w-3 text-gray-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {lotes.length > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-2 text-sm">
          <span className="text-gray-500">
            {lotes.filter(l => !l.fecha_venta_estimada).length > 0 && (
              <span className="text-amber-700">
                {lotes.filter(l => !l.fecha_venta_estimada).length} lote(s) sin fecha de venta —
                no entran al presupuesto como ingreso
              </span>
            )}
          </span>
          <span className="font-semibold text-emerald-800">
            Total presupuestado:{" "}
            {fmtPesos(lotes.reduce((s, l) =>
              s + valuarLoteConPrecios(l, ventasDe(l.id), precios, curvaDe(l)).monto, 0))}
          </span>
        </div>
      )}

      <ModalLote datos={modal} onCerrar={() => setModal(null)} onGuardar={guardar}
        tramos={tramos} actividades={actividades} insumos={insumosAct} centrosCosto={centrosCosto} />
      <ModalGenerar abierto={modalGenerar} filas={modalGenerar ? filasGenerar() : []}
        guardando={generando}
        onCerrar={() => setModalGenerar(false)} onAplicar={aplicarGenerar} />

      <ModalDesdePesada abierto={modalPesada} lotes={lotes} ventasDe={ventasDe}
        onCerrar={() => setModalPesada(false)}
        onListo={async () => { await cargar(); onCambio?.() }} />
    </Card>
  )
}

// ── Modal de lote ─────────────────────────────────────────────────────────────

function ModalLote({ datos, onCerrar, onGuardar, tramos, actividades, insumos, centrosCosto }: {
  datos: any; onCerrar: () => void; onGuardar: (f: any) => Promise<void>
  tramos: TramoLote[]; actividades: Actividad[]; insumos: InsumoActividad[]
  centrosCosto: { id: string; nombre: string }[]
}) {
  const [f, setF] = useState<any>({})
  /** Cual de los dos precios manda: el que se escribio ultimo. El otro se recalcula,
   *  tambien cuando cambia la CZ. */
  const [modoPrecio, setModoPrecio] = useState<"bruto" | "neto">("bruto")
  const [precioNetoManual, setPrecioNetoManual] = useState("")
  /**
   * Los tramos son un BORRADOR mientras el modal está abierto: se guardan con el botón Guardar
   * y Cancelar los descarta, igual que el resto del formulario.
   *
   * Antes escribían en la base al instante —el `+ tramo` insertaba en el click y cada cambio de
   * fecha hacía un UPDATE—, así que Cancelar no revertía nada. Le pasó al usuario (A-BUG-54):
   * canceló y el tramo quedó, encima con la fecha de fin un año adelantada.
   */
  const [tramosDraft, setTramosDraft] = useState<TramoLote[]>([])
  useEffect(() => {
    if (!datos) return
    setF({ ...datos }); setModoPrecio("bruto"); setPrecioNetoManual("")
    setTramosDraft(tramos.filter(t => t.lote_id === datos.id))
    // `tramos` a propósito fuera de las dependencias: el borrador se toma UNA vez al abrir. Si
    // se resincronizara con la lista de afuera, una recarga pisaría lo que estás editando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos])
  if (!datos) return null

  /**
   * Baja el borrador de tramos a la base, comparándolo con lo que había al abrir el modal.
   * Devuelve `false` si algo falló, para que el lote tampoco se guarde y no quede a medias.
   */
  const persistirTramos = async (loteId: string): Promise<boolean> => {
    const originales = tramos.filter(t => t.lote_id === loteId)
    const vivos = new Set(tramosDraft.map(t => t.id))
    const p = supabase.schema("productivo")
    const fallo = (e: { message: string } | null) => {
      if (!e) return false
      alert("No se pudieron guardar las actividades del lote: " + e.message)
      return true
    }

    for (const o of originales) {
      if (vivos.has(o.id)) continue
      if (fallo((await p.from("lote_tramos").delete().eq("id", o.id)).error)) return false
    }
    for (const t of tramosDraft) {
      const antes = originales.find(o => o.id === t.id)
      const fila = {
        actividad_id: t.actividad_id, orden: t.orden,
        fecha_desde: t.fecha_desde, fecha_hasta: t.fecha_hasta,
        hectareas: t.hectareas, notas: t.notas,
        ganancia_diaria_kg: t.ganancia_diaria_kg ?? null,
      }
      if (!antes) {
        if (fallo((await p.from("lote_tramos").insert({ id: t.id, lote_id: loteId, ...fila })).error)) return false
        continue
      }
      const igual = antes.actividad_id === t.actividad_id && antes.orden === t.orden
        && antes.fecha_desde === t.fecha_desde && antes.fecha_hasta === t.fecha_hasta
        && antes.hectareas === t.hectareas && antes.notas === t.notas
        && (antes.ganancia_diaria_kg ?? null) === (t.ganancia_diaria_kg ?? null)
      if (igual) continue
      if (fallo((await p.from("lote_tramos")
        .update({ ...fila, updated_at: new Date().toISOString() }).eq("id", t.id)).error)) return false
    }
    return true
  }

  const campo = (k: string, label: string, ayuda?: string, tipo = "text") => (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <Input type={tipo} className="h-8 text-right" value={f[k] ?? ""}
        onChange={e => setF({ ...f, [k]: e.target.value })} />
      {ayuda && <p className="mt-1 text-[10px] text-gray-400">{ayuda}</p>}
    </div>
  )

  // La ganancia se cuenta desde la fecha DEL PESO, no desde la de disponibilidad
  const baseFecha = f.fecha_peso || f.fecha_disponible
  const dias = baseFecha
    ? Math.max(0, Math.round((Date.now() - new Date(baseFecha + "T00:00:00").getTime()) / 86400000))
    : 0
  // El peso sale de la CURVA: con tramos de actividad la ganancia cambia en el camino,
  // asi que ya no alcanza con base + dias x ganancia.
  const loteCurva: LoteCurva = {
    cantidad: parseNum(String(f.cantidad ?? "0")),
    peso_base_kg: parseNum(String(f.peso_base_kg ?? "0")),
    ganancia_diaria_kg: parseNum(String(f.ganancia_diaria_kg ?? "0")),
    fecha_disponible: String(f.fecha_disponible ?? ""),
    fecha_peso: f.fecha_peso ?? null,
    ganancia_override: Boolean(f.ganancia_override),
  }
  // La curva se dibuja con el BORRADOR: mover un tramo tiene que verse antes de guardar.
  const misTramos = tramosDraft
  const curvaModal = curvaDeLote(loteCurva, misTramos, actividades)
  const hoyIso = new Date().toISOString().slice(0, 10)
  const pesoHoy = curvaModal(hoyIso)

  // ── Peso y banda a la fecha de venta
  const fv = f.fecha_venta_estimada || ""
  const diasVenta = fv && baseFecha
    ? Math.max(0, Math.round((new Date(fv + "T00:00:00").getTime()
        - new Date(baseFecha + "T00:00:00").getTime()) / 86400000))
    : 0
  // Sin fecha de venta se calcula a HOY: el desglose tiene que verse igual, es el dato
  // que el usuario quiere tener siempre a la vista.
  const pesoVenta = fv ? curvaModal(fv) : pesoHoy
  const bandaVenta = categoriaPrecio(String(f.categoria ?? ""), pesoVenta)

  // Lo que dice la TABLA para ese peso, para poder comparar con lo guardado
  const desbTabla = pctDesbaste(String(f.categoria ?? ""), pesoVenta) * 100
  const czTabla = pctCz(String(f.categoria ?? ""), pesoVenta) * 100
  const pctCzNum = parseNum(String(f.pct_cz ?? "0")) / 100

  // Bruto y neto enlazados: manda el que se escribio ultimo
  const precioBruto = modoPrecio === "neto"
    ? brutoDesdeNeto(parseNum(precioNetoManual), pctCzNum)
    : parseNum(String(f.precio_kg_override ?? "0"))
  const precioNetoTxt = modoPrecio === "neto"
    ? precioNetoManual
    : (precioBruto > 0 ? fmtAR(netoDesdeBruto(precioBruto, pctCzNum)) : "")

  // ── Desglose por cabeza y por lote
  const cab = parseNum(String(f.cantidad ?? "0"))
  const pesoNetoUni = pesoVenta * (1 - parseNum(String(f.pct_desbaste ?? "0")) / 100)
  const kgB = cab * pesoVenta
  const kgD = kgB - cab * pesoNetoUni
  const kgN = cab * pesoNetoUni
  const pr = precioBruto
  const vn = kgN * pr
  const iva = vn * parseNum(String(f.alicuota_iva ?? "0")) / 100
  const cz = vn * pctCzNum
  const iibb = vn * parseNum(String(f.alicuota_iibb ?? "0")) / 100

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{datos.id ? "Editar lote" : "Cargar stock inicial"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Categoría</label>
              <Select value={f.categoria || ""} onValueChange={v => setF({ ...f, categoria: v })}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Elegir…" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {campo("cantidad", "Cabezas")}
            <div>
              <label className="text-xs text-gray-500">Disponible desde</label>
              <Input type="date" className="h-8" value={f.fecha_disponible || ""}
                onChange={e => setF({ ...f, fecha_disponible: e.target.value })} />
              <p className="mt-1 text-[10px] text-gray-400">fecha del destete</p>
            </div>
            {campo("peso_base_kg", "Peso (kg)")}
            <div>
              <label className="text-xs text-gray-500">…a qué fecha</label>
              <Input type="date" className="h-8" value={f.fecha_peso || f.fecha_disponible || ""}
                onChange={e => setF({ ...f, fecha_peso: e.target.value })} />
              <p className="mt-1 text-[10px] text-gray-400">
                la ganancia se cuenta desde acá
              </p>
            </div>
            {campo("ganancia_diaria_kg", "Ganancia diaria (kg/día)", "0 = se vende sin engordar")}
          </div>

          <SeccionTramos loteId={f.id ?? null} lote={{ ...loteCurva, fecha_venta_estimada: fv } as LoteCurva}
            tramos={tramosDraft} actividades={actividades} insumos={insumos}
            onCambiarTramos={setTramosDraft}
            onGananciaOverride={v => setF({ ...f, ganancia_override: v })} />

          {/* ── A dónde va el lote ────────────────────────────────────────────
              No todo lote se vende afuera: al destete una parte va a venta y otra a
              reposición, y la reposición vuelve a cría. Es la misma operación vista de los dos
              lados — ingreso para el que entrega, costo de entrada para el que recibe. */}
          <div className={`rounded border p-2.5 ${
            f.destino_actividad_id ? "border-sky-200 bg-sky-50/60" : "border-gray-200 bg-gray-50/60"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-gray-700">Este lote</span>
              <select className="h-7 rounded border px-1 text-[11px]"
                value={f.destino_actividad_id ?? ""}
                onChange={e => setF({ ...f, destino_actividad_id: e.target.value || null })}>
                <option value="">se vende afuera (mercado)</option>
                {centrosCosto.map(cc => (
                  <option key={cc.id} value={cc.id}>pasa a {cc.nombre} — no se vende</option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-[10px] text-gray-500">
              {f.destino_actividad_id ? (
                <>
                  <strong>Traspaso interno</strong>: es <strong>ingreso de esta actividad y costo
                  de entrada de la otra</strong>, con el mismo número. <strong>No genera caja</strong>{" "}
                  — no lleva IVA ni comisión y no entra al Cash Flow. El <strong>$/kg</strong> de
                  abajo es el precio del traspaso, y la <strong>fecha</strong> define a qué campaña cae.
                </>
              ) : (
                <>Venta de mercado: entra al Cash Flow con su IVA, su comisión y su plazo de cobro.</>
              )}
            </p>
          </div>

          {/* Proyección de venta: sin fecha el lote es sólo inventario */}
          <div className="rounded border border-emerald-200 bg-emerald-50/40 p-2.5">
            <p className="mb-2 text-[11px] font-medium text-emerald-900">
              {f.destino_actividad_id
                ? "Datos del traspaso — sin fecha, el lote queda como stock"
                : "Venta presupuestada — sin fecha, el lote no entra al presupuesto como ingreso"}
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500">Fecha de venta</label>
                <Input type="date" className="h-8" value={f.fecha_venta_estimada || ""}
                  onChange={e => setF({ ...f, fecha_venta_estimada: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Plazo de cobro</label>
                <Input className="h-8 text-right" placeholder="0/30/60"
                  value={f.plazo_cobro ?? "0"}
                  onChange={e => setF({ ...f, plazo_cobro: e.target.value })} />
                <p className="mt-1 text-[10px] text-gray-400">
                  días separados por / — 0 · 30 · 0/30 · 37/67
                </p>
              </div>
              <div className="flex flex-col justify-center rounded bg-white px-2 py-1">
                <span className="text-[10px] text-gray-500">Peso a la venta</span>
                <span className="text-base font-semibold text-gray-800">{n1(pesoVenta)} kg</span>
                <span className="text-[9px] text-gray-400">{bandaVenta}</span>
              </div>
            </div>

            {/* Bruto ↔ neto: el que se escribe manda y el otro se recalcula, también
                cuando cambia la CZ. */}
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500">
                  Precio $/kg bruto {modoPrecio === "bruto" && <span className="text-emerald-600">←</span>}
                </label>
                <Input className="h-8 text-right"
                  // Cuando manda el NETO, este campo muestra el bruto DERIVADO — no el
                  // guardado. Si no, se computaba bien por dentro pero el input quedaba
                  // vacío y no se veía el resultado ni el efecto de cambiar la CZ.
                  value={modoPrecio === "neto"
                    ? (precioNetoManual.trim() === "" ? "" : fmtAR(precioBruto))
                    : (f.precio_kg_override ?? "")}
                  onChange={e => { setModoPrecio("bruto"); setF({ ...f, precio_kg_override: e.target.value }) }} />
                <p className="mt-1 text-[10px] text-gray-400">vacío = usa la banda</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">
                  …o neto de CZ {modoPrecio === "neto" && <span className="text-emerald-600">←</span>}
                </label>
                <Input className="h-8 text-right" value={precioNetoTxt}
                  onChange={e => { setModoPrecio("neto"); setPrecioNetoManual(e.target.value) }} />
                <p className="mt-1 text-[10px] text-gray-400">
                  {modoPrecio === "neto" ? "manda este; el bruto se calcula" : "se calcula del bruto"}
                </p>
              </div>
              <div className="flex flex-col justify-center rounded bg-white px-2 py-1">
                <span className="text-[10px] text-gray-500">Se cobra por kg</span>
                <span className="text-base font-semibold text-emerald-800">
                  {precioBruto > 0 ? fmtAR(precioBruto * (1 - pctCzNum)) : "—"}
                </span>
                <span className="text-[9px] text-gray-400">bruto {fmtAR(precioBruto)} − CZ</span>
              </div>
            </div>

            {/* Desbaste y CZ, con lo que dice la tabla al lado */}
            <div className="mt-3 grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500">% Desbaste</label>
                <Input className="h-8 text-right" value={f.pct_desbaste ?? ""}
                  onChange={e => setF({ ...f, pct_desbaste: e.target.value })} />
                <p className={`mt-1 text-[10px] ${desbTabla !== parseNum(String(f.pct_desbaste ?? "0")) ? "text-amber-600" : "text-gray-400"}`}>
                  tabla: {n1(desbTabla)}%
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">% CZ</label>
                <Input className="h-8 text-right" value={f.pct_cz ?? ""}
                  onChange={e => setF({ ...f, pct_cz: e.target.value })} />
                <p className={`mt-1 text-[10px] ${czTabla !== parseNum(String(f.pct_cz ?? "0")) ? "text-amber-600" : "text-gray-400"}`}>
                  tabla: {n1(czTabla)}%
                </p>
              </div>
              {campo("alicuota_iva", "% IVA", "hacienda 10,5")}
              {campo("alicuota_iibb", "% IIBB", "mes siguiente")}
            </div>

            {(desbTabla !== parseNum(String(f.pct_desbaste ?? "0"))
              || czTabla !== parseNum(String(f.pct_cz ?? "0"))) && (
              <button type="button"
                className="mt-1.5 text-[11px] text-blue-600 underline"
                onClick={() => setF({ ...f, pct_desbaste: n1(desbTabla), pct_cz: n1(czTabla) })}>
                Aplicar los valores de la tabla ({n1(desbTabla)}% y {n1(czTabla)}%)
              </button>
            )}

            {/* Desglose: por cabeza y por lote, siempre las dos columnas */}
            <table className="mt-3 w-full text-[11px]">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-0.5 text-left font-medium">
                      {fv ? "a la fecha de venta" : "a hoy (sin fecha de venta)"}
                    </th>
                    <th className="py-0.5 text-right font-medium">por cabeza</th>
                    <th className="py-0.5 text-right font-medium">por lote ({n0(cab)})</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Peso bruto", `${n1(pesoVenta)} kg`, `${n0(kgB)} kg`, ""],
                    ["− Desbaste", `−${n1(pesoVenta - pesoNetoUni)} kg`, `−${n0(kgD)} kg`, "text-amber-700"],
                    ["Kg netos (se cobran)", `${n1(pesoNetoUni)} kg`, `${n0(kgN)} kg`, "font-semibold"],
                    ["Venta neta", pr > 0 ? fmtPesos(vn / (cab || 1)) : "falta precio", pr > 0 ? fmtPesos(vn) : "—", "font-semibold"],
                    ["+ IVA", fmtPesos(iva / (cab || 1)), fmtPesos(iva), "text-gray-500"],
                    ["Total factura", fmtPesos((vn + iva) / (cab || 1)), fmtPesos(vn + iva), ""],
                    ["− CZ", `−${fmtPesos(cz / (cab || 1))}`, `−${fmtPesos(cz)}`, "text-amber-700"],
                    ["INGRESA", fmtPesos((vn + iva - cz) / (cab || 1)), fmtPesos(vn + iva - cz), "font-bold text-emerald-800"],
                    ["IIBB (mes sig.)", `−${fmtPesos(iibb / (cab || 1))}`, `−${fmtPesos(iibb)}`, "text-amber-700"],
                  ].map(([l, u, t, c]) => (
                    <tr key={l as string} className="border-b border-gray-100 last:border-0">
                      <td className={`py-0.5 ${c}`}>{l}</td>
                      <td className={`py-0.5 text-right ${c}`}>{u}</td>
                      <td className={`py-0.5 text-right ${c}`}>{t}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>

          {dias > 0 && parseNum(String(f.ganancia_diaria_kg ?? "0")) > 0 && (
            <p className="rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Pasaron <strong>{dias} días</strong> → peso estimado hoy:{" "}
              <strong>{n1(pesoHoy)} kg</strong>
            </p>
          )}

          <div>
            <label className="text-xs text-gray-500">Notas</label>
            <Input className="h-8" value={f.notas || ""}
              onChange={e => setF({ ...f, notas: e.target.value })} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
            <Button onClick={async () => {
              // Los tramos primero: si fallan, el lote no se guarda y no queda medio hecho.
              if (f.id && !(await persistirTramos(f.id))) return
              await onGuardar({
                ...f,
                // Si se escribio el NETO, lo que se persiste es el bruto equivalente
                precio_kg_override: modoPrecio === "neto"
                  ? (precioNetoManual.trim() === "" ? "" : fmtAR(precioBruto))
                  : f.precio_kg_override,
              })
            }}>Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal: cargar el stock inicial DESDE UNA PESADA REAL ──────────────────────
// La pesada de destete ya tiene el peso por animal. Agrupando por sexo y por el flag
// `es_torito` salen los pesos promedio REALES de cada grupo, en vez de usar el promedio
// de toda la tropa (que mezcla machos, hembras y toritos).
//
// ⚠️ `terneros.es_torito` está sobrecargado: en los machos marca los TORITOS y en las
// hembras marca las RETENIDAS para reposición (así lo usa el análisis de engorde).

interface GrupoPesada {
  clave: string
  sexo: string
  marcado: boolean
  cabezas: number
  peso_prom: number
  kg_total: number
  /** Pesos individuales ORDENADOS DESC. Permiten sacar el promedio de cualquier subconjunto:
   *  si se venden los 55 más pesados, los 40 que quedan tienen otro promedio. */
  pesos: number[]
  /** Fecha de la pesada de la que salió el peso (en modo "última" varía por grupo). */
  fecha_pesada: string | null
  categoria: string
  esRetencion: boolean
  /** Cabezas de este grupo que ya se cargaron como lote. */
  yaCargadas: number
}

function ModalDesdePesada({ abierto, lotes, ventasDe, onCerrar, onListo }: {
  abierto: boolean
  lotes: LoteStock[]
  ventasDe: (loteId: string) => VentaStock[]
  onCerrar: () => void
  onListo: () => Promise<void>
}) {
  const [cargando, setCargando] = useState(false)
  const [fechas, setFechas] = useState<{ fecha: string; n: number }[]>([])
  const [fecha, setFecha] = useState("")
  /**
   * "ultima" = el peso MÁS RECIENTE de cada animal, aunque sean de pesadas distintas.
   * Es lo que corresponde para la recría de hoy: los machos se pesaron el 6/7 y los
   * toritos el 4/5, y una sola fecha deja a un grupo afuera.
   */
  const [modo, setModo] = useState<"ultima" | "fecha">("ultima")
  const [grupos, setGrupos] = useState<GrupoPesada[]>([])
  const [sel, setSel] = useState<Record<string, boolean>>({})
  /** Cantidad y peso por grupo: se puede traer sólo una parte, y el peso se puede pisar. */
  const [edits, setEdits] = useState<Record<string, { cant: string; peso: string; cual: "pesados" | "livianos" | "todos" }>>({})
  const [ganancia, setGanancia] = useState("0,5")
  // Variables de la venta, comunes a todos los grupos que se traigan de una vez
  const [fechaVenta, setFechaVenta] = useState("")
  const [plazo, setPlazo] = useState("0")
  const [precio, setPrecio] = useState("")
  const [guardando, setGuardando] = useState(false)

  // Fechas de pesada disponibles
  useEffect(() => {
    if (!abierto) return
    ;(async () => {
      setCargando(true)
      try {
        const { data } = await supabase.schema("productivo")
          .from("pesadas_terneros").select("fecha")
        const conteo = new Map<string, number>()
        for (const r of (data || []) as any[]) {
          conteo.set(r.fecha, (conteo.get(r.fecha) ?? 0) + 1)
        }
        const lista = Array.from(conteo.entries())
          .map(([f, n]) => ({ fecha: f, n }))
          .sort((a, b) => b.fecha.localeCompare(a.fecha))
        setFechas(lista)
        if (lista.length) setFecha(prev => prev || lista[0].fecha)
      } finally { setCargando(false) }
    })()
  }, [abierto])

  // Agrupar la pesada elegida por sexo x marcado
  useEffect(() => {
    if (!abierto || !fecha) return
    ;(async () => {
      setCargando(true)
      try {
        const q = supabase.schema("productivo")
          .from("pesadas_terneros")
          .select("ternero_id, fecha, peso_kg, ternero:terneros!inner(sexo, es_torito, activo)")
        const { data, error } = modo === "fecha" ? await q.eq("fecha", fecha) : await q
        if (error) { console.error(error); return }

        // ⚠️ Fuera los dados de baja. Sus pesadas siguen existiendo, así que sin este filtro un
        // animal ya vendido se volvía a ofrecer para presupuestar su venta.
        let filas = ((data || []) as any[]).filter(r => r.ternero?.activo !== false)
        if (modo === "ultima") {
          const ultima = new Map<string, any>()
          for (const r of filas) {
            const prev = ultima.get(r.ternero_id)
            if (!prev || String(r.fecha) > String(prev.fecha)) ultima.set(r.ternero_id, r)
          }
          filas = Array.from(ultima.values())
        }

        const acc = new Map<string, { sexo: string; marcado: boolean; n: number; kg: number; fmax: string; pesos: number[] }>()
        for (const r of filas) {
          const t = r.ternero
          if (!t) continue
          const sexo = String(t.sexo ?? "")
          const marcado = !!t.es_torito
          const k = `${sexo}|${marcado}`
          const cur = acc.get(k) ?? { sexo, marcado, n: 0, kg: 0, fmax: "", pesos: [] as number[] }
          cur.n += 1
          cur.kg += Number(r.peso_kg) || 0
          cur.pesos.push(Number(r.peso_kg) || 0)
          if (String(r.fecha) > cur.fmax) cur.fmax = String(r.fecha)
          acc.set(k, cur)
        }

        const esMacho = (s: string) => /macho/i.test(s)
        const out: GrupoPesada[] = Array.from(acc.entries()).map(([clave, g]) => ({
          clave,
          sexo: g.sexo,
          marcado: g.marcado,
          cabezas: g.n,
          peso_prom: g.n ? g.kg / g.n : 0,
          kg_total: g.kg,
          pesos: [...g.pesos].sort((a, b) => b - a),   // desc: los más pesados primero
          fecha_pesada: g.fmax || null,
          /**
           * Lo que ya se cargó de este grupo, para no volver a ofrecerlo.
           *
           * ⚠️ **Sólo los lotes SIN venta registrada.** El grupo son los animales **activos**:
           * los vendidos ya salieron de ahí. Sumar también sus lotes comparaba peras con
           * manzanas — con 48 machos activos y 95 cabezas en lotes (55 vendidos + 40), la
           * cuenta daba 0 y la pantalla mostraba "de 48" como si faltara cargar todo.
           */
          yaCargadas: lotes
            .filter(l => l.origen === "stock_inicial" && l.categoria === (esMacho(g.sexo)
              ? (g.marcado ? "Torito" : "Ternero Recria") : "Ternera Recria"))
            .filter(l => ventasDe(l.id).length === 0)
            .reduce((n, l) => n + Number(l.cantidad || 0), 0),
          categoria: esMacho(g.sexo)
            ? (g.marcado ? "Torito" : "Ternero Recria")
            : "Ternera Recria",
          // Hembra marcada = retenida para reposicion: NO se vende
          esRetencion: !esMacho(g.sexo) && g.marcado,
        })).sort((a, b) => a.sexo.localeCompare(b.sexo) || Number(a.marcado) - Number(b.marcado))

        setGrupos(out)
        // Por defecto se traen los vendibles; la retencion queda destildada
        const init: Record<string, boolean> = {}
        const ini: Record<string, { cant: string; peso: string; cual: "pesados" | "livianos" | "todos" }> = {}
        out.forEach(g => {
          const quedan = Math.max(0, g.cabezas - g.yaCargadas)
          init[g.clave] = !g.esRetencion && quedan > 0
          ini[g.clave] = { cant: String(quedan), peso: "", cual: "pesados" }
        })
        setSel(init)
        setEdits(ini)
      } finally { setCargando(false) }
    })()
  }, [abierto, fecha, modo])

  if (!abierto) return null
  const elegidos = grupos.filter(g => sel[g.clave])
  /**
   * Promedio del subconjunto que se lleva y del que queda. Si se venden los 55 más
   * pesados, los 40 restantes tienen OTRO promedio: hay que calcularlo con los pesos
   * individuales, no con el promedio general.
   */
  const promedios = (g: GrupoPesada, cant: number, cual: "pesados" | "livianos" | "todos") => {
    const n = Math.max(0, Math.min(Math.round(cant), g.pesos.length))
    if (!g.pesos.length) return { tomados: g.peso_prom, resto: g.peso_prom, quedan: 0 }
    const prom = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0

    // "Indistinto": se llevan cabezas al azar, así que los dos lados quedan en el
    // promedio general. Antes tomaba el promedio general para los que se iban pero el
    // de los más livianos para el resto — inconsistente.
    if (cual === "todos") {
      return { tomados: g.peso_prom, resto: g.peso_prom, quedan: g.pesos.length - n }
    }

    const orden = cual === "livianos" ? [...g.pesos].reverse() : g.pesos
    return {
      tomados: prom(orden.slice(0, n)),
      resto: prom(orden.slice(n)),
      quedan: g.pesos.length - n,
    }
  }

  const diasDesdePesada = fecha
    ? Math.max(0, Math.round((Date.now() - new Date(fecha + "T00:00:00").getTime()) / 86400000))
    : 0

  /**
   * Días de engorde entre el peso que se está usando y la fecha de venta.
   *
   * ⚠️ Se cuentan **desde la fecha del peso**, no desde hoy (A-BUG-59). El peso que se guarda es
   * el de la PESADA, así que contar desde hoy le come los días que van de la pesada a hoy: con
   * la pesada del 3/8 y venta el 20/9 daba 236,9 kg en vez de 259,9 — 23 kg, suficiente para
   * caer en otra banda de peso, y de la banda salen el desbaste, la CZ y el precio.
   *
   * Es el mismo criterio que el resto de la app: la ganancia se cuenta desde `fecha_peso`.
   * Sólo cuando el peso se escribe a mano la referencia es hoy, porque ese peso es de hoy.
   */
  const diasHastaVenta = (fechaDelPeso: string): number => {
    if (!fechaVenta || !fechaDelPeso) return 0
    const d = Math.round((new Date(fechaVenta + "T00:00:00").getTime()
      - new Date(fechaDelPeso + "T00:00:00").getTime()) / 86400000)
    return Math.max(0, d)
  }

  const hoyISO = new Date().toISOString().slice(0, 10)

  /** El peso con el que se va a facturar: el de partida más el engorde hasta la venta. */
  const pesoALaVenta = (g: GrupoPesada, base: number, manual: boolean) =>
    base + diasHastaVenta(manual ? hoyISO : (g.fecha_pesada ?? fecha)) * parseNum(ganancia)

  /**
   * IDEMPOTENTE por (pesada, categoría): si el lote ya existe lo ACTUALIZA en vez de
   * duplicar. Es lo que permite marcar más animales de reposición en Productivo y volver
   * a correr esto: la cantidad y el peso promedio se recalculan solos desde los animales
   * que quedaron. Corregir la cantidad a mano dejaría el peso mal — el promedio cambia
   * según qué animales se van.
   */
  const aplicar = async () => {
    setGuardando(true)
    try {
      for (const g of elegidos) {
        const existente = lotes.find(l =>
          l.origen === "stock_inicial" && l.categoria === g.categoria && l.fecha_disponible === fecha)

        const e = edits[g.clave]
        const cant = e && e.cant.trim() !== "" ? parseNum(e.cant) : g.cabezas
        const pesoManual = e && e.peso.trim() !== "" ? parseNum(e.peso) : null
        // El promedio de los que se llevan, no el del grupo entero
        const pr = promedios(g, cant, e?.cual ?? "pesados")
        const pesoBase = pesoManual ?? pr.tomados
        const pesoVenta = pesoALaVenta(g, pesoBase, pesoManual != null)

        const payload = {
          cantidad: cant,
          peso_base_kg: pesoManual ?? Math.round(pr.tomados * 100) / 100,
          // El peso corresponde a la fecha de la pesada, salvo que se haya puesto a mano
          // (en ese caso es de hoy).
          fecha_peso: pesoManual ? new Date().toISOString().slice(0, 10) : (g.fecha_pesada ?? fecha),
          ganancia_diaria_kg: parseNum(ganancia),
          fecha_venta_estimada: fechaVenta || null,
          plazo_cobro: plazo || "0",
          precio_kg_override: precio.trim() === "" ? null : parseNum(precio),
          // El desbaste y la CZ salen de la tabla según el peso A LA VENTA, contando el engorde
          // desde la fecha DEL PESO — no desde hoy. Ver `diasHastaVenta` (A-BUG-59).
          pct_desbaste: pctDesbaste(g.categoria, pesoVenta),
          pct_cz: pctCz(g.categoria, pesoVenta),
          notas: `Desde pesada ${fecha} — ${g.sexo}${g.marcado ? " marcado" : ""}, ${cant} de ${g.cabezas} cab`
            + (pesoManual ? `, peso puesto a mano` : `, promedio real`),
          updated_at: new Date().toISOString(),
        }

        // ⚠️ Desde acá SÓLO se crean lotes; **nunca se actualiza uno existente**.
        //
        // Lo pidió el usuario (2026-08-27): *"actualizar de ahí no es conveniente, para editar
        // ya lo puedo hacer desde el lote cargado"*. Y tenía razón: esta pantalla recalcula
        // cantidad y peso promedio desde la pesada, así que pisaría cualquier ajuste hecho a
        // mano —tramos, ganancia, desbaste— sin decir que lo estaba pisando.
        //
        // Lo que se trae es **lo que falta**, y va a un lote nuevo.
        void existente
        const { error } = await supabase.schema("productivo").from("stock_lotes").insert({
          empresa: "MSA", ciclo_id: null,
          categoria: g.categoria, origen: "stock_inicial",
          fecha_disponible: fecha,
          ...payload,
        })
        if (error) { alert("Error: " + error.message); return }
      }
      onCerrar()
      await onListo()
    } finally { setGuardando(false) }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Cargar stock inicial desde una pesada</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500">Origen del peso</label>
              <Select value={modo} onValueChange={(v: any) => setModo(v)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ultima">Última pesada de cada animal</SelectItem>
                  <SelectItem value="fecha">Una pesada puntual</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[10px] text-gray-400">
                {modo === "ultima"
                  ? "toma el peso más reciente de cada animal, aunque sean fechas distintas"
                  : "todos de la misma fecha"}
              </p>
            </div>
            <div className={modo === "ultima" ? "opacity-40 pointer-events-none" : ""}>
              <label className="text-xs text-gray-500">Pesada</label>
              <Select value={fecha} onValueChange={setFecha}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                <SelectContent>
                  {fechas.map(f => (
                    <SelectItem key={f.fecha} value={f.fecha}>
                      {new Date(f.fecha + "T00:00:00").toLocaleDateString("es-AR")} — {f.n} pesadas
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Ganancia diaria (kg/día)</label>
              <Input className="h-8 text-right" value={ganancia}
                onChange={e => setGanancia(e.target.value)} />
              <p className="mt-1 text-[10px] text-gray-400">se aplica a todos los lotes que traigas</p>
            </div>
          </div>

          {/* Venta presupuestada — sin fecha el lote entra como stock, no como ingreso */}
          <div className="rounded border border-emerald-200 bg-emerald-50/40 p-2.5">
            <p className="mb-2 text-[11px] font-medium text-emerald-900">
              Venta presupuestada (opcional) — se aplica a todo lo que traigas ahora
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500">Fecha de venta</label>
                <Input type="date" className="h-8" value={fechaVenta}
                  onChange={e => setFechaVenta(e.target.value)} />
                <p className="mt-1 text-[10px] text-gray-400">vacío = queda como stock</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Plazo de cobro</label>
                <Input className="h-8 text-right" placeholder="30/60/90" value={plazo}
                  onChange={e => setPlazo(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Precio $/kg</label>
                <Input className="h-8 text-right" placeholder="de la banda" value={precio}
                  onChange={e => setPrecio(e.target.value)} />
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-500">
              El desbaste y la CZ se toman de la tabla según el peso a la fecha de venta.
              Todo se puede ajustar después por lote.
            </p>
          </div>

          {cargando ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leyendo la pesada...
            </div>
          ) : grupos.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              Esa pesada no tiene animales con sexo cargado.
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Pesos promedio <strong>reales de cada grupo</strong>, no el de la tropa entera.
              </p>
              <div className="space-y-2">
                {grupos.map(g => (
                  <label key={g.clave}
                    className="flex cursor-pointer items-center gap-3 rounded border p-2.5 hover:bg-gray-50">
                    <input type="checkbox" checked={sel[g.clave] ?? false}
                      onChange={e => setSel(s => ({ ...s, [g.clave]: e.target.checked }))} />
                    <div className="flex-1 text-sm">
                      <div className="flex items-center gap-2">
                        <strong>{g.categoria}</strong>
                        <span className="text-xs text-gray-400">
                          {g.sexo}{g.marcado ? " · marcado" : ""}
                          {g.fecha_pesada && (
                            <> · pesada {new Date(g.fecha_pesada + "T00:00:00").toLocaleDateString("es-AR")}</>
                          )}
                          {g.yaCargadas > 0 && (
                            <span className="ml-1 text-blue-600">
                              · {n0(g.yaCargadas)} ya cargadas
                            </span>
                          )}
                        </span>
                        {g.esRetencion && (
                          <Badge variant="outline" className="text-[10px]">retención — no se vende</Badge>
                        )}
                      </div>
                      <div className={`mt-1.5 flex flex-wrap items-center gap-2 ${
                        g.cabezas - g.yaCargadas <= 0 ? "hidden" : ""}`}>
                        <span className="text-[10px] text-gray-500">Traer</span>
                        <Input className="h-7 w-16 text-right text-xs"
                          value={edits[g.clave]?.cant ?? ""}
                          onClick={e => e.preventDefault()}
                          onChange={e => setEdits(p => ({ ...p, [g.clave]: { ...(p[g.clave] ?? { cant: "", peso: "" }), cant: e.target.value } }))} />
                        <span className="text-[10px] text-gray-500">de {g.cabezas} · peso</span>
                        {/* El placeholder muestra lo que hace dejarlo vacío: el promedio DE LA
                            PESADA. Antes mostraba el proyectado a hoy, que es otro número — y
                            escribirlo a mano significa además "este peso es de hoy". */}
                        <Input className="h-7 w-20 text-right text-xs"
                          placeholder={n1(g.peso_prom)}
                          value={edits[g.clave]?.peso ?? ""}
                          onClick={e => e.preventDefault()}
                          onChange={e => setEdits(p => ({ ...p, [g.clave]: { ...(p[g.clave] ?? { cant: "", peso: "" }), peso: e.target.value } }))} />
                        <span className="text-[10px] text-gray-400">kg — vacío usa el calculado</span>
                        {/* Si te llevás TODOS, elegir cuáles no significa nada: son todos, y el
                            promedio es el mismo en los tres casos. Mostrar el selector sugería
                            que el número podía cambiar (A-BUG-61). */}
                        {(() => {
                          const cant = edits[g.clave] ? parseNum(edits[g.clave]!.cant) : g.cabezas
                          if (cant >= g.cabezas) {
                            return <span className="text-[10px] text-gray-400">— son todos</span>
                          }
                          return (
                            <select
                              className="h-7 rounded border px-1 text-[10px]"
                              value={edits[g.clave]?.cual ?? "pesados"}
                              onClick={e => e.preventDefault()}
                              onChange={e => setEdits(p => ({ ...p, [g.clave]: { ...(p[g.clave] ?? { cant: "", peso: "", cual: "pesados" }), cual: e.target.value as any } }))}>
                              <option value="pesados">los más pesados</option>
                              <option value="livianos">los más livianos</option>
                              <option value="todos">indistinto (promedio)</option>
                            </select>
                          )
                        })()}
                      </div>
                      {(() => {
                        const e = edits[g.clave]
                        const cant = e ? parseNum(e.cant) : 0
                        if (cant <= 0 || cant >= g.pesos.length) return null
                        const pr = promedios(g, cant, e?.cual ?? "pesados")
                        return (
                          <div className="mt-1 rounded bg-blue-50 px-2 py-1 text-[10px] text-blue-900">
                            Se llevan <strong>{n0(cant)}</strong> a{" "}
                            <strong>{n1(pr.tomados)} kg</strong> · quedan{" "}
                            <strong>{n0(pr.quedan)}</strong> a <strong>{n1(pr.resto)} kg</strong>
                          </div>
                        )
                      })()}
                      <div className="text-xs text-gray-600">
                        <strong>{g.cabezas}</strong> con pesada
                        {g.yaCargadas > 0 && (
                          <span className="text-gray-500"> · {n0(g.yaCargadas)} ya en lotes</span>
                        )}
                        {" · "}
                        {g.cabezas - g.yaCargadas > 0 ? (
                          <strong className="text-blue-700">quedan {n0(g.cabezas - g.yaCargadas)}</strong>
                        ) : (
                          <strong className="text-emerald-700">ya está todo cargado</strong>
                        )}
                        {" · pesada "}
                        <strong>{n1(g.peso_prom)} kg</strong>
                        {/* El peso de la pesada es histórico. Lo que importa es el peso A LA
                            VENTA —con el que se factura y con el que se elige la banda—, y sólo
                            si no hay fecha de venta el de hoy (A-BUG-60). */}
                        {parseNum(ganancia) > 0 && fechaVenta && diasHastaVenta(g.fecha_pesada ?? fecha) > 0 ? (
                          <> → a la venta <strong className="text-emerald-700">
                            {n1(g.peso_prom + diasHastaVenta(g.fecha_pesada ?? fecha) * parseNum(ganancia))} kg
                          </strong>{" "}
                          <span className="text-gray-400">
                            ({diasHastaVenta(g.fecha_pesada ?? fecha)} días · hoy {n1(g.peso_prom + diasDesdePesada * parseNum(ganancia))} kg)
                          </span></>
                        ) : diasDesdePesada > 0 && parseNum(ganancia) > 0 ? (
                          <> → hoy <strong className="text-emerald-700">
                            {n1(g.peso_prom + diasDesdePesada * parseNum(ganancia))} kg
                          </strong>{" "}
                          <span className="text-gray-400">({diasDesdePesada} días)</span></>
                        ) : null}
                        {g.cabezas - g.yaCargadas <= 0 && (
                          <span className="ml-2 text-gray-500">
                            · se edita desde el lote, no desde acá
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="rounded bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                El flag <code>es_torito</code> está sobrecargado: en los <strong>machos</strong>{" "}
                marca los toritos, y en las <strong>hembras</strong> marca las retenidas para
                reposición. Por eso las hembras marcadas vienen destildadas.
                <br />
                <strong>Si cambiás la reposición</strong>, marcá los animales en Productivo →
                Recría (modo reposición) y volvé a correr esto: la cantidad y el peso promedio se
                recalculan solos. Corregir la cantidad a mano dejaría el peso mal.
              </p>
            </>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-gray-400">
              {elegidos.length} grupo(s) · {n0(elegidos.reduce((s, g) => s + g.cabezas, 0))} cabezas
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
              <Button disabled={guardando || elegidos.length === 0} onClick={aplicar}>
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cargar lotes"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal: previsualizar y elegir qué lotes generar desde los períodos ────────
// Antes generaba todo de una sin preguntar. Ahora se ve de dónde sale cada fila, se
// tildan las que se quieren, y se pueden abrir para ajustar los defaults antes de crear.

interface FilaGenerar {
  clave: string
  campania: string
  ciclo_id: string
  categoria: string
  origen: "destete" | "descarte"
  cantidad: number
  peso: number
  fecha_disponible: string
  /** De dónde sale el número, para que se entienda sin tener que deducirlo. */
  procedencia: string
  yaExiste: boolean
  tieneVentas: boolean
}

function ModalGenerar({ abierto, filas, onCerrar, onAplicar, guardando }: {
  abierto: boolean
  filas: FilaGenerar[]
  onCerrar: () => void
  onAplicar: (sel: { fila: FilaGenerar; ajustes: AjusteFila }[]) => Promise<void>
  guardando: boolean
}) {
  const [sel, setSel] = useState<Record<string, boolean>>({})
  const [abierta, setAbierta] = useState<Record<string, boolean>>({})
  const [ajustes, setAjustes] = useState<Record<string, AjusteFila>>({})

  useEffect(() => {
    if (!abierto) return
    const s: Record<string, boolean> = {}
    const a: Record<string, AjusteFila> = {}
    for (const f of filas) {
      // Los que ya tienen ventas no se tocan: ahí manda lo que se decidió
      s[f.clave] = !f.tieneVentas
      // La fecha de venta nunca puede quedar en el pasado: si el destete ya paso, hoy.
      const hoyISO = new Date().toISOString().slice(0, 10)
      a[f.clave] = {
        cantidad: String(f.cantidad.toFixed(1)),
        peso: String(f.peso),
        ganancia: "0",
        fecha_venta: f.fecha_disponible > hoyISO ? f.fecha_disponible : hoyISO,
        plazo: "0",
        precio: "",
        // Salen de la tabla por peso; igual quedan editables
        desbaste: String(pctDesbaste(f.categoria, f.peso) * 100).replace(".", ","),
        cz: String(pctCz(f.categoria, f.peso) * 100).replace(".", ","),
      }
    }
    setSel(s); setAjustes(a); setAbierta({})
  }, [abierto, filas])

  if (!abierto) return null
  const elegidas = filas.filter(f => sel[f.clave])

  const setAj = (clave: string, campo: keyof AjusteFila, v: string) =>
    setAjustes(p => ({ ...p, [clave]: { ...p[clave]!, [campo]: v } }))

  // Agrupadas por campaña para que se entienda la procedencia
  const porCampania = filas.reduce((acc, f) => {
    (acc[f.campania] ??= []).push(f); return acc
  }, {} as Record<string, FilaGenerar[]>)

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Generar lotes desde los períodos</DialogTitle></DialogHeader>

        <p className="text-xs text-gray-500">
          Sale de la línea de tiempo del rodeo. Tildá lo que quieras crear y abrí cualquier fila
          para ajustar los valores antes de generarla. Si el lote ya existe se{" "}
          <strong>actualiza</strong>; si ya tiene ventas registradas no se toca.
        </p>

        {Object.entries(porCampania).map(([camp, fs]) => (
          <div key={camp} className="rounded border">
            <div className="border-b bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
              Campaña {camp}
            </div>
            <div className="divide-y">
              {fs.map(f => {
                const a = ajustes[f.clave]
                if (!a) return null
                const abiertaF = abierta[f.clave] ?? false
                return (
                  <div key={f.clave} className={f.tieneVentas ? "bg-gray-50 opacity-60" : ""}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <input type="checkbox" disabled={f.tieneVentas}
                        checked={sel[f.clave] ?? false}
                        onChange={e => setSel(p => ({ ...p, [f.clave]: e.target.checked }))} />
                      <button type="button" className="flex-1 text-left"
                        onClick={() => setAbierta(p => ({ ...p, [f.clave]: !abiertaF }))}>
                        <div className="flex items-center gap-2 text-sm">
                          {abiertaF ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                          <strong>{f.categoria}</strong>
                          <Badge variant="outline" className="text-[10px]">{f.origen}</Badge>
                          <span className="text-gray-600">
                            {n1(f.cantidad)} cab · {n1(f.peso)} kg
                          </span>
                          {a.fecha_venta && (
                            <span className="text-emerald-700">
                              vende {new Date(a.fecha_venta + "T00:00:00").toLocaleDateString("es-AR")}
                              {a.plazo !== "0" && <span className="text-gray-400"> · {a.plazo}d</span>}
                            </span>
                          )}
                          {f.yaExiste && !f.tieneVentas && (
                            <Badge variant="outline" className="text-[10px]">actualiza</Badge>
                          )}
                          {f.tieneVentas && (
                            <Badge variant="outline" className="text-[10px]">tiene ventas — no se toca</Badge>
                          )}
                        </div>
                        <p className="ml-5 text-[11px] text-gray-400">{f.procedencia}</p>
                      </button>
                    </div>

                    {abiertaF && (
                      <div className="grid grid-cols-5 gap-2 border-t bg-gray-50/50 px-3 py-2 pl-10">
                        <div>
                          <label className="text-[10px] text-gray-500">Cabezas</label>
                          <Input className="h-7 text-right text-xs" value={a.cantidad}
                            onChange={e => setAj(f.clave, "cantidad", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500">Peso base kg</label>
                          <Input className="h-7 text-right text-xs" value={a.peso}
                            onChange={e => setAj(f.clave, "peso", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500">kg/día</label>
                          <Input className="h-7 text-right text-xs" value={a.ganancia}
                            onChange={e => setAj(f.clave, "ganancia", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500">Fecha venta</label>
                          <Input type="date" className="h-7 text-xs" value={a.fecha_venta}
                            onChange={e => setAj(f.clave, "fecha_venta", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500">Plazo cobro</label>
                          <Input className="h-7 text-right text-xs" placeholder="30/60/90"
                            value={a.plazo} onChange={e => setAj(f.clave, "plazo", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500">Precio $/kg</label>
                          <Input className="h-7 text-right text-xs" placeholder="de tabla"
                            value={a.precio} onChange={e => setAj(f.clave, "precio", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500">% Desbaste</label>
                          <Input className="h-7 text-right text-xs" value={a.desbaste}
                            onChange={e => setAj(f.clave, "desbaste", e.target.value)} />
                          <p className="text-[9px] text-gray-400">tabla: {pctDesbaste(f.categoria, f.peso) * 100}%</p>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500">% CZ</label>
                          <Input className="h-7 text-right text-xs" value={a.cz}
                            onChange={e => setAj(f.clave, "cz", e.target.value)} />
                          <p className="text-[9px] text-gray-400">tabla: {pctCz(f.categoria, f.peso) * 100}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-[11px] text-gray-400">
            {elegidas.length} de {filas.length} · {n0(elegidas.reduce((s, f) =>
              s + parseNum(ajustes[f.clave]?.cantidad ?? "0"), 0))} cabezas
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
            <Button disabled={guardando || elegidas.length === 0}
              onClick={() => onAplicar(elegidas.map(f => ({ fila: f, ajustes: ajustes[f.clave]! })))}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Tramos de actividad del lote ──────────────────────────────────────────────
//
// Acá se dice "este lote hace recría del 1/4 al 30/9 y engorde después". De eso salen dos
// cosas a la vez: la CURVA DE PESO (que define el peso a la venta, y por lo tanto la banda de
// precio y la factura) y el COSTO de alimentación. Antes la ganancia diaria se tipeaba suelta
// en el lote y podía no tener nada que ver con lo que se le estaba dando de comer.
//
// ⚠️ Esta sección NO toca la base. Trabaja sobre el borrador del modal y se persiste con el
// botón Guardar; Cancelar la descarta. Antes escribía al instante y Cancelar no revertía nada
// (A-BUG-54): el usuario canceló, el tramo quedó, y con la fecha de fin un año adelantada.

function SeccionTramos({
  loteId, lote, tramos, actividades, insumos, onCambiarTramos, onGananciaOverride,
}: {
  loteId: string | null
  lote: LoteCurva
  /** El borrador del modal — ya viene filtrado por lote. */
  tramos: TramoLote[]
  actividades: Actividad[]
  insumos: InsumoActividad[]
  onCambiarTramos: (t: TramoLote[]) => void
  onGananciaOverride: (v: boolean) => void
}) {
  /**
   * Lo que se está tipeando en cada campo de ganancia, sin formatear.
   *
   * ⚠️ Un input controlado que **reformatea en cada tecla** es imposible de editar: escribís `1`
   * y se convierte en `1,000`, así que el cursor salta y ya no podés seguir escribiendo `1,05`;
   * borrar es peor. El valor se muestra crudo mientras el campo tiene foco y se formatea recién
   * al salir. Lo reportó el usuario (2026-08-27): *"no responden bien, borrar, escribir desde
   * cero"*.
   */
  const [tipeando, setTipeando] = useState<Record<string, string>>({})

  const mios = [...tramos]
    .sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde) || a.orden - b.orden)
  const pisados = solapamientos(mios)
  const manual = gananciaEsManual(lote, mios)

  // Hasta dónde dibujar la curva: la venta si está, si no el final del último tramo
  const hasta = String(lote.fecha_peso || lote.fecha_disponible || "")
  const fin = (lote as any).fecha_venta_estimada || mios[mios.length - 1]?.fecha_hasta || hasta
  const segs = segmentosCurva(lote, mios, actividades, fin)

  const costo = tramosParaCosto(lote, mios, actividades, insumos)
    .flatMap(t => consumoMensual(t))
  const costoTotal = costo.reduce((s, m) => s + m.costo_total, 0)
  const cab = Number(lote.cantidad) || 0

  /**
   * El fin por defecto es **la fecha de venta del lote** si está cargada, y sólo si no hay se
   * usan 6 meses. Antes eran 6 meses siempre, y de ahí salió el tramo que terminaba en 2027
   * para un lote vendido en agosto de 2026 (A-BUG-54).
   */
  const agregar = () => {
    if (!loteId) return
    const ultimo = mios[mios.length - 1]
    const desde = ultimo?.fecha_hasta || String(lote.fecha_peso || lote.fecha_disponible || "").slice(0, 10)
    const venta = String((lote as any).fecha_venta_estimada || "")
    let hasta = venta && venta > desde ? venta : ""
    if (!hasta) {
      const d = new Date(desde + "T00:00:00")
      d.setMonth(d.getMonth() + 6)
      hasta = d.toISOString().slice(0, 10)
    }
    onCambiarTramos([...tramos, {
      id: crypto.randomUUID(),
      lote_id: loteId,
      actividad_id: actividades[0]!.id,
      orden: mios.length + 1,
      fecha_desde: desde,
      fecha_hasta: hasta,
      hectareas: null,
      notas: null,
      ganancia_diaria_kg: null,
    }])
  }

  const actualizar = (id: string, campos: Partial<TramoLote>) =>
    onCambiarTramos(tramos.map(t => (t.id === id ? { ...t, ...campos } : t)))

  const borrar = (id: string) => onCambiarTramos(tramos.filter(t => t.id !== id))

  /**
   * El tramo no puede pasarse de la fecha de venta: el animal ya no está.
   * No bloquea —puede haber una venta sin fecha todavía—, avisa.
   */
  const ventaLote = String((lote as any).fecha_venta_estimada || "")
  const pasados = ventaLote ? mios.filter(t => t.fecha_hasta > ventaLote) : []

  return (
    <div className="rounded border border-violet-200 bg-violet-50/40 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium text-violet-900">
            Actividades del lote — de acá salen el peso a la venta y el costo de alimentación
          </p>
          <p className="text-[9px] text-violet-700/70">
            se guardan con el botón <strong>Guardar</strong> del lote · Cancelar los descarta
          </p>
        </div>
        {loteId && actividades.length > 0 && (
          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={agregar}>
            <Plus className="mr-1 h-3 w-3" /> tramo
          </Button>
        )}
      </div>

      {!loteId ? (
        <p className="py-2 text-center text-[11px] text-gray-500">
          Guardá el lote primero y después le asignás las actividades.
        </p>
      ) : actividades.length === 0 ? (
        <p className="py-2 text-center text-[11px] text-gray-500">
          No hay actividades cargadas. Se crean en Presupuesto → Actividades y costos.
        </p>
      ) : (
        <>
          {mios.length === 0 ? (
            <p className="py-2 text-center text-[11px] text-gray-500">
              Sin actividades. El peso crece con la ganancia diaria de arriba.
            </p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b text-[10px] text-gray-500">
                  <th className="py-0.5 text-left font-medium">Actividad</th>
                  <th className="py-0.5 text-left font-medium">Desde</th>
                  <th className="py-0.5 text-left font-medium">Hasta</th>
                  <th className="py-0.5 text-right font-medium">kg/día</th>
                  <th className="py-0.5" />
                </tr>
              </thead>
              <tbody>
                {mios.map(t => (
                  <tr key={t.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-1 pr-2">
                      <select className="h-7 w-full rounded border border-gray-200 px-1 text-[11px]"
                        value={t.actividad_id}
                        onChange={e => actualizar(t.id, { actividad_id: e.target.value })}>
                        {actividades.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.nombre} ({n1(Number(a.ganancia_diaria_kg))} kg/día)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <Input type="date" className="h-7 text-[11px]" value={t.fecha_desde}
                        onChange={e => actualizar(t.id, { fecha_desde: e.target.value })} />
                    </td>
                    <td className="py-1 pr-2">
                      <Input type="date" className="h-7 text-[11px]" value={t.fecha_hasta}
                        onChange={e => actualizar(t.id, { fecha_hasta: e.target.value })} />
                    </td>
                    <td className="py-1 pr-2">
                      {/* Vacío = la de la actividad, y el placeholder la muestra. Con valor,
                          manda el tramo — sin perder el quiebre, que es lo que hacía el
                          checkbox de abajo (A-BUG-65). */}
                      <Input className="h-7 w-20 text-right text-[11px]"
                        placeholder={n1(Number(
                          actividades.find(a => a.id === t.actividad_id)?.ganancia_diaria_kg ?? 0))}
                        value={tipeando[t.id] ?? (t.ganancia_diaria_kg == null
                          ? "" : fmtNumeroAR(Number(t.ganancia_diaria_kg), 3))}
                        onChange={e => setTipeando(p => ({ ...p, [t.id]: e.target.value }))}
                        onFocus={e => setTipeando(p => ({
                          ...p,
                          [t.id]: t.ganancia_diaria_kg == null ? "" : String(Number(t.ganancia_diaria_kg)).replace(".", ","),
                        }))}
                        onBlur={e => {
                          const txt = e.target.value.trim()
                          setTipeando(p => { const q = { ...p }; delete q[t.id]; return q })
                          const v = txt === "" ? null : parseNumeroAR(txt)
                          if (v !== (t.ganancia_diaria_kg ?? null)) {
                            actualizar(t.id, { ganancia_diaria_kg: v })
                          }
                        }} />
                    </td>
                    <td className="py-1 text-right">
                      <button type="button" className="text-gray-300 hover:text-red-500"
                        onClick={() => borrar(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {pasados.length > 0 && (
            <p className="mt-1.5 rounded bg-amber-100 px-2 py-1 text-[10px] text-amber-800">
              ⚠️ {pasados.length === 1 ? "Hay un tramo que termina" : `Hay ${pasados.length} tramos que terminan`}
              {" "}<strong>después de la venta</strong> ({ventaLote.split("-").reverse().join("/")}).
              Se está cobrando comida de animales que ya no están — revisá las fechas.
            </p>
          )}

          {pisados.length > 0 && (
            <p className="mt-1.5 rounded bg-amber-100 px-2 py-1 text-[10px] text-amber-800">
              ⚠️ Hay tramos que se pisan. El peso se calcula igual, pero el costo cuenta los dos
              — revisá las fechas.
            </p>
          )}

          {/* La curva resultante: es lo que hace visible que el peso ya no es una recta */}
          {segs.length > 0 && (
            <div className="mt-2 rounded bg-white p-2">
              <p className="mb-1 text-[10px] font-medium text-gray-600">Curva de peso</p>
              {segs.map((s, idx) => (
                <div key={idx} className="flex items-baseline justify-between text-[10px]">
                  <span className={s.actividad ? "text-gray-700" : "text-amber-700"}>
                    {s.actividad ?? "sin actividad asignada"}
                    <span className="ml-1 text-gray-400">
                      {s.dias} días × {n1(s.ganancia_diaria_kg)} kg
                    </span>
                  </span>
                  <span className="font-medium text-gray-700">
                    {n1(s.peso_inicio)} → {n1(s.peso_fin)} kg
                  </span>
                </div>
              ))}
              {costoTotal > 0 && (
                <p className="mt-1 border-t pt-1 text-[10px] text-gray-600">
                  Costo de alimentación:{" "}
                  <strong>${Math.round(costoTotal).toLocaleString("es-AR")}</strong>
                  {cab > 0 && (
                    <span className="text-gray-400">
                      {" "}· ${Math.round(costoTotal / cab).toLocaleString("es-AR")} por cabeza
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {mios.length > 0 && (
            <label className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-600">
              {/* Va al formulario, no a la base: antes escribía directo en `stock_lotes` y el
                  modal seguía mostrando el valor viejo, así que parecía que no respondía
                  (A-BUG-58). Ahora lo persiste el Guardar, como todo lo demás. */}
              <input type="checkbox" checked={Boolean(lote.ganancia_override)}
                onChange={e => onGananciaOverride(e.target.checked)} />
              Usar la ganancia de arriba para TODO el lote — pierde el quiebre entre tramos
              {manual && <span className="ml-1 font-medium text-amber-700">← activo</span>}
            </label>
          )}
        </>
      )}
    </div>
  )
}
