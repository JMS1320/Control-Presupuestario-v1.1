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
  schema_bd?: string   // 'public' (default) | 'msa' | 'pam' | 'ma'
  empresa: 'MSA' | 'PAM' | 'MA'
  activa: boolean
  tipo?: 'banco' | 'caja' | 'tarjeta'
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
    id: 'ma_galicia',
    nombre: 'MA Galicia CA Pesos',
    tabla_bd: 'ma_galicia',
    schema_bd: 'ma',
    empresa: 'MA',
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
  },
  {
    id: 'tarjeta_visa_business_msa',
    nombre: 'VISA Business MSA',
    tabla_bd: 'tarjeta_visa_business',
    schema_bd: 'msa',
    empresa: 'MSA',
    activa: true,
    tipo: 'tarjeta'
  },
  {
    id: 'tarjeta_visa_pam',
    nombre: 'VISA PAM',
    tabla_bd: 'tarjeta_visa',
    schema_bd: 'pam',
    empresa: 'PAM',
    activa: true,
    tipo: 'tarjeta'
  },
  {
    id: 'tarjeta_visa_ma',
    nombre: 'VISA MA',
    tabla_bd: 'tarjeta_visa',
    schema_bd: 'ma',
    empresa: 'MA',
    activa: true,
    tipo: 'tarjeta'
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

  // Busca códigos contable/interno en reglas_contable_interno (Tab 2 — fuente primaria)
  // Prioridad: Tipo A (cuenta+template) → Tipo B (cuenta+responsable)
  const buscarCodigosContableInterno = async (
    cuentaId: string,
    templateId?: string | null,
    responsable?: string | null
  ): Promise<{ contable?: string; interno?: string }> => {
    // Tipo A: regla específica cuenta + template
    if (templateId) {
      const { data } = await supabase
        .from('reglas_contable_interno')
        .select('codigo_contable, codigo_interno')
        .eq('cuenta_bancaria_id', cuentaId)
        .eq('tipo_regla', 'especifica')
        .eq('template_id', templateId)
        .eq('activo', true)
        .maybeSingle()
      if (data) {
        const result: { contable?: string; interno?: string } = {}
        if (esValorContableValido(data.codigo_contable)) result.contable = data.codigo_contable!
        if (esValorContableValido(data.codigo_interno)) result.interno = data.codigo_interno!
        if (result.contable || result.interno) return result
      }
    }
    // Tipo B: regla responsable (cross-company)
    if (responsable) {
      const { data } = await supabase
        .from('reglas_contable_interno')
        .select('codigo_contable, codigo_interno')
        .eq('cuenta_bancaria_id', cuentaId)
        .eq('tipo_regla', 'responsable')
        .eq('responsable', responsable)
        .eq('activo', true)
        .maybeSingle()
      if (data) {
        const result: { contable?: string; interno?: string } = {}
        if (esValorContableValido(data.codigo_contable)) result.contable = data.codigo_contable!
        if (esValorContableValido(data.codigo_interno)) result.interno = data.codigo_interno!
        if (result.contable || result.interno) return result
      }
    }
    return {}
  }

  // Función para obtener movimientos bancarios de una cuenta específica
  const obtenerMovimientosBancarios = async (cuenta: CuentaBancaria): Promise<MovimientoBancario[]> => {
    try {
      console.log(`🏦 Cargando movimientos de ${cuenta.tabla_bd}...`)
      
      const clientSchema = cuenta.schema_bd && cuenta.schema_bd !== 'public' ? supabase.schema(cuenta.schema_bd) : supabase
      let query = clientSchema.from(cuenta.tabla_bd).select('*').eq('estado', 'pendiente')
      
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

  // Extraer CUIT válido de leyendas_adicionales_2 (si existe)
  const extraerCuitBancario = (movimiento: MovimientoBancario): string | null => {
    // El tipo dice leyendas_adicionales2 pero BD devuelve leyendas_adicionales_2
    const mov = movimiento as any
    const valor = (mov.leyendas_adicionales_2 || mov.leyendas_adicionales2 || '').trim()
    if (!valor) return null
    // CUIT argentino: exactamente 11 dígitos, prefijo válido
    if (!/^\d{11}$/.test(valor)) return null
    const prefijo = parseInt(valor.substring(0, 2))
    if ([20, 23, 24, 27, 30, 33, 34].includes(prefijo)) return valor
    return null
  }

  // Buscar nombre del proveedor en BBDD proveedores por CUIT
  const buscarNombreProveedor = async (cuit: string | null | undefined): Promise<string | null> => {
    if (!cuit) return null
    const cuitLimpio = cuit.replace(/[-\s]/g, '')
    if (!cuitLimpio) return null
    const { data } = await supabase
      .from('proveedores')
      .select('razon_social')
      .eq('cuit', cuitLimpio)
      .maybeSingle()
    return data?.razon_social || null
  }

  // Función para buscar match en Cash Flow
  const buscarMatchCashFlow = (movimiento: MovimientoBancario): any => {
    const toleranciaDias = 5
    const fechaMovimiento = new Date(movimiento.fecha)

    // Pre-filtro por haberes: si el banco indica acreditación de haberes, buscar solo sueldos
    const mov = movimiento as any
    const esHaberes = [movimiento.descripcion, mov.leyendas_adicionales_1, mov.leyendas_adicionales_2]
      .some(campo => campo && /haber/i.test(campo))

    // Pre-filtro por CUIT bancario: si el banco informa CUIT, buscar solo en ese proveedor
    const cuitBancario = extraerCuitBancario(movimiento)

    let pool: typeof cashFlowData
    if (esHaberes) {
      // Haberes → restringir a sueldos; si además hay CUIT, filtrar por ese empleado
      const sueldos = cashFlowData.filter(cf => cf.origen === 'SUELDO')
      pool = cuitBancario
        ? sueldos.filter(cf => cf.cuit_proveedor === cuitBancario)
        : sueldos
      // Fallback: si no encontró sueldos con ese CUIT, usar todos los sueldos
      if (pool.length === 0 && cuitBancario) pool = sueldos
    } else {
      const candidatos = cuitBancario
        ? cashFlowData.filter(cf => cf.cuit_proveedor === cuitBancario)
        : cashFlowData
      // Si hay CUIT pero no hay candidatos con ese CUIT, buscar en todo (fallback)
      pool = (cuitBancario && candidatos.length === 0) ? cashFlowData : candidatos
    }

    // Buscar por débitos
    if (movimiento.debitos > 0) {
      const match = pool.find(cf => {
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
      const match = pool.find(cf => {
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
              if (matchCF.cashFlowRow.nro_cuenta) extraIdsCF.nro_cuenta = matchCF.cashFlowRow.nro_cuenta
            } else if (matchCF.cashFlowRow.origen === 'SUELDO' && matchCF.cashFlowRow.origen_tabla === 'sueldos.pagos') {
              extraIdsCF.sueldo_pago_id = matchCF.cashFlowRow.id
            }
            // Obtener contable/interno: Tab2 TipoA→TipoB > Tab1 regla con código
            const extraCF: any = {}
            if (matchCF.cashFlowRow.origen === 'TEMPLATE' && matchCF.cashFlowRow.egreso_id) {
              // Consultar template solo para obtener responsable (para Tipo B)
              const { data: tmplData } = await supabase
                .from('egresos_sin_factura')
                .select('responsable')
                .eq('id', matchCF.cashFlowRow.egreso_id)
                .maybeSingle()

              // Prioridad 1: Tab 2 — reglas_contable_interno (Tipo A → Tipo B)
              const codigosTab2 = await buscarCodigosContableInterno(
                cuenta.id,
                matchCF.cashFlowRow.egreso_id,
                (tmplData as any)?.responsable
              )
              if (codigosTab2.contable) extraCF.contable = codigosTab2.contable
              if (codigosTab2.interno) extraCF.interno = codigosTab2.interno

              // Prioridad 2: Tab 1 — regla de texto que matchee y tenga código propio
              if (!extraCF.contable || !extraCF.interno) {
                const reglaQueMatcheaF1 = reglas.find(r => evaluarRegla(movimiento, r))
                if (reglaQueMatcheaF1) {
                  if (!extraCF.contable && esValorContableValido(reglaQueMatcheaF1.codigo_contable)) extraCF.contable = reglaQueMatcheaF1.codigo_contable
                  if (!extraCF.interno && esValorContableValido(reglaQueMatcheaF1.codigo_interno)) extraCF.interno = reglaQueMatcheaF1.codigo_interno
                }
              }
            } else if (matchCF.cashFlowRow.origen === 'SUELDO') {
              // SUELDO: buscar regla tipo empleado (Tipo C)
              const empleadoIdCF = matchCF.cashFlowRow.empleado_id
              if (empleadoIdCF) {
                const { data: reglaEmp } = await supabase
                  .from('reglas_contable_interno')
                  .select('codigo_contable, codigo_interno')
                  .eq('cuenta_bancaria_id', cuenta.id)
                  .eq('tipo_regla', 'empleado')
                  .eq('empleado_id', empleadoIdCF)
                  .eq('activo', true)
                  .maybeSingle()
                if (reglaEmp) {
                  if (esValorContableValido(reglaEmp.codigo_contable)) extraCF.contable = reglaEmp.codigo_contable!
                  if (esValorContableValido(reglaEmp.codigo_interno)) extraCF.interno = reglaEmp.codigo_interno!
                }
              }
              // Fallback: regla de texto con código propio
              if (!extraCF.contable || !extraCF.interno) {
                const reglaQueMatcheaF1 = reglas.find(r => evaluarRegla(movimiento, r))
                if (reglaQueMatcheaF1) {
                  if (!extraCF.contable && esValorContableValido(reglaQueMatcheaF1.codigo_contable)) extraCF.contable = reglaQueMatcheaF1.codigo_contable
                  if (!extraCF.interno && esValorContableValido(reglaQueMatcheaF1.codigo_interno)) extraCF.interno = reglaQueMatcheaF1.codigo_interno
                }
              }
            } else {
              // ARCA u otros orígenes: solo regla de texto con código propio
              const reglaQueMatcheaF1 = reglas.find(r => evaluarRegla(movimiento, r))
              if (reglaQueMatcheaF1) {
                if (esValorContableValido(reglaQueMatcheaF1.codigo_contable)) extraCF.contable = reglaQueMatcheaF1.codigo_contable
                if (esValorContableValido(reglaQueMatcheaF1.codigo_interno)) extraCF.interno = reglaQueMatcheaF1.codigo_interno
              }
            }
            // Si es template multi-cuenta sin categ asignada en la cuota → auditar
            const sinCateg = matchCF.cashFlowRow.origen === 'TEMPLATE' &&
              matchCF.cashFlowRow.es_multi_cuenta === true &&
              (!matchCF.cashFlowRow.categ || matchCF.cashFlowRow.categ === 'SIN_CATEG')
            const estadoFinalConCateg = sinCateg ? 'auditar' : estadoFinal
            const motivoFinal = sinCateg
              ? 'Sin categ: requiere asignación de cuenta contable'
              : matchCF.motivo_revision

            // Buscar nombre oficial del proveedor en BBDD proveedores
            const provNombreCF = await buscarNombreProveedor(matchCF.cashFlowRow.cuit_proveedor)

            // Si no tenemos nro_cuenta aún (match TEMPLATE), buscarlo en cuentas_contables
            if (!extraIdsCF.nro_cuenta && matchCF.cashFlowRow.categ && !sinCateg) {
              const { data: ccData } = await supabase
                .from('cuentas_contables')
                .select('nro_cuenta')
                .eq('categ', matchCF.cashFlowRow.categ)
                .maybeSingle()
              if (ccData?.nro_cuenta) extraIdsCF.nro_cuenta = ccData.nro_cuenta
            }

            await actualizarMovimientoBD(cuenta, movimiento.id, {
              categ: sinCateg ? null : matchCF.cashFlowRow.categ,
              centro_de_costo: matchCF.cashFlowRow.centro_costo,
              detalle: matchCF.cashFlowRow.detalle_usuario || null,
              estado: estadoFinalConCateg,
              motivo_revision: motivoFinal,
              proveedor_nombre: provNombreCF,
              comprobantes_pagados: matchCF.cashFlowRow.comprobante_display || null,
              ...extraIdsCF,
              ...extraCF
            })

            // Actualizar estado de la cuota/factura origen si el match fue definitivo
            if (estadoFinal === 'conciliado') {
              if (matchCF.cashFlowRow.origen === 'TEMPLATE') {
                const idsAConciliar = matchCF.cashFlowRow.ids_grupo && matchCF.cashFlowRow.ids_grupo.length > 0
                  ? matchCF.cashFlowRow.ids_grupo
                  : [matchCF.cashFlowRow.id]
                await supabase
                  .from('cuotas_egresos_sin_factura')
                  .update({ estado: 'conciliado' })
                  .in('id', idsAConciliar)
              } else if (matchCF.cashFlowRow.origen === 'ARCA') {
                const idsArcaConciliar = matchCF.cashFlowRow.ids_grupo && matchCF.cashFlowRow.ids_grupo.length > 0
                  ? matchCF.cashFlowRow.ids_grupo
                  : [matchCF.cashFlowRow.id]
                await supabase
                  .schema('msa')
                  .from('comprobantes_arca')
                  .update({ estado: 'conciliado' })
                  .in('id', idsArcaConciliar)
              } else if (matchCF.cashFlowRow.origen === 'SUELDO' && matchCF.cashFlowRow.origen_tabla === 'sueldos.pagos') {
                await supabase
                  .from('sueldos_pagos')
                  .update({ estado: 'conciliado' })
                  .eq('id', matchCF.cashFlowRow.id)
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

              // Anticipos: si la descripción contiene "anticipo", buscar registro y guardar anticipo_id
              const esAnticipo = /anticipo/i.test(movimiento.descripcion || '')
              let estadoRegla: string = 'conciliado'
              let motivoRegla: string | null = null
              let extraAnticipo: any = {}

              if (esAnticipo) {
                const montoMov = movimiento.debitos || movimiento.creditos || 0

                // Buscar anticipo por monto (cualquier estado no vinculado) para guardar anticipo_id
                const { data: anticiposMatch } = await supabase
                  .from('anticipos_proveedores')
                  .select('id, factura_id, descripcion, monto, nombre_proveedor, estado, estado_pago, nro_cuenta')
                  .in('estado', ['pendiente_vincular', 'parcial'])
                  .order('fecha_pago', { ascending: true })

                // Match por monto (tolerancia 1% o $1)
                const match = (anticiposMatch || []).find((a: any) => {
                  const diff = Math.abs(a.monto - montoMov)
                  return diff < montoMov * 0.01 || diff < 1
                })

                if (match) {
                  // Siempre guardar anticipo_id para trazabilidad
                  extraAnticipo.anticipo_id = match.id

                  // Si el anticipo trae nro_cuenta, buscar categ correspondiente
                  let categAnticipo: string | null = null
                  if (match.nro_cuenta) {
                    const { data: cta } = await supabase
                      .from('cuentas_contables')
                      .select('categ')
                      .eq('nro_cuenta', match.nro_cuenta)
                      .single()
                    categAnticipo = cta?.categ || null
                  }

                  if (match.factura_id) {
                    // Anticipo ya vinculado a FC → conciliar con datos de la FC
                    const { data: fc } = await supabase
                      .schema('msa')
                      .from('comprobantes_arca')
                      .select('id, categ, nro_cuenta, denominacion_emisor, tipo_comprobante, numero_desde')
                      .eq('id', match.factura_id)
                      .single()

                    if (fc) {
                      const esParcial = match.estado === 'parcial'
                      estadoRegla = 'conciliado'
                      extraAnticipo.comprobante_arca_id = fc.id
                      // C2: si el anticipo tiene cuenta y difiere de la FC, gana la del anticipo (también categ)
                      const cuentaPropag = match.nro_cuenta || fc.nro_cuenta
                      if (cuentaPropag) extraAnticipo.nro_cuenta = cuentaPropag
                      // categ coincidente con la cuenta ganadora
                      extraAnticipo.categ = (match.nro_cuenta ? categAnticipo : fc.categ) || regla.categ
                      extraAnticipo.detalle = match.descripcion || null
                      // FC number for comprobantes_pagados
                      const abrevFC = [1,6,11,51,201,206,211].includes(fc.tipo_comprobante) ? 'FC'
                        : [2,7,12,52,202,207,212].includes(fc.tipo_comprobante) ? 'ND'
                        : [3,8,13,53,203,208,213].includes(fc.tipo_comprobante) ? 'NC' : 'FC'
                      extraAnticipo.comprobante_display = `${abrevFC} - ${fc.numero_desde || ''}`

                      // Anticipo → vinculado + conciliado en banco
                      await supabase
                        .from('anticipos_proveedores')
                        .update({ estado: 'vinculado', estado_pago: 'conciliado' })
                        .eq('id', match.id)
                    }
                  } else {
                    // Anticipo sin FC → auditar, pero guardamos anticipo_id para cuando se vincule
                    estadoRegla = 'auditar'
                    motivoRegla = 'Anticipo: requiere vinculación con factura ARCA'
                    extraAnticipo.detalle = match.descripcion || null
                    // Si el anticipo trae cuenta contable, propagar al extracto (cuenta + categ)
                    if (match.nro_cuenta) {
                      extraAnticipo.nro_cuenta = match.nro_cuenta
                      if (categAnticipo) extraAnticipo.categ = categAnticipo
                    }
                    // Marcar anticipo como conciliado en banco (ya salió el dinero)
                    await supabase
                      .from('anticipos_proveedores')
                      .update({ estado_pago: 'conciliado' })
                      .eq('id', match.id)
                  }
                } else {
                  // No encontró anticipo en BD → auditar para revisión manual
                  estadoRegla = 'auditar'
                  motivoRegla = 'Anticipo detectado sin registro en BD'
                }
              }

              // Buscar nombre proveedor en BBDD: por CUIT bancario o por CUIT del anticipo
              const cuitRegla = extraAnticipo.cuit || extraerCuitBancario(movimiento)
              const provNombreRegla = await buscarNombreProveedor(cuitRegla)

              // Actualizar extracto con categ/detalle/estado y códigos de la regla
              await actualizarMovimientoBD(cuenta, movimiento.id, {
                categ: extraAnticipo.categ || regla.categ,
                centro_de_costo: regla.centro_costo,
                detalle: extraAnticipo.detalle || null,
                estado: estadoRegla,
                motivo_revision: motivoRegla,
                proveedor_nombre: provNombreRegla,
                comprobantes_pagados: extraAnticipo.comprobante_display || null,
                comprobante_arca_id: extraAnticipo.comprobante_arca_id || null,
                anticipo_id: extraAnticipo.anticipo_id || null,
                nro_cuenta: extraAnticipo.nro_cuenta || null,
                ...codigosRegla
              })

              // Si la regla tiene llena_template=true, crear cuota en el template correspondiente
              if (regla.llena_template) {
                const cuotaResult = await crearCuotaEnTemplate(cuenta, regla, movimiento)
                if (cuotaResult) {
                  // Prioridad: Tab 2 (Tipo A→B) > Tab 1 (codigosRegla ya aplicados) > seccion_regla (cuotaResult)
                  const codigosTab2F2 = await buscarCodigosContableInterno(
                    cuenta.id,
                    cuotaResult.templateId,
                    cuotaResult.responsable
                  )
                  const extraRegla: any = {}
                  if (codigosTab2F2.contable) extraRegla.contable = codigosTab2F2.contable
                  if (codigosTab2F2.interno) extraRegla.interno = codigosTab2F2.interno

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
  ): Promise<{ templateId: string; cuotaId: string; responsable?: string | null } | null> => {
    try {
      // Buscar templates activos con categ coincidente
      const { data: templates } = await supabase
        .from('egresos_sin_factura')
        .select('id, responsable, solo_conciliacion')
        .eq('categ', regla.categ)
        .eq('activo', true)

      if (!templates || templates.length === 0) {
        console.warn(`⚠️ No hay template activo con categ "${regla.categ}" — cuota no creada`)
        return null
      }

      // Templates bancarios genéricos (solo_conciliacion=true): el banco define la empresa.
      // Filtro estricto — si no existe template con responsable de la empresa de la cuenta, NO crear cuota.
      // Esto evita que una regla PAM cargue silenciosamente en un template MSA cuando solo existe el MSA.
      const algunoBancario = templates.some(t => (t as any).solo_conciliacion)
      let template = templates[0]
      if (algunoBancario) {
        const matchEmpresa = templates.find(t =>
          t.responsable?.toLowerCase().includes(cuenta.empresa.toLowerCase())
        )
        if (!matchEmpresa) {
          console.warn(`⚠️ No hay template "${regla.categ}" para ${cuenta.empresa} (solo_conciliacion). Cuota NO creada.`)
          return null
        }
        template = matchEmpresa
      } else if (templates.length > 1) {
        // Templates específicos (Red Vial, FCI, etc.): si hay varios, elegir por empresa.
        // Si hay uno solo, se usa tal cual aunque el banco sea de otra empresa
        // (caso Red Vial Rojas MSA pagado desde banco PAM → carga en MSA, correcto).
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
      return {
        templateId: template.id,
        cuotaId: cuota.id,
        responsable: (template as any).responsable ?? null
      }

    } catch (err) {
      console.error('Error en crearCuotaEnTemplate:', err)
      return null
    }
  }

  // Función para actualizar movimiento en BD
  const actualizarMovimientoBD = async (cuenta: CuentaBancaria, movimientoId: string, datos: any) => {
    try {
      const clientSchema = cuenta.schema_bd && cuenta.schema_bd !== 'public' ? supabase.schema(cuenta.schema_bd) : supabase
      let query = clientSchema.from(cuenta.tabla_bd).update(datos).eq('id', movimientoId)
      
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