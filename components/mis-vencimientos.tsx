"use client"

/**
 * 💸 «Lo que te vence» — el Principal de cada persona con vencimientos asignados (A-FEAT-1543).
 *
 * Nació para MA (Mercedes Areco): un rol sin secciones que sólo ve su Principal. JMS: *«que le diga que hoy le vence
 * autónomos, ABL Libertad… deberá poder decir que pagó, default fecha de ahora, editable con posibilidad de poner
 * detalle; siempre paga desde sus cuentas, sobre todo la principal»* · *«que le aparezca si hago hoy o otro día;
 * editar lo que pagó»* · *«¿eso quedará conmigo hasta que confirme antes de impactar?»*.
 *
 * ⚠️ cambió 05/11: «Pagué» INFORMA (propuesta) y la cuota cambia cuando JMS confirma («Pagos informados por
 * confirmar», `components/pagos-por-confirmar.tsx`). Mientras tanto ella lo ve «⏳ esperando confirmación» y puede
 * editarlo o anularlo. Si JMS se lo devuelve, vuelve a verlo sin pagar, con el motivo.
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
import { montoAR, type Vencimiento } from "@/lib/vencimientos/de-la-persona"
import type { CuentaDePago } from "@/lib/pagos/pagado-desde"
import { useVistaComoPersona } from "@/components/contexto-permisos"
import { VistaComoPersona } from "@/components/vista-como-persona"

const plata = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (iso: string) => iso.split("-").reverse().join("/")

function cuando(v: Vencimiento): string {
  if (v.dias === 0) return "vence HOY"
  if (v.dias < 0) return `venció el ${fecha(v.vencimiento)} (hace ${-v.dias} día${v.dias === -1 ? "" : "s"})`
  return `vence el ${fecha(v.vencimiento)} (en ${v.dias} día${v.dias === 1 ? "" : "s"})`
}

const ESTILO: Record<Vencimiento["urgencia"], string> = {
  vencido: "border-red-300 bg-red-50",
  hoy: "border-orange-300 bg-orange-50",
  proximo: "border-amber-200 bg-amber-50/50",
  informado: "border-sky-200 bg-sky-50/60",
  pagado: "border-green-200 bg-green-50/50",
}
const ICONO: Record<Vencimiento["urgencia"], string> = { vencido: "🔴", hoy: "🟠", proximo: "🟡", informado: "⏳", pagado: "✅" }

/** 👁️ A-BUG-1544: en «Ver como lo ve él», lo que le vence a la persona elegida, sólo para mirar. */
export function MisVencimientos() {
  const vista = useVistaComoPersona()
  if (!vista) return <MisVencimientosDe como={null} />
  return (
    <VistaComoPersona titulo="Lo que te vence" persona={vista.persona}>
      {vista.persona && <MisVencimientosDe key={vista.persona.mail} como={vista.persona.mail} />}
    </VistaComoPersona>
  )
}

type Form = { cuando: "hoy" | "otro"; fecha: string; monto: string; medio: string; detalle: string }

