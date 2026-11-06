/**
 * 🛑 **«No va más» desde el Cash Flow** — A-FEAT-1572.
 *
 * JMS 05/11 (nota 🌙 sobre ACA PAM): *«acá PAM no debería llegar más… me lo encuentro desde Cash Flow, que es muy común
 * ahí encontrarse con el trabajo»*. Forma aprobada el 06/11: se elige el ALCANCE —**sólo esta cuota** o **esta y las
 * siguientes**—; las cuotas elegidas pasan a **«desactivado»** (no se borran ni van a cero: queda el historial) y, con
 * «esta y las siguientes», el **template se desactiva** para que «Renovar campaña» no lo vuelva a crear. Lo pagado no
 * se toca.
 *
 * ## Qué cuotas se tocan
 * Sólo las **pendientes**. Una cuota en «pagar» (ya en un lote), pagada, conciliada, en débito o crédito es plata que se
 * movió o se está moviendo: se lista como «no se toca» y queda como está.
 *
 * ## ⚠️ Desactivar el template esconde TODAS sus cuotas abiertas
 * El Cash Flow sólo muestra cuotas de templates activos. Si quedan cuotas ANTERIORES todavía abiertas (pendiente, pagar,
 * pagado sin conciliar), desactivar el template las sacaría del Cash Flow aunque no se eligieron. Por eso: si hay
 * anteriores abiertas, desactivar el template **no viene tildado** y se avisa cuáles son.
 *
 * Pura; caso en `npm run probar`.
 */

export type AlcanceNoVaMas = 'esta' | 'siguientes'

export interface CuotaNoVaMas { id: string; fecha_estimada: string; estado: string; monto?: number | null }

/** Estados que siguen a la vista en el Cash Flow (los demás ya no cuentan ahí). */
const OCULTOS_EN_CASH_FLOW = new Set(['conciliado', 'desactivado', 'credito', 'anterior'])

export interface PlanNoVaMas {
  /** Las cuotas que pasan a «desactivado». */
  desactivar: CuotaNoVaMas[]
  /** Del alcance, las que no se tocan (pagar, pagado, conciliado…). */
  noSeTocan: CuotaNoVaMas[]
  /** Cuotas anteriores al alcance que siguen abiertas en el Cash Flow. */
  anterioresAbiertas: CuotaNoVaMas[]
  /** Si se propone desactivar el template (sólo con «esta y las siguientes» y sin anteriores abiertas). */
  desactivarTemplate: boolean
}

export function planNoVaMas(cuotas: CuotaNoVaMas[], cuotaId: string, alcance: AlcanceNoVaMas): PlanNoVaMas {
  const esta = cuotas.find(c => c.id === cuotaId)
  if (!esta) return { desactivar: [], noSeTocan: [], anterioresAbiertas: [], desactivarTemplate: false }
  const orden = (a: CuotaNoVaMas, b: CuotaNoVaMas) => a.fecha_estimada.localeCompare(b.fecha_estimada)
  const enAlcance = alcance === 'esta'
    ? [esta]
    : cuotas.filter(c => c.fecha_estimada >= esta.fecha_estimada && c.estado !== 'desactivado').sort(orden)
  const desactivar = enAlcance.filter(c => c.estado === 'pendiente')
  const noSeTocan = enAlcance.filter(c => c.estado !== 'pendiente')
  const anterioresAbiertas = alcance === 'siguientes'
    ? cuotas.filter(c => c.fecha_estimada < esta.fecha_estimada && !OCULTOS_EN_CASH_FLOW.has(c.estado)).sort(orden)
    : []
  return { desactivar, noSeTocan, anterioresAbiertas, desactivarTemplate: alcance === 'siguientes' && anterioresAbiertas.length === 0 }
}

/** La huella en las observaciones del template: cuándo, qué alcance y por qué. Se agrega, no pisa lo que había. */
export function notaNoVaMas(previa: string | null, fecha: string, alcance: AlcanceNoVaMas, n: number, motivo: string): string {
  const linea = `[🛑 No va más ${fecha.split('-').reverse().join('/')}: ${alcance === 'esta' ? 'sólo una cuota' : 'desde esta cuota'} · ${n} cuota${n === 1 ? '' : 's'} desactivada${n === 1 ? '' : 's'}${motivo.trim() ? ' · ' + motivo.trim() : ''}]`
  return previa && previa.trim() ? `${previa.trim()} ${linea}` : linea
}
