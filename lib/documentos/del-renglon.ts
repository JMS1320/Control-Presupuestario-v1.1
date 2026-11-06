/**
 * 📎 **El comprobante de cada renglón del Cash Flow** (A-FEAT-1576, JMS 06/11: *«todos los renglones de cash flow que tengan
 * su comprobante deben mostrarlo. Esto aplica a todo lo que vayamos cargando. Ejemplo VEP del contador, etc.»*).
 *
 * La factura ya tenía su 📎 (A-FEAT-1185, `lib/facturas/archivo-digital.ts`). Una cuota de TEMPLATE no tiene factura, pero
 * puede tener documentos: la boleta o el VEP que llegó por mail y se pasó a la cuota, la boleta de ARBA, el comprobante que
 * adjuntó quien informó el pago. Los junta `documentosDeCuotas` (la misma función que usa «Lo que te vence»: una sola regla
 * para las dos pantallas). Acá sólo se resuelve **qué cuotas tiene detrás un renglón** y se unen sus documentos.
 *
 * Pura: no lee la base. Casos en `npm run probar`.
 */
import type { DocumentoDeCuota } from "@/lib/vencimientos/de-la-persona"

/** Lo mínimo de un renglón del Cash Flow para saber qué cuotas tiene detrás. */
export interface RenglonConCuotas {
  id: string
  origen?: string | null
  origen_tabla?: string | null
  /** En un pago agrupado, los ids de las cuotas del grupo. */
  ids_grupo?: string[] | null
}

/** Las cuotas de template detrás de un renglón: la suya, o las del grupo. Ninguna si el renglón no es de template. */
export function cuotasDelRenglon(r: RenglonConCuotas): string[] {
  if (r.origen !== "TEMPLATE") return []
  if (r.ids_grupo && r.ids_grupo.length) return [...r.ids_grupo]
  return r.origen_tabla === "cuotas_egresos_sin_factura" ? [r.id] : []
}

/** Los documentos de un renglón: los de todas sus cuotas, sin repetir el mismo archivo (un mail puede cubrir varias). */
export function documentosDelRenglon(r: RenglonConCuotas, porCuota: Record<string, DocumentoDeCuota[]>): DocumentoDeCuota[] {
  const fuera: DocumentoDeCuota[] = []
  for (const id of cuotasDelRenglon(r)) {
    for (const d of porCuota[id] ?? []) if (!fuera.some(x => x.url === d.url)) fuera.push(d)
  }
  return fuera
}
