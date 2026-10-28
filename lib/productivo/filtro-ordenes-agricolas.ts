/**
 * 🔎 **Filtros de las ÓRDENES AGRÍCOLAS** — A-FEAT-1397 (nota de JMS 2026-10-28: *«filtrar insumo,
 * lote etc.»*, mientras cargaba las órdenes de la campaña).
 *
 * Lote, insumo, labor y estado (vacío = todos) + rango de fechas. Lógica pura, probada en
 * `lib/pruebas/casos.ts`.
 *
 * 🌾 **Los lotes de una orden** (etapa 2, script 121): si la orden tiene sus lotes vinculados
 * (`lotes_orden`, cada uno con sus hectáreas) se usan ésos. Las órdenes viejas sin vínculo guardan
 * sólo el texto «Casas / Tropilla Parque» y el total: ahí se parte el texto por « / » y las
 * hectáreas de cada lote no se conocen.
 *
 * 🌳 **Lote madre y sub-lotes** (ER1 dentro de «Entre Rios 1, 2, 3»): con `padreDe` (nombre → nombre
 * del madre), filtrar el madre trae también lo aplicado a sus sub-lotes, y filtrar un sub-lote trae
 * también lo aplicado al madre entero (que lo incluye).
 */
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()

export interface LoteDeOrden { lote_nombre: string; hectareas?: number | string | null; orden?: number | null }

export interface OrdenFiltrable {
  fecha: string
  estado: string
  hectareas?: number | string | null
  lote_nombre?: string | null
  lote?: { nombre_lote?: string | null } | null
  lotes_orden?: LoteDeOrden[] | null
  labores?: string[]
  lineas?: { insumo_nombre: string; cantidad_total_l?: number | string | null; recuento?: boolean | null; cantidad_recuento_l?: number | string | null }[]
  observaciones?: string | null
}

export interface FiltroOrdenesAgricolas {
  lotes: Set<string>
  insumos: Set<string>
  labores: Set<string>
  estados: Set<string>
  desde: string // 'YYYY-MM-DD' o ''
  hasta: string
  /** Buscador de texto (insumo, lote, labor, observaciones), sin tildes. JMS 28/10: los insumos son
   *  demasiados para chips — «para esto es buscador de texto». */
  texto?: string
}

export const FILTRO_ORDENES_VACIO: FiltroOrdenesAgricolas = {
  lotes: new Set(), insumos: new Set(), labores: new Set(), estados: new Set(), desde: "", hasta: "", texto: "",
}

/** ¿El insumo coincide con el buscador? (vacío = todos) */
export const insumoCoincide = (insumo: string, texto?: string) => !norm(texto || "") || norm(insumo).includes(norm(texto || ""))

const pasaTexto = (o: OrdenFiltrable, texto?: string) => {
  const q = norm(texto || "")
  if (!q) return true
  return norm([...insumosDeOrden(o), ...lotesDeOrden(o), ...laboresDeOrden(o), o.observaciones || ""].join(" | ")).includes(q)
}

type Dimension = "lotes" | "insumos" | "labores" | "estados"
/** nombre de lote → nombre de su lote madre */
export type PadreDe = Map<string, string>
export interface Opciones { ignorar?: Dimension; padreDe?: PadreDe }

/** Los lotes de una orden con sus hectáreas (null = no se sabe: orden vieja de varios lotes). */
export function lotesConHa(o: OrdenFiltrable): { nombre: string; ha: number | null }[] {
  if (o.lotes_orden && o.lotes_orden.length > 0) {
    return [...o.lotes_orden]
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      .map(l => ({ nombre: l.lote_nombre.trim(), ha: Number(l.hectareas) || 0 }))
  }
  const txt = o.lote?.nombre_lote || o.lote_nombre || ""
  const partes = txt.split(" / ").map(s => s.trim()).filter(Boolean)
  if (partes.length === 0) return [{ nombre: "(sin lote)", ha: Number(o.hectareas) || 0 }]
  if (partes.length === 1) return [{ nombre: partes[0], ha: Number(o.hectareas) || 0 }]
  return partes.map(nombre => ({ nombre, ha: null }))
}

export const lotesDeOrden = (o: OrdenFiltrable) => lotesConHa(o).map(l => l.nombre)

export const insumosDeOrden = (o: OrdenFiltrable) =>
  [...new Set((o.lineas || []).map(l => l.insumo_nombre?.trim()).filter(Boolean) as string[])]

export const laboresDeOrden = (o: OrdenFiltrable) => o.labores || []

/** Los madres de un lote, del más cercano al más lejano (corta si hubiera un ciclo). */
export function ancestros(nombre: string, padreDe?: PadreDe): string[] {
  const r: string[] = []
  let p = padreDe?.get(nombre)
  while (p && !r.includes(p) && p !== nombre) { r.push(p); p = padreDe?.get(p) }
  return r
}

