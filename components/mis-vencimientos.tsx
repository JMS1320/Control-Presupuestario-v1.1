"use client"

/**
 * 💸 «Lo que te vence» — el Principal de cada persona con vencimientos asignados (A-FEAT-1543).
 *
 * Nació para MA (Mercedes Areco): un rol sin secciones que sólo ve su Principal. JMS: *«que le diga que hoy le vence
 * autónomos, ABL Libertad… deberá poder decir que pagó, default fecha de ahora, editable con posibilidad de poner
 * detalle; siempre paga desde sus cuentas, sobre todo la principal»*.
 *
 * Lee y escribe por `/api/mis-vencimientos` (sólo lo asignado a la sesión). A quien no tiene nada asignado no se le
 * dibuja nada. Lógica en `lib/vencimientos/de-la-persona.ts`.
 */
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import type { Vencimiento } from "@/lib/vencimientos/de-la-persona"
import type { CuentaDePago } from "@/lib/pagos/pagado-desde"

const plata = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (iso: string) => iso.split("-").reverse().join("/")

function cuando(v: Vencimiento): string {
  if (v.urgencia === "hoy") return "vence HOY"
  if (v.dias < 0) return `venció el ${fecha(v.vencimiento)} (hace ${-v.dias} día${v.dias === -1 ? "" : "s"})`
  return `vence el ${fecha(v.vencimiento)} (en ${v.dias} día${v.dias === 1 ? "" : "s"})`
}

const ESTILO: Record<Vencimiento["urgencia"], string> = {
  vencido: "border-red-300 bg-red-50",
  hoy: "border-orange-300 bg-orange-50",
  proximo: "border-amber-200 bg-amber-50/50",
  pagado: "border-green-200 bg-green-50/50",
}
const ICONO: Record<Vencimiento["urgencia"], string> = { vencido: "🔴", hoy: "🟠", proximo: "🟡", pagado: "✅" }

export function MisVencimientos() {
  const [lista, setLista] = useState<Vencimiento[]>([])
  const [cuentas, setCuentas] = useState<CuentaDePago[]>([])
  const [hoy, setHoy] = useState("")
  const [asignados, setAsignados] = useState(0)
  const [admin, setAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [form, setForm] = useState({ fecha: "", medio: "", detalle: "" })
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/mis-vencimientos")
      const j = await r.json()
      if (!r.ok || !j.ok) { setError(j.error ?? "No se pudo leer lo que te vence."); return }
      setError(null); setLista(j.vencimientos); setCuentas(j.cuentas); setHoy(j.hoy); setAsignados(j.asignados); setAdmin(j.admin)
    } catch { setError("No se pudo leer lo que te vence.") }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const abrir = (v: Vencimiento) => {
    setAbierto(v.id)
    // Default del dato real: hoy, su cuenta principal y el detalle que la cuota ya tenía — todo editable.
    setForm({ fecha: hoy, medio: cuentas[0]?.id ?? "", detalle: v.detalle })
  }

  const pagar = async (v: Vencimiento) => {
    setGuardando(true)
    try {
      const r = await fetch("/api/mis-vencimientos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id, fecha: form.fecha, medio: form.medio, detalle: form.detalle }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) { toast.error(j.error ?? "No se pudo guardar."); return }
      toast.success(`«${v.nombre}» quedó pagado el ${fecha(form.fecha)}`)
      setAbierto(null); await cargar()
    } finally { setGuardando(false) }
  }

  const deshacer = async (v: Vencimiento) => {
    if (!window.confirm(`¿Volver «${v.nombre}» a pendiente? (lo marcaste pagado el ${fecha(v.fecha_pago ?? "")})`)) return
    const r = await fetch("/api/mis-vencimientos", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: v.id, deshacer: true }),
    })
    const j = await r.json()
    if (!r.ok || !j.ok) { toast.error(j.error ?? "No se pudo deshacer."); return }
    toast.success("Volvió a pendiente"); await cargar()
  }

  // A quien no tiene nada asignado, nada. Un error sí se muestra: un aviso que desaparece no distingue «nada» de «falló».
  if (!error && asignados === 0) return null
  const rotuloCuenta = (id: string | null) => cuentas.find(c => c.id === id)?.rotulo ?? id ?? ""
  const pendientes = lista.filter(v => v.urgencia !== "pagado")

  return (
    <Card className={pendientes.some(v => v.urgencia === "vencido" || v.urgencia === "hoy") ? "border-orange-300" : ""}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-base font-semibold">💸 Lo que te vence</p>
          {admin && <TestsDelProceso proceso="principal/mis-vencimientos" pantalla="principal" />}
        </div>
        {error && <p className="text-sm text-red-600">⚠️ {error}</p>}
        {!error && pendientes.length === 0 && <p className="text-sm text-green-700">✓ No te vence nada en estos días.</p>}
        <ul className="space-y-2">
          {lista.map(v => (
            <li key={v.id} className={`rounded-md border p-3 ${ESTILO[v.urgencia]}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-lg">{ICONO[v.urgencia]}</span>
                <span className="font-medium">{v.nombre}{v.numero_cuota ? ` · cuota ${v.numero_cuota}` : ""}</span>
                <span className="text-sm text-muted-foreground">{v.empresa}</span>
                <span className="ml-auto font-semibold tabular-nums">$ {plata(v.monto)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                {v.urgencia === "pagado" ? (
                  <>
                    <span className="text-green-800">Pagado el {fecha(v.fecha_pago ?? "")}{v.medio_pago ? ` desde ${rotuloCuenta(v.medio_pago)}` : ""}</span>
                    {v.detalle && <span className="text-muted-foreground">· {v.detalle}</span>}
                    <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => void deshacer(v)}>↩ No lo pagué</Button>
                  </>
                ) : (
                  <>
                    <span className={v.urgencia === "proximo" ? "" : "font-semibold"}>{cuando(v)}</span>
                    {abierto !== v.id && <Button size="sm" className="ml-auto h-8" onClick={() => abrir(v)}>💸 Ya lo pagué</Button>}
                  </>
                )}
              </div>
              {abierto === v.id && (
                <div className="mt-3 grid gap-2 rounded border bg-background p-3 text-sm sm:grid-cols-[auto_1fr]">
                  <label className="self-center">Fecha de pago</label>
                  <Input type="date" max={hoy} value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className="h-8 w-44" />
                  <label className="self-center">Pagado desde</label>
                  <select className="h-8 rounded border bg-background px-2" value={form.medio} onChange={e => setForm({ ...form, medio: e.target.value })}>
                    {cuentas.map(c => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
                  </select>
                  <label className="self-start pt-1">Detalle</label>
                  <textarea className="min-h-[60px] rounded border bg-background p-2" placeholder="Opcional: nº de VEP, comprobante, algo que convenga saber"
                    value={form.detalle} onChange={e => setForm({ ...form, detalle: e.target.value })} />
                  <div className="flex gap-2 sm:col-start-2">
                    <Button size="sm" disabled={guardando || !form.fecha || !form.medio} onClick={() => void pagar(v)}>{guardando ? "Guardando…" : "Guardar"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAbierto(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
