"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TrendingUp, Calendar, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ConfiguradorIPC } from "./configurador-ipc"

interface UltimoIPC {
  anio: number
  mes: number
  valor_ipc: number
  fuente: string
}

export function VistaPrincipal() {
  const [ultimoIPC, setUltimoIPC] = useState<UltimoIPC | null>(null)
  const [modalIPCAbierto, setModalIPCAbierto] = useState(false)
  const [loading, setLoading] = useState(true)

  // Meses del año
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  // Cargar último IPC
  const cargarUltimoIPC = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('indices_ipc')
        .select('anio, mes, valor_ipc, fuente')
        .order('anio', { ascending: false })
        .order('mes', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error al cargar último IPC:', error)
        return
      }

      if (data && data.length > 0) {
        setUltimoIPC(data[0])
      }
    } catch (error) {
      console.error('Error inesperado:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarUltimoIPC()
  }, [])

  // Abrir modal IPC
  const abrirModalIPC = () => {
    setModalIPCAbierto(true)
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
          {/* Botón IPC */}
          <Button 
            onClick={abrirModalIPC}
            className="bg-orange-600 hover:bg-orange-700 flex items-center gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            IPC
          </Button>

          {/* Display último IPC */}
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
                      <div className="text-xs text-gray-500">
                        Último IPC registrado
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-orange-600">
                      {ultimoIPC.valor_ipc.toFixed(2)}%
                    </div>
                    <div className="text-xs text-gray-500 uppercase">
                      {ultimoIPC.fuente}
                    </div>
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

        {/* Área principal - Alertas de pagos (placeholder) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                Alertas de Pagos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <AlertCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">Sección en desarrollo</h3>
                <p className="text-sm">
                  Aquí se mostrarán las alertas de pagos próximos según configuración
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modal IPC */}
        <Dialog open={modalIPCAbierto} onOpenChange={setModalIPCAbierto}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gestión de Índices IPC</DialogTitle>
            </DialogHeader>
            <ConfiguradorIPC />
          </DialogContent>
        </Dialog>
    </div>
  )
}