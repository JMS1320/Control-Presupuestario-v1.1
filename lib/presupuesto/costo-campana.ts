/**
 * 🌾 **A-FEAT-1663 — el costo de producción del PRESUPUESTO (caja), campaña por campaña: RECETA por defecto, PLAN DEL AÑO encima.**
 *
 * Estructura acordada con JMS el 25/11/2026:
 *   · La **receta** (`productivo.actividad_insumos`) es el default de todos los años, y tiene que calcular bien: un renglón «por
 *     cabeza» multiplica por las cabezas reales de SU base (rodeo, vacas, toros, terneros…), las de la línea de tiempo del rodeo
 *     de esa campaña — no las del lote que tenga un tramo cargado.
 *   · El **plan productivo del año** (`presupuesto_variables` con `receta_insumo_id` / `actividad_id`) reemplaza **renglón por
 *     renglón** en su campaña: si el plan trae el renglón, manda el plan; si no, la receta; «0» lo apaga; los renglones propios
 *     del plan se suman.
 *   · Es CAJA: no se amortiza (la pastura se paga el año que se implanta). El MARGEN —que sí amortiza— no se toca.
 *
 * Usa la MISMA función que el Margen (`resolverCostoDirecto`) para que los dos lean la receta igual. Los renglones de RACIÓN
 * (`pct_racion`, `kg_cabeza_dia`…) los sigue calculando la grilla con los tramos y la curva de peso (el Margen no los resuelve: M-04).
 * Sin base de datos: se prueba con números.
 */
import { resolverCostoDirecto, claveMes, type ContextoCosto, type InsumoActividadMargen, type MesPeriodo } from './margen'

/** Modos que necesitan la curva de peso y los tramos: siguen por `consumoMensual`. */
const MODOS_RACION = new Set(['pct_racion', 'kg_cabeza_dia', 'unid_cabeza_mes', 'unid_cabeza_evento', 'dosis_cada_kg', 'pct_produccion'])
export const esModoRacion = (modo: string | null | undefined) => MODOS_RACION.has(String(modo || ''))

/** `"26/27"` → los 12 meses jul-26 … jun-27. */
export function mesesDeCampana(campana: string): MesPeriodo[] {
  const m = campana.match(/^(\d{2})\/(\d{2})$/)
  const anio = m ? 2000 + parseInt(m[1], 10) : 2000
  return Array.from({ length: 12 }, (_, k) => ({ anio: anio + (6 + k >= 12 ? 1 : 0), mes: ((6 + k) % 12) + 1 }))
}
/** `"2026-11"` → `"26/27"`. */
export function campanaDeMes(clave: string): string {
  const [a, m] = clave.split('-').map(Number)
  const ini = m >= 7 ? a : a - 1
  return `${String(ini % 100).padStart(2, '0')}/${String((ini + 1) % 100).padStart(2, '0')}`
}
/** El mes de la campaña que corresponde a un número de mes (1–12). */
export function mesEnCampana(campana: string, mes: number): string {
  const p = mesesDeCampana(campana).find(x => x.mes === mes)!
  return claveMes(p.anio, p.mes)
}

/** TC por mes con arrastre hacia adelante (como el Margen): un mes sin TC hereda el último cargado. */
export function tcPorMesConArrastre(tcs: { anio: number; mes: number; valor: number | null }[], claves: string[]): Record<string, number> {
  const base: Record<string, number> = {}
  for (const t of tcs.slice().sort((a, b) => (a.anio * 12 + a.mes) - (b.anio * 12 + b.mes))) if (t.valor) base[claveMes(t.anio, t.mes)] = t.valor
  const out: Record<string, number> = { ...base }
  let arrastre: number | null = null
  const todas = Array.from(new Set([...Object.keys(base), ...claves])).sort()
  for (const k of todas) { if (base[k] != null) arrastre = base[k]; else if (arrastre != null) out[k] = arrastre }
  return out
}

export interface CostoRenglon {
  porMes: Record<string, number>
  /** Cómo se calculó, para mostrar en la celda (cabezas, precio, TC, días…). */
  explicacion: string
  /** Si no se pudo calcular: por qué (falta el TC, las cabezas…). */
  falta?: string
}

