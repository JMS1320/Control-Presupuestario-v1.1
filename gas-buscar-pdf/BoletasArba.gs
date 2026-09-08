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
/**
 * 🗂️ El nombre de la subcarpeta, **replicando exactamente cómo archiva el usuario**:
 *
 * ```
 * MSA              ← es de MSA y llegó en el mail de MSA
 * MSA - viene PAM  ← es de MSA pero llegó en el mail de PAM
 * PAM · MA · ERM
 * _Sin asignar     ← llegó algo que no está en nuestro registro
 * ```
 *
 * 🔑 **El «viene X» no es decoración: es el hecho que hay que ver.** Sus carpetas de ejemplo ya
 * separaban *«MSA»* de *«MSA - viene PAM»* porque son dos situaciones distintas al momento de
 * pagar y de reclamarle a ARBA. Yo las había fundido en una sola —el dueño— y me corrigió:
 * *«replicá la carpeta tal cual, con el viene PAM»*.
 *
 * ⚠️ Una boleta que llega **por los dos lados** queda en las dos carpetas, una copia en cada una.
 * Es correcto y es informativo: así se ve la duplicación **en el Drive**, no sólo en el informe.
 */
function nombreCarpeta_(responsable, empresaDelMail) {
  var duenio = String(responsable || '').trim()
  if (!duenio) return '_Sin asignar'
  var vino = String(empresaDelMail || '').trim()
  return (vino && vino !== duenio) ? duenio + ' - viene ' + vino : duenio
}

/** La subcarpeta adentro de «Boletas ARBA». Find-or-create: nunca reemplaza ni borra. */
function subcarpetaDe_(padre, responsable, empresaDelMail) {
  var nombre = nombreCarpeta_(responsable, empresaDelMail)
  var it = padre.getFoldersByName(nombre)
  return it.hasNext() ? it.next() : padre.createFolder(nombre)
}

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
  var limpiar = function (u) { return String(u).replace(/&amp;/g, '&').replace(/[.,;)]+$/, '') }
  var unicos = function (arr) {
    var vistos = {}, res = []
    for (var i = 0; i < arr.length; i++) if (!vistos[arr[i]]) { vistos[arr[i]] = 1; res.push(arr[i]) }
    return res
  }

  // ── 1 · Los que están anclados en el texto de descarga ────────────────────────────────────────
  //
  // 🐞 **A-BUG-126 (2026-09-08).** ARBA envuelve **TODOS** los links del mail en su rastreador
  // `lt.php` — también los del pie: inicio, Cuenta DNI, darse de baja. Quedarse con «todo lo que
  // sea lt.php» traía **4 links de más por mail**, y cada uno costaba una descarga completa para
  // descubrir que no era un PDF. Con 6 mails eran ~25 descargas al pedo: por eso se acababa el
  // tiempo y quedaban 38 boletas sin bajar.
  //
  // 🔑 **Lo que distingue a una boleta no es el dominio, es de qué cuelga**: la celda «Descargar
  // boleta» de la tabla dice *Ingresar*. Eso además hace que la cantidad de links **coincida con
  // la cantidad de filas**, que es el control que venía avisando el descuadre.
  var anclados = []
  var reA = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  var ma
  while ((ma = reA.exec(html)) !== null) {
    var texto = String(ma[2]).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').trim()
    if (!/^(ingresar|descargar( boleta)?|ver boleta|descarga)$/i.test(texto)) continue
    var ua = limpiar(ma[1])
    if (/^https?:/i.test(ua)) anclados.push(ua)
  }
  if (anclados.length) return unicos(anclados)

  // ── 2 · Si no hay anclas reconocibles, el modo viejo ──────────────────────────────────────────
  // ⚠️ **Nunca quedarse sin bajar nada.** Si ARBA cambia el texto del botón, esto trae de más —
  // que es molesto— en vez de traer de menos, que es perder una boleta en silencio.
  var out = []
  var re = /https?:\/\/[^\s"'<>]+/gi
  var m
  while ((m = re.exec(html)) !== null) {
    var u = limpiar(m[0])
    if (/lt\.php\?tid=/i.test(u) || /pdfDeuda/i.test(u)) out.push(u)
  }
  return unicos(out)
}

