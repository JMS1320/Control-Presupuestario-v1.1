/**
 * PEDIRLE LA FACTURA AL PROVEEDOR (v0.19.0, A-FEAT-1313 — acordado con el usuario 2026-10-21)
 *
 * Un mail NUEVO (no una respuesta), desde esta misma casilla, con el texto que arma la app
 * (`lib/gas-pdf/pedido.ts`). El usuario elige: borrador (queda en Gmail para revisarlo y mandarlo)
 * o enviar directo.
 *
 * La FIRMA viene en el texto que arma la app (usuario 2026-10-21: «Jose Martinez Sobrado / Martinez
 * Sobrado Agro SRL»). Apps Script no agrega la firma de Gmail sola, así que acá no se agrega nada.
 */
function pedirFactura(body) {
  if (!body.para || !body.asunto || !body.texto) {
    return responseJson({ status: 'error', observaciones: 'Faltan para, asunto o texto' }, 400)
  }
  var modo = body.modo === 'enviar' ? 'enviar' : 'borrador'
  var html = body.html || ('<p>' + String(body.texto).replace(/\n/g, '<br>') + '</p>')
  if (modo === 'enviar') GmailApp.sendEmail(body.para, body.asunto, body.texto, { htmlBody: html })
  else GmailApp.createDraft(body.para, body.asunto, body.texto, { htmlBody: html })
  return responseJson({ status: 'ok', modo: modo })
}

/**
 * BORRADOR CON ADJUNTOS DEL DRIVE (v0.25.0, A-FEAT-1578 — JMS 07/11: «enviar ventas por mail… seleccionar todas o alguna»)
 *
 * La app manda los ids de los PDFs (las facturas de venta de la carpeta «- Ventas» de cada mes) y acá se arma UN borrador de Gmail
 * con todos adjuntos. Sólo LEE los archivos y crea el borrador: nunca envía, nunca mueve ni toca nada del Drive. El destinatario puede
 * venir vacío: se completa en Gmail. Tope ~20 MB (Gmail admite 25 MB por mail).
 */
function borradorConAdjuntos(body) {
  var ids = Array.isArray(body.file_ids) ? body.file_ids : []
  if (!ids.length || !body.asunto) return responseJson({ status: 'error', observaciones: 'Faltan los archivos o el asunto' }, 400)
  var blobs = [], bytes = 0, errores = []
  for (var i = 0; i < ids.length; i++) {
    try {
      var b = DriveApp.getFileById(String(ids[i])).getBlob()
      bytes += b.getBytes().length
      blobs.push(b)
    } catch (e) { errores.push(String(ids[i]) + ': ' + e) }
  }
  if (errores.length) return responseJson({ status: 'error', observaciones: 'No se pudieron leer ' + errores.length + ' archivo(s): ' + errores.slice(0, 3).join(' · ') }, 400)
  var mb = Math.round(bytes / 1048576 * 10) / 10
  if (bytes > 20 * 1048576) return responseJson({ status: 'error', observaciones: 'Los adjuntos suman ' + mb + ' MB y Gmail admite 25 MB por mail: elegí menos comprobantes o bajá el zip.' }, 400)
  var texto = String(body.texto || '')
  GmailApp.createDraft(String(body.para || ''), String(body.asunto), texto, { htmlBody: '<p>' + texto.replace(/\n/g, '<br>') + '</p>', attachments: blobs })
  return responseJson({ status: 'ok', adjuntos: blobs.length, mb: mb })
}
