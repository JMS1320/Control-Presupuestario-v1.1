/**
 * 🏛️ BOLETAS DE ARBA — bajarlas del mail y archivarlas. A-FEAT-95.
 *
 * ## Qué hace y qué NO
 * Busca en Gmail los avisos de ARBA, **sigue el link** de cada boleta, baja el PDF y lo archiva en
 * Drive. Después le avisa a la app, que lo lee y guarda el importe en `boletas_arba`.
 *
 * 🔴 **NUNCA toca los templates.** El importe de la boleta se guarda **al lado**, no encima.
 * Textual del usuario: *«no reemplazar los templates, ya que yo debo ver y decidir: cambiar éste sí,
 * éste no, todos»*. Pisar en automático destruiría una decisión suya — hoy 13 de 16 lotes están
 * +15 % parejo y eso puede ser una proyección deliberada.
 *
 * ## Por qué se puede hacer así de simple
 * El link del mail **no pide login**. Es un rastreador (`arbalist07.../lt.php`) que redirige con un
 * `303` a `app.arba.gov.ar/pdfDeuda/...`, y el token largo de esa URL **es** la credencial. Probado
 * el 2026-09-04 con `curl` sin cookies: devuelve `application/pdf` directo. Nada del andamiaje que
 * hizo falta para ARCA.
 *
 * ## Configuración (Script Properties)
 *   ARBA_QUERY      búsqueda de Gmail. Default: `from:boletaelectronica@arba.gov.ar newer_than:60d`
 *   ARBA_CARPETA    id de la carpeta de Drive. Si falta, find-or-create «Boletas ARBA»
 *   APP_URL         base de la app, para avisarle de lo bajado (opcional)
 *
 * ⚠️ **Nada destructivo** (§ 🛑 de CLAUDE.md): sólo find-or-create y creación de archivos. No hay
 * `setTrashed` ni reemplazo de carpetas.
 */

// El remitente real, visto en los mails del usuario (2026-09-06). `from:arba.gov.ar` a secas
// tambien matchea, pero trae cualquier otra cosa que mande ARBA -- y el tope de 50 conversaciones
// se llenaria con ruido antes de llegar a las boletas.
var ARBA_QUERY_DEFAULT = 'from:boletaelectronica@arba.gov.ar newer_than:60d'
var ARBA_CARPETA_NOMBRE = 'Boletas ARBA'

function propArba_(k, def) {
  var v = PropertiesService.getScriptProperties().getProperty(k)
  return v && String(v).trim() ? String(v).trim() : def
}

/** Carpeta destino. Con `ARBA_CARPETA` usa ésa; si no, find-or-create en la raíz. */
function carpetaArba_() {
  var id = propArba_('ARBA_CARPETA', '')
  if (id) {
    try { return DriveApp.getFolderById(id) } catch (e) {
      throw new Error('ARBA_CARPETA apunta a una carpeta que no existe o no es accesible: ' + id)
    }
  }
  var it = DriveApp.getFoldersByName(ARBA_CARPETA_NOMBRE)
  return it.hasNext() ? it.next() : DriveApp.createFolder(ARBA_CARPETA_NOMBRE)
}

/**
 * Los links a boletas dentro del cuerpo de un mail.
 * Se aceptan los dos: el rastreador (`lt.php?tid=`) y el directo (`pdfDeuda`), porque ARBA puede
 * mandar cualquiera de los dos y quedarse sólo con uno perdería mails en silencio.
 */
function linksDeBoleta_(html) {
  var out = []
  var re = /https?:\/\/[^\s"'<>]+/gi
  var m
  while ((m = re.exec(html)) !== null) {
    var u = m[0].replace(/&amp;/g, '&').replace(/[.,;)]+$/, '')
    if (/lt\.php\?tid=/i.test(u) || /pdfDeuda/i.test(u)) out.push(u)
  }
  // Sin duplicados: el mismo link suele estar en el texto y en un botón.
  var vistos = {}, unicos = []
  for (var i = 0; i < out.length; i++) if (!vistos[out[i]]) { vistos[out[i]] = 1; unicos.push(out[i]) }
  return unicos
}

