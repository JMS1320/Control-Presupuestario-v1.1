"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

interface PagoAnualConfig {
  templateId: string
  cuotaId: string
  montoAnual: number
  fechaPagoAnual: string
}

interface PagoAnualResult {
  success: boolean
  cuotasDesactivadas: number
  cuotaActualizada: boolean
  templateCreado: boolean
  error?: string
}

export function usePagoAnual() {
  const [procesando, setProcesando] = useState(false)
  const [lastResult, setLastResult] = useState<PagoAnualResult | null>(null)

  const ejecutarPagoAnual = async (config: PagoAnualConfig): Promise<PagoAnualResult> => {
    setProcesando(true)
    setLastResult(null)

    try {
      // 1. Obtener información de la cuota seleccionada y el template padre
      const { data: cuotaActual, error: errorCuota } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select(`
          fecha_estimada, 
          egreso_id,
          egreso:egresos_sin_factura!inner(
            categ,
            centro_costo,
            nombre_referencia,
            responsable,
            cuit_quien_cobra,
            nombre_quien_cobra,
            template_master_id,
            pago_anual
          )
        `)
        .eq('id', config.cuotaId)
        .single()

      if (errorCuota || !cuotaActual) {
        throw new Error(`Error obteniendo cuota actual: ${errorCuota?.message}`)
      }

      // 2. SIEMPRE crear nuevo template anual (NUNCA modificar cuotas existentes)
      let templateCreado = true
      let templateAnualId: string

      // Crear template anual basado en el template de cuotas
      const { data: nuevoTemplateAnual, error: errorCrearAnual } = await supabase
        .from('egresos_sin_factura')
        .insert({
          template_master_id: cuotaActual.egreso?.template_master_id,
          categ: cuotaActual.egreso?.categ,
          centro_costo: cuotaActual.egreso?.centro_costo,
          nombre_referencia: `${cuotaActual.egreso?.nombre_referencia} (Anual)`,
          responsable: cuotaActual.egreso?.responsable,
          cuit_quien_cobra: cuotaActual.egreso?.cuit_quien_cobra,
          nombre_quien_cobra: cuotaActual.egreso?.nombre_quien_cobra,
          tipo_recurrencia: 'anual',
          activo: true,
          pago_anual: true,
          monto_anual: config.montoAnual,
          fecha_pago_anual: config.fechaPagoAnual,
          año: new Date().getFullYear()
        })
        .select()
        .single()

      if (errorCrearAnual) {
        throw new Error(`Error creando template anual: ${errorCrearAnual.message}`)
      }

      templateAnualId = nuevoTemplateAnual.id

      // Crear la cuota anual con descripción inteligente
      const descripcionAnual = cuotaActual.egreso?.nombre_referencia?.includes('Cuota') 
        ? cuotaActual.egreso.nombre_referencia.replace(/Cuota \d+\/\d+/, '(Anual)')
        : `${cuotaActual.egreso?.nombre_referencia} (Anual)`

      const { error: errorCuotaAnual } = await supabase
        .from('cuotas_egresos_sin_factura')
        .insert({
          egreso_id: templateAnualId,
          mes: new Date(config.fechaPagoAnual).getMonth() + 1,
          fecha_estimada: config.fechaPagoAnual,
          fecha_vencimiento: config.fechaPagoAnual,
          monto: config.montoAnual,
          descripcion: descripcionAnual,
          estado: 'pendiente'
        })

      if (errorCuotaAnual) {
        throw new Error(`Error creando cuota anual: ${errorCuotaAnual.message}`)
      }

      // 3. SIEMPRE desactivar template original y contar cuotas
      // Obtener todas las cuotas del template original para contador
      const { data: cuotasOriginales, error: errorCuotasOriginales } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select('id')
        .eq('egreso_id', cuotaActual.egreso_id)

      if (errorCuotasOriginales) {
        throw new Error(`Error obteniendo cuotas originales: ${errorCuotasOriginales.message}`)
      }

      const cuotasDesactivadas = cuotasOriginales ? cuotasOriginales.length : 0

      // Desactivar el template original de cuotas
      const { error: errorDesactivarOriginal } = await supabase
        .from('egresos_sin_factura')
        .update({ activo: false })
        .eq('id', cuotaActual.egreso_id)

      if (errorDesactivarOriginal) {
        throw new Error(`Error desactivando template original: ${errorDesactivarOriginal.message}`)
      }

      const result: PagoAnualResult = {
        success: true,
        cuotasDesactivadas,
        cuotaActualizada: true,
        templateCreado
      }
      
      setLastResult(result)
      return result

    } catch (error) {
      const result: PagoAnualResult = {
        success: false,
        cuotasDesactivadas: 0,
        cuotaActualizada: false,
        templateCreado: false,
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
  ): Promise<{ confirmed: boolean; montoAnual?: number; fechaPago?: string }> => {
    return new Promise((resolve) => {
      // Solicitar monto anual
      const montoIngresado = window.prompt(
        `🔄 CONVERTIR A PAGO ANUAL - ${templateNombre}\n\n` +
        `Esta acción creará (o actualizará) un template de pago anual y desactivará el template de cuotas.\n\n` +
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

      // Solicitar fecha de pago anual
      const fechaIngresada = window.prompt(
        `📅 FECHA PAGO ANUAL - ${templateNombre}\n\n` +
        `Monto anual: $${montoAnual.toLocaleString('es-AR')}\n\n` +
        `Ingrese la fecha del pago anual (YYYY-MM-DD):`
      )

      if (fechaIngresada === null) {
        // Usuario canceló
        resolve({ confirmed: false })
        return
      }

      // Validar formato de fecha
      if (!fechaIngresada.match(/^\d{4}-\d{2}-\d{2}$/) || !Date.parse(fechaIngresada)) {
        alert('Fecha inválida. Use formato YYYY-MM-DD. Operación cancelada.')
        resolve({ confirmed: false })
        return
      }

      // Confirmar la operación
      const confirmar = window.confirm(
        `¿Confirma conversión a pago anual?\n\n` +
        `• Monto anual: $${montoAnual.toLocaleString('es-AR')}\n` +
        `• Fecha pago: ${fechaIngresada}\n` +
        `• Se creará NUEVO template anual\n` +
        `• Se desactivarán todas las cuotas existentes\n\n` +
        `⚠️ El template de cuotas original quedará inactivo`
      )

      resolve({ 
        confirmed: confirmar, 
        montoAnual: confirmar ? montoAnual : undefined,
        fechaPago: confirmar ? fechaIngresada : undefined
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