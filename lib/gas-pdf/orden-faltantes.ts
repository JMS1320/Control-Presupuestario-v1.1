/**
 * 📅 El orden y el filtro de la lista de facturas sin PDF — A-FEAT-1399.
 *
 * Notas 🌙 de JMS 2026-10-27 (Facturas sin comprobante): *«debe estar ordenado por fecha. Digo bug por
 * nuestra forma de trabajar: siempre que haya datos se debe pensar el orden lógico en que lo quiere ver
 * el usuario»* y *«poder filtrar proveedor»*.
 *
 * - Orden: por fecha de emisión, de la más vieja a la más nueva (como un subdiario); con
 *   `masNuevasPrimero`, al revés. Empate: proveedor y comprobante, para que el orden sea estable.
 * - Filtro: el texto contra el proveedor o el CUIT, sin tildes ni mayúsculas (el CUIT sin guiones).
 *
 * Vive en `lib/` porque la lista es la misma en Subdiarios y en Facturas sin comprobante.
 */
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()

export function ordenarYFiltrarFaltantes<T extends { fecha_emision?: string | null; proveedor: string; cuit: string; comprobante?: string | null }>(
  filas: T[], filtroProveedor: string, masNuevasPrimero = false,
): T[] {
  const q = norm(filtroProveedor)
  const qCuit = filtroProveedor.replace(/\D/g, "")
  const filtradas = q
    ? filas.filter(f => norm(f.proveedor || "").includes(q) || (qCuit.length >= 3 && String(f.cuit || "").replace(/\D/g, "").includes(qCuit)))
    : filas
  const signo = masNuevasPrimero ? -1 : 1
  return [...filtradas].sort((a, b) => {
    const fa = (a.fecha_emision || "").slice(0, 10), fb = (b.fecha_emision || "").slice(0, 10)
    if (fa !== fb) {
      if (!fa) return 1 // sin fecha al final, en cualquier sentido
      if (!fb) return -1
      return fa < fb ? -signo : signo
    }
    return norm(a.proveedor || "").localeCompare(norm(b.proveedor || "")) || String(a.comprobante || "").localeCompare(String(b.comprobante || ""))
  })
}
