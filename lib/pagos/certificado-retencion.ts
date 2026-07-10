// Capa compartida (UI-agnóstica): Certificado de Retención de Ganancias en PDF.
// Movido desde vista-facturas-arca (era inline) para que cualquier vista lo reuse
// (modal de pagos, Cash Flow, encolar-mail-detalle). Agente = MSA (hardcodeado).
// returnBytes=true → devuelve ArrayBuffer (para adjuntar/guardar); false → doc.save().

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface RegistroCertificado {
  id?: string | number
  cuit_emisor: string
  denominacion_emisor: string
  fecha_pago: string
  total_pagado: number
  retencion: number
  tipo_sicore: string
  nro_comprobante?: number | null
  nro_certificado?: string | null
}

export const generarCertificadoRetencion = async (
  registros: RegistroCertificado[],
  returnBytes = false
): Promise<ArrayBuffer | null> => {
  if (!registros.length) return null
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const mL = 15

    // Agregar montos del grupo
    const totalPagado = registros.reduce((s, r) => s + (Number(r.total_pagado) || 0), 0)
    const totalRetencion = registros.reduce((s, r) => s + (Number(r.retencion) || 0), 0)
    const registro = registros[0]

    const fmt = (n: number | string) => `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
    const fmtFecha = (f: string | null) => {
      if (!f) return ''
      const d = new Date(f + 'T12:00:00')
      return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
    }
    const cuitFmt = (c: string) => {
      const clean = c.replace(/\D/g, '')
      if (clean.length === 11) return `${clean.slice(0,2)}-${clean.slice(2,10)}-${clean.slice(10)}`
      return c
    }
    const regimen = (() => {
      const t = (registro.tipo_sicore || '').toLowerCase()
      if (t.includes('arrendamiento')) return 'ARRENDAMIENTO'
      if (t.includes('bien')) return 'ADQUISICIÓN DE BIENES'
      if (t.includes('servicio')) return 'LOCACIÓN DE SERVICIOS'
      if (t.includes('transporte')) return 'TRANSPORTE'
      return (registro.tipo_sicore || '').toUpperCase()
    })()

    // Nro comprobante (Orden de Pago) y Nro certificado
    const nroOP = registro.nro_comprobante
      ? String(registro.nro_comprobante).padStart(10, '0')
      : '----------'
    const nroCert = (() => {
      const raw = registro.nro_certificado || ''
      // formato BD: 0000YYYY000001 → mostrar YYYY-XXXXXX
      if (raw.length === 14) return `${raw.slice(4, 8)}-${raw.slice(8)}`
      return raw
    })()
    const comprobanteOrigen = `Orden de Pago Nro: ${nroOP}`

    // ── Borde exterior ────────────────────────────────────────────────────
    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.rect(8, 8, pageW - 16, pageH - 16)

    // ── Título ────────────────────────────────────────────────────────────
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('CERTIFICADO DE RETENCIÓN Ganancias', pageW / 2, 20, { align: 'center' })
    doc.setLineWidth(0.3)
    doc.line(8, 25, pageW - 8, 25)

    // ── N° comprobante y Fecha ────────────────────────────────────────────
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Comprobante N°', mL, 33)
    doc.setFont('helvetica', 'italic')
    doc.text(nroCert, mL + 38, 33)
    doc.setFont('helvetica', 'bold')
    doc.text('Fecha:', pageW - mL - 35, 33)
    doc.setFont('helvetica', 'normal')
    doc.text(fmtFecha(registro.fecha_pago), pageW - mL, 33, { align: 'right' })
    doc.line(8, 38, pageW - 8, 38)

    // ── Agente de Retención ───────────────────────────────────────────────
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bolditalic')
    doc.text('Agente de Retención', mL, 46)
    doc.line(8, 49, pageW - 8, 49)

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bolditalic')
    doc.text('MARTINEZ SOBRADO AGRO SRL', mL + 8, 58)

    const agente: [string, string][] = [
      ['Domicilio Fiscal :', 'LIBERTAD 1366 - 9 PISO'],
      ['Localidad:', 'Capital Federal'],
      ['Provincia:', 'Capital Federal'],
      ['C.U.I.T. Nro :', '30-61778601-6'],
      ['Ingresos Brutos:', '30617786016'],
    ]
    let y = 67
    agente.forEach(([k, v]) => {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(k, mL + 8, y)
      doc.setFont('helvetica', 'normal')
      doc.text(v, mL + 52, y)
      y += 7
    })

    doc.line(8, y + 1, pageW - 8, y + 1)

    // ── Sujeto Pasible de Retención ───────────────────────────────────────
    y += 8
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bolditalic')
    doc.text('Sujeto Pasible de Retención', mL, y)
    doc.line(8, y + 3, pageW - 8, y + 3)
    y += 11

    const sujeto: [string, string][] = [
      ['Apellido y Nombre o Razón Social:', registro.denominacion_emisor || ''],
      ['C.U.I.T. Nro :', cuitFmt(registro.cuit_emisor || '')],
    ]
    sujeto.forEach(([k, v]) => {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(k, mL + 8, y)
      doc.setFont('helvetica', 'normal')
      doc.text(v, mL + 78, y)
      y += 8
    })

    doc.line(8, y + 1, pageW - 8, y + 1)

    // ── Datos de la Retención ─────────────────────────────────────────────
    y += 8
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bolditalic')
    doc.text('Datos de la Retención', mL, y)
    doc.line(8, y + 3, pageW - 8, y + 3)
    y += 8

    autoTable(doc, {
      startY: y,
      head: [['Comprob. que origina la retención', 'Monto del comprobante', 'Monto Ret. Practicada', 'Régimen']],
      body: [[
        comprobanteOrigen,
        fmt(totalPagado),
        fmt(totalRetencion),
        regimen,
      ]],
      theme: 'plain',
      styles: { fontSize: 9, lineColor: [180, 180, 180], lineWidth: 0.1 },
      headStyles: { fontStyle: 'normal', textColor: 0, fillColor: false as unknown as undefined, fontSize: 9 },
      margin: { left: mL, right: mL },
    })

    const afterTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20

    // ── Total ─────────────────────────────────────────────────────────────
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Total de la Retención en $', pageW - mL - 65, afterTable + 15)
    doc.text(fmt(totalRetencion), pageW - mL, afterTable + 15, { align: 'right' })

    // ── Secciones firma ───────────────────────────────────────────────────
    const footerY = pageH - 48
    doc.setLineWidth(0.3)
    doc.line(8, footerY, pageW - 8, footerY)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Firma Autorizada Gcia.', mL, footerY + 8)

    doc.rect(pageW / 2 + 5, footerY + 2, pageW / 2 - 16, 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Recibí el original del presente comprobante', pageW / 2 + 7, footerY + 10)

    doc.setLineWidth(0.3)
    doc.line(mL, footerY + 24, mL + 55, footerY + 24)
    doc.line(mL + 65, footerY + 24, mL + 100, footerY + 24)
    doc.setFontSize(8)
    doc.text('Firma y Aclaración', mL, footerY + 29)
    doc.text('Fecha', mL + 65, footerY + 29)

    // ── Disclaimer ────────────────────────────────────────────────────────
    const disc = 'Declaro que los datos consignados en este formulario son correctos y completos y que he confeccionado la presente utilizando sistema informático propio sin omitir ni falsear dato alguno que deba contener, siendo fiel expresión de la verdad.'
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(disc, pageW - 20)
    doc.text(lines, 10, pageH - 13)

    const cuitClean = (registro.cuit_emisor || '').replace(/\D/g, '')
    const nombreArchivo = `CertRet_${nroCert}_${cuitClean}_${(registro.denominacion_emisor || '').replace(/\s+/g, '_').substring(0, 20)}.pdf`

    if (returnBytes) {
      return doc.output('arraybuffer')
    }
    doc.save(nombreArchivo)
    return null

  } catch (error) {
    console.error('Error generando certificado de retención:', error)
    alert('Error al generar certificado: ' + (error as Error).message)
    return null
  }
}
