/**
 * Normaliza texto para búsquedas: pasa a minúsculas y quita tildes/diacríticos.
 * Así "federación" y "federacion" matchean igual.
 *
 * Uso típico en un filtro:
 *   const q = normalizarBusqueda(input)
 *   campos.some(c => normalizarBusqueda(c).includes(q))
 */
// Rango de marcas diacríticas combinantes U+0300–U+036F (se construye con strings ASCII para evitar caracteres literales).
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')

export function normalizarBusqueda(texto: string | null | undefined): string {
  return (texto ?? '')
    .toString()
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
}

/**
 * ¿La búsqueda aparece en estos textos, PALABRA POR PALABRA? (A-FEAT-1324)
 *
 * Cada palabra de la búsqueda tiene que estar en alguno de los textos, en cualquier orden y aunque
 * haya otras palabras en el medio. Así «red vial rojas» encuentra «Red Vial Cuota Rojas», que con
 * la búsqueda por frase exacta no aparecía (nota del usuario 2026-10-23).
 *
 * Los puntos de una palabra se prueban también sin puntos, para que «1.234,56» encuentre un monto
 * mostrado como «1234,56» (es lo que hacía el buscador del Cash Flow con la frase entera).
 */
export function coincidePorPalabras(textos: Array<string | null | undefined>, busqueda: string): boolean {
  const palabras = normalizarBusqueda(busqueda).split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return true
  const campos = textos.map(t => normalizarBusqueda(t)).filter(Boolean)
  return palabras.every(p => {
    const sinPuntos = p.replace(/\./g, '')
    return campos.some(c => c.includes(p) || (sinPuntos !== '' && c.includes(sinPuntos)))
  })
}
