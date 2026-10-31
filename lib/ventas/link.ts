/**
 * 🔗 **LINK A LOS COMPROBANTES DE VENTA FILTRADOS** — A-FEAT-1439 (JMS 31/10: *«el link a ver los comprobantes en
 * ventas. Así yo siempre podré ver el estado real y tu sugerencia»*).
 *
 * Mismo patrón que `linkExtracto` y `linkFacturas`: abre Ingresos → la empresa → Comprobantes, mostrando sólo esos
 * comprobantes (por **id**: un número o un cliente se repiten).
 *
 *     /?seccion=ingresos&empresa=MSA&vista=comprobantes&ventas=<id>,<id>
 */

export type EmpresaVentas = "MSA" | "PAM" | "MA"
const EMPRESAS: EmpresaVentas[] = ["MSA", "PAM", "MA"]

export function linkComprobantesVenta(ids: readonly string[], empresa: string = "MSA"): string {
  const limpios = [...new Set(ids.filter(Boolean))]
  const emp = EMPRESAS.includes(empresa.toUpperCase() as EmpresaVentas) ? empresa.toUpperCase() : "MSA"
  const p = new URLSearchParams({ seccion: "ingresos", empresa: emp, vista: "comprobantes" })
  if (limpios.length) p.set("ventas", limpios.join(","))
  return `/?${p.toString()}`
}

/** Lo que pide el link. `null` = no vino de un link de Ingresos. */
export function ventasDelLink(search: string): { empresa: EmpresaVentas | null; vista: string | null; ids: string[] } | null {
  const p = new URLSearchParams(search)
  if (p.get("seccion") !== "ingresos") return null
  const e = (p.get("empresa") ?? "").toUpperCase() as EmpresaVentas
  const ids = [...new Set((p.get("ventas") ?? "").split(",").map(x => x.trim()).filter(Boolean))]
  return { empresa: EMPRESAS.includes(e) ? e : null, vista: p.get("vista"), ids }
}
