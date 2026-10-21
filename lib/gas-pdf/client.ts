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
import { agruparPorCarpeta, listasTrasCarpeta, decidirVinculosCarpeta, rotuloFactura, textoLeido, type FacturaParaCarpeta, type HallazgoCarpeta, type DecisionCarpeta, type ItemInforme } from './lote'
import { cruzarConInventario, barrerReenvios, cerrarNoEncontradas, type AvanceBarrido } from './barrido'
import { hoyArgentina } from '@/lib/fechas'

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
  /**
   * Dónde buscar (usuario 2026-10-20): las dos (default: primero la carpeta, lo que falta al mail),
   * sólo la carpeta (lo que no está queda como estaba) o sólo el mail.
   */
  donde?: 'ambos' | 'carpeta' | 'mail'
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
  /** En qué paso está: carpeta, inventario de reenvíos ya leídos, mail del proveedor, o leyendo reenvíos */
  fase?: 'carpeta' | 'inventario' | 'mail' | 'reenvios'
  /** Avance de la lectura de reenvíos (A-FEAT-1287, 2026-10-20) */
  reenviosAvance?: AvanceBarrido
  /** Si la carpeta no se pudo leer: el motivo. Esas facturas igual salen al mail (salvo «sólo carpeta») */
  errorCarpeta?: string
  /** Dónde se buscó: para que los carteles y el «reintentar» digan lo que de verdad se hizo */
  donde?: 'ambos' | 'carpeta' | 'mail'
  /** Archivos de la carpeta que no se pudieron leer (tardaron demasiado o fallaron): se abren a mano */
  archivosNoLeidos?: ArchivoNoLeido[]
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

