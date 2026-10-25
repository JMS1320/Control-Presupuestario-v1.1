/**
 * 📄 TRAER TODAS LAS FILAS — la base entrega como máximo 1000 por consulta (A-BUG-1339, 2026-10-24).
 *
 * Supabase (PostgREST) corta cada respuesta en 1000 filas **sin avisar**: no hay error, sólo llegan
 * menos. En los papeles del balance eso dejó afuera **abril, mayo y junio del banco** (julio→marzo
 * suman justo 1000 movimientos) y **la mitad de las cuotas de templates** (2046 → 1000). El papel
 * salía «SIN EXTRACTO» y con meses vacíos, y nada lo señalaba.
 *
 * Se pide de a tandas hasta que una venga incompleta. 🔑 **La consulta tiene que tener un orden que
 * no empate** (terminar en `.order("id")`): sin eso dos tandas pueden repetir o saltear filas.
 *
 * Mismo criterio que la auditoría de conciliación, que ya paginaba por esta razón.
 */
export const TANDA = 1000

/** ¿Hay que pedir otra tanda? Sí mientras la última vino llena (justo 1000 también: puede haber más). */
export const hayOtraTanda = (lote: unknown[] | null | undefined, tanda = TANDA): boolean => (lote?.length ?? 0) >= tanda

/** La misma vuelta, sobre una fuente sincrónica — para los casos de `npm run probar`. */
export function juntarTandas<T>(pedir: (desde: number, hasta: number) => T[], tanda = TANDA): { filas: T[]; tandas: number } {
  const filas: T[] = []
  let tandas = 0
  for (let desde = 0; ; desde += tanda) {
    const lote = pedir(desde, desde + tanda - 1); tandas++
    filas.push(...lote)
    if (!hayOtraTanda(lote, tanda)) return { filas, tandas }
  }
}

/**
 * 🧮 El CONTROL de que llegó todo (A-FEAT-1343): si la consulta pide `{ count: "exact" }`, la base
 * dice cuántas filas hay, y eso se compara con las que llegaron. Es el mismo número por dos caminos:
 * si no coinciden, el papel se armó con datos de menos y **no se puede entregar**.
 */
export interface Lectura { nombre: string; llegaron: number; esperadas: number | null }

export function lecturaIncompleta(l: Lectura): boolean {
  return l.esperadas != null && l.llegaron !== l.esperadas
}

export async function traerTodo<T = any>(
  hacer: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null; count?: number | null }>,
  tanda = TANDA,
): Promise<{ data: T[]; error: { message: string } | null; esperadas: number | null }> {
  const filas: T[] = []
  let esperadas: number | null = null
  for (let desde = 0; ; desde += tanda) {
    const { data, error, count } = await hacer(desde, desde + tanda - 1)
    if (error) return { data: filas, error, esperadas }
    if (esperadas == null && typeof count === "number") esperadas = count
    const lote = data ?? []
    filas.push(...lote)
    if (!hayOtraTanda(lote, tanda)) return { data: filas, error: null, esperadas }
  }
}
