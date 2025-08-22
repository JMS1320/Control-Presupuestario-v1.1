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

      // 2. Verificar si ya existe un template de cuotas para este concepto
      let templateCreado = false
      let templateCuotasId = cuotaActual.egreso_id

      // Si el template actual ES de pago anual, crear uno nuevo de cuotas
      if (cuotaActual.egreso?.pago_anual) {
        // Crear template de cuotas basado en el template anual
        const { data: nuevoTemplateCuotas, error: errorCrearCuotas } = await supabase
          .from('egresos_sin_factura')
          .insert({
            template_master_id: cuotaActual.egreso?.template_master_id,
            categ: cuotaActual.egreso?.categ,
            centro_costo: cuotaActual.egreso?.centro_costo,
            nombre_referencia: cuotaActual.egreso?.nombre_referencia?.replace(' (Anual)', ''),
            responsable: cuotaActual.egreso?.responsable,
            cuit_quien_cobra: cuotaActual.egreso?.cuit_quien_cobra,
            nombre_quien_cobra: cuotaActual.egreso?.nombre_quien_cobra,
            tipo_recurrencia: 'cuotas_especificas',
            activo: true,
            pago_anual: false,
            año: new Date().getFullYear()
          })
          .select()
          .single()

        if (errorCrearCuotas) {
          throw new Error(`Error creando template de cuotas: ${errorCrearCuotas.message}`)
        }

        templateCuotasId = nuevoTemplateCuotas.id
        templateCreado = true

        // Desactivar el template anual original
        const { error: errorDesactivarAnual } = await supabase
          .from('egresos_sin_factura')
          .update({ activo: false })
          .eq('id', cuotaActual.egreso_id)

        if (errorDesactivarAnual) {
          throw new Error(`Error desactivando template anual: ${errorDesactivarAnual.message}`)
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

      // 3. Crear/actualizar la primera cuota
      if (templateCreado) {
        // Crear primera cuota para el nuevo template
        const { data: primeraCuota, error: errorPrimeraCuota } = await supabase
          .from('cuotas_egresos_sin_factura')
          .insert({
            egreso_id: templateCuotasId,
            mes: new Date(config.fechaPrimeraCuota).getMonth() + 1,
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
      } else {
        // Actualizar la cuota actual existente
        const { error: errorUpdateActual } = await supabase
          .from('cuotas_egresos_sin_factura')
          .update({ 
            monto: config.montoPorCuota,
            fecha_estimada: config.fechaPrimeraCuota,
            fecha_vencimiento: config.fechaPrimeraCuota,
            descripcion: 'Cuota 1'
          })
          .eq('id', config.cuotaId)

        if (errorUpdateActual) {
          throw new Error(`Error actualizando cuota actual: ${errorUpdateActual.message}`)
        }
      }

      // 4. Crear las cuotas adicionales (si se necesitan más de 1)
      let cuotasCreadas = 0
      
      if (config.numeroCuotas > 1) {
        const nuevasCuotas = []
        
        for (let i = 2; i <= config.numeroCuotas; i++) {
          // Calcular fecha de cada cuota
          const fechaCuota = new Date(config.fechaPrimeraCuota)
          fechaCuota.setMonth(fechaCuota.getMonth() + (i - 1) * config.frecuenciaMeses)
          const fechaCuotaStr = fechaCuota.toISOString().split('T')[0]
          
          nuevasCuotas.push({
            mes: new Date(fechaCuotaStr).getMonth() + 1,
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

        cuotasCreadas = nuevasCuotas.length
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
    return new Promise((resolve) => {
      // Solicitar monto por cuota
      const montoIngresado = window.prompt(
        `🔄 CONVERTIR A CUOTAS - ${templateNombre}\n\n` +
        `Esta acción creará (o actualizará) un template de cuotas y desactivará el template anual.\n\n` +
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