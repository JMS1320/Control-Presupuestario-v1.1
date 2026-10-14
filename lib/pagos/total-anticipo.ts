/**
 * 🧾 El TOTAL de un anticipo con retención — A-BUG-1285 (2026-10-14).
 *
 * El modal de la retención del anticipo armaba el «Importe total» sumando neto + IVA, y de ahí el «Monto
 * a pagar». Pero el anticipo es por un MONTO que el usuario ya dijo, y puede incluir percepciones u otros
 * impuestos que no se cargan (usuario: *«el anticipo es ej. de 100 pesos y entre gravado e IVA tenemos
 * 90… calcularía bien la retención, ya que la percepción no afecta, pero en vez de tomarme el monto que le
 * dije del total del anticipo me toma el total de neto e IVA»*).
 *
 * Manda el monto del anticipo (§ Default del dato real): la retención sigue saliendo del neto, y la
 * diferencia con neto + IVA se muestra como «otros» (percepciones, etc.) sin pedir que se carguen. Si
 * neto + IVA SUPERA el monto, se avisa (no frena: puede ser un anticipo parcial).
 */
export function totalAnticipo(montoAnticipo: number, netoMasIva: number): { total: number; otros: number; aviso: string | null } {
  const r2 = (n: number) => Math.round(n * 100) / 100
  const total = r2(montoAnticipo > 0 ? montoAnticipo : netoMasIva)
  const otros = r2(total - netoMasIva)
  const aviso = otros < -0.005
    ? `Neto + IVA ($${r2(netoMasIva).toLocaleString('es-AR', { minimumFractionDigits: 2 })}) supera el monto del anticipo: revisá los importes (si es un pago parcial, está bien)`
    : null
  return { total, otros: Math.abs(otros) < 0.005 ? 0 : otros, aviso }
}
