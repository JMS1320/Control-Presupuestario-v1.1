/**
 * 📨 El INVENTARIO de los reenvíos (A-FEAT-1287 — acordado con el usuario 2026-10-20).
 *
 * Antes, cada factura leía todos los reenvíos de Jose y Andrés desde su emisión hasta hoy: el mismo
 * PDF se leía una vez POR FACTURA y la búsqueda no entraba en el minuto (Sola NC 9-63, dos veces).
 * Ahora:
 *   1. el mail del PROVEEDOR se sigue buscando factura por factura (es rápido: pocos mails);
 *   2. con las que no aparecieron, se toma la emisión más vieja y se recorren los reenvíos desde esa
 *      fecha hasta hoy UNA sola vez, por tramos de días (cada llamada tiene tope de tiempo);
 *   3. cada adjunto leído queda en un inventario PERMANENTE: lo ya leído no se vuelve a leer, así que
 *      yendo de hoy hacia atrás cada sesión lee sólo el tramo nuevo;
 *   4. toda factura sin 📎 se cruza primero contra el inventario, sin leer nada.
 *
 * Las FUENTES que se recorren: cada reenviador (Jose «Documento de Jose», Andrés «FC»: remitente +
 * su asunto) y además **cualquier mail cuyo asunto diga factura, FC o fac** (usuario 2026-10-20:
 * «que se revisen ya que alguna factura tiene»). Un mail que entra por dos fuentes se lee una vez.
 *
 * Arriba, las piezas PURAS (las prueba `npm run probar`); abajo, las que hablan con el servidor.
 */
import type { Empresa } from './types'
import type { FacturaParaCarpeta, ItemInforme } from './lote'
import { rotuloFactura } from './lote'

// ── Piezas puras ─────────────────────────────────────────────────────────────────────────────────

export interface Tramo { desde: string; hasta: string }

const DIA = 86_400_000
const aMs = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
const aIso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
export const sumarDias = (iso: string, n: number) => aIso(aMs(iso) + n * DIA)

/**
 * Los tramos de días que FALTAN leer entre `desde` y `hasta` (inclusive), salteando lo ya leído,
 * cortados en ventanas de a lo sumo `dias` días y **de lo más nuevo a lo más viejo** (usuario: «ir de
 * ahora hacia atrás»).
 */
export function ventanasPendientes(desde: string, hasta: string, leidos: readonly Tramo[], dias = 7): Tramo[] {
  if (!desde || !hasta || desde > hasta) return []
  const cubierto = (d: string) => leidos.some(t => t.desde <= d && d <= t.hasta)
  const out: Tramo[] = []
  let fin: string | null = null
  let n = 0
  for (let d = hasta; d >= desde; d = sumarDias(d, -1)) {
    if (cubierto(d)) {
      if (fin) { out.push({ desde: sumarDias(d, 1), hasta: fin }); fin = null; n = 0 }
      continue
    }
    if (!fin) fin = d
    n++
    if (n === dias) { out.push({ desde: d, hasta: fin }); fin = null; n = 0 }
  }
  if (fin) out.push({ desde, hasta: fin })
  return out
}

/** Une los tramos leídos en bloques continuos, del más nuevo al más viejo. */
export function bloquesLeidos(leidos: readonly Tramo[]): Tramo[] {
  const ord = [...leidos].sort((a, b) => a.desde.localeCompare(b.desde))
  const out: Tramo[] = []
  for (const t of ord) {
    const ult = out[out.length - 1]
    if (ult && t.desde <= sumarDias(ult.hasta, 1)) { if (t.hasta > ult.hasta) ult.hasta = t.hasta }
    else out.push({ ...t })
  }
  return out.reverse()
}

/** Parte un tramo en dos mitades (cuando listar un tramo no entró en el tiempo). */
export function partirTramo(t: Tramo): Tramo[] {
  const dias = Math.round((aMs(t.hasta) - aMs(t.desde)) / DIA)
  if (dias < 1) return [t]
  const medio = sumarDias(t.desde, Math.floor(dias / 2))
  return [{ desde: sumarDias(medio, 1), hasta: t.hasta }, { desde: t.desde, hasta: medio }]
}

