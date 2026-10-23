"use client"

/**
 * ✍️ Saldos del ejercicio anterior — A-FEAT-1207, versión chica (2026-10-18).
 *
 * Cuadro en *Reportes → Papeles de trabajo*: lo que el balance anterior dejó para tomar como gasto en este
 * ejercicio (ej. la mitad del inmobiliario 2025 pagado anual en abril). Se anota, se ve al trabajar, suma al
 * gasto del ejercicio y sale en el export. No se borra: se anula con motivo. La lógica pura está en
 * `lib/balance/ajustes-balance.ts`.
 */

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectorCuentaContable } from "@/components/ui/selector-cuenta-contable"
import { ahoraISO } from "@/lib/fechas"
import { saldosDelEjercicioAnterior, type AjusteBalance } from "@/lib/balance/ajustes-balance"

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const parsear = (v: string) => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0

export function SaldosEjercicioAnterior({ empresa, anioCierre, onCambio }: {
  empresa: string
  anioCierre: number
  /** Para que el libro y el export los lleven al día. */
  onCambio?: (lista: AjusteBalance[]) => void
}) {
  const [lista, setLista] = useState<AjusteBalance[]>([])
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [concepto, setConcepto] = useState("")
  const [categ, setCateg] = useState("")
  const [importe, setImporte] = useState("")
  const [motivo, setMotivo] = useState("")
  const [anulando, setAnulando] = useState<string | null>(null)
  const [motivoAnular, setMotivoAnular] = useState("")

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("ajustes_balance").select("*")
      .eq("empresa", empresa).eq("anio_cierre", anioCierre).eq("accion", "saldo_anterior").order("created_at")
    if (error) { setError(error.message); setLista([]); onCambio?.([]); return }
    setError(null)
    const l = (data || []) as AjusteBalance[]
    setLista(l)
    onCambio?.(l)
  }, [empresa, anioCierre, onCambio])
  useEffect(() => { cargar() }, [cargar])

  const agregar = async () => {
    const monto = parsear(importe)
    if (!concepto.trim() || !monto) { toast.error("Poné el concepto y el importe"); return }
    const { error } = await supabase.from("ajustes_balance").insert({
      empresa, anio_cierre: anioCierre, accion: "saldo_anterior", concepto: concepto.trim(), categ: categ || null,
      monto, motivo: motivo.trim() || `Saldo que dejó el balance ${anioCierre - 1}`, origen_anio_cierre: anioCierre - 1,
    })
    if (error) { toast.error("No se pudo anotar: " + error.message); return }
    setConcepto(""); setCateg(""); setImporte(""); setMotivo(""); setAbierto(false)
    await cargar()
  }
  const anular = async (id: string) => {
    if (!motivoAnular.trim()) { toast.error("Escribí por qué se anula"); return }
    const { error } = await supabase.from("ajustes_balance")
      .update({ anulado_at: ahoraISO(), anulado_motivo: motivoAnular.trim() }).eq("id", id)
    if (error) { toast.error("No se pudo anular: " + error.message); return }
    setAnulando(null); setMotivoAnular("")
    await cargar()
  }

  const s = saldosDelEjercicioAnterior(lista, empresa, anioCierre)
  return (
    <div className="rounded border border-gray-200 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <b>✍️ Saldos del ejercicio anterior — {empresa} {anioCierre}</b>
        <span className="text-xs text-gray-500">son gasto de este ejercicio · salen en el export, solapa «Saldos ej. anterior»</span>
      </div>
      {error && <p className="text-red-700">No se pudieron leer los saldos: {error}</p>}
      {!error && s.vigentes.length === 0 && <p className="text-xs text-gray-500">No hay saldos anotados.</p>}
      {s.vigentes.map(a => (
        <div key={a.id} className="flex flex-wrap items-start gap-2 border-b border-gray-100 py-1">
          <span className="flex-1">
            {a.concepto} <span className="text-xs text-gray-500">· {a.categ || "sin cuenta"} · {a.motivo}</span>
          </span>
          <span className="font-mono">${fmt(Number(a.monto))}</span>
          {anulando === a.id ? (
            <span className="flex items-center gap-1">
              <Input value={motivoAnular} onChange={e => setMotivoAnular(e.target.value)} placeholder="por qué se anula" className="h-7 w-56 text-xs" />
              <Button size="sm" className="h-7 text-xs" onClick={() => anular(a.id)}>Anular</Button>
              <button type="button" className="text-xs text-gray-500 underline" onClick={() => { setAnulando(null); setMotivoAnular("") }}>cancelar</button>
            </span>
          ) : (
            <button type="button" className="text-xs text-blue-700 underline" onClick={() => { setAnulando(a.id); setMotivoAnular("") }}>anular</button>
          )}
        </div>
      ))}
      {s.vigentes.length > 0 && (
        <div className="flex justify-end gap-2 pt-1 font-semibold">
          <span>Total</span><span className="font-mono">${fmt(s.total)}</span>
        </div>
      )}
      {abierto ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Concepto (ej. Inmobiliario MSA 2025 — pago anual)" className="h-8 text-sm" />
          <Input type="text" value={importe} onChange={e => setImporte(e.target.value)} placeholder="0,00" className="h-8 text-sm" />
          <SelectorCuentaContable value={categ} onSelect={c => setCateg(c?.categ || "")} placeholder="Cuenta del gasto…" autoFocus={false} />
          <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder={`Motivo (por defecto: Saldo que dejó el balance ${anioCierre - 1})`} className="h-8 text-sm" />
          <div className="flex gap-2 sm:col-span-2">
            <Button size="sm" onClick={agregar}>Anotar saldo</Button>
            <button type="button" className="text-xs text-gray-500 underline" onClick={() => setAbierto(false)}>cancelar</button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="mt-2" onClick={() => setAbierto(true)} disabled={!!error}>+ Anotar un saldo</Button>
      )}
      {s.anulados.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">{s.anulados.length} anulado(s): no suman; figuran en el export.</p>
      )}
    </div>
  )
}
