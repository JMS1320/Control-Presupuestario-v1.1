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
