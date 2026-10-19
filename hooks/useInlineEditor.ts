"use client"

import { useState, useRef, useCallback } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { nroDeCuenta } from "@/lib/facturas/nro-de-cuenta"

export interface CeldaEnEdicion {
  filaId: string
  columna: string
  valor: any
  tableName?: string
  campoReal?: string
  origen?: 'ARCA' | 'TEMPLATE' | 'EXTRACTO' | 'CASH_FLOW' | 'ANTICIPO' | 'PRODUCTIVO'
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
    if (['fecha_estimada', 'fecha_vencimiento', 'fecha_pago'].includes(columna)) {
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
      // Acepta tanto punto como coma como separador decimal (formato es-AR: 1.234,56 o 1234,56)
      return parseFloat(String(valor).replace(/\./g, '').replace(',', '.')) || 0
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

      // Regla automática: fecha_pago también arrastra a fecha_estimada (ordena el cash flow)
      if (celda.columna === 'fecha_pago' && valorProcesado !== null) {
        updateData.fecha_estimada = valorProcesado
        console.log(`🔄 Auto-actualización ${celda.origen}: fecha_pago = ${valorProcesado} → fecha_estimada = ${valorProcesado}`)
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

      /**
       * 🔗 **La cuenta y su número son una sola cosa** (A-BUG-1249, regla del usuario 2026-10-13).
       *
       * Esta celda escribía sólo el NOMBRE de la cuenta de la factura: quedaba sin número (y por eso
       * seguía «sin asignar» en Egresos → Asignación) y el movimiento del extracto ya conciliado no
       * se enteraba. Ahora el número sale del plan y viaja en el mismo guardado; la propagación al
       * extracto va más abajo, cuando ya se sabe que la factura se guardó.
       */
      const cambiaCuentaDeFactura = tabla === 'comprobantes_arca' && 'cuenta_contable' in updateData
      if (cambiaCuentaDeFactura) {
        let nro: string | null = null
        if (updateData.cuenta_contable) {
          const { data: plan, error: errorPlan } = await supabase.from('cuentas_contables').select('categ, nro_cuenta')
          if (errorPlan) throw new Error(`No se pudo leer el plan de cuentas: la cuenta NO se guardó (${errorPlan.message})`)
          nro = nroDeCuenta(updateData.cuenta_contable, plan ?? [])
        }
        updateData.nro_cuenta = nro
      }

      // Venc de templates: SÍ o SÍ por el RPC (único camino autorizado por el guardián de BD).
      // El RPC ya setea fecha_vencimiento + fecha_estimada.
      let error: any
      // Cuántas filas tocó el UPDATE. `null` = no aplica (rama RPC, que no lo informa).
      let filasAfectadas: number | null = null
      if (celdaEnEdicion.columna === 'fecha_vencimiento' && tabla === 'cuotas_egresos_sin_factura') {
        const res = await supabase.rpc('actualizar_venc_cuota', {
          p_cuota_id: celdaEnEdicion.filaId,
          p_fecha: valorProcesado || null,
        })
        error = res.error
      } else {
        const query = celdaEnEdicion.origen === 'ARCA'
          ? supabase.schema('msa').from(tabla)
          : celdaEnEdicion.origen === 'PRODUCTIVO'
          ? supabase.schema('productivo').from(tabla)
          : supabase.from(tabla)

        console.log(`💾 Actualizando ${tabla}:`, updateData, 'WHERE:', filtro)

        // `count: 'exact'` para saber si el UPDATE matcheó algo. Un UPDATE que no encuentra
        // la fila NO es un error para Postgres: toca 0 filas y devuelve OK. Sin este conteo
        // la pantalla dice "guardado" y no se guardó nada. Ver PENDIENTES A-FEAT-13 paso 0.
        const res = await query.update(updateData, { count: 'exact' }).match(filtro)
        error = res.error
        filasAfectadas = res.count
      }

      if (error) {
        console.error(`Error actualizando ${tabla}:`, error)
        toast.error('Error al guardar cambio')
        onError?.('Error al guardar cambio')
        return false
      }

      // No matcheó ninguna fila: el registro no está donde se lo buscó (schema equivocado,
      // fila borrada, o id de otra empresa). Se avisa en vez de festejar un guardado que no ocurrió.
      if (filasAfectadas === 0) {
        const msg = `No se encontró el registro en ${tabla}: el cambio NO se guardó`
        console.error(`⚠️ ${msg}`, 'WHERE:', filtro)
        toast.error(msg)
        onError?.(msg)
        return false
      }

      toast.success('Campo actualizado correctamente')
      // La factura ya quedó guardada (el conteo de arriba lo confirma): ahora la cuenta viaja a sus
      // movimientos conciliados, por la misma ruta que usa Asignación. Si esto falla se AVISA — la
      // factura quedó bien, lo que no se enteró es el extracto.
      if (cambiaCuentaDeFactura && updateData.cuenta_contable && !updateData.nro_cuenta) {
        // § 🧮 nada en silencio: quedó el nombre solo.
        toast.warning(`«${updateData.cuenta_contable}» no tiene número en el plan de cuentas: la factura quedó con el nombre solo`)
      } else if (cambiaCuentaDeFactura && celdaEnEdicion.origen === 'ARCA') {
        try {
          const res = await fetch('/api/arca-asignar', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ids: [celdaEnEdicion.filaId],
              nro_cuenta: updateData.nro_cuenta,
              cuenta_contable: updateData.cuenta_contable,
            }),
          })
          const r = await res.json()
          if (!r.success) throw new Error(r.message)
          if (r.propagacion?.aviso) toast.warning(r.propagacion.aviso)
          else if ((r.propagacion?.propagados ?? 0) > 0) {
            toast.success(`La cuenta llegó a ${r.propagacion.propagados} movimiento(s) del extracto ya conciliados.`)
          }
        } catch (e) {
          toast.warning(`La cuenta se guardó en la factura, pero no se pudo llevar al extracto: ${e instanceof Error ? e.message : e}`)
        }
      }
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
// `CeldaEnEdicion` ya se exporta en su declaración (arriba); re-exportarla acá chocaba (TS2484).