/**
 * ⬇️ Cuánto se espera antes de liberar el archivo de una descarga (A-BUG-1421, JMS 29/10).
 *
 * 🧨 El caso: «Bajar Excel completo» daba «Se ha producido un problema» en Chrome. El archivo se armaba bien, pero
 * la app lo liberaba (`URL.revokeObjectURL`) en el mismo instante del clic. Con Chrome configurado para PREGUNTAR
 * dónde guardar, el usuario tarda en elegir carpeta y nombre — y para entonces el archivo ya no existe.
 * Con 2 minutos alcanza para el diálogo de «Guardar como» y no deja memoria colgada por mucho tiempo.
 *
 * ⚠️ cambió el mismo 29/10: el caso de JMS resultó ser OTRO — la ruta de Windows pasaba los 260 caracteres (nombre largo
 * en una carpeta profunda + «.crdownload»). Esta espera queda igual: no hace daño y cubre navegadores que leen tarde.
 *
 * Todas las descargas de la app usan esta espera; una descarga nueva NO libera el archivo enseguida.
 */
export const ESPERA_ANTES_DE_LIBERAR_MS = 120_000

/** Descarga un Blob con ese nombre y lo libera recién después de la espera. */
export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, ESPERA_ANTES_DE_LIBERAR_MS)
}
