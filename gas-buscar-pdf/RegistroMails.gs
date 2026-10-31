/**
 * 📬 REGISTRO DE MAILS — A-FEAT-1425 (JMS 30/10)
 *
 * «Cada mail se registra quedando indexado para posterior referencia y consulta, con link para ir a verlo.»
 *
 * Qué hace, en la casilla donde corre este GAS (sanmanuel.sp):
 *   1. `registrarMailsNuevos()` — trigger cada 15 min. Recorre la casilla DÍA POR DÍA desde el cursor guardado y
 *      escribe cada mensaje (recibido o enviado) en `public.mails_registro`, clasificado con `public.mails_reglas`.
 *      Si se corta por tiempo, la próxima corrida sigue desde donde quedó. Un mensaje ya registrado se ignora
 *      (único por canal + casilla + mensaje_id), así que volver a pasar por un día no duplica nada.
 *   2. `enviarReporteDiario()` — trigger diario a la mañana. Manda a la PROPIA casilla el reporte de las últimas
 *      24 h: primero lo que hay que mirar, después todo lo que llegó por tipo, con link a cada mail.
 *   3. `iniciarRegistro('2026-08-01')` — una vez, a mano: fija desde qué día se registra (el pasado se carga solo,
 *      de a tandas, con el mismo trigger).
 *
 * 🛑 SÓLO LEE la casilla: no etiqueta, no mueve, no archiva, no borra. Lo único que envía es el reporte, a sí misma.
 *
 * Propiedades del script (⚙ → Propiedades del script):
 *   SUPABASE_URL  (default: la del proyecto)  ·  SUPABASE_KEY = la service_role (la misma del GAS de detalles de pago)
 *   REG_CASILLA   (default: sanmanuel.sp@gmail.com) · REG_CURSOR (lo maneja el script: 'AAAA-MM-DD')
 *
 * La lógica que decide (clasificar, armar el reporte) está en funciones puras que se prueban sin Google:
 * `npm run probar:registro-mails` las lee de este archivo.
 */

var REG_URL_DEFAULT = 'https://lyojiaglcictmboqwxfm.supabase.co'
var REG_CASILLA_DEFAULT = 'sanmanuel.sp@gmail.com'
var REG_PREFIJO_REPORTE = '[Registro de mails]'
var REG_TOPE_MS = 5 * 60 * 1000  // Apps Script corta a los 6 min

function regProp_(k, def) {
  var v = PropertiesService.getScriptProperties().getProperty(k)
  return v ? v : def
}

