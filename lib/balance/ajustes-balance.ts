/**
 * ✍️ **AJUSTES DEL BALANCE — A-FEAT-1207, versión chica: los SALDOS DEL EJERCICIO ANTERIOR** (2026-10-18).
 *
 * El esquema, definido por el usuario ese día:
 * 1. **Default**: un pago es gasto del ejercicio en que se pagó (es lo que ya hace la app).
 * 2. **El usuario dispone**: de un pago puede decir cuánto pasa al ejercicio siguiente.
 * 3. **El balance siguiente lo toma solo**, en un renglón aparte: «saldo del ejercicio anterior».
 *
 * Para el pasado —el 24/25 no se arma en la app— alcanza con lo que dijo él: *«podríamos sólo dejar el
 * saldo que dejó el anterior balance y punto»*. Ej.: del inmobiliario 2025 pagado anual en abril, el
 * balance 24/25 tomó la mitad; la otra mitad ($3.154.059,75) es gasto del 25/26.
 *
 * Viven en `public.ajustes_balance` (accion = `saldo_anterior`), por empresa y año de cierre. Un ajuste no
 * se borra: se **anula** con motivo, y queda la historia. Esta parte es pura: suma y arma la solapa.
 */

export interface AjusteBalance {
  id: string
  empresa: string
  anio_cierre: number
  accion: string
  concepto: string
  categ: string | null
  monto: number | string
  motivo: string
  origen_anio_cierre: number | null
  created_at: string
  anulado_at: string | null
  anulado_motivo?: string | null
}

export interface SaldosAnteriores {
  /** Los vigentes: son gasto de ESTE ejercicio. */
  vigentes: AjusteBalance[]
  total: number
  /** Los anulados: no suman, pero se muestran con su motivo (nada se descarta en silencio). */
  anulados: AjusteBalance[]
  /** Por cuenta, para ubicarlo junto al resto del gasto. */
  porCuenta: { categ: string; total: number }[]
}

const num = (v: number | string) => (typeof v === "string" ? parseFloat(v) : v) || 0
const r2 = (x: number) => Math.round(x * 100) / 100

/** Los saldos del ejercicio anterior que toma `anioCierre`, de la empresa. */
export function saldosDelEjercicioAnterior(ajustes: AjusteBalance[], empresa: string, anioCierre: number): SaldosAnteriores {
  const delEj = ajustes.filter(a => a.empresa === empresa && a.anio_cierre === anioCierre && a.accion === "saldo_anterior")
  const vigentes = delEj.filter(a => !a.anulado_at)
  const anulados = delEj.filter(a => !!a.anulado_at)
  const porCuenta = new Map<string, number>()
  for (const a of vigentes) {
    const c = a.categ || "(sin cuenta)"
    porCuenta.set(c, (porCuenta.get(c) ?? 0) + num(a.monto))
  }
  return {
    vigentes, anulados,
    total: r2(vigentes.reduce((s, a) => s + num(a.monto), 0)),
    porCuenta: [...porCuenta.entries()].map(([categ, total]) => ({ categ, total: r2(total) }))
      .sort((a, b) => b.total - a.total),
  }
}

const dmy = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "")

/** La solapa del export: los vigentes con su total, el resumen por cuenta y los anulados aparte. */
export function hojaDeSaldosAnteriores(s: SaldosAnteriores, etiqueta: string): unknown[][] {
  const f: unknown[][] = [
    [`SALDOS DEL EJERCICIO ANTERIOR — gasto del ejercicio ${etiqueta}`],
    ["Lo que el balance anterior dejo para tomar en este ejercicio (ej. la parte de un pago anual que vence"],
    ["despues del cierre anterior). Lo anota el usuario en la app; es gasto de ESTE ejercicio, aparte de las cuotas."],
    [],
    ["Concepto", "Cuenta", "Importe", "Viene del balance", "Motivo", "Anotado"],
  ]
  for (const a of s.vigentes) {
    f.push([a.concepto, a.categ || "", r2(num(a.monto)), a.origen_anio_cierre ?? "", a.motivo, dmy(a.created_at)])
  }
  f.push(["TOTAL", "", s.total])
  if (s.porCuenta.length > 1) {
    f.push([])
    f.push(["Por cuenta"])
    for (const c of s.porCuenta) f.push(["", c.categ, c.total])
  }
  if (s.anulados.length > 0) {
    f.push([])
    f.push([`ANULADOS (no suman): ${s.anulados.length}`])
    for (const a of s.anulados) {
      f.push([a.concepto, a.categ || "", r2(num(a.monto)), a.origen_anio_cierre ?? "", `anulado: ${a.anulado_motivo || ""}`, dmy(a.anulado_at)])
    }
  }
  return f
}
