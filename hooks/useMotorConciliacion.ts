"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useMultiCashFlowData } from "./useMultiCashFlowData"
import { useReglasConciliacion } from "./useReglasConciliacion"
import { ReglaConciliacion, MovimientoBancario, ResultadoConciliacion } from "@/types/conciliacion"

// Configuración de cuentas bancarias y cajas
export interface CuentaBancaria {
  id: string
  nombre: string
  tabla_bd: string
  schema_bd?: string   // 'public' (default) | 'msa'
  empresa: 'MSA' | 'PAM'
  activa: boolean
  tipo?: 'banco' | 'caja'
}

export const CUENTAS_BANCARIAS: CuentaBancaria[] = [
  {
    id: 'msa_galicia',
    nombre: 'MSA Galicia CC Pesos',
    tabla_bd: 'msa_galicia',
    empresa: 'MSA',
    activa: true,
    tipo: 'banco'
  },
  {
    id: 'pam_galicia',
    nombre: 'PAM Galicia CA Pesos',
    tabla_bd: 'pam_galicia',
    empresa: 'PAM',
    activa: true,
    tipo: 'banco'
  },
  {
    id: 'pam_galicia_cc',
    nombre: 'PAM Galicia CC Pesos',
    tabla_bd: 'pam_galicia_cc',
    empresa: 'PAM',
    activa: true,
    tipo: 'banco'
  },
  {
    id: 'caja_general',
    nombre: 'Caja General MSA',
    tabla_bd: 'caja_general',
    schema_bd: 'msa',
    empresa: 'MSA',
    activa: true,
    tipo: 'caja'
  },
  {
    id: 'caja_ams',
    nombre: 'Caja AMS MSA',
    tabla_bd: 'caja_ams',
    schema_bd: 'msa',
    empresa: 'MSA',
    activa: true,
    tipo: 'caja'
  },
  {
    id: 'caja_sigot',
    nombre: 'Caja Sigot MSA',
    tabla_bd: 'caja_sigot',
    schema_bd: 'msa',
    empresa: 'MSA',
    activa: true,
    tipo: 'caja'
  }
]

