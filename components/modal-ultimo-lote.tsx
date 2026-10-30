"use client"

/**
 * 🔁 **A-FEAT-1434 — RETOMAR EL ÚLTIMO LOTE importado: cuenta y detalle de cada factura.**
 *
 * Nota de JMS 30/10: el asistente de importación se cerró con Escape y quedaron facturas sin cuenta.
 * *«Como hay registro del lote, podría volver a procesar el lote; además ahí mismo yo debo poder poner
 * detalle, y el selector de cuentas que se pueda escribir como los demás.»*
 *
 * La cuenta se guarda por el camino único (`pedirAsignacionDeCuenta` → A-DEC-1021), así llega también al
 * movimiento del banco si la factura ya está conciliada. El detalle es la nota propia de la factura.
 */
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { idsDelUltimoLote } from "@/lib/facturas/ultimo-lote"
import { pedirAsignacionDeCuenta, mensajeDePropagacion } from "@/lib/conciliacion/asignar-cuenta-cliente"
import { SelectorCuentaContable } from "@/components/ui/selector-cuenta-contable"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { TestsDelProceso } from "@/components/tests-del-proceso"

interface FacturaLote {
  id: string
  archivo_origen: string | null
  fecha_importacion: string | null
  fecha_emision: string | null
  denominacion_emisor: string | null
  cuit: string | null
  numero_desde: string | number | null
  imp_total: number | null
  cuenta_contable: string | null
  detalle: string | null
}

interface Cambio { cuenta?: { categ: string | null; nro: string | null }; detalle?: string }

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ModalUltimoLote({ empresa, onCerrar, onGuardado }: {
  empresa: "MSA" | "PAM" | "MA"
  onCerrar: () => void
  onGuardado: () => void | Promise<void>
}) {
  const schema = empresa.toLowerCase()
  const [facturas, setFacturas] = useState<FacturaLote[] | null>(null)
  const [archivo, setArchivo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cambios, setCambios] = useState<Record<string, Cambio>>({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data, error } = await supabase.schema(schema as any).from("comprobantes_arca")
        .select("id, archivo_origen, fecha_importacion, fecha_emision, denominacion_emisor, cuit, numero_desde, imp_total, cuenta_contable, detalle")
        .not("fecha_importacion", "is", null)
        .order("fecha_importacion", { ascending: false }).limit(500)
      if (!vivo) return
      if (error) { setError("No se pudo leer el último lote: " + error.message); return }
      const lote = idsDelUltimoLote((data || []) as FacturaLote[])
      setArchivo(lote.archivo)
      setFacturas(lote.filas.sort((a, b) => (a.cuenta_contable ? 1 : 0) - (b.cuenta_contable ? 1 : 0)))
    })()
    return () => { vivo = false }
  }, [schema])

  const sinCuenta = (facturas || []).filter(f => !(cambios[f.id]?.cuenta ? cambios[f.id].cuenta!.categ : f.cuenta_contable)).length
  const nCambios = Object.keys(cambios).length

  const guardar = async () => {
    if (!facturas || nCambios === 0) return
    setGuardando(true)
    let ok = 0
    const fallas: string[] = []
    const avisos: string[] = []
    for (const f of facturas) {
      const c = cambios[f.id]
      if (!c) continue
      try {
        if (c.cuenta) {
          const r = await pedirAsignacionDeCuenta({ empresa, ids: [f.id], nro_cuenta: c.cuenta.nro, cuenta_contable: c.cuenta.categ })
          const m = mensajeDePropagacion(r)
          if (m.tipo === "aviso") avisos.push(`${f.denominacion_emisor}: ${m.texto}`)
        }
        if (c.detalle !== undefined) {
          const { error, count } = await supabase.schema(schema as any).from("comprobantes_arca")
            .update({ detalle: c.detalle.trim() || null }, { count: "exact" }).eq("id", f.id)
          if (error) throw error
          if (count === 0) throw new Error("no se encontró la factura")
        }
        ok++
      } catch (e) {
        fallas.push(`${f.denominacion_emisor ?? f.id} (${(e as Error).message})`)
      }
    }
    setGuardando(false)
    if (ok > 0) toast.success(`Guardado en ${ok} factura(s) del lote.`)
    avisos.forEach(a => toast.warning(a, { duration: 15000 }))
    if (fallas.length > 0) { toast.error("No se guardó: " + fallas.join(" · "), { duration: 20000 }); return }
    await onGuardado()
  }

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v && !guardando) onCerrar() }}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col"
        onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>🔁 Último lote importado — {empresa}</DialogTitle>
          <DialogDescription>
            {archivo
              ? <>Archivo <b>{archivo}</b> · {facturas?.length ?? 0} factura(s){facturas ? <> · <b className={sinCuenta > 0 ? "text-amber-700" : "text-green-700"}>{sinCuenta} sin cuenta</b></> : null}. Poné la cuenta y el detalle y guardá.</>
              : "Buscando el último lote…"}
          </DialogDescription>
        </DialogHeader>

        <TestsDelProceso proceso="egresos/importar-fc" pantalla="egresos" />
        {error && <div className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-900">{error}</div>}
        {facturas && facturas.length === 0 && <div className="text-sm text-gray-500 py-4">No hay facturas importadas con registro de lote en {empresa}.</div>}

        {facturas && facturas.length > 0 && (
          <div className="border rounded-md overflow-y-auto flex-1">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b sticky top-0 z-10">
                <tr>
                  <th className="text-left p-2 font-medium text-gray-600">Fecha</th>
                  <th className="text-left p-2 font-medium text-gray-600">Proveedor</th>
                  <th className="text-right p-2 font-medium text-gray-600">Monto</th>
                  <th className="text-left p-2 font-medium text-gray-600 w-[260px]">Cuenta contable</th>
                  <th className="text-left p-2 font-medium text-gray-600 w-[220px]">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {facturas.map(f => {
                  const c = cambios[f.id]
                  const cuenta = c?.cuenta ? c.cuenta.categ : f.cuenta_contable
                  return (
                    <tr key={f.id} className={!cuenta ? "bg-amber-50/60" : ""}>
                      <td className="p-2 text-gray-700">{f.fecha_emision ?? "—"}</td>
                      <td className="p-2 text-gray-700 max-w-[200px] truncate" title={`${f.denominacion_emisor} ${f.numero_desde ?? ""}`}>{f.denominacion_emisor} <span className="text-gray-400">{f.numero_desde ?? ""}</span></td>
                      <td className="p-2 text-right text-gray-700">{f.imp_total != null ? `$ ${fmt(Number(f.imp_total))}` : "—"}</td>
                      <td className="p-2">
                        <SelectorCuentaContable value={cuenta} autoFocus={false} mostrarSinAsignar
                          cuitProveedor={f.cuit} schemaName={schema} placeholder="Sin cuenta — clic para buscar" className="text-xs"
                          onSelect={(cta) => setCambios(prev => ({ ...prev, [f.id]: { ...prev[f.id], cuenta: { categ: cta?.categ ?? null, nro: cta?.nro_cuenta ?? null } } }))} />
                      </td>
                      <td className="p-2">
                        <input type="text" placeholder="detalle (opcional)" className="border rounded px-1 py-0.5 text-xs w-full"
                          value={c?.detalle ?? f.detalle ?? ""}
                          onChange={(e) => { const v = e.target.value; setCambios(prev => ({ ...prev, [f.id]: { ...prev[f.id], detalle: v } })) }} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>Cerrar</Button>
          <Button onClick={guardar} disabled={guardando || nCambios === 0}>{guardando ? "Guardando…" : `Guardar${nCambios ? ` (${nCambios})` : ""}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
