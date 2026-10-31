"use client"

/**
 * 🧾 Aviso en Principal: IMPUESTOS VENCIDOS SIN PAGAR O PRÓXIMOS A VENCER — A-FEAT-1319.
 *
 * Pedido del usuario 2026-10-21: *«el primer warning, más a la vista»*. Por eso va arriba de todo en
 * Principal, en rojo si hay algo vencido y en amarillo si sólo hay vencimientos cerca. La lógica vive
 * en `lib/impuestos/vencimientos.ts` (qué es impuesto, con cuánta anticipación, qué es «sin pagar»).
 *
 * Es la ALERTA ANTES de la pieza 3 del norte administrativo (§ 🔔 de `CLAUDE.md`). Cuando no hay nada,
 * se dice con un ✓ discreto: un aviso que desaparece no distingue «todo bien» de «no cargó».
 */
import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { hoyArgentina } from "@/lib/fechas"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import { impuestosAAvisar, ESTADOS_SIN_PAGAR, type CuotaImpuesto, type ImpuestoAvisado } from "@/lib/impuestos/vencimientos"
import { PasarTarea } from "@/components/boton-revision"
import { senalMonto } from "@/lib/revisiones/nivel"
import { linkPagar } from "@/lib/revisiones/avisos"

const plata = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (iso: string) => iso.split("-").reverse().join("/")
const MOSTRAR = 8

/**
 * `compacta`: un solo renglón, cerrado (dentro de la planilla, para que la grilla tenga lugar —
 * usuario 2026-10-24). En Principal va completa, como siempre.
 */
