/**
 * 🐄 LO REAL REEMPLAZA A LA PROYECCIÓN DEL RODEO — A-FEAT-1672 (JMS 27/11: «esa evolución del rodeo… no se va a cumplir. Va a ser suplantada por
 * lo real. Lo real sale del stock de Hacienda»).
 *
 * La evolución del rodeo (`productivo.stock_ciclos` + `calcularLineaTiempo`) es la PROYECCIÓN por default. Cuando el servicio de un ciclo YA
 * OCURRIÓ, los vientres que entraron a servicio son los del **stock de hacienda a esa fecha** (los movimientos, con la convención de signos
 * de MODULO_HACIENDA § 4.2 y § 5): **vacas = «Vaca»**, **vaquillonas = «Vaquillona de Reposición»**. Las CUT / Descarte no entran a servicio.
 * Lo cargado a mano en el ciclo sigue mandando. Los ciclos futuros proyectan desde ese real.
 *
 * Sólo se usa el stock si los movimientos ya existían a esa fecha (empiezan el 30/06/2025): antes no hay de dónde sacar lo real.
 * Pura salvo `cargarAperturasReales`, que lee la base.
 */
import { fechaServicio, type CicloStock, type CicloCalculado } from "./ciclo"

export interface MovHacienda { fecha: string; categoria: string; tipo: string; cantidad: number }

export interface AperturaReal {
  vacas: number
  vaquillonas: number
  /** La fecha del servicio a la que se tomó el stock. */
  fecha: string
  fuente: string
}

const norm = (s: string) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

/** El stock por categoría a una fecha (inclusive). Venta y mortandad restan; ajuste y cambio de categoría van con su signo. */
export function stockHaciendaAl(movs: MovHacienda[], fecha: string): Record<string, number> {
  const s: Record<string, number> = {}
  for (const m of movs) {
    if (m.fecha > fecha) continue
    const t = String(m.tipo)
    const q = t === "venta" || t === "mortandad" ? -Math.abs(Number(m.cantidad) || 0) : Number(m.cantidad) || 0
    s[m.categoria] = (s[m.categoria] ?? 0) + q
  }
  return s
}

/** Los vientres a servicio según el stock: Vaca y Vaquillona de Reposición (las CUT no). */
export function vientresDelStock(stock: Record<string, number>): { vacas: number; vaquillonas: number } {
  let vacas = 0, vaquillonas = 0
  for (const [cat, n] of Object.entries(stock)) {
    const c = norm(cat)
    if (c === "vaca") vacas += n
    else if (c === "vaquillona de reposicion") vaquillonas += n
  }
  return { vacas, vaquillonas }
}

/** Para cada ciclo con el servicio ya ocurrido (y movimientos a esa fecha), la apertura real. */
export function aperturasReales(ciclos: Pick<CicloStock, "campania" | "fecha_servicio">[], movs: MovHacienda[], hoy: string): Record<string, AperturaReal> {
  const out: Record<string, AperturaReal> = {}
  const primera = movs.reduce<string | null>((a, m) => (a == null || m.fecha < a ? m.fecha : a), null)
  if (!primera) return out
  for (const c of ciclos) {
    const f = fechaServicio(c as any)
    if (!f || f > hoy || f < primera) continue
    const v = vientresDelStock(stockHaciendaAl(movs, f))
    out[String(c.campania)] = { ...v, fecha: f, fuente: `stock de hacienda al ${f.split("-").reverse().join("/")}` }
  }
  return out
}

/** Lee los movimientos de hacienda (con el nombre de su categoría) y arma las aperturas reales de los ciclos. */
export async function cargarAperturasReales(sb: any, ciclos: Pick<CicloStock, "campania" | "fecha_servicio">[], hoy: string): Promise<Record<string, AperturaReal>> {
  const P = sb.schema("productivo")
  const [{ data: movs }, { data: cats }] = await Promise.all([
    P.from("movimientos_hacienda").select("fecha, categoria_id, tipo, cantidad"),
    P.from("categorias_hacienda").select("id, nombre"),
  ])
  const nombre = new Map(((cats || []) as any[]).map(c => [String(c.id), String(c.nombre)]))
  const lista: MovHacienda[] = ((movs || []) as any[]).map(m => ({ fecha: String(m.fecha), categoria: nombre.get(String(m.categoria_id)) ?? "?", tipo: String(m.tipo), cantidad: Number(m.cantidad) || 0 }))
  return aperturasReales(ciclos, lista, hoy)
}

// ── 🐄 A-FEAT-1672 paso 3 — Control: los LOTES DE VENTA del presupuesto contra el STOCK REAL de hacienda ────────────────────────────────
// JMS 27/11: «eso hay que cambiarlo, pero eventualmente puede mostrar el sistema la necesidad de rever cantidades por incongruencias;
// entonces yo ajusto desde presupuesto o desde la venta concreta». Avisa, no cambia nada solo: un plan puede diferir a propósito.

