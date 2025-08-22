"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

// Tipos para testing sistemático
interface ValidationResult {
  valid: boolean
  field: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

interface TemplateTestSuite {
  templateId: string
  templateName: string
  cuotasCount: number
  results: ValidationResult[]
  passed: number
  failed: number
  warnings: number
}

export function useTemplateValidator() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<TemplateTestSuite[]>([])

  // Test 1: Validar estructura básica template
  const validateTemplateStructure = async (templateId: string): Promise<ValidationResult[]> => {
    const results: ValidationResult[] = []
    
    try {
      // Obtener template completo
      const { data: template, error } = await supabase
        .from('egresos_sin_factura')
        .select(`
          *,
          cuotas:cuotas_egresos_sin_factura(*)
        `)
        .eq('id', templateId)
        .single()

      if (error || !template) {
        results.push({
          valid: false,
          field: 'template_existence',
          message: 'Template no encontrado en BD',
          severity: 'error'
        })
        return results
      }

      // Test: Campos requeridos
      const requiredFields = ['nombre_referencia', 'responsable', 'año', 'tipo_recurrencia']
      requiredFields.forEach(field => {
        if (!template[field]) {
          results.push({
            valid: false,
            field,
            message: `Campo requerido '${field}' faltante`,
            severity: 'error'
          })
        } else {
          results.push({
            valid: true,
            field,
            message: `Campo '${field}' válido`,
            severity: 'info'
          })
        }
      })

      // Test: Cuotas generadas
      if (!template.cuotas || template.cuotas.length === 0) {
        results.push({
          valid: false,
          field: 'cuotas',
          message: 'Template sin cuotas generadas',
          severity: 'error'
        })
      } else {
        results.push({
          valid: true,
          field: 'cuotas',
          message: `${template.cuotas.length} cuotas generadas correctamente`,
          severity: 'info'
        })
      }

      // Test: Fechas válidas
      template.cuotas?.forEach((cuota: any, index: number) => {
        if (!cuota.fecha_estimada) {
          results.push({
            valid: false,
            field: `cuota_${index + 1}_fecha`,
            message: `Cuota ${index + 1}: Fecha estimada faltante`,
            severity: 'error'
          })
        }
        
        if (cuota.monto <= 0) {
          results.push({
            valid: false,
            field: `cuota_${index + 1}_monto`,
            message: `Cuota ${index + 1}: Monto inválido (${cuota.monto})`,
            severity: 'error'
          })
        }
      })

      return results

    } catch (error) {
      results.push({
        valid: false,
        field: 'general',
        message: `Error validación: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        severity: 'error'
      })
      return results
    }
  }

  // Test 2: Validar edición inline
  const validateInlineEditing = async (templateId: string): Promise<ValidationResult[]> => {
    const results: ValidationResult[] = []
    
    try {
      const { data: cuotas } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select('*')
        .eq('egreso_id', templateId)
        .limit(1)

      if (!cuotas || cuotas.length === 0) {
        results.push({
          valid: false,
          field: 'inline_editing',
          message: 'No hay cuotas para testear edición',
          severity: 'error'
        })
        return results
      }

      const cuota = cuotas[0]
      const originalMonto = cuota.monto

      // Test: Cambiar monto
      const nuevoMonto = originalMonto + 1000
      const { error: updateError } = await supabase
        .from('cuotas_egresos_sin_factura')
        .update({ monto: nuevoMonto })
        .eq('id', cuota.id)

      if (updateError) {
        results.push({
          valid: false,
          field: 'monto_edicion',
          message: `Error actualizando monto: ${updateError.message}`,
          severity: 'error'
        })
      } else {
        results.push({
          valid: true,
          field: 'monto_edicion',
          message: `Monto actualizado correctamente: ${originalMonto} → ${nuevoMonto}`,
          severity: 'info'
        })

        // Revertir cambio
        await supabase
          .from('cuotas_egresos_sin_factura')
          .update({ monto: originalMonto })
          .eq('id', cuota.id)
      }

      return results

    } catch (error) {
      results.push({
        valid: false,
        field: 'inline_editing',
        message: `Error testing edición: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        severity: 'error'
      })
      return results
    }
  }

