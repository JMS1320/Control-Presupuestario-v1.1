// Capa compartida (UI-agnóstica): encola un mail de "Detalle de pago" en public.mails_pago.
// La usa cualquier vista (modal de pagos, Cash Flow). El GAS (gas-mail-detalle) lee la cola
// y crea los borradores en Gmail. Devuelve un resultado; NO muestra UI (alert/toast lo hace el caller).
//
// Genera: detalle PDF (base64) + certificado SICORE (base64, match por factura_id) + cuerpo con
// desglose (importe/retención/descuento/total) + Fecha de pago + línea del comprobante bancario.

import { supabase } from '@/lib/supabase'
import { generarPDFDetallePago } from './pdf-detalle-pago'
import { generarCertificadoRetencion } from './certificado-retencion'
import { obtenerMediosPagoFactura, type MedioPago } from './medios-pago'

const abToBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export interface EncolarMailParams {
  tipo: 'arca' | 'template'
  proveedor: string
  cuit: string
  items: Parameters<typeof generarPDFDetallePago>[3]
  schemaName: string
  anticipo?: Parameters<typeof generarPDFDetallePago>[4]
  facturaIds?: string[]
  /** Fallback opcional: registros SICORE ya cargados en pantalla (tab SICORE del modal). */
  registrosFallback?: Array<{ anulado?: boolean; cuit_emisor?: string }>
}

export interface EncolarMailResult {
  ok: boolean
  email: string
  conCertificado: boolean
  error?: string
}

export async function encolarMailDetalle(p: EncolarMailParams): Promise<EncolarMailResult> {
  const { tipo, proveedor, cuit, items, schemaName, anticipo, facturaIds, registrosFallback } = p
  try {
    // Medios de pago (transferencia + echeq + ...) para el desglose multimedio en el PDF del mail
    const ids = (facturaIds || []).filter(Boolean)
    let mediosPago: MedioPago[] = []
    if (tipo === 'arca' && ids.length) mediosPago = await obtenerMediosPagoFactura(schemaName, ids)
    const detalleB64 = await generarPDFDetallePago(tipo, proveedor, cuit, items, anticipo, { returnBase64: true, mediosPago })
    if (!detalleB64) return { ok: false, email: '', conCertificado: false, error: 'No se pudo generar el detalle PDF' }

    const cuitClean = (cuit || '').replace(/\D/g, '')
    const { data: prov } = await supabase.from('proveedores').select('email_pagos').eq('cuit', cuitClean).maybeSingle()
    const email = (prov as { email_pagos?: string } | null)?.email_pagos || ''

    // Certificado SICORE: match por factura_id (comprobantes_arca.fecha_pago suele estar NULL → no sirve
    // fecha_pago). sicore_retenciones.factura_id vincula la retención a la FC del pago.
    let retB64: string | null = null
    let fechaPagoReal = ''
    if (tipo === 'arca') {
      let regs: Array<Record<string, unknown>> = []
      const ids = (facturaIds || []).filter(Boolean)
      if (ids.length) {
        const { data } = await supabase.schema(schemaName).from('sicore_retenciones')
          .select('cuit_emisor, denominacion_emisor, fecha_pago, total_pagado, retencion, tipo_sicore, nro_comprobante, nro_certificado')
          .in('factura_id', ids).eq('anulado', false)
        regs = (data || []) as Array<Record<string, unknown>>
      }
      if (!regs.length && cuitClean && registrosFallback) { // fallback: registros cargados en pantalla
        regs = registrosFallback.filter(r => !r.anulado && (r.cuit_emisor || '').replace(/\D/g, '') === cuitClean) as Array<Record<string, unknown>>
      }
      if (regs.length) {
        fechaPagoReal = String((regs[0] as { fecha_pago?: string }).fecha_pago || '')
        const bytes = await generarCertificadoRetencion(regs as unknown as Parameters<typeof generarCertificadoRetencion>[0], true)
        if (bytes) retB64 = abToBase64(bytes)
      }
    }
    if (!fechaPagoReal) fechaPagoReal = (items[0]?.fecha_estimada as string) || ''

    const m = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
    const fmtF = (f: string) => { if (!f) return '..............'; const d = new Date(f + 'T12:00:00'); return isNaN(d.getTime()) ? f : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` }
    const totalBruto = items.reduce((s, i) => s + (i.imp_total || 0), 0)
    const totalRet = items.reduce((s, i) => s + ((i.monto_sicore as number) || 0), 0)
    const totalDesc = items.reduce((s, i) => s + ((i.descuento_aplicado as number) || 0), 0)
    const totalPagado = items.reduce((s, i) => s + (i.monto_a_abonar || 0), 0)
    const fcs = items.map(i => i.comprobante).join(', ')
    let cuenta: string
    if (mediosPago.length > 0) {
      // Desglose por medio real (transferencia + echeq + ...) + retención/descuento = total factura
      cuenta = `\nImporte facturas: ${m(totalBruto)}`
      for (const md of mediosPago) cuenta += `\n${md.detalle || md.tipo}: ${m(md.monto)}`
      if (totalRet > 0) cuenta += `\nRetención Ganancias: -${m(totalRet)}`
      if (totalDesc > 0) cuenta += `\nDescuento: -${m(totalDesc)}`
    } else {
      cuenta = `\nTotal transferido: ${m(totalPagado)}`
      if (totalRet > 0 || totalDesc > 0) {
        cuenta = `\nImporte facturas: ${m(totalBruto)}`
        if (totalRet > 0) cuenta += `\nRetención Ganancias: -${m(totalRet)}`
        if (totalDesc > 0) cuenta += `\nDescuento: -${m(totalDesc)}`
        cuenta += `\nTotal transferido: ${m(totalPagado)}`
      }
    }
    cuenta += `\nFecha de pago: ${fmtF(fechaPagoReal)}`
    const asunto = `Detalle de pago — ${proveedor}`
    const cuerpo = `Estimados,\n\nAdjuntamos el detalle del pago de: ${fcs}.\n${cuenta}${retB64 ? '\n\nSe practicó retención de Ganancias; el certificado va adjunto.' : ''}\n\nLes llegará el comprobante de transferencia desde go@bancogalicia.com.ar con asunto "Aviso de transferencia".\n\nSaludos.`

    const { error } = await supabase.from('mails_pago').insert({
      proveedor, cuit: cuitClean, email_destino: email, asunto, cuerpo,
      detalle_pdf: detalleB64, retencion_pdf: retB64, tiene_sicore: !!retB64, adjuntar_retencion: !!retB64,
      adjuntar_detalle: (totalDesc > 0), // auto SOLO si hay descuento (editable en el panel)
      estado: 'pendiente',
    })
    if (error) return { ok: false, email, conCertificado: !!retB64, error: error.message }
    return { ok: true, email, conCertificado: !!retB64 }
  } catch (e) {
    return { ok: false, email: '', conCertificado: false, error: (e as Error).message }
  }
}
