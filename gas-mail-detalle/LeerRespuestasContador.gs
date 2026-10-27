/**
 * LeerRespuestasContador.gs — la VUELTA del mail del subdiario (A-AUTO-09, 2026-10-27).
 *
 * La app manda (como borrador que envía JMS) el mail «Subdiario Mes Año» al contador. Él lo presenta y CONTESTA ese
 * mail adjuntando la DDJJ en PDF y el zip del libro IVA que exporta ARCA. Este script busca esas respuestas, le manda
 * el zip a la app (`/api/contador/ddjj`), que lo guarda, lo compara contra el subdiario y, si coincide, pasa el mes a
 * «DDJJ OK»; si no, les deja un aviso a JMS y a Ulises. El hilo queda con la etiqueta «app/ddjj-procesada» para no
 * procesarlo dos veces (y la app tampoco duplica: guarda una DDJJ por período + secuencia).
 *
 * Va en el MISMO proyecto de Apps Script que EnviarMailsDetalle.gs (la misma cuenta de Gmail, que es la que manda el
 * mail y recibe la respuesta).
 *
 * CONFIGURAR (una vez), en ⚙ Configuración del proyecto → Propiedades del script:
 *   · APP_URL          = la dirección de la app, sin barra final (p. ej. https://control-presupuestario.vercel.app)
 *   · CONTADOR_TOKEN   = el mismo valor que la variable CONTADOR_TOKEN de la app en Vercel (un texto largo cualquiera)
 * y un ACTIVADOR: Activadores ⏰ → Agregar → función `leerRespuestasContador` → por tiempo → cada hora.
 * Para probar a mano: ejecutar `leerRespuestasContador` desde el editor y mirar el registro.
 */

var CONTADOR_EMAIL = 'bnoltfuentes@gmail.com';
var ETIQUETA = 'app/ddjj-procesada';

function leerRespuestasContador() {
  var props = PropertiesService.getScriptProperties();
  var appUrl = props.getProperty('APP_URL');
  var token = props.getProperty('CONTADOR_TOKEN');
  if (!appUrl || !token) { Logger.log('Faltan las propiedades APP_URL y/o CONTADOR_TOKEN.'); return; }

  var etiqueta = GmailApp.getUserLabelByName(ETIQUETA) || GmailApp.createLabel(ETIQUETA);
  var hilos = GmailApp.search('from:' + CONTADOR_EMAIL + ' subject:Subdiario has:attachment newer_than:120d -label:' + ETIQUETA.replace('/', '-'));
  var procesados = 0;
  hilos.forEach(function (hilo) {
    var huboZip = false, todoBien = true;
    hilo.getMessages().forEach(function (msj) {
      if (msj.getFrom().toLowerCase().indexOf(CONTADOR_EMAIL) < 0) return; // sólo lo que mandó el contador
      msj.getAttachments().forEach(function (adj) {
        var nombre = adj.getName() || '';
        if (!/\.zip$/i.test(nombre)) return;
        huboZip = true;
        var res = UrlFetchApp.fetch(appUrl + '/api/contador/ddjj', {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          headers: { 'x-token-contador': token },
          payload: JSON.stringify({ archivo: nombre + ' (mail «' + msj.getSubject() + '» del ' + msj.getDate().toISOString().slice(0, 10) + ')', base64: Utilities.base64Encode(adj.getBytes()) }),
        });
        Logger.log(nombre + ' → ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
        if (res.getResponseCode() >= 300) todoBien = false;
      });
    });
    // Se etiqueta sólo si se procesó bien: si la app falló, el próximo activador lo vuelve a intentar.
    if (huboZip && todoBien) { hilo.addLabel(etiqueta); procesados++; }
  });
  Logger.log('Respuestas del contador procesadas: ' + procesados);
}
