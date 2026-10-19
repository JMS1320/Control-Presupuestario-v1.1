/**
 * 📅 **Al conciliar una factura, su FECHA DE PAGO es la del movimiento del banco.** A-BUG-191.
 *
 * Medido 2026-10-04: de 151 facturas conciliadas contra Banco Galicia, **115 no tenían `fecha_pago`**
 * (la última, del 10/09) — y SICORE sale siempre de `fecha_pago`, así que una factura pagada sin fecha
 * no puede calcular su quincena. El dato estaba al lado: es la fecha del movimiento.
 *
 * 🎚️ **Completa, no pisa**: sólo escribe donde `fecha_pago` está vacía. Si la factura ya tiene una
 * (cargada a mano o por otro camino), manda la que está — es la § 🎚️ de `CLAUDE.md`.
 *
 * Era UN camino de los cinco que lo hacía (la asignación manual de una factura sola). Esta función la
 * llaman los otros: el motor automático, la conciliación de un grupo de facturas, la vinculación desde
 * la edición del movimiento, y el pase de «auditar» a «conciliado».
 */
type Cliente = { schema: (s: string) => any }

export async function completarFechaPago(
  supabase: Cliente, schema: string, ids: string[], fecha: string | null | undefined,
): Promise<number> {
  if (!ids.length || !fecha) return 0
  const { count, error } = await supabase.schema(schema).from('comprobantes_arca')
    .update({ fecha_pago: String(fecha).slice(0, 10) }, { count: 'exact' })
    .in('id', ids)
    .is('fecha_pago', null)
  if (error) { console.error('No se pudo completar la fecha de pago de', ids, error); return 0 }
  return count ?? 0
}
