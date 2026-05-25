"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TrendingUp, Calendar, AlertCircle, Link2, CheckCircle2, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ConfiguradorIPC } from "./configurador-ipc"
import { ModalVinculacionAnticipo } from "./modal-vinculacion-anticipo"
import { useVinculacionAnticipo, buscarFacturasCandidatas, type AnticipoVinculable, type FacturaCandidato } from "@/hooks/useVinculacionAnticipo"
import { toast } from "sonner"

interface UltimoIPC {
  anio: number
  mes: number
  valor_ipc: number
  fuente: string
}

// AnticipoSicore == AnticipoVinculable (mismos campos) — alias para la lista de alertas
type AnticipoSicore = AnticipoVinculable

export function VistaPrincipal() {
  const [ultimoIPC, setUltimoIPC] = useState<UltimoIPC | null>(null)
  const [modalIPCAbierto, setModalIPCAbierto] = useState(false)
  const [loading, setLoading] = useState(true)

  // Alertas SICORE
  const [anticiposSinVincular, setAnticiposSinVincular] = useState<AnticipoSicore[]>([])
  const [facturasCandidatos, setFacturasCandidatos] = useState<Record<string, FacturaCandidato[]>>({})
  const [cargandoAlertas, setCargandoAlertas] = useState(false)

  // Wizard de vinculación — lógica compartida en useVinculacionAnticipo
  const v = useVinculacionAnticipo(() => cargarAlertasSicore())

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
  const fmtFecha = (f: string) => {
    const d = new Date(f + 'T12:00:00')
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
  }

  const cargarUltimoIPC = async () => {
    try {
      setLoading(true)
      const { data } = await supabase
        .from('indices_ipc').select('anio, mes, valor_ipc, fuente')
        .order('anio', { ascending: false }).order('mes', { ascending: false }).limit(1)
      if (data && data.length > 0) setUltimoIPC(data[0])
    } finally {
      setLoading(false)
    }
  }

  const cargarAlertasSicore = useCallback(async () => {
    setCargandoAlertas(true)
    try {
      const { data: anticipos } = await supabase
        .from('anticipos_proveedores')
        .select('id, nombre_proveedor, cuit_proveedor, monto, monto_sicore, descuento_aplicado, sicore, tipo_sicore, fecha_pago, factura_id, descripcion, estado')
        .is('factura_id', null)
        .neq('estado', 'vinculado')
        .eq('tipo', 'pago')
        .order('fecha_pago', { ascending: false })

      if (!anticipos || anticipos.length === 0) {
        setAnticiposSinVincular([])
        setFacturasCandidatos({})
        return
      }

      setAnticiposSinVincular(anticipos)

      // Para cada CUIT único, buscar facturas pendientes
      const cuitsUnicos = [...new Set(anticipos.map((a: any) => a.cuit_proveedor))]
      const candidatosPorAnticipo: Record<string, FacturaCandidato[]> = {}

      await Promise.all(
        cuitsUnicos.map(async (cuit) => {
          const facturas = await buscarFacturasCandidatas(cuit as string)
          anticipos
            .filter((a: any) => a.cuit_proveedor === cuit)
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
    cargarUltimoIPC()
    cargarAlertasSicore()
  }, [cargarAlertasSicore])

  // Eliminar anticipo (solo si no está conciliado en banco)
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Control Presupuestario</h1>
          <p className="text-gray-600 mt-1">Panel principal del sistema</p>
        </div>
      </div>

      {/* Barra superior con IPC */}
      <div className="flex items-center gap-4 mb-8">
        <Button onClick={() => setModalIPCAbierto(true)} className="bg-orange-600 hover:bg-orange-700 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          IPC
        </Button>

        <Card className="flex-1 max-w-md">
          <CardContent className="p-4">
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-600 border-t-transparent"></div>
                <span className="text-sm text-gray-600">Cargando último IPC...</span>
              </div>
            ) : ultimoIPC ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-orange-600" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {meses[ultimoIPC.mes - 1]} {ultimoIPC.anio}
                    </div>
                    <div className="text-xs text-gray-500">Último IPC registrado</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-orange-600">{ultimoIPC.valor_ipc.toFixed(2).replace(".", ",")}%</div>
                  <div className="text-xs text-gray-500 uppercase">{ultimoIPC.fuente}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-500">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">No hay índices IPC registrados</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                            {fmt(anticipo.monto)} pagado
                          </span>
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            Ret. {anticipo.sicore} — {fmt(anticipo.monto_sicore || 0)}
                          </span>
                          {anticipo.descuento_aplicado ? (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              Desc. {fmt(anticipo.descuento_aplicado)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          Pagado: {fmtFecha(anticipo.fecha_pago)}
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

      {/* Modal IPC */}
      <Dialog open={modalIPCAbierto} onOpenChange={setModalIPCAbierto}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestión de Índices IPC</DialogTitle>
          </DialogHeader>
          <ConfiguradorIPC />
        </DialogContent>
      </Dialog>

      {/* Modal vinculación — wizard 2 pasos (compartido) */}
      <ModalVinculacionAnticipo controller={v} />
    </div>
  )
}
