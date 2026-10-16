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
import { agruparPorCarpeta, type FacturaParaCarpeta } from './lote'

export interface BuscarPdfLoteOptions {
  empresa: Empresa
  facturaIds: string[]
  /**
   * Las mismas facturas con su período, para mirar PRIMERO la carpeta (A-FEAT-1287). Sin esto el
   * lote va directo al mail, como antes. Las que se vinculan desde la carpeta no salen al mail.
   */
  facturas?: FacturaParaCarpeta[]
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
  /** Ya estaban en la carpeta del mes (o del siguiente) y se vincularon sin ir al mail */
  enCarpeta: number
  /** No se buscaron en el mail: el proveedor no tiene mail cargado y no hubo reenvío por donde buscar */
  sinFuente: number
  /** Otro desenlace sin búsqueda (ej. proveedor de Portal) */
  otros: number
  /** En qué paso está: mirando la carpeta o buscando en el mail */
  fase?: 'carpeta' | 'mail'
  /** Si la carpeta no se pudo leer: el motivo. Esas facturas igual salen al mail */
  errorCarpeta?: string
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
    enCarpeta: 0, sinFuente: 0, otros: 0,
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
      // 'Buscar' = el servidor no tuvo por dónde buscar (proveedor sin mail y sin reenvíos)
      case 'Buscar': next.sinFuente++; break
      // Antes caían en `default` y no se contaban: el lote decía «10 de 10» con 7 en los casilleros
      default: next.otros++; break
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
          enCarpeta: progreso.enCarpeta,
          sinFuente: progreso.sinFuente,
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

  // ── 1 · Primero la carpeta (A-FEAT-1287) ──
  let pendientes = opts.facturaIds
  if (opts.facturas && opts.facturas.length > 0) {
    progreso = { ...progreso, fase: 'carpeta' }
    opts.onProgreso?.(progreso)
    const deCarpeta = await vincularDesdeCarpetas(opts.empresa, opts.facturas.filter(f => opts.facturaIds.includes(f.id)), opts.isCancelled)
    pendientes = opts.facturaIds.filter(id => !deCarpeta.vinculadas.has(id))
    const n = opts.facturaIds.length - pendientes.length
    progreso = { ...progreso, enCarpeta: n, procesadas: n, errorCarpeta: deCarpeta.error }
  }

  // ── 2 · Lo que falta, al mail ──
  progreso = { ...progreso, fase: 'mail' }
  opts.onProgreso?.(progreso)
  for (let i = 0; i < pendientes.length; i++) {
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
    const facturaId = pendientes[i]
    const out = await buscarPdfFactura({ factura_id: facturaId, empresa: opts.empresa, lote_id: loteId }, timeout)
    progreso = actualizarProgreso(progreso, out)
    const item = aResumenItem(out, opts.empresa)
    if (item) resultados.push(item)
    debug.push({ factura: out.factura_label, resultado: out.resultado_gas || (out.ok ? '?' : 'error'), obs: out.observaciones || out.error })
    opts.onProgreso?.(progreso)

    // Delay entre llamadas (no después de la última)
    if (i < pendientes.length - 1 && delay > 0) {
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

/**
 * 🗂️ Mira las carpetas del mes de cada factura (y la del siguiente) y vincula lo que ya está
 * archivado. Usa el mismo lector que el «🔗 Vincular PDFs» de Subdiarios —CUIT + número + monto—,
 * sólo que acotado a ESTAS facturas. Nunca rompe el lote: si una carpeta no se puede leer, esas
 * facturas siguen al mail y el motivo queda en `error`.
 */
export async function vincularDesdeCarpetas(
  empresa: Empresa,
  facturas: FacturaParaCarpeta[],
  isCancelled?: () => boolean,
): Promise<{ vinculadas: Set<string>; error?: string }> {
  const vinculadas = new Set<string>()
  let error: string | undefined
  for (const carpeta of agruparPorCarpeta(facturas)) {
    if (isCancelled?.()) break
    const faltan = () => carpeta.ids.filter(id => !vinculadas.has(id))
    if (faltan().length === 0) continue
    const skip = new Set<string>()
    for (let guard = 0; guard < 200 && faltan().length > 0; guard++) {
      if (isCancelled?.()) break
      const pedir = async (cuantos: number) => {
        try {
          const r = await fetch('/api/gas/auditar-periodo', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empresa, anio: carpeta.anio, mes: carpeta.mes, factura_ids: faltan(), skip_file_ids: [...skip], max_files: cuantos }),
          })
          const txt = await r.text()
          try { return JSON.parse(txt) } catch { return { ok: false, error: `HTTP ${r.status} — la respuesta no es JSON: ${txt.slice(0, 160)}` } }
        } catch (e) {
          return { ok: false, error: (e as Error).message || 'Error de red' }
        }
      }
      // Misma tanda que Subdiarios (4) y mismo reintento con 1 si falla
      let data = await pedir(4)
      if (!data.ok) data = await pedir(1)
      if (!data.ok) {
        error = `Carpeta ${carpeta.mes}/${carpeta.anio}: ${data.error || 'error'}`
        break
      }
      if (data.existe === false) break
      for (const m of (data.matched || [])) {
        if (m.file_id) skip.add(m.file_id)
        if (carpeta.ids.includes(m.factura_id)) vinculadas.add(m.factura_id)
      }
      for (const h of (data.huerfanos || [])) if (h.file_id) skip.add(h.file_id)
      if (data.completo) break
    }
  }
  return { vinculadas, error }
}