/**
 * ¿El lote de la orden `L` entra en la selección? Directo (L elegido), por debajo (se eligió un
 * madre de L) o por encima (se eligió un sub-lote de L: la orden fue al madre entero).
 * Devuelve 'directo' | 'madre' | null — 'madre' = la orden abarca más que lo elegido.
 */
export function coincideLote(L: string, sel: Set<string>, padreDe?: PadreDe): "directo" | "madre" | null {
  if (sel.has(L) || ancestros(L, padreDe).some(a => sel.has(a))) return "directo"
  for (const s of sel) if (ancestros(s, padreDe).includes(L)) return "madre"
  return null
}

/** Un conjunto vacío no filtra; uno lleno pide que la orden tenga AL MENOS uno de sus valores. */
const pasa = (sel: Set<string>, valores: string[]) =>
  sel.size === 0 || valores.some(v => sel.has(v))

const pasaLote = (o: OrdenFiltrable, sel: Set<string>, padreDe?: PadreDe) =>
  sel.size === 0 || lotesDeOrden(o).some(L => coincideLote(L, sel, padreDe) !== null)

export function filtrarOrdenesAgricolas<T extends OrdenFiltrable>(
  ordenes: T[], f: FiltroOrdenesAgricolas, op: Opciones = {},
): T[] {
  const { ignorar, padreDe } = op
  return ordenes.filter(o => {
    if (f.desde && o.fecha < f.desde) return false
    if (f.hasta && o.fecha > f.hasta) return false
    if (!pasaTexto(o, f.texto)) return false
    if (ignorar !== "lotes" && !pasaLote(o, f.lotes, padreDe)) return false
    if (ignorar !== "insumos" && !pasa(f.insumos, insumosDeOrden(o))) return false
    if (ignorar !== "labores" && !pasa(f.labores, laboresDeOrden(o))) return false
    if (ignorar !== "estados" && !pasa(f.estados, [o.estado])) return false
    return true
  })
}

/**
 * Los chips de una dimensión con su número, contado sobre lo que dejan pasar LOS DEMÁS filtros
 * (regla de los chips, CLAUDE.md § ♻️). Ordenados por nombre, sin tildes. En lotes aparecen también
 * los madres de los lotes usados, y el número cuenta lo que traería ese chip solo.
 */
export function chipsDe<T extends OrdenFiltrable>(
  ordenes: T[], f: FiltroOrdenesAgricolas, dim: Dimension, padreDe?: PadreDe,
): { valor: string; n: number }[] {
  const base = filtrarOrdenesAgricolas(ordenes, f, { ignorar: dim, padreDe })
  const valores = (o: T) =>
    dim === "lotes" ? lotesDeOrden(o) : dim === "insumos" ? insumosDeOrden(o)
      : dim === "labores" ? laboresDeOrden(o) : [o.estado]
  const candidatos = new Set<string>()
  for (const o of ordenes) for (const v of valores(o)) {
    candidatos.add(v)
    if (dim === "lotes") for (const a of ancestros(v, padreDe)) candidatos.add(a)
  }
  // Lo seleccionado se muestra aunque los otros filtros lo dejen en 0: si no, no se puede apagar
  for (const v of f[dim]) candidatos.add(v)
  return [...candidatos]
    .map(valor => ({
      valor,
      n: dim === "lotes"
        ? base.filter(o => pasaLote(o, new Set([valor]), padreDe)).length
        : base.filter(o => valores(o).includes(valor)).length,
    }))
    .sort((a, b) => norm(a.valor).localeCompare(norm(b.valor)))
}

/**
 * El resumen de lo filtrado: órdenes, hectáreas y litros por insumo (lo recontado si la orden lo
 * tiene, si no lo planificado).
 *
 * Con filtro de lote, cuando la orden tiene las hectáreas de cada lote se cuentan SÓLO las de los
 * lotes elegidos, y los litros en la misma proporción. Cuando no se puede separar —orden vieja de
 * varios lotes, o aplicada al lote madre entero mientras se filtra un sub-lote— se cuenta la orden
 * entera y se suma a `enteras`, para que la pantalla lo diga en vez de sumarlo en silencio.
 */
