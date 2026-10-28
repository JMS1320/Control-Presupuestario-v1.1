/**
 * 📅 **¿Pasar UNA fila del Cash Flow a este estado pide la fecha de pago?** — A-BUG-1407.
 *
 * Nota 🌙 de JMS 2026-10-28: *«la pasé a pagado y no me pidió fecha de pago; creo que quedó sin
 * fecha»* (Zavala Ortiz, $720.000, pago en pesos). El cartel ya existía para el LOTE del Cash Flow
 * (A-FEAT-22) y para Templates (A-BUG-157), pero el cambio de estado de UNA fila no lo usaba.
 *
 * Pide la fecha cuando:
 * - el estado nuevo es de pago (`esEstadoQuePaga`: pagar, preparado, pagado, conciliado, débito),
 * - la fila NO tiene fecha de pago,
 * - es una factura o una cuota de template (los anticipos y los sueldos tienen su propia fecha), y
 * - tiene importe (una cuota en $0 no tiene fecha de pago que preguntar, A-FEAT-1357).
 *
 * ❌ Excepción a propósito: una factura de **PAM o MA** que pasa a «pagar» — esas empresas no tienen
 * SICORE y la fecha no se exige ahí (decisión del usuario, A-FEAT-13 paso 5). Al pasar a «pagado» sí
 * se pide: ahí la plata ya salió y la fecha es un dato real.
 */
import { esEstadoQuePaga, esSinImporte } from "@/lib/pagos/preguntar-fecha-pago"

export interface FilaParaFecha {
  origen: string
  estado?: string | null
  fecha_pago?: string | null
  debitos?: number | string | null
}

export function pideFechaPagoAlCambiarEstado(fila: FilaParaFecha, nuevoEstado: string, esMsa: boolean): boolean {
  if (!esEstadoQuePaga(nuevoEstado)) return false
  if (fila.fecha_pago) return false
  if (fila.origen !== "ARCA" && fila.origen !== "TEMPLATE") return false
  if (String(fila.estado ?? "").toLowerCase() === String(nuevoEstado).toLowerCase()) return false
  if (esSinImporte(fila.debitos)) return false
  if (fila.origen === "ARCA" && !esMsa && nuevoEstado === "pagar") return false
  return true
}
