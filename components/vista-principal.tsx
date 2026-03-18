"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, Calendar, AlertCircle, Link2, CheckCircle2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ConfiguradorIPC } from "./configurador-ipc"
import { toast } from "sonner"

interface UltimoIPC {
  anio: number
  mes: number
  valor_ipc: number
  fuente: string
}

interface AnticipoSicore {
  id: string
  nombre_proveedor: string
  cuit_proveedor: string
  monto_sicore: number
  sicore: string           // quincena
  tipo_sicore: string
  fecha_pago: string
  factura_id: string | null
}

interface FacturaCandidato {
  id: string
  denominacion_emisor: string
  cuit: string
  imp_total: number
  fecha_emision: string
  sicore: string | null    // null = sin SICORE aplicado aún
}

export function VistaPrincipal() {
  const [ultimoIPC, setUltimoIPC] = useState<UltimoIPC | null>(null)
  const [modalIPCAbierto, setModalIPCAbierto] = useState(false)
  const [loading, setLoading] = useState(true)

  // Alertas SICORE
  const [anticiposSinVincular, setAnticiposSinVincular] = useState<AnticipoSicore[]>([])
  const [facturasCandidatos, setFacturasCandidatos] = useState<Record<string, FacturaCandidato[]>>({})
  const [cargandoAlertas, setCargandoAlertas] = useState(false)

  // Modal de vinculación
  const [modalVinculacion, setModalVinculacion] = useState(false)
  const [anticipoParaVincular, setAnticipoParaVincular] = useState<AnticipoSicore | null>(null)
  const [facturaElegida, setFacturaElegida] = useState<string>('')
  const [vinculando, setVinculando] = useState(false)

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

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

  // Cargar anticipos con SICORE sin vincular + sus candidatos de facturas
  const cargarAlertasSicore = useCallback(async () => {
    setCargandoAlertas(true)
    try {
      // Anticipos con SICORE y sin factura vinculada
      const { data: anticipos } = await supabase
        .from('anticipos_proveedores')
        .select('id, nombre_proveedor, cuit_proveedor, monto_sicore, sicore, tipo_sicore, fecha_pago, factura_id')
        .not('sicore', 'is', null)
        .is('factura_id', null)
        .eq('tipo', 'pago')
        .order('fecha_pago', { ascending: false })

      if (!anticipos || anticipos.length === 0) {
        setAnticiposSinVincular([])
        setFacturasCandidatos({})
        return
      }

      setAnticiposSinVincular(anticipos)

      // Para cada CUIT único, buscar facturas sin SICORE aplicado
      const cuitsUnicos = [...new Set(anticipos.map(a => a.cuit_proveedor))]
      const candidatosPorAnticipo: Record<string, FacturaCandidato[]> = {}

      await Promise.all(
        cuitsUnicos.map(async (cuit) => {
          const { data: facturas } = await supabase
            .schema('msa')
            .from('comprobantes_arca')
            .select('id, denominacion_emisor, cuit, imp_total, fecha_emision, sicore')
            .eq('cuit', cuit)
            .is('sicore', null)   // sin SICORE aplicado todavía
            .order('fecha_emision', { ascending: false })
            .limit(10)

          if (facturas) {
            // Asignar candidatos a todos los anticipos de ese CUIT
            anticipos
              .filter(a => a.cuit_proveedor === cuit)
              .forEach(a => { candidatosPorAnticipo[a.id] = facturas })
          }
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

  // Abrir modal de vinculación
  const abrirVinculacion = (anticipo: AnticipoSicore) => {
    setAnticipoParaVincular(anticipo)
    setFacturaElegida('')
    setModalVinculacion(true)
  }

  // Confirmar vinculación anticipo ↔ factura
  const confirmarVinculacion = async () => {
    if (!anticipoParaVincular || !facturaElegida) return
    setVinculando(true)
    try {
      // Resolver factura seleccionada para obtener imp_total
      const candidatos = facturasCandidatos[anticipoParaVincular.id] || []
      const facturaSeleccionada = candidatos.find(f => f.id === facturaElegida)
      const montoAbonar = facturaSeleccionada
        ? facturaSeleccionada.imp_total - anticipoParaVincular.monto_sicore
        : null

      // 1. Copiar SICORE del anticipo a la factura (sicore, monto_sicore, tipo_sicore, monto_a_abonar)
      const { error: errFac } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .update({
          sicore: anticipoParaVincular.sicore,
          monto_sicore: anticipoParaVincular.monto_sicore,
          tipo_sicore: anticipoParaVincular.tipo_sicore,
          ...(montoAbonar !== null ? { monto_a_abonar: montoAbonar } : {}),
        })
        .eq('id', facturaElegida)

      if (errFac) throw errFac

      // 2. Marcar anticipo como vinculado
      const { error: errAnticipo } = await supabase
        .from('anticipos_proveedores')
        .update({ factura_id: facturaElegida })
        .eq('id', anticipoParaVincular.id)

      if (errAnticipo) throw errAnticipo

      toast.success('Vinculación confirmada. SICORE transferido a la factura.')
      setModalVinculacion(false)
      setAnticipoParaVincular(null)
      await cargarAlertasSicore()
    } catch (err) {
      toast.error('Error al vincular: ' + (err as Error).message)
    } finally {
      setVinculando(false)
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
                  <div className="text-2xl font-bold text-orange-600">{ultimoIPC.valor_ipc.toFixed(2)}%</div>
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
            {anticiposSinVincular.length > 0 && (
              <span className="ml-2 bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {anticiposSinVincular.length}
              </span>
            )}
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
          ) : (
            <div className="space-y-3">
              {anticiposSinVincular.map(anticipo => {
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
                          🏛️ Retención {anticipo.sicore} — ${(anticipo.monto_sicore || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {candidatos.length > 0 && (
                        <div className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          {candidatos.length} factura{candidatos.length > 1 ? 's' : ''} del mismo CUIT sin SICORE aplicado
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={candidatos.length > 0 ? 'default' : 'outline'}
                      className={candidatos.length > 0 ? 'bg-blue-600 hover:bg-blue-700 shrink-0' : 'shrink-0'}
                      onClick={() => abrirVinculacion(anticipo)}
                    >
                      <Link2 className="h-3 w-3 mr-1" />
                      Vincular
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
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

      {/* Modal vinculación anticipo ↔ factura */}
      <Dialog open={modalVinculacion} onOpenChange={setModalVinculacion}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>🔗 Vincular Anticipo a Factura</DialogTitle>
            <DialogDescription>
              El SICORE del anticipo se copiará a la factura seleccionada.
            </DialogDescription>
          </DialogHeader>

          {anticipoParaVincular && (
            <div className="space-y-4">
              {/* Resumen anticipo */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm space-y-1">
                <div className="font-medium">{anticipoParaVincular.nombre_proveedor}</div>
                <div className="text-gray-600">CUIT: {anticipoParaVincular.cuit_proveedor}</div>
                <div className="text-gray-600">Quincena SICORE: {anticipoParaVincular.sicore}</div>
                <div className="font-semibold text-red-700">
                  Retención: ${(anticipoParaVincular.monto_sicore || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Selector factura */}
              {(facturasCandidatos[anticipoParaVincular.id] || []).length > 0 ? (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Seleccioná la factura correspondiente:
                  </label>
                  <Select value={facturaElegida} onValueChange={setFacturaElegida}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar factura..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(facturasCandidatos[anticipoParaVincular.id] || []).map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.fecha_emision} — {f.denominacion_emisor} — ${(f.imp_total || 0).toLocaleString('es-AR')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                  ⚠️ No se encontraron facturas de este proveedor sin SICORE aplicado. La factura puede no estar cargada aún.
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={!facturaElegida || vinculando}
                  onClick={confirmarVinculacion}
                >
                  {vinculando ? 'Vinculando...' : '✅ Confirmar Vinculación'}
                </Button>
                <Button variant="outline" onClick={() => setModalVinculacion(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
