/**
 * 💰 **El bruto de un período de sueldo** — UNA sola fórmula para todos los caminos (A-FEAT-1259, 2026-10-09).
 *
 * Vivía adentro de `tab-sueldos.tsx` (el modal ✏️). La planilla de asistencia también tiene que recalcular el
 * bruto cuando pasa los francos al sueldo, y una segunda copia de la fórmula es exactamente cómo dos pantallas
 * terminan dando sueldos distintos (§ CLAUDE.md — Centralizar, no duplicar). Las dos llaman a esto.
 *
 * ```
 * extras = varios + vacaciones + premio + aguinaldo A + aguinaldo B
 * ab_francos:    (A + B) + valor_franco × francos + extras
 * por_dia:       valor_dia × días + extras
 * por_hora_ipc:  valor_hora × horas + extras
 * plano_ipc:     A + extras
 * ```
 * Devuelve `null` con un tipo desconocido: que decida el que llama (el modal conserva el bruto anterior).
 */
import { valorFrancoDeTotal } from "@/lib/sueldos/reparto-ab"

export function brutoSegunTipo(tipo: string | undefined, a: number, b: number, francos: number, valorFranco: number,
                               vdia: number, dias: number, vhora: number, horas: number, varios: number,
                               vacaciones = 0, premio = 0, aguinaldoA = 0, aguinaldoB = 0): number | null {
  const extras = varios + vacaciones + premio + aguinaldoA + aguinaldoB
  switch (tipo) {
    case "ab_francos":   return (a + b) + (valorFranco * francos) + extras
    case "por_dia":      return vdia * dias + extras
    case "por_hora_ipc": return vhora * horas + extras
    case "plano_ipc":    return a + extras
    default:             return null
  }
}

/** Los parámetros de un período tal como están en la base. */
export interface ParamsPeriodo {
  monto_a: number | null; monto_b: number | null; francos_cantidad: number | null; valor_franco: number | null
  valor_por_dia: number | null; dias_trabajados: number | null; valor_por_hora: number | null; horas_mes: number | null
  varios: number | null; vacaciones: number | null; premio: number | null; aguinaldo_a: number | null; aguinaldo_b: number | null
}

/**
 * El bruto de un período guardado, con algún parámetro cambiado (`cambios`). El valor franco vacío es
 * «automático» = (A + B) / 25, igual que en el modal ✏️.
 */
export function brutoDelPeriodo(tipo: string | undefined, p: ParamsPeriodo, cambios: Partial<ParamsPeriodo> = {}): number | null {
  const q = { ...p, ...cambios }
  const n = (v: number | string | null | undefined) => Number(v) || 0
  const a = n(q.monto_a), b = n(q.monto_b)
  const vf = q.valor_franco != null ? n(q.valor_franco) : valorFrancoDeTotal(a + b)
  return brutoSegunTipo(tipo, a, b, n(q.francos_cantidad), vf, n(q.valor_por_dia), n(q.dias_trabajados),
    n(q.valor_por_hora), n(q.horas_mes), n(q.varios), n(q.vacaciones), n(q.premio), n(q.aguinaldo_a), n(q.aguinaldo_b))
}
