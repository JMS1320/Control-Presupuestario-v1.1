"use client"

// Mediciones de stock de un insumo — "cuánto había el día que fui a mirar".
//
// ── Por qué existe ───────────────────────────────────────────────────────────
// Hasta acá el costo de la ración se ESTIMABA: peso × % del peso vivo. Con esto se puede
// MEDIR, que era el nudo del costeo de recría:
//
//     consumo del tramo = lo que había + lo que entró − lo que quedó
//
// El usuario lo planteó al revés y por eso funciona: *"sería raro lograr tomar stock a cada
// venta"*. No hace falta — alcanza con medir cuando se puede, porque **cada medición corta un
// tramo**. Con dos (apertura y cierre) hay un tramo; con cuatro, tres. La regla es la misma.
//
// ⚠️ Una medición es un NIVEL, no un movimiento. Por eso vive en su propia tabla y no en
// `movimientos_insumos`: mezclar saldos con flujos en la misma columna es el bug que costó 16
// cabezas en la Planilla de Hacienda.
//
// El cálculo NO vive acá: está en `lib/productivo/consumo.ts`, y lo verifica
// `scripts/verificar-consumo.mts` contra los datos reales de la recría 2026.

import { useState, useEffect, useCallback, Fragment } from "react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Plus, Trash2, AlertTriangle, Check, X } from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import { calcularConsumo, type Medicion, type Entrega, type ConsumoDeclarado,
  type GrupoConsumidor } from "@/lib/productivo/consumo"
import { armarGruposRodeo, gruposDelRodeo, type BajaRodeo } from "@/lib/productivo/rodeo"
import { curvaDeLote, type TramoLote, type LoteCurva } from "@/lib/productivo/tramos"
import type { Actividad } from "@/lib/productivo/actividades"
import { conciliarEntregasFacturas, entregasParaConsumo } from "@/lib/productivo/entregas-facturas"

interface MedicionFila extends Medicion { id: string }
interface DeclaracionFila extends ConsumoDeclarado { id: string }

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
const dmy = (f: string) => f.split("-").reverse().join("/")

