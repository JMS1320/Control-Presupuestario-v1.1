'use client'

/**
 * Notificación flotante (esquina sup-der) que muestra el progreso de un lote
 * de búsqueda de PDFs. Permite al usuario seguir trabajando.
 *
 * Cuando termina:
 *   - cambia a estado "finalizado"
 *   - muestra resumen
 *   - botón "Ver detalle" abre el modal histórico filtrado al lote
 *   - se cierra solo después de N segundos o por click
 */

import { useEffect, useState } from 'react'
import type { ProgresoLote } from '@/lib/gas-pdf/client'
import { Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  progreso: ProgresoLote | null
  onCerrar: () => void
  onVerDetalle?: (loteId: string) => void
  /** Cancela el lote en curso (la búsqueda corre en 2do plano; este es el único punto de corte) */
  onCancelar?: () => void
}

export function NotificacionProgresoLote({ progreso, onCerrar, onVerDetalle, onCancelar }: Props) {
  const [visible, setVisible] = useState(true)

  // Reabrir al iniciar un lote nuevo (sin esto, tras el 1er auto-cierre visible queda en false
  // y la notificación no reaparecería en la 2da búsqueda de la misma sesión).
  useEffect(() => {
    if (progreso?.loteId) setVisible(true)
  }, [progreso?.loteId])

  // Auto-cierre: 8s si todo OK; 20s si el mail resumen falló (para que llegues a leer el error)
  useEffect(() => {
    if (!progreso?.finalizado) return
    const ms = progreso.resumenError ? 20000 : 8000
    const t = setTimeout(() => { setVisible(false); onCerrar() }, ms)
    return () => clearTimeout(t)
  }, [progreso?.finalizado, progreso?.resumenError, onCerrar])

  if (!progreso || !visible) return null

  const pct = progreso.total > 0 ? Math.round((progreso.procesadas / progreso.total) * 100) : 0

  return (
    <div className="fixed top-4 right-4 z-50 w-80 bg-white border-2 border-blue-200 rounded-lg shadow-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {progreso.finalizado ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          )}
          <span className="text-sm font-semibold">
            {progreso.finalizado ? 'Búsqueda completada' : 'Buscando PDFs…'}
          </span>
        </div>
        <button onClick={() => { setVisible(false); onCerrar() }} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all ${progreso.finalizado ? 'bg-green-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="text-xs text-gray-600 mb-3">
        {progreso.procesadas} de {progreso.total} ({pct}%)
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-1 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-green-600 font-bold">✓</span>
          <span>{progreso.encontradas} encontradas</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-yellow-600 font-bold">⚠</span>
          <span>{progreso.paraRevisar} para revisar</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500 font-bold">○</span>
          <span>{progreso.noEncontradas} no encontradas</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-red-600 font-bold">!</span>
          <span>{progreso.errores} errores</span>
        </div>
      </div>

      {/* Estado del mail resumen (solo al finalizar) — antes fallaba en silencio */}
      {progreso.finalizado && (
        progreso.resumenError ? (
          <div className="mt-3 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded p-2">
            ✉️ El mail resumen NO se envió: {progreso.resumenError}
          </div>
        ) : progreso.resumenEnviado ? (
          <div className="mt-3 text-[11px] text-green-700">✉️ Mail resumen enviado.</div>
        ) : null
      )}

      {progreso.finalizado && onVerDetalle && (
        <Button
          size="sm" variant="outline"
          className="w-full mt-3 text-xs"
          onClick={() => onVerDetalle(progreso.loteId)}
        >
          Ver detalle del lote
        </Button>
      )}

      {/* Cancelar — la búsqueda corre en 2do plano, este es el único punto de corte */}
      {!progreso.finalizado && onCancelar && (
        <Button
          size="sm" variant="ghost"
          className="w-full mt-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={onCancelar}
        >
          Cancelar búsqueda
        </Button>
      )}

      {progreso.actual && !progreso.finalizado && (
        <div className="mt-2 text-[10px] text-gray-500 truncate">
          Procesando: {progreso.actual.factura_id.slice(0, 8)}…
        </div>
      )}
    </div>
  )
}
