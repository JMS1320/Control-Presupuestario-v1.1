import { pareceDetalleAutogenerado } from "@/lib/conciliacion/columnas-extracto"

/**
 * ✏️ **El Detalle del Cash Flow muestra sólo lo que escribió el usuario** (A-DEC-1005 / A-BUG-1250).
 *
 * Pedido del usuario 2026-10-14: *«en detalle veo un encadenado, pero eso no tiene sentido de ser hoy:
 * ese encadenado era lo que antes iba a detalle en extracto, y eso ya está corregido… se debería ver
 * en blanco en vez de ver el encadenado, y yo agregar algo si quiero»*.
 *
 * Hasta acá la celda mostraba «FC nro - proveedor · nota» — armado al mostrar — y al editarla se
 * guardaba ese texto entero, que después viajaba al extracto. Además ~360 facturas tienen GUARDADO
 * como detalle sólo «FC nro - proveedor» (resto de A-DAT-54): eso no es del usuario y no se muestra.
 *
 * 📌 Sólo cambia lo que se VE y se EDITA en la columna. El texto armado (`detalle`) sigue existiendo
 * para quien lo usa por dentro (buscador, PDF y mail del Detalle de pago), y al extracto viaja lo
 * mismo que antes.
 */
export function detallePropio(
  detalle: string | null | undefined,
  emisor: string | null | undefined,
  numero?: string | number | null,
): string | null {
  const d = (detalle ?? '').trim()
  if (!d) return null
  return pareceDetalleAutogenerado(d, emisor, numero) ? null : d
}

export interface DetalleDeFactura {
  id: string
  /** `FC 6377`: para saber de cuál es cada nota dentro de un grupo. */
  etiqueta: string
  detalle: string
}

/** En una fila de GRUPO: «6377: nota | 6383: otra nota», sólo las que tienen algo propio. */
export function detallePropioDeGrupo(items: readonly DetalleDeFactura[]): string | null {
  const con = items.filter(i => i.detalle.trim())
  return con.length ? con.map(i => `${i.etiqueta}: ${i.detalle.trim()}`).join(' | ') : null
}
