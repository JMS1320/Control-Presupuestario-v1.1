"use client"

import { useState, useEffect, useCallback } from "react"
import { TrendingUp, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"

/**
 * ALERTAS DE VENTAS — facturas a cobrar y retenciones sin vincular (A-FEAT-88).
 *
 * Extraído de `vista-principal` tal cual, por el mismo motivo que su hermano de pagos: mover y
 * arreglar a la vez vuelve imposible atribuir un cambio de número.
 *
 * Están **separadas de las de compras a propósito** (decisión previa que se conserva): son
 * circuitos distintos y mezclarlas escondía las de cobro detrás de las de pago.
 */
export function WidgetAlertasVentas() {
  const [ventasPendientes, setVentasPendientes] = useState<any[]>([])
  const [retencionesSinVincular, setRetencionesSinVincular] = useState<any[]>([])
  const [cargandoVentas, setCargandoVentas] = useState(false)
  const [detalle, setDetalle] = useState(false)

  const cargarAlertasVentas = useCallback(async () => {
    setCargandoVentas(true)
    try {
      const [{ data: facturas }, { data: rets }] = await Promise.all([
        supabase.schema('msa').from('comprobantes_venta')
          .select('id, nro_comprobante, denominacion_cliente, imp_total, estado, fecha_cobro_estimada')
          .neq('estado', 'conciliado').neq('estado', 'anterior')
          .order('fecha_cobro_estimada', { ascending: true, nullsFirst: false }),
        supabase.schema('msa').from('retenciones_recibidas')
          .select('id, tipo, monto, denominacion_cliente, cuit_cliente')
          .is('comprobante_venta_id', null)
          .order('created_at', { ascending: false }),
      ])
      setVentasPendientes(facturas || [])
      setRetencionesSinVincular(rets || [])
    } catch (err) {
      console.error('Error cargando alertas de ventas:', err)
    } finally {
      setCargandoVentas(false)
    }
  }, [])

  useEffect(() => {
    cargarAlertasVentas()
  }, [cargarAlertasVentas])

  const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
  const fmtFecha = (f: string) => {
    const d = new Date(f + 'T12:00:00')
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
  }


  const hayAlgo = ventasPendientes.length > 0 || retencionesSinVincular.length > 0

  return (
    <>
      {/* RESUMEN — los dos números que importan. El detalle, en el diálogo (§ 🧮). */}
      <Card className="h-full">
        <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Alertas de ventas</p>
              {cargandoVentas ? (
                <p className="text-xs text-muted-foreground">Cargando…</p>
              ) : !hayAlgo ? (
                <p className="text-xs text-muted-foreground">Sin alertas pendientes.</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {ventasPendientes.length > 0 && (
                    <span className="font-semibold text-emerald-700">
                      {ventasPendientes.length} a cobrar
                    </span>
                  )}
                  {ventasPendientes.length > 0 && retencionesSinVincular.length > 0 && " · "}
                  {retencionesSinVincular.length > 0 && (
                    <span className="font-semibold text-orange-700">
                      {retencionesSinVincular.length} ret. sin vincular
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {hayAlgo && (
            <Button size="sm" variant="secondary" className="self-start" onClick={() => setDetalle(true)}>
              Ver el detalle
            </Button>
          )}
        </CardContent>
      </Card>

      {/* DETALLE — el bloque tal como estaba. */}
      <Dialog open={detalle} onOpenChange={setDetalle}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Alertas de ventas</DialogTitle>
          </DialogHeader>
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Alertas de Ventas
            {ventasPendientes.length > 0 && (
              <span className="ml-2 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {ventasPendientes.length} a cobrar
              </span>
            )}
            {retencionesSinVincular.length > 0 && (
              <span className="ml-1 bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {retencionesSinVincular.length} ret. sin vincular
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cargandoVentas ? (
            <div className="flex items-center gap-2 py-6 justify-center text-gray-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
              <span className="text-sm">Cargando alertas...</span>
            </div>
          ) : ventasPendientes.length === 0 && retencionesSinVincular.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-300" />
              <p className="text-sm">Sin ventas pendientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Retenciones cargadas sin factura (esperando vincular por CUIT) */}
              {retencionesSinVincular.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
                  <div className="text-xs font-medium text-orange-800 mb-1">
                    Retenciones sin factura (se vinculan al importar la venta con ese CUIT):
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {retencionesSinVincular.map(r => (
                      <span key={r.id} className="text-xs bg-white border border-orange-200 rounded px-2 py-0.5">
                        {r.tipo?.toUpperCase()} {fmt(r.monto)} · {r.denominacion_cliente || r.cuit_cliente || 's/cliente'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Facturas de venta a cobrar / cobrado (pendientes de conciliar) */}
              {ventasPendientes.map(f => (
                <div key={f.id} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{f.denominacion_cliente || 's/cliente'}</span>
                      <span className="text-xs text-gray-500">{f.nro_comprobante || ''}</span>
                      <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">{fmt(f.imp_total || 0)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${f.estado === 'cobrado' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{f.estado}</span>
                    </div>
                    {f.fecha_cobro_estimada && (
                      <div className="mt-0.5 text-xs text-gray-400">Cobro estimado: {fmtFecha(f.fecha_cobro_estimada)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  )
}
