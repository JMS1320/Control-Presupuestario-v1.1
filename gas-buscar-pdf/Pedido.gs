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
