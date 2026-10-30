/**
 * 🔗 **LINK A FACTURAS FILTRADAS** — A-FEAT-1430 paso 2 (mismo patrón que `linkTemplates` y `linkExtracto`).
 *
 * Abre Egresos → Facturas de la empresa, en la sub-solapa pedida, mostrando sólo esos comprobantes (por **id**).
 * Primer uso: la provisión del ejercicio anterior, cuyas facturas viven en el **Histórico**.
 *
 *     /?seccion=egresos&tab=facturas-msa&sub=historico&historico=<id>,<id>
 */

export type SubFacturas = "facturas" | "subdiarios" | "historico" | "asignacion"
const SUBS: SubFacturas[] = ["facturas", "subdiarios", "historico", "asignacion"]

export function linkHistorico(ids: readonly string[], empresa: "MSA" | "PAM" = "MSA"): string {
  const limpios = [...new Set(ids.filter(Boolean))]
  const p = new URLSearchParams({ seccion: "egresos", tab: `facturas-${empresa.toLowerCase()}`, sub: "historico" })
  if (limpios.length) p.set("historico", limpios.join(","))
  return `/?${p.toString()}`
}

/** La sub-solapa de Facturas que pide el link (`null` = ninguna o desconocida). */
export function subFacturasDelLink(search: string): SubFacturas | null {
  const s = new URLSearchParams(search).get("sub") as SubFacturas | null
  return s && SUBS.includes(s) ? s : null
}

/** Los comprobantes del histórico que pide el link. Vacío = sin filtro. */
export function historicoDelLink(search: string): string[] {
  const v = new URLSearchParams(search).get("historico")
  return v ? [...new Set(v.split(",").map(x => x.trim()).filter(Boolean))] : []
}
