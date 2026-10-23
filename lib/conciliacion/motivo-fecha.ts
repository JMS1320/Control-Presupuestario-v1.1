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
export function motivoFechaNoExacta(diasAntes: number, fechaEsEmision: boolean, difImporte = 0): string {
  const n = Math.round(Math.abs(diasAntes))
  const dias = `${n} día${n === 1 ? "" : "s"}`
  // 🪙 A-BUG-1305 — si el importe no es exacto (centavos), se dice cuánto difiere en vez de «exacto».
  const importe = difImporte
    ? `Importe difiere ${Math.abs(difImporte).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}`
    : "Importe exacto"
  if (n === 0) return `${importe} · misma fecha`
  if (!fechaEsEmision) return `${importe} · fecha estimada a ${dias} del movimiento`
  return diasAntes > 0
    ? `${importe} · emitida ${dias} antes del débito (lo esperado en la tarjeta)`
    : `${importe} · ⚠️ emitida ${dias} DESPUÉS del débito — revisar`
}

/**
 * 🪙 **A-BUG-1305 — un centavo de diferencia no puede esconder una factura perfecta.**
 *
 * Caso (2026-10-20, tarjeta VISA MSA): Autopistas Urbanas, débito 16/01 por $7.719,03 y factura del 14/01
 * por $7.719,02. El motor comparaba el importe por igualdad exacta y no la proponía ni para auditar; la
 * pantalla Asignar sí («Monto + Fecha»). *«estas nunca me las ofrece ni en auditar pero siempre están
 * perfectas»*.
 *
 * Se usa **sólo cuando no hubo importe exacto**, y lo que encuentra va **siempre a auditar**. Elige la de
 * menor diferencia; si hay dos con la misma, no elige ninguna (sería adivinar).
 */
export const TOLERANCIA_IMPORTE = 1

export function elegirPorImporteCercano<T>(
  pool: T[], importe: number, importeDe: (cf: T) => number, fechaOk: (cf: T) => boolean, tolerancia = TOLERANCIA_IMPORTE,
): { cf: T; dif: number } | null {
  const cands = pool
    .map(cf => ({ cf, dif: Math.round((importe - importeDe(cf)) * 100) / 100 }))
    .filter(c => importeDe(c.cf) > 0 && c.dif !== 0 && Math.abs(c.dif) <= tolerancia && fechaOk(c.cf))
    .sort((a, b) => Math.abs(a.dif) - Math.abs(b.dif))
  if (!cands.length) return null
  if (cands.length > 1 && Math.abs(cands[1].dif) === Math.abs(cands[0].dif)) return null
  return cands[0]
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
