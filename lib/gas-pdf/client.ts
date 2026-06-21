/**
 * Cliente del lado React para llamar al endpoint /api/gas/buscar-pdf.
 * Maneja lotes (procesa en serie con delay), callbacks de progreso, idempotencia.
 */

import type {
  ApiBuscarPdfInput,
  ApiBuscarPdfOutput,
  Empresa,
  FcEstado,
} from './types'

export interface BuscarPdfLoteOptions {
  empresa: Empresa
  facturaIds: string[]
  /** UUID para agrupar el lote en log (default: generado automáticamente) */
  loteId?: string
  /** Callback con progreso después de cada llamada */
  onProgreso?: (info: ProgresoLote) => void
  /** Delay entre llamadas (default 1500ms) para no saturar quota GAS */
  delayMs?: number
  /** Timeout por factura (default 60s) */
  timeoutMsPorFactura?: number
  /** Si devuelve true antes de procesar una factura, corta el lote (cancelación) */
  isCancelled?: () => boolean
}

export interface ProgresoLote {
  loteId: string
  total: number
  procesadas: number
  encontradas: number
  paraRevisar: number
  noEncontradas: number
  errores: number
  actual?: {
    factura_id: string
    resultado?: ApiBuscarPdfOutput
  }
  finalizado: boolean
  cancelado?: boolean
}

/** Inicia ProgresoLote vacío */
function nuevoProgreso(loteId: string, total: number): ProgresoLote {
  return {
    loteId, total,
    procesadas: 0, encontradas: 0, paraRevisar: 0, noEncontradas: 0, errores: 0,
    finalizado: false,
  }
}

/** Actualiza progreso según el output recibido */
function actualizarProgreso(p: ProgresoLote, out: ApiBuscarPdfOutput): ProgresoLote {
  const next = { ...p, procesadas: p.procesadas + 1, actual: { factura_id: out.factura_id, resultado: out } }
  if (!out.ok) {
    next.errores++
  } else {
    switch (out.fc_nuevo) {
      case 'APP': next.encontradas++; break
      case 'VER': next.paraRevisar++; break
      case 'NO Mail': next.noEncontradas++; break
      default: break
    }
  }
  return next
}

/** Llama al endpoint para UNA factura */
export async function buscarPdfFactura(input: ApiBuscarPdfInput, timeoutMs = 60000): Promise<ApiBuscarPdfOutput> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch('/api/gas/buscar-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: ctrl.signal,
    })
    const data = (await r.json()) as ApiBuscarPdfOutput
    if (!r.ok) {
      return { ok: false, factura_id: input.factura_id, error: data.error || `HTTP ${r.status}` }
    }
    return data
  } catch (err) {
    return { ok: false, factura_id: input.factura_id, error: (err as Error).message || 'Error de red' }
  } finally {
    clearTimeout(t)
  }
}

/**
 * Procesa un lote en serie con delay entre llamadas.
 * El callback onProgreso se llama después de CADA factura.
 */
export async function buscarPdfLote(opts: BuscarPdfLoteOptions): Promise<ProgresoLote> {
  const loteId = opts.loteId || crypto.randomUUID()
  const delay = opts.delayMs ?? 1500
  const timeout = opts.timeoutMsPorFactura ?? 60000
  let progreso = nuevoProgreso(loteId, opts.facturaIds.length)

  for (let i = 0; i < opts.facturaIds.length; i++) {
    // Cancelación: si el caller pide cortar, frenamos antes de procesar la siguiente
    if (opts.isCancelled?.()) {
      progreso = { ...progreso, cancelado: true, finalizado: true }
      opts.onProgreso?.(progreso)
      return progreso
    }
    const facturaId = opts.facturaIds[i]
    const out = await buscarPdfFactura({ factura_id: facturaId, empresa: opts.empresa, lote_id: loteId }, timeout)
    progreso = actualizarProgreso(progreso, out)
    opts.onProgreso?.(progreso)

    // Delay entre llamadas (no después de la última)
    if (i < opts.facturaIds.length - 1 && delay > 0) {
      await new Promise(res => setTimeout(res, delay))
    }
  }

  progreso = { ...progreso, finalizado: true }
  opts.onProgreso?.(progreso)
  return progreso
}
