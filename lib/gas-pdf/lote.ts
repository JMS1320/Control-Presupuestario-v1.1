/**
 * 📧 Las piezas PURAS del buscador de PDFs por lote (A-FEAT-1287) — sin red, para que `npm run probar`
 * las pueda verificar. El que habla con el servidor es `client.ts`.
 *
 * El flujo acordado con el usuario 2026-10-16: **primero la carpeta, después el mail.** Para cada
 * factura se mira la carpeta de su mes (contable si está imputada, de emisión si no) y la del
 * siguiente; lo que ya está —porque el empleado lo subió— se vincula ahí, y sólo lo que falta sale a
 * buscarse al mail.
 */
import { mesesDondeBuscar } from '@/lib/facturas/vincular-archivo'

/** Lo mínimo de una factura para saber en qué carpetas mirar. */
export interface FacturaParaCarpeta {
  id: string
  'año_contable'?: number | null
  mes_contable?: number | null
  fecha_emision?: string | null
  pdf_drive_url?: string | null
  // Para el informe del lote (opcionales: sin ellos el renglón sale con el id)
  denominacion_emisor?: string | null
  tipo_comprobante_desc?: string | null
  punto_venta?: number | null
  numero_desde?: number | null
}

/** «Factura A 3-1520» — el rótulo de una factura en el informe y en el mail. */
export function rotuloFactura(f: Partial<FacturaParaCarpeta> | undefined, id = ''): string {
  if (!f || f.numero_desde == null) return id ? id.slice(0, 8) : '—'
  return `${f.tipo_comprobante_desc || 'FC'} ${f.punto_venta ?? ''}-${f.numero_desde}`
}

/**
 * Las carpetas a recorrer, en orden de mes, con las facturas que pueden estar en cada una. La imputada
 * aparece en UNA (su subdiario); la sin imputar en DOS (su mes de emisión y el siguiente) — ver
 * `mesesDondeBuscar`, ⚠️ cambió 2026-10-22. Las que ya tienen PDF no se buscan.
 */
