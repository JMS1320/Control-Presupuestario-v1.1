"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, Calendar, AlertCircle, Link2, CheckCircle2, Trash2 } from "lucide-react"
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
  monto: number
  monto_sicore: number
  descuento_aplicado: number | null
  sicore: string
  tipo_sicore: string
  fecha_pago: string
  factura_id: string | null
  descripcion: string | null
}

interface FacturaCandidato {
  id: string
  denominacion_emisor: string
  cuit: string
  imp_total: number
  fecha_emision: string
}

interface CalcVinculacion {
  caso: 'A' | 'B'
  saldo: number
  neto_pagado: number
  descuento: number
  sicore: number
}

export function VistaPrincipal() {
  const [ultimoIPC, setUltimoIPC] = useState<UltimoIPC | null>(null)
  const [modalIPCAbierto, setModalIPCAbierto] = useState(false)
  const [loading, setLoading] = useState(true)

  // Alertas SICORE
  const [anticiposSinVincular, setAnticiposSinVincular] = useState<AnticipoSicore[]>([])
  const [facturasCandidatos, setFacturasCandidatos] = useState<Record<string, FacturaCandidato[]>>({})
  const [cargandoAlertas, setCargandoAlertas] = useState(false)

  // Modal vinculación — wizard
  const [modalVinculacion, setModalVinculacion] = useState(false)
  const [anticipoParaVincular, setAnticipoParaVincular] = useState<AnticipoSicore | null>(null)
  const [facturaElegida, setFacturaElegida] = useState<string>('')
  const [pasoWizard, setPasoWizard] = useState<'seleccion' | 'confirmacion'>('seleccion')
  const [calculo, setCalculo] = useState<CalcVinculacion | null>(null)
  const [vinculando, setVinculando] = useState(false)

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
        .select('id, nombre_proveedor, cuit_proveedor, monto, monto_sicore, descuento_aplicado, sicore, tipo_sicore, fecha_pago, factura_id, descripcion')
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

      // Para cada CUIT único, buscar facturas pendientes
      const cuitsUnicos = [...new Set(anticipos.map((a: any) => a.cuit_proveedor))]
      const candidatosPorAnticipo: Record<string, FacturaCandidato[]> = {}

      await Promise.all(
        cuitsUnicos.map(async (cuit) => {
          const { data: facturas } = await supabase
            .schema('msa')
            .from('comprobantes_arca')
            .select('id, denominacion_emisor, cuit, imp_total, fecha_emision')
            .eq('cuit', cuit)
            .eq('estado', 'pendiente')
            .order('fecha_emision', { ascending: false })
            .limit(10)

          if (facturas) {
            anticipos
              .filter((a: any) => a.cuit_proveedor === cuit)
              .forEach((a: any) => { candidatosPorAnticipo[a.id] = facturas })
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

  const abrirVinculacion = (anticipo: AnticipoSicore) => {
    setAnticipoParaVincular(anticipo)
    setFacturaElegida('')
    setCalculo(null)
    setPasoWizard('seleccion')
    setModalVinculacion(true)
  }

  // Calcular cuando se selecciona una factura
  const onSeleccionarFactura = (facturaId: string) => {
    setFacturaElegida(facturaId)
    if (!anticipoParaVincular) return
    const candidatos = facturasCandidatos[anticipoParaVincular.id] || []
    const fac = candidatos.find(f => f.id === facturaId)
    if (!fac) return

    const sicore = anticipoParaVincular.monto_sicore || 0
    const descuento = anticipoParaVincular.descuento_aplicado || 0
    // Caso A: anticipo >= imp_total → FC cubierta completamente
    // Caso B: anticipo < imp_total → saldo pendiente = imp_total - anticipo - sicore - descuento
    const cubierto = anticipoParaVincular.monto >= fac.imp_total - 0.01
    const saldo = cubierto ? 0 : fac.imp_total - anticipoParaVincular.monto - sicore - descuento
    const neto_pagado = anticipoParaVincular.monto - sicore - descuento

    setCalculo({
      caso: cubierto ? 'A' : 'B',
      saldo: Math.max(0, saldo),
      neto_pagado,
      descuento,
      sicore,
    })
  }

  // Paso 1 → Paso 2
  const avanzarAConfirmacion = () => {
    if (!facturaElegida || !calculo) return
    setPasoWizard('confirmacion')
  }

  // Confirmar vinculación definitiva
  const confirmarVinculacion = async () => {
    if (!anticipoParaVincular || !facturaElegida || !calculo) return
    setVinculando(true)
    try {
      const candidatos = facturasCandidatos[anticipoParaVincular.id] || []
      const fac = candidatos.find(f => f.id === facturaElegida)
      if (!fac) throw new Error('Factura no encontrada')

      // Datos comunes que la FC hereda del anticipo
      const herenciaComun: Record<string, any> = {
        sicore: anticipoParaVincular.sicore,
        monto_sicore: anticipoParaVincular.monto_sicore,
        tipo_sicore: anticipoParaVincular.tipo_sicore,
      }
      // Heredar descripcion del anticipo a la FC (si tiene)
      if (anticipoParaVincular.descripcion) {
        herenciaComun.detalle = anticipoParaVincular.descripcion
      }

      if (calculo.caso === 'A') {
        // Factura completamente cubierta → marcar como pagada
        const { error: errFac } = await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .update({
            ...herenciaComun,
            estado: 'pagado',
            monto_a_abonar: calculo.neto_pagado,
            fecha_vencimiento: anticipoParaVincular.fecha_pago,
            fecha_estimada: anticipoParaVincular.fecha_pago,
          })
          .eq('id', facturaElegida)
        if (errFac) throw errFac
      } else {
        // Caso B: saldo pendiente — FC mantiene su estado, anticipo queda parcial
        const { error: errFac } = await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .update({
            ...herenciaComun,
            monto_a_abonar: calculo.saldo,
          })
          .eq('id', facturaElegida)
        if (errFac) throw errFac
      }

      // Vincular anticipo: Caso A → vinculado (desaparece), Caso B → parcial (permanece)
      const { error: errAnticipo } = await supabase
        .from('anticipos_proveedores')
        .update({
          factura_id: facturaElegida,
          estado: calculo.caso === 'A' ? 'vinculado' : 'parcial',
        })
        .eq('id', anticipoParaVincular.id)
      if (errAnticipo) throw errAnticipo

      // Transferir sicore_retenciones: agregar factura_id al registro del anticipo
      if (anticipoParaVincular.sicore || anticipoParaVincular.monto_sicore) {
        await supabase
          .schema('msa')
          .from('sicore_retenciones')
          .update({ factura_id: facturaElegida })
          .eq('anticipo_id', anticipoParaVincular.id)
          .is('factura_id', null)
      }

      const msg = calculo.caso === 'A'
        ? `Vinculación completa. Factura marcada como pagada (${fmt(calculo.neto_pagado)} neto).`
        : `Vinculación parcial. Saldo pendiente: ${fmt(calculo.saldo)}.`
      toast.success(msg)
      setModalVinculacion(false)
      setAnticipoParaVincular(null)
      await cargarAlertasSicore()
    } catch (err) {
      toast.error('Error al vincular: ' + (err as Error).message)
    } finally {
      setVinculando(false)
    }
  }

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

  const cerrarModal = () => {
    setModalVinculacion(false)
    setAnticipoParaVincular(null)
    setFacturaElegida('')
    setCalculo(null)
    setPasoWizard('seleccion')
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
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => abrirVinculacion(anticipo)}>
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
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => abrirVinculacion(anticipo)}>
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

      {/* Modal vinculación — wizard 2 pasos */}
      <Dialog open={modalVinculacion} onOpenChange={cerrarModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>🔗 Vincular Anticipo a Factura</DialogTitle>
            <DialogDescription>
              {pasoWizard === 'seleccion' ? 'Paso 1 — Seleccioná la factura correspondiente' : 'Paso 2 — Confirmá la vinculación'}
            </DialogDescription>
          </DialogHeader>

          {anticipoParaVincular && (
            <div className="space-y-4">

              {/* Resumen anticipo — siempre visible */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm space-y-1">
                <div className="font-semibold">{anticipoParaVincular.nombre_proveedor}</div>
                <div className="text-gray-500 text-xs">{anticipoParaVincular.cuit_proveedor} — pagado {fmtFecha(anticipoParaVincular.fecha_pago)}</div>
                <div className="flex gap-4 mt-1 flex-wrap">
                  <span>💰 Monto anticipo: <strong>{fmt(anticipoParaVincular.monto)}</strong></span>
                  <span className="text-red-700">🏛️ Retención: <strong>{fmt(anticipoParaVincular.monto_sicore || 0)}</strong> ({anticipoParaVincular.tipo_sicore} — {anticipoParaVincular.sicore})</span>
                  {anticipoParaVincular.descuento_aplicado ? (
                    <span className="text-blue-700">📉 Descuento: <strong>{fmt(anticipoParaVincular.descuento_aplicado)}</strong></span>
                  ) : null}
                </div>
              </div>

              {/* PASO 1: Selector factura + preview cálculo */}
              {pasoWizard === 'seleccion' && (
                <>
                  {(facturasCandidatos[anticipoParaVincular.id] || []).length > 0 ? (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Factura a vincular:
                      </label>
                      <Select value={facturaElegida} onValueChange={onSeleccionarFactura}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar factura..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(facturasCandidatos[anticipoParaVincular.id] || []).map(f => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.fecha_emision} — {f.denominacion_emisor} — {fmt(f.imp_total || 0)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                      ⚠️ No se encontraron facturas pendientes de este proveedor.
                    </div>
                  )}

                  {/* Preview cálculo inline */}
                  {calculo && facturaElegida && (() => {
                    const fac = (facturasCandidatos[anticipoParaVincular.id] || []).find(f => f.id === facturaElegida)
                    return (
                      <div className={`rounded-lg p-3 text-sm space-y-1 border ${calculo.caso === 'A' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="font-semibold mb-2">
                          {calculo.caso === 'A' ? '✅ Factura cubierta completamente' : '⚠️ Anticipo cubre parcialmente'}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                          <span className="text-gray-600">Total factura:</span>
                          <span className="font-medium">{fmt(fac?.imp_total || 0)}</span>
                          <span className="text-gray-600">Anticipo aplicado:</span>
                          <span className="font-medium text-amber-700">− {fmt(anticipoParaVincular.monto)}</span>
                          {calculo.sicore > 0 && (<><span className="text-gray-600">Retención SICORE:</span><span className="font-medium text-red-700">− {fmt(calculo.sicore)}</span></>)}
                          {calculo.descuento > 0 && (<><span className="text-gray-600">Descuento:</span><span className="font-medium text-blue-700">− {fmt(calculo.descuento)}</span></>)}
                          <span className="text-gray-600 border-t pt-1 mt-1">{calculo.caso === 'A' ? 'Neto transferido:' : 'Saldo pendiente:'}</span>
                          <span className={`font-bold border-t pt-1 mt-1 ${calculo.caso === 'A' ? 'text-green-700' : 'text-blue-700'}`}>
                            {calculo.caso === 'A' ? fmt(calculo.neto_pagado) : fmt(calculo.saldo)}
                          </span>
                        </div>
                      </div>
                    )
                  })()}

                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      disabled={!facturaElegida || !calculo}
                      onClick={avanzarAConfirmacion}
                    >
                      Siguiente →
                    </Button>
                    <Button variant="outline" onClick={cerrarModal}>Cancelar</Button>
                  </div>
                </>
              )}

              {/* PASO 2: Confirmación */}
              {pasoWizard === 'confirmacion' && calculo && (() => {
                const fac = (facturasCandidatos[anticipoParaVincular.id] || []).find(f => f.id === facturaElegida)
                return (
                  <>
                    <div className={`rounded-lg p-4 text-sm space-y-2 border ${calculo.caso === 'A' ? 'bg-green-50 border-green-300' : 'bg-blue-50 border-blue-300'}`}>
                      <div className="font-semibold text-base mb-3">
                        {calculo.caso === 'A' ? '✅ Factura cubierta — se marcará como PAGADA' : '📋 Pago parcial — quedará saldo pendiente'}
                      </div>

                      <div className="text-xs space-y-1">
                        <div className="font-medium text-gray-700 mb-1">Factura: {fac?.denominacion_emisor} — {fac?.fecha_emision}</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <span className="text-gray-600">Total factura:</span>
                          <span>{fmt(fac?.imp_total || 0)}</span>
                          <span className="text-gray-600">Anticipo aplicado:</span>
                          <span className="text-amber-700">− {fmt(anticipoParaVincular.monto)}</span>
                          {calculo.sicore > 0 && (<><span className="text-gray-600">Retención SICORE ({anticipoParaVincular.tipo_sicore}):</span><span className="text-red-700">− {fmt(calculo.sicore)}</span></>)}
                          {calculo.descuento > 0 && (<><span className="text-gray-600">Descuento:</span><span className="text-blue-700">− {fmt(calculo.descuento)}</span></>)}
                        </div>
                      </div>

                      <div className="border-t pt-2 mt-2 space-y-1 text-xs">
                        <div className="font-semibold text-gray-700">Lo que va a suceder:</div>
                        {calculo.caso === 'A' ? (
                          <>
                            <div className="flex items-start gap-1"><span className="text-green-600">✓</span> Factura → <strong>pagada</strong> con neto <strong>{fmt(calculo.neto_pagado)}</strong> al {fmtFecha(anticipoParaVincular.fecha_pago)}</div>
                            <div className="flex items-start gap-1"><span className="text-green-600">✓</span> Anticipo → <strong>vinculado</strong> (desaparece del cash flow)</div>
                            <div className="flex items-start gap-1"><span className="text-green-600">✓</span> SICORE, retención y descripción heredados a la factura</div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-start gap-1"><span className="text-blue-600">✓</span> Factura → saldo <strong>{fmt(calculo.saldo)}</strong> por pagar</div>
                            <div className="flex items-start gap-1"><span className="text-blue-600">✓</span> Anticipo → <strong>parcial</strong> (permanece en cash flow hasta conciliar en banco)</div>
                            <div className="flex items-start gap-1"><span className="text-blue-600">✓</span> SICORE, retención y descripción copiados a la factura</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" onClick={() => setPasoWizard('seleccion')} disabled={vinculando}>
                        ← Atrás
                      </Button>
                      <Button
                        className={`flex-1 ${calculo.caso === 'A' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        disabled={vinculando}
                        onClick={confirmarVinculacion}
                      >
                        {vinculando ? 'Vinculando...' : '✅ Confirmar Vinculación'}
                      </Button>
                      <Button variant="outline" onClick={cerrarModal} disabled={vinculando}>Cancelar</Button>
                    </div>
                  </>
                )
              })()}

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