function MisVencimientosDe({ como }: { como: string | null }) {
  const [lista, setLista] = useState<Vencimiento[]>([])
  const [cuentas, setCuentas] = useState<CuentaDePago[]>([])
  const [hoy, setHoy] = useState("")
  const [asignados, setAsignados] = useState(0)
  const [admin, setAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [form, setForm] = useState<Form>({ cuando: "hoy", fecha: "", monto: "", medio: "", detalle: "" })
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(como ? `/api/mis-vencimientos?como=${encodeURIComponent(como)}` : "/api/mis-vencimientos")
      const j = await r.json()
      if (!r.ok || !j.ok) { setError(j.error ?? "No se pudo leer lo que te vence."); return }
      setError(null); setLista(j.vencimientos); setCuentas(j.cuentas); setHoy(j.hoy); setAsignados(j.asignados); setAdmin(j.admin)
    } catch { setError("No se pudo leer lo que te vence.") }
  }, [como])
  useEffect(() => { void cargar() }, [cargar])

  const abrir = (v: Vencimiento) => {
    setAbierto(v.id)
    // Default del dato real (o lo que ya informó, si está editando): hoy, el monto de la cuota, su cuenta principal y el
    // detalle que la cuota ya tenía — todo editable.
    const inf = v.informado
    const f = inf?.fecha_pago ?? hoy
    setForm({
      cuando: f === hoy ? "hoy" : "otro", fecha: f,
      monto: (inf?.monto ?? v.monto).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      medio: inf?.medio_pago ?? cuentas[0]?.id ?? "", detalle: inf?.detalle ?? v.detalle,
    })
  }

  const informar = async (v: Vencimiento) => {
    const fechaPago = form.cuando === "hoy" ? hoy : form.fecha
    const monto = montoAR(form.monto)
    if (!(monto > 0)) { toast.error("Poné el monto que pagaste (por ejemplo 61.126,50)."); return }
    setGuardando(true)
    try {
      const r = await fetch("/api/mis-vencimientos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id, fecha: fechaPago, monto, medio: form.medio, detalle: form.detalle }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) { toast.error(j.error ?? "No se pudo guardar."); return }
      toast.success(`Listo: «${v.nombre}» quedó informado. Falta que JMS lo confirme.`)
      setAbierto(null); await cargar()
    } finally { setGuardando(false) }
  }

  const anular = async (v: Vencimiento) => {
    if (!window.confirm(`¿Anular lo que informaste de «${v.nombre}»? Vuelve a quedar sin pagar.`)) return
    const r = await fetch("/api/mis-vencimientos", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: v.id, anular: true }),
    })
    const j = await r.json()
    if (!r.ok || !j.ok) { toast.error(j.error ?? "No se pudo anular."); return }
    toast.success("Anulado: vuelve a quedar sin pagar"); await cargar()
  }

  // A quien no tiene nada asignado, nada. Un error sí se muestra: un aviso que desaparece no distingue «nada» de «falló».
  if (!error && asignados === 0) {
    return como ? <p className="p-3 text-sm text-muted-foreground">💸 Lo que te vence: no tiene nada asignado (Configuración → Quién recibe qué).</p> : null
  }
  const rotuloCuenta = (id: string | null) => cuentas.find(c => c.id === id)?.rotulo ?? id ?? ""
  const sinPagar = lista.filter(v => v.urgencia === "vencido" || v.urgencia === "hoy" || v.urgencia === "proximo")

  return (
    <Card className={sinPagar.some(v => v.urgencia !== "proximo") ? "border-orange-300" : ""}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-base font-semibold">💸 Lo que te vence</p>
          {admin && !como && <TestsDelProceso proceso="principal/mis-vencimientos" pantalla="principal" />}
        </div>
        {error && <p className="text-sm text-red-600">⚠️ {error}</p>}
        {!error && sinPagar.length === 0 && <p className="text-sm text-green-700">✓ No te vence nada en estos días.</p>}
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
                {v.urgencia === "pagado" && (
                  <span className="text-green-800">Pagado el {fecha(v.fecha_pago ?? "")}{v.medio_pago ? ` desde ${rotuloCuenta(v.medio_pago)}` : ""} · confirmado{v.detalle ? ` · ${v.detalle}` : ""}</span>
                )}
                {v.urgencia === "informado" && v.informado && (
                  <>
                    <span className="text-sky-900">
                      Informaste que pagaste <strong>$ {plata(v.informado.monto)}</strong> el {fecha(v.informado.fecha_pago)} desde {rotuloCuenta(v.informado.medio_pago)}
                      {v.informado.detalle ? ` · ${v.informado.detalle}` : ""} — <strong>esperando que JMS lo confirme</strong>
                    </span>
                    {abierto !== v.id && (
                      <span className="ml-auto flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => abrir(v)}>✏️ Editar</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void anular(v)}>Anular</Button>
                      </span>
                    )}
                  </>
                )}
                {(v.urgencia === "vencido" || v.urgencia === "hoy" || v.urgencia === "proximo") && (
                  <>
                    <span className={v.urgencia === "proximo" ? "" : "font-semibold"}>{cuando(v)}</span>
                    {abierto !== v.id && <Button size="sm" className="ml-auto h-8" onClick={() => abrir(v)}>💸 Pagué</Button>}
                  </>
                )}
              </div>
              {v.devuelto && v.urgencia !== "informado" && (
                <p className="mt-1 text-sm text-amber-800">↩ JMS te lo devolvió: «{v.devuelto}». Revisalo y volvé a informarlo.</p>
              )}
              {abierto === v.id && (
                <div className="mt-3 grid gap-2 rounded border bg-background p-3 text-sm sm:grid-cols-[auto_1fr]">
                  <span className="self-center">¿Cuándo pagaste?</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant={form.cuando === "hoy" ? "default" : "outline"} className="h-8"
                      onClick={() => setForm({ ...form, cuando: "hoy", fecha: hoy })}>Hoy</Button>
                    <Button size="sm" variant={form.cuando === "otro" ? "default" : "outline"} className="h-8"
                      onClick={() => setForm({ ...form, cuando: "otro", fecha: form.fecha && form.fecha !== hoy ? form.fecha : "" })}>Otro día</Button>
                    {form.cuando === "otro" && (
                      <Input type="date" max={hoy} value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className="h-8 w-44" />
                    )}
                  </div>
                  <label className="self-center">Cuánto pagaste</label>
                  <Input type="text" inputMode="decimal" placeholder="0,00" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} className="h-8 w-44" />
                  <label className="self-center">Desde qué cuenta</label>
                  <select className="h-8 rounded border bg-background px-2" value={form.medio} onChange={e => setForm({ ...form, medio: e.target.value })}>
                    {cuentas.map(c => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
                  </select>
                  <label className="self-start pt-1">Detalle</label>
                  <textarea className="min-h-[60px] rounded border bg-background p-2" placeholder="Opcional: nº de VEP, comprobante, algo que convenga saber"
                    value={form.detalle} onChange={e => setForm({ ...form, detalle: e.target.value })} />
                  <div className="flex flex-wrap items-center gap-2 sm:col-start-2">
                    <Button size="sm" disabled={guardando || (form.cuando === "otro" && !form.fecha) || !form.medio} onClick={() => void informar(v)}>
                      {guardando ? "Guardando…" : v.informado ? "Guardar cambios" : "Informar el pago"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAbierto(null)}>Cancelar</Button>
                    <span className="text-xs text-muted-foreground">Queda para que JMS lo confirme.</span>
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
