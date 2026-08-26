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

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Plus, Trash2, AlertTriangle, Check, X } from "lucide-react"
import { parseNumeroAR, fmtNumeroAR } from "@/lib/format/numero"
import { calcularConsumo, type Medicion, type Entrega } from "@/lib/productivo/consumo"

interface MedicionFila extends Medicion { id: string }

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

  const um = insumo?.unidad_medida || "kg"

  const cargar = useCallback(async () => {
    if (!insumo) return
    setCargando(true)
    try {
      const p = supabase.schema("productivo")
      const [{ data: meds }, { data: movs }] = await Promise.all([
        p.from("mediciones_insumo").select("*").eq("insumo_stock_id", insumo.id).order("fecha"),
        // Las ENTREGAS son las compras. La fecha del movimiento es la de recepción, que es la
        // que mueve el stock — no la de la factura. Ver A-FEAT-44.
        p.from("movimientos_insumos")
          .select("fecha, cantidad, costo_unitario, proveedor, observaciones")
          .eq("insumo_stock_id", insumo.id).eq("tipo", "compra").order("fecha"),
      ])
      setMediciones(((meds || []) as any[]).map(m => ({
        id: String(m.id), fecha: String(m.fecha),
        cantidad: Number(m.cantidad) || 0, notas: m.notas,
      })))
      setEntregas(((movs || []) as any[]).map(m => ({
        fecha: String(m.fecha),
        cantidad: Number(m.cantidad) || 0,
        // Sin costo cargado el precio es `null`, no cero: "no sé" y "gratis" no son lo mismo.
        precioUnitario: m.costo_unitario == null ? null : Number(m.costo_unitario),
        detalle: [m.proveedor, m.observaciones].filter(Boolean).join(" · ") || undefined,
      })))
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

  // El reparto entre grupos todavía no está conectado (A-FEAT-43): acá se mide el consumo y se
  // controla que cierre, que es lo que hace falta para poder cargar.
  const r = calcularConsumo(mediciones, entregas, () => [])
  const faltantesReales = r.faltantes.filter(f => !f.includes("ningún grupo declarado"))

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
                      <td />
                      <td className="px-2 py-1 text-right text-gray-800">
                        {r.costoTotal == null ? "—" : pesos(r.costoTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
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
              El <strong>reparto entre grupos de animales</strong> —quién se comió cuánto— todavía
              no está conectado. Acá se mide el consumo y se controla que cierre, que es el paso
              previo. Ver <code>A-FEAT-43</code>.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