export function resumenOrdenes<T extends OrdenFiltrable>(ordenes: T[], f: FiltroOrdenesAgricolas, padreDe?: PadreDe) {
  const litros = new Map<string, number>()
  let ha = 0, enteras = 0
  for (const o of ordenes) {
    const total = Number(o.hectareas) || 0
    let haO = total, factor = 1
    if (f.lotes.size > 0) {
      const lotes = lotesConHa(o)
      const directos = lotes.filter(l => coincideLote(l.nombre, f.lotes, padreDe) === "directo")
      if (directos.length > 0 && directos.every(l => l.ha !== null)) {
        haO = directos.reduce((s, l) => s + (l.ha as number), 0)
        factor = total > 0 ? haO / total : 0
      } else {
        enteras++
      }
    }
    ha += haO
    for (const l of o.lineas || []) {
      if (f.insumos.size > 0 && !f.insumos.has(l.insumo_nombre)) continue
      // con buscador: si la orden tiene insumos que coinciden, se suman sólo ésos
      if (f.texto && (o.lineas || []).some(x => insumoCoincide(x.insumo_nombre, f.texto)) && !insumoCoincide(l.insumo_nombre, f.texto)) continue
      const lt = l.recuento && l.cantidad_recuento_l != null ? Number(l.cantidad_recuento_l) : Number(l.cantidad_total_l) || 0
      litros.set(l.insumo_nombre, (litros.get(l.insumo_nombre) || 0) + lt * factor)
    }
  }
  return {
    ordenes: ordenes.length,
    ha: Math.round(ha * 100) / 100,
    enteras,
    litros: [...litros.entries()].map(([i, l]) => [i, Math.round(l * 100) / 100] as [string, number]).sort((a, b) => b[1] - a[1]),
  }
}

/**
 * ✍️ El lote ESCRITO A MANO (JMS 28/10: «sacar los chips de lote… dejá para completar a mano»). Devuelve
 * los nombres de lote —de las órdenes y sus madres— que contienen el texto (sin tildes ni mayúsculas).
 * Vacío = sin filtro. Si el texto no coincide con ninguno, devuelve un conjunto que no deja pasar
 * nada (para que la lista diga «ninguna orden» en vez de mostrar todas).
 */
export const SIN_COINCIDENCIA = "\u0000ningun-lote"
export function lotesQueCoinciden<T extends OrdenFiltrable>(ordenes: T[], texto: string, padreDe?: PadreDe): Set<string> {
  const q = norm(texto)
  if (!q) return new Set()
  const nombres = new Set<string>()
  for (const o of ordenes) for (const L of lotesDeOrden(o)) {
    nombres.add(L)
    for (const a of ancestros(L, padreDe)) nombres.add(a)
  }
  // sin espacios: el lote se llama «ER 1» y se escribe «ER1»
  const sinEsp = (x: string) => norm(x).replace(/\s+/g, "")
  const r = new Set([...nombres].filter(n => sinEsp(n).includes(sinEsp(q))))
  return r.size > 0 ? r : new Set([SIN_COINCIDENCIA])
}

export const hayFiltro = (f: FiltroOrdenesAgricolas) =>
  f.lotes.size + f.insumos.size + f.labores.size + f.estados.size > 0 || !!f.desde || !!f.hasta || !!norm(f.texto || "")

// ── Lotes madre y sub-lotes ──────────────────────────────────────────────────────────────────────

export interface LoteArbol { id: string; nombre_lote: string; hectareas: number | string | null; lote_padre_id?: string | null }

/** nombre → nombre del madre, para los filtros. */
export const padreDePorNombre = (lotes: LoteArbol[]): PadreDe => {
  const porId = new Map(lotes.map(l => [l.id, l]))
  const m: PadreDe = new Map()
  for (const l of lotes) {
    const p = l.lote_padre_id ? porId.get(l.lote_padre_id) : undefined
    if (p) m.set(l.nombre_lote, p.nombre_lote)
  }
  return m
}

/**
 * Los lotes en orden de árbol: cada madre seguido de sus sub-lotes (con `nivel`), y en cada madre
 * cuánto lleva medido (la suma de sus sub-lotes) contra sus hectáreas cargadas.
 */
export function arbolLotes<L extends LoteArbol>(lotes: L[]): { lote: L; nivel: number; medido: number | null; hijos: number }[] {
  const ids = new Set(lotes.map(l => l.id))
  const hijosDe = new Map<string, L[]>()
  for (const l of lotes) if (l.lote_padre_id && ids.has(l.lote_padre_id)) {
    hijosDe.set(l.lote_padre_id, [...(hijosDe.get(l.lote_padre_id) || []), l])
  }
  const porNombre = (a: L, b: L) => norm(a.nombre_lote).localeCompare(norm(b.nombre_lote))
  const r: { lote: L; nivel: number; medido: number | null; hijos: number }[] = []
  const visitados = new Set<string>()
  const recorrer = (l: L, nivel: number) => {
    if (visitados.has(l.id)) return
    visitados.add(l.id)
    const hijos = (hijosDe.get(l.id) || []).sort(porNombre)
    const medido = hijos.length ? Math.round(hijos.reduce((s, h) => s + (Number(h.hectareas) || 0), 0) * 100) / 100 : null
    r.push({ lote: l, nivel, medido, hijos: hijos.length })
    for (const h of hijos) recorrer(h, nivel + 1)
  }
  for (const l of lotes.filter(l => !l.lote_padre_id || !ids.has(l.lote_padre_id)).sort(porNombre)) recorrer(l, 0)
  for (const l of lotes) recorrer(l, 0) // por si quedó alguno en un ciclo
  return r
}
