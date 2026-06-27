/**
 * GAS Web App — Buscador de PDFs de facturas en Gmail
 *
 * Endpoint POST que recibe JSON con datos de UNA factura a buscar.
 * Busca en Gmail, valida CUIT + número (+ monto como salvaguarda),
 * archiva el PDF en Drive con nombre estandarizado y devuelve resultado.
 *
 * Deploy:
 *   clasp push
 *   En el editor GAS: Deploy → New deployment → Type: Web App
 *     Execute as: Me
 *     Who has access: Anyone (Anyone with the link)
 *   Copiar la URL del Web App al backend Next.js (env GAS_WEBAPP_URL).
 *
 * Seguridad:
 *   - Cada POST debe traer header Authorization: Bearer <token>
 *   - El token está en script properties (Project Settings → Script Properties)
 *     Key: GAS_AUTH_TOKEN
 *     Value: <token aleatorio largo>
 *   - El mismo token está en env del backend (GAS_AUTH_TOKEN)
 */

const VERSION = '0.8.0'  // 0.8.0 = acción 'confirmar' (mueve de _Revisar + renombra) | 0.7.0 = 'auditar' | 0.6.0 = sin confirmar conserva nombre/sin link | 0.5.0 = tipo/ext real | 0.4.0 = asunto por-recolector | 0.3.0 = OCR + soft-match | 0.2.0 = catch-all + resumen

/**
 * Ping de versión (GET): abrir la URL del Web App en el navegador para verificar qué versión está desplegada.
 * No requiere token (no expone datos — solo versión y capacidades).
 */
function doGet(e) {
  return responseJson({
    status: 'ok',
    version: VERSION,
    capacidades: ['buscar', 'catch-all-reenvios', 'etiquetar-leido', 'auto-archivado', 'mail-resumen', 'ocr-imagenes', 'soft-match', 'auditar', 'confirmar'],
    mensaje: 'GAS Buscador PDF facturas — vivo. Última = version 0.8.0 (acción confirmar).'
  })
}

/**
 * Punto de entrada HTTP POST
 */
