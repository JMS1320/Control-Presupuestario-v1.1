"use client"

/**
 * Aviso en Principal: **ECHEQs que ya llegaron a su fecha de cobro y siguen `vigente`**.
 *
 * 🔑 **Para qué existe.** El estado del cheque ya estaba en la base desde siempre
 * (`vigente → depositado → cobrado → rechazado`) **y no lo usaba nadie**: al 2026-09-28 los 9
 * cheques estaban en `vigente` y **8 ya habían pasado su fecha de cobro** — el más viejo por 164
 * días, $11,8 M en total de los que nadie sabía si habían salido. El dato estaba; lo que faltaba
 * era **traerlo a la vista**.
 *
 * 🛑 **Marcar «cobrado» NO es conciliar, y es a propósito** (pedido del usuario 2026-09-28):
 *
 * | | Qué significa | Quién lo pone |
 * |---|---|---|
 * | `cobrado` | **lo vi debitado en el banco** | él, en dos segundos |
 * | conciliado | el movimiento quedó vinculado al comprobante | el proceso formal, después |
 *
 * Por eso este cartel mira **el estado del cheque** y no el de conciliación: así un echeq que él ya
 * vio salir **desaparece de la vista sin mentir** sobre el proceso. **La cadena del cheque termina
 * en `cobrado`**; no hay un estado «conciliado» del cheque.
 *
 * 🎚️ **La FECHA no se asume.** Al marcarlo, el default es la **fecha de cobro del cheque** —el dato
 * real— y se puede cambiar a mano: *«que pase a cobrado está ok pero no necesariamente con fecha de
 * hoy»*. Es `CLAUDE.md` § 🎚️ *default del dato real, siempre editable*.
 */

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CalendarClock, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface Cheque {
  id: string
  numero: string | null
  banco: string | null
  monto: number | null
  fecha_cobro: string | null
  beneficiario_nombre: string | null
}

const hoyISO = () => new Date().toISOString().slice(0, 10)

/** Cuántos días pasaron desde la fecha de cobro. Negativo = todavía no llegó. */
const diasDesde = (fecha: string | null) => {
  if (!fecha) return 0
  const ms = new Date(hoyISO()).getTime() - new Date(fecha).getTime()
  return Math.round(ms / 86_400_000)
}

const plata = (n: number | null) =>
  (n ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function AlertaEcheqsEnFecha() {
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [cargando, setCargando] = useState(true)
  /** Cheque que se está marcando, con la fecha que el usuario confirme. */
  const [marcando, setMarcando] = useState<{ id: string; fecha: string } | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .schema("msa")
        .from("cheques")
        .select("id, numero, banco, monto, fecha_cobro, beneficiario_nombre")
        .eq("estado", "vigente")
        .lte("fecha_cobro", hoyISO())
        .order("fecha_cobro", { ascending: true })
      if (error) throw error
      setCheques((data ?? []) as Cheque[])
    } catch (e) {
      console.error("Alerta echeqs — error:", e)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const marcarCobrado = async () => {
    if (!marcando) return
    setGuardando(true)
    try {
      const { error } = await supabase
        .schema("msa")
        .from("cheques")
        .update({ estado: "cobrado", fecha_estado: marcando.fecha })
        .eq("id", marcando.id)
      if (error) throw error
      toast.success("Marcado como cobrado. Sigue pendiente de conciliar, que es otra cosa.")
      setMarcando(null)
      cargar()
    } catch (e) {
      toast.error("Error: " + (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando || cheques.length === 0) return null

  const total = cheques.reduce((s, c) => s + (c.monto ?? 0), 0)
  // El más viejo manda el color: uno de hace 5 meses no es lo mismo que uno de ayer.
  const masViejo = Math.max(...cheques.map(c => diasDesde(c.fecha_cobro)))
  const grave = masViejo > 30

  return (
    <Card className={`entrada-suave ${grave ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <CalendarClock className={`h-5 w-5 shrink-0 mt-0.5 ${grave ? "text-red-700" : "text-amber-700"}`} />
          <div className="flex-1 min-w-0">
            <div className={`font-medium ${grave ? "text-red-900" : "text-amber-900"}`}>
              {cheques.length} echeq{cheques.length === 1 ? "" : "s"} en fecha de cobro sin marcar
              {" — "}${plata(total)}
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Ya pasó su fecha de cobro y siguen figurando como <strong>vigentes</strong>: nadie
              confirmó todavía que hayan salido de la cuenta.
            </p>

            <div className="mt-2.5 space-y-1">
              {cheques.map(c => {
                const dias = diasDesde(c.fecha_cobro)
                const enEdicion = marcando?.id === c.id
                return (
                  <div key={c.id} className="rounded border bg-white px-2 py-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-mono text-[11px] text-gray-500">{c.fecha_cobro}</span>
                      {dias > 30 && (
                        <span className="rounded bg-red-100 px-1 text-[10px] leading-4 text-red-800">
                          hace {dias} días
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-gray-800">
                        {c.beneficiario_nombre || "(sin beneficiario)"}
                      </span>
                      <span className="font-mono text-sm font-medium text-gray-900">
                        ${plata(c.monto)}
                      </span>
                      {!enEdicion && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => setMarcando({ id: c.id, fecha: c.fecha_cobro ?? hoyISO() })}>
                          Ya lo vi debitado
                        </Button>
                      )}
                    </div>

                    {enEdicion && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t pt-1.5">
                        <span className="text-[11px] text-gray-600">¿Qué día salió?</span>
                        {/* 🎚️ Default: la fecha de cobro del cheque (el dato real), editable. */}
                        <Input type="date" className="h-7 w-auto text-xs"
                          id={`fecha-cobrado-${c.id}`}
                          value={marcando.fecha}
                          onChange={e => setMarcando({ id: c.id, fecha: e.target.value })} />
                        <Button size="sm" className="h-7 text-xs" disabled={guardando || !marcando.fecha}
                          onClick={marcarCobrado}>
                          {guardando
                            ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Guardando…</>
                            : "Confirmar"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs"
                          onClick={() => setMarcando(null)}>
                          Cancelar
                        </Button>
                        <span className="text-[10px] text-gray-500">
                          Viene la fecha de cobro del cheque — cambiala si salió otro día.
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="text-[11px] text-gray-500 mt-2.5">
              Marcarlo como cobrado <strong>no lo concilia</strong>: sólo dice que lo viste salir del
              banco. La conciliación sigue su camino aparte, y el echeq desaparece de acá.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
