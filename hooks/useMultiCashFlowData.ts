"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

// Interface unificada para Cash Flow (10 columnas finales)
export interface CashFlowRow {
  id: string
  origen: 'ARCA' | 'TEMPLATE'
  origen_tabla: string // Para identificar tabla específica al editar
  fecha_estimada: string
  fecha_vencimiento: string | null
  categ: string
  centro_costo: string
  cuit_proveedor: string
  nombre_proveedor: string
  detalle: string
  debitos: number
  creditos: number
  saldo_cta_cte: number // Calculado
  estado: string // Para tracking de cambios
}

// Filtros para Cash Flow
export interface CashFlowFilters {
  fechaDesde?: string
  fechaHasta?: string
  responsables?: string[]
  estados?: string[]
  origenes?: ('ARCA' | 'TEMPLATE')[]
  empresas?: ('MSA' | 'PAM')[]
}

export function useMultiCashFlowData(filtros?: CashFlowFilters) {
  const [data, setData] = useState<CashFlowRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Función para calcular fecha estimada (fecha_emision + 7 días)
  const calcularFechaEstimada = (fechaEmision: string): string => {
    const fecha = new Date(fechaEmision)
    fecha.setDate(fecha.getDate() + 7)
    return fecha.toISOString().split('T')[0]
  }

  // Mapear facturas ARCA a formato Cash Flow
  const mapearFacturasArca = (facturas: any[]): CashFlowRow[] => {
    return facturas.map(f => ({
      id: f.id,
      origen: 'ARCA' as const,
      origen_tabla: 'msa.comprobantes_arca',
      fecha_estimada: f.fecha_estimada || calcularFechaEstimada(f.fecha_emision),
      fecha_vencimiento: f.fecha_vencimiento,
      categ: f.categ || 'SIN_CATEG',
      centro_costo: f.centro_costo || 'SIN_CC',
      cuit_proveedor: f.cuit || '',
      nombre_proveedor: f.denominacion_emisor || '',
      detalle: f.detalle || `Factura ${f.tipo_comprobante}-${f.numero_desde}`,
      debitos: f.imp_total || 0, // Cash Flow muestra monto original de factura
      creditos: 0, // Las facturas ARCA son siempre débitos
      saldo_cta_cte: 0, // Se calcula después
      estado: f.estado || 'pendiente'
    }))
  }

  // Mapear templates egresos a formato Cash Flow
  const mapearTemplatesEgresos = (cuotas: any[]): CashFlowRow[] => {
    return cuotas.map(c => ({
      id: c.id,
      origen: 'TEMPLATE' as const,
      origen_tabla: 'cuotas_egresos_sin_factura',
      fecha_estimada: c.fecha_estimada,
      fecha_vencimiento: c.fecha_vencimiento,
      categ: c.egreso?.categ || 'SIN_CATEG',
      centro_costo: c.egreso?.centro_costo || 'SIN_CC',
      cuit_proveedor: c.egreso?.cuit_quien_cobra || '',
      nombre_proveedor: c.egreso?.nombre_quien_cobra || c.egreso?.responsable || '',
      detalle: c.descripcion || c.egreso?.nombre_referencia || '',
      debitos: c.monto || 0,
      creditos: 0, // Los templates egresos son siempre débitos
      saldo_cta_cte: 0, // Se calcula después
      estado: c.estado || 'pendiente'
    }))
  }

  // Calcular saldos acumulativos
  const calcularSaldosAcumulativos = (filas: CashFlowRow[]): CashFlowRow[] => {
    let saldoAcumulado = 0
    return filas.map(fila => {
      saldoAcumulado += fila.creditos - fila.debitos
      return { ...fila, saldo_cta_cte: saldoAcumulado }
    })
  }

  // Aplicar filtros a los datos
  const aplicarFiltros = (datos: CashFlowRow[], filtros?: CashFlowFilters): CashFlowRow[] => {
    if (!filtros) return datos

    return datos.filter(fila => {
      // Filtro por fecha
      if (filtros.fechaDesde && fila.fecha_estimada < filtros.fechaDesde) return false
      if (filtros.fechaHasta && fila.fecha_estimada > filtros.fechaHasta) return false

      // Filtro por responsables (nombre_proveedor contiene)
      if (filtros.responsables && filtros.responsables.length > 0) {
        const coincide = filtros.responsables.some(resp => 
          fila.nombre_proveedor.toLowerCase().includes(resp.toLowerCase())
        )
        if (!coincide) return false
      }

      // Filtro por estados
      if (filtros.estados && filtros.estados.length > 0) {
        if (!filtros.estados.includes(fila.estado)) return false
      }

      // Filtro por origen
      if (filtros.origenes && filtros.origenes.length > 0) {
        if (!filtros.origenes.includes(fila.origen)) return false
      }

      return true
    })
  }

  // Función principal para cargar datos
  const cargarDatos = async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. Cargar facturas ARCA (estado ≠ 'conciliado' AND estado ≠ 'credito')
      const { data: facturasArca, error: errorArca } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('*')
        .neq('estado', 'conciliado')
        .neq('estado', 'credito')
        .order('fecha_estimada', { ascending: true, nullsFirst: false })

      if (errorArca) {
        console.error('Error cargando facturas ARCA:', errorArca)
        throw new Error(`Error facturas ARCA: ${errorArca.message}`)
      }

      // 2. Cargar templates egresos (mismo filtro de estados)
      const { data: templatesEgresos, error: errorTemplates } = await supabase
        .from('cuotas_egresos_sin_factura')
        .select(`
          *,
          egreso:egresos_sin_factura(*)
        `)
        .neq('estado', 'conciliado')
        .neq('estado', 'credito')
        .order('fecha_estimada', { ascending: true })

      if (errorTemplates) {
        console.error('Error cargando templates egresos:', errorTemplates)
        throw new Error(`Error templates: ${errorTemplates.message}`)
      }

      // 3. Mapear ambas fuentes a formato unificado
      const filasArca = mapearFacturasArca(facturasArca || [])
      const filasTemplates = mapearTemplatesEgresos(templatesEgresos || [])

      // 4. Combinar y ordenar por fecha_estimada
      const todasLasFilas = [...filasArca, ...filasTemplates]
        .sort((a, b) => a.fecha_estimada.localeCompare(b.fecha_estimada))

      // 5. Aplicar filtros
      const filasFiltradas = aplicarFiltros(todasLasFilas, filtros)

      // 6. Calcular saldos acumulativos
      const filasConSaldo = calcularSaldosAcumulativos(filasFiltradas)

      setData(filasConSaldo)

      console.log(`✅ Cash Flow cargado: ${filasArca.length} ARCA + ${filasTemplates.length} Templates = ${filasConSaldo.length} total (filtradas)`)

    } catch (error) {
      console.error('Error en useMultiCashFlowData:', error)
      setError(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // Función para actualizar un registro individual
  const actualizarRegistro = async (
    id: string, 
    campo: string, 
    valor: any, 
    origen: 'ARCA' | 'TEMPLATE'
  ): Promise<boolean> => {
    try {
      if (origen === 'ARCA') {
        const { error } = await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .update({ [campo]: valor })
          .eq('id', id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('cuotas_egresos_sin_factura')
          .update({ [campo]: valor })
          .eq('id', id)

        if (error) throw error
      }

      // Recargar datos después de actualización exitosa
      await cargarDatos()
      return true

    } catch (error) {
      console.error('Error actualizando registro:', error)
      setError(error instanceof Error ? error.message : 'Error al actualizar')
      return false
    }
  }

  // Función para actualización batch (modo PAGOS)
  const actualizarBatch = async (
    actualizaciones: Array<{
      id: string
      origen: 'ARCA' | 'TEMPLATE'
      campo: string
      valor: any
    }>
  ): Promise<boolean> => {
    try {
      // Agrupar por origen para hacer updates eficientes
      const arcaUpdates = actualizaciones.filter(u => u.origen === 'ARCA')
      const templateUpdates = actualizaciones.filter(u => u.origen === 'TEMPLATE')

      // Procesar updates ARCA
      for (const update of arcaUpdates) {
        const { error } = await supabase
          .schema('msa')
          .from('comprobantes_arca')
          .update({ [update.campo]: update.valor })
          .eq('id', update.id)

        if (error) throw error
      }

      // Procesar updates Templates
      for (const update of templateUpdates) {
        const { error } = await supabase
          .from('cuotas_egresos_sin_factura')
          .update({ [update.campo]: update.valor })
          .eq('id', update.id)

        if (error) throw error
      }

      // Recargar datos
      await cargarDatos()
      return true

    } catch (error) {
      console.error('Error en actualización batch:', error)
      setError(error instanceof Error ? error.message : 'Error en actualización masiva')
      return false
    }
  }

  // Cargar datos al inicializar y cuando cambien los filtros
  useEffect(() => {
    cargarDatos()
  }, [filtros])

  // Estadísticas calculadas
  const estadisticas = {
    total_registros: data.length,
    total_debitos: data.reduce((sum, row) => sum + row.debitos, 0),
    total_creditos: data.reduce((sum, row) => sum + row.creditos, 0),
    saldo_final: data.length > 0 ? data[data.length - 1].saldo_cta_cte : 0,
    registros_arca: data.filter(row => row.origen === 'ARCA').length,
    registros_templates: data.filter(row => row.origen === 'TEMPLATE').length
  }

  return {
    data,
    loading,
    error,
    estadisticas,
    cargarDatos,
    actualizarRegistro,
    actualizarBatch
  }
}