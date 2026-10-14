/**
 * 🧾 **Las retenciones recibidas, para el export del Subdiario de Ventas** — A-FEAT-1227 (2026-10-02),
 * rehecho en DOS APARTADOS por A-FEAT-1278 (2026-10-14).
 *
 * Pedido del usuario al ver que Genta le retiene Ganancias en cada pago: *«lo bueno va a ser ir
 * pudiendo exportar esto con Subdiario de ventas para que el contador se fije que estén declaradas
 * en ARCA»*. Es la pieza 4 del norte administrativo — **el mismo número por dos caminos**: lo que el
 * cliente dice que nos retuvo contra lo que ARCA tiene en *Mis Retenciones*.
 *
 * Y la precisión del 2026-10-14: *«un apartado retenciones de la venta (aunque no sean del mes) y
 * retenciones del mes (aunque no sean de la venta)… la factura puede ser de septiembre y el pago de
 * octubre»*. Por eso son dos miradas distintas sobre las mismas retenciones:
 *   · **De las ventas del subdiario** — todo lo retenido sobre los comprobantes de este subdiario,
 *     sea de la fecha que sea.
 *   · **Sufridas en el mes** — todo lo retenido con fecha en el mes, sea de la venta que sea. Es la
 *     que se cruza con ARCA.
 * Una retención del mes sobre una venta del subdiario está en las dos, marcada.
 *
 * Dos fuentes, y las dos van:
 *   · **Certificados** (`<empresa>.retenciones_recibidas`), con la fecha de la retención.
 *   · **Impresas en el comprobante** (`ret_iva`, `ret_iibb`: liquidaciones de granos y de hacienda),
 *     con la fecha del comprobante.
 *
 * 🕳️ **Un certificado sin fecha no se pierde** (usuario 2026-10-14: *«debería salir con warning de
 * sin fecha pero con la fecha del pago donde está asociado o con la fecha de la liquidación si no
 * está asociado a ningún pago»*): se ubica con la fecha del cobro de su comprobante —o la del
 * comprobante si no tiene cobro— y lleva un aviso. Uno sin fecha y sin comprobante no se puede
 * ubicar en ningún mes: va a `sinUbicar`, que se muestra siempre.
 */

export interface CertificadoRet {
  id?: string
  fecha: string | null
  tipo: string
  monto: number | string
  nro_certificado?: string | null
  denominacion_cliente?: string | null
  cuit_cliente?: string | null
  comprobante_venta_id?: string | null
}

export interface ComprobanteRet {
  id: string
  fecha: string | null
  nro: string | null
  cliente: string | null
  cuit: string | null
  ret_iva?: number | string | null
  ret_iibb?: number | string | null
}

export interface FilaRet {
  fecha: string
  tipo: string
  cliente: string
  cuit: string
  comprobante: string
  certificado: string
  origen: 'Certificado' | 'Impresa en el comprobante'
  importe: number
  /** Está también en el otro apartado (venta del subdiario retenida en el mes). */
  enAmbos: boolean
  aviso: string
}

export interface GrupoRet { tipo: string; filas: FilaRet[]; total: number }
export interface ApartadoRet { grupos: GrupoRet[]; total: number }

export interface ResultadoRetenciones {
  deLasVentas: ApartadoRet
  delMes: ApartadoRet
  /** Avisos de los certificados sin fecha que aparecen en este período. */
  avisos: string[]
  /** Certificados sin fecha y sin comprobante: no caen en ningún mes. */
  sinUbicar: FilaRet[]
}

const TIPO: Record<string, string> = { ganancias: 'Ganancias', iibb: 'IIBB', iva: 'IVA', suss: 'SUSS' }
const ORDEN_TIPOS = ['Ganancias', 'IIBB', 'IVA', 'SUSS']

const r2 = (n: number) => Math.round(n * 100) / 100
export const fechaAR = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
const fmtImporte = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * La fecha con la que se ubica un certificado. Si no tiene, la del cobro de su comprobante (si tiene
 * varios, el último, y lo dice) o la del comprobante. Siempre con aviso cuando no es la propia.
 */
