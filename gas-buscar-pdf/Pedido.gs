/**
 * PEDIRLE LA FACTURA AL PROVEEDOR (v0.19.0, A-FEAT-1313 — acordado con el usuario 2026-10-21)
 *
 * Un mail NUEVO (no una respuesta), desde esta misma casilla, con el texto que arma la app
 * (`lib/gas-pdf/pedido.ts`). El usuario elige: borrador (queda en Gmail para revisarlo y mandarlo)
 * o enviar directo.
 *
 * La FIRMA: Apps Script no agrega la firma de Gmail sola —ni a un borrador ni a un envío—. Se lee de
 * la configuración de la casilla (Gmail → Configuración → Firma) con la API de Gmail, y se pega al
 * final. Si no se puede leer, el mail sale igual y la respuesta lo avisa (nada en silencio).
 */
function pedirFactura(body) {
  if (!body.para || !body.asunto || !body.texto) {
    return responseJson({ status: 'error', observaciones: 'Faltan para, asunto o texto' }, 400)
  }
  var modo = body.modo === 'enviar' ? 'enviar' : 'borrador'
  var firma = firmaDeLaCasilla()
  var html = (body.html || ('<p>' + String(body.texto).replace(/\n/g, '<br>') + '</p>'))
    + (firma.html ? '<br><div class="gmail_signature">' + firma.html + '</div>' : '')
  var texto = body.texto + (firma.html ? '\n\n-- \n' + textoDeHtml(firma.html) : '')
  if (modo === 'enviar') GmailApp.sendEmail(body.para, body.asunto, texto, { htmlBody: html })
  else GmailApp.createDraft(body.para, body.asunto, texto, { htmlBody: html })
  return responseJson({ status: 'ok', modo: modo, con_firma: !!firma.html, aviso: firma.aviso || '' })
}

// La firma de la dirección por defecto de esta casilla (HTML), o '' con el motivo en `aviso`.
function firmaDeLaCasilla() {
  try {
    var r = UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true,
    })
    if (r.getResponseCode() !== 200) {
      return { html: '', aviso: 'Salió sin firma: no se pudo leer la firma de Gmail (HTTP ' + r.getResponseCode() + '). Puede faltar aceptar el permiso nuevo del programa de Google.' }
    }
    var lista = JSON.parse(r.getContentText()).sendAs || []
    var def = lista.filter(function (s) { return s.isDefault })[0] || lista.filter(function (s) { return s.isPrimary })[0]
    var html = (def && def.signature) || ''
    return { html: html, aviso: html ? '' : 'Salió sin firma: la casilla no tiene firma configurada en Gmail.' }
  } catch (e) {
    return { html: '', aviso: 'Salió sin firma: ' + e }
  }
}

function textoDeHtml(html) {
  return String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim()
}
