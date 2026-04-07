"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ReglaConciliacion } from "@/types/conciliacion"

export function useReglasConciliacion() {
  const [reglas, setReglas] = useState<ReglaConciliacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cargar todas las reglas ordenadas por prioridad
  const cargarReglas = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔍 DEBUG useReglasConciliacion: Cargando reglas...')
      
      const { data, error: supabaseError } = await supabase
        .from('reglas_conciliacion')
        .select('*')
        .order('orden', { ascending: true })

      if (supabaseError) {
        console.error('Error al cargar reglas conciliación:', supabaseError)
        setError(`Error al cargar reglas: ${supabaseError.message}`)
        return
      }

      console.log('🔍 DEBUG useReglasConciliacion: Reglas cargadas:', data?.length || 0)
      setReglas(data || [])
      
    } catch (error) {
      console.error('Error inesperado:', error)
      setError('Error inesperado al cargar las reglas de conciliación')
    } finally {
      setLoading(false)
    }
  }

  // Cargar solo reglas activas para procesamiento — filtradas por cuenta bancaria
  const cargarReglasActivas = async (cuentaId: string): Promise<ReglaConciliacion[]> => {
    try {
      const { data, error: supabaseError } = await supabase
        .from('reglas_conciliacion')
        .select('*')
        .eq('activo', true)
        .eq('cuenta_bancaria_id', cuentaId)
        .order('orden', { ascending: true })

      if (supabaseError) {
        console.error('Error al cargar reglas activas:', supabaseError)
        throw new Error(`Error al cargar reglas activas: ${supabaseError.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Error en cargarReglasActivas:', error)
      throw error
    }
  }

  // Crear nueva regla
  const crearRegla = async (nuevaRegla: Omit<ReglaConciliacion, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> => {
    try {
      console.log('🔍 DEBUG crearRegla:', nuevaRegla)
      
      const { data, error } = await supabase
        .from('reglas_conciliacion')
        .insert({
          orden: nuevaRegla.orden,
          tipo: nuevaRegla.tipo,
          columna_busqueda: nuevaRegla.columna_busqueda,
          texto_buscar: nuevaRegla.texto_buscar,
          tipo_match: nuevaRegla.tipo_match,
          categ: nuevaRegla.categ,
          centro_costo: nuevaRegla.centro_costo,
          detalle: nuevaRegla.detalle,
          activo: nuevaRegla.activo,
          llena_template: nuevaRegla.llena_template,
          cuenta_bancaria_id: nuevaRegla.cuenta_bancaria_id
        })
        .select()

      if (error) {
        console.error('❌ Error creando regla:', error)
        setError(`Error al crear regla: ${error.message}`)
        return false
      }

      console.log('✅ Regla creada exitosamente:', data)
      await cargarReglas() // Recargar lista
      return true

    } catch (error) {
      console.error('❌ Error inesperado creando regla:', error)
      setError('Error inesperado al crear la regla')
      return false
    }
  }

  // Actualizar regla existente
  const actualizarRegla = async (id: string, cambios: Partial<ReglaConciliacion>): Promise<boolean> => {
    try {
      console.log('🔍 DEBUG actualizarRegla:', { id, cambios })
      
      const { data, error } = await supabase
        .from('reglas_conciliacion')
        .update(cambios)
        .eq('id', id)
        .select()

      if (error) {
        console.error('❌ Error actualizando regla:', error)
        setError(`Error al actualizar regla: ${error.message}`)
        return false
      }

      console.log('✅ Regla actualizada exitosamente:', data)
      await cargarReglas() // Recargar lista
      return true

    } catch (error) {
      console.error('❌ Error inesperado actualizando regla:', error)
      setError('Error inesperado al actualizar la regla')
      return false
    }
  }

  // Eliminar regla
  const eliminarRegla = async (id: string): Promise<boolean> => {
    try {
      console.log('🔍 DEBUG eliminarRegla:', id)
      
      const { error } = await supabase
        .from('reglas_conciliacion')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('❌ Error eliminando regla:', error)
        setError(`Error al eliminar regla: ${error.message}`)
        return false
      }

      console.log('✅ Regla eliminada exitosamente')
      await cargarReglas() // Recargar lista
      return true

    } catch (error) {
      console.error('❌ Error inesperado eliminando regla:', error)
      setError('Error inesperado al eliminar la regla')
      return false
    }
  }

  // Activar/desactivar regla
  const toggleRegla = async (id: string): Promise<boolean> => {
    try {
      const regla = reglas.find(r => r.id === id)
      if (!regla) {
        setError('Regla no encontrada')
        return false
      }

      return await actualizarRegla(id, { activo: !regla.activo })
    } catch (error) {
      console.error('❌ Error en toggleRegla:', error)
      setError('Error al cambiar estado de la regla')
      return false
    }
  }

  // Reordenar reglas (cambiar prioridad)
  const reordenarReglas = async (reglasReordenadas: ReglaConciliacion[]): Promise<boolean> => {
    try {
      console.log('🔍 DEBUG reordenarReglas: Actualizando orden...')
      
      // Actualizar orden de cada regla
      const actualizaciones = reglasReordenadas.map((regla, index) => 
        supabase
          .from('reglas_conciliacion')
          .update({ orden: index + 1 })
          .eq('id', regla.id)
      )

      const resultados = await Promise.all(actualizaciones)
      
      // Verificar si hubo errores
      const errores = resultados.filter(r => r.error)
      if (errores.length > 0) {
        console.error('❌ Errores reordenando reglas:', errores)
        setError('Error al reordenar algunas reglas')
        return false
      }

      console.log('✅ Reglas reordenadas exitosamente')
      await cargarReglas() // Recargar lista
      return true

    } catch (error) {
      console.error('❌ Error inesperado reordenando reglas:', error)
      setError('Error inesperado al reordenar las reglas')
      return false
    }
  }

  // Cargar reglas al inicializar
  useEffect(() => {
    cargarReglas()
  }, [])

  return {
    reglas,
    loading,
    error,
    cargarReglas,
    cargarReglasActivas,
    crearRegla,
    actualizarRegla,
    eliminarRegla,
    toggleRegla,
    reordenarReglas
  }
}