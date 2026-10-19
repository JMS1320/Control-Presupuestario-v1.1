/**
 * 🐄 Las cabezas que hay HOY en una categoría (A-FEAT-1265).
 *
 * Pedido del usuario 2026-10-05, sobre «Nuevo Movimiento Hacienda»: *«este modal debe mostrar las
 * cantidades actuales»*. El stock de la pantalla se calcula de los movimientos y **no trae las
 * categorías en cero**: una categoría que no aparece tiene 0 cabezas, no «sin dato».
 */
export function cabezasHoy(
  stock: readonly { categoria_id: string | number; cantidad: number }[],
  categoriaId: string | number | null | undefined,
): number {
  if (categoriaId === null || categoriaId === undefined || categoriaId === '') return 0
  return stock.find(x => String(x.categoria_id) === String(categoriaId))?.cantidad ?? 0
}
