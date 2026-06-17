/**
 * Cliente browser para módulo Lotes Galicia.
 * Funciones de descarga + llamadas a los endpoints.
 */

import type {
  ItemSeleccionado, PreviewLoteInput, PreviewLoteOutput,
  GenerarLoteInput, GenerarLoteOutput,
} from './types'

export async function llamarPreview(input: PreviewLoteInput): Promise<PreviewLoteOutput> {
  const r = await fetch('/api/lotes/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return r.json()
}

export async function llamarGenerar(input: GenerarLoteInput): Promise<GenerarLoteOutput> {
  const r = await fetch('/api/lotes/generar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return r.json()
}

/**
 * Descarga un archivo base64 al disco del usuario.
 * Si el browser soporta showSaveFilePicker, ofrece elegir carpeta.
 * Sino, fallback a download anchor (va a Descargas).
 */
export async function descargarArchivoBase64(opts: {
  base64: string
  nombre: string
}) {
  // Convertir base64 → blob
  const bin = atob(opts.base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  // Intentar showSaveFilePicker (File System Access API)
  const w = window as any
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: opts.nombre,
        types: [{ description: 'Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (err: any) {
      // Si el usuario cancela el dialog, abortar silenciosamente
      if (err?.name === 'AbortError') return
      // Otro error → fallback a anchor
    }
  }

  // Fallback: anchor download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = opts.nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Helper conveniente: descarga todos los archivos de un GenerarLoteOutput en secuencia */
export async function descargarArchivosLote(out: GenerarLoteOutput) {
  for (const a of out.archivos_pagos) {
    await descargarArchivoBase64({ base64: a.base64, nombre: a.nombre })
  }
  for (const a of out.archivos_sueldos) {
    await descargarArchivoBase64({ base64: a.base64, nombre: a.nombre })
  }
}
