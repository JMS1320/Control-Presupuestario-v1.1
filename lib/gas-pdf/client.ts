/**
 * Cliente del lado React para llamar al endpoint /api/gas/buscar-pdf.
 * Maneja lotes (procesa en serie con delay), callbacks de progreso, idempotencia.
 */

import type {
  ApiBuscarPdfInput,
  ApiBuscarPdfOutput,
  Empresa,
  FcEstado,
  ResumenItem,
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
  /** Enviar el mail resumen al cerrar el lote (default true) */
  enviarResumen?: boolean
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
  /** Resultado del envío del mail resumen al cerrar el lote (para no fallar en silencio) */
  resumenEnviado?: boolean
  resumenError?: string
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
/** Convierte un output en item de resumen (solo descargadas / a revisar) */
function aResumenItem(out: ApiBuscarPdfOutput, empresa: Empresa): ResumenItem | null {
  if (!out.ok || (out.resultado_gas !== 'ok' && out.resultado_gas !== 'revisar')) return null
  return {
    empresa,
    status: out.resultado_gas,
    factura: out.factura_label,
    proveedor: out.proveedor,
    asunto: out.asunto,
    remitente: out.remitente,
    cuerpo: out.cuerpo,
    drive_url: out.drive_url,
    observaciones: out.observaciones,
  }
}

interface DebugItem { factura?: string; resultado?: string; obs?: string }

/** Manda el mail resumen del lote SIEMPRE (aunque 0 hallazgos: incluye totales como instancia de
 *  control + una sección de debug por factura). No rompe el lote si falla, pero REPORTA el estado
 *  (antes se tragaba el error en silencio → imposible saber por qué no llegaba el mail). */
async function enviarResumenLote(resultados: ResumenItem[], progreso: ProgresoLote, debug: DebugItem[]): Promise<{ enviado: boolean; error?: string }> {
  try {
    const r = await fetch('/api/gas/enviar-resumen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resultados,
        totales: {
          total: progreso.total,
          encontradas: progreso.encontradas,
          paraRevisar: progreso.paraRevisar,
          noEncontradas: progreso.noEncontradas,
          errores: progreso.errores,
        },
        debug,
      }),
    })
    const data = (await r.json().catch(() => ({}))) as { ok?: boolean; enviado?: boolean; error?: string; observaciones?: string }
    if (!r.ok) return { enviado: false, error: data?.error || data?.observaciones || `HTTP ${r.status}` }
    if (!data?.enviado) return { enviado: false, error: data?.observaciones || data?.error || 'El GAS no confirmó el envío' }
    return { enviado: true }
  } catch (err) {
    return { enviado: false, error: (err as Error).message || 'Error de red al enviar el resumen' }
  }
}

export async function buscarPdfLote(opts: BuscarPdfLoteOptions): Promise<ProgresoLote> {
  const loteId = opts.loteId || crypto.randomUUID()
  const delay = opts.delayMs ?? 1500
  const timeout = opts.timeoutMsPorFactura ?? 60000
  let progreso = nuevoProgreso(loteId, opts.facturaIds.length)
  const resultados: ResumenItem[] = []
  const debug: DebugItem[] = []   // 1 línea por factura (resultado + observación con queries) para el mail

  for (let i = 0; i < opts.facturaIds.length; i++) {
    // Cancelación: si el caller pide cortar, frenamos antes de procesar la siguiente
    if (opts.isCancelled?.()) {
      progreso = { ...progreso, cancelado: true, finalizado: true }
      if (opts.enviarResumen !== false) {
        const res = await enviarResumenLote(resultados, progreso, debug)
        progreso = { ...progreso, resumenEnviado: res.enviado, resumenError: res.error }
      }
      opts.onProgreso?.(progreso)
      return progreso
    }
    const facturaId = opts.facturaIds[i]
    const out = await buscarPdfFactura({ factura_id: facturaId, empresa: opts.empresa, lote_id: loteId }, timeout)
    progreso = actualizarProgreso(progreso, out)
    const item = aResumenItem(out, opts.empresa)
    if (item) resultados.push(item)
    debug.push({ factura: out.factura_label, resultado: out.resultado_gas || (out.ok ? '?' : 'error'), obs: out.observaciones || out.error })
    opts.onProgreso?.(progreso)

    // Delay entre llamadas (no después de la última)
    if (i < opts.facturaIds.length - 1 && delay > 0) {
      await new Promise(res => setTimeout(res, delay))
    }
  }

  if (opts.enviarResumen !== false) {
    const res = await enviarResumenLote(resultados, progreso, debug)
    progreso = { ...progreso, resumenEnviado: res.enviado, resumenError: res.error }
  }
  progreso = { ...progreso, finalizado: true }
  opts.onProgreso?.(progreso)
  return progreso
}
