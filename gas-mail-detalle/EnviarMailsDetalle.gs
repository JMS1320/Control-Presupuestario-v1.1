/**
 * EnviarMailsDetalle.gs — crea BORRADORES en Gmail desde la cola `public.mails_pago`.
 *
 * Flujo: la app encola filas (estado='pendiente') con el Detalle PDF (+ certificado SICORE) en base64.
 * Esta función lee las pendientes, crea un BORRADOR por cada una con los adjuntos, y marca 'borrador'.
 * Sin horarios: se corre a MANO (o desde un botón). En lote. Los primeros los revisás en Borradores
 * de Gmail y los mandás vos. Cuando veas que todo anda bien → cambiar createDraft por sendEmail (abajo).
 *
 * CONFIGURAR (una vez): SUPABASE_URL y SUPABASE_KEY (anon o service role del proyecto).
 * NO commitear la key real en este archivo si el repo es público.
 */

var SUPABASE_URL = 'https://TU_PROJECT_REF.supabase.co';
var SUPABASE_KEY = 'TU_ANON_O_SERVICE_KEY';

/**
 * Web app: la app llama a esta URL para preparar borradores.
 * Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone.
 * Con ?id=<uuid> prepara solo ese mail; sin id, todos los pendientes.
 */
function doGet(e) {
  var id = e && e.parameter ? e.parameter.id : null;
  var res = prepararBorradores(id);
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

/** Correr a mano, o vía web app (doGet). soloId opcional = un mail puntual. */
function prepararBorradores(soloId) {
  // Lock: evita que dos disparos concurrentes (doble-click / no-cors) dupliquen borradores.
  // La 2da corrida espera; para cuando entra, la 1ra ya marcó todo 'borrador' → no hay pendientes.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) { Logger.log('No se pudo obtener lock'); return { ok: 0, err: 0, msg: 'ocupado' }; }
  try {
    var pendientes = fetchPendientes_(soloId);
    if (!pendientes.length) { Logger.log('Sin mails pendientes.'); return { ok: 0, err: 0, msg: 'sin pendientes' }; }

    var ok = 0, err = 0;
    pendientes.forEach(function (m) {
      try {
        // Doble guarda de idempotencia: si ya tiene borrador creado, no re-crear.
        if (m.gmail_draft_id) { return; }
        var adjuntos = [];
        if (m.detalle_pdf && m.adjuntar_detalle !== false) adjuntos.push(base64ToPdfBlob_(m.detalle_pdf, 'DetallePago.pdf'));
        if (m.retencion_pdf && m.adjuntar_retencion) adjuntos.push(base64ToPdfBlob_(m.retencion_pdf, 'CertificadoRetencion.pdf'));

        var draft = GmailApp.createDraft(m.email_destino, m.asunto, m.cuerpo, { attachments: adjuntos });
        // Cuando esté validado, reemplazar la línea de arriba por envío directo:
        // GmailApp.sendEmail(m.email_destino, m.asunto, m.cuerpo, { attachments: adjuntos });

        actualizar_(m.id, { estado: 'borrador', gmail_draft_id: draft.getId(), error: null });
        ok++;
      } catch (e) {
        actualizar_(m.id, { estado: 'error', error: String(e) });
        err++;
      }
    });
    Logger.log('Borradores creados: ' + ok + ' · errores: ' + err);
    return { ok: ok, err: err };
  } finally {
    lock.releaseLock();
  }
}

function fetchPendientes_(soloId) {
  var url = SUPABASE_URL + '/rest/v1/mails_pago?estado=eq.pendiente&select=*&order=creado_at.asc';
  if (soloId) url += '&id=eq.' + soloId;
  var res = UrlFetchApp.fetch(url, { headers: headers_(), muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) throw new Error('Supabase ' + res.getResponseCode() + ': ' + res.getContentText());
  return JSON.parse(res.getContentText() || '[]');
}

function actualizar_(id, campos) {
  var url = SUPABASE_URL + '/rest/v1/mails_pago?id=eq.' + id;
  UrlFetchApp.fetch(url, {
    method: 'patch', headers: headers_(), payload: JSON.stringify(campos), muteHttpExceptions: true
  });
}

function headers_() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };
}

function base64ToPdfBlob_(b64, nombre) {
  var bytes = Utilities.base64Decode(b64);
  return Utilities.newBlob(bytes, 'application/pdf', nombre);
}
