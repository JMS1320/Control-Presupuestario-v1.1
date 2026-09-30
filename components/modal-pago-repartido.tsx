"use client"

/**
 * 💸 **PAGAR UN SUELDO REPARTIDO ENTRE VARIOS DESTINOS** (A-FEAT-1212).
 *
 * Pedido del usuario 2026-09-30: *«cuando quiero hacer un pago a un empleado tener la posibilidad de
 * anotar cuánto a Lucrecia, cuánto a Galicia, cuánto a Santander y cuánto desde caja Sigot como
 * programado. Cada pago con su cuenta, y si es banco o caja, y si pasa a qué estado. **Se guarda todo
 * junto. A cada carga de importe va mostrando el saldo.** Poder asignar a un pago saldo A o saldo
 * total»*.
 *
 * ## Por qué un modal aparte y no el de siempre
 *
 * El modal de anticipos sigue sirviendo para **un** pago suelto y **no se toca**. Este es para el caso
 * que no se podía hacer: **repartir un sueldo en varios destinos de una sola vez**, viendo cómo se
 * agota el saldo mientras se carga. Toda la aritmética está en `lib/sueldos/pago-repartido.ts`, con
 * sus casos; acá sólo se muestra y se guarda.
 *
 * ## 🧮 El control se ve mientras se carga, no al final
 *
 * Debajo de cada renglón se muestra **el saldo que queda después de ese renglón**. Eso es lo que pidió
 * («a cada carga de importe va mostrando el saldo») y es lo que deja darse cuenta de que falta o sobra
 * **antes** de guardar, no después.
 *
 * ## 🚦 Qué frena y qué avisa
 *
 * - 🛑 **Frena** un renglón sin importe: no es un pago.
 * - ⚠️ **Avisa y deja seguir** si se paga más que el saldo — regla del propio usuario sobre los
 *   controles: *«es posible que yo tenga que pagar más o menos por algún motivo»*.
 *
 * ## 🔗 Se guardan como UN grupo
 *
 * Los N pagos se insertan con el mismo `grupo_pago_id`, que es cómo el sistema ya relaciona un pago
 * hecho por varios medios — **ya hay 12 pagos de sueldos agrupados así**. ⚠️ Esa columna tiene FK a
 * `msa.grupos_pago`, así que **primero se crea el grupo**; si eso falla, **los pagos se guardan igual
 * sin agrupar**: perder el pago por no poder agruparlo sería el peor de los dos males.
 */
import { useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { hoyArgentina } from "@/lib/fechas"
import {
  saldosDelPeriodo, controlarReparto, montoParaSaldo, estadoPorDefectoDe,
  type MedioPago, type EstadoPago, type RenglonPago,
} from "@/lib/sueldos/pago-repartido"

/** 💰 es-AR: los montos se escriben como texto y se parsean al guardar (§ 💰 de `CLAUDE.md`). */
const num = (v: string) => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0
const money = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const MEDIOS: Array<{ v: MedioPago; label: string }> = [
  { v: "banco", label: "Banco" },
  { v: "caja_general", label: "Caja General" },
  { v: "caja_ams", label: "Caja AMS" },
  { v: "caja_sigot", label: "Caja Sigot" },
]
const ESTADOS: EstadoPago[] = ["pagar", "programado", "pendiente", "pagado", "anterior"]

/** Un renglón mientras se edita: el importe es TEXTO hasta que se guarda. */
interface RenglonEdit {
  cuentaDestinoId: string | null
  medio: MedioPago
  montoTexto: string
  estado: EstadoPago
  fecha: string
  descripcion: string
}

export interface CuentaEmpleadoMinima {
  id: string
  banco: string | null
  alias: string | null
}

export interface PeriodoParaPagar {
  id: string
  bruto_calculado: number | null
  anticipos_descontados: number | null
  monto_a: number | null
}

interface Props {
  abierto: boolean
  onCerrar: () => void
  empleado: { id: string; nombre: string; cuit?: string | null }
  periodo: PeriodoParaPagar
  cuentas: CuentaEmpleadoMinima[]
  /** Para la descripción por default: «Pago Sep 2026». */
  mesEtiqueta: string
  etiquetaCuenta: (c: { banco: string | null; alias: string | null }) => string
  onGuardado: () => void
}

export function ModalPagoRepartido({
  abierto, onCerrar, empleado, periodo, cuentas, mesEtiqueta, etiquetaCuenta, onGuardado,
}: Props) {
  const [guardando, setGuardando] = useState(false)
  const [renglones, setRenglones] = useState<RenglonEdit[]>([nuevoRenglon(cuentas)])

  const saldos = useMemo(
    () => saldosDelPeriodo(
      periodo.bruto_calculado ?? 0, periodo.anticipos_descontados ?? 0, periodo.monto_a ?? 0),
    [periodo.bruto_calculado, periodo.anticipos_descontados, periodo.monto_a],
  )

  /** Los renglones con el importe ya numérico, que es lo que la lógica pura espera. */
  const comoPagos: RenglonPago[] = renglones.map(r => ({
    cuentaDestinoId: r.cuentaDestinoId,
    medio: r.medio,
    monto: num(r.montoTexto),
    estado: r.estado,
    fecha: r.fecha,
    descripcion: r.descripcion,
  }))
  const control = controlarReparto(saldos, comoPagos)

  const cambiar = (i: number, cambios: Partial<RenglonEdit>) =>
    setRenglones(prev => prev.map((r, j) => (j === i ? { ...r, ...cambios } : r)))

  /** 🎚️ Al cambiar el medio, el estado sigue el default — y se puede volver a pisar. */
  const cambiarMedio = (i: number, medio: MedioPago) =>
    cambiar(i, { medio, estado: estadoPorDefectoDe(medio) })

  /** 🔘 Los dos botones que pidió: completan el importe con lo que falta. */
  const completar = (i: number, cual: "total" | "A") =>
    cambiar(i, { montoTexto: money(montoParaSaldo(saldos, comoPagos, i, cual)) })

  async function guardar() {
    if (!control.sePuedeGuardar) return
    setGuardando(true)
    try {
      /**
       * 1 · El grupo. Tiene FK a `msa.grupos_pago`, así que se crea primero.
       *     Si falla, se sigue **sin** agrupar: el pago importa más que la agrupación.
       */
      let grupoId: string | null = null
      const { data: grupo } = await supabase.schema("msa").from("grupos_pago")
        .insert({
          cuit: empleado.cuit ?? null,
          proveedor: empleado.nombre,
          monto_total: control.total,
          estado: "sueldo",
          observaciones: `Pago repartido de sueldo — ${mesEtiqueta} — ${renglones.length} destino(s)`,
        })
        .select("id").maybeSingle()
      grupoId = (grupo as { id?: string } | null)?.id ?? null
      if (!grupoId) {
        toast.warning("No se pudo crear el grupo: los pagos se guardan igual, pero sin agrupar.")
      }

      // 2 · Los pagos, todos juntos.
      const { error } = await supabase.from("sueldos_pagos").insert(
        comoPagos.map(r => ({
          periodo_id: periodo.id,
          empleado_id: empleado.id,
          tipo: "sueldo",
          fecha: r.fecha,
          monto: r.monto,
          cuenta_destino_id: r.cuentaDestinoId,
          descripcion: r.descripcion?.trim() || `Pago ${mesEtiqueta}`,
          estado: r.estado,
          medio_pago: r.medio,
          grupo_pago_id: grupoId,
        })),
      )
      if (error) throw new Error(error.message)

      /**
       * 3 · Y el período: `anticipos_descontados` sube por el total y el saldo se recalcula.
       *     Es el mismo cálculo que hace el pago suelto — el saldo nunca se guarda a mano.
       */
      const nuevosAnticipos = (periodo.anticipos_descontados ?? 0) + control.total
      const { error: errPeriodo } = await supabase.from("sueldos_periodos")
        .update({
          anticipos_descontados: nuevosAnticipos,
          saldo_pendiente: (periodo.bruto_calculado ?? 0) - nuevosAnticipos,
        })
        .eq("id", periodo.id)
      if (errPeriodo) throw new Error(errPeriodo.message)

      toast.success(
        `${renglones.length} pago(s) registrados por ${money(control.total)}. `
        + `Saldo: ${money(control.saldoFinal)}`)
      onGuardado()
      onCerrar()
      setRenglones([nuevoRenglon(cuentas)])
    } catch (e) {
      toast.error("No se pudieron registrar los pagos: " + (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pagar el sueldo de {empleado.nombre} — {mesEtiqueta}</DialogTitle>
        </DialogHeader>

        {/* Los saldos, arriba y siempre a la vista */}
        <div className="grid grid-cols-4 gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm">
          <div><span className="text-gray-500">Bruto</span><br /><strong>{money(saldos.bruto)}</strong></div>
          <div><span className="text-gray-500">Ya pagado</span><br />{money(saldos.yaPagado)}</div>
          <div><span className="text-gray-500">Saldo total</span><br /><strong className="text-blue-700">{money(saldos.saldoTotal)}</strong></div>
          <div><span className="text-gray-500">Saldo A (convenio)</span><br /><strong className="text-blue-700">{money(saldos.saldoA)}</strong></div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 min-h-0 py-1">
          {renglones.map((r, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <Label className="text-xs">Destino</Label>
                  <Select
                    value={r.cuentaDestinoId ?? "__none__"}
                    onValueChange={v => cambiar(i, { cuentaDestinoId: v === "__none__" ? null : v })}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin especificar</SelectItem>
                      {cuentas.map(c => (
                        <SelectItem key={c.id} value={c.id}>{etiquetaCuenta(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Medio</Label>
                  <Select value={r.medio} onValueChange={v => cambiarMedio(i, v as MedioPago)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MEDIOS.map(m => <SelectItem key={m.v} value={m.v}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Importe</Label>
                  {/* 💰 type="text" y formato es-AR, nunca type="number" (§ 💰). */}
                  <Input
                    type="text" placeholder="0,00" className="h-8 text-sm text-right"
                    value={r.montoTexto}
                    onChange={e => cambiar(i, { montoTexto: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Estado</Label>
                  <Select value={r.estado} onValueChange={v => cambiar(i, { estado: v as EstadoPago })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">Fecha</Label>
                  <Input type="date" className="h-8 text-sm"
                    value={r.fecha} onChange={e => cambiar(i, { fecha: e.target.value })} />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button variant="ghost" size="sm" className="h-8 px-2"
                    disabled={renglones.length === 1}
                    onClick={() => setRenglones(prev => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-gray-400" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]"
                  onClick={() => completar(i, "total")}>
                  Pagar saldo total
                </Button>
                <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]"
                  onClick={() => completar(i, "A")}>
                  Pagar saldo A
                </Button>
                {/* 🧮 El saldo DESPUÉS de este renglón: es lo que pidió ver mientras carga. */}
                <span className="ml-auto text-gray-500">
                  saldo después:{" "}
                  <strong className={control.pasos[i]?.saldoDespues < -0.01 ? "text-amber-600" : "text-gray-700"}>
                    {money(control.pasos[i]?.saldoDespues ?? 0)}
                  </strong>
                </span>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm"
            onClick={() => setRenglones(prev => [...prev, nuevoRenglon(cuentas)])}>
            <Plus className="h-4 w-4 mr-1" /> Agregar destino
          </Button>
        </div>

        {/* 🧮 El control, al pie y proporcional: ✓ discreto si cierra, alerta si no (§ 🧮). */}
        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-gray-500">Total a pagar</span>
            <strong>{money(control.total)}</strong>
            <span className="ml-auto text-gray-500">Saldo que queda</span>
            <strong className={control.pagaDeMas ? "text-amber-600" : "text-gray-800"}>
              {money(control.saldoFinal)}
            </strong>
            {Math.abs(control.saldoFinal) <= 0.01 && (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            )}
          </div>
          {control.pagaDeMas && (
            <p className="flex items-start gap-1 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Se está pagando <strong>{money(-control.saldoFinal)}</strong> más que el saldo. Puede ser
              a propósito — se guarda igual.
            </p>
          )}
          {control.sinImporte.length > 0 && (
            <p className="text-xs text-red-600">
              Hay {control.sinImporte.length} renglón(es) sin importe: completalos o borralos.
            </p>
          )}
          {control.cuentasRepetidas.length > 0 && (
            <p className="text-xs text-amber-700">
              Hay dos renglones a la misma cuenta. Se puede guardar, pero revisá que sea a propósito.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || !control.sePuedeGuardar}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Registrar {renglones.length} pago{renglones.length > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Un renglón nuevo: con la primera cuenta del empleado y el estado que corresponde al banco. */
function nuevoRenglon(cuentas: CuentaEmpleadoMinima[]): RenglonEdit {
  return {
    cuentaDestinoId: cuentas[0]?.id ?? null,
    medio: "banco",
    montoTexto: "",
    estado: estadoPorDefectoDe("banco"),
    fecha: hoyArgentina(),
    descripcion: "",
  }
}
