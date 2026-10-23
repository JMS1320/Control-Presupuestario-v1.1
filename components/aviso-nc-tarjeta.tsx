"use client"

/**
 * 💳 **El aviso en la TARJETA: notas de crédito pagadas con tarjeta sin aplicar** (A-FEAT-1292, 2026-10-19).
 *
 * Pedido del usuario al ver que Medicus no concilia: el consumo es **factura − nota de crédito**, y el
 * motor busca un solo comprobante. Aplicando la NC, la factura baja al neto y el motor la encuentra sola.
 *
 * 🛑 **La cuenta NO se hace acá**: el plan es `planCancelacionNC` (escenario A), el mismo que usan Pagos
 * y el Cash Flow. Esto sólo **empareja** cada NC con su factura (`paresCreditoNC`) y deja elegir cuáles.
 * Avisa y no frena (§ 🚦): aplicar o no es decisión del usuario.
 */

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { schemaDeEmpresa, type Empresa } from "@/lib/empresas"
import { buscarParesCreditoNC, aplicarParCreditoNC, type ParCreditoNC } from "@/lib/pagos/cancelacion-nc"

const pesos = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dia = (f?: string | null) => f ? String(f).slice(0, 10).split('-').reverse().join('/') : '—'

export function AvisoNcTarjeta({ empresa, onAplicado }: { empresa: Empresa; onAplicado?: () => void }) {
  const [pares, setPares] = useState<ParCreditoNC[]>([])
  const [abierto, setAbierto] = useState(false)
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [aplicando, setAplicando] = useState(false)
  const schema = schemaDeEmpresa(empresa)

  const cargar = async () => {
    try { setPares(await buscarParesCreditoNC(supabase, schema)) }
    catch (e) { toast.error('No se pudieron leer las notas de crédito: ' + (e as Error).message) }
  }
  useEffect(() => { void cargar() }, [schema]) // eslint-disable-line react-hooks/exhaustive-deps

  if (pares.length === 0) return null

  const aplicar = async () => {
    const lista = pares.filter(p => elegidos.has(p.nc.id))
    if (!lista.length) return
    const ok = window.confirm(`Se aplican ${lista.length} nota(s) de crédito contra su factura.\n\n`
      + `Cada factura baja al neto y sigue «pagada con tarjeta»; la nota de crédito queda conciliada.\n\n¿Continuar?`)
    if (!ok) return
    setAplicando(true)
    let hechos = 0
    try {
      for (const p of lista) { await aplicarParCreditoNC(supabase, schema, p); hechos++ }
      toast.success(`${hechos} nota(s) de crédito aplicada(s)`)
      setAbierto(false)
      await cargar()
      onAplicado?.()
    } catch (e) {
      toast.error(`Se aplicaron ${hechos} de ${lista.length}. Error: ${(e as Error).message}`)
      await cargar()
    } finally { setAplicando(false) }
  }

  return (
    <>
      <div className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm flex items-center justify-between gap-3">
        <span>
          🧾 <b>{pares.length} nota(s) de crédito pagada(s) con tarjeta sin aplicar</b> — el consumo de la tarjeta es
          factura menos nota de crédito, y el motor no las encuentra hasta aplicarlas.
        </span>
        <Button size="sm" variant="outline" onClick={() => { setElegidos(new Set(pares.map(p => p.nc.id))); setAbierto(true) }}>
          Ver y aplicar
        </Button>
      </div>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Notas de crédito pagadas con tarjeta</DialogTitle>
            <DialogDescription>
              Cada nota de crédito va con la factura del mismo proveedor emitida más cerca (hasta 3 días). El neto es lo
              que tiene que aparecer en el resumen de la tarjeta.
            </DialogDescription>
          </DialogHeader>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500">
              <th></th><th>Proveedor</th><th>Factura</th><th>Nota de crédito</th><th className="text-right">Neto</th>
            </tr></thead>
            <tbody>
              {pares.map(p => (
                <tr key={p.nc.id} className="border-t">
                  <td><input type="checkbox" checked={elegidos.has(p.nc.id)} onChange={() => setElegidos(s => {
                    const n = new Set(s); if (n.has(p.nc.id)) n.delete(p.nc.id); else n.add(p.nc.id); return n
                  })} /></td>
                  <td className="max-w-[180px] truncate" title={p.fc.denominacion_emisor ?? ''}>{p.fc.denominacion_emisor}</td>
                  <td>FC {p.fc.numero_desde} · {dia(p.fc.fecha_emision)} · ${pesos(p.fc.imp_total)}</td>
                  <td>NC {p.nc.numero_desde} · {dia(p.nc.fecha_emision)} · −${pesos(Math.abs(p.nc.imp_total))}</td>
                  <td className="text-right font-medium">${pesos(p.neto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button disabled={aplicando || elegidos.size === 0} onClick={() => void aplicar()}>
              {aplicando ? 'Aplicando…' : `Aplicar ${elegidos.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
