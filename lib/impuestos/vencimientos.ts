/**
 * 🧾 Impuestos vencidos sin pagar o próximos a vencer — A-FEAT-1319.
 *
 * Los impuestos no tienen factura: viven como **cuotas de templates**. Todo lo que decide este aviso
 * ya estaba cargado, y se usa tal cual (§ 🎚️ default del dato real):
 *
 * | Pregunta | Dato |
 * |---|---|
 * | ¿es un impuesto? | `cuenta_agrupadora` del template empieza con «Impuestos» (General, Rurales, Urbanos, Automotores, Buenos Aires MA) |
 * | ¿con cuánta anticipación aviso? | la columna `alertas` del template («10 dias antes», «30 dias antes») — vacía = 10 días |
 * | ¿cuándo vence? | `fecha_vencimiento` de la cuota; si falta, la estimada |
 * | ¿está sin pagar? | estado `pendiente` o `pagar`. `debito` se da por pagado (débito automático), como en el Cash Flow |
 *
 * Los templates sólo de conciliación (`solo_conciliacion`: IIBB bancario, sellos…) no se avisan: se
 * cobran solos en el banco y no hay nada que pagar.
 */

export const DIAS_AVISO_POR_DEFECTO = 10
export const ESTADOS_SIN_PAGAR = ["pendiente", "pagar"] as const

export interface CuotaImpuesto {
  id: string
  estado: string
  fecha_vencimiento: string | null
  fecha_estimada: string | null
  monto: number | null
  numero_cuota?: number | null
  template: {
    nombre_referencia: string | null
    responsable: string | null
    cuenta_agrupadora: string | null
    categ: string | null
    alertas: string | null
    solo_conciliacion?: boolean | null
  }
}

export interface ImpuestoAvisado {
  id: string
  impuesto: string
  categ: string | null
  empresa: string
  vencimiento: string
  dias: number // negativo = vencido hace N días
  monto: number
  estado: string
  numero_cuota: number | null
  diasAviso: number
}

/** «30 dias antes» → 30 · vacío o ilegible → 10. */
export function diasDeAviso(alertas: string | null | undefined): number {
  const m = String(alertas ?? "").match(/(\d+)/)
  const n = m ? parseInt(m[1], 10) : NaN
  return Number.isFinite(n) && n >= 0 ? n : DIAS_AVISO_POR_DEFECTO
}

export function esImpuesto(t: Pick<CuotaImpuesto["template"], "cuenta_agrupadora" | "solo_conciliacion">): boolean {
  return /^\s*impuestos?\b/i.test(t.cuenta_agrupadora ?? "") && !t.solo_conciliacion
}

const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000)

/**
 * Pura: de las cuotas, los impuestos vencidos sin pagar y los que vencen dentro de su anticipación.
 * `hoy` es un día argentino (`hoyArgentina()`), nunca `new Date().toISOString()` (§ 🕐).
 */
export function impuestosAAvisar(cuotas: CuotaImpuesto[], hoy: string) {
  const vencidos: ImpuestoAvisado[] = []
  const proximos: ImpuestoAvisado[] = []
  for (const c of cuotas) {
    if (!esImpuesto(c.template)) continue
    if (!(ESTADOS_SIN_PAGAR as readonly string[]).includes(c.estado)) continue
    const venc = c.fecha_vencimiento ?? c.fecha_estimada
    if (!venc) continue
    const dias = diasEntre(hoy, venc.slice(0, 10))
    const diasAviso = diasDeAviso(c.template.alertas)
    const item: ImpuestoAvisado = {
      id: c.id, impuesto: c.template.nombre_referencia ?? c.template.categ ?? "Impuesto", categ: c.template.categ,
      empresa: c.template.responsable ?? "—", vencimiento: venc.slice(0, 10), dias, monto: Number(c.monto ?? 0),
      estado: c.estado, numero_cuota: c.numero_cuota ?? null, diasAviso,
    }
    if (dias < 0) vencidos.push(item)
    else if (dias <= diasAviso) proximos.push(item)
  }
  vencidos.sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))
  proximos.sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))
  const total = (xs: ImpuestoAvisado[]) => Math.round(xs.reduce((s, x) => s + x.monto, 0) * 100) / 100
  return { vencidos, proximos, totalVencidos: total(vencidos), totalProximos: total(proximos) }
}
