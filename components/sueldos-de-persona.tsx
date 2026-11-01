"use client"

/**
 * 📜 **Los sueldos de UNA persona, toda la tira** (A-FEAT-1467). Cada mes con su sueldo, lo pagado (pago por pago, con su
 * estado y medio) y el saldo; abajo, la barra de resumen como en Excel. Se abre desde un link (`?seccion=sueldos&empleado=`)
 * —p. ej. desde un tema del recorrido del balance— o desde la cabecera del empleado en Sueldos.
 */
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BarraResumen } from "@/components/ui/barra-resumen"

interface PeriodoP { id: string; anio: number; mes: number; estado: string | null; monto_a: number | null; monto_b: number | null; saldo_pendiente: number | null; horas_mes: number | null; valor_por_hora: number | null; varios: number | null }
interface PagoP { id: string; periodo_id: string | null; fecha: string; monto: number; tipo: string | null; estado: string | null; medio_pago: string | null; descripcion: string | null }

const pesos = (x: number) => x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MESES = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

export function SueldosDePersona({ empleadoId, onClose }: { empleadoId: string | null; onClose: () => void }) {
  const [nombre, setNombre] = useState("")
  const [periodos, setPeriodos] = useState<PeriodoP[] | null>(null)
  const [pagos, setPagos] = useState<PagoP[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!empleadoId) return
    setPeriodos(null); setError(null)
    void (async () => {
      const [e, p, g] = await Promise.all([
        supabase.from("sueldos_empleados").select("nombre").eq("id", empleadoId).maybeSingle(),
        supabase.from("sueldos_periodos").select("id, anio, mes, estado, monto_a, monto_b, saldo_pendiente, horas_mes, valor_por_hora, varios").eq("empleado_id", empleadoId).order("anio").order("mes"),
        supabase.from("sueldos_pagos").select("id, periodo_id, fecha, monto, tipo, estado, medio_pago, descripcion").eq("empleado_id", empleadoId).order("fecha"),
      ])
      if (p.error || g.error) { setError((p.error ?? g.error)!.message); setPeriodos([]); return }
      setNombre((e.data as { nombre?: string } | null)?.nombre ?? "")
      setPeriodos((p.data ?? []) as PeriodoP[]); setPagos((g.data ?? []) as PagoP[])
    })()
  }, [empleadoId])

  const sinPeriodo = pagos.filter(x => !x.periodo_id || !(periodos ?? []).some(p => p.id === x.periodo_id))
  return (
    <Dialog open={!!empleadoId} onOpenChange={a => { if (!a) onClose() }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>📜 Sueldos de {nombre || "…"} — toda la tira</DialogTitle></DialogHeader>
        {error && <p className="text-sm text-red-700">No se pudo leer: {error}</p>}
        {!periodos ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
          <div className="space-y-2 text-sm">
            <table className="w-full border-collapse text-xs">
              <thead><tr className="border-b bg-muted/50 text-left">
                <th className="p-1">Mes</th><th className="p-1">Estado</th><th className="p-1 text-right">Sueldo</th>
                <th className="p-1">Pagos (fecha · importe · estado · medio)</th><th className="p-1 text-right">Pagado</th><th className="p-1 text-right">Saldo</th>
              </tr></thead>
              <tbody>
                {periodos.map(p => {
                  const ps = pagos.filter(x => x.periodo_id === p.id)
                  const pagado = ps.reduce((s, x) => s + (Number(x.monto) || 0), 0)
                  const sueldo = (Number(p.monto_a) || 0) + (Number(p.monto_b) || 0)
                  return (
                    <tr key={p.id} className="border-b align-top">
                      <td className="p-1 whitespace-nowrap">{MESES[p.mes]} {p.anio}</td>
                      <td className="p-1">{p.estado}</td>
                      <td className="p-1 text-right tabular-nums" title={p.horas_mes ? `${p.horas_mes} h × $ ${pesos(Number(p.valor_por_hora) || 0)}${p.varios ? ` + $ ${pesos(Number(p.varios))} varios` : ""}` : undefined}>$ {pesos(sueldo)}</td>
                      <td className="p-1">{ps.map(x => <div key={x.id}>{x.fecha.split("-").reverse().join("/")} · $ {pesos(Number(x.monto))} · {x.estado}{x.medio_pago ? ` · ${x.medio_pago}` : ""}</div>)}</td>
                      <td className="p-1 text-right tabular-nums">$ {pesos(pagado)}</td>
                      <td className={`p-1 text-right tabular-nums ${Math.abs(sueldo - pagado) > 0.5 ? "text-amber-700 font-medium" : ""}`}>$ {pesos(sueldo - pagado)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {sinPeriodo.length > 0 && <p className="text-xs text-amber-800">⚠️ {sinPeriodo.length} pago(s) sin mes asignado.</p>}
            <BarraResumen filas={pagos} fecha={x => x.fecha} columnas={[{ rotulo: "pagado", valor: x => x.monto }]} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