/**
 * El cuerpo del mail como TEXTO, sin etiquetas.
 *
 * 🔑 **A propósito no se parsea el HTML.** No tengo el markup real de ARBA a la vista, y un parser
 * atado a `<tr>`/`<td>` se rompe el día que le cambien la maquetación — que es exactamente cómo
 * nació `A-BUG-119`. Sobre el texto plano da igual si la fila es una tabla, un `div` o un `span`
 * por celda: lo que se busca es **el orden en que aparecen los datos**, que no cambia.
 */
function textoPlanoDeMail_(html) {
  var t = String(html || '')
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  t = t.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
  return t.replace(/\s+/g, ' ').trim()
}

/** `099-015881-9` → `0990158819`. Para cruzar la partida del mail con la del nombre del PDF. */
function soloDigitos_(s) { return String(s || '').replace(/\D/g, '') }

/**
 * La partida que ARBA mete en el nombre del PDF: `Deuda-Inmobiliario-0990158819-R.pdf`.
 * Devuelve `''` si el nombre no la trae — el **complementario** es justamente ese caso.
 */
function partidaDeNombre_(nombreOriginal) {
  var m = String(nombreOriginal || '').match(/(\d{10})/)
  return m ? m[1] : ''
}

/**
 * 🔑 **A-FEAT-107 — las filas de la TABLA del cuerpo del mail.**
 *
 * Un mail de ARBA trae **varias boletas**: una fila por partida, con `Objeto Imponible · Importe $ ·
 * Descargar`. Leerla da **un segundo camino al mismo número**, independiente del PDF: si el importe
 * del mail y el del PDF no coinciden, algo se leyó mal **y se sabe sin abrir el archivo**.
 * Y para el **complementario** —que no trae partida en el PDF— el cuerpo del mail es la **única**
 * vía de saber a qué corresponde.
 *
 * ## Cómo se arma una fila
 * Un solo barrido en orden. Cada **objeto imponible** abre una fila y el **primer importe que le
 * sigue** es el suyo; el objeto siguiente la cierra. Eso es lo único que sobrevive a que muevan las
 * columnas: no depende de cuántas celdas haya ni de en qué orden estén.
 *
 * - **Partida**: `099-015881-9` (`3-6-1` dígitos) — el inmobiliario, una por parcela.
 * - **CUIT**: `20-04439022-2` (`2-8-1`) — el complementario grava **al contribuyente**, no a la
 *   parcela, y su objeto imponible es el CUIT.
 *
 * ⚠️ Los dos patrones **no se pisan** (un CUIT no puede leerse como partida ni al revés), y el CUIT
 * del encabezado —el que dice de qué empresa es el mail— sale **sin importe**: por eso se devuelve
 * aparte en `contribuyente` en vez de ensuciar las filas.
 *
 * **Nunca falla ni rechaza**: si no reconoce nada devuelve lista vacía y la bajada sigue igual.
 */
