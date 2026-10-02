/**
 * 🧾 **Las retenciones recibidas del mes, para el export del Subdiario de Ventas** — A-FEAT-1227
 * (2026-10-02).
 *
 * Pedido del usuario al ver que Genta le retiene Ganancias en cada pago: *«lo bueno va a ser ir
 * pudiendo exportar esto con Subdiario de ventas para que el contador se fije que estén declaradas
 * en ARCA»*. Es la pieza 4 del norte administrativo — **el mismo número por dos caminos**: lo que el
 * cliente dice que nos retuvo (certificados, o impreso en su liquidación) contra lo que ARCA tiene
 * en *Mis Retenciones*.
 *
 * Dos fuentes, y las dos van:
 *   · **Certificados** (`msa.retenciones_recibidas`), por la FECHA de la retención — es la fecha que
 *     usa ARCA. Sólo MSA: la tabla no existe en PAM ni MA.
 *   · **Impresas en el comprobante** (`ret_iva`, `ret_iibb`: liquidaciones de granos y de hacienda),
 *     por el comprobante del subdiario — su fecha es la del comprobante.
 */

export interface FilaRetencion {
  Fecha: string
  Origen: string
  Tipo: string
  'Razón Social': string
  'C.U.I.T.': string
  Comprobante: string
  Certificado: string
  Importe: number
}

const TIPO: Record<string, string> = { ganancias: 'Ganancias', iibb: 'IIBB', iva: 'IVA', suss: 'SUSS' }

export function filasRetenciones(
  certificados: { fecha: string | null; tipo: string; monto: number | string; nro_certificado?: string | null; denominacion_cliente?: string | null; cuit_cliente?: string | null; comprobante?: string | null }[],
  comprobantes: { fecha: string | null; nro: string | null; cliente: string | null; cuit: string | null; ret_iva?: number | string | null; ret_iibb?: number | string | null }[],
): { filas: FilaRetencion[]; total: number; porTipo: Record<string, number> } {
  const filas: FilaRetencion[] = []
  for (const c of certificados) {
    filas.push({
      Fecha: c.fecha || '', Origen: 'Certificado', Tipo: TIPO[c.tipo] || c.tipo,
      'Razón Social': c.denominacion_cliente || '', 'C.U.I.T.': c.cuit_cliente || '',
      Comprobante: c.comprobante || '', Certificado: c.nro_certificado || '', Importe: Number(c.monto) || 0,
    })
  }
  for (const c of comprobantes) {
    for (const [campo, tipo] of [['ret_iibb', 'IIBB'], ['ret_iva', 'IVA']] as const) {
      const monto = Number(c[campo]) || 0
      if (Math.abs(monto) < 0.005) continue
      filas.push({
        Fecha: c.fecha || '', Origen: 'Impresa en el comprobante', Tipo: tipo,
        'Razón Social': c.cliente || '', 'C.U.I.T.': c.cuit || '', Comprobante: c.nro || '', Certificado: '', Importe: monto,
      })
    }
  }
  filas.sort((a, b) => a.Fecha.localeCompare(b.Fecha))
  const porTipo: Record<string, number> = {}
  for (const f of filas) porTipo[f.Tipo] = Math.round(((porTipo[f.Tipo] || 0) + f.Importe) * 100) / 100
  return { filas, total: Math.round(filas.reduce((s, f) => s + f.Importe, 0) * 100) / 100, porTipo }
}