export function useMotorConciliacion() {
  const [procesoEnCurso, setProcesoEnCurso] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultados, setResultados] = useState<any>(null)

  const { data: cashFlowData } = useMultiCashFlowData()
  const { cargarReglasActivas } = useReglasConciliacion()

  // Helper: valor contable/interno es válido si no está vacío ni es "No Lleva"
  const esValorContableValido = (val: string | null | undefined): boolean => {
    if (!val || val.trim() === '') return false
    return !val.toLowerCase().replace(/\s+/g, '').includes('nolleva')
  }

  // Helper: determina si un template debe aplicar contable/interno según su seccion_regla
  // seccion_regla=1 → siempre aplica
  // seccion_regla=2 → solo si empresa pagadora ≠ responsable del template
  const debeAplicarCodigos = (tmpl: { seccion_regla?: number | null; responsable?: string | null }, cuenta: CuentaBancaria): boolean => {
    if (!tmpl.seccion_regla) return false
    if (tmpl.seccion_regla === 1) return true
    if (tmpl.seccion_regla === 2) {
      const empresa = cuenta.empresa.toLowerCase()
      const resp = (tmpl.responsable || '').toLowerCase()
      return empresa !== resp
    }
    return false
  }

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
      const reglas = await cargarReglasActivas(cuenta.id)
      
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
            const extraIdsCF: any = {}
            if (matchCF.cashFlowRow.origen === 'TEMPLATE') {
              if (matchCF.cashFlowRow.egreso_id) extraIdsCF.template_id = matchCF.cashFlowRow.egreso_id
              extraIdsCF.template_cuota_id = matchCF.cashFlowRow.id
            } else if (matchCF.cashFlowRow.origen === 'ARCA') {
              extraIdsCF.comprobante_arca_id = matchCF.cashFlowRow.id
            }
            // Obtener contable/interno: prioridad 1 = regla que matchee, prioridad 2 = seccion_regla del template
            const extraCF: any = {}
            const reglaQueMatcheaF1 = reglas.find(r => evaluarRegla(movimiento, r))
            if (reglaQueMatcheaF1 && (esValorContableValido(reglaQueMatcheaF1.codigo_contable) || esValorContableValido(reglaQueMatcheaF1.codigo_interno))) {
              // Prioridad 1: usar códigos de la regla (específicos por cuenta bancaria)
              if (esValorContableValido(reglaQueMatcheaF1.codigo_contable)) extraCF.contable = reglaQueMatcheaF1.codigo_contable
              if (esValorContableValido(reglaQueMatcheaF1.codigo_interno)) extraCF.interno = reglaQueMatcheaF1.codigo_interno
            } else if (matchCF.cashFlowRow.origen === 'TEMPLATE' && matchCF.cashFlowRow.egreso_id) {
              // Prioridad 2: fallback a seccion_regla del template
              const { data: tmplData } = await supabase
                .from('egresos_sin_factura')
                .select('codigo_contable, codigo_interno, seccion_regla, responsable')
                .eq('id', matchCF.cashFlowRow.egreso_id)
                .maybeSingle()
              if (tmplData && debeAplicarCodigos(tmplData as any, cuenta)) {
                const td = tmplData as any
                if (esValorContableValido(td.codigo_contable)) extraCF.contable = td.codigo_contable
                if (esValorContableValido(td.codigo_interno)) extraCF.interno = td.codigo_interno
              }
            }
            await actualizarMovimientoBD(cuenta, movimiento.id, {
              categ: matchCF.cashFlowRow.categ,
              centro_de_costo: matchCF.cashFlowRow.centro_costo,
              detalle: matchCF.cashFlowRow.detalle,
              estado: estadoFinal,
              motivo_revision: matchCF.motivo_revision,
              ...extraIdsCF,
              ...extraCF
            })

            // Actualizar estado de la cuota/factura origen si el match fue definitivo
            if (estadoFinal === 'conciliado') {
              if (matchCF.cashFlowRow.origen === 'TEMPLATE') {
                await supabase
                  .from('cuotas_egresos_sin_factura')
                  .update({ estado: 'conciliado' })
                  .eq('id', matchCF.cashFlowRow.id)
              } else if (matchCF.cashFlowRow.origen === 'ARCA') {
                await supabase
                  .from('comprobantes_arca')
                  .update({ estado: 'conciliado' })
                  .eq('id', matchCF.cashFlowRow.id)
                  .schema('msa')
              }
            }

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
                centro_costo_asignado: regla.centro_costo ?? undefined,
                detalle_asignado: regla.detalle
              }

              // Códigos contables: prioridad 1 = campos de la regla, prioridad 2 = seccion_regla del template
              const codigosRegla: any = {}
              if (esValorContableValido(regla.codigo_contable)) codigosRegla.contable = regla.codigo_contable
              if (esValorContableValido(regla.codigo_interno)) codigosRegla.interno = regla.codigo_interno

              // Actualizar extracto con categ/detalle/estado y códigos de la regla (si tiene)
              await actualizarMovimientoBD(cuenta, movimiento.id, {
                categ: regla.categ,
                centro_de_costo: regla.centro_costo,
                detalle: regla.detalle,
                estado: 'conciliado',
                ...codigosRegla
              })

              // Si la regla tiene llena_template=true, crear cuota en el template correspondiente
              if (regla.llena_template) {
                const cuotaResult = await crearCuotaEnTemplate(cuenta, regla, movimiento)
                if (cuotaResult) {
                  const extraRegla: any = {}
                  // Solo usar códigos del template como fallback si la regla no tenía códigos propios
                  if (!codigosRegla.contable && cuotaResult.contable) extraRegla.contable = cuotaResult.contable
                  if (!codigosRegla.interno && cuotaResult.interno) extraRegla.interno = cuotaResult.interno
                  await actualizarMovimientoBD(cuenta, movimiento.id, {
                    template_id: cuotaResult.templateId,
                    template_cuota_id: cuotaResult.cuotaId,
                    ...extraRegla
                  })
                }
              }

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

  // Crear cuota en template cuando una regla con llena_template=true hace match
  const crearCuotaEnTemplate = async (
    cuenta: CuentaBancaria,
    regla: ReglaConciliacion,
    movimiento: MovimientoBancario
  ): Promise<{ templateId: string; cuotaId: string; contable?: string; interno?: string } | null> => {
    try {
      // Buscar templates activos con categ coincidente
      const { data: templates } = await supabase
        .from('egresos_sin_factura')
        .select('id, responsable, codigo_contable, codigo_interno, seccion_regla')
        .eq('categ', regla.categ)
        .eq('activo', true)

      if (!templates || templates.length === 0) {
        console.warn(`⚠️ No hay template activo con categ "${regla.categ}" — cuota no creada`)
        return null
      }

      // Si hay varios (ej: FCI MSA + PAM), elegir el que corresponde a la empresa de la cuenta
      let template = templates[0]
      if (templates.length > 1) {
        const coincide = templates.find(t =>
          t.responsable?.toLowerCase().includes(cuenta.empresa.toLowerCase())
        )
        if (coincide) template = coincide
      }

      // Determinar tipo_movimiento y monto desde el extracto
      const tipoMovimiento = movimiento.debitos > 0 ? 'egreso' : 'ingreso'
      const monto = movimiento.debitos > 0 ? movimiento.debitos : movimiento.creditos

      // Crear cuota con estado conciliado directamente
      const { data: cuota, error } = await supabase
        .from('cuotas_egresos_sin_factura')
        .insert({
          egreso_id: template.id,
          fecha_vencimiento: movimiento.fecha,
          fecha_estimada: movimiento.fecha,
          monto,
          estado: 'conciliado',
          tipo_movimiento: tipoMovimiento,
          descripcion: regla.detalle || movimiento.descripcion
        })
        .select('id')
        .single()

      if (error) {
        console.error('Error creando cuota en template:', error)
        return null
      }

      console.log(`✅ Cuota creada en template "${regla.categ}" (${tipoMovimiento} $${monto})`)
      const t = template as any
      const aplicar = debeAplicarCodigos(t, cuenta)
      return {
        templateId: template.id,
        cuotaId: cuota.id,
        ...(aplicar && esValorContableValido(t.codigo_contable) && { contable: t.codigo_contable }),
        ...(aplicar && esValorContableValido(t.codigo_interno) && { interno: t.codigo_interno })
      }

    } catch (err) {
      console.error('Error en crearCuotaEnTemplate:', err)
      return null
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