export interface ArchivoNoLeido { carpeta: string; archivo: string; url: string; motivo: string }

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
// 65 s: más que el tope del servidor (50 s + margen), para que llegue SU error explicado y no un «aborted»
export async function buscarPdfFactura(input: ApiBuscarPdfInput, timeoutMs = 65000): Promise<ApiBuscarPdfOutput> {
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
    // queda como estaba y cuenta como error para reintentar. Con `sin_reenvios` todavía falta leer los
    // reenvíos: el NO Mail lo decide el lote al terminar (barrido.ts).
    if (data.ok && data.resultado_gas === 'no_encontrada' && !input.sin_reenvios) {
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
    const e = err as Error
    if (e.name === 'AbortError') return { ok: false, factura_id: input.factura_id, error: `No hubo respuesta en ${timeoutMs / 1000} s; la factura quedó como estaba. Se puede reintentar.` }
    return { ok: false, factura_id: input.factura_id, error: e.message || 'Error de red' }
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

/**
 * Lo del informe que el mail resumen no traía (usuario 2026-10-21: «no muestra las que salieron con
 * error»): errores, no están en la carpeta, sin terminar y no encontradas, con su motivo. Lo vinculado
 * y lo a revisar ya van en `resultados`, con el mail de donde vino.
 */
function faltantesParaElMail(informe: readonly ItemInforme[], empresa: Empresa): ResumenItem[] {
  const status: Partial<Record<ItemInforme['proceso'], ResumenItem['status']>> = {
    error: 'error', no_en_carpeta: 'no_en_carpeta', sin_terminar: 'sin_terminar', no_encontrada: 'no_encontrada', sin_fuente: 'no_encontrada',
  }
  return informe.filter(it => status[it.proceso]).map(it => ({
    empresa, status: status[it.proceso]!, factura: it.factura, proveedor: it.proveedor, observaciones: it.detalle,
  }))
}

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
  const timeout = opts.timeoutMsPorFactura ?? 65000
  let progreso = nuevoProgreso(loteId, opts.facturaIds.length)
  const resultados: ResumenItem[] = []
  const informe: ItemInforme[] = []
  const facturaDe = (id: string) => opts.facturas?.find(f => f.id === id)
  const debug: DebugItem[] = []   // 1 línea por factura (resultado + observación con queries) para el mail

  // ── 1 · Primero la carpeta (A-FEAT-1287) ──
  const donde = opts.donde ?? 'ambos'
  progreso = { ...progreso, donde }
  let pendientes = opts.facturaIds
  let deCarpeta: Awaited<ReturnType<typeof vincularDesdeCarpetas>> | null = null
  if (donde !== 'mail' && opts.facturas && opts.facturas.length > 0) {
    progreso = { ...progreso, fase: 'carpeta' }
    opts.onProgreso?.(progreso)
    deCarpeta = await vincularDesdeCarpetas(opts.empresa, opts.facturas.filter(f => opts.facturaIds.includes(f.id)), opts.isCancelled, loteId,
      av => { progreso = { ...progreso, carpetaAvance: av }; opts.onProgreso?.(progreso) })
    // Lo resuelto en la carpeta no sale al mail: lo vinculado y lo que quedó a revisar (tiene candidatos)
    const dcar = deCarpeta
    pendientes = opts.facturaIds.filter(id => !dcar.vinculadas.has(id) && !dcar.aRevisar.has(id))
    for (const d0 of deCarpeta.decisiones) {
      if (!deCarpeta.vinculadas.has(d0.factura_id) && !deCarpeta.aRevisar.has(d0.factura_id)) continue
      // Sin los candidatos que el usuario ya había descartado («No es ésta»)
      const dc = deCarpeta
      const d = { ...d0, candidatos: d0.candidatos.filter(c => !dc.descartados.has(`${d0.factura_id}|${c.drive_url}`)) }
      const f = facturaDe(d.factura_id)
      const item: ItemInforme = {
        factura_id: d.factura_id, factura: rotuloFactura(f, d.factura_id), proveedor: f?.denominacion_emisor || '',
        proceso: d.accion === 'vincular' ? 'carpeta' : 'revisar',
        links: d.accion === 'vincular' && d.drive_url
          ? [{ url: d.drive_url, rotulo: d.archivo || 'PDF' }]
          : d.candidatos.map((c, i) => ({ url: c.drive_url, rotulo: d.candidatos.length > 1 ? `candidato ${i + 1}` : 'candidato', leido: textoLeido(c.leido) || undefined })),
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
    progreso = { ...progreso, enCarpeta: nV, paraRevisar: nR, procesadas: nV + nR, errorCarpeta: deCarpeta.error, archivosNoLeidos: deCarpeta.noLeidos, informe: [...informe] }
  }

  // Sólo carpeta: lo que no estaba no sale al mail y queda como estaba (usuario 2026-10-20)
  if (donde === 'carpeta') {
    let otros = 0, errores = 0
    for (const id of pendientes) {
      const f = facturaDe(id)
      const conError = !deCarpeta || deCarpeta.conError.has(id)
      const incompleta = !!deCarpeta?.incompletas.has(id)
      if (conError) errores++; else otros++
      informe.push({
        factura_id: id, factura: rotuloFactura(f, id), proveedor: f?.denominacion_emisor || '',
        proceso: conError ? 'error' : 'no_en_carpeta', links: [],
        detalle: conError ? (deCarpeta?.error || 'No se pudo leer la carpeta')
          : incompleta ? 'No apareció, pero hay archivos de su carpeta que no se pudieron leer (están al final del informe): puede ser uno de ésos. No se buscó en el mail.'
            : 'No se buscó en el mail',
      })
    }
    progreso = { ...progreso, procesadas: progreso.total, otros: progreso.otros + otros, errores: progreso.errores + errores, informe: [...informe] }
    pendientes = []
  }

  // Lo resuelto desde el inventario o los reenvíos: al informe, al mail resumen y a los contadores
  const registrar = (items: ItemInforme[]) => {
    for (const it of items) {
      informe.push(it)
      resultados.push({ empresa: opts.empresa, status: it.proceso === 'mail' ? 'ok' : 'revisar', factura: it.factura, proveedor: it.proveedor,
        drive_url: it.links[0]?.url, observaciones: `Reenvío: ${it.detalle || ''}`,
        candidatos: it.links.length > 1 ? it.links.map(l => ({ drive_url: l.url, observaciones: l.rotulo })) : undefined })
      debug.push({ factura: it.factura, resultado: it.proceso === 'mail' ? 'ok (reenvío)' : 'revisar (reenvío)', obs: it.detalle })
      progreso = { ...progreso, procesadas: progreso.procesadas + 1,
        encontradas: progreso.encontradas + (it.proceso === 'mail' ? 1 : 0), paraRevisar: progreso.paraRevisar + (it.proceso === 'revisar' ? 1 : 0) }
    }
    progreso = { ...progreso, informe: [...informe] }
  }
  // Las que todavía no se resolvieron y quedaron sin terminar (cancelación o lectura cortada)
  const sinTerminar = (ids: string[], detalle: string) => {
    for (const id of ids) {
      const f = facturaDe(id)
      informe.push({ factura_id: id, factura: rotuloFactura(f, id), proveedor: f?.denominacion_emisor || '', proceso: 'sin_terminar', links: [], detalle })
    }
    progreso = { ...progreso, procesadas: progreso.procesadas + ids.length, otros: progreso.otros + ids.length, informe: [...informe] }
  }
  const facturasDe = (ids: string[]) => ids.map(id => facturaDe(id) || ({ id } as FacturaParaCarpeta))

  // ── 2 · El inventario: lo que ya se leyó de los reenvíos, sin leer nada (A-FEAT-1287) ──
  if (pendientes.length > 0) {
    progreso = { ...progreso, fase: 'inventario' }
    opts.onProgreso?.(progreso)
    const c = await cruzarConInventario(opts.empresa, facturasDe(pendientes), loteId)
    if (c.resueltas.length > 0) {
      registrar(c.resueltas)
      const ya = new Set(c.resueltas.map(r => r.factura_id))
      pendientes = pendientes.filter(id => !ya.has(id))
    }
    if (c.error) debug.push({ factura: '(inventario)', resultado: 'error', obs: c.error })
  }

  // ── 3 · El mail del PROVEEDOR, factura por factura (los reenvíos van aparte, en el 4) ──
  const paraReenvios: string[] = []
  progreso = { ...progreso, fase: 'mail' }
  opts.onProgreso?.(progreso)
  for (let i = 0; i < pendientes.length; i++) {
    // Cancelación: si el caller pide cortar, frenamos antes de procesar la siguiente
    if (opts.isCancelled?.()) {
      sinTerminar([...paraReenvios, ...pendientes.slice(i)], 'Se canceló la búsqueda: quedó como estaba')
      progreso = { ...progreso, cancelado: true, finalizado: true }
      if (opts.enviarResumen !== false) {
        const res = await enviarResumenLote(resultados, progreso, debug)
        progreso = { ...progreso, resumenEnviado: res.enviado, resumenError: res.error }
      }
      opts.onProgreso?.(progreso)
      return progreso
    }
    const facturaId = pendientes[i]
    const out = await buscarPdfFactura({ factura_id: facturaId, empresa: opts.empresa, lote_id: loteId, sin_reenvios: true }, timeout)
    // No estaba en el mail del proveedor (o no tiene mail): todavía faltan los reenvíos
    if (out.ok && (out.resultado_gas === 'no_encontrada' || out.fc_nuevo === 'Buscar')) {
      paraReenvios.push(facturaId)
      debug.push({ factura: out.factura_label, resultado: 'no en el mail del proveedor', obs: out.observaciones })
      if (i < pendientes.length - 1 && delay > 0) await new Promise(res => setTimeout(res, delay))
      continue
    }
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

  // ── 4 · Los REENVÍOS: se leen una sola vez desde la emisión más vieja hasta hoy, y lo leído queda ──
  if (paraReenvios.length > 0) {
    progreso = { ...progreso, fase: 'reenvios' }
    opts.onProgreso?.(progreso)
    const b = await barrerReenvios({
      empresa: opts.empresa, facturas: facturasDe(paraReenvios), loteId, hoy: hoyArgentina(), isCancelled: opts.isCancelled,
      onAvance: a => { progreso = { ...progreso, reenviosAvance: a }; opts.onProgreso?.(progreso) },
    })
    registrar(b.resueltas)
    const ya = new Set(b.resueltas.map(r => r.factura_id))
    const restantes = paraReenvios.filter(id => !ya.has(id))
    if (b.error) debug.push({ factura: '(reenvíos)', resultado: 'error', obs: b.error })
    if (restantes.length > 0 && b.completo && !opts.isCancelled?.()) {
      // Leído todo: recién ahora se puede decir que no está → NO Mail
      const desde = b.leidoDesde ? b.leidoDesde.split('-').reverse().join('/') : ''
      const detalle = `No está en el mail del proveedor, ni en los reenvíos, ni en los mails con factura en el asunto${desde ? ` (leídos desde el ${desde})` : ''}`
      const r = await cerrarNoEncontradas(opts.empresa, restantes, loteId, true, detalle)
      const aplicadas = new Set(r.aplicadas)
      for (const id of restantes) {
        const f = facturaDe(id)
        const ok = aplicadas.has(id)
        informe.push({ factura_id: id, factura: rotuloFactura(f, id), proveedor: f?.denominacion_emisor || '', proceso: ok ? 'no_encontrada' : 'error', links: [],
          detalle: ok ? detalle : `No se encontró, pero no se pudo dejar en NO Mail: ${r.error || 'cambió mientras tanto'}` })
      }
      progreso = { ...progreso, procesadas: progreso.procesadas + restantes.length,
        noEncontradas: progreso.noEncontradas + aplicadas.size, errores: progreso.errores + (restantes.length - aplicadas.size), informe: [...informe] }
    } else if (restantes.length > 0) {
      sinTerminar(restantes, opts.isCancelled?.() ? 'Se canceló la lectura de los reenvíos: quedó como estaba' : `La lectura de los reenvíos no terminó${b.error ? ` (${b.error})` : ''}: quedó como estaba, al volver a buscar sigue donde quedó`)
    }
  }

  if (opts.enviarResumen !== false) {
    const res = await enviarResumenLote([...resultados, ...faltantesParaElMail(informe, opts.empresa)], progreso, debug)
    progreso = { ...progreso, resumenEnviado: res.enviado, resumenError: res.error }
  }
  progreso = { ...progreso, finalizado: true, cancelado: opts.isCancelled?.() || undefined }
  opts.onProgreso?.(progreso)
  return progreso
}

/**
 * 🗂️ Mira las carpetas del mes de cada factura (y la del siguiente) y vincula lo que ya está
 * archivado. Usa el mismo lector que el «🔗 Vincular PDFs» de Subdiarios, con la regla de 2026-10-20:
 * CUIT + número + monto + **tipo + fecha**.
 *
 * ⚠️ Una factura se decide recién cuando se leyeron ENTERAS sus dos carpetas (su mes y el siguiente):
 * ahí ya se sabe si tiene un archivo o dos, y con dos no se vincula ninguno (`decidirVinculosCarpeta`).
 * Y se aplica EN ESE MOMENTO, no al final de todas las carpetas (usuario 2026-10-21): antes, una corrida
 * larga que se cortaba perdía todo lo leído; ahora un corte sólo pierde la carpeta en curso.
 * Nunca rompe el lote: si una carpeta no se puede leer, esas facturas siguen al mail y el motivo queda en `error`.
 */
export async function vincularDesdeCarpetas(
  empresa: Empresa,
  facturas: FacturaParaCarpeta[],
  isCancelled?: () => boolean,
  loteId?: string,
  onAvance?: (av: NonNullable<ProgresoLote['carpetaAvance']>) => void,
): Promise<{ vinculadas: Set<string>; aRevisar: Set<string>; decisiones: DecisionCarpeta[]; error?: string; conError: Set<string>; descartados: Set<string>; noLeidos: ArchivoNoLeido[]; incompletas: Set<string> }> {
  const exactos: HallazgoCarpeta[] = []
  const dudosos: HallazgoCarpeta[] = []
  let error: string | undefined
  // Facturas cuya carpeta no se pudo leer entera: no se puede decir que «no están»
  const conError = new Set<string>()
  // Archivos que no se pudieron leer, y las facturas de esas carpetas: de ésas no se puede afirmar «no está»
  const noLeidos: ArchivoNoLeido[] = []
  const incompletas = new Set<string>()
  const carpetas = agruparPorCarpeta(facturas)
  const todos = facturas.map(f => f.id)
  const vinculadas = new Set<string>()
  const aRevisar = new Set<string>()
  const descartados = new Set<string>()
  const decisiones: DecisionCarpeta[] = []
  // Decide y aplica las facturas que ya tienen sus carpetas leídas
  const aplicar = async (listas: string[]) => {
    if (listas.length === 0) return
    const enLista = new Set(listas)
    // Con TODO el lote (un archivo que sirve a otra factura no se vincula solo), pero sólo para las listas
    const decs = decidirVinculosCarpeta(todos, exactos, dudosos).filter(d => enLista.has(d.factura_id))
    const decididas = new Set(decs.map(d => d.factura_id))
    const sinHallazgo = listas.filter(id => !decididas.has(id) && !incompletas.has(id))
    try {
      const r = await fetch('/api/gas/auditar-periodo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // anio/mes no se usan al aplicar, pero la ruta los exige
        body: JSON.stringify({ empresa, anio: 1, mes: 1, aplicar: decs, sin_hallazgo: sinHallazgo, lote_id: loteId }),
      })
      const data = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
      if (!data.ok) throw new Error(data.error || `HTTP ${r.status}`)
      decisiones.push(...decs)
      // Lo que la ruta efectivamente hizo (puede saltear un archivo que el usuario ya descartó)
      if (Array.isArray(data.idsVinculadas)) {
        for (const id of data.idsVinculadas) vinculadas.add(id)
        for (const id of data.idsARevisar || []) aRevisar.add(id)
        for (const k of data.descartados || []) descartados.add(k)
      } else {
        for (const d of decs) (d.accion === 'vincular' ? vinculadas : aRevisar).add(d.factura_id)
      }
    } catch (e) {
      error = `No se pudo guardar lo encontrado en la carpeta: ${(e as Error).message}`
    }
  }
  for (const [nc, carpeta] of carpetas.entries()) {
    if (isCancelled?.()) break
    const rotulo = `${String(carpeta.mes).padStart(2, '0')}/${carpeta.anio}`
    onAvance?.({ carpeta: rotulo, nroCarpeta: nc + 1, totalCarpetas: carpetas.length, leidos: 0, restantes: 0 })
    const pedir = async (extra: Record<string, unknown>) => {
      try {
        const r = await fetch('/api/gas/auditar-periodo', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empresa, anio: carpeta.anio, mes: carpeta.mes, factura_ids: carpeta.ids, ...extra }),
        })
        const txt = await r.text()
        try { return JSON.parse(txt) } catch { return { ok: false, error: `HTTP ${r.status} — la respuesta no es JSON: ${txt.slice(0, 160)}` } }
      } catch (e) {
        return { ok: false, error: (e as Error).message || 'Error de red' }
      }
    }
    // 1 · Qué archivos hay (sin leerlos), ya sin los vinculados a otra factura. GAS ≥ 0.19.0.
    const lista = await pedir({ listar: true })
    if (!lista.ok) {
      error = `Carpeta ${rotulo}: no se pudo listar (${lista.error || 'error'})`
      for (const id of carpeta.ids) conError.add(id)
      continue
    }
    // 2 · Se leen EXACTAMENTE esos, de a 3; si una tanda falla, de a uno; el que igual no se puede leer
    //     se anota y se sigue. Antes, un archivo lento trababa la carpeta entera (3/2026: 49 facturas en error).
    let pend: Array<{ file_id: string; archivo: string; url: string }> = lista.existe === false ? [] : (lista.archivos || [])
    let leidos = 0
    const sumar = (data: any) => {
      for (const m of (data.matched || []) as HallazgoCarpeta[]) exactos.push(m)
      for (const d of (data.dudosos || []) as HallazgoCarpeta[]) dudosos.push(d)
    }
    while (pend.length > 0) {
      if (isCancelled?.()) break
      onAvance?.({ carpeta: rotulo, nroCarpeta: nc + 1, totalCarpetas: carpetas.length, leidos, restantes: pend.length })
      const tanda = pend.slice(0, 3)
      const data = await pedir({ file_ids: tanda.map(a => a.file_id) })
      if (data.ok) sumar(data)
      else {
        for (const a of tanda) {
          if (isCancelled?.()) break
          const d1 = await pedir({ file_ids: [a.file_id] })
          if (d1.ok) sumar(d1)
          else {
            noLeidos.push({ carpeta: rotulo, archivo: a.archivo, url: a.url, motivo: d1.error || 'no se pudo leer' })
            for (const id of carpeta.ids) incompletas.add(id)
          }
        }
      }
      leidos += tanda.length
      pend = pend.slice(tanda.length)
    }
    onAvance?.({ carpeta: rotulo, nroCarpeta: nc + 1, totalCarpetas: carpetas.length, leidos, restantes: pend.length })
    // Carpeta terminada (no cortada por cancelación): se aplican las facturas cuya última carpeta era ésta.
    // Las de una carpeta que no se pudo leer no se afirman (siguen al mail con el motivo).
    if (isCancelled?.()) break
    await aplicar(listasTrasCarpeta(carpetas, nc, conError))
  }
  return { vinculadas, aRevisar, decisiones, error, conError, descartados, noLeidos, incompletas }
}
