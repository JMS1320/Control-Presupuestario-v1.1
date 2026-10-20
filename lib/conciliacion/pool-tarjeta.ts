/**
 * 📅 **EN LA TARJETA, LA FACTURA SE COMPARA POR SU FECHA DE EMISIÓN** (A-BUG-1298, 2026-10-19).
 *
 * El motor compara el movimiento contra `fecha_estimada`, que en una factura es *cuándo se pensaba
 * pagar* (emisión + días). En un débito automático con tarjeta el cargo entra **el día de la factura**
 * o pocos días después, así que contra la estimada nunca daba exacto.
 *
 * 🧨 Resumen 28/05 de la VISA MSA: Medicus 807.028,07 del 21/05 contra la FC emitida el 21/05 por ese
 * mismo importe (ya neta de la NC) quedó «a auditar — la fecha estimada está a 15 días».
 *
 * Sólo cambia **la fecha con la que se compara**, en una copia del pool de lo pagado con tarjeta; la
 * factura no se toca. Mismo día → conciliado; dentro de la tolerancia → auditar, como siempre. Las
 * cuotas de templates no tienen emisión: siguen con su fecha. La cuenta corriente no pasa por acá.
 */
export function conFechaDeEmision<T extends { origen?: string | null; fecha_estimada?: string | null; fecha_emision?: string | null }>(pool: T[]): T[] {
  // `__fecha_es_emision` lo lee el motivo (A-FEAT-1298) para decir «emitida N días antes del débito».
  return pool.map(r => (r.origen === "ARCA" && r.fecha_emision ? { ...r, fecha_estimada: r.fecha_emision, __fecha_es_emision: true } : r))
}

/**
 * 🧾 **EL COMPROBANTE DE UN CARGO DE LA TARJETA ES EL RESUMEN** (A-FEAT-1295, 2026-10-19).
 *
 * Usuario: *«¿no debería referir al resumen de tarjeta, que es el comprobante?»*. La comisión, el IVA y
 * la percepción los factura el banco en el resumen: ése es el papel. Un solo rótulo para todo lo que
 * remite al resumen —lo que concilia una regla y el pago vinculado—, así se busca y se lee igual.
 * La fecha va armada a mano (dd/mm/aaaa): `toLocaleDateString` daba «28/5/2026» y depende del huso.
 */
export function etiquetaResumenTarjeta(fechaCierre: string | null | undefined): string | null {
  const d = String(fechaCierre ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  return `Resumen tarjeta cierre ${d.split("-").reverse().join("/")}`
}

/**
 * A-BUG-1302 — el resumen es el comprobante **sólo de los cargos del banco** (templates `solo_conciliacion`:
 * comisión, IVA, percepción). Chubb u Orbith también se concilian por regla en la tarjeta, pero su papel es
 * otro (la póliza, el portal): con ellos devuelve `null` y queda el rótulo de la cuota.
 */
export function comprobanteDeCargoDeTarjeta(
  esTarjeta: boolean,
  template: { solo_conciliacion?: boolean | null } | null | undefined,
  fechaCierre: string | null | undefined,
): string | null {
  return esTarjeta && template?.solo_conciliacion ? etiquetaResumenTarjeta(fechaCierre) : null
}

/**
 * 🧱 **A-DEC-1014 — en la tarjeta también se buscan las facturas «anteriores».** Las emitidas hasta el
 * 30/01/2026 se marcaron en masa `anterior` (históricas, «pagadas antes del sistema»), pero las pagadas con
 * la tarjeta entran en resúmenes que se concilian ahora: en el del 29/01, 7 de 10 pendientes tenían su
 * factura exacta ahí (usuario: *«de repente no me está conciliando nada, muchos perfectas»*).
 *
 * Una `anterior` que ya está atada a un movimiento de cualquier extracto NO se ofrece: ya tiene su pago.
 * Al conciliar, el motor la pasa a `conciliado` como a cualquier otra (ahora hay prueba del pago).
 */
export function anterioresLibres<T extends { id: string; estado?: string | null }>(facturas: T[], idsYaAtados: Set<string>): T[] {
  return facturas.filter(f => f.estado !== "anterior" || !idsYaAtados.has(String(f.id)))
}