export function fechaDelCertificado(
  cert: Pick<CertificadoRet, 'fecha'>, comp: Pick<ComprobanteRet, 'fecha'> | null, cobros: string[],
): { fecha: string | null; aviso: string } {
  if (cert.fecha) return { fecha: cert.fecha.slice(0, 10), aviso: '' }
  const fechas = [...new Set(cobros.filter(Boolean).map(f => f.slice(0, 10)))].sort()
  if (fechas.length === 1) return { fecha: fechas[0], aviso: `Sin fecha: se tomó la del cobro (${fechaAR(fechas[0])})` }
  if (fechas.length > 1) {
    const ult = fechas[fechas.length - 1]
    return { fecha: ult, aviso: `Sin fecha: el comprobante tiene ${fechas.length} cobros (${fechas.map(fechaAR).join(', ')}); se tomó el último` }
  }
  if (comp?.fecha) return { fecha: comp.fecha.slice(0, 10), aviso: `Sin fecha y sin cobro: se tomó la del comprobante (${fechaAR(comp.fecha)})` }
  return { fecha: null, aviso: 'Sin fecha y sin comprobante: no se puede ubicar en ningún mes' }
}

function agrupar(filas: FilaRet[]): ApartadoRet {
  const porTipo = new Map<string, FilaRet[]>()
  for (const f of filas) porTipo.set(f.tipo, [...(porTipo.get(f.tipo) || []), f])
  const tipos = [...porTipo.keys()].sort((a, b) => {
    const ia = ORDEN_TIPOS.indexOf(a), ib = ORDEN_TIPOS.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
  })
  const grupos = tipos.map(tipo => {
    const fs = porTipo.get(tipo)!.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.cliente.localeCompare(b.cliente))
    return { tipo, filas: fs, total: r2(fs.reduce((s, f) => s + f.importe, 0)) }
  })
  return { grupos, total: r2(grupos.reduce((s, g) => s + g.total, 0)) }
}

export function armarRetencionesSubdiario(e: {
  /** El mes, como 'AAAA-MM-DD' (primer y último día). */
  desde: string
  hasta: string
  idsSubdiario: string[]
  certificados: CertificadoRet[]
  /** Los del subdiario, los fechados en el mes y los de los certificados. */
  comprobantes: ComprobanteRet[]
  /** Fechas de los cobros de cada comprobante (para los certificados sin fecha). */
  cobrosPorComprobante?: Record<string, string[]>
}): ResultadoRetenciones {
  const enSub = new Set(e.idsSubdiario)
  const compPorId = new Map(e.comprobantes.map(c => [c.id, c]))
  const enMes = (f: string | null) => !!f && f.slice(0, 10) >= e.desde && f.slice(0, 10) <= e.hasta
  const deLasVentas: FilaRet[] = [], delMes: FilaRet[] = [], sinUbicar: FilaRet[] = []
  const avisos: string[] = []
  const vistos = new Set<string>()

  e.certificados.forEach((c, i) => {
    const clave = c.id || `#${i}`
    if (vistos.has(clave)) return
    vistos.add(clave)
    const comp = c.comprobante_venta_id ? compPorId.get(c.comprobante_venta_id) || null : null
    const { fecha, aviso } = fechaDelCertificado(c, comp, e.cobrosPorComprobante?.[c.comprobante_venta_id || ''] || [])
    const deVenta = !!c.comprobante_venta_id && enSub.has(c.comprobante_venta_id)
    const delMesSi = enMes(fecha)
    const fila: FilaRet = {
      fecha: fecha || '', tipo: TIPO[c.tipo] || c.tipo,
      cliente: c.denominacion_cliente || comp?.cliente || '', cuit: c.cuit_cliente || comp?.cuit || '',
      comprobante: comp?.nro || '', certificado: c.nro_certificado || '', origen: 'Certificado',
      importe: Number(c.monto) || 0, enAmbos: deVenta && delMesSi, aviso,
    }
    if (!fecha) { sinUbicar.push(fila); return }
    if (deVenta) deLasVentas.push(fila)
    if (delMesSi) delMes.push(fila)
    if (aviso && (deVenta || delMesSi)) {
      avisos.push(`Ret. ${fila.tipo} $${fmtImporte(fila.importe)} de ${fila.cliente || 'cliente sin nombre'}${fila.comprobante ? ` (${fila.comprobante})` : ''} — ${aviso}`)
    }
  })

  for (const c of e.comprobantes) {
    const deVenta = enSub.has(c.id), delMesSi = enMes(c.fecha)
    if (!deVenta && !delMesSi) continue
    for (const [campo, tipo] of [['ret_iibb', 'IIBB'], ['ret_iva', 'IVA']] as const) {
      const importe = Number(c[campo]) || 0
      if (Math.abs(importe) < 0.005) continue
      const fila: FilaRet = {
        fecha: (c.fecha || '').slice(0, 10), tipo, cliente: c.cliente || '', cuit: c.cuit || '',
        comprobante: c.nro || '', certificado: '', origen: 'Impresa en el comprobante',
        importe, enAmbos: deVenta && delMesSi, aviso: '',
      }
      if (deVenta) deLasVentas.push(fila)
      if (delMesSi) delMes.push(fila)
    }
  }

  return { deLasVentas: agrupar(deLasVentas), delMes: agrupar(delMes), avisos, sinUbicar }
}