/** Baja el PDF de un link. Devuelve `{blob, nombre, urlFinal}` o `null` si no era un PDF. */
function bajarBoleta_(url) {
  var res = UrlFetchApp.fetch(url, {
    followRedirects: true, muteHttpExceptions: true,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (res.getResponseCode() !== 200) return null
  var ct = String(res.getHeaders()['Content-Type'] || res.getHeaders()['content-type'] || '')
  if (ct.toLowerCase().indexOf('pdf') < 0) return null

  // El nombre real viene en Content-disposition: `Deuda-Inmobiliario-0990158819-R.pdf`.
  var cd = String(res.getHeaders()['Content-disposition'] || res.getHeaders()['content-disposition'] || '')
  var mn = cd.match(/filename=([^;]+)/i)
  var nombre = mn ? mn[1].replace(/["']/g, '').trim() : ''
  return { blob: res.getBlob(), nombre: nombre, urlFinal: url }
}

/**
 * 🔴 **El nombre identifica la boleta por PARTIDA y PERÍODO, y no es cosmético.**
 *
 * ARBA nombra sus PDFs `Deuda-Inmobiliario-0990158819-R.pdf`: **partida sí, período NO**. Como la
 * deduplicación es por nombre, la boleta de la **cuota 3** de esa misma partida se saltearía como
 * *«ya estaba»* — **una boleta distinta, perdida en silencio**.
 *
 * Con el período adelante, dos boletas de la misma partida en cuotas distintas son dos archivos, y
 * re-correr el script sobre el mismo mail sigue sin duplicar. Además ordena solo en Drive, que es
 * como se mira una carpeta de boletas.
 *
 * 🔴 **Y el período sale del ASUNTO, no del índice del link.** Un mail trae **varias boletas** —una
 * fila por partida— y numerarlas por su posición hace que el nombre **dependa del orden en que
 * aparecen**: si ARBA reordena la tabla, los mismos archivos se bajan de nuevo con otro nombre.
 * El asunto dice la cuota (*«…Inmobiliario Rural Cuota 3»*) y eso **no depende del orden**.
 *
 * El nombre del servidor ya trae la partida, así que `2026-C3 - Deuda-Inmobiliario-0990158819-R.pdf`
 * identifica la boleta sin ambigüedad y re-correr el script da siempre lo mismo.
 */
function nombreDeArchivo_(nombreOriginal, fechaMail, k, asunto) {
  var anio = Utilities.formatDate(fechaMail, 'GMT-3', 'yyyy')
  // El asunto trae la cuota: «Boleta por Mail - Vencimiento del Impuesto Inmobiliario Rural Cuota 3».
  var mc = String(asunto || '').match(/Cuota\s*(\d+)/i)
  var periodo = anio + (mc ? '-C' + mc[1] : '-' + Utilities.formatDate(fechaMail, 'GMT-3', 'MM-dd'))

  if (!nombreOriginal) return 'ARBA ' + periodo + ' - ' + (k + 1) + '.pdf'
  var base = String(nombreOriginal).replace(/\.pdf$/i, '')
  return periodo + ' - ' + base + '.pdf'
}

/**
 * Recorre los mails de ARBA, baja lo que encuentra y lo archiva.
 * @param {boolean} soloContar si es true no guarda nada: sólo informa qué encontraría.
 */
function bajarBoletasArba(soloContar) {
  var query = propArba_('ARBA_QUERY', ARBA_QUERY_DEFAULT)
  var carpeta = soloContar ? null : carpetaArba_()
  var TOPE = 50
  var hilos = GmailApp.search(query, 0, TOPE)
  // ⚠️ Si la búsqueda trae MÁS del tope, los que sobran se pierden sin que nadie lo note. Se avisa:
  // «bajé 40» sobre 40 encontradas y sobre 200 que había es la misma frase y significan cosas
  // distintas. Se acota la ventana con la Script Property ARBA_QUERY (ej. `newer_than:15d`).
  var truncado = hilos.length >= TOPE

  var bajadas = [], yaEstaban = [], sinPdf = [], errores = []

  for (var h = 0; h < hilos.length; h++) {
    var msgs = hilos[h].getMessages()
    for (var i = 0; i < msgs.length; i++) {
      var msg = msgs[i]
      var links = linksDeBoleta_(msg.getBody())
      if (!links.length) continue

      for (var k = 0; k < links.length; k++) {
        try {
          var r = bajarBoleta_(links[k])
          if (!r) { sinPdf.push({ asunto: msg.getSubject(), link: links[k].slice(0, 90) }); continue }

          var nombre = nombreDeArchivo_(r.nombre, msg.getDate(), k, msg.getSubject())
          if (soloContar) { bajadas.push({ asunto: msg.getSubject(), archivo: nombre }); continue }

          // 🔒 Dedup por NOMBRE. Ver `nombreDeArchivo_`: el nombre lleva PARTIDA + PERÍODO, y sin
          // el período la deduplicación borraba boletas distintas en silencio.
          var ex = carpeta.getFilesByName(nombre)
          if (ex.hasNext()) {
            yaEstaban.push({ archivo: nombre, url: ex.next().getUrl() })
            continue
          }
          var file = carpeta.createFile(r.blob.setName(nombre))
          bajadas.push({
            asunto: msg.getSubject(),
            fecha: Utilities.formatDate(msg.getDate(), 'GMT-3', 'yyyy-MM-dd'),
            archivo: nombre, file_id: file.getId(), url: file.getUrl(),
          })
        } catch (e) {
          errores.push({ asunto: msg.getSubject(), error: String(e) })
        }
      }
    }
  }

  return {
    ok: true, modo: soloContar ? 'contar' : 'bajar', query: query,
    hilos: hilos.length, truncado: truncado,
    bajadas: bajadas, ya_estaban: yaEstaban, sin_pdf: sinPdf, errores: errores,
    resumen: bajadas.length + ' bajada(s) · ' + yaEstaban.length + ' ya estaban · '
      + sinPdf.length + ' link(s) que no dieron PDF · ' + errores.length + ' error(es)'
      + (truncado ? ' · ⚠️ se llegó al tope de ' + TOPE + ' conversaciones: puede haber más sin mirar' : ''),
  }
}

/** Para correr a mano desde el editor: informa qué encontraría, sin guardar nada. */
function testArbaContar() {
  Logger.log(JSON.stringify(bajarBoletasArba(true), null, 1))
}

/** Para correr a mano desde el editor: baja y archiva. */
function testArbaBajar() {
  Logger.log(JSON.stringify(bajarBoletasArba(false), null, 1))
}
