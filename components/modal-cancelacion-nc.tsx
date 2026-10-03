"use client"

/**
 * 🔄 **El modal de CANCELACIÓN DE NOTAS DE CRÉDITO — mudado de la Vista de Pagos.** A-FEAT-1232.
 *
 * Es el modal de siempre (FC↔NC y NC↔descuentos), **copiado tal cual** de `vista-facturas-arca.tsx`
 * para que lo usen las dos pantallas: Pagos, mientras exista, y el **Cash Flow**, que ahora lo abre en
 * el lugar en vez de navegar hasta Pagos. La lógica de aplicar vive en `lib/pagos/cancelacion-nc.ts`.
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { aplicarCancelacionNC, type ComprobanteNC, type DatosCancelacionNC } from "@/lib/pagos/cancelacion-nc"

export function ModalCancelacionNC({ inicial, schemaName, onCerrar, onAplicado }: {
  inicial: DatosCancelacionNC
  schemaName: string
  onCerrar: () => void
  /** Después de aplicar: el que lo abrió recarga lo suyo. */
  onAplicado: (idsAfectados: string[]) => void
}) {
  const [datos, setDatosInterno] = useState<DatosCancelacionNC>(inicial)
  // Mismo contrato que tenía en Pagos (`prev => prev ? {...} : null`), sin el null.
  const setDatos = (f: (prev: DatosCancelacionNC | null) => DatosCancelacionNC | null) =>
    setDatosInterno(prev => f(prev) ?? prev)
  // Grupos de pago expandidos (escenario B agrupado por grupo_pago_id)
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(new Set())
  const [aplicando, setAplicando] = useState(false)

  const aplicar = async () => {
    if (datos.seleccionadas.size === 0) {
      alert('Selecciona al menos un comprobante')
      return
    }
    setAplicando(true)
    try {
      const r = await aplicarCancelacionNC(supabase, schemaName, datos)
      toast.success(r.mensaje, { duration: 5000 })
      onAplicado(r.idsAfectados)
    } catch (error) {
      console.error('Error procesando cancelación NC:', error)
      alert('Error al procesar la cancelación')
    } finally { setAplicando(false) }
  }

  return (
    <Dialog open={true} onOpenChange={() => onCerrar()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {datos.tipo === 'fc_con_nc'
              ? '🔄 Cancelar FC con Notas de Crédito'
              : '🔄 Aplicar NC contra descuentos'}
          </DialogTitle>
          <DialogDescription>
            {datos.tipo === 'fc_con_nc'
              ? 'Seleccione las NC que desea aplicar para cancelar las facturas'
              : 'Seleccione las FC con descuento contra las cuales aplicar las NC'}
          </DialogDescription>
        </DialogHeader>

        {/* Facturas seleccionadas por el usuario */}
        <div className="space-y-3">
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">
              {datos.tipo === 'fc_con_nc' ? '📄 Facturas a cancelar:' : '📄 Notas de Crédito a aplicar:'}
            </h4>
            {datos.facturas.map(f => (
              <div key={f.id} className="flex justify-between text-sm py-1">
                <span>{[3, 8, 13, 53, 203, 208, 213].includes(f.tipo_comprobante) ? 'NC' : 'FC'} {f.numero_desde} — {f.denominacion_emisor}</span>
                <span className="font-medium">${Math.abs(f.imp_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            <div className="border-t mt-2 pt-2 flex justify-between font-bold text-sm">
              <span>Total:</span>
              <span>${datos.facturas.reduce((s, f) => s + Math.abs(f.imp_total), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Comprobantes disponibles para matchear */}
          <div className="bg-amber-50 p-3 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold text-sm">
                {datos.tipo === 'fc_con_nc' ? '📋 NC disponibles:' : '📋 FC con descuento aplicado:'}
              </h4>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-6"
                onClick={() => {
                  const allIds = datos.disponibles.map(d => d.id)
                  const todosSeleccionados = allIds.every(id => datos.seleccionadas.has(id))
                  setDatos(prev => prev ? {
                    ...prev,
                    seleccionadas: todosSeleccionados ? new Set() : new Set(allIds)
                  } : null)
                }}
              >
                {datos.disponibles.every(d => datos.seleccionadas.has(d.id)) ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </Button>
            </div>
            {datos.tipo === 'nc_con_descuento' ? (
              /* Escenario B: agrupado por grupo_pago_id */
              (() => {
                const grupos = new Map<string, ComprobanteNC[]>()
                for (const d of datos.disponibles) {
                  const k = d.grupo_pago_id || '__sueltas__'
                  if (!grupos.has(k)) grupos.set(k, [])
                  grupos.get(k)!.push(d)
                }
                return Array.from(grupos.entries()).map(([gid, fcs]) => {
                  const esSuelta = gid === '__sueltas__'
                  const subtotal = fcs.reduce((s, f) => s + (f.descuento_aplicado || 0), 0)
                  const sel = datos.seleccionadas
                  const allSel = fcs.every(f => sel.has(f.id))
                  const someSel = fcs.some(f => sel.has(f.id))
                  const expandido = gruposExpandidos.has(gid)
                  const fechaGrupo = fcs[0].fecha_estimada
                    ? String(fcs[0].fecha_estimada).split('-').reverse().join('/')
                    : ''
                  return (
                    <div key={gid} className="mb-2 border border-amber-200 rounded overflow-hidden">
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-100">
                        <input
                          type="checkbox"
                          checked={allSel}
                          ref={el => { if (el) el.indeterminate = !allSel && someSel }}
                          onChange={() => {
                            setDatos(prev => {
                              if (!prev) return null
                              const nuevo = new Set(prev.seleccionadas)
                              if (allSel) fcs.forEach(f => nuevo.delete(f.id))
                              else fcs.forEach(f => nuevo.add(f.id))
                              return { ...prev, seleccionadas: nuevo }
                            })
                          }}
                        />
                        <button
                          type="button"
                          className="flex-1 text-left text-sm font-medium flex items-center gap-1"
                          onClick={() => setGruposExpandidos(prev => {
                            const n = new Set(prev)
                            if (n.has(gid)) n.delete(gid)
                            else n.add(gid)
                            return n
                          })}
                        >
                          <span className="text-xs w-3">{expandido ? '▼' : '▶'}</span>
                          {esSuelta ? 'Sin grupo (FC sueltas)' : `Grupo pago ${fechaGrupo}`}
                          <span className="text-muted-foreground font-normal">— {fcs.length} FC</span>
                        </button>
                        <span className="text-sm font-semibold text-red-600">
                          ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {expandido && (
                        <div className="px-2 py-1 bg-white">
                          {fcs.map(f => (
                            <label key={f.id} className="flex items-center gap-2 text-sm py-0.5 pl-6 cursor-pointer hover:bg-amber-50 rounded">
                              <input
                                type="checkbox"
                                checked={sel.has(f.id)}
                                onChange={() => {
                                  setDatos(prev => {
                                    if (!prev) return null
                                    const nuevo = new Set(prev.seleccionadas)
                                    if (nuevo.has(f.id)) nuevo.delete(f.id)
                                    else nuevo.add(f.id)
                                    return { ...prev, seleccionadas: nuevo }
                                  })
                                }}
                              />
                              <span className="flex-1">FC {f.numero_desde} — {f.denominacion_emisor}</span>
                              <span className="text-red-600">${(f.descuento_aplicado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              })()
            ) : (
              /* Escenario A: lista plana de NC */
              datos.disponibles.map(d => (
                <label key={d.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer hover:bg-amber-100 px-1 rounded">
                  <input
                    type="checkbox"
                    checked={datos.seleccionadas.has(d.id)}
                    onChange={() => {
                      setDatos(prev => {
                        if (!prev) return null
                        const nuevo = new Set(prev.seleccionadas)
                        if (nuevo.has(d.id)) nuevo.delete(d.id)
                        else nuevo.add(d.id)
                        return { ...prev, seleccionadas: nuevo }
                      })
                    }}
                  />
                  <span className="flex-1">
                    NC {d.numero_desde} — {d.denominacion_emisor}
                  </span>
                  <span className="font-medium text-red-600">
                    ${Math.abs(d.imp_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </label>
              ))
            )}
            <div className="border-t mt-2 pt-2 flex justify-between font-bold text-sm">
              <span>Total seleccionado:</span>
              <span className="text-red-600">
                ${datos.disponibles
                  .filter(d => datos.seleccionadas.has(d.id))
                  .reduce((s, d) => s + (datos.tipo === 'fc_con_nc' ? Math.abs(d.imp_total) : (d.descuento_aplicado || 0)), 0)
                  .toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Resumen de la operación */}
          {(() => {
            const totalFacturas = datos.facturas.reduce((s, f) => s + Math.abs(f.imp_total), 0)
            const totalDisponible = datos.disponibles
              .filter(d => datos.seleccionadas.has(d.id))
              .reduce((s, d) => s + (datos.tipo === 'fc_con_nc' ? Math.abs(d.imp_total) : (d.descuento_aplicado || 0)), 0)
            const saldoRestante = totalFacturas - totalDisponible
            const esB = datos.tipo === 'nc_con_descuento'
            // Escenario B: cuadra solo si la diferencia es ~0 (tolerancia 1 peso por redondeo).
            // Si se selecciona descuento de más, saldoRestante es negativo → no cuadra (naranja) y se muestra el negativo.
            const cuadra = esB ? Math.abs(saldoRestante) < 1 : saldoRestante <= 0
            const saldoStr = `${saldoRestante < 0 ? '-' : ''}$${Math.abs(saldoRestante).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

            return (
              <div className={`p-3 rounded-lg text-sm ${cuadra ? 'bg-green-50' : 'bg-orange-50'}`}>
                <div className="flex justify-between">
                  <span>Total {esB ? 'NC' : 'FC'}:</span>
                  <span>${totalFacturas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total {esB ? 'descuento seleccionado' : 'NC aplicadas'}:</span>
                  <span className="text-red-600">-${totalDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t mt-1 pt-1 flex justify-between font-bold">
                  <span>{
                    esB
                      ? (cuadra ? 'Cuadra con el descuento' : 'Diferencia (la NC se concilia igual):')
                      : (saldoRestante > 0 ? 'Saldo restante (sigue pendiente):' : 'Cancelación total')
                  }</span>
                  <span className={cuadra ? 'text-green-600' : 'text-orange-600'}>
                    {cuadra ? '✓ $0,00' : saldoStr}
                  </span>
                </div>
              </div>
            )
          })()}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onCerrar()}>
            Cancelar
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={aplicando}
            onClick={() => void aplicar()}
          >
            ✓ Aplicar Cancelación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type { ComprobanteNC }