function doPost(e) {
  const startTime = Date.now()

  try {
    // ── 1. Validar token ──
    const headers = e?.parameter || {}
    const bodyToken = JSON.parse(e.postData?.contents || '{}')?._token
    // El backend manda el token en el body porque GAS no parsea headers HTTP arbitrarios fácil
    const expectedToken = PropertiesService.getScriptProperties().getProperty('GAS_AUTH_TOKEN')

    if (!expectedToken) {
      return responseJson({ status: 'error', observaciones: 'GAS no tiene GAS_AUTH_TOKEN configurado' }, 500)
    }
    if (bodyToken !== expectedToken) {
      return responseJson({ status: 'error', observaciones: 'Token inválido' }, 401)
    }

    // ── 2. Parsear body ──
    const body = JSON.parse(e.postData.contents)

    // Acción 'resumen': manda el mail resumen del lote a sanmanuel y sale (no busca facturas).
    if (body.accion === 'resumen') {
      return enviarResumenMail(body)
    }

    // Acción 'auditar': releva la carpeta de un período contra las facturas esperadas y sale.
    if (body.accion === 'auditar') {
      return auditarPeriodo(body)
    }

    // Acción 'confirmar': mueve un PDF de _Revisar a la carpeta del mes + lo renombra al estándar.
    if (body.accion === 'confirmar') {
      return confirmarFactura(body)
    }

    const required = ['factura_id', 'cuit_emisor', 'punto_venta', 'numero_desde', 'tipo_comprobante_desc', 'fecha_emision', 'imp_total', 'denominacion_emisor', 'email_proveedor', 'patron_asunto', 'dias_busqueda', 'carpeta_drive_id']
    for (const k of required) {
      if (body[k] === undefined || body[k] === null) {
        return responseJson({ status: 'error', observaciones: `Campo requerido faltante: ${k}` }, 400)
      }
    }

    // Nota: NO se loguea el monto a propósito (defensa en profundidad — ver A-SEC-01).
    Logger.log(`[v${VERSION}] buscar: cuit=${body.cuit_emisor} pv=${body.punto_venta} nro=${body.numero_desde}`)

    // ── 3. Buscar en Gmail ──
    const resultadoBusqueda = buscarEnGmail(body)

    // ── 4. Procesar candidatos ──
    const verificados = verificarCandidatos(resultadoBusqueda.candidatos, body)

    // ── 5. Decidir resultado ──
    if (verificados.exactos.length === 1) {
      // Match único — archivar OK + etiquetar 'Facturas Descargadas' + marcar leído (NO mover)
      const cand = verificados.exactos[0]
      const driveUrl = archivarEnDrive(cand, body, false)
      etiquetarYLeer(cand.mensaje, 'Facturas Descargadas')
      return responseJson({
        status: 'ok',
        drive_url: driveUrl,
        confianza: 'alta',
        observaciones: cand._observaciones || 'Match exacto CUIT+nro+monto',
        monto_pdf: cand._montoExtraido || null,
        asunto: cand.asunto, remitente: cand.remitente, cuerpo: cuerpoMail(cand.mensaje),
        tiempo_ms: Date.now() - startTime
      })
    }

    if (verificados.exactos.length > 1) {
      // Múltiples matches — todos a "Revisar". NO se marca leído/etiqueta (necesita revisión).
      const urls = verificados.exactos.map(c => archivarEnDrive(c, body, true))
      const cand = verificados.exactos[0]
      return responseJson({
        status: 'revisar',
        drive_url: urls[0],
        confianza: 'media',
        observaciones: `Múltiples PDFs candidatos (${verificados.exactos.length}). Archivados en /Revisar.`,
        asunto: cand.asunto, remitente: cand.remitente, cuerpo: cuerpoMail(cand.mensaje),
        tiempo_ms: Date.now() - startTime
      })
    }

    if (verificados.dudosos.length > 0) {
      // Match parcial (CUIT+nro pero monto difiere) → a "Revisar". NO se marca leído/etiqueta.
      const cand = verificados.dudosos[0]
      const driveUrl = archivarEnDrive(cand, body, true)
      return responseJson({
        status: 'revisar',
        drive_url: driveUrl,
        confianza: 'baja',
        observaciones: cand._observaciones || 'Match CUIT+nro pero monto difiere',
        monto_pdf: cand._montoExtraido || null,
        asunto: cand.asunto, remitente: cand.remitente, cuerpo: cuerpoMail(cand.mensaje),
        tiempo_ms: Date.now() - startTime
      })
    }

    // Soft-match: ningún match validado, pero hay un adjunto en un mail cuyo ASUNTO nombra al
    // proveedor (ej. "Documento de Jose FC Luminatus") → muy probablemente ES la factura pero no
    // se pudo validar (foto ilegible / OCR pobre / número no detectado). Dejar 'revisar' con
    // advertencia + archivar a _Revisar para chequear a mano. Nunca se pierde.
    const sospechoso = encontrarSospechoso(verificados.descartados, body)
    if (sospechoso) {
      const driveUrl = archivarEnDrive(sospechoso, body, true)
      return responseJson({
        status: 'revisar',
        drive_url: driveUrl,
        confianza: 'baja',
        observaciones: '⚠️ Posible factura: el asunto nombra al proveedor pero no se pudo validar el adjunto (foto/PDF ilegible). Archivado en _Revisar — chequear a mano.',
        asunto: sospechoso.asunto, remitente: sospechoso.remitente, cuerpo: cuerpoMail(sospechoso.mensaje),
        tiempo_ms: Date.now() - startTime
      })
    }

    // No encontrado
    return responseJson({
      status: 'no_encontrada',
      observaciones: `No se encontró adjunto que coincida. Búsqueda Gmail: ${resultadoBusqueda.threadsCant} threads / ${resultadoBusqueda.candidatos.length} adjuntos analizados.`,
      tiempo_ms: Date.now() - startTime
    })

  } catch (err) {
    Logger.log('ERROR doPost: ' + err.toString() + '\n' + err.stack)
    return responseJson({
      status: 'error',
      observaciones: err.toString(),
      tiempo_ms: Date.now() - startTime
    }, 500)
  }
}

/**
 * Búsqueda Gmail con los operadores nativos.
 * Devuelve { threadsCant, candidatos: [{thread, mensaje, attachment}] }
 */
