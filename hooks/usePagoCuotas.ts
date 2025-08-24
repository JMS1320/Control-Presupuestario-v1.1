"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

interface PagoCuotasConfig {
  templateId: string
  cuotaId: string
  montoPorCuota: number
  numeroCuotas: number
  fechaPrimeraCuota: string
  frecuenciaMeses: number // 1=mensual, 3=trimestral, 6=semestral, 12=anual
}

interface PagoCuotasResult {
  success: boolean
  cuotasCreadas: number
  templateReactivado: boolean
  templateCreado: boolean
  error?: string
}

export function usePagoCuotas() {
  const [procesando, setProcesando] = useState(false)
  const [lastResult, setLastResult] = useState<PagoCuotasResult | null>(null)

  const ejecutarPagoCuotas = async (config: PagoCuotasConfig): Promise<PagoCuotasResult> => {
    setProcesando(true)
    setLastResult(null)

    try {
      // 1. Obtener información del template actual y sus datos
      const { data: cuotaActual, error: errorCuota } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select(`
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

      // 2. VERIFICAR si existen cuotas inactivas para este template
      const { data: cuotasExistentes, error: errorVerificarCuotas } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select('id, monto, fecha_estimada, descripcion, estado')
        .eq('egreso_id', cuotaActual.egreso_id)
        .eq('estado', 'pendiente') // Solo cuotas válidas, no anuladas

      if (errorVerificarCuotas) {
        throw new Error(`Error verificando cuotas existentes: ${errorVerificarCuotas.message}`)
      }

      const cuotasInactivas = cuotasExistentes?.filter(c => !c.estado?.includes('anual')) || []
      const tieneRegistroAnual = cuotasExistentes?.some(c => c.descripcion?.toLowerCase().includes('anual')) || false

      console.log(`🔍 Verificación cuotas template ${cuotaActual.egreso_id}:`)
      console.log(`- Total cuotas existentes: ${cuotasExistentes?.length || 0}`)
      console.log(`- Cuotas inactivas (no anual): ${cuotasInactivas.length}`)
      console.log(`- Tiene registro anual: ${tieneRegistroAnual}`)

      let templateCreado = false
      let templateCuotasId = cuotaActual.egreso_id

      // Si el template actual ES de pago anual, decidir entre reactivar o crear
      if (cuotaActual.egreso?.pago_anual) {
        // CASO A: Existen cuotas inactivas → REACTIVAR (no pedir datos)
        if (cuotasInactivas.length > 0) {
          console.log(`✅ REACTIVANDO ${cuotasInactivas.length} cuotas existentes`)
          
          // Cambiar template a modo cuotas
          const { error: errorCambiarTemplate } = await supabase
            .from('egresos_sin_factura')
            .update({ pago_anual: false })
            .eq('id', cuotaActual.egreso_id)

          if (errorCambiarTemplate) {
            throw new Error(`Error cambiando template a cuotas: ${errorCambiarTemplate.message}`)
          }

          // Reactivar cuotas inactivas (cambiar estado si es necesario)
          // Por ahora las cuotas inactivas estarán en estado 'pendiente' pero con template inactivo
          // Al cambiar template a activo, las cuotas se mostrarán automáticamente

          templateCreado = false // No se creó template nuevo
          templateCuotasId = cuotaActual.egreso_id

        } else {
          // CASO B: NO existen cuotas → CREAR nuevas (pedir datos en modal)
          console.log(`🔄 NO hay cuotas existentes → creando nuevas`)
          
          // Cambiar template a modo cuotas
          const { error: errorCambiarTemplate } = await supabase
            .from('egresos_sin_factura')
            .update({ 
              pago_anual: false,
              tipo_recurrencia: 'cuotas_especificas',
              nombre_referencia: cuotaActual.egreso?.nombre_referencia?.replace(' (Anual)', '') || cuotaActual.egreso?.nombre_referencia
            })
            .eq('id', cuotaActual.egreso_id)

          if (errorCambiarTemplate) {
            throw new Error(`Error cambiando template a cuotas: ${errorCambiarTemplate.message}`)
          }

          templateCreado = false // Reutilizamos template existente
          templateCuotasId = cuotaActual.egreso_id
        }

        // Desactivar registro anual si existe (NO eliminar)
        if (tieneRegistroAnual) {
          const { error: errorDesactivarAnual } = await supabase
            .from('cuotas_egresos_sin_factura')
            .update({ estado: 'inactivo' })
            .eq('egreso_id', cuotaActual.egreso_id)
            .ilike('descripcion', '%anual%')

          if (errorDesactivarAnual) {
            console.warn('Warning: No se pudo desactivar registro anual:', errorDesactivarAnual.message)
          } else {
            console.log('✅ Registro anual desactivado correctamente')
          }
        }

        // Reactivar cuotas inactivas si existen
        if (cuotasInactivas.length > 0) {
          const { error: errorReactivarCuotas } = await supabase
            .from('cuotas_egresos_sin_factura')
            .update({ estado: 'pendiente' })
            .eq('egreso_id', cuotaActual.egreso_id)
            .in('id', cuotasInactivas.map(c => c.id))

          if (errorReactivarCuotas) {
            console.warn('Warning: No se pudo reactivar cuotas:', errorReactivarCuotas.message)
          } else {
            console.log(`✅ ${cuotasInactivas.length} cuotas reactivadas correctamente`)
          }
        }

      } else {
        // Si ya es template de cuotas, solo reactivar
        const { error: errorReactivar } = await supabase
          .from('egresos_sin_factura')
          .update({ 
            activo: true,
            pago_anual: false,
            monto_anual: null,
            fecha_pago_anual: null
          })
          .eq('id', cuotaActual.egreso_id)

        if (errorReactivar) {
          throw new Error(`Error reactivando template: ${errorReactivar.message}`)
        }
      }

      // 3. SOLO crear cuotas si NO existen cuotas previas
      let cuotasCreadas = 0
      
      if (cuotasInactivas.length === 0) {
        console.log(`🆕 CREANDO nuevas cuotas (no existían)`)
        
        // Crear primera cuota
        const { data: primeraCuota, error: errorPrimeraCuota } = await supabase
          .from('cuotas_egresos_sin_factura')
          .insert({
            egreso_id: templateCuotasId,
            fecha_estimada: config.fechaPrimeraCuota,
            fecha_vencimiento: config.fechaPrimeraCuota,
            monto: config.montoPorCuota,
            descripcion: 'Cuota 1',
            estado: 'pendiente'
          })
          .select()
          .single()

        if (errorPrimeraCuota) {
          throw new Error(`Error creando primera cuota: ${errorPrimeraCuota.message}`)
        }

        // 4. Crear las cuotas adicionales (si se necesitan más de 1)
        if (config.numeroCuotas > 1) {
          const nuevasCuotas = []
          
          for (let i = 2; i <= config.numeroCuotas; i++) {
            // Calcular fecha de cada cuota
            const fechaCuota = new Date(config.fechaPrimeraCuota)
            fechaCuota.setMonth(fechaCuota.getMonth() + (i - 1) * config.frecuenciaMeses)
            const fechaCuotaStr = fechaCuota.toISOString().split('T')[0]
            
            nuevasCuotas.push({
              fecha_estimada: fechaCuotaStr,
              fecha_vencimiento: fechaCuotaStr,
              monto: config.montoPorCuota,
              descripcion: `Cuota ${i}`,
              estado: 'pendiente'
            })
          }

          // Insertar todas las nuevas cuotas en el template correcto
          const { error: errorInsert } = await supabase
            .from('cuotas_egresos_sin_factura')
            .insert(nuevasCuotas.map(cuota => ({
              ...cuota,
              egreso_id: templateCuotasId
            })))

          if (errorInsert) {
            throw new Error(`Error creando nuevas cuotas: ${errorInsert.message}`)
          }

          cuotasCreadas = nuevasCuotas.length + 1 // +1 por la primera cuota
        } else {
          cuotasCreadas = 1 // Solo la primera cuota
        }
        
      } else {
        console.log(`♻️ REACTIVANDO ${cuotasInactivas.length} cuotas existentes (no crear nuevas)`)
        cuotasCreadas = cuotasInactivas.length
      }

      const result: PagoCuotasResult = {
        success: true,
        cuotasCreadas,
        templateReactivado: !templateCreado, // Solo true si se reactivó existente
        templateCreado
      }
      
      setLastResult(result)
      return result

    } catch (error) {
      const result: PagoCuotasResult = {
        success: false,
        cuotasCreadas: 0,
        templateReactivado: false,
        templateCreado: false,
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
    templateNombre: string
  ): Promise<{ 
    confirmed: boolean 
    montoPorCuota?: number
    numeroCuotas?: number
    fechaPrimeraCuota?: string
    frecuenciaMeses?: number
  }> => {
    return new Promise(async (resolve) => {
      
      // PRIMERO: Verificar si existen cuotas inactivas
      const { data: cuotaActual } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select('egreso_id')
        .eq('id', cuotaId)
        .single()

      if (!cuotaActual) {
        resolve({ confirmed: false })
        return
      }

      const { data: cuotasExistentes } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select('id, monto, fecha_estimada, descripcion')
        .eq('egreso_id', cuotaActual.egreso_id)
        .eq('estado', 'pendiente')

      const cuotasInactivas = cuotasExistentes?.filter(c => !c.descripcion?.toLowerCase().includes('anual')) || []

      // CASO A: Cuotas existentes → Modal simple de confirmación
      if (cuotasInactivas.length > 0) {
        const confirmar = window.confirm(
          `🔄 REACTIVAR CUOTAS EXISTENTES - ${templateNombre}\n\n` +
          `Se encontraron ${cuotasInactivas.length} cuotas inactivas:\n` +
          cuotasInactivas.map((c, i) => `• Cuota ${i+1}: $${c.monto?.toLocaleString('es-AR')} - ${c.fecha_estimada}`).join('\n') + `\n\n` +
          `¿Desea reactivar estas cuotas y cambiar a modo cuotas?`
        )

        resolve({ 
          confirmed: confirmar,
          // Valores dummy para compatibilidad (no se usarán)
          montoPorCuota: confirmar ? 1 : undefined,
          numeroCuotas: confirmar ? cuotasInactivas.length : undefined,
          fechaPrimeraCuota: confirmar ? cuotasInactivas[0]?.fecha_estimada : undefined,
          frecuenciaMeses: confirmar ? 1 : undefined
        })
        return
      }

      // CASO B: NO hay cuotas existentes → Modal completo pidiendo datos
      const montoIngresado = window.prompt(
        `🔄 CONVERTIR A CUOTAS - ${templateNombre}\n\n` +
        `No se encontraron cuotas existentes. Se crearán nuevas cuotas.\n\n` +
        `Ingrese el monto por cuota:`
      )

      if (montoIngresado === null) {
        resolve({ confirmed: false })
        return
      }

      const montoPorCuota = parseFloat(montoIngresado.replace(/[,.]/g, ''))
      
      if (isNaN(montoPorCuota) || montoPorCuota <= 0) {
        alert('Monto inválido. Operación cancelada.')
        resolve({ confirmed: false })
        return
      }

      // Solicitar número de cuotas
      const cuotasIngresadas = window.prompt(
        `📊 NÚMERO DE CUOTAS - ${templateNombre}\n\n` +
        `Monto por cuota: $${montoPorCuota.toLocaleString('es-AR')}\n\n` +
        `Ingrese el número de cuotas (ej: 12):`
      )

      if (cuotasIngresadas === null) {
        resolve({ confirmed: false })
        return
      }

      const numeroCuotas = parseInt(cuotasIngresadas)
      
      if (isNaN(numeroCuotas) || numeroCuotas < 1 || numeroCuotas > 120) {
        alert('Número de cuotas inválido (1-120). Operación cancelada.')
        resolve({ confirmed: false })
        return
      }

      // Solicitar fecha primera cuota
      const fechaIngresada = window.prompt(
        `📅 FECHA PRIMERA CUOTA - ${templateNombre}\n\n` +
        `Monto: $${montoPorCuota.toLocaleString('es-AR')} x ${numeroCuotas} cuotas\n` +
        `Total: $${(montoPorCuota * numeroCuotas).toLocaleString('es-AR')}\n\n` +
        `Ingrese la fecha de la primera cuota (YYYY-MM-DD):`
      )

      if (fechaIngresada === null) {
        resolve({ confirmed: false })
        return
      }

      if (!fechaIngresada.match(/^\d{4}-\d{2}-\d{2}$/) || !Date.parse(fechaIngresada)) {
        alert('Fecha inválida. Use formato YYYY-MM-DD. Operación cancelada.')
        resolve({ confirmed: false })
        return
      }

      // Solicitar frecuencia
      const frecuencias = [
        { valor: 1, label: "Mensual (cada mes)" },
        { valor: 3, label: "Trimestral (cada 3 meses)" },
        { valor: 6, label: "Semestral (cada 6 meses)" },
        { valor: 12, label: "Anual (cada 12 meses)" }
      ]

      const opcionesFrecuencia = frecuencias.map((f, i) => `${i + 1}. ${f.label}`).join('\n')
      const frecuenciaSeleccionada = window.prompt(
        `⏰ FRECUENCIA DE CUOTAS - ${templateNombre}\n\n` +
        `${opcionesFrecuencia}\n\n` +
        `Seleccione una opción (1-4):`
      )

      if (frecuenciaSeleccionada === null) {
        resolve({ confirmed: false })
        return
      }

      const indice = parseInt(frecuenciaSeleccionada) - 1
      if (indice < 0 || indice >= frecuencias.length) {
        alert('Opción inválida. Operación cancelada.')
        resolve({ confirmed: false })
        return
      }

      const frecuenciaMeses = frecuencias[indice].valor

      // Confirmación final
      const confirmar = window.confirm(
        `¿Confirma conversión a esquema de cuotas?\n\n` +
        `• Monto por cuota: $${montoPorCuota.toLocaleString('es-AR')}\n` +
        `• Número de cuotas: ${numeroCuotas}\n` +
        `• Frecuencia: ${frecuencias[indice].label}\n` +
        `• Primera cuota: ${fechaIngresada}\n` +
        `• Total: $${(montoPorCuota * numeroCuotas).toLocaleString('es-AR')}\n` +
        `• Se creará/actualizará template de cuotas\n` +
        `• Se desactivará template anual\n\n` +
        `⚠️ El template anual original quedará inactivo`
      )

      resolve({ 
        confirmed: confirmar,
        montoPorCuota: confirmar ? montoPorCuota : undefined,
        numeroCuotas: confirmar ? numeroCuotas : undefined,
        fechaPrimeraCuota: confirmar ? fechaIngresada : undefined,
        frecuenciaMeses: confirmar ? frecuenciaMeses : undefined
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