function regSupa_(metodo, ruta, cuerpo, prefer) {
  var key = regProp_('SUPABASE_KEY', '')
  if (!key) throw new Error('Falta la propiedad SUPABASE_KEY (la service_role)')
  var headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }
  if (prefer) headers.Prefer = prefer
  var opciones = { method: metodo, headers: headers, muteHttpExceptions: true }
  if (cuerpo) opciones.payload = JSON.stringify(cuerpo)
  var res = UrlFetchApp.fetch(regProp_('SUPABASE_URL', REG_URL_DEFAULT) + '/rest/v1/' + ruta, opciones)
  if (res.getResponseCode() >= 300) throw new Error('Supabase ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300))
  var txt = res.getContentText()
  return txt ? JSON.parse(txt) : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Lógica pura (se prueba sin Google)
// ─────────────────────────────────────────────────────────────────────────────

/** 'Banco Galicia <e-resumen@bancogalicia.com.ar>' → 'e-resumen@bancogalicia.com.ar' */
function emailDe_(s) {
  var t = String(s || '')
  var m = t.match(/<([^>]+)>/)
  return (m ? m[1] : t).trim().toLowerCase()
}

/** 'Banco Galicia <e-resumen@…>' → 'Banco Galicia' (vacío si no trae nombre) */
function nombreDe_(s) {
  var t = String(s || '')
  var i = t.indexOf('<')
  return i > 0 ? t.slice(0, i).replace(/["']/g, '').trim() : ''
}

/** Sin mayúsculas ni tildes, para comparar asuntos. */
function normalizarReg_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Gmail ignora los puntos de la parte local: sanmanuelsp@ y sanmanuel.sp@ son la misma casilla. */
function mismaCasilla_(a, b) {
  var limpiar = function (x) {
    var e = emailDe_(x), i = e.indexOf('@')
    if (i < 0) return e
    var local = e.slice(0, i), dom = e.slice(i + 1)
    if (dom === 'gmail.com' || dom === 'googlemail.com') { local = local.split('+')[0].replace(/\./g, ''); dom = 'gmail.com' }
    return local + '@' + dom
  }
  return limpiar(a) === limpiar(b)
}

/**
 * ¿La regla coincide? remitente_patron: email exacto, o '@dominio' (vale el dominio y sus subdominios).
 * asunto_patron (opcional): texto que tiene que estar en el asunto, sin mayúsculas ni tildes.
 */
function reglaCoincide_(regla, remitente, asunto) {
  if (!regla || regla.activa === false) return false
  var p = String(regla.remitente_patron || '').trim().toLowerCase()
  var r = emailDe_(remitente)
  if (!p || !r) return false
  var okRemitente
  if (p.charAt(0) === '@') {
    var dom = p.slice(1), domR = r.slice(r.indexOf('@') + 1)
    okRemitente = domR === dom || domR.slice(-(dom.length + 1)) === '.' + dom
  } else {
    okRemitente = r === p
  }
  if (!okRemitente) return false
  if (regla.asunto_patron) return normalizarReg_(asunto).indexOf(normalizarReg_(regla.asunto_patron)) >= 0
  return true
}

/**
 * La primera regla activa que coincide, por `orden` (y a igual orden, la que pide asunto va antes: es más específica).
 * Sin regla → tipo y acción vacíos: el reporte los muestra aparte para que se agregue la regla.
 * El propio reporte se clasifica solo (notificación, archivar) para no ensuciar el reporte siguiente.
 */
function clasificarMail_(reglas, remitente, asunto) {
  if (String(asunto || '').indexOf(REG_PREFIJO_REPORTE) === 0) return { regla_id: null, tipo: 'notificacion', accion: 'archivar' }
  var ordenadas = (reglas || []).slice().sort(function (a, b) {
    return (a.orden - b.orden) || ((b.asunto_patron ? 1 : 0) - (a.asunto_patron ? 1 : 0))
  })
  for (var i = 0; i < ordenadas.length; i++) {
    if (reglaCoincide_(ordenadas[i], remitente, asunto)) return { regla_id: ordenadas[i].id, tipo: ordenadas[i].tipo, accion: ordenadas[i].accion }
  }
  return { regla_id: null, tipo: null, accion: null }
}

/** Link directo al mensaje en Gmail (abre si la sesión de esa casilla está abierta). */
function linkGmail_(casilla, mensajeId) {
  return 'https://mail.google.com/mail/u/?authuser=' + encodeURIComponent(casilla) + '#all/' + mensajeId
}

var REG_NOMBRE_TIPO = {
  factura: 'Facturas', banco: 'Bancos', impuestos: 'Impuestos', contador: 'Contadores', productivo: 'Productivo',
  legal: 'Legal / sucesión', interno: 'Interno', servicios: 'Servicios e inmuebles', seguros: 'Seguros',
  notificacion: 'Notificaciones', propaganda: 'Propaganda', otro: 'Otros'
}
var REG_ORDEN_TIPO = ['impuestos', 'contador', 'legal', 'productivo', 'factura', 'banco', 'seguros', 'servicios', 'interno', 'otro', 'notificacion', 'propaganda']

// 🚨 Mails GRAVES (A-FEAT-1438). MISMA lista y regla que `gravedadDeMail` de `lib/mails/registro.ts`: si cambia una,
// cambiar la otra (`npm run probar:registro-mails` compara las dos).
var REG_PALABRAS_GRAVES = ['mora', 'deuda', 'deudas', 'adeuda', 'adeudado', 'intimacion', 'intimamos', 'embargo', 'apremio', 'ejecucion fiscal',
  'juicio', 'carta documento', 'rechazado', 'rechazada', 'rechazo', 'saldo negativo', 'descubierto', 'multa', 'sancion',
  'suspension', 'inhabilitacion', 'incumplimiento', 'vencido', 'vencida', 'vencio']
var REG_TIPOS_DOBLE = ['impuestos', 'legal']
var REG_DOMINIOS_DOBLE = ['arba.gov.ar', 'afip.gob.ar', 'arca.gob.ar', 'agip.gob.ar']

/** Pura: 0 nada · 1 grave · 2 doblemente grave. No cuenta lo enviado, lo archivado ni la propaganda. */
function gravedadMail_(f) {
  var tipo = f.tipo_manual || f.tipo
  if (f.sentido !== 'recibido' || f.accion === 'archivar' || tipo === 'propaganda') return { nivel: 0, palabras: [] }
  var texto = ' ' + normalizarReg_((f.asunto || '') + ' ' + (f.extracto || '')).replace(/[^a-z0-9ñ]+/g, ' ') + ' '
  var palabras = REG_PALABRAS_GRAVES.filter(function (p) { return texto.indexOf(' ' + p + ' ') >= 0 })
  if (!palabras.length) return { nivel: 0, palabras: palabras }
  var dom = String(f.remitente || '').toLowerCase().split('@')[1] || ''
  var doble = (tipo && REG_TIPOS_DOBLE.indexOf(tipo) >= 0) || REG_DOMINIOS_DOBLE.some(function (d) { return dom === d || dom.slice(-(d.length + 1)) === '.' + d })
  return { nivel: doble ? 2 : 1, palabras: palabras }
}

/** Pura: los graves NO terminados, agrupados por remitente + asunto; doblemente graves primero, después el más reciente. */
function agruparGraves_(filas) {
  var g = {}, orden = []
  filas.forEach(function (f) {
    if (f.seguimiento === 'terminado') return
    var gr = gravedadMail_(f)
    if (!gr.nivel) return
    var asunto = String(f.asunto || '').replace(/^\s*((re|rv|fw|fwd|tr)\s*:\s*)+/i, '').trim()
    var clave = String(f.remitente || '').toLowerCase() + '|' + normalizarReg_(asunto)
    if (!g[clave]) { g[clave] = { asunto: asunto || '(sin asunto)', remitente: f.remitente_nombre || f.remitente || '', nivel: gr.nivel, palabras: gr.palabras.slice(), n: 0, ultimo: f }; orden.push(clave) }
    var x = g[clave]
    x.n++
    if (gr.nivel > x.nivel) x.nivel = gr.nivel
    gr.palabras.forEach(function (p) { if (x.palabras.indexOf(p) < 0) x.palabras.push(p) })
    if (f.fecha > x.ultimo.fecha) x.ultimo = f
  })
  return orden.map(function (k) { return g[k] }).sort(function (a, b) { return (b.nivel - a.nivel) || (a.ultimo.fecha < b.ultimo.fecha ? 1 : -1) })
}

function escHtml_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Pura: las filas del registro de un período → { asunto, html, texto } del reporte.
 * Orden de minuta: los PENDIENTES (de cualquier fecha, vencidos primero) · lo que hay que mirar · lo que no tiene
 * regla · lo que llegó, por tipo · lo archivado, contado · lo que salió. Los conteos del período tienen que sumar el
 * total: si no, se dice. `pendientes` (A-FEAT-1437) y `hoyTxt` ('AAAA-MM-DD') son optativos.
 */
function armarReporte_(filas, casilla, desdeTxt, hastaTxt, pendientes, hoyTxt, graves) {
  var tipoDe = function (f) { return f.tipo_manual || f.tipo }
  var recibidos = filas.filter(function (f) { return f.sentido === 'recibido' })
  var enviados = filas.filter(function (f) { return f.sentido === 'enviado' })
  var avisar = recibidos.filter(function (f) { return f.accion === 'avisar' })
  var sinRegla = recibidos.filter(function (f) { return !tipoDe(f) })
  var guardar = recibidos.filter(function (f) { return f.accion === 'guardar' && tipoDe(f) })
  var archivar = recibidos.filter(function (f) { return f.accion === 'archivar' })

  var link = function (f) { return '<a href="' + linkGmail_(casilla, f.mensaje_id) + '">' + escHtml_(f.asunto || '(sin asunto)') + '</a>' }
  var quien = function (f) { return escHtml_(f.remitente_nombre || f.remitente || '') }
  var lista = function (xs) {
    return '<ul>' + xs.map(function (f) {
      var adj = f.adjuntos && f.adjuntos.length ? ' · 📎 ' + f.adjuntos.length : ''
      return '<li>' + link(f) + ' — ' + quien(f) + adj + (f.procesado_por ? ' · ✔ ' + escHtml_(f.procesado_por) : '') + '</li>'
    }).join('') + '</ul>'
  }
  var porTipo = function (xs) {
    var g = {}
    xs.forEach(function (f) { var t = tipoDe(f) || 'otro'; (g[t] = g[t] || []).push(f) })
    return REG_ORDEN_TIPO.filter(function (t) { return g[t] }).map(function (t) { return { tipo: t, filas: g[t] } })
  }

  var h = []
  h.push('<p>Casilla ' + escHtml_(casilla) + ' · del ' + escHtml_(desdeTxt) + ' al ' + escHtml_(hastaTxt) + ' · ' +
    recibidos.length + ' recibidos · ' + enviados.length + ' enviados.</p>')
  var grav = graves || []
  if (grav.length) {
    h.push('<h3>🚨 Graves sin terminar (' + grav.length + ')</h3><ul>' + grav.map(function (x) {
      return '<li>' + (x.nivel === 2 ? '🔴 ' : '🟠 ') + link(x.ultimo).replace(escHtml_(x.ultimo.asunto || '(sin asunto)'), escHtml_(x.asunto)) +
        (x.n > 1 ? ' <b>×' + x.n + '</b>' : '') + ' — ' + escHtml_(x.remitente) + ' · «' + escHtml_(x.palabras.join('», «')) + '»</li>'
    }).join('') + '</ul>')
  }
  var pend = (pendientes || []).slice().sort(function (a, b) {
    var fa = a.seguimiento_fecha || '9999', fb = b.seguimiento_fecha || '9999'
    return fa < fb ? -1 : fa > fb ? 1 : (a.fecha < b.fecha ? -1 : 1)
  })
  var vencidos = pend.filter(function (f) { return f.seguimiento_fecha && hoyTxt && f.seguimiento_fecha < hoyTxt }).length
  if (pend.length) {
    h.push('<h3>📌 Pendientes (' + pend.length + (vencidos ? ', ' + vencidos + ' vencidos' : '') + ')</h3><ul>' + pend.map(function (f) {
      var venc = f.seguimiento_fecha && hoyTxt && f.seguimiento_fecha < hoyTxt
      var cuando = f.seguimiento_fecha ? ' · ' + (venc ? '<b style="color:#b3261e">vencido ' : 'para el ') + f.seguimiento_fecha.slice(8, 10) + '/' + f.seguimiento_fecha.slice(5, 7) + (venc ? '</b>' : '') : ''
      return '<li>' + link(f) + ' — ' + quien(f) + cuando + (f.seguimiento_nota ? ' · <i>' + escHtml_(f.seguimiento_nota) + '</i>' : '') + '</li>'
    }).join('') + '</ul>')
  }
  if (avisar.length) h.push('<h3>🔴 Para mirar (' + avisar.length + ')</h3>' + lista(avisar))
  if (sinRegla.length) h.push('<h3>❓ Sin regla — decir qué son (' + sinRegla.length + ')</h3>' + lista(sinRegla))
  porTipo(guardar).forEach(function (g) { h.push('<h3>' + REG_NOMBRE_TIPO[g.tipo] + ' (' + g.filas.length + ')</h3>' + lista(g.filas)) })
  if (archivar.length) {
    var cuenta = {}
    archivar.forEach(function (f) { var k = (f.remitente_nombre || f.remitente || '?'); cuenta[k] = (cuenta[k] || 0) + 1 })
    var top = Object.keys(cuenta).sort(function (a, b) { return cuenta[b] - cuenta[a] }).slice(0, 12)
    h.push('<h3>Archivado sin avisar (' + archivar.length + ')</h3><p>' + top.map(function (k) { return escHtml_(k) + ' ' + cuenta[k] }).join(' · ') + '</p>')
  }
  if (enviados.length) h.push('<h3>Lo que salió (' + enviados.length + ')</h3>' + '<ul>' + enviados.map(function (f) {
    return '<li>' + link(f) + ' — a ' + escHtml_(f.destinatarios || '') + '</li>'
  }).join('') + '</ul>')

  // Control: cada recibido cae en exactamente un grupo
  var suma = avisar.length + sinRegla.length + guardar.length + archivar.length
  var cierra = suma === recibidos.length
  h.push('<p style="color:#666">' + (cierra ? '✓ ' : '⚠️ NO CIERRA: ') + 'para mirar ' + avisar.length + ' + sin regla ' + sinRegla.length +
    ' + guardados ' + guardar.length + ' + archivados ' + archivar.length + ' = ' + suma + ' de ' + recibidos.length + ' recibidos.</p>')

  var asunto = REG_PREFIJO_REPORTE + ' ' + hastaTxt + ' — ' + (grav.length ? '🚨 ' + grav.length + ' graves · ' : '') + (pend.length ? pend.length + ' pendientes' + (vencidos ? ' (' + vencidos + ' vencidos)' : '') + ' · ' : '') +
    (avisar.length ? avisar.length + ' para mirar · ' : '') + recibidos.length + ' recibidos'
  return { asunto: asunto, html: h.join('\n'), cierra: cierra }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que toca Google y la base
// ─────────────────────────────────────────────────────────────────────────────

function regCasilla_() { return regProp_('REG_CASILLA', REG_CASILLA_DEFAULT) }

function regFechaTxt_(d) { return Utilities.formatDate(d, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd') }

/** Una vez, a mano: desde qué día se registra. */
function iniciarRegistro(desdeIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(desdeIso))) throw new Error("Usar iniciarRegistro('AAAA-MM-DD')")
  PropertiesService.getScriptProperties().setProperty('REG_CURSOR', desdeIso)
  Logger.log('Registro desde ' + desdeIso + '. El trigger de 15 min va cargando de a tandas.')
}

/** Atajo para correr desde el editor sin escribir parámetros (el editor no deja pasar argumentos). */
function iniciarRegistroDesdeAgosto() { iniciarRegistro('2026-08-01') }

/** El mensaje de Gmail → la fila del registro. */
function filaDeMensaje_(m, hilo, casilla, reglas) {
  var de = m.getFrom()
  var enviado = mismaCasilla_(de, casilla)
  var para = [m.getTo(), m.getCc()].filter(function (x) { return x }).join(', ')
  // Para clasificar un enviado se mira a quién va (el primer destinatario)
  var contraparte = enviado ? String(m.getTo() || '').split(',')[0] : de
  var c = clasificarMail_(reglas, contraparte, m.getSubject())
  var adj = []
  try {
    m.getAttachments({ includeInlineImages: false }).forEach(function (a) { adj.push({ nombre: a.getName(), tipo: a.getContentType(), bytes: a.getSize() }) })
  } catch (e) { /* adjunto ilegible: queda sin listar, el mail se registra igual */ }
  var cuerpo = ''
  try { cuerpo = String(m.getPlainBody() || '').replace(/\s+/g, ' ').trim().slice(0, 300) } catch (e) {}
  return {
    canal: 'mail', casilla: casilla, mensaje_id: m.getId(), hilo_id: hilo.getId(),
    sentido: enviado ? 'enviado' : 'recibido', fecha: m.getDate().toISOString(),
    remitente: emailDe_(de), remitente_nombre: nombreDe_(de) || null, destinatarios: para || null,
    asunto: m.getSubject() || null, extracto: cuerpo || null,
    etiquetas: hilo.getLabels().map(function (l) { return l.getName() }),
    adjuntos: adj.length ? adj : null,
    regla_id: c.regla_id, tipo: c.tipo, accion: c.accion
  }
}

function regGuardar_(filas) {
  for (var i = 0; i < filas.length; i += 200) {
    regSupa_('post', 'mails_registro?on_conflict=canal,casilla,mensaje_id', filas.slice(i, i + 200), 'resolution=ignore-duplicates,return=minimal')
  }
}

/** Trigger cada 15 min: recorre del cursor a hoy, día por día. */
function registrarMailsNuevos() {
  var t0 = Date.now()
  var lock = LockService.getScriptLock()
  if (!lock.tryLock(1000)) return  // otra corrida en curso
  try {
    var casilla = regCasilla_()
    var hoy = regFechaTxt_(new Date())
    var cursor = regProp_('REG_CURSOR', '')
    if (!cursor) { var ayer = new Date(Date.now() - 86400000); cursor = regFechaTxt_(ayer) }
    var reglas = regSupa_('get', 'mails_reglas?activa=eq.true&select=id,orden,activa,remitente_patron,asunto_patron,tipo,accion')
    var total = 0
    while (cursor <= hoy && Date.now() - t0 < REG_TOPE_MS) {
      var d = new Date(cursor + 'T12:00:00Z')
      var sig = new Date(d.getTime() + 86400000)
      var q = 'after:' + cursor.replace(/-/g, '/') + ' before:' + regFechaTxt_(sig).replace(/-/g, '/')
      var filas = [], vistos = {}, cortado = false
      for (var start = 0; ; start += 100) {
        var hilos = GmailApp.search(q, start, 100)
        hilos.forEach(function (h) {
          h.getMessages().forEach(function (m) {
            if (vistos[m.getId()]) return
            vistos[m.getId()] = true
            filas.push(filaDeMensaje_(m, h, casilla, reglas))
          })
        })
        if (hilos.length < 100) break
        if (Date.now() - t0 > REG_TOPE_MS) { cortado = true; break }
      }
      regGuardar_(filas)
      total += filas.length
      if (cortado) break  // el día quedó a medias: la próxima corrida lo retoma (lo ya guardado se ignora)
      // Se guarda el día siguiente, pero nunca más allá de AYER: ayer y hoy se vuelven a mirar en cada corrida
      // (llegan mails nuevos y Gmail corta los días en otra zona horaria). Lo repetido se ignora al guardar.
      var siguiente = regFechaTxt_(sig)
      var ayerTxt = regFechaTxt_(new Date(Date.now() - 86400000))
      PropertiesService.getScriptProperties().setProperty('REG_CURSOR', siguiente < ayerTxt ? siguiente : ayerTxt)
      cursor = siguiente
    }
    Logger.log('Registrados (o ya estaban): ' + total + ' mensajes. Cursor: ' + regProp_('REG_CURSOR', ''))
  } finally {
    lock.releaseLock()
  }
}

/** Trigger diario: el reporte de las últimas 24 h, a la propia casilla. */
function enviarReporteDiario() {
  var casilla = regCasilla_()
  var hasta = new Date(), desde = new Date(hasta.getTime() - 86400000)
  var filas = regSupa_('get', 'mails_registro?casilla=eq.' + encodeURIComponent(casilla) +
    '&fecha=gte.' + encodeURIComponent(desde.toISOString()) + '&fecha=lt.' + encodeURIComponent(hasta.toISOString()) +
    '&select=mensaje_id,sentido,fecha,remitente,remitente_nombre,destinatarios,asunto,adjuntos,tipo,tipo_manual,accion,procesado_por&order=fecha.asc')
  // Los pendientes, de cualquier fecha: quedan en el reporte hasta que se dan por terminados (A-FEAT-1437)
  var pendientes = regSupa_('get', 'mails_registro?casilla=eq.' + encodeURIComponent(casilla) + '&seguimiento=eq.pendiente' +
    '&select=mensaje_id,fecha,remitente,remitente_nombre,asunto,seguimiento_fecha,seguimiento_nota&order=fecha.asc')
  // Los graves sin terminar, de cualquier fecha (A-FEAT-1438): se leen los recibidos no terminados y se agrupan acá
  var abiertos = []
  for (var i = 0; ; i += 1000) {
    var tramo = regSupa_('get', 'mails_registro?casilla=eq.' + encodeURIComponent(casilla) + '&sentido=eq.recibido' +
      '&or=(seguimiento.is.null,seguimiento.eq.pendiente)&select=mensaje_id,sentido,fecha,remitente,remitente_nombre,asunto,extracto,tipo,tipo_manual,accion,seguimiento' +
      '&order=fecha.desc&offset=' + i + '&limit=1000') || []
    abiertos = abiertos.concat(tramo)
    if (tramo.length < 1000) break
  }
  var fmt = function (d) { return Utilities.formatDate(d, 'America/Argentina/Buenos_Aires', 'dd/MM HH:mm') }
  var r = armarReporte_(filas || [], casilla, fmt(desde), fmt(hasta), pendientes || [], regFechaTxt_(hasta), agruparGraves_(abiertos))
  GmailApp.sendEmail(casilla, r.asunto, 'Abrí este mail en HTML para ver el reporte con links.', { htmlBody: r.html })
  Logger.log('Reporte enviado: ' + r.asunto + (r.cierra ? '' : ' (⚠️ el control no cierra)'))
}

/** Una vez, a mano: crea los dos triggers (registro cada 15 min, reporte a las 7). No duplica si ya existen. */
function instalarTriggersRegistro() {
  var existentes = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction() })
  if (existentes.indexOf('registrarMailsNuevos') < 0) ScriptApp.newTrigger('registrarMailsNuevos').timeBased().everyMinutes(15).create()
  if (existentes.indexOf('enviarReporteDiario') < 0) ScriptApp.newTrigger('enviarReporteDiario').timeBased().atHour(7).everyDays(1).inTimezone('America/Argentina/Buenos_Aires').create()
  Logger.log('Triggers: ' + ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction() }).join(', '))
}
