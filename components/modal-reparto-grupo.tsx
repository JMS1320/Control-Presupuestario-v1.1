"use client"

/**
 * 💸 **A-BUG-1431 — REPARTIR el nuevo «a pagar» de un grupo entre sus miembros.**
 *
 * Se abre cuando en el Cash Flow se edita el monto de una fila agrupada (cuotas de template, facturas o
 * pagos de sueldo). Antes el total se copiaba a cada miembro. Ahora la app **propone** el reparto
 * (proporcional a lo que tiene cada uno hoy) y el usuario lo corrige antes de guardar.
 *
 * El control es de integridad: si los renglones no suman el total, **no se guarda** (§ 🚦 frena sólo la
 * contradicción interna). Se escribe miembro por miembro, por id, con `count` para no dar por guardado
 * algo que no encontró.
 */
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { schemaDeFila } from "@/lib/empresas"
import { esMonedaExtranjera } from "@/lib/pagos/moneda-factura"
import { proponerReparto, controlReparto } from "@/lib/pagos/repartir-grupo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { TestsDelProceso } from "@/components/tests-del-proceso"

export interface FilaGrupoReparto {
  id: string
  origen: string
  origen_tabla?: string
  ids_grupo?: string[]
  detalle?: string
}

interface Miembro { id: string; etiqueta: string; actual: number }

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const parsear = (t: string) => parseFloat(String(t).replace(/\./g, "").replace(",", ".")) || 0