export function agruparPorCarpeta(facturas: readonly FacturaParaCarpeta[]): Array<{ anio: number; mes: number; ids: string[] }> {
  const porMes = new Map<string, { anio: number; mes: number; ids: string[] }>()
  for (const f of facturas) {
    if (f.pdf_drive_url) continue
    for (const m of mesesDondeBuscar(f as unknown as Record<string, unknown>)) {
      const clave = `${m.anio}-${String(m.mes).padStart(2, '0')}`
      if (!porMes.has(clave)) porMes.set(clave, { ...m, ids: [] })
      porMes.get(clave)!.ids.push(f.id)
    }
  }
  return [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
}

/**
 * Las facturas que quedan LISTAS para decidir al terminar la carpeta número `nc`: las que ya no
 * aparecen en ninguna carpeta posterior (todas las suyas están leídas), salvo las de una
 * carpeta que no se pudo leer. Así se vincula a medida que se lee (usuario 2026-10-21) sin romper
 * la regla de «dos candidatos → ninguno»: cuando se decide, ya se vio todo lo que le corresponde.
 */
export function listasTrasCarpeta(carpetas: ReadonlyArray<{ ids: readonly string[] }>, nc: number, conError: ReadonlySet<string> = new Set()): string[] {
  const ultima = new Map<string, number>()
  carpetas.forEach((c, i) => { for (const id of c.ids) ultima.set(id, i) })
  return (carpetas[nc]?.ids || []).filter(id => ultima.get(id) === nc && !conError.has(id))
}

/** Los contadores del lote que entran en el control. */
export interface ContadoresLote {
  total: number
  procesadas: number
  enCarpeta: number
  encontradas: number
  paraRevisar: number
  noEncontradas: number
  sinFuente: number
  otros: number
  errores: number
  cancelado?: boolean
}

/**
 * 🧮 El control del lote (§ 🧮 de `CLAUDE.md`): cada factura procesada tiene que caer en UNO de los
 * casilleros. Si la suma no da, el lote perdió o contó dos veces una factura — es un error de la
 * app, no del negocio, y se muestra en rojo.
 */
export function controlDelLote(p: ContadoresLote): { cierra: boolean; suma: number; esperado: number } {
  const suma = p.enCarpeta + p.encontradas + p.paraRevisar + p.noEncontradas + p.sinFuente + p.otros + p.errores
  const esperado = p.cancelado ? p.procesadas : p.total
  return { cierra: suma === esperado && p.procesadas === esperado, suma, esperado }
}

/**
 * 📥 Al terminar una importación: los ids a buscar son los de las filas **tildadas** que **sí** se
 * crearon (una fila que falló o ya existía no tiene id y no se busca). A-FEAT-1287.
 */
export function idsParaBuscarTrasImportar(
  imputacion: ReadonlyArray<{ fila: number; buscar_pdf: boolean }>,
  idsPorFila: Record<number, string> | undefined,
): string[] {
  return imputacion.filter(d => d.buscar_pdf).map(d => idsPorFila?.[d.fila]).filter((x): x is string => !!x)
}

/**
 * Pendiente de buscar = sin 📎 y en «Buscar», sin estado, o «Sí» (Ulises la tiene: si no tiene 📎, la
 * app tiene que encontrarla — usuario 2026-10-20). Son las que vienen marcadas y arriba.
 */
export const esPendienteDeBuscar = (f: { fc?: string | null; pdf_drive_url?: string | null }) =>
  !f.pdf_drive_url && (f.fc === 'Buscar' || f.fc == null || f.fc === 'Sí')

/**
 * Estados que el buscador NO ofrece (A-FEAT-1287, 2026-10-20): Portal (se baja del portal, nunca se
 * busca ni en carpeta ni en mail), No (no corresponde), OK (revisada) y VER (ya tiene candidatos:
 * se resuelve con el ✓, buscarla otra vez sólo duplicaría archivos en _Revisar).
 */
export const FC_QUE_NO_SE_BUSCAN: ReadonlySet<string> = new Set(['Portal', 'No', 'OK', 'VER'])

/**
 * Las facturas que ofrece el modal Buscar PDFs:
 * - **sólo las que no tienen 📎** — lo que ya está vinculado no se busca;
 * - sin las de Portal, No, OK y VER (ver `FC_QUE_NO_SE_BUSCAN`);
 * - sin el histórico (comprobantes_historico, con fc «SI» / «NO» / «PEAJE» — no es un comprobante de
 *   ARCA y no tiene dónde guardar el PDF; visto por el usuario 2026-10-19);
 * - con las pendientes primero. «NO Mail» se ofrece pero no viene marcada: se puede volver a buscar.
 */
export function candidatosParaBuscar<T extends { fc?: string | null; estado?: string | null; pdf_drive_url?: string | null }>(facturas: readonly T[]): T[] {
  return facturas
    .filter(f => f.estado !== 'historico' && !f.pdf_drive_url && !(f.fc && FC_QUE_NO_SE_BUSCAN.has(f.fc)))
    .slice()
    .sort((a, b) => Number(esPendienteDeBuscar(b)) - Number(esPendienteDeBuscar(a)))
}

/**
 * 📭 Le falta el comprobante (usuario 2026-10-21): no tiene 📎 y no está en Portal, No ni OK. Es la
 * lista del aviso «sin comprobante» de Facturas ARCA. Antes ese aviso contaba las «No», que desde el
 * 2026-10-20 quiere decir lo contrario: «no corresponde, no hay que buscarla».
 */
export function faltaComprobante(f: { fc?: string | null; estado?: string | null; pdf_drive_url?: string | null }): boolean {
  return f.estado !== 'historico' && !f.pdf_drive_url && !(f.fc && ['Portal', 'No', 'OK'].includes(f.fc))
}

/**
 * ✅ «Confirmada» es el sí del administrador y SIEMPRE con archivo (usuario 2026-10-21: «yo no podría
 * poner confirmado sin linkear»). Sí = Ulises, sin link · APP = la app, con link · Confirmada = vos,
 * con link. Devuelve el link limpio si es de Google Drive, o null si no sirve.
 */
export function linkParaConfirmar(url: string | null | undefined): string | null {
  const u = (url ?? '').trim()
  return /^https:\/\/(drive|docs)\.google\.com\/\S+$/.test(u) ? u : null
}

/** Una factura en APP con su 📎 se puede confirmar: pasa a «Confirmada» con el mismo archivo. */
export function sePuedeConfirmarApp(f: { fc?: string | null; pdf_drive_url?: string | null }): boolean {
  return f.fc === 'APP' && !!linkParaConfirmar(f.pdf_drive_url)
}

/**
 * 🏷️ Los estados FC que se ponen A MANO (A-FEAT-1287, usuario 2026-10-20). «No» = no hay factura o
 * no corresponde, y lo pone SÓLO el admin: Ulises lo usaba para «no la tengo», que es «Buscar».
 * Si la factura ya tiene un estado automático (APP, VER, NO Mail, Confirmada…), se ofrece tal cual
 * para no pisarlo al guardar.
 */
export function opcionesFcManual(actual: string | null | undefined, esAdmin: boolean): Array<{ valor: string; rotulo: string }> {
  const ops = [
    { valor: 'Buscar', rotulo: 'Buscar (no la tengo)' },
    { valor: 'Sí', rotulo: 'Sí (la tengo)' },
    { valor: 'Portal', rotulo: 'Portal' },
    ...(esAdmin ? [{ valor: 'No', rotulo: 'No (no corresponde)' }] : []),
  ]
  if (actual && !ops.some(o => o.valor === actual)) ops.unshift({ valor: actual, rotulo: actual })
  return ops
}

// ── Rigor del vínculo desde la CARPETA (A-FEAT-1287, usuario 2026-10-20) ─────────────────────────

/** Un archivo de la carpeta que el lector (GAS) asoció a una factura. */
export interface HallazgoCarpeta {
  factura_id: string
  drive_url: string
  archivo: string
  file_id: string
  /** Otras facturas del lote que el MISMO archivo cumple (sólo en los exactos) */
  tambien?: string[]
  /** Por qué es dudoso: «el archivo es nota de crédito…», «no se encontró la fecha…» */
  motivos?: string[]
  /** Lo que dice el archivo (GAS ≥ 0.19.0): para decidir al revisar sin abrirlo a ciegas */
  leido?: LeidoDelArchivo
}

export interface LeidoDelArchivo { tipo?: string | null; monto?: number | null; fechas?: string[] }

export interface CandidatoArchivo { drive_url: string; archivo: string; motivo: string; leido?: LeidoDelArchivo }

/**
 * «El archivo dice: factura · $ 1.234,56 · fechas 03/03/2026, 30/03/2026» — lo que se le muestra al
 * usuario al lado de lo que dice ARCA, cuando un candidato «casi coincide» (usuario 2026-10-21: «sólo
 * veo el número de factura… no tengo cómo saber si es correcto»).
 */
export function textoLeido(l: LeidoDelArchivo | null | undefined): string {
  if (!l) return ''
  const partes: string[] = []
  partes.push(l.tipo || 'tipo no leído')
  partes.push(l.monto == null ? 'importe no leído' : '$ ' + Math.abs(Number(l.monto)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  partes.push(l.fechas && l.fechas.length ? `fecha${l.fechas.length > 1 ? 's' : ''} ${l.fechas.join(', ')}` : 'sin fechas legibles')
  return 'El archivo dice: ' + partes.join(' · ')
}

export interface DecisionCarpeta {
  factura_id: string
  /** vincular = un solo archivo y cumple todo · revisar = dudoso o más de uno: elige el usuario */
  accion: 'vincular' | 'revisar'
  drive_url?: string
  archivo?: string
  candidatos: CandidatoArchivo[]
  motivo: string
}

/**
 * 🔗 Qué hacer con lo que se encontró en la carpeta. La regla acordada:
 * - **un** archivo que cumple CUIT + número + monto + tipo + fecha, y nada más → se vincula.
 * - **dos o más** archivos para la misma factura → **no se vincula ninguno**: queda a revisar con
 *   todos, y el usuario elige. (Pasó: una nota de crédito se tomó por la factura.)
 * - un archivo que cumple CUIT + número + monto pero **falla tipo o fecha** → a revisar con el motivo.
 * - un archivo que cumple con **dos facturas** del lote → a revisar en las dos.
 * Las facturas sin ningún hallazgo no aparecen: siguen al mail.
 */
export function decidirVinculosCarpeta(
  ids: readonly string[],
  exactos: readonly HallazgoCarpeta[],
  dudosos: readonly HallazgoCarpeta[],
): DecisionCarpeta[] {
  const enLote = new Set(ids)
  const porFactura = new Map<string, { exactos: Map<string, HallazgoCarpeta>; dudosos: Map<string, HallazgoCarpeta>; compartido: boolean }>()
  const de = (id: string) => {
    if (!porFactura.has(id)) porFactura.set(id, { exactos: new Map(), dudosos: new Map(), compartido: false })
    return porFactura.get(id)!
  }
  for (const h of exactos) {
    const todas = [h.factura_id, ...(h.tambien || [])].filter(id => enLote.has(id))
    for (const id of todas) {
      const r = de(id)
      r.exactos.set(h.file_id, h)
      if (todas.length > 1) r.compartido = true
    }
  }
  for (const h of dudosos) {
    if (!enLote.has(h.factura_id)) continue
    const r = de(h.factura_id)
    if (!r.exactos.has(h.file_id)) r.dudosos.set(h.file_id, h)
  }
  const out: DecisionCarpeta[] = []
  for (const id of ids) {
    const r = porFactura.get(id)
    if (!r) continue
    const candidatos: CandidatoArchivo[] = [
      ...[...r.exactos.values()].map(h => ({ drive_url: h.drive_url, archivo: h.archivo, motivo: 'coinciden los cinco datos' })),
      ...[...r.dudosos.values()].map(h => ({ drive_url: h.drive_url, archivo: h.archivo, motivo: (h.motivos || []).join(' · ') || 'dudoso', leido: h.leido })),
    ]
    if (candidatos.length === 0) continue
    if (r.exactos.size === 1 && r.dudosos.size === 0 && !r.compartido) {
      const h = [...r.exactos.values()][0]
      out.push({ factura_id: id, accion: 'vincular', drive_url: h.drive_url, archivo: h.archivo, candidatos, motivo: 'Encontrada en la carpeta: coinciden CUIT, número, monto, tipo y fecha' })
      continue
    }
    const motivo = candidatos.length > 1
      ? `Hay ${candidatos.length} archivos candidatos en la carpeta: no se vinculó ninguno, elegí cuál es`
      : r.compartido
        ? 'El mismo archivo coincide con otra factura del lote: confirmá a cuál corresponde'
        : `Un archivo de la carpeta casi coincide: ${candidatos[0].motivo}`
    out.push({ factura_id: id, accion: 'revisar', candidatos, motivo })
  }
  return out
}

// ── El INFORME del lote (A-FEAT-1287) — por factura, agrupado por proceso, con link ──────────────

export type ProcesoInforme = 'carpeta' | 'mail' | 'revisar' | 'no_encontrada' | 'no_en_carpeta' | 'sin_terminar' | 'sin_fuente' | 'otro' | 'error'

export interface ItemInforme {
  factura_id: string
  /** «Factura A 3-1520» */
  factura: string
  proveedor: string
  proceso: ProcesoInforme
  /** El archivo vinculado, o los candidatos a elegir (con lo que dice el archivo, si se leyó) */
  links: Array<{ url: string; rotulo: string; leido?: string }>
  detalle?: string
}

/** Los grupos del informe, en el orden en que se leen: lo resuelto, lo que pide algo, lo que falta. */
export const PROCESOS_INFORME: ReadonlyArray<{ clave: ProcesoInforme; titulo: string; ayuda: string }> = [
  { clave: 'carpeta', titulo: '🗂️ Ya estaban en la carpeta', ayuda: 'Se vincularon sin ir al mail. Quedan en APP.' },
  { clave: 'mail', titulo: '✅ Bajadas del mail', ayuda: 'Del mail del proveedor o de un reenvío: se archivaron en la carpeta del mes y se vincularon. Quedan en APP.' },
  { clave: 'revisar', titulo: '⚠️ A revisar', ayuda: 'No se vinculó: hay más de un candidato o falta un dato. Elegí o confirmá desde el ✓ de la columna FC. Quedan en VER.' },
  { clave: 'no_encontrada', titulo: '❌ No encontradas', ayuda: 'Ni en la carpeta ni en el mail. Quedan en NO Mail y se pueden volver a buscar.' },
  { clave: 'no_en_carpeta', titulo: '🗂️ No están en la carpeta', ayuda: 'Búsqueda sólo en carpeta: no se buscaron en el mail. Quedan como estaban.' },
  { clave: 'sin_terminar', titulo: '⏸️ Lectura de reenvíos sin terminar', ayuda: 'No estaban en el mail del proveedor y la lectura de los reenvíos no llegó al final. Quedan como estaban: al volver a buscar sigue donde quedó.' },
  { clave: 'sin_fuente', titulo: '✉️ Sin mail del proveedor', ayuda: 'No hubo dónde buscar. Cargá el mail del proveedor y volvé a buscar. Quedan en Buscar.' },
  { clave: 'otro', titulo: '· Sin búsqueda', ayuda: 'Por ejemplo, proveedor de Portal.' },
  { clave: 'error', titulo: '! Errores', ayuda: 'Falló la búsqueda; quedan como estaban y se pueden reintentar.' },
]

/** Agrupa el informe por proceso, en el orden de PROCESOS_INFORME, sin grupos vacíos. */
export function agruparInforme(items: readonly ItemInforme[]): Array<{ clave: ProcesoInforme; titulo: string; ayuda: string; items: ItemInforme[] }> {
  return PROCESOS_INFORME
    .map(p => ({ ...p, items: items.filter(i => i.proceso === p.clave) }))
    .filter(g => g.items.length > 0)
}

/**
 * El estado FC que queda al vincular un archivo encontrado por la app. Hasta 2026-10-20 la carpeta
 * vinculaba y dejaba el estado como estaba («Buscar» con 📎). Ahora pasa a **APP** — salvo los
 * estados que puso una PERSONA: Sí (Ulises la tenía), Confirmada y OK (el usuario), Portal (de dónde
 * se baja) y No (no corresponde: si aparece con 📎, la contradicción tiene que quedar a la vista).
 */
const FC_DE_PERSONA = new Set(['Sí', 'Confirmada', 'OK', 'Portal', 'No'])
export function fcAlVincularDesdeCarpeta(actual: string | null | undefined): string {
  return actual && FC_DE_PERSONA.has(actual) ? actual : 'APP'
}

/** Un renglón del log de búsquedas, lo mínimo para ofrecer candidatos. */
export interface FilaLogCandidato {
  drive_url: string
  observaciones?: string | null
  deCarpeta: boolean
  /** El importe que leyó la app en el archivo, si lo pudo leer */
  monto_pdf?: number | null
}

/**
 * Los candidatos de una factura en VER, sacados del log: los renglones «revisar» con archivo del
 * ÚLTIMO lote en que quedó a revisar (los de búsquedas anteriores ya no cuentan), sin repetir el
 * archivo. El log llega ordenado del más nuevo al más viejo.
 */
export function candidatosDelLog(logs: ReadonlyArray<{ resultado?: string | null; drive_url?: string | null; lote_id?: string | null; observaciones?: string | null; fecha_hora?: string | null; gmail_message_id?: string | null; monto_pdf?: number | string | null }>): FilaLogCandidato[] {
  // Los que el usuario ya descartó («No es ésta») no se vuelven a ofrecer
  const descartados = descartadosDelLog(logs)
  const revisar = logs.filter(l => l.resultado === 'revisar' && l.drive_url && !esDescartado(l, descartados))
  if (revisar.length === 0) return []
  const ultimo = revisar[0]
  const delLote = ultimo.lote_id ? revisar.filter(l => l.lote_id === ultimo.lote_id) : [ultimo]
  const vistos = new Set<string>()
  const out: FilaLogCandidato[] = []
  for (const l of delLote) {
    if (vistos.has(l.drive_url!)) continue
    vistos.add(l.drive_url!)
    const obs = l.observaciones || ''
    out.push({
      drive_url: l.drive_url!, observaciones: obs.replace(/^\[carpeta\]\s*/, ''), deCarpeta: obs.startsWith('[carpeta]'),
      monto_pdf: l.monto_pdf == null || l.monto_pdf === '' ? null : Number(l.monto_pdf),
    })
  }
  return out
}

// ── El SUBDIARIO de cada factura, para el buscador (A-FEAT-1287, usuario 2026-10-20) ─────────────
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** En qué subdiario está imputada: clave «2026-09» y rótulo «Sep 2026», o «sin imputar». */
export function subdiarioDe(f: { 'año_contable'?: number | null; mes_contable?: number | null }): { clave: string; rotulo: string } {
  const a = f['año_contable'], m = f.mes_contable
  if (!a || !m || m < 1 || m > 12) return { clave: 'sin', rotulo: 'sin imputar' }
  return { clave: `${a}-${String(m).padStart(2, '0')}`, rotulo: `${MESES_CORTOS[m - 1]} ${a}` }
}

/** Los subdiarios presentes en una lista, del más nuevo al más viejo, con «sin imputar» al final. */
export function subdiariosPresentes(facturas: ReadonlyArray<{ 'año_contable'?: number | null; mes_contable?: number | null }>): Array<{ clave: string; rotulo: string; cantidad: number }> {
  const m = new Map<string, { clave: string; rotulo: string; cantidad: number }>()
  for (const f of facturas) {
    const s = subdiarioDe(f)
    if (!m.has(s.clave)) m.set(s.clave, { ...s, cantidad: 0 })
    m.get(s.clave)!.cantidad++
  }
  return [...m.values()].sort((a, b) => a.clave === 'sin' ? 1 : b.clave === 'sin' ? -1 : b.clave.localeCompare(a.clave))
}

// ── El PEDIDO de facturas faltantes (A-FEAT-1287, 2026-10-20) ─────────────────────────────────────

export interface FilaPedido {
  fecha_emision?: string | null
  proveedor: string
  /** «Factura A 2-213» — punto de venta y número sin los ceros de relleno */
  comprobante: string
  imp_total?: number | null
}

/** Las facturas del informe que se pueden reclamar al proveedor: lo que no se encontró, no tenía dónde buscarse o quedó a revisar. */
// ⚠️ cambió 2026-10-21 (usuario): un ERROR no se pide, se reintenta («error justamente es error, no
// quisiera pedirlas sino intentar buscarlas de nuevo»); y SÍ se pueden pedir las a revisar y las que no
// estaban en la carpeta.
export const SE_RECLAMA: ReadonlySet<ProcesoInforme> = new Set<ProcesoInforme>(['no_encontrada', 'no_en_carpeta', 'sin_fuente', 'revisar', 'otro'])

/**
 * El texto para pedir las facturas que faltan, listo para pegar en un mail o un WhatsApp:
 * título y una fila por factura con fecha · proveedor · comprobante · importe total.
 * El importe va en positivo: una nota de crédito ya se reconoce por el comprobante.
 */
export function textoPedidoFacturas(filas: readonly FilaPedido[]): string {
  const fecha = (f?: string | null) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || '')
    return m ? `${m[3]}/${m[2]}/${m[1]}` : 's/fecha'
  }
  const importe = (n?: number | null) => n == null || !isFinite(Number(n)) ? 's/importe'
    : '$ ' + Math.abs(Number(n)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const orden = [...filas].sort((a, b) => (a.fecha_emision || '').localeCompare(b.fecha_emision || ''))
  return ['Facturas faltantes', '', ...orden.map(f => `${fecha(f.fecha_emision)} · ${f.proveedor} · ${f.comprobante} · ${importe(f.imp_total)}`)].join('\n')
}

// ── «No es ésta» y la última búsqueda por fuente (A-FEAT-1287, usuario 2026-10-20) ─────────────

/** Los renglones del log que salen de la carpeta del mes llevan este prefijo; el resto es del mail. */
export const PREFIJO_CARPETA = '[carpeta]'

/**
 * Lo que el usuario descartó para una factura con «No es ésta» (renglón `descartado` del log): el
 * archivo y, si venía del mail, el mail. No se vuelven a ofrecer como candidatos.
 */
export interface Descartados { drive: Set<string>; mails: Set<string> }
export function descartadosDelLog(logs: ReadonlyArray<{ resultado?: string | null; drive_url?: string | null; gmail_message_id?: string | null }>): Descartados {
  const d: Descartados = { drive: new Set(), mails: new Set() }
  for (const l of logs) {
    if (l.resultado !== 'descartado') continue
    if (l.drive_url) d.drive.add(l.drive_url)
    if (l.gmail_message_id) d.mails.add(l.gmail_message_id)
  }
  return d
}
export function esDescartado(c: { drive_url?: string | null; gmail_message_id?: string | null }, d: Descartados): boolean {
  return (!!c.drive_url && d.drive.has(c.drive_url)) || (!!c.gmail_message_id && d.mails.has(c.gmail_message_id))
}

/** Sólo cuentan las búsquedas que miraron algo: no los errores, ni «proveedor sin configurar», ni los descartes. */
const RESULTADOS_DE_BUSQUEDA = new Set(['descargado', 'revisar', 'no_encontrado'])
export interface UltimaBusqueda {
  carpeta?: string
  mail?: string
  /** Cuándo se le pidió la factura al proveedor (A-FEAT-1313), y si quedó sólo como borrador */
  pedido?: string
  pedidoBorrador?: boolean
}

/** Por factura: cuándo se buscó por última vez en la carpeta y cuándo en el mail (instantes ISO). */
export function ultimasBusquedas(logs: ReadonlyArray<{ factura_id: string; fecha_hora?: string | null; resultado?: string | null; observaciones?: string | null }>): Map<string, UltimaBusqueda> {
  const out = new Map<string, UltimaBusqueda>()
  for (const l of logs) {
    if (l.fecha_hora && l.resultado === 'pedido') {
      const u = out.get(l.factura_id) || {}
      if (!u.pedido || Date.parse(l.fecha_hora) > Date.parse(u.pedido)) {
        u.pedido = l.fecha_hora
        u.pedidoBorrador = /borrador/i.test(l.observaciones || '')
      }
      out.set(l.factura_id, u)
      continue
    }
    if (!l.fecha_hora || !RESULTADOS_DE_BUSQUEDA.has(l.resultado || '')) continue
    const fuente: keyof UltimaBusqueda = (l.observaciones || '').startsWith(PREFIJO_CARPETA) ? 'carpeta' : 'mail'
    const u = out.get(l.factura_id) || {}
    const previa = u[fuente]
    if (!previa || Date.parse(l.fecha_hora) > Date.parse(previa)) u[fuente] = l.fecha_hora
    out.set(l.factura_id, u)
  }
  return out
}

/** Para un grupo de facturas (lo que se ve en la lista): la búsqueda más reciente por fuente y cuántas nunca se buscaron ahí. */
export function resumenUltimas(ids: readonly string[], ultimas: ReadonlyMap<string, UltimaBusqueda>): { carpeta?: string; mail?: string; sinCarpeta: number; sinMail: number } {
  const r: { carpeta?: string; mail?: string; sinCarpeta: number; sinMail: number } = { sinCarpeta: 0, sinMail: 0 }
  for (const id of ids) {
    const u = ultimas.get(id)
    if (u?.carpeta) { if (!r.carpeta || Date.parse(u.carpeta) > Date.parse(r.carpeta)) r.carpeta = u.carpeta } else r.sinCarpeta++
    if (u?.mail) { if (!r.mail || Date.parse(u.mail) > Date.parse(r.mail)) r.mail = u.mail } else r.sinMail++
  }
  return r
}
