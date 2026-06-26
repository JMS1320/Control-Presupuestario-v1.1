/**
 * GAS — Reporte de etiquetas de Gmail (SOLO LECTURA, no mueve ni borra nada)
 *
 * Objetivo: primer vistazo de qué remitentes caen sistemáticamente en qué etiqueta
 * (carpeta), para luego replicar ese ruteo manual con filtros automáticos.
 *
 * Uso:
 *   1. Pegar este archivo en el proyecto GAS (o `clasp push`).
 *   2. En el editor: seleccionar la función `generarReporteEtiquetas` → Run.
 *   3. Autorizar permisos (Gmail solo lectura + Drive crear archivo).
 *   4. Al terminar, en el Log (Ver → Registros) aparece la URL del CSV en tu Drive.
 *   5. Descargar ese CSV y dejarlo en `exports_app/` del repo.
 *
 * Ajustes: MAX_HILOS (si tarda/timeout, bajarlo a 50).
 */

const MAX_HILOS = 100  // hilos más recientes por etiqueta a muestrear

function generarReporteEtiquetas() {
  const labels = GmailApp.getUserLabels()  // solo etiquetas creadas por el usuario (no INBOX/SPAM)
  const filas = [['etiqueta', 'remitente_email', 'remitente_nombre', 'dominio', 'cantidad', 'ultimo_mail']]
  const tz = Session.getScriptTimeZone()
  let totalHilos = 0

  labels.forEach(function (label) {
    const threads = label.getThreads(0, MAX_HILOS)
    const agg = {}  // email -> { nombre, count, ultimo:Date }

    threads.forEach(function (t) {
      // Tomamos el PRIMER mensaje del hilo = quien lo originó (el que solemos archivar)
      const m = t.getMessages()[0]
      if (!m) return
      const from = m.getFrom() || ''                          // "Nombre <email@dom>" o "email@dom"
      const mEmail = from.match(/<([^>]+)>/)
      const email = (mEmail ? mEmail[1] : from).toLowerCase().trim()
      const nombre = from.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || email
      const fecha = m.getDate()

      if (!agg[email]) agg[email] = { nombre: nombre, count: 0, ultimo: fecha }
      agg[email].count++
      if (fecha > agg[email].ultimo) agg[email].ultimo = fecha
      totalHilos++
    })

    Object.keys(agg).forEach(function (email) {
      const a = agg[email]
      const dom = (email.split('@')[1] || '')
      filas.push([
        label.getName(), email, a.nombre, dom, a.count,
        Utilities.formatDate(a.ultimo, tz, 'yyyy-MM-dd'),
      ])
    })
  })

  // Ordenar por etiqueta y luego por cantidad desc (los más sistemáticos arriba)
  const header = filas.shift()
  filas.sort(function (x, y) {
    if (x[0] !== y[0]) return x[0] < y[0] ? -1 : 1
    return y[4] - x[4]
  })
  filas.unshift(header)

  // CSV
  const csv = filas.map(function (r) {
    return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"' }).join(',')
  }).join('\n')

  const nombreArchivo = 'reporte_etiquetas_gmail_' +
    Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd_HHmm') + '.csv'
  const file = DriveApp.createFile(nombreArchivo, '﻿' + csv, 'text/csv')  // BOM para tildes en Excel

  Logger.log('✅ Reporte listo: ' + labels.length + ' etiquetas, ' + totalHilos + ' hilos muestreados.')
  Logger.log('📄 CSV en tu Drive: ' + file.getUrl())
  return file.getUrl()
}
