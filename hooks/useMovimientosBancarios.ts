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
  estado: 'conciliado' | 'pendiente' | 'auditar'
  numero_de_comprobante: string | null
  observaciones_cliente: string | null
  motivo_revision: string | null
  contable: string | null
  interno: string | null
  cuenta: string
  orden: number
  comprobante_arca_id: string | null
  leyendas_adicionales_1: string | null
  leyendas_adicionales_2: string | null
  revisado: boolean
  nota_operador: string | null
  proveedor_nombre: string | null
  comprobantes_pagados: string | null
}

export interface EstadisticasMovimientos {
  total: number
  conciliados: number
  pendientes: number
  auditar: number
  sin_categ: number
  sin_revisar: number
}

export function useMovimientosBancarios(tabla: string = 'msa_galicia', schema: string = 'public') {
  const [movimientos, setMovimientos] = useState<MovimientoBancario[]>([])
  const [estadisticas, setEstadisticas] = useState<EstadisticasMovimientos>({
    total: 0,
    conciliados: 0,
    pendientes: 0,
    auditar: 0,
    sin_categ: 0,
    sin_revisar: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cargar movimientos bancarios
  const cargarMovimientos = async (filtros?: {
    estado?: 'conciliado' | 'pendiente' | 'auditar' | 'Todos'
    limite?: number
    busqueda?: string
    fechaDesde?: string
    fechaHasta?: string
    montoDesde?: number
    montoHasta?: number
    categ?: string
    categEspecial?: 'invalida' | 'sin_categ'
    detalle?: string
    soloSinRevisar?: boolean
  }) => {
    try {
      setLoading(true)
      setError(null)

      let query = (schema && schema !== 'public' ? supabase.schema(schema) : supabase)
        .from(tabla)
        .select('*')

      // Aplicar filtro de estado
      if (filtros?.estado && filtros.estado !== 'Todos') {
        query = query.eq('estado', filtros.estado)
      }

      // Aplicar búsqueda multi-columna
      if (filtros?.busqueda) {
        const b = filtros.busqueda
        query = query.or(`descripcion.ilike.%${b}%,categ.ilike.%${b}%,detalle.ilike.%${b}%,contable.ilike.%${b}%,interno.ilike.%${b}%,origen.ilike.%${b}%,observaciones_cliente.ilike.%${b}%,numero_de_comprobante.ilike.%${b}%,nota_operador.ilike.%${b}%,leyendas_adicionales_1.ilike.%${b}%,leyendas_adicionales_2.ilike.%${b}%`)
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

      // Aplicar filtro especial de CATEG (invalida / sin_categ)
      if (filtros?.categEspecial === 'invalida') {
        query = query.ilike('categ', 'INVALIDA:%')
      } else if (filtros?.categEspecial === 'sin_categ') {
        query = query.is('categ', null)
      } else if (filtros?.categ) {
        query = query.ilike('categ', `%${filtros.categ}%`)
      }

      // Aplicar filtro de detalle
      if (filtros?.detalle) {
        query = query.ilike('detalle', `%${filtros.detalle}%`)
      }

      // Aplicar filtro solo sin revisar
      if (filtros?.soloSinRevisar) {
        query = query.eq('revisado', false)
      }

      // Ordenar por orden descendente — respeta el orden del extracto bancario original
      query = query.order('orden', { ascending: false })

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
      const { data, error } = await (schema && schema !== 'public' ? supabase.schema(schema) : supabase)
        .from(tabla)
        .select('estado, categ, revisado')

      if (error) {
        throw new Error(`Error cargando estadísticas: ${error.message}`)
      }

      const stats = {
        total: data?.length || 0,
        conciliados: data?.filter(m => m.estado === 'conciliado').length || 0,
        pendientes: data?.filter(m => m.estado === 'pendiente').length || 0,
        auditar: data?.filter(m => m.estado === 'auditar').length || 0,
        sin_categ: data?.filter(m => !m.categ || m.categ.startsWith('INVALIDA:')).length || 0,
        sin_revisar: data?.filter(m => !m.revisado).length || 0
      }

      setEstadisticas(stats)

    } catch (err) {
      console.error('Error en cargarEstadisticas:', err)
    }
  }

  // Cargar datos iniciales — se re-ejecuta cuando cambia la tabla (cuenta seleccionada)
  useEffect(() => {
    cargarMovimientos({ limite: 100 })
    cargarEstadisticas()
  }, [tabla])

  // Actualización masiva de movimientos
  const actualizarMasivo = async (
    ids: string[],
    campos: {
      categ?: string
      nro_cuenta?: string | null
      centro_de_costo?: string
      estado?: string
      contable?: string
      interno?: string
      detalle?: string
    }
  ): Promise<boolean> => {
    try {
      // Filtrar campos vacíos (nro_cuenta puede ser null explícito — lo incluimos si categ tiene valor)
      const camposLimpios: Record<string, unknown> = Object.fromEntries(
        Object.entries(campos).filter(([key, value]) => {
          if (key === 'nro_cuenta') return campos.categ && campos.categ.trim() !== ''
          return value && typeof value === 'string' && value.trim() !== ''
        })
      )

      if (Object.keys(camposLimpios).length === 0) {
        throw new Error('No hay campos para actualizar')
      }

      // Actualizar cada movimiento
      for (const id of ids) {
        const { error } = await (schema && schema !== 'public' ? supabase.schema(schema) : supabase)
          .from(tabla)
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

  // Actualizar uno o más movimientos localmente sin recargar de BD
  const actualizarLocal = (ids: string | string[], campos: Record<string, any>) => {
    const idsArr = Array.isArray(ids) ? ids : [ids]
    const idsSet = new Set(idsArr)
    setMovimientos(prev => prev.map(m => idsSet.has(m.id) ? { ...m, ...campos } : m))
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
    actualizarLocal,
    recargar
  }
}