"use client"

import { useState, useRef, useCallback } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"

export interface CeldaEnEdicion {
  filaId: string
  columna: string
  valor: any
  tableName?: string
  campoReal?: string
  origen?: 'ARCA' | 'TEMPLATE' | 'EXTRACTO' | 'CASH_FLOW' | 'ANTICIPO'
  egresoId?: string
}

interface UseInlineEditorProps {
  onSuccess?: () => void
  onLocalUpdate?: (filaId: string, campo: string, valor: any, updateData: Record<string, any>) => void
  onError?: (error: string) => void
  customValidations?: (celda: CeldaEnEdicion) => Promise<boolean>
}

function useInlineEditor({ onSuccess, onLocalUpdate, onError, customValidations }: UseInlineEditorProps = {}) {
  const [celdaEnEdicion, setCeldaEnEdicion] = useState<CeldaEnEdicion | null>(null)
  const [guardandoCambio, setGuardandoCambio] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const iniciarEdicion = useCallback((celda: CeldaEnEdicion) => {
    setCeldaEnEdicion(celda)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 50)
  }, [])

  const cancelarEdicion = useCallback(() => {
    setCeldaEnEdicion(null)
  }, [])

  const procesarValor = useCallback((valor: any, columna: string): any => {
    if (['fecha_estimada', 'fecha_vencimiento'].includes(columna)) {
      if (!valor || String(valor).trim() === '') {
        return null
      }
      
      // Convertir fecha a formato YYYY-MM-DD para Supabase
      const fechaStr = String(valor).trim()
      console.log(`🗓️ Hook procesarValor fecha original: "${fechaStr}"`)
      
      // Detectar formato DD/MM/AAAA y convertir
      if (fechaStr.includes('/')) {
        const partes = fechaStr.split('/')
        if (partes.length === 3) {
          const [dia, mes, ano] = partes
          const fechaFormateada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
          console.log(`🔄 Hook convertido DD/MM/AAAA → YYYY-MM-DD: "${fechaFormateada}"`)
          
          if (!Date.parse(fechaFormateada)) {
            throw new Error('Formato de fecha inválido')
          }
          return fechaFormateada
        }
      }
      
      // Si ya viene en formato correcto o ISO, validar y devolver
      if (!Date.parse(fechaStr)) {
        throw new Error('Formato de fecha inválido')
      }
      return fechaStr
    }
    
    if (['monto', 'monto_a_abonar', 'imp_total', 'debitos', 'creditos'].includes(columna)) {
      return parseFloat(String(valor)) || 0
    }
    
    return valor
  }, [])

  const aplicarReglasAutomaticas = useCallback((celda: CeldaEnEdicion, valorProcesado: any) => {
    let updateData: any = {}

    // Mapeo especial para ANTICIPO
    if (celda.origen === 'ANTICIPO') {
      if (celda.columna === 'debitos' || celda.columna === 'creditos') {
        // El monto editable es monto y monto_restante (ambos)
        updateData.monto = valorProcesado
        updateData.monto_restante = valorProcesado
        console.log(`💵 Anticipo: actualizando monto/monto_restante = ${valorProcesado}`)
      } else if (celda.columna === 'fecha_estimada') {
        updateData.fecha_pago = valorProcesado
      } else if (celda.columna === 'detalle') {
        updateData.descripcion = valorProcesado
      } else {
        updateData[celda.campoReal || celda.columna] = valorProcesado
      }
    } else {
      // Comportamiento normal para otros orígenes
      updateData = { [celda.campoReal || celda.columna]: valorProcesado }

      if (celda.columna === 'fecha_vencimiento' && valorProcesado !== null) {
        updateData.fecha_estimada = valorProcesado
        console.log(`🔄 Auto-actualización ${celda.origen}: fecha_vencimiento = ${valorProcesado} → fecha_estimada = ${valorProcesado}`)
      }
    }

    Object.keys(updateData).forEach(key => {
      if (updateData[key] === '' || updateData[key] === undefined) {
        updateData[key] = null
      }
    })

    return updateData
  }, [])

  const guardarCambio = useCallback(async (nuevoValor?: any) => {
    if (!celdaEnEdicion) return false

    const valor = nuevoValor ?? celdaEnEdicion.valor
    setGuardandoCambio(true)

    try {
      if (customValidations) {
        const validacionOk = await customValidations({ ...celdaEnEdicion, valor })
        if (!validacionOk) {
          return false
        }
      }

      const valorProcesado = procesarValor(valor, celdaEnEdicion.columna)
      const updateData = aplicarReglasAutomaticas(celdaEnEdicion, valorProcesado)

      const tabla = celdaEnEdicion.tableName || 'cuotas_egresos_sin_factura'
      const filtro = { id: celdaEnEdicion.filaId }

      const query = celdaEnEdicion.origen === 'ARCA' 
        ? supabase.schema('msa').from(tabla)
        : supabase.from(tabla)
      
      console.log(`💾 Actualizando ${tabla}:`, updateData, 'WHERE:', filtro)
      
      const { error } = await query
        .update(updateData)
        .match(filtro)

      if (error) {
        console.error(`Error actualizando ${tabla}:`, error)
        toast.error('Error al guardar cambio')
        onError?.('Error al guardar cambio')
        return false
      }

      toast.success('Campo actualizado correctamente')
      const celdaGuardada = { ...celdaEnEdicion }
      setCeldaEnEdicion(null)
      if (onLocalUpdate) {
        onLocalUpdate(celdaGuardada.filaId, celdaGuardada.columna, valorProcesado, updateData)
      } else {
        onSuccess?.()
      }
      return true

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
      toast.error(errorMsg)
      onError?.(errorMsg)
      return false
      
    } finally {
      setGuardandoCambio(false)
    }
  }, [celdaEnEdicion, onSuccess, onLocalUpdate, onError, customValidations, procesarValor, aplicarReglasAutomaticas])

  const manejarKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      guardarCambio()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelarEdicion()
    }
  }, [guardarCambio, cancelarEdicion])

  return {
    celdaEnEdicion,
    guardandoCambio,
    inputRef,
    iniciarEdicion,
    cancelarEdicion,
    guardarCambio,
    manejarKeyDown,
    setCeldaEnEdicion,
    procesarValor,
    aplicarReglasAutomaticas
  }
}

export default useInlineEditor
export type { CeldaEnEdicion }