function buscarEnGmail(body) {
  const fechaEmision = new Date(body.fecha_emision)
  const fechaDesde = new Date(fechaEmision)
  fechaDesde.setDate(fechaDesde.getDate() - 2) // pequeño margen anterior por si llega antes
  const fechaHasta = new Date(fechaEmision)
  fechaHasta.setDate(fechaHasta.getDate() + (body.dias_busqueda || 7))
  // has:attachment (cualquier adjunto: PDF o imagen/foto de WhatsApp). El filtro por tipo se hace al juntar candidatos.
  const rango = `after:${formatDateGmail(fechaDesde)} before:${formatDateGmail(fechaHasta)} has:attachment`

  const candidatos = []
  let threadsCant = 0

  // 1) Catch-all reenvíos: cada recolector tiene su PROPIO asunto mínimo (Jose "Documento de Jose",
  //    Andrés "FC"). Se busca por separado. El asunto se exige también en código (palabra normalizada).
  if (Array.isArray(body.recolectores)) {
    for (var ri = 0; ri < body.recolectores.length; ri++) {
      const rec = body.recolectores[ri]
      if (!rec || !rec.email || !rec.asunto) continue
      const qR = `from:(${rec.email}) subject:("${rec.asunto}") ${rango}`
      Logger.log('Gmail query (recolector): ' + qR)
      const r = recolectarCandidatos(qR, rec.asunto)
      candidatos.push.apply(candidatos, r.candidatos); threadsCant += r.threadsCant
    }
  }

  // 2) Directo del proveedor (si tiene mail). Si patron_asunto vacío → no filtra asunto.
  if (body.email_proveedor && String(body.email_proveedor).trim()) {
    let qP = `from:(${body.email_proveedor}) ${rango}`
    if (body.patron_asunto && body.patron_asunto.trim().length > 0) qP += ` subject:(${body.patron_asunto})`
    Logger.log('Gmail query (proveedor): ' + qP)
    const p = recolectarCandidatos(qP, null)
    candidatos.push.apply(candidatos, p.candidatos); threadsCant += p.threadsCant
  }

  return { threadsCant: threadsCant, candidatos: candidatos }
}

// Corre una query Gmail y junta los PDF adjuntos. Si `asuntoMinimo` != null, exige que el asunto
// (normalizado: minúsculas + sin tildes) lo contenga — sin ese asunto, el mail NO se procesa.
function recolectarCandidatos(query, asuntoMinimo) {
  const threads = GmailApp.search(query, 0, 50)
  const candidatos = []
  const minNorm = asuntoMinimo ? normalizarTexto(asuntoMinimo) : null
  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      if (minNorm && !asuntoCoincide(msg.getSubject(), minNorm)) continue
      for (const att of msg.getAttachments()) {
        if (/\.(pdf|jpe?g|png|gif|webp|heic|tiff?)$/i.test(att.getName())) {  // PDF o imagen
          candidatos.push({
            thread: thread, mensaje: msg, attachment: att,
            fechaMail: msg.getDate(), asunto: msg.getSubject(), remitente: msg.getFrom()
          })
        }
      }
    }
  }
  return { threadsCant: threads.length, candidatos: candidatos }
}

