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
}

/**
 * Las carpetas a recorrer, en orden de mes, con las facturas que pueden estar en cada una. Una
 * factura aparece en DOS (su mes y el siguiente); las que ya tienen PDF no se buscan.
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

/** Pendiente de buscar = estado FC «Buscar» o sin estado. Son las que vienen marcadas y arriba. */
export const esPendienteDeBuscar = (f: { fc?: string | null }) => f.fc === 'Buscar' || f.fc == null

/**
 * Las facturas que ofrece el modal Buscar PDFs: sin el histórico (comprobantes_historico, con fc
 * «SI» / «NO» / «PEAJE» — no es un comprobante de ARCA y no tiene dónde guardar el PDF) y con las
 * pendientes primero. Visto por el usuario 2026-10-19: aparecían «Sí» verde y «SI» gris mezclados.
 */
export function candidatosParaBuscar<T extends { fc?: string | null; estado?: string | null }>(facturas: readonly T[]): T[] {
  return facturas
    .filter(f => f.estado !== 'historico')
    .slice()
    .sort((a, b) => Number(esPendienteDeBuscar(b)) - Number(esPendienteDeBuscar(a)))
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
