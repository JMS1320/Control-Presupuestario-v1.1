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

      // 2. VERIFICAR si existe registro anual inactivo para reactivar
      const { data: registrosAnuales, error: errorBuscarAnual } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select('id, monto, fecha_estimada, descripcion, estado')
        .eq('egreso_id', cuotaActual.egreso_id)
        .ilike('descripcion', '%anual%')

      if (errorBuscarAnual) {
        throw new Error(`Error buscando registro anual: ${errorBuscarAnual.message}`)
      }

      const registroAnualInactivo = registrosAnuales?.find(r => r.estado === 'desactivado')
      const tieneRegistroAnualActivo = registrosAnuales?.some(r => r.estado === 'pendiente')
      let templateCreado = false // Variable para resultado

      console.log(`🔍 Verificación registro anual template ${cuotaActual.egreso_id}:`)
      console.log(`- Registros anuales encontrados: ${registrosAnuales?.length || 0}`)
      console.log(`- Registro anual inactivo: ${registroAnualInactivo ? 'SÍ' : 'NO'}`)
      console.log(`- Registro anual activo: ${tieneRegistroAnualActivo ? 'SÍ' : 'NO'}`)

      // Cambiar template a modo anual
      const { error: errorCambiarTemplate } = await supabase
        .from('egresos_sin_factura')
        .update({ pago_anual: true })
        .eq('id', cuotaActual.egreso_id)

      if (errorCambiarTemplate) {
        throw new Error(`Error cambiando template a anual: ${errorCambiarTemplate.message}`)
      }

      // CASO A: Existe registro anual inactivo → REACTIVAR
      if (registroAnualInactivo) {
        console.log('✅ REACTIVANDO registro anual existente')
        
        // Reactivar y actualizar datos
        const { error: errorReactivarAnual } = await supabase
          .from('cuotas_egresos_sin_factura')
          .update({
            estado: 'pendiente',
            monto: config.montoAnual,
            fecha_estimada: config.fechaPagoAnual,
            fecha_vencimiento: config.fechaPagoAnual
          })
          .eq('id', registroAnualInactivo.id)

        if (errorReactivarAnual) {
          throw new Error(`Error reactivando registro anual: ${errorReactivarAnual.message}`)
        }

      } else {
        // CASO B: NO existe registro anual → CREAR nuevo
        console.log('🆕 CREANDO nuevo registro anual')
        templateCreado = true // Se está creando registro nuevo

        const descripcionAnual = cuotaActual.egreso?.nombre_referencia?.includes('Cuota') 
          ? cuotaActual.egreso.nombre_referencia.replace(/Cuota \d+\/\d+/, '(Anual)')
          : `${cuotaActual.egreso?.nombre_referencia} (Anual)`

        const { error: errorCuotaAnual } = await supabase
          .from('cuotas_egresos_sin_factura')
          .insert({
            egreso_id: cuotaActual.egreso_id,
            fecha_estimada: config.fechaPagoAnual,
            fecha_vencimiento: config.fechaPagoAnual,
            monto: config.montoAnual,
            descripcion: descripcionAnual,
            estado: 'pendiente'
          })

        if (errorCuotaAnual) {
          throw new Error(`Error creando cuota anual: ${errorCuotaAnual.message}`)
        }
      }

      // 3. Desactivar cuotas (NO template) y contar
      // Obtener cuotas activas (no anuales) para desactivar
      const { data: cuotasActivas, error: errorCuotasActivas } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select('id, descripcion')
        .eq('egreso_id', cuotaActual.egreso_id)
        .eq('estado', 'pendiente')
        .not('descripcion', 'ilike', '%anual%')

      if (errorCuotasActivas) {
        throw new Error(`Error obteniendo cuotas activas: ${errorCuotasActivas.message}`)
      }

      const cuotasDesactivadas = cuotasActivas?.length || 0

      // Desactivar las cuotas activas (NO template)
      if (cuotasActivas && cuotasActivas.length > 0) {
        const { error: errorDesactivarCuotas } = await supabase
          .from('cuotas_egresos_sin_factura')
          .update({ estado: 'desactivado' })
          .eq('egreso_id', cuotaActual.egreso_id)
          .eq('estado', 'pendiente')
          .not('descripcion', 'ilike', '%anual%')

        if (errorDesactivarCuotas) {
          throw new Error(`Error desactivando cuotas: ${errorDesactivarCuotas.message}`)
        } else {
          console.log(`✅ ${cuotasDesactivadas} cuotas desactivadas correctamente`)
        }
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
        `Ingrese la fecha del pago anual (DD/MM/AAAA):`
      )

      if (fechaIngresada === null) {
        // Usuario canceló
        resolve({ confirmed: false })
        return
      }

      // Validar y convertir formato de fecha DD/MM/AAAA → YYYY-MM-DD
      let fechaFormateada = fechaIngresada
      if (fechaIngresada.includes('/')) {
        const partes = fechaIngresada.split('/')
        if (partes.length === 3) {
          const [dia, mes, ano] = partes
          fechaFormateada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
        }
      }
      
      if (!Date.parse(fechaFormateada)) {
        alert('Fecha inválida. Use formato DD/MM/AAAA. Operación cancelada.')
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
        fechaPago: confirmar ? fechaFormateada : undefined
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