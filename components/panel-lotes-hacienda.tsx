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
import { Loader2, Plus, Trash2, PackageOpen, Wand2, Scale, AlertTriangle } from "lucide-react"
import {
  pesoEstimado, cantidadDisponible, fechaDestete, pesoDestete,
  categoriaSegunFecha, valuarLoteConPrecios, CATEGORIAS_VENTA,
  type LoteStock, type VentaStock, type CicloCalculado,
} from "@/lib/ganaderia/ciclo"
import { type PrecioHacienda } from "@/lib/ganaderia/calculo"

const parseNum = (v: string) => {
  const n = parseFloat(String(v).trim().replace(",", "."))
  return Number.isFinite(n) ? n : 0
}
const n1 = (n: number) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: 1 })
const fmtAR = (n: number) => Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
const n0 = (n: number) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })

/** Categorías vendibles — de la lib, para no duplicar la lista. */
const CATEGORIAS = [...CATEGORIAS_VENTA]

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
  /**
   * Foto ACTUAL de las pesadas, por `fecha|categoria`. Se compara contra lo que quedó
   * guardado en el lote para avisar cuando el origen cambió (p.ej. se marcaron más
   * terneras de reposición). NO se actualiza solo: el presupuesto no debe moverse bajo
   * los pies del usuario — se avisa y él decide (misma lección que los templates
   * auto-modificables en KNOWLEDGE.md).
   */
  const [fotoPesada, setFotoPesada] = useState<Record<string, { cabezas: number; peso: number }>>({})
  const [precios, setPrecios] = useState<PrecioHacienda[]>([])

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

      const { data: pr } = await supabase.from("precios_hacienda")
        .select("categoria, anio, mes, precio_pesos_kg, peso_desde, peso_hasta")
      setPrecios((pr || []) as PrecioHacienda[])

      // Foto viva de las pesadas, para detectar lotes desactualizados
      const { data: pes } = await supabase.schema("productivo")
        .from("pesadas_terneros")
        .select("fecha, peso_kg, ternero:terneros!inner(sexo, es_torito)")
      const acc: Record<string, { n: number; kg: number }> = {}
      for (const r of (pes || []) as any[]) {
        const t = r.ternero
        if (!t) continue
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
      ganancia_diaria_kg: parseNum(String(f.ganancia_diaria_kg)),
      fecha_venta_estimada: f.fecha_venta_estimada || null,
      precio_kg_override: String(f.precio_kg_override ?? "").trim() === ""
        ? null : parseNum(String(f.precio_kg_override)),
      dias_cobro: Math.round(parseNum(String(f.dias_cobro ?? "0"))),
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
  const generarDesdeLinea = async () => {
    setGenerando(true)
    try {
      for (const c of linea) {
        const fecha = fechaDestete(c.ciclo)
        if (!fecha) continue

        // Por defecto se vende AL PIE, en el destete. Si después se mueve la fecha de
        // venta, la categoría se recalcula sola (al pie vs recría).
        const aCrear = [
          { categoria: categoriaSegunFecha("macho", fecha, fecha),
            origen: "destete", cantidad: c.terneros_venta, peso: pesoDestete(c.ciclo, "macho") },
          { categoria: categoriaSegunFecha("hembra", fecha, fecha),
            origen: "destete", cantidad: c.terneras_venta, peso: pesoDestete(c.ciclo, "hembra") },
          // Vaca refugo: se vende con su propio peso, no el del destete. OJO: la
          // cantidad viene del "refugo + mortandad" del ciclo, asi que incluye las que
          // se mueren -- hay que descontarlas a mano (queda marcado con ✎).
          { categoria: "Vaca CUT/Descarte",  origen: "descarte", cantidad: c.descarte,
            peso: Number(c.ciclo.peso_descarte_kg) || 450 },
        ]

        for (const a of aCrear) {
          if (a.cantidad <= 0.01) continue
          const existente = lotes.find(l =>
            l.ciclo_id === c.ciclo.id && l.categoria === a.categoria && l.origen === a.origen)

          if (existente) {
            // No pisar un lote que ya tiene ventas: ahí manda lo que se decidió
            if (ventasDe(existente.id).length > 0) continue
            // Tampoco pisar lo que el usuario ajustó a mano (p.ej. descontando la
            // mortandad de las vacas de refugo). Se actualiza sólo `cantidad_calculada`
            // para que la fila pueda avisar que el cálculo cambió.
            const editadoAMano = existente.cantidad_calculada != null
              && Math.abs(Number(existente.cantidad) - Number(existente.cantidad_calculada)) > 0.01
            await supabase.schema("productivo").from("stock_lotes")
              .update({
                ...(editadoAMano ? {} : { cantidad: a.cantidad }),
                cantidad_calculada: a.cantidad,
                fecha_disponible: fecha,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existente.id)
          } else {
            await supabase.schema("productivo").from("stock_lotes").insert({
              empresa: "MSA", ciclo_id: c.ciclo.id,
              categoria: a.categoria, origen: a.origen,
              cantidad: a.cantidad, cantidad_calculada: a.cantidad, fecha_disponible: fecha,
              peso_base_kg: a.peso, ganancia_diaria_kg: 0,
              notas: `Generado desde el período ${c.ciclo.campania}`,
            })
          }
        }
      }
      await cargar(); onCambio?.()
    } finally { setGenerando(false) }
  }

  /** Precarga la foto de arranque: la recría que se retuvo y no se vendió. */
  const cargarStockInicial = () => setModal({
    origen: "stock_inicial",
    categoria: "Ternero Recria",
    cantidad: "", peso_base_kg: "197,34", ganancia_diaria_kg: "0,5",
    fecha_disponible: "2026-02-23",
    fecha_venta_estimada: "", precio_kg_override: "", dias_cobro: "0",
    notas: "Stock inicial — retenido para recría",
  })

  /** Un lote de stock inicial está desactualizado si la pesada hoy dice otra cosa. */
  const desactualizado = (l: LoteStock) => {
    if (l.origen !== "stock_inicial") return null
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
              <Button size="sm" variant="outline" disabled={generando} onClick={generarDesdeLinea}>
                {generando ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  : <Wand2 className="mr-1 h-3.5 w-3.5" />}
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
                  const pesoHoy = pesoEstimado(l, hoy)
                  const des = desactualizado(l)
                  const val = valuarLoteConPrecios(l, vs, precios)
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
                              ? fmtAR(val.precio_kg) + (l.precio_kg_override != null ? " m" : "")
                              : <span className="text-red-500">sin precio</span>)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-800">
                        {val.proyectado && val.monto > 0 ? fmtPesos(val.monto) : "—"}
                        {val.proyectado && val.estimado && <span className="text-amber-500">*</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {val.mes_cobro ?? "—"}
                        {Number(l.dias_cobro) > 0 && (
                          <span className="ml-1 text-[10px] text-gray-400">+{l.dias_cobro}d</span>
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
                              dias_cobro: String(l.dias_cobro ?? 0),
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
              s + valuarLoteConPrecios(l, ventasDe(l.id), precios).monto, 0))}
          </span>
        </div>
      )}

      <ModalLote datos={modal} onCerrar={() => setModal(null)} onGuardar={guardar} />
      <ModalDesdePesada abierto={modalPesada} lotes={lotes} ventasDe={ventasDe}
        onCerrar={() => setModalPesada(false)}
        onListo={async () => { await cargar(); onCambio?.() }} />
    </Card>
  )
}