// ¿El asunto (normalizado) contiene el patrón como PALABRA completa? Evita que "fc" matchee "fco".
function asuntoCoincide(subject, patronNorm) {
  const s = normalizarTexto(subject || '')
  const re = new RegExp('\\b' + patronNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b')
  return re.test(s)
}

// Normaliza para comparar asuntos sin distinguir mayúsculas/minúsculas ni tildes.
function normalizarTexto(s) {
  return String(s).toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n').trim()
}

/**
 * Verifica cada candidato extrayendo texto del PDF.
 * Devuelve { exactos: [...], dudosos: [...], descartados: [...] }
 *   - exactos: CUIT + nro + monto (con tolerancia $1)
 *   - dudosos: CUIT + nro pero monto fuera de tolerancia (avisar)
 *   - descartados: no matchean CUIT o nro
 */
function verificarCandidatos(candidatos, body) {
  const exactos = []
  const dudosos = []
  const descartados = []

  const cuitLimpio = String(body.cuit_emisor).replace(/\D/g, '')
  const numeroFc = String(body.numero_desde).padStart(8, '0')
  const ptoVenta = String(body.punto_venta).padStart(5, '0')

  for (const cand of candidatos) {
    try {
      const texto = extraerTextoPdf(cand.attachment)

      // Match CUIT (acepta con o sin guiones)
      const cuitEnPdf = texto.replace(/\D/g, '').indexOf(cuitLimpio) >= 0

      // Match número FC — buscar patrones flexibles
      // Posibles formatos en el PDF: "0010-00006115", "0010 00006115", "0010 - 00006115", "10-6115", etc.
      const patrones = [
        `${ptoVenta}-${numeroFc}`,
        `${ptoVenta} ${numeroFc}`,
        `${parseInt(body.punto_venta)}-${parseInt(body.numero_desde)}`,
        String(body.numero_desde) // a veces solo aparece el número largo
      ]
      const numeroEnPdf = patrones.some(p => texto.includes(p))

      if (!cuitEnPdf || !numeroEnPdf) {
        descartados.push(cand)
        continue
      }

      // Match monto — extraer y comparar
      const montoEsperado = parseFloat(body.imp_total)
      const montosEnPdf = extraerMontosPdf(texto)
      let montoMatch = false
      let montoExtraido = null

      for (const m of montosEnPdf) {
        if (Math.abs(m - montoEsperado) <= 1.0) {
          montoMatch = true
          montoExtraido = m
          break
        }
      }
      // Si no matcheó por tolerancia exacta, igual marcamos el más cercano para reporte
      if (!montoExtraido && montosEnPdf.length > 0) {
        montoExtraido = montosEnPdf.reduce((prev, m) =>
          Math.abs(m - montoEsperado) < Math.abs(prev - montoEsperado) ? m : prev
        , montosEnPdf[0])
      }

      cand._montoExtraido = montoExtraido

      if (montoMatch) {
        cand._observaciones = `Match exacto: CUIT+nro+monto (PDF=${montoExtraido}, factura=${montoEsperado})`
        exactos.push(cand)
      } else {
        const diff = montoExtraido !== null ? Math.abs(montoExtraido - montoEsperado).toFixed(2) : '?'
        cand._observaciones = `Match CUIT+nro pero monto difiere: PDF=${montoExtraido ?? '?'}, factura=${montoEsperado}, diferencia=$${diff}`
        dudosos.push(cand)
      }

    } catch (err) {
      Logger.log('Error verificando candidato: ' + err.toString())
      cand._observaciones = 'Error extrayendo texto: ' + err.toString()
      descartados.push(cand)
    }
  }

  Logger.log(`Verificados: ${exactos.length} exactos, ${dudosos.length} dudosos, ${descartados.length} descartados`)
  return { exactos, dudosos, descartados }
}

// Soft-match: entre los descartados, devuelve uno cuyo ASUNTO contenga (normalizado) una palabra
// significativa (>=4 letras) del nombre del proveedor. Evita falsos por "sa/srl/de". null si ninguno.
function encontrarSospechoso(descartados, body) {
  const palabras = normalizarTexto(body.denominacion_emisor || '').split(/\s+/).filter(function (w) { return w.length >= 4 })
  if (palabras.length === 0) return null
  for (var i = 0; i < descartados.length; i++) {
    const asunto = normalizarTexto(descartados[i].asunto || '')
    for (var j = 0; j < palabras.length; j++) {
      if (asunto.indexOf(palabras[j]) >= 0) return descartados[i]
    }
  }
  return null
}

/**
 * Extrae texto de un adjunto (PDF o IMAGEN/foto).
 * Truco GAS: subir el blob a Drive como Google Doc temporal → Google lo convierte/OCR-ea
 * (sirve para PDF y también imágenes), leer el texto, y borrar el temporal.
 */
function extraerTextoPdf(attachment) {
  return extraerTextoDeBlob(attachment.copyBlob())  // conserva el content-type real (PDF o imagen)
}

// Extrae texto de un blob (PDF o imagen) vía Google Doc temporal (OCR). Reusable por el audit
// (que lee archivos ya en Drive). Lanza error si falla.
function extraerTextoDeBlob(blob) {
  const tempName = '_temp_extract_' + new Date().getTime()
  try {
    // Crear como Google Doc → fuerza conversión / extracción de texto (OCR para imágenes)
    const resource = { name: tempName, mimeType: 'application/vnd.google-apps.document' }
    const file = Drive.Files.create(resource, blob)
    const doc = DocumentApp.openById(file.id)
    const text = doc.getBody().getText()

    // Cleanup — borra SOLO el temporal recién creado, por su propio ID. Nunca toca carpetas
    // ni archivos del usuario. Defensivo: si fallara, no rompe el flujo (no es crítico).
    try { if (file && file.id) Drive.Files.remove(file.id) } catch (e) { Logger.log('cleanup temp no crítico: ' + e) }
    return text
  } catch (err) {
    Logger.log('Error extraerTextoDeBlob: ' + err.toString())
    throw err
  }
}

/**
 * Extrae montos numéricos del texto PDF.
 * Heurística: busca patrones de formato monetario argentino.
 * Ejemplos válidos:
 *   $1.234.567,89    1.234.567,89    1234567.89    1,234,567.89
 */
function extraerMontosPdf(texto) {
  const montos = []
  // Patrón 1: formato argentino "1.234.567,89"
  const regexAR = /\$?\s*([\d]{1,3}(?:\.\d{3})*,\d{2})/g
  let m
  while ((m = regexAR.exec(texto)) !== null) {
    const num = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
    if (!isNaN(num) && num > 0) montos.push(num)
  }
  // Patrón 2: formato simple "1234567.89"
  const regexSimple = /\$?\s*(\d+\.\d{2})\b/g
  while ((m = regexSimple.exec(texto)) !== null) {
    const num = parseFloat(m[1])
    if (!isNaN(num) && num > 0) montos.push(num)
  }
  return montos
}

/**
 * Archiva el PDF en Drive con nombre estandarizado.
 * Formato: "YY-MM-DD - Proveedor - Tipo PV-NRO_CUIT.pdf"
 * Ejemplo: "26-06-15 - ALCORTA EDMUNDO ERNESTO - FA 0010-00006115_20103619115.pdf"
 *
 * Si esRevisar=true, archiva en subcarpeta "_Revisar".
 */
// 🔒 INVARIANTE DE SEGURIDAD (no romper en futuros cambios):
//   Este GAS NUNCA borra, vacía, reemplaza ni sobrescribe carpetas o archivos del usuario.
//   - createFolder/createFile en Drive NO reemplazan: ante mismo nombre, crean uno nuevo aparte.
//   - findOrCreateFolder reusa la carpeta existente; solo crea si falta.
//   - La única eliminación en todo el script es el Google Doc TEMPORAL de extracción de texto
//     (extraerTextoPdf), borrado por su propio ID. Jamás se borra una carpeta.
//   PROHIBIDO agregar: setTrashed, removeFile/removeFolder sobre carpetas, o cualquier "replace".
function archivarEnDrive(cand, body, esRevisar) {
  let carpetaDestino = DriveApp.getFolderById(body.carpeta_drive_id)

  // Navegar/crear la ruta de subcarpetas (campaña / mes / [ventas]) que manda la app.
  // Si la app no la manda (body.subcarpetas vacío) → guarda en la carpeta de la empresa (como antes).
  if (Array.isArray(body.subcarpetas)) {
    body.subcarpetas.forEach(function (nombre) {
      if (nombre && String(nombre).trim()) {
        carpetaDestino = findOrCreateFolder(carpetaDestino, String(nombre).trim())
      }
    })
  }

  if (esRevisar) {
    carpetaDestino = findOrCreateFolder(carpetaDestino, '_Revisar')
  }

  // Confirmado (no esRevisar) → renombra al estándar. SIN confirmar (_Revisar) → conserva el nombre
  // ORIGINAL: no se pisa el único dato seguro (cómo lo nombró quien lo mandó) cuando no hay certeza.
  let blob = cand.attachment.copyBlob()  // conserva nombre y content-type reales
  if (!esRevisar) {
    blob = blob.setName(construirNombreArchivo(body, extensionDe(cand.attachment)))
  }
  const file = carpetaDestino.createFile(blob)
  return file.getUrl()
}

// Busca una subcarpeta por nombre dentro de `parent`; si no existe la crea. Devuelve la carpeta.
function findOrCreateFolder(parent, name) {
  const it = parent.getFoldersByName(name)
  return it.hasNext() ? it.next() : parent.createFolder(name)
}

// Acción 'confirmar': el usuario confirma que el PDF en _Revisar ES esta factura.
// 🔒 Mueve y renombra un ARCHIVO puntual por su id (el id no cambia → el link sigue válido).
// NUNCA toca/borra/reemplaza carpetas; el destino se obtiene con find-or-create.
function confirmarFactura(body) {
  const fileId = extraerFileId(body.file_url || body.file_id)
  if (!fileId) return responseJson({ status: 'error', observaciones: 'Falta file_url/file_id del candidato' }, 400)

  let file
  try { file = DriveApp.getFileById(fileId) }
  catch (e) { return responseJson({ status: 'error', observaciones: 'No se encontró el archivo: ' + e }, 404) }

  // Carpeta destino = empresa/subcarpetas (SIN _Revisar) — find-or-create
  let destino = DriveApp.getFolderById(body.carpeta_drive_id)
  if (Array.isArray(body.subcarpetas)) {
    body.subcarpetas.forEach(function (n) {
      if (n && String(n).trim()) destino = findOrCreateFolder(destino, String(n).trim())
    })
  }

  // Renombrar al estándar (ya confirmada) + mover el archivo a la carpeta del mes
  try { file.setName(construirNombreArchivo(body, extensionDe(file))) } catch (e) { Logger.log('rename no crítico: ' + e) }
  file.moveTo(destino)

  return responseJson({ status: 'ok', drive_url: file.getUrl() })
}

// Extrae el id de Drive de una URL (o lo devuelve si ya es un id).
function extraerFileId(s) {
  if (!s) return null
  const m = String(s).match(/[-\w]{25,}/)
  return m ? m[0] : null
}

// Match exacto: aplica la etiqueta al hilo (la crea si no existe) y marca el mensaje como leído.
// NO mueve nada. Defensivo: si falla, no rompe el flujo (la descarga a Drive ya se hizo).
function etiquetarYLeer(mensaje, nombreEtiqueta) {
  try {
    let label = GmailApp.getUserLabelByName(nombreEtiqueta)
    if (!label) label = GmailApp.createLabel(nombreEtiqueta)
    mensaje.getThread().addLabel(label)
    mensaje.markRead()
  } catch (e) { Logger.log('etiquetarYLeer no crítico: ' + e) }
}

// Cuerpo del mail (texto plano, recortado a 1500) — para incluirlo en el mail resumen.
function cuerpoMail(mensaje) {
  try {
    const t = (mensaje.getPlainBody() || '').trim()
    return t.length > 1500 ? t.substring(0, 1500) + '…' : t
  } catch (e) { return '' }
}

// Acción 'resumen': arma y envía UN mail con el resultado del lote, agrupado por empresa
// (descargadas + a revisar, con asunto/remitente/cuerpo de cada uno). Lo dispara la app al cerrar el lote.
function enviarResumenMail(body) {
  const destinatario = body.destinatario || Session.getActiveUser().getEmail()
  const resultados = Array.isArray(body.resultados) ? body.resultados : []
  if (resultados.length === 0) {
    return responseJson({ status: 'ok', observaciones: 'Resumen sin items, no se envía.' })
  }

  const porEmpresa = {}
  resultados.forEach(function (r) {
    const emp = r.empresa || '—'
    if (!porEmpresa[emp]) porEmpresa[emp] = { descargadas: [], revisar: [] }
    ;(r.status === 'ok' ? porEmpresa[emp].descargadas : porEmpresa[emp].revisar).push(r)
  })

  let html = '<h2>Resumen búsqueda de facturas</h2>'
  Object.keys(porEmpresa).sort().forEach(function (emp) {
    const g = porEmpresa[emp]
    html += '<h3>' + esc(emp) + ' — ' + g.descargadas.length + ' descargada(s), ' + g.revisar.length + ' a revisar</h3>'
    ;[['descargadas', '✅ Descargadas'], ['revisar', '⚠️ A revisar']].forEach(function (par) {
      const lista = g[par[0]]
      if (lista.length === 0) return
      html += '<p><b>' + par[1] + ':</b></p><ul>'
      lista.forEach(function (r) {
        html += '<li>' + esc(r.factura || '') + ' — ' + esc(r.proveedor || '')
          + (r.drive_url ? ' (<a href="' + r.drive_url + '">PDF</a>)' : '')
          + (r.observaciones ? ' <i>' + esc(r.observaciones) + '</i>' : '')
          + '<br><small><b>Asunto:</b> ' + esc(r.asunto || '') + ' — <b>De:</b> ' + esc(r.remitente || '') + '</small>'
          + (r.cuerpo ? '<br><pre style="white-space:pre-wrap;background:#f6f6f6;padding:6px;font-size:12px;">' + esc(r.cuerpo) + '</pre>' : '')
          + '</li>'
      })
      html += '</ul>'
    })
  })

  GmailApp.sendEmail(destinatario, 'Resumen FC — ' + new Date().toLocaleDateString(), 'Ver versión HTML.', { htmlBody: html })
  return responseJson({ status: 'ok', observaciones: 'Resumen enviado a ' + destinatario + ' (' + resultados.length + ' items).' })
}

// Escapa HTML para el mail resumen.
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Acción 'auditar' (A-FEAT-AUDIT) ──────────────────────────────────────────────────────────
// 🔒 Releva la carpeta de un período contra las facturas esperadas. SOLO LECTURA sobre los archivos
// del usuario: NO borra, NO mueve, NO renombra. Lo único que crea: los temporales de OCR (borrados por
// su propio id) y un archivo de log _AUDIT (createFile nuevo). Nunca toca carpetas.
function auditarPeriodo(body) {
  let carpeta = DriveApp.getFolderById(body.carpeta_drive_id)
  const subs = Array.isArray(body.subcarpetas) ? body.subcarpetas : []
  for (var i = 0; i < subs.length; i++) {
    const n = String(subs[i] || '').trim()
    if (!n) continue
    const it = carpeta.getFoldersByName(n)
    if (!it.hasNext()) {
      return responseJson({
        status: 'ok', existe: false,
        observaciones: 'La carpeta del período no existe: ' + subs.join('/'),
        matched: [], huerfanos: [],
        sin_pdf: (body.facturas || []).map(aSinPdf)
      })
    }
    carpeta = it.next()
  }

  const facturas = Array.isArray(body.facturas) ? body.facturas : []
  const matched = []     // {factura_id, drive_url, archivo}
  const huerfanos = []   // {archivo, url}  (PDF sin factura)
  const usados = {}

  const files = carpeta.getFiles()
  while (files.hasNext()) {
    const file = files.next()
    const nombre = file.getName()
    if (/^_AUDIT_/i.test(nombre)) continue  // ignorar logs de audit previos
    let texto = ''
    try { texto = extraerTextoDeBlob(file.getBlob()) } catch (e) { texto = '' }
    const textoNum = texto.replace(/\D/g, '')
    let match = null
    for (var j = 0; j < facturas.length; j++) {
      const f = facturas[j]
      if (usados[f.factura_id]) continue
      if (facturaCoincide(texto, textoNum, f)) { match = f; break }
    }
    if (match) {
      usados[match.factura_id] = true
      matched.push({ factura_id: match.factura_id, drive_url: file.getUrl(), archivo: nombre })
    } else {
      huerfanos.push({ archivo: nombre, url: file.getUrl() })
    }
  }

  const sin_pdf = facturas.filter(function (f) { return !usados[f.factura_id] }).map(aSinPdf)

  escribirLogAudit(carpeta, body, matched, huerfanos, sin_pdf)
  enviarMailAudit(body, matched, huerfanos, sin_pdf)

  return responseJson({ status: 'ok', existe: true, matched: matched, huerfanos: huerfanos, sin_pdf: sin_pdf })
}

function aSinPdf(f) {
  return { factura_id: f.factura_id, denominacion: f.denominacion, numero: f.punto_venta + '-' + f.numero_desde, fc: f.fc }
}

// ¿El texto OCR de un archivo corresponde a esta factura? (CUIT + número presentes)
function facturaCoincide(texto, textoNum, f) {
  const cuit = String(f.cuit || '').replace(/\D/g, '')
  if (cuit && textoNum.indexOf(cuit) < 0) return false
  const pv = String(f.punto_venta).padStart(5, '0')
  const nro = String(f.numero_desde).padStart(8, '0')
  return texto.indexOf(pv + '-' + nro) >= 0
      || texto.indexOf(pv + ' ' + nro) >= 0
      || texto.indexOf(String(f.numero_desde)) >= 0
}

// Deja un log datado del audit EN la carpeta del período (createFile nuevo por corrida — nunca reemplaza).
function escribirLogAudit(carpeta, body, matched, huerfanos, sin_pdf) {
  try {
    const tz = Session.getScriptTimeZone()
    const sello = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm')
    let txt = '=== AUDIT ' + sello + ' — ' + (body.empresa || '') + ' ' + (body.periodo || '') + ' ===\n'
    txt += 'Con PDF (matched): ' + matched.length + '\n'
    matched.forEach(function (m) { txt += '  OK  ' + m.archivo + '\n' })
    txt += 'SIN PDF: ' + sin_pdf.length + '\n'
    sin_pdf.forEach(function (s) { txt += '  !!  ' + s.numero + ' ' + (s.denominacion || '') + ' (fc=' + (s.fc || '') + ')\n' })
    txt += 'Huerfanos (PDF sin factura): ' + huerfanos.length + '\n'
    huerfanos.forEach(function (h) { txt += '  ??  ' + h.archivo + '\n' })
    const nombreLog = '_AUDIT_' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd_HHmm') + '.txt'
    carpeta.createFile(nombreLog, txt, 'text/plain')
  } catch (e) { Logger.log('log audit no crítico: ' + e) }
}

// Manda el mail resumen del audit (al usuario activo del GAS / sanmanuel).
function enviarMailAudit(body, matched, huerfanos, sin_pdf) {
  try {
    const destinatario = body.destinatario || Session.getActiveUser().getEmail()
    let html = '<h2>Auditoría de registro — ' + esc(body.empresa || '') + ' ' + esc(body.periodo || '') + '</h2>'
    html += '<p>✅ Con PDF: <b>' + matched.length + '</b> · ⚠️ Sin PDF: <b>' + sin_pdf.length + '</b> · ❓ Huérfanos: <b>' + huerfanos.length + '</b></p>'
    if (sin_pdf.length) {
      html += '<h3>⚠️ Facturas sin PDF en la carpeta</h3><ul>'
      sin_pdf.forEach(function (s) { html += '<li>' + esc(s.numero) + ' — ' + esc(s.denominacion || '') + ' (fc=' + esc(s.fc || '') + ')</li>' })
      html += '</ul>'
    }
    if (huerfanos.length) {
      html += '<h3>❓ PDFs sin factura (huérfanos)</h3><ul>'
      huerfanos.forEach(function (h) { html += '<li><a href="' + h.url + '">' + esc(h.archivo) + '</a></li>' })
      html += '</ul>'
    }
    GmailApp.sendEmail(destinatario, 'Auditoría ' + (body.empresa || '') + ' ' + (body.periodo || ''), 'Ver versión HTML.', { htmlBody: html })
  } catch (e) { Logger.log('mail audit no crítico: ' + e) }
}

/**
 * Nombre estandarizado: "YY-MM-DD - Proveedor - Tipo PV-NRO_CUIT.<ext>"
 * ext = extensión real del adjunto (pdf, jpg, png…); default 'pdf'.
 */
function construirNombreArchivo(body, ext) {
  const f = new Date(body.fecha_emision)
  const yy = String(f.getFullYear()).slice(-2)
  const mm = String(f.getMonth() + 1).padStart(2, '0')
  const dd = String(f.getDate()).padStart(2, '0')

  const proveedor = sanitizar(body.denominacion_emisor).substring(0, 60)
  const tipo = abreviarTipo(body.tipo_comprobante_desc)
  const pv = String(body.punto_venta).padStart(5, '0')
  const nro = String(body.numero_desde).padStart(8, '0')
  const cuit = String(body.cuit_emisor).replace(/\D/g, '')

  return `${yy}-${mm}-${dd} - ${proveedor} - ${tipo} ${pv}-${nro}_${cuit}.${ext || 'pdf'}`
}

// Extensión real del adjunto (a partir de su nombre). Default 'pdf'.
function extensionDe(att) {
  const m = String(att.getName() || '').match(/\.([a-z0-9]+)$/i)
  return m ? m[1].toLowerCase() : 'pdf'
}

function abreviarTipo(desc) {
  if (!desc) return 'FC'
  const d = desc.toLowerCase()
  if (d.includes('nota de crédito') || d.includes('nota credito')) return 'NC'
  if (d.includes('nota de débito') || d.includes('nota debito')) return 'ND'
  if (d.includes('factura a')) return 'FA'
  if (d.includes('factura b')) return 'FB'
  if (d.includes('factura c')) return 'FC'
  if (d.includes('factura e')) return 'FE'
  if (d.includes('factura m')) return 'FM'
  return 'FC' // default
}

function sanitizar(str) {
  // Limpia caracteres inválidos en nombre de archivo
  return String(str || '')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatDateGmail(d) {
  // Gmail acepta YYYY/MM/DD
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function responseJson(obj, status) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

/**
 * Función de prueba para correr desde el editor GAS antes de hacer deploy.
 */
function testManual() {
  const body = {
    factura_id: 'test-uuid-1234',
    cuit_emisor: '20103619115',
    punto_venta: '10',
    numero_desde: '6115',
    tipo_comprobante_desc: 'Factura A',
    fecha_emision: '2026-05-16',
    imp_total: 1068365.63,
    denominacion_emisor: 'ALCORTA EDMUNDO ERNESTO',
    email_proveedor: 'facturacion@example.com',
    patron_asunto: 'Factura',
    dias_busqueda: 7,
    carpeta_drive_id: 'REEMPLAZAR_CON_FOLDER_ID_REAL'
  }
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({ ...body, _token: PropertiesService.getScriptProperties().getProperty('GAS_AUTH_TOKEN') })
    }
  }
  const resp = doPost(fakeEvent)
  Logger.log(resp.getContent())
}
