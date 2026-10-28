"use client"

/**
 * 📱 PANEL DE CAMPO — lo primero que ve quien abre la app desde el ícono del celular (A-FEAT-1409 etapa 3).
 *
 * Link: `/?seccion=productivo&campo=1`. Tres cosas grandes para el dedo: nueva orden agrícola, nueva
 * orden ganadera, y la lista de las NO confirmadas para editar (JMS 28/10: «para editar deberá elegir
 * dentro de las no confirmadas»). Al tocar una, abre el MISMO formulario de la orden (ver
 * `lib/productivo/pedido-campo.ts`). Respeta los permisos del rol: lo que el rol no puede, no aparece.
 */
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { usePuedeVer } from "@/components/contexto-permisos"
import { pedirCampo, type PedidoCampo } from "@/lib/productivo/pedido-campo"
import { ETIQUETA_ESTADO } from "@/lib/productivo/confirmacion-ordenes"
import { Button } from "@/components/ui/button"
import { Wheat, Syringe, Pencil, Loader2 } from "lucide-react"

interface Pendiente { id: string; tipo: "agricola" | "ganadero"; fecha: string; estado: string; detalle: string }

const fechaAR = (f: string) => f.slice(0, 10).split("-").reverse().join("/")

export function PanelCampo({ onPedido }: { onPedido: (p: PedidoCampo) => void }) {
  const puedeVer = usePuedeVer()
  const verAgricola = puedeVer("productivo.ordenes.agricola")
  const verGanadero = puedeVer("productivo.ordenes.ganadero")
  const puedeNueva = puedeVer("productivo.ordenes.nueva")
  const puedeEditar = puedeVer("productivo.ordenes.editar")
  const [pendientes, setPendientes] = useState<Pendiente[] | null>(null)

  useEffect(() => {
    const prod = supabase.schema("productivo")
    const estados = ["planificada", "a_confirmar"]
    Promise.all([
      verAgricola
        ? prod.from("ordenes_agricolas").select("id, fecha, estado, lote_nombre, hectareas").in("estado", estados)
        : Promise.resolve({ data: [] as any[] }),
      verGanadero
        ? prod.from("ordenes_aplicacion").select("id, fecha, estado, observaciones, categorias_hacienda(nombre), ordenes_aplicacion_rodeos(categorias_hacienda(nombre))").in("estado", estados)
        : Promise.resolve({ data: [] as any[] }),
    ]).then(([a, g]) => {
      const lista: Pendiente[] = [
        ...((a.data ?? []) as any[]).map(o => ({
          id: o.id, tipo: "agricola" as const, fecha: o.fecha, estado: o.estado,
          detalle: `${o.lote_nombre || "sin lote"}${o.hectareas ? ` · ${Number(o.hectareas).toLocaleString("es-AR")} ha` : ""}`,
        })),
        ...((g.data ?? []) as any[]).map(o => {
          const rodeos = (o.ordenes_aplicacion_rodeos ?? []).map((r: any) => r.categorias_hacienda?.nombre).filter(Boolean)
          return {
            id: o.id, tipo: "ganadero" as const, fecha: o.fecha, estado: o.estado,
            detalle: (rodeos.length ? rodeos.join(", ") : o.categorias_hacienda?.nombre) || o.observaciones || "orden ganadera",
          }
        }),
      ]
      // las más nuevas primero
      lista.sort((x, y) => (y.fecha || "").localeCompare(x.fecha || ""))
      setPendientes(lista)
    })
  }, [verAgricola, verGanadero])

  const pedir = (p: PedidoCampo) => { pedirCampo(p); onPedido(p) }

  return (
    <div className="space-y-3 rounded-lg border bg-white p-3 shadow-sm">
      <div className="text-sm font-semibold text-gray-700">📱 Campo</div>
      {puedeNueva && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {verAgricola && (
            <Button className="h-14 text-base" onClick={() => pedir({ tipo: "agricola" })}>
              <Wheat className="mr-2 h-5 w-5" /> Nueva orden agrícola
            </Button>)}
          {verGanadero && (
            <Button className="h-14 text-base" onClick={() => pedir({ tipo: "ganadero" })}>
              <Syringe className="mr-2 h-5 w-5" /> Nueva orden ganadera
            </Button>)}
        </div>
      )}
      <div>
        <div className="mb-1 text-xs font-medium text-muted-foreground">Editar una orden no confirmada</div>
        {pendientes === null ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
        ) : pendientes.length === 0 ? (
          <div className="py-3 text-sm text-muted-foreground">No hay órdenes sin confirmar.</div>
        ) : (
          <ul className="divide-y rounded border">
            {pendientes.map(o => {
              // «a confirmar» ya la marcó alguien: sólo la confirma o la rechaza el dueño, nadie la edita
              const editable = puedeEditar && o.estado === "planificada"
              return (
                <li key={`${o.tipo}-${o.id}`}>
                  <button type="button" disabled={!editable}
                    onClick={() => pedir({ tipo: o.tipo, ordenId: o.id })}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left disabled:opacity-60 enabled:active:bg-gray-100">
                    {o.tipo === "agricola" ? <Wheat className="h-5 w-5 shrink-0 text-green-700" /> : <Syringe className="h-5 w-5 shrink-0 text-blue-700" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{fechaAR(o.fecha)} · {o.tipo === "agricola" ? "Agrícola" : "Ganadera"}</span>
                      <span className="block truncate text-xs text-muted-foreground">{o.detalle}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{ETIQUETA_ESTADO[o.estado] ?? o.estado}</span>
                    {editable && <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
