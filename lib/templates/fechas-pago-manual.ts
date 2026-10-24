/**
 * Fechas de una cuota creada con «Pago manual» (A-BUG-1325).
 *
 * El modal pide UNA fecha: el día en que se paga (o se va a pagar). Hasta el 2026-10-23 se guardaba
 * como vencimiento y estimada, y la fecha de pago quedaba vacía — nota del usuario: *«cuando creo
 * manual la cuota llena fecha de venc en vez de fecha de pago»*.
 *
 * - `fecha_pago`: la fecha que puso el usuario. De ahí sale la quincena de SICORE y el «pagado el».
 * - `fecha_estimada`: la misma — es la que ordena el Cash Flow (fecha_pago → estimada, como al editar).
 * - `fecha_vencimiento`: vacía. Un pago manual de un template abierto no tiene un vencimiento firme;
 *   si lo tiene, se carga desde Egresos sin Factura (único lugar donde se edita el vencimiento).
 *
 * La usan los DOS modales que crean pagos manuales (Egresos sin Factura y Cash Flow).
 */
export function fechasDePagoManual(fecha: string): { fecha_pago: string; fecha_estimada: string; fecha_vencimiento: null } {
  return { fecha_pago: fecha, fecha_estimada: fecha, fecha_vencimiento: null }
}
