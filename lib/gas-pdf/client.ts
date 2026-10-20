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
import { agruparPorCarpeta, decidirVinculosCarpeta, rotuloFactura, type FacturaParaCarpeta, type HallazgoCarpeta, type DecisionCarpeta, type ItemInforme } from './lote'

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
  /** Avance de la etapa carpeta: qué mes está leyendo y cuántos archivos van (el OCR es lento) */
  carpetaAvance?: { carpeta: string; nroCarpeta: number; totalCarpetas: number; leidos: number; restantes: number }
  actual?: {
    factura_id: string
    resultado?: ApiBuscarPdfOutput
  }
  finalizado: boolean
  cancelado?: boolean
  /** Resultado del envío del mail resumen al cerrar el lote (para no fallar en silencio) */
  resumenEnviado?: boolean
  resumenError?: string
  /** El informe por factura, agrupable por proceso, con el link de cada archivo (A-FEAT-1287) */
  informe?: ItemInforme[]
}

/** Inicia ProgresoLote vacío */
function nuevoProgreso(loteId: string, total: number): ProgresoLote {
  return {
    loteId, total,
    procesadas: 0, encontradas: 0, paraRevisar: 0, noEncontradas: 0, errores: 0,
    enCarpeta: 0, sinFuente: 0, otros: 0,
    finalizado: false, informe: [],
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
    // «No encontrada»: recién ahora que la respuesta llegó se pasa a NO Mail (2º paso). Si falla,
    // queda como estaba y cuenta como error para reintentar.
    if (data.ok && data.resultado_gas === 'no_encontrada') {
      try {
        const r2 = await fetch('/api/gas/buscar-pdf', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...input, aplicar_no_encontrada: true }),
        })
        const d2 = await r2.json().catch(() => ({ ok: false, error: `HTTP ${r2.status}` }))
        if (!d2.ok) return { ok: false, factura_id: input.factura_id, error: `No se encontró, pero no se pudo dejar en NO Mail: ${d2.error || ''}` }
      } catch (e) {
        return { ok: false, factura_id: input.factura_id, error: `No se encontró, pero se cortó la conexión antes de dejarla en NO Mail: ${(e as Error).message}` }
      }
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
    candidatos: out.candidatos,
  }
}

