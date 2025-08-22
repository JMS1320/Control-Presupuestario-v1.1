"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

interface AlertaTemplate {
  id: string
  nombreTemplate: string
  fechaVencimiento: string
  monto: number
  diasRestantes: number
  tipoAlerta: 'critica' | 'urgente' | 'proxima' // ≤3 días, ≤7 días, ≤30 días
  responsable: string
}

export function useAlertasTemplates() {
  const [alertas, setAlertas] = useState<AlertaTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarAlertas = async () => {
    setLoading(true)
    setError(null)

    try {
      const fechaHoy = new Date().toISOString().split('T')[0]
      const fechaLimite = new Date()
      fechaLimite.setDate(fechaLimite.getDate() + 30) // Alertas hasta 30 días
      const fechaLimiteStr = fechaLimite.toISOString().split('T')[0]

      // Obtener cuotas que vencen en los próximos 30 días
      const { data: cuotasProximas, error: errorCuotas } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select(`
          id,
          fecha_estimada,
          monto,
          egreso:egresos_sin_factura!inner(
            nombre_referencia,
            responsable
          )
        `)
        .gte('fecha_estimada', fechaHoy)
        .lte('fecha_estimada', fechaLimiteStr)
        .in('estado', ['pendiente', 'pagar']) // Solo alertar estados activos
        .order('fecha_estimada', { ascending: true })

      if (errorCuotas) {
        throw new Error(`Error cargando alertas: ${errorCuotas.message}`)
      }

      // Procesar alertas y calcular días restantes
      const alertasCalculadas: AlertaTemplate[] = (cuotasProximas || []).map(cuota => {
        const fechaVenc = new Date(cuota.fecha_estimada)
        const hoy = new Date()
        const diasRestantes = Math.ceil((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))

        let tipoAlerta: AlertaTemplate['tipoAlerta']
        if (diasRestantes <= 3) {
          tipoAlerta = 'critica'
        } else if (diasRestantes <= 7) {
          tipoAlerta = 'urgente'
        } else {
          tipoAlerta = 'proxima'
        }

        return {
          id: cuota.id,
          nombreTemplate: cuota.egreso?.nombre_referencia || 'Template sin nombre',
          fechaVencimiento: cuota.fecha_estimada,
          monto: cuota.monto,
          diasRestantes,
          tipoAlerta,
          responsable: cuota.egreso?.responsable || 'Sin responsable'
        }
      })

      setAlertas(alertasCalculadas)

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido')
      console.error('Error cargando alertas templates:', error)
    } finally {
      setLoading(false)
    }
  }

  // Cargar alertas al montar el componente
  useEffect(() => {
    cargarAlertas()
  }, [])

  // Función para obtener alertas críticas (≤7 días)
  const getAlertasCriticas = () => {
    return alertas.filter(a => a.tipoAlerta === 'critica' || a.tipoAlerta === 'urgente')
  }

  // Función para obtener color de alerta
  const getColorAlerta = (tipo: AlertaTemplate['tipoAlerta']) => {
    switch (tipo) {
      case 'critica': return 'bg-red-100 text-red-800 border-red-200'
      case 'urgente': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'proxima': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Función para obtener icono de alerta
  const getIconoAlerta = (tipo: AlertaTemplate['tipoAlerta']) => {
    switch (tipo) {
      case 'critica': return '🚨'
      case 'urgente': return '⚠️'
      case 'proxima': return '📅'
      default: return '📋'
    }
  }

  // Función para formatear fecha legible
  const formatearFecha = (fecha: string) => {
    try {
      const fechaObj = new Date(fecha)
      return fechaObj.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return fecha
    }
  }

  // Función para formatear monto
  const formatearMonto = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(monto)
  }

  return {
    alertas,
    loading,
    error,
    cargarAlertas,
    getAlertasCriticas,
    getColorAlerta,
    getIconoAlerta,
    formatearFecha,
    formatearMonto
  }
}