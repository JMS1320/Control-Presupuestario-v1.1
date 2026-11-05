/**
 * 🔗 Pura — A-BUG-1553: ¿el anticipo se pagó con ECHEQ? Entonces la factura que cubre hereda el echeq (estado `echeq`,
 * `metodo_pago`, `fecha_cobro_echeq`) y sus cheques. Un anticipo ya `conciliado` en el banco no: ahí la factura queda conciliada.
 */
export function echeqDelAnticipo(a: { metodo_pago?: string | null; estado_pago?: string | null; fecha_cobro_echeq?: string | null; fecha_pago?: string | null }):
  { fechaCobro: string | null } | null {
  const esEcheq = a.metodo_pago === 'echeq' || a.estado_pago === 'echeq'
  if (!esEcheq || a.estado_pago === 'conciliado') return null
  return { fechaCobro: a.fecha_cobro_echeq ?? a.fecha_pago ?? null }
}
