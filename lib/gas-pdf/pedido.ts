/**
 * 📮 El mail para PEDIRLE la factura al proveedor (A-FEAT-1313 — texto acordado con el usuario 2026-10-21).
 *
 * Un mail por proveedor con todas sus facturas que faltan. Es un mail NUEVO (no una respuesta) y sale
 * de la casilla donde corre el programa de Google — la misma que busca las facturas (la de MSA).
 * La FIRMA va en el texto (usuario 2026-10-21: «Jose Martinez Sobrado» y debajo «Martinez Sobrado Agro
 * SRL»): Apps Script no agrega la firma de Gmail sola, y escribirla acá la deja a la vista en la vista previa.
 *
 * Pieza pura: la prueba `npm run probar`, y la usa la ruta para la vista previa y para el envío, así
 * lo que se ve es exactamente lo que sale.
 */
import { NOMBRE_PARA_TERCEROS, DATOS_FISCALES } from '@/lib/empresas'
import type { Empresa } from './types'

export interface FacturaPedido {
  fecha_emision?: string | null
  /** «Factura A 2-484» */
  comprobante: string
  imp_total?: number | null
}

const fecha = (f?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : 's/fecha'
}
// En positivo: una nota de crédito se reconoce por el comprobante
const importe = (n?: number | null) => n == null || !isFinite(Number(n)) ? 's/importe'
  : '$ ' + Math.abs(Number(n)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const cuitConGuiones = (c?: string | null) => {
  const d = String(c || '').replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : d
}
/** La firma del pedido, renglón por renglón (usuario 2026-10-21) */
export const FIRMA_PEDIDO = ['Jose Martinez Sobrado', 'Martinez Sobrado Agro SRL']

const escaparHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Asunto, texto y HTML del pedido. Singular o plural según cuántas facturas sean. */
export function armarPedidoProveedor(empresa: Empresa, facturas: readonly FacturaPedido[]): { asunto: string; texto: string; html: string } {
  const varias = facturas.length > 1
  const nombre = NOMBRE_PARA_TERCEROS[empresa]
  const cuit = cuitConGuiones(DATOS_FISCALES[empresa]?.cuit)
  const orden = [...facturas].sort((a, b) => (a.fecha_emision || '').localeCompare(b.fecha_emision || ''))
  const lineas = orden.map(f => `– ${fecha(f.fecha_emision)} · ${f.comprobante} · ${importe(f.imp_total)}`)
  const parrafos = [
    'Hola, ¿cómo están?',
    `Les escribimos de ${nombre}${cuit ? ` (CUIT ${cuit})` : ''}. En ARCA ${varias ? 'figuran estos comprobantes' : 'figura este comprobante'} a nuestro nombre y no recibimos ${varias ? 'las facturas' : 'la factura'}:`,
    lineas.join('\n'),
    `¿Nos ${varias ? 'las' : 'la'} podrían mandar a este mail? Si ya ${varias ? 'las' : 'la'} enviaron, les pedimos que ${varias ? 'las' : 'la'} reenvíen, por favor.`,
    'Muchas gracias.',
    FIRMA_PEDIDO.join('\n'),
  ]
  return {
    asunto: `Pedido de ${varias ? 'facturas' : 'factura'} — ${nombre}`,
    texto: parrafos.join('\n\n'),
    html: parrafos.map(p => `<p>${escaparHtml(p).replace(/\n/g, '<br>')}</p>`).join(''),
  }
}

/** «hoy» / «hace 1 día» / «hace N días» desde la fecha (ISO) de un pedido, contando en días calendario. */
export function haceCuanto(iso: string | null | undefined, hoy: string): string {
  if (!iso) return ''
  const a = Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
  const b = Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1, Number(hoy.slice(8, 10)))
  const d = Math.round((b - a) / 86_400_000)
  return d <= 0 ? 'hoy' : d === 1 ? 'hace 1 día' : `hace ${d} días`
}
