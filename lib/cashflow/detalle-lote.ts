/**
 * ✏️ A-FEAT-1570 — el DETALLE desde la barra de PAGOS del Cash Flow (nota 🌙 de JMS 05/11: «agregar editar detalle»).
 *
 * Qué filas lo aceptan en lote y cuál es «su» detalle (el que escribe el usuario, no el texto armado de la factura).
 * Quedan afuera: las ventas (se editan donde se cargan), los sueldos (se gestionan en Sueldos), el echeq de un pago en
 * varios y los GRUPOS de facturas — ahí el detalle se edita factura por factura para no pisar las notas de las otras
 * (A-FEAT-1269). Caso en `npm run probar`.
 */

export interface FilaDetalle {
  origen: string
  origen_tabla?: string | null
  detalle?: string | null
  detalle_propio?: string | null
  ids_grupo?: string[] | null
  facturas_agrupadas?: number | null
}

/** El detalle que el usuario puede editar: en una factura, el suyo (`detalle_propio`); en lo demás, el detalle de la fila. */
export const detalleEditableDe = (f: FilaDetalle) => String((f.origen === "ARCA" ? f.detalle_propio : f.detalle) ?? "")

export function detalleSeEditaEnLote(f: FilaDetalle): boolean {
  if (f.origen_tabla === "msa.cheques") return false
  if (f.origen === "TEMPLATE" || f.origen === "ANTICIPO") return true
  if (f.origen === "ARCA") return !((f.ids_grupo?.length ?? 0) > 1 || (f.facturas_agrupadas ?? 0) > 1)
  return false
}
