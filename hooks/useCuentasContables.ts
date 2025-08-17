"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export interface CuentaContable {
  categ: string
  cuenta_contable: string
  tipo: string
  activo: boolean
  created_at: string
}

export function useCuentasContables() {
  const [cuentas, setCuentas] = useState<CuentaContable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargarCuentas = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔍 DEBUG useCuentasContables: Iniciando carga...')
      
      const { data, error: supabaseError } = await supabase
        .from('cuentas_contables')
        .select('*')
        .eq('activo', true)
        .order('categ', { ascending: true })

      if (supabaseError) {
        console.error('Error al cargar cuentas contables:', supabaseError)
        setError(`Error al cargar cuentas: ${supabaseError.message}`)
        return
      }

      console.log('🔍 DEBUG useCuentasContables: Cuentas cargadas:', data?.length || 0)
      console.log('🔍 DEBUG useCuentasContables: Primeras 3:', data?.slice(0, 3) || [])
      
      setCuentas(data || [])
    } catch (error) {
      console.error('Error inesperado:', error)
      setError('Error inesperado al cargar las cuentas contables')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarCuentas()
  }, [])

  // Validar si un código categ existe
  const validarCateg = (categ: string): boolean => {
    return cuentas.some(cuenta => cuenta.categ.toLowerCase() === categ.toLowerCase())
  }

  // Buscar cuentas similares (fuzzy matching)
  const buscarSimilares = (categ: string): CuentaContable[] => {
    const categLower = categ.toLowerCase()
    
    return cuentas.filter(cuenta => {
      const cuentaCateg = cuenta.categ.toLowerCase()
      const cuentaNombre = cuenta.cuenta_contable.toLowerCase()
      
      // Coincidencia exacta
      if (cuentaCateg === categLower) return true
      
      // Coincidencia parcial en código
      if (cuentaCateg.includes(categLower) || categLower.includes(cuentaCateg)) return true
      
      // Coincidencia parcial en nombre
      if (cuentaNombre.includes(categLower) || categLower.includes(cuentaNombre)) return true
      
      return false
    }).slice(0, 5) // Máximo 5 sugerencias
  }

  // Crear nueva cuenta contable
  const crearCuentaContable = async (
    categ: string,
    cuenta_contable: string,
    tipo: string
  ): Promise<boolean> => {
    try {
      console.log('🔍 DEBUG crearCuentaContable:')
      console.log('- categ:', categ)
      console.log('- cuenta_contable:', cuenta_contable)
      console.log('- tipo:', tipo)
      
      const { data, error } = await supabase
        .from('cuentas_contables')
        .insert({
          categ: categ.toUpperCase(),
          cuenta_contable,
          tipo,
          activo: true
        })
        .select()

      if (error) {
        console.error('❌ Error creando cuenta contable:', error)
        setError(`Error al crear cuenta: ${error.message}`)
        return false
      }

      console.log('✅ Cuenta creada exitosamente:', data)

      // Recargar cuentas después de crear
      await cargarCuentas()
      return true

    } catch (error) {
      console.error('❌ Error inesperado creando cuenta:', error)
      setError('Error inesperado al crear la cuenta contable')
      return false
    }
  }

  return {
    cuentas,
    loading,
    error,
    cargarCuentas,
    validarCateg,
    buscarSimilares,
    crearCuentaContable
  }
}