// Capa compartida (UI-agnóstica): comprobante de pago en PDF.
// Copia VERBATIM de generarPDFDetallePago (vista-facturas-arca) — misma lógica,
// para que Cash Flow la reuse sin reescribir. Cuando se deprece el Modal (E5) el
// Modal usará esta misma función y se elimina la copia inline. Ver MANUAL-USO § Pagos.

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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
  } | null
) => {
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

    const head: string[][] = [[
      'Comprobante',
      'Fecha',
      'Total Factura',
      ...(hayRetencion ? ['Retención Ganancias'] : []),
      ...(hayDescuento ? ['Descuento'] : []),
      'Monto Transferido',
      'Total Cancelado',
    ]]

    let body: string[][]
    if (anticipo) {
      const montoTransferido = anticipo.monto - (anticipo.monto_sicore || 0) - (anticipo.descuento_aplicado || 0)
      const totalCancelado = montoTransferido + (anticipo.monto_sicore || 0)
      body = items.map(i => [
        i.comprobante,
        i.fecha,
        fmt(i.imp_total),
        ...(hayRetencion ? [fmt(anticipo.monto_sicore || 0)] : []),
        ...(hayDescuento ? [fmt(anticipo.descuento_aplicado || 0)] : []),
        fmt(montoTransferido),
        fmt(totalCancelado),
      ])
      const totalBruto = items.reduce((s, i) => s + i.imp_total, 0)
      body.push([
        'TOTAL', '',
        fmt(totalBruto),
        ...(hayRetencion ? [fmt(anticipo.monto_sicore || 0)] : []),
        ...(hayDescuento ? [fmt(anticipo.descuento_aplicado || 0)] : []),
        fmt(montoTransferido),
        fmt(totalCancelado),
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
          fmt(montoTransferido),
          fmt(totalCancelado),
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
        fmt(totalTransferido),
        fmt(totalCancelado),
      ])
    }

    const ncols = head[0].length
    autoTable(doc, {
      startY: 56,
      head,
      body,
      theme: 'striped',
      headStyles: { fillColor: [40, 80, 40], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        2: { halign: 'right' },
        [ncols - 3]: { halign: 'right' },
        [ncols - 2]: { halign: 'right' },
        [ncols - 1]: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data: any) => {
        if (data.row.index === body.length - 1 && data.section === 'body') {
          data.cell.styles.fillColor = [220, 220, 220]
          data.cell.styles.fontStyle = 'bold'
        }
      }
    })

    const nombreArchivo = `DetallePago_${proveedor.replace(/\s+/g, '_').substring(0, 30)}_${fechaPago.replace(/\//g, '-')}.pdf`
    doc.save(nombreArchivo)

  } catch (error) {
    console.error('Error generando PDF comprobante de pago:', error)
    alert('Error al generar PDF: ' + (error as Error).message)
  }
}
