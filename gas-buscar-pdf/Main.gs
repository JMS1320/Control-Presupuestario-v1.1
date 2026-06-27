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

const VERSION = '0.1.0'

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
      // Match único — archivar OK
      const driveUrl = archivarEnDrive(verificados.exactos[0], body, false)
      const observaciones = verificados.exactos[0]._observaciones || 'Match exacto CUIT+nro+monto'
      return responseJson({
        status: 'ok',
        drive_url: driveUrl,
        confianza: 'alta',
        observaciones: observaciones,
        monto_pdf: verificados.exactos[0]._montoExtraido || null,
        tiempo_ms: Date.now() - startTime
      })
    }

    if (verificados.exactos.length > 1) {
      // Múltiples matches — todos a "Revisar"
      const urls = verificados.exactos.map(c => archivarEnDrive(c, body, true))
      return responseJson({
        status: 'revisar',
        drive_url: urls[0],
        confianza: 'media',
        observaciones: `Múltiples PDFs candidatos (${verificados.exactos.length}). Archivados en /Revisar.`,
        tiempo_ms: Date.now() - startTime
      })
    }

    if (verificados.dudosos.length > 0) {
      // Match parcial (CUIT+nro pero monto fuera de tolerancia)
      const driveUrl = archivarEnDrive(verificados.dudosos[0], body, true)
      return responseJson({
        status: 'revisar',
        drive_url: driveUrl,
        confianza: 'baja',
        observaciones: verificados.dudosos[0]._observaciones || 'Match CUIT+nro pero monto difiere',
        monto_pdf: verificados.dudosos[0]._montoExtraido || null,
        tiempo_ms: Date.now() - startTime
      })
    }

    // No encontrado
    return responseJson({
      status: 'no_encontrada',
      observaciones: `No se encontró PDF que coincida. Búsqueda Gmail: ${resultadoBusqueda.threadsCant} threads / ${resultadoBusqueda.candidatos.length} PDFs adjuntos analizados.`,
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

  const fechaDesdeStr = formatDateGmail(fechaDesde)
  const fechaHastaStr = formatDateGmail(fechaHasta)

  // Construir query
  // Notas:
  //   - `from:` admite múltiples emails separados por OR
  //   - Si patron_asunto está vacío, no filtramos por asunto (más recall, menos precision)
  let query = `from:(${body.email_proveedor}) `
              + `after:${fechaDesdeStr} `
              + `before:${fechaHastaStr} `
              + `has:attachment filename:pdf`
  if (body.patron_asunto && body.patron_asunto.trim().length > 0) {
    query += ` subject:(${body.patron_asunto})`
  }

  Logger.log('Gmail query: ' + query)

  const threads = GmailApp.search(query, 0, 50)
  const candidatos = []

  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      for (const att of msg.getAttachments()) {
        const name = att.getName().toLowerCase()
        if (name.endsWith('.pdf')) {
          candidatos.push({
            thread: thread,
            mensaje: msg,
            attachment: att,
            fechaMail: msg.getDate(),
            asunto: msg.getSubject(),
            remitente: msg.getFrom()
          })
        }
      }
    }
  }

  return { threadsCant: threads.length, candidatos: candidatos }
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

/**
 * Extrae texto de un PDF adjunto.
 * Truco GAS: subir el blob a Drive como Google Doc temporal (OCR + texto),
 * leer el texto, y borrar el archivo.
 */
function extraerTextoPdf(attachment) {
  const blob = attachment.copyBlob().setContentType('application/pdf')
  const tempName = '_temp_extract_' + new Date().getTime()

  try {
    // Crear como Google Doc → fuerza conversión / extracción de texto
    const resource = {
      name: tempName,
      mimeType: 'application/vnd.google-apps.document'
    }
    const file = Drive.Files.create(resource, blob)
    const doc = DocumentApp.openById(file.id)
    const text = doc.getBody().getText()

    // Cleanup — borra SOLO el temporal recién creado, por su propio ID. Nunca toca carpetas
    // ni archivos del usuario. Defensivo: si fallara, no rompe el flujo (no es crítico).
    try { if (file && file.id) Drive.Files.remove(file.id) } catch (e) { Logger.log('cleanup temp no crítico: ' + e) }
    return text
  } catch (err) {
    Logger.log('Error extraerTextoPdf: ' + err.toString())
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

  const nombre = construirNombreArchivo(body)
  const blob = cand.attachment.copyBlob().setName(nombre).setContentType('application/pdf')
  const file = carpetaDestino.createFile(blob)
  return file.getUrl()
}

// Busca una subcarpeta por nombre dentro de `parent`; si no existe la crea. Devuelve la carpeta.
function findOrCreateFolder(parent, name) {
  const it = parent.getFoldersByName(name)
  return it.hasNext() ? it.next() : parent.createFolder(name)
}

/**
 * Nombre estandarizado: "YY-MM-DD - Proveedor - Tipo PV-NRO_CUIT.pdf"
 */
function construirNombreArchivo(body) {
  const f = new Date(body.fecha_emision)
  const yy = String(f.getFullYear()).slice(-2)
  const mm = String(f.getMonth() + 1).padStart(2, '0')
  const dd = String(f.getDate()).padStart(2, '0')

  const proveedor = sanitizar(body.denominacion_emisor).substring(0, 60)
  const tipo = abreviarTipo(body.tipo_comprobante_desc)
  const pv = String(body.punto_venta).padStart(5, '0')
  const nro = String(body.numero_desde).padStart(8, '0')
  const cuit = String(body.cuit_emisor).replace(/\D/g, '')

  return `${yy}-${mm}-${dd} - ${proveedor} - ${tipo} ${pv}-${nro}_${cuit}.pdf`
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