// ── Modal de lote ─────────────────────────────────────────────────────────────

function ModalLote({ datos, onCerrar, onGuardar }: {
  datos: any; onCerrar: () => void; onGuardar: (f: any) => Promise<void>
}) {
  const [f, setF] = useState<any>({})
  useEffect(() => { if (datos) setF({ ...datos }) }, [datos])
  if (!datos) return null

  const campo = (k: string, label: string, ayuda?: string, tipo = "text") => (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <Input type={tipo} className="h-8 text-right" value={f[k] ?? ""}
        onChange={e => setF({ ...f, [k]: e.target.value })} />
      {ayuda && <p className="mt-1 text-[10px] text-gray-400">{ayuda}</p>}
    </div>
  )

  const dias = f.fecha_disponible
    ? Math.max(0, Math.round((Date.now() - new Date(f.fecha_disponible + "T00:00:00").getTime()) / 86400000))
    : 0
  const pesoHoy = parseNum(String(f.peso_base_kg ?? "0")) + dias * parseNum(String(f.ganancia_diaria_kg ?? "0"))

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
            {campo("peso_base_kg", "Peso a esa fecha (kg)")}
            {campo("ganancia_diaria_kg", "Ganancia diaria (kg/día)", "0 = se vende sin engordar")}
          </div>

          {/* Proyección de venta: sin fecha el lote es sólo inventario */}
          <div className="rounded border border-emerald-200 bg-emerald-50/40 p-2.5">
            <p className="mb-2 text-[11px] font-medium text-emerald-900">
              Venta presupuestada — sin fecha, el lote no entra al presupuesto como ingreso
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500">Fecha de venta</label>
                <Input type="date" className="h-8" value={f.fecha_venta_estimada || ""}
                  onChange={e => setF({ ...f, fecha_venta_estimada: e.target.value })} />
              </div>
              {campo("precio_kg_override", "Precio $/kg", "vacío = usa la banda de peso")}
              {campo("dias_cobro", "Días de cobro", "0 = contado")}
            </div>
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
            <Button onClick={() => onGuardar(f)}>Guardar</Button>
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
  categoria: string
  esRetencion: boolean
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
  const [grupos, setGrupos] = useState<GrupoPesada[]>([])
  const [sel, setSel] = useState<Record<string, boolean>>({})
  const [ganancia, setGanancia] = useState("0,5")
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
        const { data, error } = await supabase.schema("productivo")
          .from("pesadas_terneros")
          .select("peso_kg, ternero:terneros!inner(sexo, es_torito)")
          .eq("fecha", fecha)
        if (error) { console.error(error); return }

        const acc = new Map<string, { sexo: string; marcado: boolean; n: number; kg: number }>()
        for (const r of (data || []) as any[]) {
          const t = r.ternero
          if (!t) continue
          const sexo = String(t.sexo ?? "")
          const marcado = !!t.es_torito
          const k = `${sexo}|${marcado}`
          const cur = acc.get(k) ?? { sexo, marcado, n: 0, kg: 0 }
          cur.n += 1
          cur.kg += Number(r.peso_kg) || 0
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
          categoria: esMacho(g.sexo)
            ? (g.marcado ? "Torito" : "Ternero Recria")
            : "Ternera Recria",
          // Hembra marcada = retenida para reposicion: NO se vende
          esRetencion: !esMacho(g.sexo) && g.marcado,
        })).sort((a, b) => a.sexo.localeCompare(b.sexo) || Number(a.marcado) - Number(b.marcado))

        setGrupos(out)
        // Por defecto se traen los vendibles; la retencion queda destildada
        const init: Record<string, boolean> = {}
        out.forEach(g => { init[g.clave] = !g.esRetencion })
        setSel(init)
      } finally { setCargando(false) }
    })()
  }, [abierto, fecha])

  if (!abierto) return null
  const elegidos = grupos.filter(g => sel[g.clave])

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

        const payload = {
          cantidad: g.cabezas,
          peso_base_kg: Math.round(g.peso_prom * 100) / 100,
          ganancia_diaria_kg: parseNum(ganancia),
          notas: `Desde pesada ${fecha} — ${g.sexo}${g.marcado ? " marcado" : ""}, ${g.cabezas} cab, promedio real`,
          updated_at: new Date().toISOString(),
        }

        if (existente) {
          // No pisar un lote que ya tiene ventas: ahí manda lo que se decidió
          if (ventasDe(existente.id).length > 0) continue
          const { error } = await supabase.schema("productivo").from("stock_lotes")
            .update(payload).eq("id", existente.id)
          if (error) { alert("Error: " + error.message); return }
        } else {
          const { error } = await supabase.schema("productivo").from("stock_lotes").insert({
            empresa: "MSA", ciclo_id: null,
            categoria: g.categoria, origen: "stock_inicial",
            fecha_disponible: fecha,
            ...payload,
          })
          if (error) { alert("Error: " + error.message); return }
        }
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
          <div className="grid grid-cols-2 gap-3">
            <div>
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
                        </span>
                        {g.esRetencion && (
                          <Badge variant="outline" className="text-[10px]">retención — no se vende</Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-600">
                        <strong>{g.cabezas}</strong> cabezas · promedio{" "}
                        <strong>{n1(g.peso_prom)} kg</strong> · {n0(g.kg_total)} kg totales
                        {lotes.some(l => l.origen === "stock_inicial"
                          && l.categoria === g.categoria && l.fecha_disponible === fecha) && (
                          <span className="ml-2 text-blue-600">· ya existe, se actualiza</span>
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