/** Lo que el GAS dijo de un texto del inventario contra una factura (sólo exacto o dudoso). */
export interface EvaluacionInventario {
  inventario_id: string
  hash?: string | null
  gmail_message_id: string
  factura_id: string
  nivel: 'exacto' | 'dudoso'
  motivos: string[]
  monto?: number | null
}

export interface DecisionInventario {
  factura_id: string
  accion: 'vincular' | 'revisar'
  /** El primero es el que se vincula; si es a revisar, hasta 3 para elegir */
  candidatos: EvaluacionInventario[]
  motivo: string
}

/**
 * La misma regla que la carpeta (`decidirVinculosCarpeta`): se vincula sólo si hay UN archivo con
 * los cinco datos, ningún dudoso, y ese archivo no le sirve también a otra factura del lote. Si no,
 * a revisar y elige el usuario. Un mismo PDF reenviado dos veces es UNO (se cuenta por hash). Lo que
 * el usuario descartó («No es ésta», por mail) no se vuelve a ofrecer.
 */
export function decidirDesdeInventario(
  evaluaciones: readonly EvaluacionInventario[],
  descartados: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
): DecisionInventario[] {
  const clave = (e: EvaluacionInventario) => e.hash || e.inventario_id
  // Un archivo exacto para más de una factura → compartido: no se vincula solo
  const exactosPorArchivo = new Map<string, Set<string>>()
  for (const e of evaluaciones) if (e.nivel === 'exacto') {
    if (!exactosPorArchivo.has(clave(e))) exactosPorArchivo.set(clave(e), new Set())
    exactosPorArchivo.get(clave(e))!.add(e.factura_id)
  }
  const porFactura = new Map<string, { exactos: Map<string, EvaluacionInventario>; dudosos: Map<string, EvaluacionInventario> }>()
  for (const e of evaluaciones) {
    if (descartados.get(e.factura_id)?.has(e.gmail_message_id)) continue
    if (!porFactura.has(e.factura_id)) porFactura.set(e.factura_id, { exactos: new Map(), dudosos: new Map() })
    const r = porFactura.get(e.factura_id)!
    const k = clave(e)
    if (e.nivel === 'exacto') { r.exactos.set(k, e); r.dudosos.delete(k) }
    else if (!r.exactos.has(k)) r.dudosos.set(k, e)
  }
  const out: DecisionInventario[] = []
  for (const [factura_id, r] of porFactura) {
    const candidatos = [...r.exactos.values(), ...r.dudosos.values()]
    if (candidatos.length === 0) continue
    const unico = r.exactos.size === 1 && r.dudosos.size === 0 ? [...r.exactos.values()][0] : null
    if (unico && (exactosPorArchivo.get(clave(unico))?.size ?? 0) === 1) {
      out.push({ factura_id, accion: 'vincular', candidatos: [unico], motivo: 'Encontrada en un reenvío: coinciden CUIT, número, monto, tipo y fecha' })
      continue
    }
    const motivo = candidatos.length > 1
      ? `Hay ${candidatos.length} archivos candidatos en los reenvíos: no se vinculó ninguno, elegí cuál es`
      : unico ? 'El archivo de un reenvío también coincide con otra factura: elegí vos'
        : `En un reenvío: ${candidatos[0].motivos.join(' · ') || 'falta un dato'}`
    out.push({ factura_id, accion: 'revisar', candidatos: candidatos.slice(0, 3), motivo })
  }
  return out
}

/** Una fuente de mails a inventariar. `clave` es lo que se guarda en el inventario y en los tramos. */
export interface FuenteMails { clave: string; email: string; asunto: string; nombre: string }

/** Cualquier remitente, con factura / FC / fac en el asunto (palabras separadas por «|»). */
export const FUENTE_ASUNTO: FuenteMails = {
  clave: 'asunto:factura', email: '', asunto: 'factura|facturas|fc|fac', nombre: 'Asunto «factura / FC / fac»',
}

/** «jose@…» → «Jose» para mostrar; los reenviadores se nombran por la parte antes de la @. */
export function nombreReenviador(email: string): string {
  const base = (email || '').split('@')[0].split(/[._-]/)[0]
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : email
}

/** La fecha más vieja desde la que hay que leer: la emisión más vieja, con 2 días de margen. */
export function desdeParaBarrer(facturas: ReadonlyArray<{ fecha_emision?: string | null }>): string | null {
  const fechas = facturas.map(f => (f.fecha_emision || '').slice(0, 10)).filter(Boolean).sort()
  return fechas.length ? sumarDias(fechas[0], -2) : null
}

