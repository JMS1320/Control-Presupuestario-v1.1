/**
 * 🏷️ El GLOSARIO de los estados FC — qué quiere decir cada uno y quién lo pone (A-FEAT-1287).
 *
 * Acordado con el usuario 2026-10-20. Es la ÚNICA lista: de acá salen los colores de las pastillas
 * y la leyenda que se ve en el buscador de PDFs y en Facturas ARCA. Antes cada pantalla tenía su
 * propio mapa de colores (cuatro copias) y ninguna decía qué significaba cada palabra — así fue como
 * «No» terminó queriendo decir dos cosas distintas según quién lo pusiera.
 */
export interface EstadoFc {
  valor: string
  /** Qué significa, en una línea */
  significado: string
  /** Quién lo pone */
  quien: string
  /** Clases de la pastilla */
  color: string
}

export const ESTADOS_FC: readonly EstadoFc[] = [
  { valor: 'Buscar', significado: 'Falta el archivo: hay que buscarlo', quien: 'cualquiera (lo no marcado queda así)', color: 'bg-gray-100 text-gray-700' },
  { valor: 'APP', significado: 'La app encontró el archivo y lo validó (CUIT, número, monto, tipo y fecha)', quien: 'la app', color: 'bg-blue-100 text-blue-800' },
  { valor: 'VER', significado: 'La app encontró algo dudoso o más de un candidato: hay que elegir o confirmar', quien: 'la app', color: 'bg-yellow-100 text-yellow-800' },
  { valor: 'Confirmada', significado: 'Aprobaste un candidato que estaba en VER', quien: 'el administrador', color: 'bg-emerald-200 text-emerald-900' },
  { valor: 'Sí', significado: 'Ulises la tiene. Si no tiene 📎, la app igual la busca para vincularla', quien: 'Ulises', color: 'bg-green-100 text-green-800' },
  { valor: 'NO Mail', significado: 'Se buscó y no apareció. Se puede volver a buscar', quien: 'la app', color: 'bg-orange-100 text-orange-800' },
  { valor: 'Portal', significado: 'Se baja del portal del proveedor: no se busca ni en la carpeta ni en el mail', quien: 'cualquiera', color: 'bg-purple-100 text-purple-800' },
  { valor: 'No', significado: 'No hay factura o no corresponde', quien: 'sólo el administrador', color: 'bg-red-100 text-red-700' },
  { valor: 'OK', significado: 'Revisada por el usuario (estado anterior)', quien: 'el administrador', color: 'bg-green-200 text-green-900' },
]

const POR_VALOR = new Map(ESTADOS_FC.map(e => [e.valor, e]))

/** Las clases de la pastilla de un estado FC (gris si es un valor que no está en el glosario). */
export function colorFc(valor: string | null | undefined): string {
  return (valor && POR_VALOR.get(valor)?.color) || 'bg-gray-100 text-gray-500'
}

/** El tooltip de un estado: «APP — La app encontró… (lo pone: la app)». */
export function ayudaFc(valor: string | null | undefined): string {
  const e = valor ? POR_VALOR.get(valor) : undefined
  return e ? `${e.valor} — ${e.significado} (lo pone: ${e.quien})` : (valor || 'sin estado')
}
