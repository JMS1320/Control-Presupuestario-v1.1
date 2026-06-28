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

const VERSION = '0.9.8'  // 0.9.8 = adjunto del mail OFICIAL del proveedor que no valida (OCR pobre) va a _Revisar en vez de no_encontrada + motivo de descarte detallado en debug | 0.9.7 = Confirmar VER también etiqueta 'Facturas Descargadas' + marca leído el mail (vía gmail_message_id guardado en la búsqueda) | 0.9.6 = resolverDestinatario con cascada: body → Script Property RESUMEN_DESTINATARIO → getEffectiveUser (scope userinfo.email) → getActiveUser | 0.9.5 = FIX mail resumen: getEffectiveUser (getActiveUser daba "" con Access:Anyone → "no recipient") | 0.9.4 = mail resumen con sección DEBUG por factura (queries + threads + resultado) | 0.9.3 = prioriza por nombre + corta al 1er match | 0.9.2 = ventana reenvíos hasta hoy | 0.9.1 = mail siempre | 0.9.0 = audit tandas | 0.8.0 = confirmar | 0.7.0 = auditar | 0.6.0 = sin confirmar conserva nombre | 0.5.0 = tipo/ext | 0.4.0 = asunto por-recolector | 0.3.0 = OCR + soft-match | 0.2.0 = catch-all

/**
 * Ping de versión (GET): abrir la URL del Web App en el navegador para verificar qué versión está desplegada.
 * No requiere token (no expone datos — solo versión y capacidades).
 */