// ── Lo que habla con el servidor ─────────────────────────────────────────────────────────────────

async function pedir(body: Record<string, unknown>): Promise<any> {
  try {
    const r = await fetch('/api/gas/inventario', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const txt = await r.text()
    try { return JSON.parse(txt) } catch { return { ok: false, error: `HTTP ${r.status} — la respuesta no es JSON: ${txt.slice(0, 160)}` } }
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Error de red' }
  }
}

export interface EstadoInventario {
  reenviadores: Array<FuenteMails & { bloques: Tramo[] }>
  adjuntos: number
  ilegibles: number
  ilegiblesLista: Array<{ gmail_message_id: string; nombre_archivo: string | null; fecha_mail: string | null; recolector: string | null; chars: number | null }>
}

export async function estadoInventario(): Promise<EstadoInventario | { error: string }> {
  const d = await pedir({ accion: 'estado' })
  if (!d.ok) return { error: d.error || 'error' }
  return d as EstadoInventario
}

/** Resultado de cruzar facturas contra el inventario: lo que se resolvió, para el informe. */
export interface ResultadoCruce { resueltas: ItemInforme[]; error?: string }

/**
 * Cruza las facturas contra el inventario (todo, o sólo los adjuntos recién leídos) y aplica lo que
 * corresponda: vincula (APP) o deja a revisar (VER). Va de a pocas facturas por llamada porque
 * guardar cada archivo en Drive lleva unos segundos.
 */
export async function cruzarConInventario(
  empresa: Empresa, facturas: FacturaParaCarpeta[], loteId: string, inventarioIds?: string[],
): Promise<ResultadoCruce> {
  const resueltas: ItemInforme[] = []
  let error: string | undefined
  const porId = new Map(facturas.map(f => [f.id, f]))
  let pendientes = facturas.map(f => f.id)
  for (let guard = 0; guard < 100 && pendientes.length > 0; guard++) {
    const tanda = pendientes.slice(0, 20)
    const d = await pedir({ accion: 'cruzar', empresa, factura_ids: tanda, inventario_ids: inventarioIds, lote_id: loteId })
    if (!d.ok) { error = d.error || 'error al cruzar con el inventario'; break }
    for (const r of (d.resueltas || []) as Array<{ factura_id: string; accion: 'vincular' | 'revisar'; links: Array<{ url: string; rotulo: string }>; detalle: string }>) {
      const f = porId.get(r.factura_id)
      resueltas.push({
        factura_id: r.factura_id, factura: rotuloFactura(f, r.factura_id), proveedor: f?.denominacion_emisor || '',
        proceso: r.accion === 'vincular' ? 'mail' : 'revisar', links: r.links, detalle: r.detalle,
      })
    }
    const sinTerminar: string[] = Array.isArray(d.sin_terminar) ? d.sin_terminar : []
    pendientes = [...sinTerminar, ...pendientes.slice(tanda.length)]
  }
  return { resueltas, error }
}

export interface AvanceBarrido {
  reenviador: string
  tramo: Tramo
  leidos: number
  porLeer: number
  encontradas: number
  /** Hasta qué fecha (hacia atrás) ya se leyó en esta corrida */
  leidoHasta?: string
}

/**
 * Recorre los reenvíos desde la emisión más vieja de `facturas` hasta hoy, sólo los días que el
 * inventario todavía no tiene, y después de cada tanda leída cruza las facturas que siguen sin
 * aparecer. Si ya aparecieron todas, deja de leer. `completo` = se leyó todo el rango sin errores
 * (recién ahí se puede decir que una factura «no está en los reenvíos»).
 */
export async function barrerReenvios(opts: {
  empresa: Empresa
  facturas: FacturaParaCarpeta[]
  loteId: string
  hoy: string
  isCancelled?: () => boolean
  onAvance?: (a: AvanceBarrido) => void
}): Promise<{ resueltas: ItemInforme[]; completo: boolean; error?: string; leidoDesde?: string }> {
  const resueltas: ItemInforme[] = []
  const desde = desdeParaBarrer(opts.facturas)
  if (!desde) return { resueltas, completo: true }
  const est = await pedir({ accion: 'estado' })
  if (!est.ok) return { resueltas, completo: false, error: est.error || 'No se pudo leer el inventario' }
  const reenviadores = (est.reenviadores || []) as EstadoInventario['reenviadores']
  if (reenviadores.length === 0) return { resueltas, completo: true }

  let pendientes = [...opts.facturas]
  let completo = true
  let error: string | undefined
  for (const rv of reenviadores) {
    const cola = ventanasPendientes(desde, opts.hoy, rv.bloques)
    let encontradas = 0
    while (cola.length > 0) {
      if (opts.isCancelled?.()) return { resueltas, completo: false, error }
      if (pendientes.length === 0) return { resueltas, completo: true, error }   // ya aparecieron todas
      const tramo = cola.shift()!
      const l = await pedir({ accion: 'listar', fuente: rv.clave, desde: tramo.desde, hasta: tramo.hasta })
      if (!l.ok) { completo = false; error = `${rv.nombre} ${tramo.desde}…${tramo.hasta}: ${l.error || 'error'}`; continue }
      if (l.incompleto) {
        const partes = partirTramo(tramo)
        if (partes.length > 1) { cola.unshift(...partes); continue }
        completo = false; error = `${rv.nombre} ${tramo.desde}: hay demasiados mails en un solo día para listarlos`; continue
      }
      let porLeer: Array<{ message_id: string; idx: number }> = l.a_leer || []
      let leidos = 0
      let conError = false
      opts.onAvance?.({ reenviador: rv.nombre, tramo, leidos, porLeer: porLeer.length, encontradas })
      for (let guard = 0; guard < 200 && porLeer.length > 0; guard++) {
        if (opts.isCancelled?.()) return { resueltas, completo: false, error }
        const tanda = porLeer.slice(0, 6)
        const r = await pedir({ accion: 'leer', fuente: rv.clave, items: tanda })
        if (!r.ok) { conError = true; error = `${rv.nombre}: ${r.error || 'error leyendo'}`; break }
        const pend: Array<{ message_id: string; idx: number }> = r.pendientes || []
        leidos += tanda.length - pend.length
        if ((r.errores || 0) > 0) conError = true
        porLeer = [...pend, ...porLeer.slice(tanda.length)]
        // Lo recién leído se cruza enseguida con las que faltan
        const nuevos: string[] = r.inventario_ids || []
        if (nuevos.length > 0 && pendientes.length > 0) {
          const c = await cruzarConInventario(opts.empresa, pendientes, opts.loteId, nuevos)
          if (c.error) error = c.error
          if (c.resueltas.length > 0) {
            resueltas.push(...c.resueltas)
            encontradas += c.resueltas.length
            const ya = new Set(c.resueltas.map(x => x.factura_id))
            pendientes = pendientes.filter(f => !ya.has(f.id))
          }
        }
        opts.onAvance?.({ reenviador: rv.nombre, tramo, leidos, porLeer: porLeer.length, encontradas, leidoHasta: tramo.desde })
      }
      if (porLeer.length > 0 || conError) { completo = false; continue }
      // Tramo leído entero: queda registrado (es el «hasta dónde se llegó»)
      const t = await pedir({ accion: 'tramo', fuente: rv.clave, desde: tramo.desde, hasta: tramo.hasta, mails: l.mensajes ?? null, adjuntos: l.adjuntos ?? null })
      if (!t.ok) { completo = false; error = t.error || 'No se pudo registrar el tramo leído' }
    }
  }
  return { resueltas, completo, error, leidoDesde: desde }
}

/**
 * Las que no aparecieron después de leer todo: un renglón en el historial («no está en los
 * reenvíos») y, si `aplicar`, pasan a NO Mail (sólo si siguen sin 📎 y en un estado automático).
 */
export async function cerrarNoEncontradas(empresa: Empresa, ids: string[], loteId: string, aplicar: boolean, detalle: string): Promise<{ ok: boolean; error?: string; aplicadas: string[] }> {
  const aplicadas: string[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const d = await pedir({ accion: 'no_encontradas', empresa, factura_ids: ids.slice(i, i + 50), lote_id: loteId, aplicar, detalle })
    if (!d.ok) return { ok: false, error: d.error, aplicadas }
    aplicadas.push(...(d.aplicadas || []))
  }
  return { ok: true, aplicadas }
}
