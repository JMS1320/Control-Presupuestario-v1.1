"use client"

/**
 * 💰 **CAMBIAR EL MONTO DE UNA CUOTA DE TEMPLATE — y si propagarlo a las futuras.** A-FEAT-1238.
 *
 * Era un modal que vivía sólo en la grilla de Templates. Pedido del usuario (nota 2026-09-09):
 * *«modificar montos de templates desde cash flow debería levantar el modal ya existente que 1ro
 * pregunta si se quiere propagar y luego si se quiere propagar un monto distinto… lo que ya funciona
 * desde grilla debe suceder igual en cash flow»*. Se mudó acá **tal cual** (§ ♻️ centralizar) y lo usan
 * las dos pantallas: un solo camino para el mismo cambio.
 *
 * Tres salidas: **SÍ** (esta cuota + las futuras, con el mismo monto o con otro), **NO** (sólo esta),
 * **Cancelar** (nada). El que lo abre recibe qué pasó y recarga lo suyo.
 */
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { usePropagacionCuotas } from "@/hooks/usePropagacionCuotas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export type ResultadoPropagacion =
  | { tipo: "propagado"; cuotasModificadas: number; montoPropagado: number; nuevoMonto: number }
  | { tipo: "solo-esta"; nuevoMonto: number }

export function ModalPropagarMontoCuota({ abierto, cuotaId, nuevoMonto, onCancelar, onGuardado }: {
  abierto: boolean
  cuotaId: string
  /** El monto que se escribió para ESTA cuota. */
  nuevoMonto: number
  onCancelar: () => void
  onGuardado: (r: ResultadoPropagacion) => void | Promise<void>
}) {
  const { ejecutarPropagacion } = usePropagacionCuotas()
  const [montoPersonalizado, setMontoPersonalizado] = useState("")
  const [guardando, setGuardando] = useState(false)
  const parsear = (t: string) => parseFloat(t.replace(/\./g, "").replace(",", ".")) || 0

  const cerrarLimpio = () => { setMontoPersonalizado(""); setGuardando(false) }

  const si = async () => {
    setGuardando(true)
    try {
      const montoParaPropagar = montoPersonalizado ? parsear(montoPersonalizado) || nuevoMonto : nuevoMonto
      // 1. Propagar a las cuotas futuras
      const r = await ejecutarPropagacion({
        templateId: "template",
        cuotaModificadaId: cuotaId,
        nuevoMonto: montoParaPropagar,
        aplicarATodasLasFuturas: true,
      })
      // 2. Guardar la cuota actual (siempre con el monto editado)
      const { error } = await supabase.from("cuotas_egresos_sin_factura").update({ monto: nuevoMonto }).eq("id", cuotaId)
      if (error) throw error
      cerrarLimpio()
      await onGuardado({ tipo: "propagado", cuotasModificadas: r.success ? r.cuotasModificadas : 0, montoPropagado: montoParaPropagar, nuevoMonto })
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Error desconocido"}`)
      setGuardando(false)
    }
  }

  const no = async () => {
    setGuardando(true)
    try {
      const { error } = await supabase.from("cuotas_egresos_sin_factura").update({ monto: nuevoMonto }).eq("id", cuotaId)
      if (error) throw error
      cerrarLimpio()
      await onGuardado({ tipo: "solo-esta", nuevoMonto })
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : "Error desconocido"}`)
      setGuardando(false)
    }
  }

  const cancelar = () => { cerrarLimpio(); onCancelar() }

  return (
    <Dialog open={abierto} onOpenChange={() => {}}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>💰 Modificar Monto</DialogTitle>
          <DialogDescription>
            Monto cuota actual: <strong>${nuevoMonto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-sm text-gray-600">¿Desea propagar a las cuotas futuras de este template?</p>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="monto-propagar">Monto a propagar (opcional):</label>
            <Input
              id="monto-propagar"
              type="text"
              placeholder={`Dejar vacío = $${nuevoMonto.toLocaleString("es-AR")}`}
              value={montoPersonalizado}
              onChange={(e) => setMontoPersonalizado(e.target.value)}
              className="w-full"
              disabled={guardando}
            />
            <p className="text-xs text-gray-500">
              Si ingresa un monto diferente, la cuota actual quedará en ${nuevoMonto.toLocaleString("es-AR")} y las futuras en el monto ingresado.
            </p>
          </div>
          <ul className="text-sm text-gray-500 list-disc pl-5 space-y-1">
            <li><strong>SÍ, propagar:</strong> Cuotas futuras con monto {montoPersonalizado ? `$${parsear(montoPersonalizado).toLocaleString("es-AR")}` : "igual"}</li>
            <li><strong>NO, solo esta:</strong> Solo se modificará esta cuota</li>
            <li><strong>Cancelar:</strong> No hacer ningún cambio</li>
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={cancelar} disabled={guardando}>Cancelar</Button>
          <Button variant="secondary" onClick={() => void no()} disabled={guardando}>{guardando ? "Guardando..." : "NO, solo esta"}</Button>
          <Button onClick={() => void si()} disabled={guardando}>{guardando ? "Guardando..." : "SÍ, propagar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
