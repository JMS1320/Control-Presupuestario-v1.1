/**
 * 📎 RESPALDO DEL BALANCE — A-FEAT-1571 paso 2 (JMS 06/11: «yo debería poder "descargar" —que en realidad sería copiar esos
 * docs y dejarlos guardados—; además podría tenerlos para ver y auditar» · «enviar al contador todos los extractos: uno por
 * cada set por banco, con carpetas dividiendo tarjeta, cuentas…; sólo MSA; inversiones también, los FCI»).
 *
 * - `respaldo_copiar` { destino_ruta, items: [{ file_id, subcarpeta, nombre }] } → copia cada documento a
 *   «<destino>/<subcarpeta>/<nombre>». La subcarpeta (07 Bancos, 05 Provisión…) se crea si falta, ADENTRO del destino.
 *   Si ya hay un archivo con ese nombre, se saltea («ya estaba»): nunca pisa. Presupuesto de tiempo: lo que no entra queda
 *   en `pendientes` y se vuelve a apretar.
 * - `respaldo_zip` { origen_ruta, destino_ruta, subcarpeta, nombre } → un zip con TODO lo de la carpeta del banco y sus
 *   subcarpetas (Pesos/, USS/, Inversiones/…, con la misma división) en «<destino>/<subcarpeta>/<nombre>». Si ya existe uno
 *   con ese nombre, no se rehace (el nombre lleva la fecha: otro día, otro zip).
 *
 * ⚠️ Nada destructivo (§ 🛑 de CLAUDE.md): sólo COPIA y CREA. Nunca mueve, renombra, pisa ni borra. El destino tiene que
 * existir (la ruta del usuario no se crea: `carpetaPorRuta_` de Carpetas.gs falla diciendo cuál falta).
 */

/**
 * La subcarpeta `nombre` adentro de `padre`: si existe la usa; si no, la crea. Acepta un camino con «/»
 * («extractos 26-27/Pesos»): baja carpeta por carpeta, creando sólo la que falta.
 */
function subcarpetaRespaldo_(padre, nombre) {
  var partes = String(nombre).split('/').filter(function (p) { return p })
  var actual = padre
  for (var i = 0; i < partes.length; i++) {
    var it = actual.getFoldersByName(partes[i])
    actual = it.hasNext() ? it.next() : actual.createFolder(partes[i])
  }
  return actual
}

/**
 * 🔁 Paso 3 (A-FEAT-1571): `respaldo_listar` { origen_id } → todos los archivos de esa carpeta y sus subcarpetas
 * (id, nombre, camino). Es el espejo de Ulises: sólo se LEE.
 */
function respaldoListar(body) {
  var origen
  try { origen = DriveApp.getFolderById(body.origen_id) } catch (e) {
    return responseJson({ ok: false, error: 'No pude abrir la carpeta del espejo (' + body.origen_id + ') con la cuenta ' + Session.getEffectiveUser().getEmail() + ': compartila con esa cuenta.' })
  }
  var archivos = archivosConCamino_(origen, '', []).map(function (x) { return { id: x.archivo.getId(), nombre: x.archivo.getName(), camino: x.camino } })
  return responseJson({ ok: true, archivos: archivos })
}

function respaldoCopiar(body) {
  var t0 = Date.now(), LIMITE = 50000
  var destino
  try { destino = carpetaPorRuta_(body.destino_ruta).carpeta } catch (e) { return responseJson({ ok: false, error: e.message }) }
  var items = body.items || []
  var copiados = [], yaEstaban = [], errores = [], pendientes = []
  var subs = {}, nombres = {}
  for (var i = 0; i < items.length; i++) {
    var it = items[i]
    if (Date.now() - t0 > LIMITE) { pendientes = items.slice(i); break }
    try {
      var sub = subs[it.subcarpeta] || (subs[it.subcarpeta] = subcarpetaRespaldo_(destino, it.subcarpeta))
      if (!nombres[it.subcarpeta]) {
        nombres[it.subcarpeta] = {}
        var fs = sub.getFiles()
        while (fs.hasNext()) { var fx = fs.next(); nombres[it.subcarpeta][fx.getName()] = { id: fx.getId(), url: fx.getUrl() } }
      }
      var ya = nombres[it.subcarpeta][it.nombre]
      if (ya) { yaEstaban.push({ nombre: it.nombre, subcarpeta: it.subcarpeta, file_id: ya.id, url: ya.url, origen_id: it.file_id }); continue }
      var copia = DriveApp.getFileById(it.file_id).makeCopy(it.nombre, sub)
      nombres[it.subcarpeta][it.nombre] = { id: copia.getId(), url: copia.getUrl() }
      copiados.push({ nombre: it.nombre, subcarpeta: it.subcarpeta, url: copia.getUrl(), file_id: copia.getId(), origen_id: it.file_id })
    } catch (e) {
      errores.push({ nombre: it.nombre, error: String(e.message || e) })
    }
  }
  return responseJson({ ok: true, copiados: copiados, ya_estaban: yaEstaban, errores: errores, pendientes: pendientes, destino_url: destino.getUrl() })
}

/** Todos los archivos de `carpeta` y sus subcarpetas, con su camino relativo («Pesos/CC_pesos_25-07.pdf»). */
function archivosConCamino_(carpeta, prefijo, salida) {
  var fs = carpeta.getFiles()
  while (fs.hasNext()) {
    var f = fs.next()
    if (String(f.getMimeType()).indexOf('application/vnd.google-apps') === 0) continue   // documentos de Google: no van al zip
    salida.push({ archivo: f, camino: prefijo + f.getName() })
  }
  var ds = carpeta.getFolders()
  while (ds.hasNext()) { var d = ds.next(); archivosConCamino_(d, prefijo + d.getName() + '/', salida) }
  return salida
}

function respaldoZip(body) {
  var origen, destino
  try { origen = carpetaPorRuta_(body.origen_ruta).carpeta } catch (e) { return responseJson({ ok: false, error: e.message }) }
  try { destino = carpetaPorRuta_(body.destino_ruta).carpeta } catch (e) { return responseJson({ ok: false, error: e.message }) }
  var sub = subcarpetaRespaldo_(destino, body.subcarpeta || 'Extractos para el contador')
  var nombre = String(body.nombre || (origen.getName() + '.zip'))
  var ya = sub.getFilesByName(nombre)
  if (ya.hasNext()) { var z0 = ya.next(); return responseJson({ ok: true, ya_estaba: true, nombre: nombre, url: z0.getUrl() }) }
  var archivos = archivosConCamino_(origen, '', [])
  if (!archivos.length) return responseJson({ ok: false, error: 'La carpeta «' + origen.getName() + '» no tiene archivos.' })
  var total = 0, blobs = []
  for (var i = 0; i < archivos.length; i++) {
    total += archivos[i].archivo.getSize()
    if (total > 45 * 1024 * 1024) return responseJson({ ok: false, error: 'Pasa de 45 MB: el Drive no arma un zip tan grande de una vez. Avisale a Claude para partirlo.' })
    blobs.push(archivos[i].archivo.getBlob().setName(archivos[i].camino))
  }
  var zip = sub.createFile(Utilities.zip(blobs, nombre))
  return responseJson({ ok: true, nombre: nombre, url: zip.getUrl(), archivos: archivos.length, mb: Math.round(total / 1048576 * 10) / 10 })
}
