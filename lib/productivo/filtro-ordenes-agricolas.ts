/**
 * 🔎 **Filtros de las ÓRDENES AGRÍCOLAS** — A-FEAT-1397 (nota de JMS 2026-10-28: *«filtrar insumo,
 * lote etc.»*, mientras cargaba las órdenes de la campaña).
 *
 * Lote, insumo, labor y estado (vacío = todos) + rango de fechas. Lógica pura, probada en
 * `lib/pruebas/casos.ts`.
 *
 * ⚠️ **El lote de una orden hoy es TEXTO**: la orden guarda «Casas / Tropilla Parque» y no el
 * vínculo a cada lote (`lote_id` está vacío en todas). Por eso `lotesDeOrden` parte el texto por
 * « / ». Cuando la orden guarde sus lotes con sus hectáreas (etapa 2 de A-FEAT-1397), sólo cambia
 * esta función; la pantalla no.
 */
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()

export interface OrdenFiltrable {
  fecha: string
  estado: string
  lote_nombre?: string | null
  lote?: { nombre_lote?: string | null } | null
  labores?: string[]
  lineas?: { insumo_nombre: string }[]
}

export interface FiltroOrdenesAgricolas {
  lotes: Set<string>
  insumos: Set<string>
  labores: Set<string>
  estados: Set<string>
  desde: string // 'YYYY-MM-DD' o ''
  hasta: string
}

export const FILTRO_ORDENES_VACIO: FiltroOrdenesAgricolas = {
  lotes: new Set(), insumos: new Set(), labores: new Set(), estados: new Set(), desde: "", hasta: "",
}

/** Los lotes de una orden, uno por uno («Casas / Tropilla Parque» → Casas, Tropilla Parque). */
export function lotesDeOrden(o: OrdenFiltrable): string[] {
  const txt = o.lote?.nombre_lote || o.lote_nombre || ""
  const partes = txt.split(" / ").map(s => s.trim()).filter(Boolean)
  return partes.length ? partes : ["(sin lote)"]
}

export const insumosDeOrden = (o: OrdenFiltrable) =>
  [...new Set((o.lineas || []).map(l => l.insumo_nombre?.trim()).filter(Boolean) as string[])]

export const laboresDeOrden = (o: OrdenFiltrable) => o.labores || []

/** Un conjunto vacío no filtra; uno lleno pide que la orden tenga AL MENOS uno de sus valores. */
const pasa = (sel: Set<string>, valores: string[]) =>
  sel.size === 0 || valores.some(v => sel.has(v))

type Dimension = "lotes" | "insumos" | "labores" | "estados"

export function filtrarOrdenesAgricolas<T extends OrdenFiltrable>(
  ordenes: T[], f: FiltroOrdenesAgricolas, ignorar?: Dimension,
): T[] {
  return ordenes.filter(o => {
    if (f.desde && o.fecha < f.desde) return false
    if (f.hasta && o.fecha > f.hasta) return false
    if (ignorar !== "lotes" && !pasa(f.lotes, lotesDeOrden(o))) return false
    if (ignorar !== "insumos" && !pasa(f.insumos, insumosDeOrden(o))) return false
    if (ignorar !== "labores" && !pasa(f.labores, laboresDeOrden(o))) return false
    if (ignorar !== "estados" && !pasa(f.estados, [o.estado])) return false
    return true
  })
}

/**
 * Los chips de una dimensión con su número, contado sobre lo que dejan pasar LOS DEMÁS filtros
 * (regla de los chips, CLAUDE.md § ♻️). Ordenados por nombre, sin tildes.
 */
export function chipsDe<T extends OrdenFiltrable>(
  ordenes: T[], f: FiltroOrdenesAgricolas, dim: Dimension,
): { valor: string; n: number }[] {
  const base = filtrarOrdenesAgricolas(ordenes, f, dim)
  const valores = (o: T) =>
    dim === "lotes" ? lotesDeOrden(o) : dim === "insumos" ? insumosDeOrden(o)
      : dim === "labores" ? laboresDeOrden(o) : [o.estado]
  const cuenta = new Map<string, number>()
  for (const o of ordenes) for (const v of valores(o)) if (!cuenta.has(v)) cuenta.set(v, 0)
  for (const o of base) for (const v of new Set(valores(o))) cuenta.set(v, (cuenta.get(v) || 0) + 1)
  // Lo seleccionado se muestra aunque los otros filtros lo dejen en 0: si no, no se puede apagar
  for (const v of f[dim]) if (!cuenta.has(v)) cuenta.set(v, 0)
  return [...cuenta.entries()]
    .map(([valor, n]) => ({ valor, n }))
    .sort((a, b) => norm(a.valor).localeCompare(norm(b.valor)))
}

/**
 * El resumen de lo filtrado: órdenes, hectáreas y litros por insumo (lo recontado si la orden lo
 * tiene, si no lo planificado). Si hay filtro de lote y alguna orden abarca VARIOS lotes, sus
 * hectáreas y litros son de la orden entera — la orden no guarda cuánto fue a cada lote — y eso se
 * cuenta en `compartidas` para que la pantalla lo diga en vez de sumarlo en silencio.
 */
export function resumenOrdenes<T extends OrdenFiltrable & {
  hectareas?: number | string | null
  lineas?: { insumo_nombre: string; cantidad_total_l?: number | string | null; recuento?: boolean | null; cantidad_recuento_l?: number | string | null }[]
}>(ordenes: T[], f: FiltroOrdenesAgricolas) {
  const litros = new Map<string, number>()
  let ha = 0, compartidas = 0
  for (const o of ordenes) {
    ha += Number(o.hectareas) || 0
    if (f.lotes.size > 0 && lotesDeOrden(o).length > 1) compartidas++
    for (const l of o.lineas || []) {
      if (f.insumos.size > 0 && !f.insumos.has(l.insumo_nombre)) continue
      const lt = l.recuento && l.cantidad_recuento_l != null ? Number(l.cantidad_recuento_l) : Number(l.cantidad_total_l) || 0
      litros.set(l.insumo_nombre, (litros.get(l.insumo_nombre) || 0) + lt)
    }
  }
  return { ordenes: ordenes.length, ha, compartidas, litros: [...litros.entries()].sort((a, b) => b[1] - a[1]) }
}

export const hayFiltro =(f: FiltroOrdenesAgricolas) =>
  f.lotes.size + f.insumos.size + f.labores.size + f.estados.size > 0 || !!f.desde || !!f.hasta
