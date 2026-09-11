// Capa compartida (UI-agnóstica): comprobante de pago en PDF.
//
// ÚNICA implementación desde 2026-08-13. Antes había dos: ésta (Cash Flow) y una copia inline
// en `vista-facturas-arca.tsx` (Egresos). Se borró la copia — las dos arrastraban el mismo bug
// y sólo ésta soportaba el desglose por medios de pago. Ver PENDIENTES § A-BUG-24.
//
// 🔑 LA RELACIÓN QUE TIENE QUE CERRAR SIEMPRE:
//        Total Factura = Monto Transferido + Retención (SICORE) + Descuento
//    y eso ES el Total Cancelado. El descuento cancela factura aunque no salga plata por él.
//    Omitirlo le dice al proveedor que le queda un saldo impago que no existe (caso ALCORTA
//    10/08/2026: decía $520.978,69 sobre una factura de $548.398,62, justo el descuento de menos).
//    El desglose por medios de abajo ya usaba este criterio; la tabla principal no.

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { MedioPago } from './medios-pago'
import { calcularCuenta, etiquetaComprobante } from './cuenta-detalle-pago'

// Se re-exporta desde acá porque hay vistas que la importan de este módulo desde antes de la
// mudanza. El `export … from` NO trae el nombre al scope local: por eso además se importa arriba.
export { etiquetaComprobante }

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
    /** 'ARCA' | 'ANTICIPO' | 'TEMPLATE'. Un ANTICIPO **no es una factura**: no suma al bruto
     *  (A-BUG-105), es un MEDIO de pago de la factura a la que está aplicado. */
    origen?: string
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

    /**
     * 🧮 **LA CUENTA, UNA SOLA VEZ Y COMPARTIDA CON EL CUERPO DEL MAIL** (A-BUG-149).
     *
     * `calcularCuenta` es la misma función que usa `armarDesglose` para el texto del mail. Se
     * calcula acá arriba porque la usan **los dos** totales del PDF: el de la tabla principal y el
     * del desglose por medios. Antes cada uno sumaba por su cuenta —y los dos sumaban el anticipo
     * al bruto, que es [A-BUG-105] sin arreglar.
     *
     * No se usa en la rama `anticipo` de abajo: ese camino recibe el anticipo **aparte** de los
     * items y tiene su propia forma; tocarlo sin un caso que lo cubra sería cambiar lo que anda.
     */
    const cuenta = calcularCuenta(items, opciones?.mediosPago ?? [], tipo)

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
      // Total Cancelado = transferencia + retención + descuento (ver nota arriba)
      const totalCancelado = montoTransferido + (anticipo.monto_sicore || 0) + (anticipo.descuento_aplicado || 0)
      const cols = (extra: string[]) => hayMedios ? extra : [...extra, fmt(montoTransferido), fmt(totalCancelado)]
      body = items.map(i => [
        etiquetaComprobante(i),
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
        const totalCancelado = i.monto_a_abonar + (i.monto_sicore || 0) + (i.descuento_aplicado || 0)
        return [
          etiquetaComprobante(i),
          i.fecha,
          fmt(i.imp_total),
          ...(hayRetencion ? [i.monto_sicore ? fmt(i.monto_sicore) : '-'] : []),
          ...(hayDescuento ? [i.descuento_aplicado ? fmt(i.descuento_aplicado) : '-'] : []),
          ...(hayMedios ? [] : [fmt(montoTransferido), fmt(totalCancelado)]),
        ]
      })
      // 🐞 A-BUG-149 — los cuatro totales salían de sumar `items` a mano, y el bruto **incluía los
      //    anticipos**. Ahora salen de la cuenta compartida, igual que el cuerpo del mail.
      body.push([
        'TOTAL', '',
        fmt(cuenta.bruto),
        ...(hayRetencion ? [fmt(cuenta.retencion)] : []),
        ...(hayDescuento ? [fmt(cuenta.descuento)] : []),
        ...(hayMedios ? [] : [fmt(cuenta.pagado), fmt(cuenta.pagado + cuenta.retencion + cuenta.descuento)]),
      ])
    }

    autoTable(doc, {
      startY: 56,
      head,
      body,
      theme: 'striped',
      headStyles: { fillColor: [40, 80, 40], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      // De la columna 2 en adelante son todas importes. Se calcula sobre la cantidad real de
      // columnas porque las de retención/descuento/transferido aparecen o no según el caso:
      // con índices fijos, un pago sin retención desalineaba la tabla.
      columnStyles: Object.fromEntries(
        head[0].map((_, i) => i).filter(i => i >= 2).map(i => [
          i,
          i === head[0].length - 1 && !hayMedios
            ? { halign: 'right', fontStyle: 'bold' }
            : { halign: 'right' },
        ])
      ) as any,
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

      /**
       * 🐞 **A-BUG-149 — la cuenta sale de `calcularCuenta`, la MISMA que arma el cuerpo del mail.**
       *
       * Acá vivía una segunda implementación, a mano:
       * ```
       * const totalFactura = items.reduce((s, i) => s + i.imp_total, 0)   // ← sumaba los anticipos
       * const totalDesglose = sumaMedios + totalRet + totalDesc
       * ```
       * Y por eso **el arreglo de A-BUG-105 nunca llegó al PDF**: el tipo de `items` declara
       * `origen` con el comentario *«un ANTICIPO no es una factura: no suma al bruto»* **tres
       * líneas más arriba**, y esta cuenta no lo miraba. La regla estaba escrita en el tipo y no
       * aplicada en el código.
       *
       * 🧨 Lo grave es que **el PDF es el adjunto del mismo mail cuyo cuerpo sí usa la función
       * buena**: un mail con una factura y su anticipo podía decir **dos números distintos**, uno
       * en el texto y otro en el papel. Pedido del usuario: *«debe ser lo mismo pedir el reporte de
       * pago para uno verlo que encolarlo al mail lo que le llega adjunto»*.
       */
      const mHead = [['Medio de pago', 'Fecha', 'Monto']]
      const mBody: string[][] = medios.map(m => [m.detalle || m.tipo, fmtFechaMedio(m.fecha), fmt(m.monto)])
      if (cuenta.retencion > 0) mBody.push(['Retención SICORE', '', fmt(cuenta.retencion)])
      if (cuenta.descuento > 0) mBody.push(['Descuento pronto pago', '', fmt(cuenta.descuento)])
      mBody.push(['TOTAL', '', fmt(cuenta.totalCancelado)])
      // Qué fila es el TOTAL: el resaltado la buscaba como «la última», y al agregar el renglón de
      // saldo dejaba de serlo — se habría pintado el saldo y el total quedaría sin destacar.
      const filaTotal = mBody.length - 1
      // ⚠️ Si no cierra contra el importe de las facturas, **se dice en el papel**. El cuerpo del
      // mail ya lo decía y el adjunto callaba: el proveedor se enteraba al conciliar (§ 🧮 nada se
      // descarta en silencio). La tolerancia de $1 es la misma de `calcularCuenta`.
      if (cuenta.dif > 1) mBody.push(['Saldo pendiente', '', fmt(cuenta.dif)])
      else if (cuenta.dif < -1) mBody.push(['Pagado a cuenta', '', fmt(-cuenta.dif)])

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
          if (data.row.index === filaTotal && data.section === 'body') {
            data.cell.styles.fillColor = [220, 220, 220]
            data.cell.styles.fontStyle = 'bold'
          }
        }
      })
      // Aviso si el desglose no cuadra con el total de la factura (tolerancia $1, la de `cuenta`).
      // A-BUG-149: los dos números salen de la cuenta compartida, no de sumas propias.
      if (cuenta.desviado) {
        const y3 = ((doc as any).lastAutoTable?.finalY ?? startY2) + 6
        doc.setFontSize(8)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(180, 60, 60)
        /**
         * 🐞 **A-BUG-150 — sin `⚠`.**
         *
         * El símbolo (U+26A0) **no existe en WinAnsiEncoding**, que es lo que usan las fuentes
         * estándar de jsPDF, y al meterlo **se rompe la codificación de toda la línea**: salía
         * `& E l   d e s g l o s e   ( $ 2 . 7 9 1 . 0 8 3 , 2 5 ) …`, letra por letra.
         *
         * 🧨 Y de todas las líneas del PDF, ésta: aparece **sólo cuando la cuenta NO cierra**, así
         * que el defecto vivía escondido justo en el caso que había que leer. El `—` del
         * encabezado sí está en WinAnsi y por eso sale bien — el problema es este carácter, no
         * jsPDF.
         *
         * ⚠️ **Al agregar texto a este PDF: sólo latin-1.** Nada de emoji ni de símbolos técnicos.
         */
        doc.text(`ATENCION: el desglose (${fmt(cuenta.totalCancelado)}) no coincide con el total de factura (${fmt(cuenta.bruto)}).`, 15, y3)
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