export function AlertaImpuestos({ compacta = false }: { compacta?: boolean } = {}) {
  const [datos, setDatos] = useState<ReturnType<typeof impuestosAAvisar> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(!compacta)

  const cargar = useCallback(async () => {
    setError(null)
    const { data, error: e } = await supabase
      .from("cuotas_egresos_sin_factura")
      .select("id,estado,fecha_vencimiento,fecha_estimada,monto,numero_cuota,template:egresos_sin_factura!inner(nombre_referencia,responsable,cuenta_agrupadora,categ,alertas,solo_conciliacion,activo)")
      .in("estado", [...ESTADOS_SIN_PAGAR])
      .eq("template.activo", true)
      .ilike("template.cuenta_agrupadora", "impuesto%")
    if (e) { setError(e.message); return }
    setDatos(impuestosAAvisar((data ?? []) as unknown as CuotaImpuesto[], hoyArgentina()))
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  if (error) {
    return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">No se pudo revisar los vencimientos de impuestos: {error}</div>
  }
  if (!datos) return null

  const { vencidos, proximos, totalVencidos, totalProximos } = datos
  if (!vencidos.length && !proximos.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4" /> Impuestos: nada vencido sin pagar ni por vencer en los próximos días.
      </p>
    )
  }

  const rojo = vencidos.length > 0
  return (
    <Card className={rojo ? "border-2 border-red-500 bg-red-50" : "border-2 border-amber-400 bg-amber-50"}>
      <CardContent className={compacta ? "space-y-2 px-3 py-1.5" : "space-y-3 pt-4"}>
        <button className="flex w-full items-start gap-3 text-left" onClick={() => setAbierto(!abierto)}>
          {!compacta && (rojo ? <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" /> : <CalendarClock className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />)}
          <div className="flex-1">
            <p className={`${compacta ? "text-sm" : "text-lg"} font-bold ${rojo ? "text-red-800" : "text-amber-800"}`}>
              {vencidos.length > 0 && <>🛑 {vencidos.length} {vencidos.length === 1 ? "impuesto vencido" : "impuestos vencidos"} sin pagar · ${plata(totalVencidos)}</>}
              {vencidos.length > 0 && proximos.length > 0 && <span className="mx-2 text-gray-400">|</span>}
              {proximos.length > 0 && <span className="text-amber-800">⏰ {proximos.length} por vencer · ${plata(totalProximos)}</span>}
            </p>
            {!compacta && <p className="text-sm text-gray-600">
              Sale de las cuotas de los templates de impuestos que siguen en «pendiente» o «pagar». Si ya lo pagaste, marcá la cuota
              como pagada en <b>Egresos → Egresos sin Factura</b> y deja de aparecer acá.
            </p>}
          </div>
          {abierto ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronRight className="h-5 w-5 text-gray-500" />}
        </button>

        {abierto && (
          <div className="space-y-3">
            {vencidos.length > 0 && <Lista titulo="Vencidos sin pagar" items={vencidos} vencido />}
            {proximos.length > 0 && <Lista titulo="Por vencer (cada impuesto avisa con la anticipación de su template)" items={proximos} />}
            <TestsDelProceso proceso="principal/impuestos" pantalla="principal" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Lista({ titulo, items, vencido = false }: { titulo: string; items: ImpuestoAvisado[]; vencido?: boolean }) {
  const [todos, setTodos] = useState(false)
  const visibles = todos ? items : items.slice(0, MOSTRAR)
  return (
    <div>
      <p className={`mb-1 text-sm font-semibold ${vencido ? "text-red-800" : "text-amber-800"}`}>{titulo}</p>
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr><th className="px-2 py-1">Impuesto</th><th className="px-2 py-1">Empresa</th><th className="px-2 py-1">Cuota</th><th className="px-2 py-1">Vence</th><th className="px-2 py-1"></th><th className="px-2 py-1 text-right">Monto</th><th className="px-2 py-1">Estado</th><th className="px-2 py-1"></th></tr>
          </thead>
          <tbody>
            {visibles.map(x => (
              <tr key={x.id} className="border-t">
                <td className="px-2 py-1">{x.impuesto}</td>
                <td className="px-2 py-1">{x.empresa}</td>
                <td className="px-2 py-1">{x.numero_cuota ?? ""}</td>
                <td className="px-2 py-1">{fecha(x.vencimiento)}</td>
                <td className={`px-2 py-1 ${vencido ? "font-semibold text-red-700" : "text-amber-700"}`}>
                  {x.dias < 0 ? `hace ${-x.dias} ${-x.dias === 1 ? "día" : "días"}` : x.dias === 0 ? "vence hoy" : `en ${x.dias} ${x.dias === 1 ? "día" : "días"}`}
                </td>
                <td className="px-2 py-1 text-right">{plata(x.monto)}</td>
                <td className="px-2 py-1 text-gray-600">{x.estado === "pagar" ? "marcada para pagar" : "pendiente"}</td>
                <td className="px-2 py-1">
                  {/* 🚩 A-FEAT-1449: la tarea queda atada a ESTA cuota y se cierra sola cuando se concilia (script 152) */}
                  <PasarTarea ancla={{ schema: "public", tabla: "cuotas_egresos_sin_factura", registroId: x.id, descripcion: `${x.impuesto} · ${x.empresa} · cuota ${x.numero_cuota ?? ""} · vence ${fecha(x.vencimiento)}` }}
                    inicial={{ motivo: `Pagar ${x.impuesto} cuota ${x.numero_cuota ?? ""} (${x.empresa}) — ${plata(x.monto)}`, origen: "cuota", hasta: x.vencimiento,
                      senales: [{ nombre: "impuestos", peso: 1 }, ...senalMonto(x.monto)],
                      cuota: { id: x.id, texto: `${x.impuesto} cuota ${x.numero_cuota ?? ""}` }, avisoTipo: "vencimiento_impuesto" }} />
                  <a href={linkPagar({ cuotaId: x.id, buscar: x.impuesto })} className="ml-1 rounded px-1.5 py-0.5 text-xs text-green-700 hover:bg-green-50" title="Abrir el Cash Flow con esta cuota seleccionada, para sacar el pago">💸 Pagar</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length > MOSTRAR && (
        <Button variant="link" size="sm" className="px-0" onClick={() => setTodos(!todos)}>
          {todos ? "ver menos" : `ver los ${items.length}`}
        </Button>
      )}
    </div>
  )
}