/**
 * La RECETA de un renglón en una campaña, en caja: el costo del año (sin amortizar) repartido en sus meses.
 * Reparto: los meses del renglón (`meses_pct`) si los tiene; si no, por su «cuándo»: al empezar = julio, al terminar = junio,
 * en el ciclo = parejo en los 12. Los meses anteriores a `desdeMes` (ya pasados) no se presupuestan.
 */
export function costoRecetaCampana(fila: InsumoActividadMargen & { momento?: string | null }, ctx: ContextoCosto, campana: string, desdeMes: string): CostoRenglon {
  const caja = { ...fila, amortiza_anios: null }   // caja: la pastura se paga entera el año que se hace
  const meses = mesesDeCampana(campana)
  const r = resolverCostoDirecto(caja, { ...ctx, meses, tc: ctx.tc ?? ctx.tcPorMes?.[claveMes(meses[0].anio, meses[0].mes)] ?? null })
  const porMes: Record<string, number> = {}
  if (r.monto == null) return { porMes, explicacion: r.motivo, falta: r.motivo }
  if (r.porMes) {
    for (const [k, v] of Object.entries(r.porMes)) if (k >= desdeMes && v) porMes[k] = (porMes[k] || 0) + v
    return { porMes, explicacion: r.motivo }
  }
  const pct = (fila as any).meses_pct as Record<string, number> | null | undefined
  let reparto: { clave: string; pct: number }[]
  if (pct && Object.keys(pct).length) reparto = Object.entries(pct).map(([m, p]) => ({ clave: mesEnCampana(campana, Number(m)), pct: Number(p) / 100 }))
  else if (fila.momento === 'inicio') reparto = [{ clave: claveMes(meses[0].anio, meses[0].mes), pct: 1 }]
  else if (fila.momento === 'fin') reparto = [{ clave: claveMes(meses[11].anio, meses[11].mes), pct: 1 }]
  else reparto = meses.map(m => ({ clave: claveMes(m.anio, m.mes), pct: 1 / 12 }))
  for (const x of reparto) if (x.clave >= desdeMes) porMes[x.clave] = (porMes[x.clave] || 0) + r.monto * x.pct
  return { porMes, explicacion: r.motivo }
}

/** Un renglón del PLAN DEL AÑO: cantidad × precio (en US$ × el TC de cada mes), repartido parejo en sus meses. */
export interface RenglonPlan {
  id: string
  receta_insumo_id: string | null
  actividad_id: string | null
  concepto: string
  campana: string
  cantidad: number | null
  unidad: string | null
  precio: number | null
  moneda: 'ARS' | 'USD' | string | null
  /** Números de mes (1–12) en que se paga. Vacío = los 12. */
  meses: number[] | null
}
export function costoPlanCampana(p: RenglonPlan, tcPorMes: Record<string, number>, desdeMes: string): CostoRenglon {
  const porMes: Record<string, number> = {}
  const cant = Number(p.cantidad) || 0, precio = Number(p.precio) || 0
  const meses = (p.meses && p.meses.length ? p.meses : [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]).map(m => mesEnCampana(p.campana, m))
  const usd = String(p.moneda || '').toUpperCase() === 'USD'
  let falta: string | undefined
  for (const k of meses) {
    const tc = usd ? tcPorMes[k] : 1
    if (usd && !tc) { falta = 'falta el tipo de cambio'; continue }
    if (k >= desdeMes && cant * precio) porMes[k] = (porMes[k] || 0) + (cant * precio * tc) / meses.length
  }
  const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  const explicacion = cant === 0
    ? `Plan ${p.campana}: este año no se gasta (0)`
    : `Plan ${p.campana}: ${fmt(cant)} ${p.unidad || ''} × ${usd ? 'US$' : '$'} ${fmt(precio)}${usd ? ' × TC del mes' : ''} · en ${meses.length === 12 ? 'los 12 meses' : meses.map(k => k.slice(5)).join(', ')}`
  return { porMes, explicacion, falta }
}

/**
 * La regla del plan sobre la receta, en una campaña: si hay plan para el renglón manda el plan («0» lo apaga); si no, la receta.
 */
export function elegirPlanOReceta(plan: RenglonPlan | undefined, receta: () => CostoRenglon, tcPorMes: Record<string, number>, desdeMes: string):
  CostoRenglon & { origen: 'plan' | 'receta' } {
  if (plan) return { ...costoPlanCampana(plan, tcPorMes, desdeMes), origen: 'plan' }
  return { ...receta(), origen: 'receta' }
}
