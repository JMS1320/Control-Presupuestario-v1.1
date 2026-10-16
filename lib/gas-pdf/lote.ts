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
