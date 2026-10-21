/**
 * INVENTARIO DE LOS REENVÍOS (v0.19.0, A-FEAT-1287 — acordado con el usuario 2026-10-20)
 *
 * Antes, cada factura leía TODOS los reenvíos de Jose y Andrés desde su emisión hasta hoy: el mismo
 * PDF se leía una vez por factura y la búsqueda no entraba en el minuto (Sola NC 9-63, dos veces).
 * Ahora la app recorre los reenvíos UNA vez, por tramos de días, y guarda lo que dice cada adjunto en
 * su base (arca_pdf_inventario). Las facturas se cruzan contra ese inventario sin volver a leer nada.
 *
 * Cuatro acciones, todas chicas para entrar en el tiempo de una llamada:
 *   inventario_listar  → qué mails con adjunto hay en un tramo de días (sin leer los PDF: es barato)
 *   inventario_leer    → lee (OCR) los adjuntos pedidos, con tope de tiempo; lo que no entra vuelve como pendiente
 *   evaluar            → aplica la regla de los 5 datos (evaluarCoincidencia) a textos YA leídos: no lee nada
 *   guardar_adjunto    → guarda UN adjunto de un mail en la carpeta del mes (o en _Revisar) con el nombre estándar
 *
 * 🔒 Igual que el resto del script: nada se borra ni se reemplaza. guardar_adjunto CREA un archivo
 *    (archivarEnDrive); la única eliminación sigue siendo el Doc temporal del OCR.
 */

var INV_EXT = /\.(pdf|jpe?g|png|gif|webp|heic|tiff?)$/i

// 'YYYY-MM-DD' → Date (mediodía, para que el huso no la corra de día)
function invFecha(iso) {
  var p = String(iso).slice(0, 10).split('-')
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0)
}

function invSumarDias(d, n) {
  var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x
}

/**
 * Lista los mails de UN reenviador en un tramo de días, con sus adjuntos legibles (PDF o imagen).
 * body: { recolector: {email, asunto}, desde: 'YYYY-MM-DD', hasta: 'YYYY-MM-DD' (inclusive), presupuesto_ms? }
 * Se incluye un día de margen a cada lado: un mail repetido entre dos tramos no hace daño (la app lo
 * reconoce por su id y no lo vuelve a leer); uno perdido en el borde, sí.
 */
function inventarioListar(body) {
  var t0 = Date.now()
  var presupuesto = Math.min(Number(body.presupuesto_ms) || 35000, 45000)
  var rec = body.recolector || {}
  if (!rec.asunto || !body.desde || !body.hasta) {
    return responseJson({ status: 'error', observaciones: 'Faltan recolector (asunto), desde o hasta' }, 400)
  }
  var d0 = invSumarDias(invFecha(body.desde), -1)
  var d1 = invSumarDias(invFecha(body.hasta), 2)   // before: es exclusivo → +1, y +1 de margen
  // Dos clases de fuente: un REENVIADOR (Jose «Documento de Jose», Andrés «FC») = remitente + su asunto;
  // o una lista de PALABRAS en el asunto, de cualquier remitente (usuario 2026-10-20: «todos los mails
  // con adjuntos que tengan en el asunto factura o FC o fac»). Las palabras van separadas por «|».
  var palabras = String(rec.asunto).split('|').map(function (w) { return normalizarTexto(w) }).filter(Boolean)
  var multi = palabras.length > 1
  var qAsunto = multi ? 'subject:(' + palabras.join(' OR ') + ')' : 'subject:("' + rec.asunto + '")'
  var q = (rec.email ? 'from:(' + rec.email + ') ' : '') + qAsunto + ' after:' + formatDateGmail(d0) + ' before:' + formatDateGmail(d1) + ' ' + FILTRO_ADJUNTOS
  var minNorm = multi ? null : normalizarTexto(rec.asunto)
  var coincide = function (subject) {
    if (!multi) return asuntoCoincide(subject, minNorm)
    for (var w = 0; w < palabras.length; w++) if (asuntoCoincide(subject, palabras[w])) return true
    return false
  }
  var mensajes = []
  var incompleto = false
  var vistos = {}
  for (var start = 0; start < 2000; start += 100) {
    var hilos = GmailApp.search(q, start, 100)
    for (var h = 0; h < hilos.length; h++) {
      var msgs = hilos[h].getMessages()
      for (var m = 0; m < msgs.length; m++) {
        var msg = msgs[m]
        var fecha = msg.getDate()
        if (fecha < d0 || fecha >= d1) continue          // mensajes viejos/nuevos del mismo hilo
        if (!coincide(msg.getSubject())) continue
        var id = msg.getId()
        if (vistos[id]) continue
        vistos[id] = true
        var adjuntos = []
        var atts = msg.getAttachments()
        for (var a = 0; a < atts.length; a++) {
          var nombre = atts[a].getName()
          if (!INV_EXT.test(nombre)) continue
          var hash = ''
          try { hash = atts[a].getHash() } catch (e) { hash = '' }
          adjuntos.push({ idx: a, nombre: nombre, tamano: atts[a].getSize(), hash: hash })
        }
        if (adjuntos.length > 0) {
          mensajes.push({ message_id: id, fecha: fecha.toISOString(), remitente: msg.getFrom(), asunto: msg.getSubject(), adjuntos: adjuntos })
        }
      }
      if (Date.now() - t0 > presupuesto) { incompleto = true; break }
    }
    if (incompleto || hilos.length < 100) break
  }
  return responseJson({ status: 'ok', query: q, mensajes: mensajes, incompleto: incompleto, tiempo_ms: Date.now() - t0 })
}

