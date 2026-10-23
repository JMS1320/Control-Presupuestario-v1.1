/**
 * 🏷️ **DETALLE FIJO POR PROVEEDOR** (A-FEAT-1296, 2026-10-20).
 *
 * Usuario: *«llenar el detalle siempre igual para ciertas facturas… de manera orgánica, al conciliar poder ir
 * dando el check… práctico y entendible. El caso de 2 facturas es más difícil, pero es fácilmente identificable
 * por los montos»*. Tabla `public.detalles_por_proveedor` (script 88): varios renglones por CUIT = varios
 * suministros (Coopser: «Luz Casco NZ Total» ~$600 mil, «Luz Casa Porteria» ~$56 mil).
 *
 * Regla de elección (diseño aprobado 2026-10-20):
 * - un solo renglón activo del CUIT → ése;
 * - varios → el de monto de referencia más cercano, si está dentro de ±30 %; si ninguno entra o los dos
 *   mejores están casi igual de cerca, NO elige: devuelve `sugeridos` para que el usuario toque uno.
 * - Nunca pisa: sólo se aplica si el detalle está vacío o es el autogenerado «FC N - EMISOR» (A-DAT-54).
 */
import { pareceDetalleAutogenerado } from "@/lib/conciliacion/columnas-extracto"

export interface DetalleFijo {
  id: string
  cuit: string
  detalle: string
  monto_referencia: number | null
  activo: boolean
}

export const TOLERANCIA_MONTO = 0.3

const normCuit = (c: string | null | undefined) => String(c ?? "").replace(/\D/g, "")

const distancia = (ref: number | null, monto: number): number =>
  ref && ref > 0 && monto > 0 ? Math.abs(monto - ref) / ref : Infinity

export function elegirDetalleFijo(
  fijos: DetalleFijo[],
  cuit: string | null | undefined,
  monto: number,
): { elegido: DetalleFijo | null; sugeridos: DetalleFijo[] } {
  const c = normCuit(cuit)
  if (!c) return { elegido: null, sugeridos: [] }
  const delProveedor = fijos.filter(f => f.activo && normCuit(f.cuit) === c)
  if (delProveedor.length === 0) return { elegido: null, sugeridos: [] }
  if (delProveedor.length === 1) return { elegido: delProveedor[0], sugeridos: [] }
  const orden = [...delProveedor].sort((a, b) => distancia(a.monto_referencia, monto) - distancia(b.monto_referencia, monto))
  const d0 = distancia(orden[0].monto_referencia, monto)
  const d1 = distancia(orden[1].monto_referencia, monto)
  // Dentro de la tolerancia y claramente mejor que el segundo (no un empate a ojo).
  if (d0 <= TOLERANCIA_MONTO && d1 - d0 > 0.1) return { elegido: orden[0], sugeridos: [] }
  return { elegido: null, sugeridos: orden }
}

/** ¿Se puede poner el detalle fijo? Sólo si está vacío o es el autogenerado — lo que escribió el usuario manda. */
export function admiteDetalleFijo(actual: string | null | undefined, emisor?: string | null, numero?: string | number | null): boolean {
  const d = (actual ?? "").trim()
  return !d || pareceDetalleAutogenerado(d, emisor, numero)
}
