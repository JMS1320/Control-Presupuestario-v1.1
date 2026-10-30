/**
 * 🔗 **LINK AL EXTRACTO FILTRADO** — A-FEAT-1430 paso 2 (JMS 30/10: *«para ver el detalle y editar, el link hacia esa
 * info en su lugar donde vive, con los filtros para mostrar sólo eso»*).
 *
 * Mismo patrón que `linkTemplates` (Planilla de impuestos → Templates, que JMS ya usa): una URL que abre la sección
 * en una pestaña nueva y la pantalla lee el filtro al arrancar. Acá: la cuenta, los movimientos por **id** (nunca por
 * texto: un importe o una descripción se repiten) y el rango de fechas que los contiene, para que se carguen.
 *
 *     /?seccion=extracto&cuenta=msa_galicia&movs=12,15&desde=2025-08-01&hasta=2025-08-31
 */

export interface FiltroExtractoDelLink {
  /** El `id` de CUENTAS_BANCARIAS (no siempre es el nombre de la tabla: las tarjetas difieren). */
  cuenta: string | null
  movs: string[]
  desde: string | null
  hasta: string | null
}

const fecha = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null)

export function linkExtracto(f: { cuenta: string; movs?: readonly (string | number)[]; desde?: string | null; hasta?: string | null }): string {
  const p = new URLSearchParams({ seccion: "extracto", cuenta: f.cuenta })
  const ids = [...new Set((f.movs ?? []).map(String).filter(Boolean))]
  if (ids.length) p.set("movs", ids.join(","))
  if (fecha(f.desde)) p.set("desde", f.desde!)
  if (fecha(f.hasta)) p.set("hasta", f.hasta!)
  return `/?${p.toString()}`
}

/** Lee el filtro del link. Sin `cuenta` y sin `movs` = no vino del link (`null`). */
export function extractoDelLink(search: string): FiltroExtractoDelLink | null {
  const p = new URLSearchParams(search)
  if (p.get("seccion") !== "extracto") return null
  const movs = [...new Set((p.get("movs") ?? "").split(",").map(s => s.trim()).filter(Boolean))]
  const cuenta = p.get("cuenta")
  if (!cuenta && !movs.length) return null
  return { cuenta, movs, desde: fecha(p.get("desde")), hasta: fecha(p.get("hasta")) }
}

/** El rango que contiene todas las fechas (con unos días de margen), para que los movimientos entren en la carga. */
export function rangoQueContiene(fechas: Array<string | null | undefined>, margenDias = 3): { desde: string | null; hasta: string | null } {
  const v = fechas.filter((x): x is string => !!x).map(x => x.slice(0, 10)).sort()
  if (!v.length) return { desde: null, hasta: null }
  const mover = (iso: string, d: number) => { const t = new Date(`${iso}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10) }
  return { desde: mover(v[0], -margenDias), hasta: mover(v[v.length - 1], margenDias) }
}
