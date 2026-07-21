// Capa compartida (UI-agnóstica): comprobante de pago en PDF.
// Copia VERBATIM de generarPDFDetallePago (vista-facturas-arca) — misma lógica,
// para que Cash Flow la reuse sin reescribir. Cuando se deprece el Modal (E5) el
// Modal usará esta misma función y se elimina la copia inline. Ver MANUAL-USO § Pagos.

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { MedioPago } from './medios-pago'

export const generarPDFDetallePago = async (
  tipo: 'arca' | 'template',
  proveedor: string,
  cuit: string,
  items: Array<{
    comprobante: string
    fecha: string
    fecha_estimada?: string | null
    imp_total: number
    monto_sicore?: number | null
    descuento_aplicado?: number | null
    monto_a_abonar: number
  }>,
  anticipo?: {
    monto: number
    monto_sicore: number | null
    descuento_aplicado: number | null
    tipo_sicore: string | null
    sicore: string | null
    fecha_pago: string
  } | null,
  opciones?: { returnBase64?: boolean; mediosPago?: MedioPago[] }
): Promise<string | void> => {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
    const fmtFechaStr = (f: string) => {
      const d = new Date(f + 'T12:00:00')
      return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
    }

    // Fecha de pago: del anticipo si existe, si no fecha_estimada del primer item
    const fechaPagoRaw = anticipo
      ? anticipo.fecha_pago
      : (items[0]?.fecha_estimada || null)
    const fechaPago = fechaPagoRaw ? fmtFechaStr(fechaPagoRaw) : '-'

    // ── Header ────────────────────────────────────────────────────────────
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('DETALLE DE PAGO', pageW / 2, 18, { align: 'center' })

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('MARTINEZ SOBRADO AGRO SRL — CUIT 30-61778601-6', pageW / 2, 25, { align: 'center' })

    // ── Datos proveedor ────────────────────────────────────────────────────
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Beneficiario:', 15, 36)
    doc.setFont('helvetica', 'normal')
    doc.text(proveedor, 45, 36)
    doc.setFont('helvetica', 'bold')
    doc.text('CUIT:', 15, 42)
    doc.setFont('helvetica', 'normal')
    doc.text(cuit, 30, 42)
    doc.setFont('helvetica', 'bold')
    doc.text('Fecha de Pago:', 15, 48)
    doc.setFont('helvetica', 'normal')
    doc.text(fechaPago, 47, 48)

    // ── Construir columnas y filas ─────────────────────────────────────────
    // Si hay anticipo, las columnas de retención/descuento vienen del anticipo
    const hayRetencion = anticipo
      ? (anticipo.monto_sicore || 0) > 0
      : items.some(i => (i.monto_sicore || 0) > 0)
    const hayDescuento = anticipo
      ? (anticipo.descuento_aplicado || 0) > 0
      : items.some(i => (i.descuento_aplicado || 0) > 0)
    // Si hay desglose de medios, la tabla principal NO muestra Transferido/Cancelado (lo cubre el desglose)
    const hayMedios = (opciones?.mediosPago ?? []).length > 0

    const head: string[][] = [[
      'Comprobante',
      'Fecha',
      'Total Factura',
      ...(hayRetencion ? ['Retención Ganancias'] : []),
      ...(hayDescuento ? ['Descuento'] : []),
      ...(hayMedios ? [] : ['Monto Transferido', 'Total Cancelado']),
    ]]

    let body: string[][]
    if (anticipo) {
      const montoTransferido = anticipo.monto - (anticipo.monto_sicore || 0) - (anticipo.descuento_aplicado || 0)
      const totalCancelado = montoTransferido + (anticipo.monto_sicore || 0)
      const cols = (extra: string[]) => hayMedios ? extra : [...extra, fmt(montoTransferido), fmt(totalCancelado)]
      body = items.map(i => [
        i.comprobante,
        i.fecha,
        fmt(i.imp_total),
        ...(hayRetencion ? [fmt(anticipo.monto_sicore || 0)] : []),
        ...(hayDescuento ? [fmt(anticipo.descuento_aplicado || 0)] : []),
        ...cols([]),
      ])
      const totalBruto = items.reduce((s, i) => s + i.imp_total, 0)
      body.push([
        'TOTAL', '',
        fmt(totalBruto),
        ...(hayRetencion ? [fmt(anticipo.monto_sicore || 0)] : []),
        ...(hayDescuento ? [fmt(anticipo.descuento_aplicado || 0)] : []),
        ...cols([]),
      ])
    } else {
      body = items.map(i => {
        const montoTransferido = i.monto_a_abonar
        const totalCancelado = i.monto_a_abonar + (i.monto_sicore || 0)
        return [
          i.comprobante,
          i.fecha,
          fmt(i.imp_total),
          ...(hayRetencion ? [i.monto_sicore ? fmt(i.monto_sicore) : '-'] : []),
          ...(hayDescuento ? [i.descuento_aplicado ? fmt(i.descuento_aplicado) : '-'] : []),
          ...(hayMedios ? [] : [fmt(montoTransferido), fmt(totalCancelado)]),
        ]
      })
      const totalBruto = items.reduce((s, i) => s + i.imp_total, 0)
      const totalRet = items.reduce((s, i) => s + (i.monto_sicore || 0), 0)
      const totalDesc = items.reduce((s, i) => s + (i.descuento_aplicado || 0), 0)
      const totalTransferido = items.reduce((s, i) => s + i.monto_a_abonar, 0)
      const totalCancelado = totalTransferido + totalRet
      body.push([
        'TOTAL', '',
        fmt(totalBruto),
        ...(hayRetencion ? [fmt(totalRet)] : []),
        ...(hayDescuento ? [fmt(totalDesc)] : []),
        ...(hayMedios ? [] : [fmt(totalTransferido), fmt(totalCancelado)]),
      ])
    }

    autoTable(doc, {
      startY: 56,
      head,
      body,
      theme: 'striped',
      headStyles: { fillColor: [40, 80, 40], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
        5: { halign: 'right' }, 6: { halign: 'right' },
      },
      didParseCell: (data: any) => {
        if (data.row.index === body.length - 1 && data.section === 'body') {
          data.cell.styles.fillColor = [220, 220, 220]
          data.cell.styles.fontStyle = 'bold'
        }
      }
    })

    // ── Desglose de MEDIOS de pago (transferencia/anticipo + echeq + ...) ──────
    // Cuando un pago se reparte en varios medios (ej. anticipo por transferencia + echeq del saldo),
    // se muestra cada tramo + la retención SICORE; la suma debe dar el total de la(s) factura(s).
    const medios = opciones?.mediosPago ?? []
    if (medios.length > 0) {
      const fmtFechaMedio = (f?: string | null) => f ? fmtFechaStr(f) : ''
      const totalRet = items.reduce((s, i) => s + (i.monto_sicore || 0), 0)
      const totalDesc = items.reduce((s, i) => s + (i.descuento_aplicado || 0), 0)
      const totalFactura = items.reduce((s, i) => s + i.imp_total, 0)
      const sumaMedios = medios.reduce((s, m) => s + m.monto, 0)
      const totalDesglose = sumaMedios + totalRet + totalDesc

      const mHead = [['Medio de pago', 'Fecha', 'Monto']]
      const mBody: string[][] = medios.map(m => [m.detalle || m.tipo, fmtFechaMedio(m.fecha), fmt(m.monto)])
      if (totalRet > 0) mBody.push(['Retención SICORE', '', fmt(totalRet)])
      if (totalDesc > 0) mBody.push(['Descuento pronto pago', '', fmt(totalDesc)])
      mBody.push(['TOTAL', '', fmt(totalDesglose)])

      const startY2 = ((doc as any).lastAutoTable?.finalY ?? 56) + 8
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Desglose del pago', 15, startY2)
      autoTable(doc, {
        startY: startY2 + 3,
        head: mHead,
        body: mBody,
        theme: 'grid',
        headStyles: { fillColor: [40, 80, 40], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 2: { halign: 'right' } },
        didParseCell: (data: any) => {
          if (data.row.index === mBody.length - 1 && data.section === 'body') {
            data.cell.styles.fillColor = [220, 220, 220]
            data.cell.styles.fontStyle = 'bold'
          }
        }
      })
      // Aviso si el desglose no cuadra con el total de la factura (tolerancia $1)
      if (Math.abs(totalDesglose - totalFactura) > 1) {
        const y3 = ((doc as any).lastAutoTable?.finalY ?? startY2) + 6
        doc.setFontSize(8)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(180, 60, 60)
        doc.text(`⚠ El desglose (${fmt(totalDesglose)}) no coincide con el total de factura (${fmt(totalFactura)}).`, 15, y3)
        doc.setTextColor(0, 0, 0)
      }
    }

    if (opciones?.returnBase64) return doc.output('datauristring').split(',')[1] // base64 puro (para encolar mail)

    const nombreArchivo = `DetallePago_${proveedor.replace(/\s+/g, '_').substring(0, 30)}_${fechaPago.replace(/\//g, '-')}.pdf`
    doc.save(nombreArchivo)

  } catch (error) {
    console.error('Error generando PDF comprobante de pago:', error)
    alert('Error al generar PDF: ' + (error as Error).message)
  }
}
