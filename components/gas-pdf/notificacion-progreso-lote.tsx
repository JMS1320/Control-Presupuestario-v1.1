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
import { controlDelLote } from '@/lib/gas-pdf/lote'

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
  // 🧮 Cada factura del lote cae en UN casillero; si la suma no da, la app perdió una (A-FEAT-1287)
  const control = progreso.finalizado ? controlDelLote(progreso) : null

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
            {progreso.finalizado ? 'Búsqueda completada'
              : progreso.fase === 'carpeta' ? 'Mirando la carpeta del mes en Drive…' : 'Buscando PDFs en el mail…'}
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
        <div className="flex items-center gap-1" title="Ya estaban archivadas en Drive (su mes o el siguiente): se vincularon sin ir al mail">
          <span className="text-blue-600 font-bold">🗂</span>
          <span>{progreso.enCarpeta} ya en la carpeta</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-green-600 font-bold">✓</span>
          <span>{progreso.encontradas} bajadas del mail</span>
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
        {progreso.sinFuente > 0 && (
          <div className="flex items-center gap-1 col-span-2" title="El proveedor no tiene mail cargado y no hubo reenvío donde buscar. Cargá el mail en Config PDFs o desde el buscador">
            <span className="text-orange-500 font-bold">✉</span>
            <span>{progreso.sinFuente} sin mail del proveedor (no se buscaron)</span>
          </div>
        )}
        {progreso.otros > 0 && (
          <div className="flex items-center gap-1 col-span-2">
            <span className="text-gray-500 font-bold">·</span>
            <span>{progreso.otros} sin búsqueda (ej. Portal)</span>
          </div>
        )}
      </div>

      {progreso.errorCarpeta && (
        <div className="mt-2 text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
          🗂️ No se pudo leer una carpeta — esas facturas se buscaron igual en el mail. {progreso.errorCarpeta}
        </div>
      )}

      {control && (
        control.cierra ? (
          <div className="mt-2 text-[11px] text-green-700">✓ Control: las {control.esperado} facturas del lote están contadas.</div>
        ) : (
          <div className="mt-2 text-xs font-semibold text-red-700 bg-red-50 border-2 border-red-300 rounded p-2">
            ⛔ El control no cierra: {control.suma} contadas de {control.esperado}. Es un error de la app — avisá con una nota.
          </div>
        )
      )}

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
