/**
 * 🔎 **EL MOTIVO DE «A AUDITAR» DICE QUÉ SÍ COINCIDE** (A-FEAT-1298, 2026-10-20).
 *
 * Usuario: *«sería bueno que diga lo que sí es exacto para poder avanzar tranquilo»*. Antes decía sólo
 * «Fecha no exacta: 2 días diferencia», y había que abrir el movimiento para saber si el importe cerraba.
 *
 * En la tarjeta la fecha de la factura es su **emisión** (A-BUG-1298), y lo esperado es *«se emite y a
 * los pocos días entra a la tarjeta»*: emitida ANTES del débito es lo normal y se dice así; emitida
 * DESPUÉS no tiene sentido y se marca.
 *
 * @param diasAntes días entre la fecha de la factura/cuota y el movimiento: positivo = la factura es anterior.
 */
export function motivoFechaNoExacta(diasAntes: number, fechaEsEmision: boolean): string {
  const n = Math.round(Math.abs(diasAntes))
  const dias = `${n} día${n === 1 ? "" : "s"}`
  if (!fechaEsEmision) return `Importe exacto · fecha estimada a ${dias} del movimiento`
  return diasAntes > 0
    ? `Importe exacto · emitida ${dias} antes del débito (lo esperado en la tarjeta)`
    : `Importe exacto · ⚠️ emitida ${dias} DESPUÉS del débito — revisar`
}

/**
 * 💳 A-FEAT-1298 — en el Asignar de la TARJETA, cuánto suma una factura según cuándo se emitió respecto
 * del débito. Caso: Autopistas del Sol 08/04 por $6.520,33 tenía dos facturas del mismo importe, emitidas
 * el 1/4 y el 1/7, y la lista no decía cuál era. La del 1/4 (7 días antes) es la esperada; la del 1/7 no
 * puede ser (es posterior al débito).
 */
export function ajusteTarjetaPorEmision(fechaMov: string, fechaEmision: string | null | undefined):
  { puntos: number; sello: { texto: string; color: string } | null } {
  if (!fechaEmision) return { puntos: 0, sello: null }
  const dias = Math.round((new Date(fechaMov.slice(0, 10) + "T12:00:00").getTime() - new Date(fechaEmision.slice(0, 10) + "T12:00:00").getTime()) / 86400000)
  if (dias < 0) return { puntos: -40, sello: { texto: `Emitida ${-dias}d después del débito`, color: "bg-gray-100 text-gray-500" } }
  if (dias <= 10) return { puntos: 25 - dias, sello: { texto: dias === 0 ? "Emitida el mismo día" : `Emitida ${dias}d antes ✓`, color: "bg-green-100 text-green-800" } }
  return { puntos: 0, sello: { texto: `Emitida ${dias}d antes`, color: "bg-gray-100 text-gray-600" } }
}
