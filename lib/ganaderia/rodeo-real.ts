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
import { fechaServicio, type CicloStock } from "./ciclo"

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
