/**
 * 🗂️ CARPETAS DEL ARCHIVO DIGITAL — encontrar en el Drive la carpeta que el usuario escribe como la ve en su PC.
 * A-FEAT-1442 (JMS 31/10): «idealmente me dice guardar como… ej.: I:\Mi unidad\SAN MANUEL\IMPUESTOS\INMOBLILIARIOS -
 * RED VIAL - AUTOMOTOR\INMOBILIARIO, para la carpeta 2026 de inmobiliario: si existe la usa y si no existe la crea».
 *
 * - `resolver_carpeta` { ruta } → { ok, id, nombre, url, ruta_drive }. Recorre el Drive desde «Mi unidad» carpeta por
 *   carpeta. Si alguna no existe, FALLA diciendo cuál (nunca crea la ruta: una letra mal escrita crearía un árbol
 *   paralelo donde nadie va a buscar). La app guarda el ID: si después la carpeta se mueve, el id sigue valiendo.
 * - `carpetaDelAnio_(padre, anio)`: la única que se crea sola (find-or-create).
 *
 * ⚠️ Nada destructivo (§ 🛑 de CLAUDE.md): sólo busca y, para el año, crea si falta. Nunca borra ni reemplaza.
 */

/**
 * Pura: la ruta como la escribe el usuario → las carpetas a recorrer desde «Mi unidad».
 * 'I:\Mi unidad\SAN MANUEL\IMPUESTOS\' → ['SAN MANUEL', 'IMPUESTOS']. Acepta \ o /, comillas, y «My Drive».
 */
