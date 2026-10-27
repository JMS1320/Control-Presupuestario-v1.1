/**
 * 🧾 EL IVA QUE VA AL LIBRO DE UNA VENTA — regla de JMS 2026-10-27:
 * *«siempre es neto gravado venta menos neto gravado gastos = neto que se carga; ídem IVA, ídem total. Las retenciones, si
 * hay en la liquidación, se cargan en la app dentro de la liquidación, pero afectan sólo al pago, no a la carga»*.
 *
 * En una liquidación de granos la columna `iva` guarda el IVA de la VENTA (lo usa el cobro esperado, que le resta la
 * comisión y el almacenaje aparte), mientras `imp_neto_gravado` e `imp_total` ya van netos de los gastos. El libro IVA
 * tiene que tomar el IVA neto de los gastos, igual que el neto. Sin esto, las 3 liquidaciones de AFA de mayo 2026 daban
 * $14.909,65 más de IVA que lo declarado y sus partes no sumaban su total.
 *
 * Para una venta sin comisión ni almacenaje devuelve el IVA tal cual.
 */
const n = (v: unknown) => Number(v) || 0
const r2 = (x: number) => Math.round(x * 100) / 100

export function ivaDelLibroVenta(v: { iva?: unknown; comision_iva?: unknown; almacenaje_iva?: unknown }): number {
  return r2(n(v.iva) - n(v.comision_iva) - n(v.almacenaje_iva))
}