  // Test 3: Validar regla fecha_vencimiento → fecha_estimada
  const validateDateSyncRule = async (templateId: string): Promise<ValidationResult[]> => {
    const results: ValidationResult[] = []
    
    try {
      const { data: cuotas } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select('*')
        .eq('egreso_id', templateId)
        .limit(1)

      if (!cuotas || cuotas.length === 0) {
        results.push({
          valid: false,
          field: 'date_sync',
          message: 'No hay cuotas para testear sincronización fechas',
          severity: 'error'
        })
        return results
      }

      const cuota = cuotas[0]
      const nuevaFechaVencimiento = '2026-12-25'

      // Test: Cambiar fecha_vencimiento debe actualizar fecha_estimada
      const { error } = await supabase
        .from('cuotas_egresos_sin_factura')
        .update({ fecha_vencimiento: nuevaFechaVencimiento })
        .eq('id', cuota.id)

      if (error) {
        results.push({
          valid: false,
          field: 'date_sync',
          message: `Error actualizando fecha_vencimiento: ${error.message}`,
          severity: 'error'
        })
      } else {
        // Verificar si fecha_estimada se actualizó
        const { data: cuotaActualizada } = await supabase
          .from('cuotas_egresos_sin_factura')
          .select('fecha_estimada, fecha_vencimiento')
          .eq('id', cuota.id)
          .single()

        if (cuotaActualizada?.fecha_estimada === nuevaFechaVencimiento) {
          results.push({
            valid: true,
            field: 'date_sync',
            message: 'Regla fecha_vencimiento → fecha_estimada funcionando correctamente',
            severity: 'info'
          })
        } else {
          results.push({
            valid: false,
            field: 'date_sync',
            message: `Regla fecha_vencimiento → fecha_estimada NO funcionando. Esperado: ${nuevaFechaVencimiento}, Actual: ${cuotaActualizada?.fecha_estimada}`,
            severity: 'error'
          })
        }

        // Revertir cambio
        await supabase
          .from('cuotas_egresos_sin_factura')
          .update({ 
            fecha_vencimiento: cuota.fecha_vencimiento,
            fecha_estimada: cuota.fecha_estimada 
          })
          .eq('id', cuota.id)
      }

      return results

    } catch (error) {
      results.push({
        valid: false,
        field: 'date_sync',
        message: `Error testing sincronización fechas: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        severity: 'error'
      })
      return results
    }
  }

  // Ejecutar batería completa de tests
  const runFullTestSuite = async (templateId: string, templateName: string) => {
    setTesting(true)
    
    try {
      const allResults: ValidationResult[] = []
      
      // Ejecutar todos los tests
      const structureResults = await validateTemplateStructure(templateId)
      const editingResults = await validateInlineEditing(templateId)
      const dateSyncResults = await validateDateSyncRule(templateId)
      
      allResults.push(...structureResults, ...editingResults, ...dateSyncResults)
      
      // Contar resultados
      const passed = allResults.filter(r => r.valid).length
      const failed = allResults.filter(r => !r.valid && r.severity === 'error').length
      const warnings = allResults.filter(r => r.severity === 'warning').length
      
      const testSuite: TemplateTestSuite = {
        templateId,
        templateName,
        cuotasCount: 0, // Se calculará después
        results: allResults,
        passed,
        failed,
        warnings
      }
      
      setResults(prev => [...prev, testSuite])
      
      return testSuite
      
    } catch (error) {
      console.error('Error ejecutando test suite:', error)
    } finally {
      setTesting(false)
    }
  }

  return {
    testing,
    results,
    runFullTestSuite,
    validateTemplateStructure,
    validateInlineEditing,
    validateDateSyncRule
  }
}