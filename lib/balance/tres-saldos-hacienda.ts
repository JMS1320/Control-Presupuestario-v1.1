/**
 * 🐄 LOS TRES SALDOS DE LA HACIENDA — A-FEAT-1386 (d), JMS 2026-10-29.
 *
 * *«Para las planillas de stock de Hacienda vamos a tener siempre tres tipos de saldos: el que surge del propio
 * sistema, los registrados en SENASA y los declarados en balance. Las diferencias suelen ser esas mortandades.»*
 *
 * | Saldo | De dónde sale |
 * |---|---|
 * | **Sistema** | la suma de los movimientos de hacienda de la app hasta la fecha (inicio = antes del 1er día) |
 * | **SENASA** | lo que dice SENASA; se escribe a mano (o lo pone Claude de un papel, TENTATIVO) |
 * | **Campo** | tu dato (planilla de campo, balance interno); a mano (o Claude, TENTATIVO) |
 * | **Balance** | lo declarado en el balance del contador (forma contable); a mano (o Claude, TENTATIVO) |
 *
 * ⚠️ cambió el mismo 29/10 — JMS: *«tenemos un dato del campo y un dato del balance… son dos datos que hay que
 * registrar los dos»*. Se agregó **Campo**; las diferencias se miden contra él (Campo − Balance = tratamiento contable).
 *
 * Se guardan en `balance_datos_usuario`, papel `hacienda.saldos`, clave `<momento>.<fuente>.<categoría>`
 * (ej. `inicio.senasa.vacas`). Las categorías son las de la planilla del usuario; las de la app se agrupan en ellas.
 * 🧮 Control: las diferencias contra el balance se muestran por categoría y en total (avisa, no frena: la causa
 * habitual es una mortandad sin registrar).
 */

export type MomentoSaldo = "inicio" | "cierre"
export type FuenteManual = "senasa" | "campo" | "balance"

export interface CategoriaPlanilla { clave: string; nombre: string; app: string[] }

/** Las categorías de la planilla «STOCK HACIENDA», con las de la app que caen en cada una. */
export const CATEGORIAS_PLANILLA: CategoriaPlanilla[] = [
  { clave: "vacas", nombre: "Vacas", app: ["Vaca"] },
  { clave: "vaq-1ra", nombre: "Vaquillonas para 1ª parición", app: ["Vaquillona Preñada"] },
  { clave: "cut", nombre: "CUT / descarte", app: ["Vaca CUT/Descarte"] },
  { clave: "toros", nombre: "Toros", app: ["Toro"] },
  { clave: "toritos", nombre: "Toritos 1 año", app: ["Torito"] },
  { clave: "vaquillonas", nombre: "Vaquillonas (reposición o venta)", app: ["Vaquillona de Reposicion", "Vaquillona Engorde", "Ternera Recria"] },
  { clave: "novillitos", nombre: "Novillitos / novillos", app: ["Novillito", "Novillo", "Ternero Recria"] },
  { clave: "terneros", nombre: "Terneros/as", app: ["Ternero al Pie", "Ternera al Pie", "Ternero", "Ternera"] },
]

export const claveSaldo = (momento: MomentoSaldo, fuente: FuenteManual, categoria: string) =>
  `${momento}.${fuente}.${categoria}`

export interface FilaTresSaldos {
  clave: string
  nombre: string
  sistema: number
  senasa: number | null
  campo: number | null
  balance: number | null
  /** sistema − campo */
  difSistema: number | null
  /** SENASA − campo */
  difSenasa: number | null
  /** campo − balance (tratamiento contable) */
  difBalance: number | null
}

export interface TresSaldos {
  filas: FilaTresSaldos[]
  total: FilaTresSaldos
  /** categorías de la app que no caen en ninguna de la planilla (no se pierden: se avisan) */
  sinUbicar: { categoria: string; cabezas: number }[]
}

const resta = (a: number | null, b: number | null) => a != null && b != null ? a - b : null
const difs = (sistema: number, senasa: number | null, campo: number | null, balance: number | null) =>
  ({ difSistema: resta(sistema, campo), difSenasa: resta(senasa, campo), difBalance: resta(campo, balance) })

const leer = (t: string | null | undefined): number | null => {
  if (t == null || String(t).trim() === "") return null
  const n = Number(String(t).replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}

/**
 * Arma la tabla de los tres saldos.
 * @param sistemaPorCategoria cabezas por categoría DE LA APP a ese momento
 * @param valores los textos guardados (clave → texto)
 */
export function armarTresSaldos(
  momento: MomentoSaldo,
  sistemaPorCategoria: Record<string, number>,
  valores: Record<string, string | undefined>,
): TresSaldos {
  const usadas = new Set<string>()
  const filas: FilaTresSaldos[] = CATEGORIAS_PLANILLA.map(c => {
    let sistema = 0
    for (const a of c.app) if (!usadas.has(a) && sistemaPorCategoria[a] != null) { sistema += sistemaPorCategoria[a]; usadas.add(a) }
    const senasa = leer(valores[claveSaldo(momento, "senasa", c.clave)])
    const campo = leer(valores[claveSaldo(momento, "campo", c.clave)])
    const balance = leer(valores[claveSaldo(momento, "balance", c.clave)])
    return { clave: c.clave, nombre: c.nombre, sistema, senasa, campo, balance, ...difs(sistema, senasa, campo, balance) }
  })
  const sinUbicar = Object.entries(sistemaPorCategoria)
    .filter(([cat, n]) => !usadas.has(cat) && n !== 0)
    .map(([categoria, cabezas]) => ({ categoria, cabezas }))
  const suma = (k: "sistema" | "senasa" | "campo" | "balance") => {
    const v = filas.map(f => f[k])
    return v.every(x => x == null) ? null : v.reduce<number>((s, x) => s + (x ?? 0), 0)
  }
  const sistema = (suma("sistema") ?? 0) + sinUbicar.reduce((s, x) => s + x.cabezas, 0)
  const senasa = suma("senasa"), campo = suma("campo"), balance = suma("balance")
  return {
    filas, sinUbicar,
    total: { clave: "total", nombre: "TOTAL", sistema, senasa, campo, balance, ...difs(sistema, senasa, campo, balance) },
  }
}

/** Cabezas por categoría de la app a un momento: inicio = antes de `primerDia`; cierre = hasta `fechaCierre`. */
export function sistemaAlMomento(
  movs: { fecha: string; cantidad: number; categoria: string }[],
  momento: MomentoSaldo, primerDia: string, fechaCierre: string,
): Record<string, number> {
  const r: Record<string, number> = {}
  for (const m of movs) {
    if (!m.categoria) continue
    if (momento === "inicio" ? m.fecha >= primerDia : m.fecha > fechaCierre) continue
    r[m.categoria] = (r[m.categoria] ?? 0) + m.cantidad
  }
  return r
}
