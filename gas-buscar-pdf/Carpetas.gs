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

/** La carpeta por ruta. Lanza un error que dice QUÉ carpeta no encontró y dentro de cuál. */
function carpetaPorRuta_(ruta) {
  var partes = partesDeRuta_(ruta)
  if (!partes.length) throw new Error('La ruta está vacía. Escribila como la ves en tu PC, ej. I:\\Mi unidad\\SAN MANUEL\\IMPUESTOS')
  var actual = DriveApp.getRootFolder(), recorrido = []
  for (var i = 0; i < partes.length; i++) {
    var it = actual.getFoldersByName(partes[i])
    if (!it.hasNext()) {
      throw new Error('No encontré la carpeta «' + partes[i] + '» dentro de «' + (recorrido.length ? recorrido.join(' / ') : 'Mi unidad') +
        '». Revisá cómo está escrita (mayúsculas, espacios, guiones).')
    }
    actual = it.next()
    recorrido.push(actual.getName())
  }
  return { carpeta: actual, ruta_drive: 'Mi unidad / ' + recorrido.join(' / ') }
}

/** La carpeta del año adentro de `padre`: si existe la usa, si no la crea. */
function carpetaDelAnio_(padre, anio) {
  var nombre = String(anio)
  var it = padre.getFoldersByName(nombre)
  return it.hasNext() ? it.next() : padre.createFolder(nombre)
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
