/**
 * 💱 **NC esperada por diferencia de cambio** — A-FEAT-1255 (2026-10-05).
 *
 * Una factura en dólares pagada a un TC distinto del suyo deja una diferencia que el proveedor
 * documenta con una **NC** (pagaste a menos) o una **ND** (pagaste a más). El dato ya está —la factura
 * guarda su `tipo_cambio` y el `tc_pago`—, así que la app **la espera sola**: alerta ANTES (hasta que
 * llegue) y la reconoce DESPUÉS, al importarla de ARCA (§ 🔔 alertas antes, controles después).
 *
 *     esperada = total de la factura (USD) × (TC factura − TC pago)        en pesos, con IVA
 *     > 0 → NC  ·  < 0 → ND
 *
 * Caso testigo: Agro Centros FC 6447, USD 4.635,54 × (1.522 − 1.520) = **$9.271,08**.
 *
 * ⚠️ El costo de los insumos NO espera a la NC: ya está al TC del pago (trigger del script 79). Esto
 * cierra sólo el lado contable — subdiario e IVA.
 *
 * Pura: no lee la base.
 */

export interface FacturaPagadaUsd {
  id: string
  cuit: string
  proveedor: string
  numero: string
  fecha_pago: string | null
  imp_total: number
  tipo_cambio: number
  tc_pago: number
}

export interface ComprobanteAjuste {
  id: string
  cuit: string
  fecha: string
  numero: string
  /** 'NC' | 'ND' */
  clase: 'NC' | 'ND'
  /** El importe en pesos (si vino en dólares, × su TC). */
  importePesos: number
}

export interface Esperada {
  factura: FacturaPagadaUsd
  clase: 'NC' | 'ND'
  /** Siempre positivo, en pesos. */
  monto: number
  /** El comprobante que la cumple, si llegó. */
  recibida: ComprobanteAjuste | null
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Códigos AFIP de nota de crédito y de débito (A, B, C, M, y las de crédito electrónica). */
export const TIPOS_NC = new Set([3, 8, 13, 53, 203, 208, 213])
export const TIPOS_ND = new Set([2, 7, 12, 52, 202, 207, 212])

export function esperadaDe(f: FacturaPagadaUsd): Omit<Esperada, 'recibida'> | null {
  const delta = (Number(f.tipo_cambio) || 0) - (Number(f.tc_pago) || 0)
  if (!(Number(f.tc_pago) > 0) || Math.abs(delta) < 0.0001) return null
  return { factura: f, clase: delta > 0 ? 'NC' : 'ND', monto: r2(Math.abs((Number(f.imp_total) || 0) * delta)) }
}

/**
 * Empareja cada esperada con un comprobante del MISMO proveedor, de la misma clase, posterior al pago
 * (con 15 días de margen) y por un importe dentro de la tolerancia (2 % o $1). Cada comprobante sirve
 * a una sola esperada. No es definitivo: se muestra cuál matcheó para que el usuario lo vea.
 */
export function emparejar(
  facturas: FacturaPagadaUsd[],
  ajustes: ComprobanteAjuste[],
  tolerancia = 0.02,
): Esperada[] {
  const usados = new Set<string>()
  const out: Esperada[] = []
  for (const f of facturas) {
    const e = esperadaDe(f)
    if (!e) continue
    const desde = f.fecha_pago ? new Date(new Date(f.fecha_pago + 'T12:00:00').getTime() - 15 * 864e5).toISOString().slice(0, 10) : ''
    const tol = Math.max(1, e.monto * tolerancia)
    const match = ajustes
      .filter(a => !usados.has(a.id) && a.cuit === f.cuit && a.clase === e.clase && (!desde || a.fecha >= desde)
        && Math.abs(Math.abs(a.importePesos) - e.monto) <= tol)
      .sort((a, b) => Math.abs(Math.abs(a.importePesos) - e.monto) - Math.abs(Math.abs(b.importePesos) - e.monto))[0] ?? null
    if (match) usados.add(match.id)
    out.push({ ...e, recibida: match })
  }
  return out
}
