"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

interface PropagacionConfig {
  templateId: string
  cuotaModificadaId: string
  nuevoMonto: number
  aplicarATodasLasFuturas: boolean
}

interface PropagacionResult {
  success: boolean
  cuotasModificadas: number
  error?: string
}

export function usePropagacionCuotas() {
  const [propagando, setPropagando] = useState(false)
  const [lastResult, setLastResult] = useState<PropagacionResult | null>(null)

  const ejecutarPropagacion = async (config: PropagacionConfig): Promise<PropagacionResult> => {
    setPropagando(true)
    setLastResult(null)

    try {
      // 1. Obtener la cuota que se está modificando para referencia de fecha
      const { data: cuotaReferencia, error: errorReferencia } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select('fecha_estimada, egreso_id')
        .eq('id', config.cuotaModificadaId)
        .single()

      if (errorReferencia || !cuotaReferencia) {
        throw new Error(`Error obteniendo cuota referencia: ${errorReferencia?.message}`)
      }

      // 2. Si se aplica a futuras, obtener todas las cuotas futuras del mismo template
      if (config.aplicarATodasLasFuturas) {
        const { data: cuotasFuturas, error: errorFuturas } = await supabase
          .from('cuotas_egresos_sin_factura')
          .select('id')
          .eq('egreso_id', cuotaReferencia.egreso_id)
          .gt('fecha_estimada', cuotaReferencia.fecha_estimada)

        if (errorFuturas) {
          throw new Error(`Error obteniendo cuotas futuras: ${errorFuturas.message}`)
        }

        // 3. Actualizar todas las cuotas futuras al mismo monto
        if (cuotasFuturas && cuotasFuturas.length > 0) {
          const cuotaIds = cuotasFuturas.map(c => c.id)
          
          const { error: errorUpdate } = await supabase
            .from('cuotas_egresos_sin_factura')
            .update({ monto: config.nuevoMonto })
            .in('id', cuotaIds)

          if (errorUpdate) {
            throw new Error(`Error actualizando cuotas futuras: ${errorUpdate.message}`)
          }

          const result: PropagacionResult = {
            success: true,
            cuotasModificadas: cuotasFuturas.length
          }
          
          setLastResult(result)
          return result
        }
      }

      // Si no hay propagación o no hay cuotas futuras
      const result: PropagacionResult = {
        success: true,
        cuotasModificadas: 0
      }
      
      setLastResult(result)
      return result

    } catch (error) {
      const result: PropagacionResult = {
        success: false,
        cuotasModificadas: 0,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
      
      setLastResult(result)
      return result

    } finally {
      setPropagando(false)
    }
  }

  const confirmarPropagacion = async (
    cuotaId: string, 
    templateId: string, 
    nuevoMonto: number
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      // Usar confirm nativo del browser por ahora
      // En el futuro se puede cambiar por un modal más elegante
      const confirmar = window.confirm(
        `¿Desea aplicar el nuevo monto $${nuevoMonto.toLocaleString('es-AR')} a todas las cuotas futuras de este template?\n\n` +
        `- SÍ: Todas las cuotas posteriores tendrán el mismo monto\n` +
        `- NO: Solo se modificará esta cuota`
      )
      
      resolve(confirmar)
    })
  }

  return {
    propagando,
    lastResult,
    ejecutarPropagacion,
    confirmarPropagacion
  }
}