"use client"

/**
 * ✔ «Pagos informados por confirmar» — en el Principal de JMS (A-FEAT-1543).
 *
 * Lo que una persona (MA) informó que pagó desde «Lo que te vence» NO toca la cuota hasta acá. JMS ve lo que puso, lo
 * puede corregir (arranca con lo de ella: § Default del dato real) y **Confirma** (la cuota pasa a pagada) o **Devuelve**
 * con un motivo (ella lo vuelve a ver sin pagar, con el motivo). Sólo admin: a cualquier otro la API le dice que no y
 * el bloque no se dibuja. Si no hay nada, tampoco.
 */
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { montoAR } from "@/lib/vencimientos/de-la-persona"
import type { CuentaDePago } from "@/lib/pagos/pagado-desde"

const plata = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (iso: string) => (iso ?? "").slice(0, 10).split("-").reverse().join("/")

interface Pendiente {
  id: string
  persona: string
  informado: { fecha_pago: string; monto: number; medio_pago: string; detalle: string | null }
  propuesta_at: string
  cuota: { id: string; estado: string; monto: number; numero_cuota: number | null; vencimiento: string; nombre: string; responsable: string | null } | null
}

export function PagosPorConfirmar() {
  const [lista, setLista] = useState<Pendiente[] | null>(null)
  const [cuentas, setCuentas] = useState<CuentaDePago[]>([])
  const [edit, setEdit] = useState<Record<string, { fecha: string; monto: string; medio: string; detalle: string }>>({})
  const [trabajando, setTrabajando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/mis-vencimientos/confirmar")
      if (!r.ok) { setLista([]); return }
      const j = await r.json()
      const ps = (j.pendientes ?? []) as Pendiente[]
      setLista(ps); setCuentas(j.cuentas ?? [])
      setEdit(Object.fromEntries(ps.map(p => [p.id, {
        fecha: p.informado.fecha_pago, monto: plata(Number(p.informado.monto)), medio: p.informado.medio_pago, detalle: p.informado.detalle ?? "",
      }])))
    } catch { setLista([]) }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  if (!lista || lista.length === 0) return null

  const resolver = async (p: Pendiente, accion: "confirmar" | "devolver") => {
    let cuerpo: Record<string, unknown> = { id: p.id, accion }
    if (accion === "devolver") {
      const motivo = window.prompt(`¿Por qué se lo devolvés a ${p.persona}? (lo va a ver ella)`)
      if (!motivo?.trim()) return
      cuerpo = { ...cuerpo, motivo }
    } else {
      const e = edit[p.id]
      const monto = montoAR(e.monto)
      if (!(monto > 0)) { toast.error("El monto no es válido."); return }
      cuerpo = { ...cuerpo, fecha: e.fecha, monto, medio: e.medio, detalle: e.detalle }
    }
    setTrabajando(p.id)
    try {
      const r = await fetch("/api/mis-vencimientos/confirmar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) })
      const j = await r.json()
      if (!r.ok || !j.ok) { toast.error(j.error ?? "No se pudo."); return }
      toast.success(accion === "confirmar" ? "Confirmado: la cuota quedó pagada" : "Devuelto con el motivo")
      await cargar()
    } finally { setTrabajando(null) }
  }

  return (
    <Card className="border-sky-300">
      <CardContent className="space-y-3 p-4">
        <p className="text-base font-semibold">💸 Pagos informados por confirmar <span className="text-sm font-normal text-muted-foreground">({lista.length})</span></p>
        <p className="text-xs text-muted-foreground">Lo informó la persona desde su Principal. La cuota recién cambia cuando confirmás; podés corregir antes lo que haga falta.</p>
        <ul className="space-y-2">
          {lista.map(p => {
            const e = edit[p.id]
            const difMonto = p.cuota && Math.abs(montoAR(e?.monto ?? "") - p.cuota.monto) >= 0.01
            return (
              <li key={p.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{p.cuota?.nombre ?? "Cuota"}{p.cuota?.numero_cuota ? ` · cuota ${p.cuota.numero_cuota}` : ""}</span>
                  <span className="text-muted-foreground">{p.cuota?.responsable ?? ""} · vence {fecha(p.cuota?.vencimiento ?? "")} · cuota $ {plata(p.cuota?.monto ?? 0)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">informó {p.persona} el {fecha(p.propuesta_at)}</span>
                </div>
                {p.cuota && p.cuota.estado !== "pendiente" && p.cuota.estado !== "pagar" && (
                  <p className="mt-1 text-xs text-amber-700">⚠️ La cuota ya está «{p.cuota.estado}»: no se puede confirmar; devolvésela con el motivo.</p>
                )}
                {e && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input type="date" value={e.fecha} onChange={x => setEdit({ ...edit, [p.id]: { ...e, fecha: x.target.value } })} className="h-8 w-40" />
                    <Input type="text" value={e.monto} onChange={x => setEdit({ ...edit, [p.id]: { ...e, monto: x.target.value } })}
                      className={`h-8 w-36 ${difMonto ? "border-amber-500" : ""}`} title={difMonto ? "Distinto del monto de la cuota" : undefined} />
                    <select className="h-8 rounded border bg-background px-2" value={e.medio} onChange={x => setEdit({ ...edit, [p.id]: { ...e, medio: x.target.value } })}>
                      {!cuentas.some(c => c.id === e.medio) && <option value={e.medio}>{e.medio}</option>}
                      {cuentas.map(c => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
                    </select>
                    <Input value={e.detalle} placeholder="Detalle" onChange={x => setEdit({ ...edit, [p.id]: { ...e, detalle: x.target.value } })} className="h-8 min-w-[180px] flex-1" />
                    <Button size="sm" disabled={trabajando === p.id} onClick={() => void resolver(p, "confirmar")}>✔ Confirmar</Button>
                    <Button size="sm" variant="outline" disabled={trabajando === p.id} onClick={() => void resolver(p, "devolver")}>↩ Devolver</Button>
                  </div>
                )}
                {difMonto && <p className="mt-1 text-xs text-amber-700">El monto informado no es el de la cuota: al confirmar, la cuota queda con el informado.</p>}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
