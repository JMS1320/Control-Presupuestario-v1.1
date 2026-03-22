"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useMultiCashFlowData } from "./useMultiCashFlowData"
import { useReglasConciliacion } from "./useReglasConciliacion"
import { ReglaConciliacion, MovimientoBancario, ResultadoConciliacion } from "@/types/conciliacion"

// Configuración de cuentas bancarias
export interface CuentaBancaria {
  id: string
  nombre: string
  tabla_bd: string
  empresa: 'MSA' | 'PAM'
  activa: boolean
}

export const CUENTAS_BANCARIAS: CuentaBancaria[] = [
  {
    id: 'msa_galicia',
    nombre: 'MSA Galicia CC Pesos',
    tabla_bd: 'msa_galicia',
    empresa: 'MSA',
    activa: true
  },
  {
    id: 'pam_galicia',
    nombre: 'PAM Galicia CA Pesos',
    tabla_bd: 'pam_galicia',
    empresa: 'PAM',
    activa: true
  },
  {
    id: 'pam_galicia_cc',
    nombre: 'PAM Galicia CC Pesos',
    tabla_bd: 'pam_galicia_cc',
    empresa: 'PAM',
    activa: true
  }
]

export function useMotorConciliacion() {
  const [procesoEnCurso, setProcesoEnCurso] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultados, setResultados] = useState<any>(null)

  const { data: cashFlowData } = useMultiCashFlowData()
  const { cargarReglasActivas } = useReglasConciliacion()

  // Función para obtener movimientos bancarios de una cuenta específica
  const obtenerMovimientosBancarios = async (cuenta: CuentaBancaria): Promise<MovimientoBancario[]> => {
    try {
      console.log(`🏦 Cargando movimientos de ${cuenta.tabla_bd}...`)
      
      // Todas las tablas de extractos bancarios están en el schema public
      let query = supabase.from(cuenta.tabla_bd).select('*').eq('estado', 'Pendiente')
      
      const { data, error } = await query.order('fecha', { ascending: true })

      if (error) {
        console.error(`Error cargando ${cuenta.tabla_bd}:`, error)
        throw new Error(`Error al cargar movimientos de ${cuenta.nombre}: ${error.message}`)
      }

      console.log(`📊 ${cuenta.tabla_bd}: ${data?.length || 0} movimientos`)
      return data || []

    } catch (error) {
      console.error(`Error en obtenerMovimientosBancarios para ${cuenta.nombre}:`, error)
      throw error
    }
  }

  // Función para evaluar si una regla hace match con un movimiento
  const evaluarRegla = (movimiento: MovimientoBancario, regla: ReglaConciliacion): boolean => {
    try {
      let valorCampo = ''
      
      // Obtener valor del campo a evaluar
      switch (regla.columna_busqueda) {
        case 'descripcion':
          valorCampo = movimiento.descripcion || ''
          break
        case 'cuit':
          // Buscar en diferentes campos que puedan contener CUIT
          valorCampo = movimiento.numero_de_comprobante || movimiento.observaciones_cliente || ''
          break
        case 'monto_debito':
          valorCampo = String(movimiento.debitos || 0)
          break
        case 'monto_credito':
          valorCampo = String(movimiento.creditos || 0)
          break
        default:
          return false
      }

      // Evaluar según tipo de match
      const valorCampoLower = valorCampo.toLowerCase()
      const textoReglaLower = regla.texto_buscar.toLowerCase()

      switch (regla.tipo_match) {
        case 'exacto':
          return valorCampoLower === textoReglaLower
        case 'contiene':
          return valorCampoLower.includes(textoReglaLower)
        case 'inicia_con':
          return valorCampoLower.startsWith(textoReglaLower)
        case 'termina_con':
          return valorCampoLower.endsWith(textoReglaLower)
        default:
          return false
      }
    } catch (error) {
      console.error('Error evaluando regla:', error)
      return false
    }
  }

  // Función para buscar match en Cash Flow
  const buscarMatchCashFlow = (movimiento: MovimientoBancario): any => {
    const toleranciaDias = 5
    const fechaMovimiento = new Date(movimiento.fecha)
    
    // Buscar por débitos
    if (movimiento.debitos > 0) {
      const match = cashFlowData.find(cf => {
        if (cf.debitos !== movimiento.debitos) return false
        
        const fechaCF = new Date(cf.fecha_estimada)
        const diferenciaMs = Math.abs(fechaMovimiento.getTime() - fechaCF.getTime())
        const diferenciaDias = diferenciaMs / (1000 * 60 * 60 * 24)
        
        return diferenciaDias <= toleranciaDias
      })
      
      if (match) {
        const fechaCF = new Date(match.fecha_estimada)
        const diferenciaMs = Math.abs(fechaMovimiento.getTime() - fechaCF.getTime())
        const diferenciaDias = diferenciaMs / (1000 * 60 * 60 * 24)
        
        // Si es fecha exacta (0 días) → Conciliado automático
        // Si es fecha no exacta pero ≤5 días → Auditar
        const fechaExacta = diferenciaDias === 0
        
        return {
          match: true,
          cashFlowRow: match,
          requiere_revision: !fechaExacta,
          motivo_revision: fechaExacta ? null : `Fecha no exacta: ${Math.round(diferenciaDias)} días diferencia`
        }
      }
    }

    // Buscar por créditos
    if (movimiento.creditos > 0) {
      const match = cashFlowData.find(cf => {
        if (cf.creditos !== movimiento.creditos) return false
        
        const fechaCF = new Date(cf.fecha_estimada)
        const diferenciaMs = Math.abs(fechaMovimiento.getTime() - fechaCF.getTime())
        const diferenciaDias = diferenciaMs / (1000 * 60 * 60 * 24)
        
        return diferenciaDias <= toleranciaDias
      })
      
      if (match) {
        const fechaCF = new Date(match.fecha_estimada)
        const diferenciaMs = Math.abs(fechaMovimiento.getTime() - fechaCF.getTime())
        const diferenciaDias = diferenciaMs / (1000 * 60 * 60 * 24)
        
        // Si es fecha exacta (0 días) → Conciliado automático
        // Si es fecha no exacta pero ≤5 días → Auditar
        const fechaExacta = diferenciaDias === 0
        
        return {
          match: true,
          cashFlowRow: match,
          requiere_revision: !fechaExacta,
          motivo_revision: fechaExacta ? null : `Fecha no exacta: ${Math.round(diferenciaDias)} días diferencia`
        }
      }
    }

    return { match: false }
  }

  // Función principal de conciliación
  const ejecutarConciliacion = async (cuenta: CuentaBancaria) => {
    try {
      setProcesoEnCurso(true)
      setError(null)
      
      console.log(`🚀 Iniciando conciliación para ${cuenta.nombre}...`)

      // 1. Cargar datos
      const movimientos = await obtenerMovimientosBancarios(cuenta)
      const reglas = await cargarReglasActivas()
      
      console.log(`📊 Datos cargados:`)
      console.log(`- Movimientos bancarios: ${movimientos.length}`)
      console.log(`- Cash Flow: ${cashFlowData.length}`)
      console.log(`- Reglas activas: ${reglas.length}`)

      // 2. Procesar cada movimiento
      const resultadosProceso = {
        total_movimientos: movimientos.length,
        automaticos: 0,
        revision_manual: 0,
        sin_match: 0,
        errores: 0,
        detalles: [] as any[]
      }

      for (const movimiento of movimientos) {
        try {
          let resultado: ResultadoConciliacion = {
            movimiento_id: movimiento.id,
            tipo_match: 'sin_match',
            requiere_revision: false
          }

          // PASO 1: Intentar match con Cash Flow
          const matchCF = buscarMatchCashFlow(movimiento)
          if (matchCF.match) {
            resultado = {
              movimiento_id: movimiento.id,
              tipo_match: 'cash_flow',
              requiere_revision: matchCF.requiere_revision,
              categ_asignado: matchCF.cashFlowRow.categ,
              centro_costo_asignado: matchCF.cashFlowRow.centro_costo,
              detalle_asignado: matchCF.cashFlowRow.detalle
            }

            // Actualizar BD con datos del Cash Flow y estado según revisión
            const estadoFinal = matchCF.requiere_revision ? 'auditar' : 'conciliado'
            await actualizarMovimientoBD(cuenta, movimiento.id, {
              categ: matchCF.cashFlowRow.categ,
              centro_de_costo: matchCF.cashFlowRow.centro_costo,
              detalle: matchCF.cashFlowRow.detalle,
              estado: estadoFinal,
              motivo_revision: matchCF.motivo_revision
            })

            if (matchCF.requiere_revision) {
              resultadosProceso.revision_manual++
            } else {
              resultadosProceso.automaticos++
            }
            
            resultadosProceso.detalles.push(resultado)
            continue
          }

          // PASO 2-5: Aplicar reglas configurables
          let reglaAplicada = false
          for (const regla of reglas.sort((a, b) => a.orden - b.orden)) {
            if (evaluarRegla(movimiento, regla)) {
              resultado = {
                movimiento_id: movimiento.id,
                regla_aplicada: regla,
                tipo_match: 'regla',
                requiere_revision: false,
                categ_asignado: regla.categ,
                centro_costo_asignado: regla.centro_costo,
                detalle_asignado: regla.detalle
              }

              // Actualizar BD con datos de la regla y marcar como conciliado
              await actualizarMovimientoBD(cuenta, movimiento.id, {
                categ: regla.categ,
                centro_de_costo: regla.centro_costo,
                detalle: regla.detalle,
                estado: 'conciliado'
              })

              resultadosProceso.automaticos++
              reglaAplicada = true
              break
            }
          }

          if (!reglaAplicada) {
            resultadosProceso.sin_match++
          }

          resultadosProceso.detalles.push(resultado)

        } catch (error) {
          console.error(`Error procesando movimiento ${movimiento.id}:`, error)
          resultadosProceso.errores++
        }
      }

      console.log('✅ Conciliación completada:', resultadosProceso)
      setResultados(resultadosProceso)
      
      return resultadosProceso

    } catch (error) {
      console.error('Error en conciliación:', error)
      setError(error instanceof Error ? error.message : 'Error desconocido en conciliación')
      throw error
    } finally {
      setProcesoEnCurso(false)
    }
  }

  // Función para actualizar movimiento en BD
  const actualizarMovimientoBD = async (cuenta: CuentaBancaria, movimientoId: string, datos: any) => {
    try {
      // Todas las tablas de extractos bancarios están en el schema public
      let query = supabase.from(cuenta.tabla_bd).update(datos).eq('id', movimientoId)
      
      const { error } = await query

      if (error) {
        console.error(`Error actualizando movimiento ${movimientoId}:`, error)
        throw error
      }

    } catch (error) {
      console.error('Error en actualizarMovimientoBD:', error)
      throw error
    }
  }

  return {
    procesoEnCurso,
    error,
    resultados,
    ejecutarConciliacion,
    cuentasDisponibles: CUENTAS_BANCARIAS.filter(c => c.activa)
  }
}