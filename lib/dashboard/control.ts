/**
 * 🧮 EL CONTROL DEL DASHBOARD — A-FEAT-1637 (§ 🧮 de CLAUDE.md: todo desarrollo termina con su control, y se ve).
 *
 * La identidad: **el total de la tabla (ingresos + egresos + financieros + distribuciones del período) = la suma de
 * créditos − débitos de los movimientos leídos.** Es el mismo número por dos caminos: uno pasa por la clasificación, el otro no.
 * Si no cierra, la diferencia es exactamente lo que la clasificación dejó afuera (cuenta con tipo «NO» o vacío) — y se lista.
 *
 * Y por canal: cuántos movimientos con categoría, su neto, y cuántos del período NO tienen categoría (esos no entran en el
 * Dashboard por diseño, pero se cuentan a la vista para que nada se descarte en silencio).
 */
import type { ResumenFinanciero } from "./resumen"

export interface CanalLeido {
  nombre: string
  empresa: string
  /** Los movimientos con categoría del período (los que entran a la tabla). */
  movimientos: Array<{ creditos?: number | null; debitos?: number | null }>
  /** Cuántos movimientos del período no tienen categoría (no entran). `null` = no se pudo contar. */
  sinCateg: number | null
  /** La lectura no trajo todo, o falló: el número de ese canal no es confiable. */
  incompleta?: boolean
}

export interface FilaControlCanal {
  nombre: string
  empresa: string
  movimientos: number
  neto: number
  sinCateg: number | null
  incompleta: boolean
}

export interface ControlDashboard {
  canales: FilaControlCanal[]
  /** Ingresos + egresos + financieros + distribuciones del período, según la tabla. */
  totalTabla: number
  /** Créditos − débitos de todos los movimientos leídos. */
  totalMovimientos: number
  diferencia: number
  cierra: boolean
  sinCategTotal: number
  /** Algún canal no se leyó entero: el control cierra sobre lo leído, pero puede faltar algo. */
  algunaIncompleta: boolean
  /** Neto de lo que la clasificación dejó afuera (tipo «NO» o vacío). */
  fueraTotal: number
  /** ¿La diferencia es EXACTAMENTE lo que quedó afuera? (tabla + afuera = movimientos). Si no, hay un error de la app. */
  explicada: boolean
}

const r2 = (n: number) => Math.round(n * 100) / 100
/** Medio centavo: la suma de miles de importes con decimales arrastra error de coma flotante, no de datos. */
export const TOLERANCIA_DASHBOARD = 0.005

/** `fuera` = los importes (créditos − débitos) de los movimientos que la clasificación no puso en ninguna sección. */
export function controlDelDashboard(resumen: ResumenFinanciero[], canales: CanalLeido[], fuera: number[] = []): ControlDashboard {
  const filas = canales.map(c => ({
    nombre: c.nombre,
    empresa: c.empresa,
    movimientos: c.movimientos.length,
    neto: r2(c.movimientos.reduce((t, m) => t + (Number(m.creditos) || 0) - (Number(m.debitos) || 0), 0)),
    sinCateg: c.sinCateg,
    incompleta: !!c.incompleta,
  }))
  const totalTabla = r2(resumen.reduce((t, m) => t + m.totalIngresos + m.totalEgresos + m.totalFinancieros + m.totalDistribuciones, 0))
  const totalMovimientos = r2(filas.reduce((t, f) => t + f.neto, 0))
  const diferencia = r2(totalTabla - totalMovimientos)
  const fueraTotal = r2(fuera.reduce((t, n) => t + n, 0))
  return {
    canales: filas,
    totalTabla,
    totalMovimientos,
    diferencia,
    cierra: Math.abs(diferencia) < TOLERANCIA_DASHBOARD,
    sinCategTotal: filas.reduce((t, f) => t + (f.sinCateg ?? 0), 0),
    algunaIncompleta: filas.some(f => f.incompleta),
    fueraTotal,
    explicada: Math.abs(diferencia + fueraTotal) < TOLERANCIA_DASHBOARD,
  }
}