export function ModalRepartoGrupo({ fila, nuevoTotal, onCancelar, onGuardado }: {
  fila: FilaGrupoReparto
  nuevoTotal: number
  onCancelar: () => void
  onGuardado: () => void | Promise<void>
}) {
  const [miembros, setMiembros] = useState<Miembro[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const ids = fila.ids_grupo ?? []

  // Lee lo que tiene hoy cada miembro, de su tabla.
  useEffect(() => {
    let vivo = true
    const cargar = async () => {
      try {
        let lista: Miembro[] = []
        if (fila.origen === "TEMPLATE") {
          const { data, error } = await supabase.from("cuotas_egresos_sin_factura")
            .select("id, monto, numero_cuota, egreso:egresos_sin_factura(nombre_referencia)").in("id", ids)
          if (error) throw error
          lista = (data || []).map((c: any) => ({ id: c.id, actual: Number(c.monto) || 0,
            etiqueta: `${c.egreso?.nombre_referencia ?? "Cuota"}${c.numero_cuota ? ` · cuota ${c.numero_cuota}` : ""}` }))
        } else if (fila.origen === "ARCA") {
          const { data, error } = await supabase.schema(schemaDeFila(fila) as any).from("comprobantes_arca")
            .select("id, monto_a_abonar, imp_total, moneda, denominacion_emisor, numero_desde").in("id", ids)
          if (error) throw error
          if ((data || []).some((f: any) => esMonedaExtranjera(f.moneda))) {
            throw new Error("El grupo tiene facturas en dólares: cambiá el monto de cada una por separado (desagrupando o desde Egresos).")
          }
          lista = (data || []).map((f: any) => ({ id: f.id, actual: Number(f.monto_a_abonar ?? f.imp_total) || 0,
            etiqueta: `${f.denominacion_emisor ?? ""} ${f.numero_desde ?? ""}`.trim() }))
        } else if (fila.origen === "SUELDO") {
          const { data, error } = await supabase.from("sueldos_pagos").select("id, monto, descripcion").in("id", ids)
          if (error) throw error
          lista = (data || []).map((p: any) => ({ id: p.id, actual: Number(p.monto) || 0, etiqueta: p.descripcion || "Pago" }))
        } else {
          throw new Error("Este tipo de grupo no se reparte desde acá.")
        }
        if (lista.length !== ids.length) throw new Error(`Se encontraron ${lista.length} de ${ids.length} miembros del grupo: no se reparte a ciegas.`)
        if (!vivo) return
        const prop = proponerReparto(lista, nuevoTotal)
        setMiembros(lista)
        setValores(Object.fromEntries(lista.map(m => [m.id, fmt(prop[m.id])])))
      } catch (e) {
        if (vivo) setError((e as Error).message)
      }
    }
    cargar()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reparto = useMemo(() => Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, parsear(v)])), [valores])
  const control = controlReparto(reparto, nuevoTotal)

  const repartirIgual = () => {
    if (!miembros) return
    const prop = proponerReparto(miembros.map(m => ({ id: m.id, actual: 1 })), nuevoTotal)
    setValores(Object.fromEntries(miembros.map(m => [m.id, fmt(prop[m.id])])))
  }
  const repartirProporcional = () => {
    if (!miembros) return
    const prop = proponerReparto(miembros, nuevoTotal)
    setValores(Object.fromEntries(miembros.map(m => [m.id, fmt(prop[m.id])])))
  }

  const guardar = async () => {
    if (!miembros || !control.cierra) return
    setGuardando(true)
    try {
      for (const m of miembros) {
        const monto = reparto[m.id]
        let q
        if (fila.origen === "TEMPLATE") q = supabase.from("cuotas_egresos_sin_factura").update({ monto }, { count: "exact" }).eq("id", m.id)
        else if (fila.origen === "ARCA") q = supabase.schema(schemaDeFila(fila) as any).from("comprobantes_arca").update({ monto_a_abonar: monto }, { count: "exact" }).eq("id", m.id)
        else q = supabase.from("sueldos_pagos").update({ monto }, { count: "exact" }).eq("id", m.id)
        const { error, count } = await q
        if (error) throw error
        if (count === 0) throw new Error(`no se encontró «${m.etiqueta}»`)
      }
      toast.success(`Repartido en ${miembros.length}: el grupo queda en $ ${fmt(nuevoTotal)}`)
      await onGuardado()
    } catch (e) {
      toast.error("No se pudo guardar el reparto: " + (e as Error).message + ". Revisá el grupo: puede haber quedado a medias.", { duration: 20000 })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v && !guardando) onCancelar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>¿Cómo repartimos $ {fmt(nuevoTotal)} en el grupo?</DialogTitle>
          <DialogDescription>
            El monto que escribiste es el total del grupo. Te propongo repartirlo según lo que tiene hoy cada uno; corregí lo que quieras.
          </DialogDescription>
        </DialogHeader>

        <TestsDelProceso proceso="cashflow/reparto-grupo" pantalla="cashflow" />
        {error && <div className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-900">{error}</div>}
        {!error && !miembros && <div className="text-sm text-gray-500 py-4">Leyendo el grupo…</div>}

        {miembros && (
          <div className="space-y-2">
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={repartirProporcional} className="px-2 py-0.5 border rounded hover:bg-blue-50">Proporcional a lo de hoy</button>
              <button type="button" onClick={repartirIgual} className="px-2 py-0.5 border rounded hover:bg-blue-50">En partes iguales</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-500"><th className="text-left">Miembro</th><th className="text-right">Hoy</th><th className="text-right w-[160px]">Queda</th></tr></thead>
              <tbody>
                {miembros.map(m => (
                  <tr key={m.id} className="border-t">
                    <td className="py-1 pr-2 truncate max-w-[200px]" title={m.etiqueta}>{m.etiqueta}</td>
                    <td className="py-1 text-right text-gray-500">{fmt(m.actual)}</td>
                    <td className="py-1 pl-2">
                      <Input type="text" placeholder="0,00" className="h-8 text-right" value={valores[m.id] ?? ""}
                        onChange={e => setValores(prev => ({ ...prev, [m.id]: e.target.value }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {control.cierra
              ? <div className="text-xs text-green-700">✓ Suman $ {fmt(control.suma)}, el total del grupo.</div>
              : <div className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded p-2">
                  Suman $ {fmt(control.suma)}: faltan $ {fmt(control.diferencia)} para el total de $ {fmt(nuevoTotal)}. Ajustá un renglón para guardar.
                </div>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancelar} disabled={guardando}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || !miembros || !control.cierra}>{guardando ? "Guardando…" : "Guardar reparto"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