function partesDeRuta_(ruta) {
  var t = String(ruta || '').trim().replace(/^["']|["']$/g, '')
  var partes = t.split(/[\\/]+/).map(function (p) { return p.trim() }).filter(function (p) { return p })
  if (partes.length && /^[A-Za-z]:$/.test(partes[0])) partes.shift()           // la letra de la unidad (I:)
  if (partes.length && /^(mi unidad|my drive)$/i.test(partes[0])) partes.shift()
  return partes
}

/**
 * La carpeta por ruta. Lanza un error que dice QUÉ carpeta no encontró y dentro de cuál.
 * 🔑 Si la PRIMERA no está en «Mi unidad» de esta cuenta (p. ej. es una carpeta compartida desde la cuenta de JMS, que
 * en su PC aparece en su «Mi unidad»), se busca entre todas las carpetas a las que esta cuenta tiene acceso: así la ruta
 * de cualquiera de los que comparten el Drive sirve. Si hay varias con ese nombre, se prueba el camino completo en cada
 * una y se usa la única que lo tiene entero.
 */
function carpetaPorRuta_(ruta) {
  var partes = partesDeRuta_(ruta)
  if (!partes.length) throw new Error('La ruta está vacía. Escribila como la ves en tu PC, ej. I:\\Mi unidad\\SAN MANUEL\\IMPUESTOS')
  var raiz = DriveApp.getRootFolder()
  if (!raiz.getFoldersByName(partes[0]).hasNext()) {
    var candidatas = [], it0 = DriveApp.getFoldersByName(partes[0])
    while (it0.hasNext() && candidatas.length < 20) candidatas.push(it0.next())
    var enteras = []
    candidatas.forEach(function (c) { try { enteras.push(recorrerDesde_(c, partes.slice(1), [c.getName()])) } catch (e) { /* no tiene el camino */ } })
    if (enteras.length === 1) return enteras[0]
    if (enteras.length > 1) throw new Error('Hay ' + enteras.length + ' carpetas «' + partes[0] + '» con ese mismo camino: pegá el link de la carpeta en vez de la ruta.')
    if (!candidatas.length) throw new Error('No encontré la carpeta «' + partes[0] + '» ni en «Mi unidad» ni entre las compartidas con esta cuenta (' + Session.getEffectiveUser().getEmail() + ').')
  }
  return recorrerDesde_(raiz, partes, [])
}

/** Baja carpeta por carpeta desde `desde`. Error claro con la que falta. */
function recorrerDesde_(desde, partes, recorridoInicial) {
  var actual = desde, recorrido = recorridoInicial.slice()
  for (var i = 0; i < partes.length; i++) {
    var it = actual.getFoldersByName(partes[i])
    if (!it.hasNext()) {
      throw new Error('No encontré la carpeta «' + partes[i] + '» dentro de «' + (recorrido.length ? recorrido.join(' / ') : 'Mi unidad') +
        '». Revisá cómo está escrita (mayúsculas, espacios, guiones).')
    }
    actual = it.next()
    recorrido.push(actual.getName())
  }
  return { carpeta: actual, ruta_drive: (recorridoInicial.length ? '' : 'Mi unidad / ') + recorrido.join(' / ') }
}

/**
 * Pura: entre los nombres de las subcarpetas, cuál es la del año. Primero la que se llama exactamente así; si no, la
 * ÚNICA que tiene el año como palabra («Año 2026», «2026 - Inmobiliario»). Si hay varias parecidas, ninguna (no adivina).
 * null = no hay: recién ahí se crea. JMS 31/10: «que nunca pise una carpeta existente, tampoco las duplique si ya existen».
 */
function elegirCarpetaDelAnio_(nombres, anio) {
  var a = String(anio)
  if (nombres.indexOf(a) >= 0) return a
  var parecidas = nombres.filter(function (n) { return new RegExp('(^|[^0-9])' + a + '([^0-9]|$)').test(String(n)) })
  return parecidas.length === 1 ? parecidas[0] : null
}

/** La carpeta del año adentro de `padre`: si existe (o una con el año en el nombre) la usa; si no, la crea. Nunca borra. */
function carpetaDelAnio_(padre, anio) {
  var porNombre = {}, it = padre.getFolders()
  while (it.hasNext()) { var f = it.next(); if (!porNombre[f.getName()]) porNombre[f.getName()] = f }
  var elegida = elegirCarpetaDelAnio_(Object.keys(porNombre), anio)
  return elegida ? porNombre[elegida] : padre.createFolder(String(anio))
}

/**
 * Pura: el nombre con que se archiva un adjunto de un mail: «AAAA-MM-DD - nombre original». La fecha adelante ordena
 * la carpeta y evita que dos meses con el mismo nombre de archivo («expensas.pdf») se pisen.
 */
function nombreArchivoMail_(fechaIso, nombreOriginal) {
  var limpio = String(nombreOriginal || 'adjunto').replace(/[\\/:*?"<>|]+/g, '-').trim()
  return String(fechaIso || '').slice(0, 10) + ' - ' + limpio
}

/**
 * Acción `archivar_mail` { message_id, carpeta_id, anio } — A-FEAT-1442 etapa 2 (lotes desde Mails). Guarda los adjuntos
 * del mail (PDF e imágenes; no las imágenes de la firma) en la carpeta elegida → la del año. Si ya hay un archivo con
 * ese nombre, NO lo vuelve a guardar ni lo pisa: lo informa como «ya estaba» con su link. No toca el mail.
 */
function archivarMail(body) {
  try {
    var msg = GmailApp.getMessageById(String(body.message_id || ''))
    if (!msg) return responseJson({ ok: false, error: 'No se encontró el mail' }, 200)
    var base = DriveApp.getFolderById(idDeCarpeta_(body.carpeta_id) || String(body.carpeta_id || ''))
    var carpeta = Number(body.anio) > 2000 ? carpetaDelAnio_(base, Math.round(Number(body.anio))) : base
    var fecha = Utilities.formatDate(msg.getDate(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd')
    var guardados = [], yaEstaban = [], salteados = []
    msg.getAttachments({ includeInlineImages: false }).forEach(function (a) {
      var tipo = String(a.getContentType() || '')
      if (!/pdf|image\/(jpeg|png)/i.test(tipo) || a.getSize() < 8000 && /image/i.test(tipo)) { salteados.push(a.getName()); return }
      var nombre = nombreArchivoMail_(fecha, a.getName())
      var ex = carpeta.getFilesByName(nombre)
      if (ex.hasNext()) { var f0 = ex.next(); yaEstaban.push({ nombre: nombre, id: f0.getId(), url: f0.getUrl() }); return }
      var f = carpeta.createFile(a.copyBlob().setName(nombre))
      guardados.push({ nombre: nombre, id: f.getId(), url: f.getUrl() })
    })
    return responseJson({ ok: true, carpeta: { id: carpeta.getId(), nombre: carpeta.getName(), url: carpeta.getUrl() },
      guardados: guardados, ya_estaban: yaEstaban, salteados: salteados }, 200)
  } catch (e) {
    return responseJson({ ok: false, error: String(e && e.message || e) }, 200)
  }
}

/** Acción `resolver_carpeta`: para que la app guarde el id de la carpeta que escribió el usuario. */
function resolverCarpeta(body) {
  try {
    // Un link de Drive pegado también sirve (`…/folders/<id>`): se usa el id directo
    var porLink = /^https?:\/\//i.test(String(body.ruta || '').trim()) ? idDeCarpeta_(body.ruta) : ''
    if (porLink) return infoCarpeta({ id: porLink })
    var r = carpetaPorRuta_(body.ruta)
    return responseJson({ ok: true, id: r.carpeta.getId(), nombre: r.carpeta.getName(), url: r.carpeta.getUrl(), ruta_drive: r.ruta_drive }, 200)
  } catch (e) {
    return responseJson({ ok: false, error: String(e && e.message || e) }, 200)
  }
}

/** Acción `info_carpeta`: dónde está HOY una carpeta guardada por id (si el usuario la movió, la app lo muestra). */
function infoCarpeta(body) {
  try {
    var f = DriveApp.getFolderById(String(body.id || ''))
    var nombres = [f.getName()], p = f.getParents(), vueltas = 0
    while (p.hasNext() && vueltas++ < 20) {
      var padre = p.next()
      if (padre.getId() === DriveApp.getRootFolder().getId()) { nombres.unshift('Mi unidad'); break }
      nombres.unshift(padre.getName())
      p = padre.getParents()
    }
    return responseJson({ ok: true, id: f.getId(), nombre: f.getName(), url: f.getUrl(), ruta_drive: nombres.join(' / '), en_papelera: f.isTrashed() }, 200)
  } catch (e) {
    return responseJson({ ok: false, error: 'La carpeta guardada ya no existe o no es accesible: ' + String(e && e.message || e) }, 200)
  }
}