function doGet(e) {
  return responseJson({
    status: 'ok',
    version: VERSION,
    capacidades: ['buscar', 'catch-all-reenvios', 'etiquetar-leido', 'auto-archivado', 'mail-resumen', 'ocr-imagenes', 'soft-match', 'auditar', 'confirmar'],
    mensaje: 'GAS Buscador PDF facturas — vivo. Confirmar VER etiqueta + marca leído el mail.'
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
        gmail_message_id: cand.mensaje.getId(),
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
        gmail_message_id: cand.mensaje.getId(),
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
        gmail_message_id: sospechoso.mensaje.getId(),
        tiempo_ms: Date.now() - startTime
      })
    }

    // Vino del mail OFICIAL del proveedor (su dirección de facturación configurada) pero el OCR no
    // pudo validar el contenido (típico de facturas de servicios: PDF escaneado/ilegible). El
    // remitente es señal fuerte por sí solo → NO se pierde: a _Revisar para chequear/confirmar a mano.
    const directo = elegirDirectoProveedor(verificados.descartados)
    if (directo) {
      const driveUrl = archivarEnDrive(directo, body, true)
      return responseJson({
        status: 'revisar',
        drive_url: driveUrl,
        confianza: 'baja',
        observaciones: '⚠️ Vino del mail oficial del proveedor pero no se pudo validar el contenido (PDF/escaneo ilegible). Archivado en _Revisar — chequear a mano.',
        asunto: directo.asunto, remitente: directo.remitente, cuerpo: cuerpoMail(directo.mensaje),
        gmail_message_id: directo.mensaje.getId(),
        tiempo_ms: Date.now() - startTime
      })
    }

    // No encontrado
    return responseJson({
      status: 'no_encontrada',
      observaciones: `No se encontró adjunto que coincida. Búsqueda Gmail: ${resultadoBusqueda.threadsCant} threads / ${resultadoBusqueda.candidatos.length} adjuntos analizados. Queries: ${(resultadoBusqueda.queries || []).join('  ||  ')}`,
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

  // REENVÍOS: la fecha del mail NO es la de emisión — el usuario reenvía cuando quiere (días/semanas
  // después). Por eso el catch-all busca desde un poco antes de la emisión hasta HOY (mañana, exclusivo).
  const manana = new Date(); manana.setDate(manana.getDate() + 1)
  const rangoRecolector = `after:${formatDateGmail(fechaDesde)} before:${formatDateGmail(manana)} has:attachment`

  const candidatos = []
  const queries = []   // para debug en el mail resumen
  let threadsCant = 0

  // 1) Catch-all reenvíos: cada recolector tiene su PROPIO asunto mínimo (Jose "Documento de Jose",
  //    Andrés "FC"). Se busca por separado. El asunto se exige también en código (palabra normalizada).
  if (Array.isArray(body.recolectores)) {
    for (var ri = 0; ri < body.recolectores.length; ri++) {
      const rec = body.recolectores[ri]
      if (!rec || !rec.email || !rec.asunto) continue
      const qR = `from:(${rec.email}) subject:("${rec.asunto}") ${rangoRecolector}`
      queries.push(qR)
      Logger.log('Gmail query (recolector): ' + qR)
      const r = recolectarCandidatos(qR, rec.asunto)
      candidatos.push.apply(candidatos, r.candidatos); threadsCant += r.threadsCant
    }
  }

  // 2) Directo del proveedor (si tiene mail). Si patron_asunto vacío → no filtra asunto.
  if (body.email_proveedor && String(body.email_proveedor).trim()) {
    let qP = `from:(${body.email_proveedor}) ${rango}`
    if (body.patron_asunto && body.patron_asunto.trim().length > 0) qP += ` subject:(${body.patron_asunto})`
    queries.push(qP)
    Logger.log('Gmail query (proveedor): ' + qP)
    const p = recolectarCandidatos(qP, null)
    // Marca: vino del mail OFICIAL del proveedor. Señal fuerte por sí sola (≠ reenvío) → si el OCR
    // no logra validar (PDF de servicios ilegible), igual se trata como sospechoso (a _Revisar).
    p.candidatos.forEach(function (c) { c._directoProveedor = true })
    candidatos.push.apply(candidatos, p.candidatos); threadsCant += p.threadsCant
  }

  return { threadsCant: threadsCant, candidatos: candidatos, queries: queries }
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

  // Eficiencia: primero los candidatos cuyo ASUNTO o NOMBRE DE ARCHIVO nombra al proveedor (más
  // probable que sean la factura) → OCR-ea la correcta antes y corta al primer match exacto.
  candidatos.sort(function (a, b) { return (nombraProveedor(b, body) ? 1 : 0) - (nombraProveedor(a, body) ? 1 : 0) })
  Logger.log('verificarCandidatos: ' + candidatos.length + ' candidato(s) a analizar')

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
        const faltan = [!cuitEnPdf ? 'CUIT' : null, !numeroEnPdf ? 'número' : null].filter(Boolean).join(' + ')
        cand._observaciones = `Descartado: no se halló ${faltan} en el texto extraído (${texto.length} chars OCR).`
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
        Logger.log('Match exacto → corto (no analizo el resto)')
        return { exactos, dudosos, descartados }  // early-stop: ya tenemos la factura
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

// Entre los descartados, elige el que vino del mail OFICIAL del proveedor (_directoProveedor).
// Si hay varios adjuntos (ej. logo de la firma + la factura), prefiere PDF y el más grande
// (el logo suele ser una imagen chica) para no archivar el adjunto equivocado. null si no hay.
function elegirDirectoProveedor(descartados) {
  const dir = descartados.filter(function (c) { return c._directoProveedor })
  if (dir.length === 0) return null
  const pdfs = dir.filter(function (c) { return /\.pdf$/i.test(c.attachment.getName()) })
  const pool = pdfs.length > 0 ? pdfs : dir
  pool.sort(function (a, b) {
    const sa = a.attachment.getSize ? a.attachment.getSize() : 0
    const sb = b.attachment.getSize ? b.attachment.getSize() : 0
    return sb - sa
  })
  return pool[0]
}

// ¿El asunto o el nombre del archivo del candidato NOMBRA al proveedor? (palabra ≥4 letras).
// Se usa para priorizar a cuál OCR-ear primero (eficiencia + tu idea de "nombres clave").
function nombraProveedor(cand, body) {
  const palabras = normalizarTexto(body.denominacion_emisor || '').split(/\s+/).filter(function (w) { return w.length >= 4 })
  if (palabras.length === 0) return false
  const nombreArch = (cand.attachment && cand.attachment.getName) ? cand.attachment.getName() : ''
  const txt = normalizarTexto((cand.asunto || '') + ' ' + nombreArch)
  for (var i = 0; i < palabras.length; i++) if (txt.indexOf(palabras[i]) >= 0) return true
  return false
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

  // Al confirmar, replicar lo del match exacto sobre el MAIL: etiquetar 'Facturas Descargadas'
  // + marcar leído. Requiere el gmail_message_id que la búsqueda guardó en el log. Defensivo:
  // si no llega el id o el mail ya no existe, no rompe la confirmación (el archivo ya se movió).
  let mailEtiquetado = false
  if (body.gmail_message_id) {
    try {
      const msg = GmailApp.getMessageById(body.gmail_message_id)
      if (msg) { etiquetarYLeer(msg, 'Facturas Descargadas'); mailEtiquetado = true }
    } catch (e) { Logger.log('etiquetar al confirmar no crítico: ' + e) }
  }

  return responseJson({ status: 'ok', drive_url: file.getUrl(), mail_etiquetado: mailEtiquetado })
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

// Resuelve a QUIÉN se manda el mail, con cascada robusta de fallbacks:
//  1) body.destinatario (si la app lo manda)
//  2) Script Property RESUMEN_DESTINATARIO (recomendado: NO depende de scopes — cargar una vez)
//  3) Session.getEffectiveUser() (requiere scope userinfo.email; tira excepción si no está → try/catch)
//  4) Session.getActiveUser() (devuelve "" con Access:Anyone, pero no rompe)
function resolverDestinatario(body) {
  if (body && body.destinatario) return body.destinatario
  try {
    const prop = PropertiesService.getScriptProperties().getProperty('RESUMEN_DESTINATARIO')
    if (prop) return prop
  } catch (e) { /* sin properties, seguimos */ }
  try {
    const eff = Session.getEffectiveUser().getEmail()
    if (eff) return eff
  } catch (e) { /* falta scope userinfo.email */ }
  try {
    const act = Session.getActiveUser().getEmail()
    if (act) return act
  } catch (e) { /* anónimo */ }
  return ''
}

// Acción 'resumen': arma y envía UN mail con el resultado del lote, agrupado por empresa
// (descargadas + a revisar, con asunto/remitente/cuerpo de cada uno). Lo dispara la app al cerrar el lote.
function enviarResumenMail(body) {
  const destinatario = resolverDestinatario(body)
  if (!destinatario) {
    return responseJson({ status: 'error', observaciones: 'No se pudo resolver el destinatario. Cargá la Script Property RESUMEN_DESTINATARIO con tu email.' }, 500)
  }
  const resultados = Array.isArray(body.resultados) ? body.resultados : []
  const t = body.totales || null
  if (resultados.length === 0 && !t) {
    return responseJson({ status: 'ok', observaciones: 'Resumen sin items ni totales, no se envía.' })
  }

  const debug = Array.isArray(body.debug) ? body.debug : []
  if (resultados.length === 0 && !t && debug.length === 0) {
    return responseJson({ status: 'ok', observaciones: 'Resumen vacío, no se envía.' })
  }

  let html = '<h2>Resumen búsqueda de facturas</h2>'
  if (t) {
    html += '<p><b>Buscadas:</b> ' + (t.total || 0) + ' · ✅ ' + (t.encontradas || 0) + ' descargadas · ⚠️ '
      + (t.paraRevisar || 0) + ' a revisar · ❌ ' + (t.noEncontradas || 0) + ' no encontradas · '
      + (t.errores || 0) + ' errores</p>'
  }

  if (resultados.length === 0) {
    html += '<p>No se descargó ni quedó a revisar ninguna factura en esta corrida.</p>'
  } else {
    const porEmpresa = {}
    resultados.forEach(function (r) {
      const emp = r.empresa || '—'
      if (!porEmpresa[emp]) porEmpresa[emp] = { descargadas: [], revisar: [] }
      ;(r.status === 'ok' ? porEmpresa[emp].descargadas : porEmpresa[emp].revisar).push(r)
    })
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
  }

  // 🔧 Debug por factura (resultado + observación con queries/threads) — para diagnosticar.
  if (debug.length > 0) {
    html += '<hr><h3>🔧 Debug por factura (' + debug.length + ')</h3>'
    html += '<table style="font-size:11px;border-collapse:collapse;width:100%;">'
    html += '<tr><th align="left">Factura</th><th align="left">Resultado</th><th align="left">Detalle</th></tr>'
    debug.forEach(function (d) {
      html += '<tr>'
        + '<td style="padding:2px 6px;border-top:1px solid #eee;vertical-align:top;">' + esc(d.factura || '') + '</td>'
        + '<td style="padding:2px 6px;border-top:1px solid #eee;vertical-align:top;">' + esc(d.resultado || '') + '</td>'
        + '<td style="padding:2px 6px;border-top:1px solid #eee;font-family:monospace;word-break:break-all;">' + esc(d.obs || '') + '</td>'
        + '</tr>'
    })
    html += '</table>'
  }

  GmailApp.sendEmail(destinatario, 'Resumen FC — ' + new Date().toLocaleDateString(), 'Ver versión HTML.', { htmlBody: html })
  return responseJson({ status: 'ok', observaciones: 'Resumen enviado a ' + destinatario })
}

// Escapa HTML para el mail resumen.
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Acción 'auditar' (A-FEAT-AUDIT) ──────────────────────────────────────────────────────────
// 🔒 Releva la carpeta de un período contra las facturas esperadas. SOLO LECTURA sobre los archivos
// del usuario: NO borra, NO mueve, NO renombra. Lo único que crea: los temporales de OCR (borrados por
// su propio id) y un archivo de log _AUDIT (createFile nuevo). Nunca toca carpetas.
// Resumible por TANDAS: procesa hasta `max_files` archivos NO salteados (skip_file_ids = ya
// procesados/linkeados) y reporta cuántos quedan (`restantes`). El app loopea hasta completo=true,
// acumulando los file_id procesados. Con `finalizar:true` escribe el log _AUDIT + manda el mail.
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
        matched: [], huerfanos: [], procesados: 0, restantes: 0, completo: true
      })
    }
    carpeta = it.next()
  }

  // Cierre: el app manda el resumen acumulado → dejamos log datado + mail (una sola vez).
  if (body.finalizar) {
    const res = body.resumen || {}
    escribirLogAudit(carpeta, body, res.matched || [], res.huerfanos || [], res.sin_pdf || [])
    enviarMailAudit(body, res.matched || [], res.huerfanos || [], res.sin_pdf || [])
    return responseJson({ status: 'ok', finalizado: true })
  }

  const facturas = Array.isArray(body.facturas) ? body.facturas : []
  const skip = {}
  if (Array.isArray(body.skip_file_ids)) body.skip_file_ids.forEach(function (id) { skip[id] = true })
  const maxFiles = body.max_files || 10
  const matched = []     // {factura_id, drive_url, archivo, file_id}
  const huerfanos = []   // {archivo, url, file_id}
  let procesados = 0
  let restantes = 0

  const files = carpeta.getFiles()
  while (files.hasNext()) {
    const file = files.next()
    const nombre = file.getName()
    if (/^_AUDIT_/i.test(nombre)) continue            // ignorar logs de audit
    const fileId = file.getId()
    if (skip[fileId]) continue                         // ya procesado en una tanda previa
    if (procesados >= maxFiles) { restantes++; continue }  // queda para la próxima tanda
    procesados++
    let texto = ''
    try { texto = extraerTextoDeBlob(file.getBlob()) } catch (e) { texto = '' }
    const textoNum = texto.replace(/\D/g, '')
    let match = null
    for (var j = 0; j < facturas.length; j++) {
      if (facturaCoincide(texto, textoNum, facturas[j])) { match = facturas[j]; break }
    }
    if (match) {
      matched.push({ factura_id: match.factura_id, drive_url: file.getUrl(), archivo: nombre, file_id: fileId })
    } else {
      huerfanos.push({ archivo: nombre, url: file.getUrl(), file_id: fileId })
    }
  }

  return responseJson({
    status: 'ok', existe: true,
    matched: matched, huerfanos: huerfanos,
    procesados: procesados, restantes: restantes, completo: restantes === 0
  })
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
    const destinatario = resolverDestinatario(body)
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
