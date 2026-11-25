/**
 * 🔗 **A-BUG-1657 — a qué factura (o grupo de pago) corresponde un mail de pago encolado.**
 *
 * Visto 25/11 con el mail de la FC 6654 de Agro Centros: `public.mails_pago` tiene
 * `comprobante_arca_id` y `grupo_pago_id`, pero los 45 mails de pago que había los tenían vacíos — el
 * vínculo quedaba sólo en el asunto («FC 6654»). Sin eso, desde la factura no se puede saber si ya se
 * avisó el pago ni cuándo (CLAUDE.md § 🗓️ TODO SE FECHA). Pedido de JMS 25/11: «mejorá eso del mail».
 *
 * La regla, con las DOS columnas que ya existen (sin cambiar la estructura):
 *   · una sola factura → `comprobante_arca_id` (y su grupo, si tiene);
 *   · varias, todas del MISMO grupo de pago → `grupo_pago_id`;
 *   · varias sin grupo en común → nada: una sola columna no puede decir «estas tres», y guardar sólo
 *     una haría creer que el mail era de esa factura nada más. Queda para cuando haga falta (pendiente).
 */
export interface FacturaDelMail {
  id: string
  grupo_pago_id?: string | null
}

export interface VinculoMailPago {
  comprobante_arca_id: string | null
  grupo_pago_id: string | null
}

export function vinculoDelMail(facturas: FacturaDelMail[]): VinculoMailPago {
  const unicas = [...new Map(facturas.filter(f => f?.id).map(f => [f.id, f])).values()]
  if (unicas.length === 0) return { comprobante_arca_id: null, grupo_pago_id: null }
  const grupos = [...new Set(unicas.map(f => f.grupo_pago_id || ''))]
  const grupoComun = grupos.length === 1 && grupos[0] ? grupos[0] : null
  if (unicas.length === 1) return { comprobante_arca_id: unicas[0].id, grupo_pago_id: grupoComun }
  return { comprobante_arca_id: null, grupo_pago_id: grupoComun }
}