/** El renglón del informe para una factura que fue al mail. */
function aItemInforme(out: ApiBuscarPdfOutput, f: FacturaParaCarpeta | undefined): ItemInforme {
  const proceso: ItemInforme['proceso'] = !out.ok ? 'error'
    : out.fc_nuevo === 'APP' ? 'mail'
      : out.fc_nuevo === 'VER' ? 'revisar'
        : out.fc_nuevo === 'NO Mail' ? 'no_encontrada'
          : out.fc_nuevo === 'Buscar' ? 'sin_fuente' : 'otro'
  const links = out.candidatos && out.candidatos.length > 1
    ? out.candidatos.map((c, i) => ({ url: c.drive_url, rotulo: `candidato ${i + 1}` }))
    : out.drive_url ? [{ url: out.drive_url, rotulo: proceso === 'revisar' ? 'candidato' : 'PDF' }] : []
  return {
    factura_id: out.factura_id,
    factura: out.factura_label || rotuloFactura(f, out.factura_id),
    proveedor: out.proveedor || f?.denominacion_emisor || '',
    proceso, links,
    detalle: out.observaciones || out.error,
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
  const informe: ItemInforme[] = []
  const facturaDe = (id: string) => opts.facturas?.find(f => f.id === id)
  const debug: DebugItem[] = []   // 1 línea por factura (resultado + observación con queries) para el mail

  // ── 1 · Primero la carpeta (A-FEAT-1287) ──
  let pendientes = opts.facturaIds
  if (opts.facturas && opts.facturas.length > 0) {
    progreso = { ...progreso, fase: 'carpeta' }
    opts.onProgreso?.(progreso)
    const deCarpeta = await vincularDesdeCarpetas(opts.empresa, opts.facturas.filter(f => opts.facturaIds.includes(f.id)), opts.isCancelled, loteId,
      av => { progreso = { ...progreso, carpetaAvance: av }; opts.onProgreso?.(progreso) })
    // Lo resuelto en la carpeta no sale al mail: lo vinculado y lo que quedó a revisar (tiene candidatos)
    pendientes = opts.facturaIds.filter(id => !deCarpeta.vinculadas.has(id) && !deCarpeta.aRevisar.has(id))
    for (const d of deCarpeta.decisiones) {
      if (!deCarpeta.vinculadas.has(d.factura_id) && !deCarpeta.aRevisar.has(d.factura_id)) continue
      const f = facturaDe(d.factura_id)
      const item: ItemInforme = {
        factura_id: d.factura_id, factura: rotuloFactura(f, d.factura_id), proveedor: f?.denominacion_emisor || '',
        proceso: d.accion === 'vincular' ? 'carpeta' : 'revisar',
        links: d.accion === 'vincular' && d.drive_url
          ? [{ url: d.drive_url, rotulo: d.archivo || 'PDF' }]
          : d.candidatos.map((c, i) => ({ url: c.drive_url, rotulo: d.candidatos.length > 1 ? `candidato ${i + 1}` : 'candidato' })),
        detalle: d.accion === 'vincular' ? d.archivo : d.motivo,
      }
      informe.push(item)
      resultados.push({
        empresa: opts.empresa, status: d.accion === 'vincular' ? 'carpeta' : 'revisar',
        factura: item.factura, proveedor: item.proveedor, drive_url: item.links[0]?.url,
        observaciones: d.accion === 'vincular' ? `En la carpeta: ${d.archivo || ''}` : d.motivo,
        candidatos: d.candidatos.length > 1 ? d.candidatos.map(c => ({ drive_url: c.drive_url, observaciones: `${c.archivo} — ${c.motivo}` })) : undefined,
      })
    }
    const nV = deCarpeta.vinculadas.size, nR = deCarpeta.aRevisar.size
    progreso = { ...progreso, enCarpeta: nV, paraRevisar: nR, procesadas: nV + nR, errorCarpeta: deCarpeta.error, informe: [...informe] }
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
    informe.push(aItemInforme(out, facturaDe(facturaId)))
    progreso = { ...progreso, informe: [...informe] }
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
 * archivado. Usa el mismo lector que el «🔗 Vincular PDFs» de Subdiarios, con la regla de 2026-10-20:
 * CUIT + número + monto + **tipo + fecha**.
 *
 * ⚠️ Lee la carpeta ENTERA antes de vincular: recién al final se sabe si una factura tiene un archivo
 * o dos, y con dos no se vincula ninguno (`decidirVinculosCarpeta`). Nunca rompe el lote: si una
 * carpeta no se puede leer, esas facturas siguen al mail y el motivo queda en `error`.
 */
export async function vincularDesdeCarpetas(
  empresa: Empresa,
  facturas: FacturaParaCarpeta[],
  isCancelled?: () => boolean,
  loteId?: string,
  onAvance?: (av: NonNullable<ProgresoLote['carpetaAvance']>) => void,
): Promise<{ vinculadas: Set<string>; aRevisar: Set<string>; decisiones: DecisionCarpeta[]; error?: string }> {
  const exactos: HallazgoCarpeta[] = []
  const dudosos: HallazgoCarpeta[] = []
  let error: string | undefined
  const carpetas = agruparPorCarpeta(facturas)
  for (const [nc, carpeta] of carpetas.entries()) {
    if (isCancelled?.()) break
    const skip = new Set<string>()
    const rotulo = `${String(carpeta.mes).padStart(2, '0')}/${carpeta.anio}`
    let leidos = 0
    onAvance?.({ carpeta: rotulo, nroCarpeta: nc + 1, totalCarpetas: carpetas.length, leidos: 0, restantes: 0 })
    for (let guard = 0; guard < 200; guard++) {
      if (isCancelled?.()) break
      const pedir = async (cuantos: number) => {
        try {
          const r = await fetch('/api/gas/auditar-periodo', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empresa, anio: carpeta.anio, mes: carpeta.mes, factura_ids: carpeta.ids, skip_file_ids: [...skip], max_files: cuantos }),
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
      for (const m of (data.matched || []) as HallazgoCarpeta[]) { if (m.file_id) skip.add(m.file_id); exactos.push(m) }
      for (const d of (data.dudosos || []) as HallazgoCarpeta[]) dudosos.push(d)
      for (const h of (data.huerfanos || [])) if (h.file_id) skip.add(h.file_id)
      leidos += Number(data.procesados) || 0
      onAvance?.({ carpeta: rotulo, nroCarpeta: nc + 1, totalCarpetas: carpetas.length, leidos, restantes: Number(data.restantes) || 0 })
      if (data.completo) break
    }
  }

  const decisiones = decidirVinculosCarpeta(facturas.map(f => f.id), exactos, dudosos)
  const vinculadas = new Set<string>()
  const aRevisar = new Set<string>()
  if (decisiones.length > 0 && !isCancelled?.()) {
    try {
      const r = await fetch('/api/gas/auditar-periodo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // anio/mes no se usan al aplicar, pero la ruta los exige
        body: JSON.stringify({ empresa, anio: 1, mes: 1, aplicar: decisiones, lote_id: loteId }),
      })
      const data = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
      if (!data.ok) throw new Error(data.error || `HTTP ${r.status}`)
      for (const d of decisiones) (d.accion === 'vincular' ? vinculadas : aRevisar).add(d.factura_id)
    } catch (e) {
      error = `No se pudo guardar lo encontrado en la carpeta: ${(e as Error).message}`
    }
  }
  return { vinculadas, aRevisar, decisiones, error }
}