export function PanelMedicionesInsumo({ insumo, onCerrar }: {
  insumo: { id: string; producto: string; unidad_medida: string | null } | null
  onCerrar: () => void
}) {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mediciones, setMediciones] = useState<MedicionFila[]>([])
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [nuevaFecha, setNuevaFecha] = useState("")
  const [nuevaCant, setNuevaCant] = useState("")
  const [nuevaNota, setNuevaNota] = useState("")
  /** Lo declarado por actividad: "se cargaron 6 ton al comedero de cría". */
  const [declaraciones, setDeclaraciones] = useState<DeclaracionFila[]>([])
  const [actividades, setActividades] = useState<{ id: string; nombre: string }[]>([])
  const [decFecha, setDecFecha] = useState("")
  const [decAct, setDecAct] = useState("")
  const [decCant, setDecCant] = useState("")
  const [decNota, setDecNota] = useState("")
  /** Los grupos del rodeo que come de este insumo, con su kilo-día por tramo. */
  const [gruposDe, setGruposDe] = useState<(d: string, h: string) => GrupoConsumidor[]>(() => () => [])
  const [conciliacion, setConciliacion] = useState<
    { declarada: number; enGrupos: number; diferencia: number; cierra: boolean } | null>(null)

  const um = insumo?.unidad_medida || "kg"

  const cargar = useCallback(async () => {
    if (!insumo) return
    setCargando(true)
    try {
      const p = supabase.schema("productivo")
      const [{ data: meds }, { data: movs }, { data: decs }, { data: accs }] = await Promise.all([
        p.from("mediciones_insumo").select("*").eq("insumo_stock_id", insumo.id).order("fecha"),
        // Las ENTREGAS son las compras. La fecha del movimiento es la de recepción, que es la
        // que mueve el stock — no la de la factura. Ver A-FEAT-44.
        p.from("movimientos_insumos")
          .select("id, fecha, cantidad, costo_unitario, proveedor, observaciones")
          .eq("insumo_stock_id", insumo.id).eq("tipo", "compra").order("fecha"),
        p.from("consumo_declarado_insumo").select("*").eq("insumo_stock_id", insumo.id).order("fecha"),
        supabase.from("centros_costo").select("id, nombre").eq("tipo", "actividad").eq("activo", true),
      ])
      const acts = ((accs || []) as any[]).map(a => ({ id: String(a.id), nombre: String(a.nombre) }))
      setActividades(acts)
      const nombreDe = new Map(acts.map(a => [a.id, a.nombre]))
      setDeclaraciones(((decs || []) as any[]).map(x => ({
        id: String(x.id), fecha: String(x.fecha),
        grupoId: String(x.centro_costo_id),
        nombre: nombreDe.get(String(x.centro_costo_id)) ?? "(actividad borrada)",
        cantidad: Number(x.cantidad) || 0, notas: x.notas,
      })))
      setMediciones(((meds || []) as any[]).map(m => ({
        id: String(m.id), fecha: String(m.fecha),
        cantidad: Number(m.cantidad) || 0, notas: m.notas,
      })))
      // ── El precio sale de LA FACTURA cuando está vinculada ────────────────
      //
      // El `costo_unitario` tipeado a mano queda como respaldo. Es la regla de siempre: el dato
      // real por default. Y así el precio del tramo es rastreable hasta el comprobante.
      const { data: vincs } = await p.from("entrega_factura").select("*")
      const { data: fcs } = await supabase.schema("msa").from("comprobantes_arca")
        .select("id, fecha, denominacion_emisor, punto_venta, numero_desde, imp_neto_gravado, imp_total")
        .order("fecha", { ascending: false }).limit(400)
      const entregasBase = ((movs || []) as any[]).map(m => ({
        id: String(m.id), fecha: String(m.fecha),
        cantidad: Number(m.cantidad) || 0,
        proveedor: m.proveedor,
        // Sin costo cargado el precio es `null`, no cero: "no sé" y "gratis" no son lo mismo.
        costoUnitarioManual: m.costo_unitario == null ? null : Number(m.costo_unitario),
      }))
      const idsMov = new Set(entregasBase.map(e => e.id))
      const conc = conciliarEntregasFacturas(
        entregasBase,
        ((fcs || []) as any[]).map(f => ({
          id: String(f.id), fecha: String(f.fecha),
          proveedor: String(f.denominacion_emisor ?? ""),
          numero: `${f.punto_venta ?? 0}-${f.numero_desde ?? 0}`,
          neto: Number(f.imp_neto_gravado) || 0, total: Number(f.imp_total) || 0,
        })),
        ((vincs || []) as any[]).filter(v => idsMov.has(String(v.movimiento_id))).map(v => ({
          id: String(v.id), movimientoId: String(v.movimiento_id), facturaId: String(v.factura_id),
          cantidad: Number(v.cantidad) || 0,
          precioUnitario: v.precio_unitario == null ? null : Number(v.precio_unitario),
        })),
      )
      setEntregas(entregasParaConsumo(conc))
      // ── La línea de tiempo del rodeo, para poder repartir ────────────────
      //
      // Se arma con `armarGruposRodeo()`, el mismo que usa el script de verificación: dos
      // versiones de esto darían repartos distintos según desde dónde se mire.
      const [{ data: ciclos }, { data: lts }, { data: vtas }, { data: trs }, { data: actsProd }, { data: mvs }, { data: catsHac }] =
        await Promise.all([
          p.from("ciclos_recria").select("*").eq("activo", true),
          p.from("stock_lotes").select("*"),
          p.from("stock_ventas").select("lote_id, fecha_venta"),
          p.from("lote_tramos").select("*").order("orden"),
          p.from("actividades").select("*").eq("activo", true),
          p.from("movimientos_hacienda").select("fecha, tipo, cantidad, categoria_id"),
          p.from("categorias_hacienda").select("id, nombre"),
        ])
      const ciclo = ((ciclos || []) as any[])[0]
      if (ciclo) {
        const nombreCat = new Map(((catsHac || []) as any[]).map(c => [c.id, String(c.nombre)]))
        const esRecria = (cat: string) => /recria/i.test(cat)
        const listaTr = (trs || []) as TramoLote[]
        const listaAc = (actsProd || []) as unknown as Actividad[]
        const filasLote = ((lts || []) as any[])
          .filter(l => esRecria(String(l.categoria)))
          .map(l => {
            const curva = curvaDeLote(l as unknown as LoteCurva,
              listaTr.filter(t => t.lote_id === l.id), listaAc)
            const real = ((vtas || []) as any[]).find(v => v.lote_id === l.id)
            return {
              id: String(l.id),
              nombre: `${l.categoria} (${Number(l.cantidad)} cab)`
                + (real ? " — vendido" : l.destino_actividad_id ? " — traspaso" : ""),
              cabezas: Number(l.cantidad) || 0,
              fechaSalidaReal: real ? String(real.fecha_venta) : null,
              fechaSalidaEstimada: l.fecha_venta_estimada ? String(l.fecha_venta_estimada) : null,
              peso: (f: string) => curva(f),
            }
          })
        const desdeCiclo = String(ciclo.fecha_inicio ?? "")
        const bajas: BajaRodeo[] = ((mvs || []) as any[])
          .filter(m => m.tipo === "mortandad" && esRecria(nombreCat.get(m.categoria_id) ?? "")
            && String(m.fecha) >= desdeCiclo)
          .map(m => ({ fecha: String(m.fecha), cabezas: Number(m.cantidad) || 0 }))
        const armado = armarGruposRodeo({ ciclo, lotes: filasLote, bajas })
        const fn = gruposDelRodeo(armado.grupos, bajas)
        setGruposDe(() => fn)
        setConciliacion(armado.conciliacion)
      }
    } finally { setCargando(false) }
  }, [insumo])

  useEffect(() => { cargar() }, [cargar])

  const agregar = async () => {
    if (!insumo || !nuevaFecha || nuevaCant.trim() === "") return
    setGuardando(true)
    const { error } = await supabase.schema("productivo").from("mediciones_insumo").insert({
      insumo_stock_id: insumo.id,
      fecha: nuevaFecha,
      cantidad: parseNumeroAR(nuevaCant),
      notas: nuevaNota.trim() || null,
    })
    setGuardando(false)
    if (error) {
      alert(error.message.includes("duplicate")
        ? "Ya hay una medición de ese día. Dos saldos distintos para la misma fecha se contradicen: editá la que está."
        : "Error: " + error.message)
      return
    }
    setNuevaFecha(""); setNuevaCant(""); setNuevaNota("")
    await cargar()
  }

  const borrar = async (id: string, fecha: string) => {
    if (!confirm(`¿Borrar la medición del ${dmy(fecha)}?\n\nSe recalculan los tramos de consumo.`)) return
    const { error } = await supabase.schema("productivo").from("mediciones_insumo").delete().eq("id", id)
    if (error) { alert("Error: " + error.message); return }
    await cargar()
  }

  const agregarDec = async () => {
    if (!insumo || !decFecha || !decAct || decCant.trim() === "") return
    setGuardando(true)
    const { error } = await supabase.schema("productivo").from("consumo_declarado_insumo").insert({
      insumo_stock_id: insumo.id,
      centro_costo_id: decAct,
      fecha: decFecha,
      cantidad: parseNumeroAR(decCant),
      notas: decNota.trim() || null,
    })
    setGuardando(false)
    if (error) { alert("Error: " + error.message); return }
    setDecFecha(""); setDecCant(""); setDecNota("")
    await cargar()
  }

  const borrarDec = async (id: string) => {
    const { error } = await supabase.schema("productivo")
      .from("consumo_declarado_insumo").delete().eq("id", id)
    if (error) { alert("Error: " + error.message); return }
    await cargar()
  }

  const r = calcularConsumo(mediciones, entregas, gruposDe, declaraciones)
  const faltantesReales = r.faltantes

  if (!insumo) return null

  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Mediciones de stock — {insumo.producto}
          </DialogTitle>
        </DialogHeader>

        <p className="-mt-2 text-[11px] text-gray-500">
          Cuánto <strong>había</strong> el día que fuiste a mirar. No es un movimiento: es el saldo.
          {" "}<strong>Cada medición corta un tramo</strong>, y de cada tramo sale el consumo real:
          {" "}<em>lo que había + lo que entró − lo que quedó</em>.
        </p>

        {cargando ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leyendo…
          </div>
        ) : (
          <div className="space-y-4">
            {/* ── Las mediciones ─────────────────────────────────────────── */}
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b bg-gray-50 text-[9px] uppercase text-gray-500">
                    <th className="px-2 py-1 text-left font-medium">Fecha</th>
                    <th className="px-2 py-1 text-right font-medium">Había ({um})</th>
                    <th className="px-2 py-1 text-left font-medium">Cómo se midió</th>
                    <th className="w-8 px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {mediciones.map(m => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-2 py-1 text-gray-700">{dmy(m.fecha)}</td>
                      <td className="px-2 py-1 text-right font-medium text-gray-800">
                        {fmtNumeroAR(m.cantidad, 0)}
                      </td>
                      <td className="px-2 py-1 text-gray-500">{m.notas || "—"}</td>
                      <td className="px-2 py-1 text-right">
                        <button type="button" className="text-gray-300 hover:text-red-500"
                          onClick={() => borrar(m.id, m.fecha)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                    <td className="px-2 py-1">
                      <Input type="date" className="h-7 text-[11px]" value={nuevaFecha}
                        onChange={e => setNuevaFecha(e.target.value)} />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="text" placeholder="0" className="h-7 text-right text-[11px]"
                        value={nuevaCant} onChange={e => setNuevaCant(e.target.value)} />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="text" placeholder="quién midió y cómo" className="h-7 text-[11px]"
                        value={nuevaNota} onChange={e => setNuevaNota(e.target.value)} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Button size="sm" variant="ghost" className="h-6 px-1"
                        disabled={guardando || !nuevaFecha || nuevaCant.trim() === ""}
                        onClick={agregar}>
                        {guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Lo declarado por actividad ─────────────────────────────── */}
            <div className="overflow-x-auto rounded border border-sky-200">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b bg-sky-50 text-[9px] uppercase text-sky-800">
                    <th className="px-2 py-1 text-left font-medium">Se le dio a…</th>
                    <th className="px-2 py-1 text-left font-medium">Fecha</th>
                    <th className="px-2 py-1 text-right font-medium">Cantidad ({um})</th>
                    <th className="px-2 py-1 text-left font-medium">Nota</th>
                    <th className="w-8 px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {declaraciones.map(x => (
                    <tr key={x.id} className="border-b last:border-0">
                      <td className="px-2 py-1 font-medium text-gray-700">{x.nombre}</td>
                      <td className="px-2 py-1 text-gray-600">{dmy(x.fecha)}</td>
                      <td className="px-2 py-1 text-right text-gray-800">{fmtNumeroAR(x.cantidad, 0)}</td>
                      <td className="px-2 py-1 text-gray-500">{x.notas || "—"}</td>
                      <td className="px-2 py-1 text-right">
                        <button type="button" className="text-gray-300 hover:text-red-500"
                          onClick={() => borrarDec(x.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-sky-50/50">
                    <td className="px-2 py-1">
                      <select className="h-7 w-full rounded border px-1 text-[11px]"
                        value={decAct} onChange={e => setDecAct(e.target.value)}>
                        <option value="">elegir actividad…</option>
                        {actividades.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <Input type="date" className="h-7 text-[11px]" value={decFecha}
                        onChange={e => setDecFecha(e.target.value)} />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="text" placeholder="0" className="h-7 text-right text-[11px]"
                        value={decCant} onChange={e => setDecCant(e.target.value)} />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="text" placeholder="ej: se cargó el comedero" className="h-7 text-[11px]"
                        value={decNota} onChange={e => setDecNota(e.target.value)} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Button size="sm" variant="ghost" className="h-6 px-1"
                        disabled={guardando || !decFecha || !decAct || decCant.trim() === ""}
                        onClick={agregarDec}>
                        {guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="-mt-2 text-[10px] text-gray-500">
              <strong>Lo que declarás manda y no se reparte</strong>: se le imputa entero a esa
              actividad y se descuenta del resto. Es para cuando del mismo silo comen dos
              actividades — <em>“se cargaron 6 ton al comedero de cría”</em>. El sistema no lo
              deduce: <strong>lo aportás vos</strong>.
            </p>

            {/* ── Lo que se deduce ───────────────────────────────────────── */}
            {r.tramos.length > 0 && (
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b bg-gray-50 text-[9px] uppercase text-gray-500">
                      <th className="px-2 py-1 text-left font-medium">Tramo</th>
                      <th className="px-2 py-1 text-right font-medium">Días</th>
                      <th className="px-2 py-1 text-right font-medium">Había</th>
                      <th className="px-2 py-1 text-right font-medium">Entró</th>
                      <th className="px-2 py-1 text-right font-medium">Quedó</th>
                      <th className="px-2 py-1 text-right font-medium">Consumo</th>
                      <th className="px-2 py-1 text-right font-medium">Declarado</th>
                      <th className="px-2 py-1 text-right font-medium">$/{um}</th>
                      <th className="px-2 py-1 text-right font-medium">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.tramos.map((t, i) => (
                      <tr key={i} className={`border-b last:border-0 ${t.faltantes.length > 0 ? "bg-amber-50/50" : ""}`}>
                        <td className="px-2 py-1 text-gray-700">{dmy(t.desde)} → {dmy(t.hasta)}</td>
                        <td className="px-2 py-1 text-right text-gray-500">{t.dias}</td>
                        <td className="px-2 py-1 text-right text-gray-500">{fmtNumeroAR(t.saldoInicial, 0)}</td>
                        <td className="px-2 py-1 text-right text-gray-500">{fmtNumeroAR(t.cantidadEntregada, 0)}</td>
                        <td className="px-2 py-1 text-right text-gray-500">{fmtNumeroAR(t.saldoFinal, 0)}</td>
                        <td className="px-2 py-1 text-right font-medium text-gray-800">{fmtNumeroAR(t.consumo, 0)}</td>
                        <td className="px-2 py-1 text-right text-sky-700">
                          {t.declarado.length === 0 ? "—" : fmtNumeroAR(t.consumo - t.aRepartir, 0)}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-600">
                          {t.precioUnitario == null ? "—" : pesos(t.precioUnitario)}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-800">
                          {t.costo == null ? "—" : pesos(t.costo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-gray-50 font-medium">
                      <td className="px-2 py-1 text-gray-700" colSpan={5}>
                        Total consumido · comprado {fmtNumeroAR(r.compradoTotal, 0)} {um}
                        {" "}· <span className="text-emerald-700">queda {fmtNumeroAR(r.remanente, 0)} {um}</span>
                      </td>
                      <td className="px-2 py-1 text-right text-gray-800">{fmtNumeroAR(r.consumoTotal, 0)}</td>
                      <td className="px-2 py-1 text-right text-sky-700">
                        {fmtNumeroAR(r.tramos.reduce((s2, t) => s2 + (t.consumo - t.aRepartir), 0), 0)}
                      </td>
                      <td />
                      <td className="px-2 py-1 text-right text-gray-800">
                        {r.costoTotal == null ? "—" : pesos(r.costoTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* ── El reparto entre los grupos que comieron ────────────────── */}
            {r.tramos.some(t => t.reparto.length > 0) && (
              <div className="overflow-x-auto rounded border">
                <p className="border-b bg-gray-50 px-2 py-1 text-[9px] uppercase tracking-wide text-gray-500">
                  Quién se lo comió — el resto del consumo, repartido por kilo-día
                </p>
                <table className="w-full text-[11px]">
                  <tbody>
                    {r.tramos.map((t, i) => (
                      <Fragment key={i}>
                        <tr className="border-b bg-slate-50/60">
                          <td className="px-2 py-0.5 text-[10px] text-gray-500" colSpan={4}>
                            {dmy(t.desde)} → {dmy(t.hasta)}
                          </td>
                        </tr>
                        {t.reparto.map((g, j) => (
                          <tr key={j} className="border-b last:border-0">
                            <td className="px-2 py-1 pl-4 text-gray-700">
                              {g.nombre}
                              {g.grupoId === "__resto__" && (
                                <span className="ml-1 text-[9px] text-amber-700">
                                  ← sin lote cargado
                                </span>
                              )}
                            </td>
                            <td className="w-16 px-2 py-1 text-right text-gray-500">
                              {(g.participacion * 100).toFixed(1)} %
                            </td>
                            <td className="w-24 px-2 py-1 text-right text-gray-800">
                              {fmtNumeroAR(g.cantidad, 0)} {um}
                            </td>
                            <td className="w-28 px-2 py-1 text-right text-gray-800">
                              {g.costo == null ? "—" : pesos(g.costo)}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {conciliacion && !conciliacion.cierra && (
              <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-900">
                <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                <strong>El rodeo no concilia</strong>: el ciclo declara{" "}
                {fmtNumeroAR(conciliacion.declarada, 0)} cabezas y los grupos suman{" "}
                {fmtNumeroAR(conciliacion.enGrupos, 0)}. La diferencia igual come —
                <strong> si no está declarada, su comida la pagan los demás</strong>.
              </p>
            )}

            {/* ── Los controles: se ven cierren o no ─────────────────────── */}
            {r.controles.length > 0 && (
              <div className="rounded border bg-white">
                <p className="border-b px-2 py-1 text-[9px] uppercase tracking-wide text-gray-500">
                  Controles
                </p>
                {r.controles.map((c, i) => (
                  <div key={i} className={`flex flex-wrap items-baseline gap-2 border-b px-2 py-1 last:border-0
                    ${c.cierra ? "" : "bg-red-50"}`}>
                    {c.cierra
                      ? <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                      : <X className="h-3 w-3 shrink-0 text-red-600" />}
                    <span className="text-[11px] font-medium text-gray-700">{c.nombre}</span>
                    <span className="text-[10px] text-gray-400">{c.detalle}</span>
                    <span className={`ml-auto text-[11px] ${c.cierra ? "text-gray-500" : "font-medium text-red-700"}`}>
                      {fmtNumeroAR(c.izquierda, 0)} vs {fmtNumeroAR(c.derecha, 0)}
                      {!c.cierra && <> · dif <strong>{fmtNumeroAR(c.diferencia, 0)}</strong></>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {faltantesReales.length > 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
                <p className="text-[11px] font-medium text-amber-900">
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  Para que el consumo sea confiable falta:
                </p>
                <ul className="mt-0.5 space-y-0.5 text-[10px] text-amber-800">
                  {faltantesReales.map((f, i) => <li key={i}>· {f}</li>)}
                </ul>
              </div>
            )}

            <p className="text-[10px] text-gray-400">
              El reparto usa <strong>kilo-día</strong>: cabezas × peso vivo × días presentes. Sale
              de los <strong>lotes del ciclo</strong>, con su curva de peso y su fecha de salida —
              el que se vendió deja de comer ese día. Las mortandades se descuentan.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
