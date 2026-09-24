/**
 * 📷 La captura de pantalla que pega el usuario — **una sola implementación**.
 *
 * ## Por qué vive acá y no en cada modal
 * Esto estaba **copiado carácter por carácter** en `notas-para-claude.tsx` y en
 * `boton-revision.tsx`, con sus dos constantes al lado. Al pedir el usuario poder pegar capturas
 * también en el 💡 Anotar del recorrido, la salida fácil era una tercera copia — y ahí el ancho o
 * la calidad se tocan en un lado y las otras dos empiezan a guardar imágenes distintas de la misma
 * pantalla (§ CLAUDE.md ♻️ Centralizar, no duplicar).
 *
 * ## Por qué se PEGA y no se renderiza
 * `Win+Shift+S` → `Ctrl+V`. Es a propósito, y la decisión ya está tomada: las alertas que más
 * interrumpen son `alert()` nativos (hay 188 en la app) y **ninguna librería de captura de DOM
 * puede fotografiarlos**. El portapapeles agarra exactamente lo que el usuario vio.
 */

/** Ancho máximo de la captura guardada. Suficiente para leer un cartel, liviano para la fila. */
export const ANCHO_MAX = 1400
export const CALIDAD = 0.72

/** Redimensiona y comprime para que la fila no pese de más. Devuelve un data URL JPEG. */
export async function comprimir(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  const escala = Math.min(1, ANCHO_MAX / bitmap.width)
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", CALIDAD)
}

/**
 * La imagen de un evento de pegado, ya comprimida — o `null` si lo pegado no era una imagen.
 *
 * Hace el `preventDefault()` **sólo cuando hay imagen**: si no, pegar texto dentro del modal
 * dejaría de funcionar, que es lo que uno hace el 90 % de las veces.
 */
export async function imagenPegada(e: ClipboardEvent): Promise<string | null> {
  const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith("image/"))
  if (!item) return null
  const blob = item.getAsFile()
  if (!blob) return null
  e.preventDefault()
  return comprimir(blob)
}
