/**
 * 🔎 **Filtros de la tabla de STOCK de insumos** — A-FEAT-1243 (nota del usuario 2026-09-16:
 * *«esta pantalla debe tener filtros»*). Los movimientos ya tenían; el stock no.
 *
 * Búsqueda (producto u observaciones, sin tildes), categorías (vacío = todas) y «sólo con stock».
 * Lógica pura, probada en `lib/pruebas/casos.ts`.
 */
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()

export interface FiltroStock { busqueda: string; categorias: Set<string>; soloConStock: boolean }

export function filtrarStock<T extends { producto: string; observaciones?: string | null; cantidad?: number | string | null; categorias_insumo?: { nombre?: string | null } | null }>(
  filas: T[], f: FiltroStock,
): T[] {
  const q = norm(f.busqueda)
  return filas.filter(s => {
    const cat = s.categorias_insumo?.nombre || "(sin categoría)"
    if (f.categorias.size > 0 && !f.categorias.has(cat)) return false
    if (f.soloConStock && !((Number(s.cantidad) || 0) > 0)) return false
    if (q && !norm(`${s.producto} ${s.observaciones ?? ""}`).includes(q)) return false
    return true
  })
}
