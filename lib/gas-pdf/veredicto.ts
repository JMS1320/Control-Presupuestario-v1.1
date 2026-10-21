/**
 * 🗂️ El VEREDICTO de un PDF sin vincular y el BUSCADOR de la auditoría de Subdiarios (A-FEAT-1287,
 * usuario 2026-10-22).
 *
 * *«Ahí sería bueno esa factura que quede que está en la carpeta y no vinculada… darle un veredicto a
 * mano por ahora»* y *«hay que agregar un buscador en subdiarios así yo busco rápido colomac»*.
 *
 * El veredicto vive en el registro del archivo digital (`arca_pdf_archivo_digital`, script 93).
 */

export type Veredicto = 'no_informada' | 'otra_carpeta' | 'no_es_factura' | 'duplicado' | 'pendiente'

/** Los veredictos, en el orden en que se ofrecen, con lo que se le dice al usuario. */
export const VEREDICTOS: ReadonlyArray<{ valor: Veredicto; etiqueta: string; ayuda: string }> = [
  { valor: 'no_informada', etiqueta: '🚫 No informada en ARCA', ayuda: 'El proveedor no la informó en ARCA: cargala como «No Informada» y mandala a 📒 Asientos Contables (o imputala, si va al subdiario).' },
  { valor: 'otra_carpeta', etiqueta: '📂 Va en otra carpeta', ayuda: 'Es de otro mes o de otra empresa: anotá cuál en la nota.' },
  { valor: 'no_es_factura', etiqueta: '📄 No es factura', ayuda: 'Remito, resumen, recibo u otro papel que no se vincula.' },
  { valor: 'duplicado', etiqueta: '♊ Duplicado', ayuda: 'Es una copia de otro archivo ya vinculado.' },
  { valor: 'pendiente', etiqueta: '⏳ Pendiente', ayuda: 'Lo viste y todavía no sabés qué es.' },
]

export const etiquetaVeredicto = (v: string | null | undefined): string =>
  VEREDICTOS.find(x => x.valor === v)?.etiqueta ?? ''

/** ¿El veredicto lo da por resuelto? «Pendiente» y sin veredicto siguen abiertos. */
export const veredictoResuelve = (v: string | null | undefined): boolean =>
  !!v && v !== 'pendiente'

/** Minúsculas y sin acentos, para que «colomac» encuentre «COLOMAC» y «Hernandez» a «Hernández». */
export const normalizarBusqueda = (s: unknown): string =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * ¿Los textos coinciden con la búsqueda? Cada palabra de la búsqueda tiene que aparecer en alguno de
 * los textos. Una palabra con números se compara también sin separadores, para que «132220» encuentre
 * «0013-2220» y «1.234,50» encuentre «1234,50».
 */
export function coincideBusqueda(consulta: string, textos: readonly unknown[]): boolean {
  const palabras = normalizarBusqueda(consulta).split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return true
  const norm = textos.map(normalizarBusqueda)
  // Los dígitos de cada texto por separado: pegados, el final de uno y el principio del otro inventan números
  const digitos = norm.map(t => t.replace(/\D/g, ''))
  return palabras.every(p => {
    if (norm.some(t => t.includes(p))) return true
    const d = p.replace(/\D/g, '')
    return d.length >= 3 && d.length === p.replace(/[.,\-\/\s]/g, '').length && digitos.some(t => t.includes(d))
  })
}
