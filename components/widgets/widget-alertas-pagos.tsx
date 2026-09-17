"use client"

import { useState, useEffect, useCallback } from "react"
import { AlertCircle, CheckCircle2, Link2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ModalVinculacionAnticipo } from "@/components/modal-vinculacion-anticipo"
import {
  useVinculacionAnticipo,
  buscarFacturasCandidatas,
  type AnticipoVinculable,
  type FacturaCandidato,
} from "@/hooks/useVinculacionAnticipo"

// AnticipoSicore == AnticipoVinculable (mismos campos) — alias para la lista de alertas
type AnticipoSicore = AnticipoVinculable

/**
 * ALERTAS DE PAGOS — anticipos de SICORE sin vincular a su factura (A-FEAT-88).
 *
 * Extraído de `vista-principal` **sin tocarle la lógica**: la consulta, el armado de candidatas y
 * el wizard son los mismos. El objetivo del movimiento era que el bloque se pudiera elegir, no
 * mejorarlo — mezclar las dos cosas habría hecho imposible saber, si algo cambia de número, si
 * fue el refactor o un arreglo.
 *
 * Se lleva su modal adentro: el widget tiene que funcionar esté donde esté, sin que la pantalla
 * que lo contiene sepa que existe un wizard.
 */
export function WidgetAlertasPagos() {
  const [anticiposSinVincular, setAnticiposSinVincular] = useState<AnticipoSicore[]>([])
  const [facturasCandidatos, setFacturasCandidatos] = useState<Record<string, FacturaCandidato[]>>({})
  const [cargandoAlertas, setCargandoAlertas] = useState(false)

  // Wizard de vinculación — lógica compartida en useVinculacionAnticipo
  const v = useVinculacionAnticipo(() => cargarAlertasSicore())

  const cargarAlertasSicore = useCallback(async () => {
    setCargandoAlertas(true)
    try {
      const { data: anticipos } = await supabase
        .from('anticipos_proveedores')
        // `tipo` va en el SELECT y NO se filtra: los anticipos de COBRO también hay que
        // reclamarlos. Con `.eq('tipo','pago')` quedaban invisibles acá y sin botón en Cash Flow,
        // o sea sin ninguna puerta de entrada (el de BALLESTER llevaba 4 meses colgado).
        .select('id, nombre_proveedor, cuit_proveedor, monto, monto_sicore, descuento_aplicado, sicore, tipo_sicore, fecha_pago, factura_id, comprobante_venta_id, descripcion, estado, tipo')
        // Sin vincular = sin NINGUNA de las dos columnas de vínculo. Los pagos usan `factura_id`
        // (FK a compras) y los cobros `comprobante_venta_id` (FK a ventas). Mirando sólo la
        // primera, un cobro imputado parcialmente seguía reclamándose acá para siempre.
        .is('factura_id', null)
        .is('comprobante_venta_id', null)
        .neq('estado', 'vinculado')
        .neq('estado', 'externo')
        .order('fecha_pago', { ascending: false })

      if (!anticipos || anticipos.length === 0) {
        setAnticiposSinVincular([])
        setFacturasCandidatos({})
        return
      }

      setAnticiposSinVincular(anticipos)

      // Para cada CUIT único, buscar facturas pendientes.
      // La clave incluye el TIPO: un mismo CUIT puede ser proveedor y cliente a la vez, y las
      // candidatas de un anticipo de cobro son facturas de venta, no de compra.
      const claveCand = (a: any) => `${a.cuit_proveedor}|${a.tipo === 'cobro' ? 'cobro' : 'pago'}`
      const clavesUnicas = [...new Set(anticipos.map(claveCand))]
      const candidatosPorAnticipo: Record<string, FacturaCandidato[]> = {}

      await Promise.all(
        clavesUnicas.map(async (clave) => {
          const [cuit, tipo] = (clave as string).split('|')
          const facturas = await buscarFacturasCandidatas(cuit, tipo as 'pago' | 'cobro')
          anticipos
            .filter((a: any) => claveCand(a) === clave)
            .forEach((a: any) => { candidatosPorAnticipo[a.id] = facturas })
        })
      )

      setFacturasCandidatos(candidatosPorAnticipo)
    } catch (err) {
      console.error('Error cargando alertas SICORE:', err)
    } finally {
      setCargandoAlertas(false)
    }
  }, [])

  useEffect(() => {
    cargarAlertasSicore()
  }, [cargarAlertasSicore])

  const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
  const fmtFecha = (f: string) => {
    const d = new Date(f + 'T12:00:00')
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
  }


  const eliminarAnticipo = async (anticipo: AnticipoSicore) => {
    if (!window.confirm(`¿Eliminar anticipo de ${anticipo.nombre_proveedor} por ${fmt(anticipo.monto)}?\n\nEsta acción no se puede deshacer.`)) return
    try {
      const { error } = await supabase
        .from('anticipos_proveedores')
        .delete()
        .eq('id', anticipo.id)
      if (error) throw error
      toast.success('Anticipo eliminado')
      await cargarAlertasSicore()
    } catch (err) {
      toast.error('Error al eliminar: ' + (err as Error).message)
    }
  }

  return (
    <>
      {/* Alertas SICORE — anticipos sin vincular */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            Alertas de Pagos
            {(() => {
              const conFC = anticiposSinVincular.filter(a => (facturasCandidatos[a.id] || []).length > 0).length
              return conFC > 0 ? (
                <span className="ml-2 bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {conFC}
                </span>
              ) : anticiposSinVincular.length > 0 ? (
                <span className="ml-2 bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {anticiposSinVincular.length}
                </span>
              ) : null
            })()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cargandoAlertas ? (
            <div className="flex items-center gap-2 py-6 justify-center text-gray-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-sm">Cargando alertas...</span>
            </div>
          ) : anticiposSinVincular.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-300" />
              <p className="text-sm">Sin alertas pendientes</p>
            </div>
          ) : (() => {
            const conFC = anticiposSinVincular.filter(a => (facturasCandidatos[a.id] || []).length > 0)
            const sinFC = anticiposSinVincular.filter(a => (facturasCandidatos[a.id] || []).length === 0)
            return (
              <div className="space-y-3">
                {/* Anticipos CON facturas candidatas — alerta activa */}
                {conFC.map(anticipo => {
                  const candidatos = facturasCandidatos[anticipo.id] || []
                  return (
                    <div key={anticipo.id}
                      className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{anticipo.nombre_proveedor}</span>
                          <span className="text-xs text-gray-500">{anticipo.cuit_proveedor}</span>
                          {/* En un anticipo de COBRO la plata entró, no salió. */}
                          <span className={`text-xs px-2 py-0.5 rounded ${anticipo.tipo === 'cobro' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                            {fmt(anticipo.monto)} {anticipo.tipo === 'cobro' ? 'cobrado' : 'pagado'}
                          </span>
                          {/* El SICORE es la retención que practicamos al pagar: no aplica al cobrar. */}
                          {anticipo.tipo !== 'cobro' && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            Ret. {anticipo.sicore} — {fmt(anticipo.monto_sicore || 0)}
                          </span>
                          )}
                          {anticipo.descuento_aplicado ? (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              Desc. {fmt(anticipo.descuento_aplicado)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {anticipo.tipo === 'cobro' ? 'Cobrado' : 'Pagado'}: {fmtFecha(anticipo.fecha_pago)}
                          <span className="ml-2 text-blue-600">
                            <Link2 className="h-3 w-3 inline mr-0.5" />
                            {candidatos.length} factura{candidatos.length > 1 ? 's' : ''} pendiente{candidatos.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => v.abrirVinculacion(anticipo, candidatos)}>
                          <Link2 className="h-3 w-3 mr-1" />Vincular
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2" onClick={() => eliminarAnticipo(anticipo)} title="Eliminar anticipo">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}

                {/* Anticipos SIN facturas candidatas — esperando FC */}
                {sinFC.length > 0 && (
                  <div className="space-y-2">
                    {conFC.length > 0 && <div className="text-xs text-gray-400 pt-1">Esperando factura del proveedor:</div>}
                    {sinFC.map(anticipo => (
                      <div key={anticipo.id}
                        className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-gray-600">{anticipo.nombre_proveedor}</span>
                            <span className="text-xs text-gray-400">{anticipo.cuit_proveedor}</span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {fmt(anticipo.monto)} pagado
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-gray-400">
                            Pagado: {fmtFecha(anticipo.fecha_pago)} — sin factura pendiente aún
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => v.abrirVinculacion(anticipo, facturasCandidatos[anticipo.id] || [])}>
                            <Link2 className="h-3 w-3 mr-1" />Vincular
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2" onClick={() => eliminarAnticipo(anticipo)} title="Eliminar anticipo">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Modal vinculación — wizard 2 pasos (compartido) */}
      <ModalVinculacionAnticipo controller={v} />
    </>
  )
}