/**
 * Lee (OCR) los adjuntos pedidos. Para antes de pasarse del tiempo: lo que no entró vuelve en
 * `pendientes` y la app lo pide en la llamada siguiente.
 * body: { items: [{ message_id, idx }], presupuesto_ms? }
 */
function inventarioLeer(body) {
  var t0 = Date.now()
  var presupuesto = Math.min(Number(body.presupuesto_ms) || 35000, 45000)
  var items = Array.isArray(body.items) ? body.items : []
  var leidos = []
  var pendientes = []
  for (var i = 0; i < items.length; i++) {
    var it = items[i]
    // Un OCR tarda entre 6 y 10 s: no se empieza uno nuevo si no hay margen para terminarlo
    if (i > 0 && Date.now() - t0 > presupuesto - 10000) { pendientes.push(it); continue }
    var r = { message_id: it.message_id, idx: it.idx }
    try {
      var msg = GmailApp.getMessageById(it.message_id)
      var att = msg.getAttachments()[it.idx]
      if (!att) throw new Error('el mail ya no tiene ese adjunto')
      r.nombre = att.getName()
      r.tamano = att.getSize()
      try { r.hash = att.getHash() } catch (e) { r.hash = '' }
      r.fecha = msg.getDate().toISOString()
      r.remitente = msg.getFrom()
      r.asunto = msg.getSubject()
      var texto = extraerTextoPdf(att)
      r.texto = String(texto || '')
      r.chars = r.texto.length
    } catch (err) {
      r.error = String(err && err.message ? err.message : err)
    }
    leidos.push(r)
  }
  return responseJson({ status: 'ok', leidos: leidos, pendientes: pendientes, tiempo_ms: Date.now() - t0 })
}

/**
 * La regla de los 5 datos sobre textos YA leídos (no lee nada: es instantáneo). Vive acá —y no
 * copiada en la app— para que el mail, la carpeta y el inventario decidan con la MISMA regla.
 * body: { textos: [{ id, texto }], facturas: [{ factura_id, cuit, punto_venta, numero_desde, imp_total, tipo, fecha_emision }] }
 * Devuelve sólo los pares que no son 'no' (exacto o dudoso), con sus motivos.
 */
function evaluarTextos(body) {
  var textos = Array.isArray(body.textos) ? body.textos : []
  var facturas = Array.isArray(body.facturas) ? body.facturas : []
  var out = []
  for (var i = 0; i < textos.length; i++) {
    for (var j = 0; j < facturas.length; j++) {
      var ev = evaluarCoincidencia(textos[i].texto, facturas[j])
      if (ev.nivel === 'no') continue
      out.push({ id: textos[i].id, factura_id: facturas[j].factura_id, nivel: ev.nivel, motivos: ev.motivos, monto: ev.montoExtraido, base: ev.base, leido: ev.leido })
    }
  }
  return responseJson({ status: 'ok', evaluaciones: out })
}

/**
 * Guarda UN adjunto de un mail en Drive.
 *   revisar=false → carpeta del mes con el nombre estándar, y el mail se etiqueta y se marca leído
 *                   (lo mismo que hace el match exacto de la búsqueda por factura).
 *   revisar=true  → _Revisar con el nombre original, sin tocar el mail (el usuario todavía no eligió).
 * body: { message_id, idx, revisar, carpeta_drive_id, subcarpetas, + los datos de la factura para el nombre }
 */
function guardarAdjunto(body) {
  if (!body.message_id || body.idx === undefined || body.idx === null || !body.carpeta_drive_id) {
    return responseJson({ status: 'error', observaciones: 'Faltan message_id, idx o carpeta_drive_id' }, 400)
  }
  var msg = GmailApp.getMessageById(body.message_id)
  if (!msg) return responseJson({ status: 'error', observaciones: 'No se encontró el mail' }, 404)
  var att = msg.getAttachments()[body.idx]
  if (!att) return responseJson({ status: 'error', observaciones: 'El mail ya no tiene ese adjunto' }, 404)
  var revisar = body.revisar === true
  var url = archivarEnDrive({ attachment: att }, body, revisar)
  if (!revisar) {
    try { etiquetarYLeer(msg, 'Facturas Descargadas') } catch (e) { Logger.log('etiquetar no crítico: ' + e) }
  }
  return responseJson({ status: 'ok', drive_url: url, asunto: msg.getSubject(), remitente: msg.getFrom() })
}
