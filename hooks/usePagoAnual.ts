"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

interface PagoAnualConfig {
  templateId: string
  cuotaId: string
  montoAnual: number
}

interface PagoAnualResult {
  success: boolean
  cuotasEliminadas: number
  cuotaActualizada: boolean
  error?: string
}

export function usePagoAnual() {
  const [procesando, setProcesando] = useState(false)
  const [lastResult, setLastResult] = useState<PagoAnualResult | null>(null)

  const ejecutarPagoAnual = async (config: PagoAnualConfig): Promise<PagoAnualResult> => {
    setProcesando(true)
    setLastResult(null)

    try {
      // 1. Obtener información de la cuota seleccionada
      const { data: cuotaActual, error: errorCuota } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select('fecha_estimada, egreso_id')
        .eq('id', config.cuotaId)
        .single()

      if (errorCuota || !cuotaActual) {
        throw new Error(`Error obteniendo cuota actual: ${errorCuota?.message}`)
      }

      // 2. Obtener todas las cuotas futuras del mismo template
      const { data: cuotasFuturas, error: errorFuturas } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select('id')
        .eq('egreso_id', cuotaActual.egreso_id)
        .gt('fecha_estimada', cuotaActual.fecha_estimada)

      if (errorFuturas) {
        throw new Error(`Error obteniendo cuotas futuras: ${errorFuturas.message}`)
      }

      let cuotasEliminadas = 0

      // 3. Eliminar todas las cuotas futuras si existen
      if (cuotasFuturas && cuotasFuturas.length > 0) {
        const cuotaIds = cuotasFuturas.map(c => c.id)
        
        const { error: errorEliminar } = await supabase
          .from('cuotas_egresos_sin_factura')
          .delete()
          .in('id', cuotaIds)

        if (errorEliminar) {
          throw new Error(`Error eliminando cuotas futuras: ${errorEliminar.message}`)
        }

        cuotasEliminadas = cuotasFuturas.length
      }

      // 4. Actualizar la cuota actual con el monto anual
      const { error: errorUpdate } = await supabase
        .from('cuotas_egresos_sin_factura')
        .update({ 
          monto: config.montoAnual,
          descripcion: 'Pago anual' // Marcar como pago anual
        })
        .eq('id', config.cuotaId)

      if (errorUpdate) {
        throw new Error(`Error actualizando cuota a pago anual: ${errorUpdate.message}`)
      }

      const result: PagoAnualResult = {
        success: true,
        cuotasEliminadas,
        cuotaActualizada: true
      }
      
      setLastResult(result)
      return result

    } catch (error) {
      const result: PagoAnualResult = {
        success: false,
        cuotasEliminadas: 0,
        cuotaActualizada: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
      
      setLastResult(result)
      return result

    } finally {
      setProcesando(false)
    }
  }

  const confirmarPagoAnual = async (
    cuotaId: string,
    templateNombre: string
  ): Promise<{ confirmed: boolean; montoAnual?: number }> => {
    return new Promise((resolve) => {
      // Solicitar monto anual
      const montoIngresado = window.prompt(
        `🔄 PAGO ANUAL - ${templateNombre}\n\n` +
        `Esta acción convertirá esta cuota en un pago anual y eliminará todas las cuotas futuras.\n\n` +
        `Ingrese el monto anual total:`
      )

      if (montoIngresado === null) {
        // Usuario canceló
        resolve({ confirmed: false })
        return
      }

      const montoAnual = parseFloat(montoIngresado.replace(/[,.]/g, ''))
      
      if (isNaN(montoAnual) || montoAnual <= 0) {
        alert('Monto inválido. Operación cancelada.')
        resolve({ confirmed: false })
        return
      }

      // Confirmar la operación
      const confirmar = window.confirm(
        `¿Confirma convertir a pago anual?\n\n` +
        `Monto anual: $${montoAnual.toLocaleString('es-AR')}\n` +
        `⚠️ ATENCIÓN: Se eliminarán todas las cuotas futuras de este template`
      )

      resolve({ 
        confirmed: confirmar, 
        montoAnual: confirmar ? montoAnual : undefined 
      })
    })
  }

  return {
    procesando,
    lastResult,
    ejecutarPagoAnual,
    confirmarPagoAnual
  }
}