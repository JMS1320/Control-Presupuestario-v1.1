"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

interface PagoCuotasConfig {
  templateId: string
  cuotaId: string
  grupoImpuestoId: string
}

interface PagoCuotasResult {
  success: boolean
  templateCuotasActivado: string | null
  templateAnualDesactivado: string | null
  cuotasActivadas: number
  cuotasDesactivadas: number
  error?: string
}

export function usePagoCuotas() {
  const [procesando, setProcesando] = useState(false)
  const [lastResult, setLastResult] = useState<PagoCuotasResult | null>(null)

  const ejecutarPagoCuotas = async (config: PagoCuotasConfig): Promise<PagoCuotasResult> => {
    setProcesando(true)
    setLastResult(null)

    try {
      const { grupoImpuestoId } = config

      if (!grupoImpuestoId) {
        throw new Error('Este template no tiene grupo_impuesto_id. No se puede convertir.')
      }

      // 1. Buscar todos los templates del mismo grupo
      const { data: templatesGrupo, error: errorGrupo } = await supabase
        .from('egresos_sin_factura')
        .select('id, nombre_referencia, activo')
        .eq('grupo_impuesto_id', grupoImpuestoId)

      if (errorGrupo) throw new Error(`Error buscando grupo: ${errorGrupo.message}`)
      if (!templatesGrupo || templatesGrupo.length < 2) {
        throw new Error('No se encontró el par de templates en el grupo')
      }

      // 2. Identificar template Anual y Cuota
      const templateAnual = templatesGrupo.find(t =>
        t.nombre_referencia.toLowerCase().includes('anual')
      )
      const templateCuota = templatesGrupo.find(t =>
        t.nombre_referencia.toLowerCase().includes('cuota')
      )

      if (!templateAnual || !templateCuota) {
        throw new Error('No se encontró par Anual/Cuota en el grupo')
      }

      console.log(`🔄 Conversión a CUOTAS - Grupo: ${grupoImpuestoId}`)
      console.log(`   Template Anual: ${templateAnual.nombre_referencia} (activo: ${templateAnual.activo})`)
      console.log(`   Template Cuota: ${templateCuota.nombre_referencia} (activo: ${templateCuota.activo})`)

      // 3. Desactivar template Anual
      const { error: errorDesactivarTemplate } = await supabase
        .from('egresos_sin_factura')
        .update({ activo: false })
        .eq('id', templateAnual.id)

      if (errorDesactivarTemplate) {
        throw new Error(`Error desactivando template anual: ${errorDesactivarTemplate.message}`)
      }

      // 4. Desactivar cuotas del template Anual (pendiente → desactivado)
      const { data: cuotasDesactivadas, error: errorDesactivarCuotas } = await supabase
        .from('cuotas_egresos_sin_factura')
        .update({ estado: 'desactivado' })
        .eq('egreso_id', templateAnual.id)
        .eq('estado', 'pendiente')
        .select('id')

      if (errorDesactivarCuotas) {
        console.warn('Warning desactivando cuotas:', errorDesactivarCuotas.message)
      }

      // 5. Activar template de Cuotas
      const { error: errorActivarTemplate } = await supabase
        .from('egresos_sin_factura')
        .update({ activo: true })
        .eq('id', templateCuota.id)

      if (errorActivarTemplate) {
        throw new Error(`Error activando template cuotas: ${errorActivarTemplate.message}`)
      }

      // 6. Activar cuotas del template Cuotas (desactivado → pendiente)
      const { data: cuotasActivadas, error: errorActivarCuotas } = await supabase
        .from('cuotas_egresos_sin_factura')
        .update({ estado: 'pendiente' })
        .eq('egreso_id', templateCuota.id)
        .eq('estado', 'desactivado')
        .select('id')

      if (errorActivarCuotas) {
        console.warn('Warning activando cuotas:', errorActivarCuotas.message)
      }

      console.log(`✅ Conversión completada:`)
      console.log(`   - Template Anual desactivado: ${templateAnual.nombre_referencia}`)
      console.log(`   - Cuotas desactivadas: ${cuotasDesactivadas?.length || 0}`)
      console.log(`   - Template Cuota activado: ${templateCuota.nombre_referencia}`)
      console.log(`   - Cuotas activadas: ${cuotasActivadas?.length || 0}`)

      const result: PagoCuotasResult = {
        success: true,
        templateCuotasActivado: templateCuota.nombre_referencia,
        templateAnualDesactivado: templateAnual.nombre_referencia,
        cuotasActivadas: cuotasActivadas?.length || 0,
        cuotasDesactivadas: cuotasDesactivadas?.length || 0
      }

      setLastResult(result)
      return result

    } catch (error) {
      const result: PagoCuotasResult = {
        success: false,
        templateCuotasActivado: null,
        templateAnualDesactivado: null,
        cuotasActivadas: 0,
        cuotasDesactivadas: 0,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }

      setLastResult(result)
      return result

    } finally {
      setProcesando(false)
    }
  }

  const confirmarPagoCuotas = async (
    cuotaId: string,
    templateNombre: string,
    grupoImpuestoId: string | null
  ): Promise<{ confirmed: boolean; grupoImpuestoId?: string }> => {
    return new Promise((resolve) => {
      if (!grupoImpuestoId) {
        alert(`❌ Este template no tiene grupo_impuesto_id configurado.\n\nNo se puede convertir a cuotas.`)
        resolve({ confirmed: false })
        return
      }

      const confirmar = window.confirm(
        `🔄 CONVERTIR A CUOTAS\n\n` +
        `Template: ${templateNombre}\n` +
        `Grupo: ${grupoImpuestoId}\n\n` +
        `Esta acción:\n` +
        `• Desactivará el template ANUAL\n` +
        `• Activará el template de CUOTAS del mismo grupo\n\n` +
        `¿Confirmar conversión?`
      )

      resolve({
        confirmed: confirmar,
        grupoImpuestoId: confirmar ? grupoImpuestoId : undefined
      })
    })
  }

  return {
    procesando,
    lastResult,
    ejecutarPagoCuotas,
    confirmarPagoCuotas
  }
}