function filasDelMail_(html) {
  var texto = textoPlanoDeMail_(html)
  var re = /(\b\d{3}-\d{6}-\d\b)|(\b\d{2}-\d{8}-\d\b)|(\b\d{1,3}(?:\.\d{3})*,\d{2}\b)/g

  var filas = [], contribuyente = '', actual = null, m
  var cerrar = function () {
    if (!actual) return
    // Un CUIT sin importe es el encabezado («de qué empresa es este mail»), no una fila de la tabla.
    if (actual.tipo === 'cuit' && actual.importe === null) { if (!contribuyente) contribuyente = actual.objeto }
    else filas.push(actual)
    actual = null
  }
  while ((m = re.exec(texto)) !== null) {
    if (m[1] || m[2]) {
      cerrar()
      actual = { objeto: m[1] || m[2], tipo: m[1] ? 'partida' : 'cuit', importe: null }
    } else if (actual && actual.importe === null) {
      actual.importe = parseFloat(m[3].replace(/\./g, '').replace(',', '.'))
    }
  }
  cerrar()
  return { filas: filas, contribuyente: contribuyente }
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
/**
 * 🗂️ El nombre **con la convención del usuario**, la misma con la que venía archivando a mano:
 *
 * ```
 * 2026 - Inmob - Cuota 3 - Tango Parra 1.pdf
 * 2026 - Complementario - Cuota 3.pdf
 * 2026 - Complementario - Cuota 3 - Aviso de debito.pdf
 * ```
 *
 * 🔑 **El nombre del campo lo pone la APP, no el GAS.** El GAS sólo ve la partida; quién es «Tango
 * Parra 1» y de quién es vive en `egresos_sin_factura`. Por eso el mapa viaja en el pedido: sin él
 * el nombre cae a la partida, que identifica igual pero no se lee.
 *
 * Devuelve `null` si no se puede armar así; ahí el llamador usa el nombre técnico de siempre.
 */
function nombreUsuario_(fechaMail, asunto, objeto, mapa) {
  var a = String(asunto || '')
  var mc = a.match(/Cuota\s*(\d+)/i)
  if (!mc) return null
  var anio = Utilities.formatDate(fechaMail, 'GMT-3', 'yyyy')
  var cuota = 'Cuota ' + mc[1]

  if (/Complementario/i.test(a)) {
    return anio + ' - Complementario - ' + cuota
      + (/Aviso\s+de\s+d[eé]bito/i.test(a) ? ' - Aviso de debito' : '') + '.pdf'
  }
  // El nombre del campo si lo conocemos; si no, la partida — que es feo pero no ambiguo.
  var info = mapa && objeto ? mapa[objeto] : null
  var comoSeLlama = info && info.nombre ? info.nombre : objeto
  if (!comoSeLlama) return null
  // Drive no acepta `/` en un nombre de archivo.
  return anio + ' - Inmob - ' + cuota + ' - ' + String(comoSeLlama).split('/').join('-') + '.pdf'
}

function nombreDeArchivo_(nombreOriginal, fechaMail, k, asunto, objeto, url) {
  var anio = Utilities.formatDate(fechaMail, 'GMT-3', 'yyyy')
  // El asunto trae la cuota: «Boleta por Mail - Vencimiento del Impuesto Inmobiliario Rural Cuota 3».
  var mc = String(asunto || '').match(/Cuota\s*(\d+)/i)
  var periodo = anio + (mc ? '-C' + mc[1] : '-' + Utilities.formatDate(fechaMail, 'GMT-3', 'MM-dd'))
  // El complementario y el aviso de débito son distintos y comparten cuota: sin esto, dos boletas
  // del mismo contribuyente en la misma cuota se pisarían entre sí.
  var clase = /Complementario/i.test(String(asunto || '')) ? ' Compl' : ''
  if (/Aviso\s+de\s+d[eé]bito/i.test(String(asunto || ''))) clase += ' Debito'

  if (nombreOriginal) {
    var base = String(nombreOriginal).replace(/\.pdf$/i, '')
    return periodo + ' - ' + base + '.pdf'
  }

  // 🐞 **A-BUG-127 (2026-09-08).** ARBA **no siempre manda el nombre** en el `Content-disposition`,
  // y cuando falta el nombre de emergencia numeraba **por posición dentro del mail**:
  // `ARBA 2026-C3 - 1.pdf`. Como el dedup es por nombre, el «1» del mail de MSA y el «1» del de PAM
  // **son el mismo archivo**: la segunda boleta se saltea como «ya estaba». Es exactamente el
  // defecto que `A-BUG-120` creía haber cerrado, entrando por la puerta de al lado.
  //
  // 🔑 El objeto imponible de la tabla del mail —la partida, o el CUIT en el complementario—
  // identifica la boleta **sin depender del orden**. Es el mismo dato que ya se usa para casarla
  // con su template.
  if (objeto) return periodo + clase + ' - ' + String(objeto) + '.pdf'

  // Último recurso: el identificador del propio link. Feo pero **estable y único** — el mismo mail
  // procesado dos veces da el mismo, así que sigue sin duplicar.
  var mt = String(url || '').match(/tid=([A-Za-z0-9_-]+)/)
  if (mt) return 'ARBA ' + periodo + clase + ' - ' + mt[1] + '.pdf'
  return 'ARBA ' + periodo + clase + ' - ' + (k + 1) + '.pdf'
}

/**
 * Recorre los mails de ARBA, baja lo que encuentra y lo archiva.
 *
 * @param {boolean} soloContar si es true **no baja ni un PDF**: sólo informa qué encontraría.
 * @param {Object=} opciones `{ dias, presupuesto_ms }`.
 *
 * 🐞 **Por qué «Ver qué hay» tardaba tanto que se moría (2026-09-08).** Bajaba **todos los PDFs
 * igual** y recién después miraba si tenía que guardarlos: `bajarBoleta_()` corría para cada link
 * y el resultado se descartaba. Con 60 días de mails eran docenas de descargas para no usar
 * ninguna, y la ruta cortaba a los 45 s. **El paso que existe para mirar antes de tocar nada era
 * tan caro como hacerlo de verdad.** Ahora no baja nada: lo que informa sale de la **tabla del
 * cuerpo del mail** (`A-FEAT-107`), que es gratis y además dice más — partida e importe, no sólo
 * el nombre del archivo.
 *
 * 🔑 **Y la bajada real tiene presupuesto de tiempo.** Antes seguía hasta terminar y la ruta se
 * cansaba primero: los archivos quedaban guardados pero el usuario veía un error, que es la peor
 * combinación. Ahora corta antes, dice **cuántos quedaron**, y como el dedup es por nombre
 * **volver a correrlo continúa donde iba** sin duplicar nada.
 */
function bajarBoletasArba(soloContar, opciones) {
  var op = opciones || {}
  var arranque = Date.now()
  // Por debajo de los 45 s que espera la ruta: mejor devolver «faltan 12» que morir sin decir nada.
  var presupuestoMs = Number(op.presupuesto_ms) > 0 ? Number(op.presupuesto_ms) : 35000

  // La ventana la manda quien llama; si no, la Script Property; si no, el default.
  var query = propArba_('ARBA_QUERY', ARBA_QUERY_DEFAULT)
  if (Number(op.dias) > 0) {
    query = query.replace(/\s*newer_than:\d+[dmy]/i, '') + ' newer_than:' + Math.round(Number(op.dias)) + 'd'
  }
  // 🗂️ El mapa **partida → { nombre del campo, responsable }**, que manda la app.
  // El GAS no puede saberlo: quién es «Tango Parra 1» y de quién es vive en `egresos_sin_factura`.
  // Se recibe en el pedido en vez de consultarlo, así siempre coincide con lo que el usuario ve.
  var mapaPartidas = op.partidas || null
  var empresaPorCuit = op.empresa_por_cuit || null

  var carpeta = soloContar ? null : carpetaArba_()
  var TOPE = 50
  var hilos = GmailApp.search(query, 0, TOPE)
  // ⚠️ Si la búsqueda trae MÁS del tope, los que sobran se pierden sin que nadie lo note. Se avisa:
  // «bajé 40» sobre 40 encontradas y sobre 200 que había es la misma frase y significan cosas
  // distintas. Se acota la ventana con la Script Property ARBA_QUERY (ej. `newer_than:15d`).
  var truncado = hilos.length >= TOPE

  var bajadas = [], yaEstaban = [], sinPdf = [], errores = []
  // Lo leído de la tabla del cuerpo, mail por mail (A-FEAT-107). Va en la respuesta para poder
  // verificar contra un mail REAL que la tabla se está leyendo bien, sin bajar nada.
  var tablas = [], descuadres = []
  // Cuántas boletas quedaron sin bajar por falta de tiempo. Volver a correr continúa: el dedup es
  // por nombre, así que lo ya archivado no se toca.
  var quedaron = 0, sinTiempo = false

  for (var h = 0; h < hilos.length; h++) {
    var msgs = hilos[h].getMessages()
    for (var i = 0; i < msgs.length; i++) {
      var msg = msgs[i]
      var cuerpo = msg.getBody()
      var links = linksDeBoleta_(cuerpo)
      if (!links.length) continue

      // 🔑 **A-FEAT-107** — la tabla del cuerpo, leída UNA vez por mail. De acá sale el importe que
      // después se contrasta contra el del PDF, y la identidad del complementario.
      var tabla = filasDelMail_(cuerpo)
      tablas.push({
        asunto: msg.getSubject(), contribuyente: tabla.contribuyente,
        filas: tabla.filas, links: links.length,
      })
      // Si la cantidad no coincide, uno de los dos lados se leyó mal. No se elige ninguno: se avisa.
      if (tabla.filas.length && tabla.filas.length !== links.length) {
        descuadres.push({
          asunto: msg.getSubject(),
          detalle: tabla.filas.length + ' fila(s) en la tabla del mail contra ' + links.length + ' link(s) de descarga',
        })
      }

      // 🔴 MIRAR NO CUESTA. En modo contar no se toca la red: se informa lo que dice la tabla del
      // mail y cuántos links hay. Es lo que el usuario necesita para decidir si sigue.
      if (soloContar) {
        for (var q = 0; q < tabla.filas.length; q++) {
          bajadas.push({
            asunto: msg.getSubject(),
            objeto_mail: tabla.filas[q].objeto, importe_mail: tabla.filas[q].importe,
            contribuyente: tabla.contribuyente || null,
          })
        }
        // Un mail con links pero sin tabla legible igual se cuenta: si no, «no encontré nada»
        // se confundiría con «no hay nada», que es justo lo que no puede pasar.
        if (!tabla.filas.length) {
          bajadas.push({ asunto: msg.getSubject(), objeto_mail: null, importe_mail: null, links: links.length })
        }
        continue
      }

      for (var k = 0; k < links.length; k++) {
        // Se corta ANTES de que la ruta se canse, y se dice cuántos quedaron.
        if (Date.now() - arranque > presupuestoMs) { quedaron += (links.length - k); sinTiempo = true; break }
        try {
          // 🐞 **A-BUG-128 (2026-09-08) — PRIMERO EL NOMBRE, DESPUÉS LA DESCARGA.**
          // Antes se bajaba el PDF entero y **recién al final** se preguntaba si ya estaba: en cada
          // re-corrida se volvía a traer todo lo ya archivado para tirarlo. Con 31 boletas y un
          // presupuesto de 35 s, cada pasada avanzaba ~10 y las anteriores se pagaban de nuevo.
          // Es el mismo error que el de «Ver qué hay» (`A-BUG-125`), en el otro extremo del bucle.
          //
          // 🔑 Y no hacía falta: **el nombre sale de la tabla del mail**, no del archivo. Lo único
          // que necesita el PDF es el camino de emergencia, cuando el asunto no trae la cuota.

          // La fila del mail que le corresponde, SIN bajar nada: por posición cuando la cantidad de
          // links coincide con la de filas —lo normal desde `A-BUG-126`—, o la única que hay.
          var fila = null
          if (tabla.filas.length === links.length) fila = tabla.filas[k]
          else if (tabla.filas.length === 1) fila = tabla.filas[0]

          var elObjeto = fila ? fila.objeto : null
          var empresaDelMail = (tabla.contribuyente && empresaPorCuit)
            ? empresaPorCuit[tabla.contribuyente] : null
          var info = elObjeto && mapaPartidas ? mapaPartidas[elObjeto] : null
          // El complementario no tiene partida: su dueño ES el contribuyente del mail.
          var duenio = info && info.responsable ? info.responsable
            : (/Complementario/i.test(msg.getSubject()) ? empresaDelMail : null)
          var destino = subcarpetaDe_(carpeta, duenio, empresaDelMail)

          // 🔒 Dedup por NOMBRE, mirando **la subcarpeta del dueño** y no la raíz: desde que cada
          // empresa tiene la suya, buscar en el padre daría «ya estaba» por un archivo de otra.
          var nombre = nombreUsuario_(msg.getDate(), msg.getSubject(), elObjeto, mapaPartidas)
          if (nombre) {
            var yaEsta = destino.getFilesByName(nombre)
            if (yaEsta.hasNext()) {
              // ✅ Acá se ahorra la descarga: es lo que hace que re-correr sea barato.
              yaEstaban.push({ archivo: nombre, carpeta: destino.getName(), url: yaEsta.next().getUrl() })
              continue
            }
          }

          var r = bajarBoleta_(links[k])
          if (!r) { sinPdf.push({ asunto: msg.getSubject(), link: links[k].slice(0, 90) }); continue }

          // Camino de emergencia: sin cuota en el asunto no se puede armar el nombre del usuario, y
          // ahí sí hace falta el que manda ARBA. Lleva el objeto imponible porque numerar por
          // posición hacía colisionar boletas de mails distintos (`A-BUG-127`).
          if (!nombre) {
            var laPartida = partidaDeNombre_(r.nombre)
            if (laPartida) {
              for (var f = 0; f < tabla.filas.length; f++) {
                if (soloDigitos_(tabla.filas[f].objeto) === laPartida) { elObjeto = tabla.filas[f].objeto; break }
              }
            }
            nombre = nombreDeArchivo_(r.nombre, msg.getDate(), k, msg.getSubject(), elObjeto, links[k])
            var ex = destino.getFilesByName(nombre)
            if (ex.hasNext()) {
              yaEstaban.push({ archivo: nombre, carpeta: destino.getName(), url: ex.next().getUrl() })
              continue
            }
          }
          var file = destino.createFile(r.blob.setName(nombre))
          bajadas.push({
            asunto: msg.getSubject(),
            fecha: Utilities.formatDate(msg.getDate(), 'GMT-3', 'yyyy-MM-dd'),
            archivo: nombre, carpeta: destino.getName(),
            file_id: file.getId(), url: file.getUrl(),
            // El SEGUNDO camino al mismo número: lo que dice el mail, para contrastar contra el PDF.
            objeto_mail: fila ? fila.objeto : null, importe_mail: fila ? fila.importe : null,
            contribuyente: tabla.contribuyente || null,
          })
        } catch (e) {
          errores.push({ asunto: msg.getSubject(), error: String(e) })
        }
      }
    }
  }

  var conImporte = 0
  for (var b = 0; b < bajadas.length; b++) if (bajadas[b].importe_mail != null) conImporte++

  return {
    ok: true, modo: soloContar ? 'contar' : 'bajar', query: query,
    hilos: hilos.length, truncado: truncado,
    bajadas: bajadas, ya_estaban: yaEstaban, sin_pdf: sinPdf, errores: errores,
    tablas: tablas, descuadres: descuadres,
    quedaron: quedaron, sin_tiempo: sinTiempo,
    segundos: Math.round((Date.now() - arranque) / 100) / 10,
    resumen: (soloContar
      ? bajadas.length + ' boleta(s) encontrada(s) en ' + tablas.length + ' mail(s) · nada bajado'
      : bajadas.length + ' bajada(s) · ' + yaEstaban.length + ' ya estaban · '
        + sinPdf.length + ' link(s) que no dieron PDF · ' + errores.length + ' error(es)'
        + ' · ' + conImporte + '/' + bajadas.length + ' con importe leído del mail')
      + (descuadres.length ? ' · ⚠️ ' + descuadres.length + ' mail(s) donde la tabla y los links no coinciden' : '')
      + (sinTiempo ? ' · ⏳ quedaron ' + quedaron + ' sin bajar por tiempo: volvé a correrlo y sigue donde iba (no duplica)' : '')
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
