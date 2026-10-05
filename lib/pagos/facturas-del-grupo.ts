/**
 * 🧾 **A-BUG-173 — traer las facturas que componen un grupo de pago.**
 *
 * En el Cash Flow un grupo se ve como **una fila consolidada**: el comprobante llega unido
 * (`FC 6347 - ALCORTA | FC 6328 - ALCORTA | …`) y el importe **sumado**. Para que el Detalle de Pago
 * liste una línea por factura hace falta el importe de cada una, y eso sólo está en la base.
 *
 * 📌 **Por qué no se parte el texto y listo**: el texto tiene los comprobantes pero **no los
 * importes**. Partirlo daría tres renglones sin plata — peor que agruparlos.
 */

import { totalEnPesos, conversionDe } from './moneda-factura'
import { supabase } from '@/lib/supabase'
import type { SubFactura } from './lineas-detalle-pago'

/**
 * Devuelve las facturas de un grupo, listas para el cuadro 1.
 *
 * ⚠️ Si algo falla **devuelve vacío en vez de romper**: sin esto el detalle se sigue emitiendo
 * agrupado, como hasta hoy. El control de integridad del PDF es el que decide si eso es aceptable —
 * acá no se toma esa decisión.
 */
export async function facturasDelGrupo(
  schema: string,
  ids: string[],
): Promise<SubFactura[]> {
  if (!ids || ids.length === 0) return []

  try {
    const { data, error } = await supabase
      .schema(schema as any)
      .from('comprobantes_arca')
      .select('tipo_comprobante, punto_venta, numero_desde, fecha_emision, imp_total, descuento_aplicado, moneda, tc_pago, tipo_cambio')
      .in('id', ids)
    if (error || !data) return []

    /**
     * 🏷️ **Sin los ceros de relleno.** Pedido del usuario 2026-09-13 al ver el PDF de Alcorta:
     * *«a mí me gusta más la FC corta; para este tipo de reporte puede tener el prefijo mejor, para
     * evitar tantos ceros»*.
     *
     * `FC 1-00010-00006337` → **`FC 1-10-6337`**. Se conserva el prefijo —tipo y punto de venta, que
     * es lo que identifica el comprobante sin ambigüedad— y se va el relleno, que no aporta nada y
     * hace difícil leer el número de un vistazo.
     */
    return data.map((f: any) => ({
      comprobante: `FC ${f.tipo_comprobante}-${Number(f.punto_venta ?? 0)}-${Number(f.numero_desde ?? 0)}`,
      fecha: f.fecha_emision ?? null,
      // 💵 A-BUG-1245 — una factura en dólares del grupo se lista en pesos, como el resto del papel.
      imp_total: totalEnPesos(f),
      conversion: conversionDe(f),
      descuento_aplicado: f.descuento_aplicado ?? null,
    }))
  } catch {
    return []
  }
}
