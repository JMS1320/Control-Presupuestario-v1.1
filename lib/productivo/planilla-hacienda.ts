/**
 * 🐄 Las columnas de la Planilla de Hacienda y el «Total Vientres» (antes escritas adentro de `vista-sector-productivo.tsx`).
 *
 * ⚠️ cambió 27/11 (JMS: «la vaquillona de reposición debe ir en cría porque está inseminada… El 1 de octubre, todos los vientres
 * entorados: son las vacas y las vaquillonas de reposición. No las CUT/descarte, porque ésas no entran al servicio»):
 *  - **Vaq. Reposición pasa al grupo CRÍA** (estaba en Recría / Engorde). La ternera que se retiene sigue en recría como
 *    «Ternera Recría» marcada reposición; al pasarla a Vaquillona de Reposición es porque ya entró al servicio.
 *  - **Total Vientres = Vaca + Vaq. Preñada + Vaq. Reposición** (antes Vaca + Vaq. Preñada), y se busca POR NOMBRE: antes
 *    eran las posiciones 0 y 1, y reordenar las columnas le cambiaba el significado en silencio (MODULO_HACIENDA § 6.3).
 * El ciclo de cría arranca el 1/10 (`MES_SERVICIO` en `lib/ganaderia/ciclo.ts`).
 */

export interface CatPlanilla { db: string; label: string; grupo: 'cria' | 'recria' | 'terneros' }

export const CATS_PLANILLA: CatPlanilla[] = [
  { db: 'Vaca', label: 'Vaca', grupo: 'cria' },
  { db: 'Vaquillona Preñada', label: 'Vaq. Preñada', grupo: 'cria' },
  { db: 'Vaquillona de Reposicion', label: 'Vaq. Reposición', grupo: 'cria' },
  { db: 'Vaca CUT/Descarte', label: 'CUT/Descarte', grupo: 'cria' },
  { db: 'Toro', label: 'Toro', grupo: 'cria' },
  { db: 'Ternero Recria', label: 'Ternero', grupo: 'recria' },
  { db: 'Ternera Recria', label: 'Ternera', grupo: 'recria' },
  { db: 'Torito', label: 'Torito', grupo: 'recria' },
  { db: 'Novillo', label: 'Novillo', grupo: 'recria' },
  { db: 'Vaquillona Engorde', label: 'Vaq. Engorde', grupo: 'recria' },
]

export const CATS_TERNEROS: CatPlanilla[] = [
  { db: 'Ternero al Pie', label: 'Ternero al Pie', grupo: 'terneros' },
  { db: 'Ternera al Pie', label: 'Ternera al Pie', grupo: 'terneros' },
]

/** Los vientres: lo que entra al servicio. La CUT/Descarte no. */
export const CATS_VIENTRES = ['Vaca', 'Vaquillona Preñada', 'Vaquillona de Reposicion']

/**
 * Pura: el Total Vientres de una fila (la Existencia Final), buscando cada categoría POR NOMBRE en `cats`, y su texto
 * («Vaca (191) + Vaq. Preñada (0) + Vaq. Reposición (74) = 265»).
 */
export function totalVientres(fila: number[], cats: CatPlanilla[] = CATS_PLANILLA): { total: number; texto: string } {
  const partes = CATS_VIENTRES.map(db => {
    const i = cats.findIndex(c => c.db === db)
    return { label: i >= 0 ? cats[i].label : db, n: i >= 0 ? Number(fila[i] ?? 0) : 0 }
  })
  const total = partes.reduce((s, p) => s + p.n, 0)
  const f = (n: number) => n.toLocaleString('es-AR')
  return { total, texto: `${partes.map(p => `${p.label} (${f(p.n)})`).join(' + ')} = ${f(total)}` }
}