/** Una celda con fórmula para SheetJS (`aoa_to_sheet` la respeta): el valor calculado va igual, por si no recalcula. */
export interface CeldaFormula { t: 'n'; v: number; f: string }
const formula = (f: string, v: number): CeldaFormula => ({ t: 'n', v, f })

const ENCABEZADO = ['Fecha', 'Razón Social', 'C.U.I.T.', 'Comprobante', 'Certificado', 'Origen', 'Importe', 'También en el otro apartado', 'Aviso']

/**
 * La solapa entera, como filas para `aoa_to_sheet`. Subtotales y totales son FÓRMULAS (se recalculan si
 * se corrige un importe) y al final está el control contra ARCA: la celda «Según ARCA» se deja vacía
 * para pegar el total de *Mis Retenciones*, y la diferencia se calcula sola.
 */
export function hojaRetenciones(
  res: ResultadoRetenciones, periodo: string, notas: string[] = [],
): (string | number | CeldaFormula | null)[][] {
  const aoa: (string | number | CeldaFormula | null)[][] = []
  const fila = () => aoa.length + 1 // número de fila de Excel de la próxima que se agregue
  aoa.push([`RETENCIONES RECIBIDAS — subdiario ${periodo}`])
  for (const n of notas) aoa.push([n])
  if (res.avisos.length || res.sinUbicar.length) {
    aoa.push([`⚠️ ${res.avisos.length + res.sinUbicar.length} certificado(s) SIN FECHA — cargá la fecha real en Comprobantes → Retenciones`])
    for (const a of res.avisos) aoa.push(['', a])
    for (const s of res.sinUbicar) {
      aoa.push(['', `Ret. ${s.tipo} $${fmtImporte(s.importe)} de ${s.cliente || 'cliente sin nombre'} — ${s.aviso} (no está en ningún apartado)`])
    }
  }
  aoa.push([])

  const subtotalesDelMes: { tipo: string; fila: number; total: number }[] = []
  const apartado = (titulo: string, ap: ApartadoRet, esDelMes: boolean) => {
    aoa.push([titulo])
    aoa.push(ENCABEZADO)
    if (!ap.grupos.length) { aoa.push(['Sin retenciones']); aoa.push([]); return }
    const filasSubtotal: number[] = []
    for (const g of ap.grupos) {
      aoa.push([`Ret. ${g.tipo}`])
      const desde = fila()
      for (const f of g.filas) {
        aoa.push([fechaAR(f.fecha), f.cliente, f.cuit, f.comprobante, f.certificado, f.origen, f.importe, f.enAmbos ? 'Sí' : '', f.aviso])
      }
      const hasta = fila() - 1
      filasSubtotal.push(fila())
      if (esDelMes) subtotalesDelMes.push({ tipo: g.tipo, fila: fila(), total: g.total })
      aoa.push([`Subtotal Ret. ${g.tipo}`, '', '', '', '', '', formula(`SUM(G${desde}:G${hasta})`, g.total)])
    }
    aoa.push([`TOTAL ${titulo.split(' — ')[0]}`, '', '', '', '', '', formula(filasSubtotal.map(n => `G${n}`).join('+'), ap.total)])
    aoa.push([])
  }
  apartado(`RETENCIONES DE LAS VENTAS DEL SUBDIARIO — aunque la retención sea de otro mes`, res.deLasVentas, false)
  apartado(`RETENCIONES SUFRIDAS EN EL MES — aunque la venta sea de otro mes`, res.delMes, true)

  if (subtotalesDelMes.length) {
    aoa.push(['CONTROL CONTRA ARCA (Mis Retenciones) — pegá el total de ARCA de cada tipo', '', '', '', '', '', 'Según la app', 'Según ARCA', 'Diferencia'])
    for (const s of subtotalesDelMes) {
      const n = fila()
      aoa.push([`Ret. ${s.tipo}`, '', '', '', '', '', formula(`G${s.fila}`, s.total), null, formula(`G${n}-H${n}`, s.total)])
    }
  }
  return aoa
}
