/**
 * ❌ LAS FACTURAS SIN PDF DEL SUBDIARIO — paso (4) de la centralización en la auditoría de Subdiarios
 * (A-FEAT-1287, acordado con el usuario 2026-10-22: «una sola pantalla es mejor que dos»).
 *
 * Para cada factura del mes que no tiene su PDF, lo que hace falta para decidir qué hacer con ella:
 * si ya se le pidió al proveedor (y hace cuánto: sin restricción de días, decisión del usuario 2026-10-21
 * — «que esté a la vista que se pidió hace tanto»), cuándo se buscó por última vez en el mail, y si
 * entra en la búsqueda (las VER tienen candidatos para confirmar, y Portal / No / OK no se buscan).
 *
 * Son las MISMAS facturas que cuenta el chip «❌ faltantes» del subdiario (`estadoArchivoDigital`):
 * si el panel listara otras, el número de arriba y la lista de abajo no coincidirían.
 *
 * Pieza pura: la prueba `npm run probar`.
 */
import { estadoArchivoDigital } from '@/lib/facturas/archivo-digital'
import { diaArgentino } from '@/lib/fechas'
import { FC_QUE_NO_SE_BUSCAN, rotuloFactura, type UltimaBusqueda, type FacturaParaCarpeta } from './lote'
import { haceCuanto } from './pedido'

export interface FacturaFaltante {
  id: string
  cuit?: string | null
  denominacion_emisor?: string | null
  tipo_comprobante_desc?: string | null
  punto_venta?: number | null
  numero_desde?: number | null
  fecha_emision?: string | null
  imp_total?: number | null
  fc?: string | null
  estado?: string | null
  pdf_drive_url?: string | null
}

export interface FilaFaltante {
  id: string
  proveedor: string
  cuit: string
  comprobante: string
  fecha_emision: string | null
  imp_total: number | null
  fc: string | null
  /** Se le pidió al proveedor: el día (hora argentina), hace cuánto y si quedó sólo en borrador */
  pedido: { dia: string; hace: string; borrador: boolean } | null
  /** Última vez que se buscó en el mail (día argentino), o null si nunca */
  ultimoMail: string | null
  /** Entra en «Buscar en el mail»: no es VER ni Portal / No / OK */
  buscable: boolean
}

export function faltantesDelSubdiario(
  facturas: readonly FacturaFaltante[],
  ultimas: ReadonlyMap<string, UltimaBusqueda>,
  hoy: string,
): { filas: FilaFaltante[]; pedidas: string[]; buscables: string[] } {
  const filas = facturas
    .filter(f => estadoArchivoDigital(f) === 'falta')
    .map((f): FilaFaltante => {
      const u = ultimas.get(f.id)
      const dia = u?.pedido ? diaArgentino(new Date(u.pedido)) : null
      return {
        id: f.id,
        proveedor: f.denominacion_emisor || '',
        cuit: String(f.cuit || '').replace(/\D/g, ''),
        comprobante: rotuloFactura(f as Partial<FacturaParaCarpeta>, f.id),
        fecha_emision: f.fecha_emision ?? null,
        imp_total: f.imp_total ?? null,
        fc: f.fc ?? null,
        pedido: dia ? { dia, hace: haceCuanto(dia, hoy), borrador: !!u?.pedidoBorrador } : null,
        ultimoMail: u?.mail ? diaArgentino(new Date(u.mail)) : null,
        buscable: f.estado !== 'historico' && !(f.fc && FC_QUE_NO_SE_BUSCAN.has(f.fc)),
      }
    })
    .sort((a, b) => a.proveedor.localeCompare(b.proveedor, 'es') || (a.fecha_emision || '').localeCompare(b.fecha_emision || ''))
  return {
    filas,
    pedidas: filas.filter(f => f.pedido).map(f => f.id),
    buscables: filas.filter(f => f.buscable).map(f => f.id),
  }
}