/** Categorías que son RODEO de cría (no se comparan contra lotes de venta). */
const DEL_RODEO = new Set(["vaca", "vaquillona de reposicion", "vaquillona prenada", "toro"])

export interface FilaControlLotes { categoria: string; presupuesto: number; stock: number; dif: number; lotes: string[] }

/**
 * Por categoría: las cabezas de los lotes del presupuesto que YA EXISTEN (stock inicial, ya disponibles o ya nacidos; menos lo vendido)
 * contra el stock de hacienda de hoy. Devuelve sólo las categorías con diferencia (stock − presupuesto).
 */
export function controlLotesVsStock(
  lotes: { id: string; categoria: string; cantidad: number; origen: string; fecha_disponible: string; fecha_nacimiento?: string | null }[],
  vendidas: (loteId: string) => number,
  stock: Record<string, number>,
  hoy: string,
): FilaControlLotes[] {
  const filas = new Map<string, FilaControlLotes>()
  const fila = (cat: string) => {
    const k = norm(cat)
    if (!filas.has(k)) filas.set(k, { categoria: cat, presupuesto: 0, stock: 0, dif: 0, lotes: [] })
    return filas.get(k)!
  }
  for (const l of lotes) {
    const existe = l.origen === "stock_inicial" || l.fecha_disponible <= hoy || (!!l.fecha_nacimiento && l.fecha_nacimiento <= hoy)
    if (!existe || DEL_RODEO.has(norm(l.categoria))) continue
    const n = Math.max(0, (Number(l.cantidad) || 0) - vendidas(l.id))
    if (n <= 0.001) continue
    const f = fila(l.categoria); f.presupuesto += n; f.lotes.push(`${l.categoria} ${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })}`)
  }
  for (const [cat, n] of Object.entries(stock)) {
    if (DEL_RODEO.has(norm(cat)) || Math.abs(n) < 0.001) continue
    fila(cat).stock += n
  }
  const out: FilaControlLotes[] = []
  for (const f of filas.values()) { f.dif = Math.round((f.stock - f.presupuesto) * 10) / 10; if (Math.abs(f.dif) > 0.01) out.push(f) }
  return out.sort((a, b) => a.categoria.localeCompare(b.categoria))
}

/** El stock de hacienda de hoy, por categoría (lee la base). */
export async function cargarStockHaciendaHoy(sb: any, hoy: string): Promise<Record<string, number>> {
  const P = sb.schema("productivo")
  const [{ data: movs }, { data: cats }] = await Promise.all([
    P.from("movimientos_hacienda").select("fecha, categoria_id, tipo, cantidad"),
    P.from("categorias_hacienda").select("id, nombre"),
  ])
  const nombre = new Map(((cats || []) as any[]).map(c => [String(c.id), String(c.nombre)]))
  return stockHaciendaAl(((movs || []) as any[]).map(m => ({ fecha: String(m.fecha), categoria: nombre.get(String(m.categoria_id)) ?? "?", tipo: String(m.tipo), cantidad: Number(m.cantidad) || 0 })), hoy)
}

// ── 🐄 A-FEAT-1677 M4 — los lotes que NACEN de un ciclo siguen al ciclo ──────────────────────────────────────────────────────────────────
// JMS 27/11: «M4 sí». Un lote generado desde un ciclo (destete: terneros / terneras a venta; descarte) guarda su cantidad, y el ciclo cambia
// (el rodeo real, la preñez, la reposición). Si la cantidad del lote es la que calculó el ciclo (`cantidad_calculada`), manda el ciclo de HOY;
// si JMS la cambió a mano, manda la suya.

export function cantidadSegunCiclo(
  l: { ciclo_id?: string | null; origen?: string | null; categoria: string; cantidad: number | string; cantidad_calculada?: number | string | null },
  linea: CicloCalculado[],
): { cantidad: number; delCiclo: number | null; aMano: boolean } {
  const actual = Number(l.cantidad) || 0
  if (!l.ciclo_id || (l.origen !== "destete" && l.origen !== "descarte")) return { cantidad: actual, delCiclo: null, aMano: false }
  const c = linea.find(x => String((x.ciclo as any).id) === String(l.ciclo_id))
  if (!c) return { cantidad: actual, delCiclo: null, aMano: false }
  const delCiclo = l.origen === "descarte" ? c.descarte : /hembra|ternera/i.test(l.categoria) ? c.terneras_venta : c.terneros_venta
  const aMano = l.cantidad_calculada != null && Math.abs(actual - Number(l.cantidad_calculada)) > 0.01
  return { cantidad: aMano ? actual : Math.round(delCiclo * 100) / 100, delCiclo, aMano }
}
