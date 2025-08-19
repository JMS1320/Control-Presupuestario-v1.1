"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export interface MovimientoBancario {
  id: string
  fecha: string
  descripcion: string
  origen: string
  debitos: number
  creditos: number
  saldo: number
  categ: string | null
  detalle: string | null
  centro_de_costo: string | null
  estado: 'Conciliado' | 'Pendiente' | 'Auditar'
  numero_de_comprobante: string | null
  observaciones_cliente: string | null
  motivo_revision: string | null
  contable: string | null
  interno: string | null
  cuenta: string
  orden: number
}

export interface EstadisticasMovimientos {
  total: number
  conciliados: number
  pendientes: number
  auditar: number
  sin_categ: number
}

export function useMovimientosBancarios() {
  const [movimientos, setMovimientos] = useState<MovimientoBancario[]>([])
  const [estadisticas, setEstadisticas] = useState<EstadisticasMovimientos>({
    total: 0,
    conciliados: 0,
    pendientes: 0,
    auditar: 0,
    sin_categ: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cargar movimientos bancarios
  const cargarMovimientos = async (filtros?: {
    estado?: 'Conciliado' | 'Pendiente' | 'Auditar' | 'Todos'
    limite?: number
    busqueda?: string
    fechaDesde?: string
    fechaHasta?: string
    montoDesde?: number
    montoHasta?: number
    categ?: string
    detalle?: string
  }) => {
    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('msa_galicia')
        .select('*')

      // Aplicar filtro de estado
      if (filtros?.estado && filtros.estado !== 'Todos') {
        query = query.eq('estado', filtros.estado)
      }

      // Aplicar búsqueda en descripción
      if (filtros?.busqueda) {
        query = query.ilike('descripcion', `%${filtros.busqueda}%`)
      }

      // Aplicar filtro de fecha desde
      if (filtros?.fechaDesde) {
        query = query.gte('fecha', filtros.fechaDesde)
      }

      // Aplicar filtro de fecha hasta
      if (filtros?.fechaHasta) {
        query = query.lte('fecha', filtros.fechaHasta)
      }

      // Aplicar filtro de monto desde (débitos)
      if (filtros?.montoDesde) {
        query = query.gte('debitos', filtros.montoDesde)
      }

      // Aplicar filtro de monto hasta (débitos)
      if (filtros?.montoHasta) {
        query = query.lte('debitos', filtros.montoHasta)
      }

      // Aplicar filtro de CATEG
      if (filtros?.categ) {
        query = query.ilike('categ', `%${filtros.categ}%`)
      }

      // Aplicar filtro de detalle
      if (filtros?.detalle) {
        query = query.ilike('detalle', `%${filtros.detalle}%`)
      }

      // Ordenar por fecha descendente (más recientes primero)
      query = query.order('fecha', { ascending: false })

      // Aplicar límite
      if (filtros?.limite) {
        query = query.limit(filtros.limite)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(`Error cargando movimientos: ${error.message}`)
      }

      setMovimientos(data || [])

    } catch (err) {
      console.error('Error en cargarMovimientos:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // Cargar estadísticas
  const cargarEstadisticas = async () => {
    try {
      const { data, error } = await supabase
        .from('msa_galicia')
        .select('estado, categ')

      if (error) {
        throw new Error(`Error cargando estadísticas: ${error.message}`)
      }

      const stats = {
        total: data?.length || 0,
        conciliados: data?.filter(m => m.estado === 'Conciliado').length || 0,
        pendientes: data?.filter(m => m.estado === 'Pendiente').length || 0,
        auditar: data?.filter(m => m.estado === 'Auditar').length || 0,
        sin_categ: data?.filter(m => !m.categ || m.categ.startsWith('INVALIDA:')).length || 0
      }

      setEstadisticas(stats)

    } catch (err) {
      console.error('Error en cargarEstadisticas:', err)
    }
  }

  // Cargar datos iniciales
  useEffect(() => {
    cargarMovimientos({ limite: 100 })
    cargarEstadisticas()
  }, [])

  // Actualización masiva de movimientos
  const actualizarMasivo = async (
    ids: string[], 
    campos: {
      categ?: string
      centro_de_costo?: string
      estado?: string
      contable?: string
      interno?: string
    }
  ): Promise<boolean> => {
    try {
      // Filtrar campos vacíos
      const camposLimpios = Object.fromEntries(
        Object.entries(campos).filter(([key, value]) => value && value.trim() !== '')
      )

      if (Object.keys(camposLimpios).length === 0) {
        throw new Error('No hay campos para actualizar')
      }

      // Actualizar cada movimiento
      for (const id of ids) {
        const { error } = await supabase
          .from('msa_galicia')
          .update(camposLimpios)
          .eq('id', id)

        if (error) {
          throw new Error(`Error actualizando movimiento ${id}: ${error.message}`)
        }
      }

      console.log(`✅ ${ids.length} movimientos actualizados exitosamente`)
      return true

    } catch (err) {
      console.error('Error en actualización masiva:', err)
      setError(err instanceof Error ? err.message : 'Error en actualización masiva')
      return false
    }
  }

  // Recargar datos
  const recargar = () => {
    cargarMovimientos({ limite: 100 })
    cargarEstadisticas()
  }

  return {
    movimientos,
    estadisticas,
    loading,
    error,
    cargarMovimientos,
    cargarEstadisticas,
    actualizarMasivo,
    recargar
  }
}