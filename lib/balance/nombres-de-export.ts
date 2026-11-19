/**
 * 📁 NOMBRES CORTOS PARA LOS ARCHIVOS QUE BAJA EL BALANCE — A-FEAT-1629, punto 29 (JMS 19/11/2026).
 *
 * JMS: *«me sale en todos los Excel y les tengo que recortar los nombres para abrirlos»* — Excel no abre un archivo cuya ruta
 * completa (carpeta + nombre) pase de 259 caracteres. Los nombres de antes llegaban a 104
 * («Papeles_balance_MSA_25-26_2026-11-19_REVISAR - H - Egresos con boleta, extracto y demás liquidaciones.xlsx»).
 *
 * Regla: **ningún archivo del balance pasa de `LARGO_MAXIMO_NOMBRE` caracteres**, extensión incluida. Forma única:
 *   «<Título> - <EMPRESA> <ejercicio> (<dd-mm>).xlsx»   →  «A Subdiarios - MSA 25-26 (19-11).xlsx»
 * El título va sin aclaraciones entre paréntesis y, si no entra, se recorta por palabra. Cuando el libro no pasa sus controles la
 * fecha lleva « REV» (antes «_REVISAR»). La app no puede saber en qué carpeta se guarda: si la carpeta es muy larga, el tope igual
 * se alcanza — por eso el nombre se mantiene corto.
 */

export const LARGO_MAXIMO_NOMBRE = 60

/** «2026-11-19» → «19-11». */
export const fechaCorta = (iso: string): string => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`

/** El título sin paréntesis ni caracteres que Windows no acepta en un nombre de archivo. */
export const tituloLimpio = (titulo: string): string =>
  titulo.replace(/\s*\([^)]*\)/g, "").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim()

export function nombreDeExport(titulo: string, empresa: string, etiqueta: string, fechaIso: string,
  o: { revisar?: boolean; ext?: "xlsx" | "zip" } = {}): string {
  const cola = ` - ${empresa} ${etiqueta.replace("/", "-")} (${fechaCorta(fechaIso)}${o.revisar ? " REV" : ""}).${o.ext ?? "xlsx"}`
  const lugar = Math.max(8, LARGO_MAXIMO_NOMBRE - cola.length)
  let t = tituloLimpio(titulo)
  if (t.length > lugar) {
    const corte = t.slice(0, lugar)
    const hastaPalabra = corte.lastIndexOf(" ")
    t = (hastaPalabra >= 8 ? corte.slice(0, hastaPalabra) : corte).replace(/[\s\-–·,]+$/, "")
  }
  return t + cola
}
