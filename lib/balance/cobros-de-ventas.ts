/**
 * 💵 COBROS Y RETENCIONES DE CADA VENTA — para el Libro Diario consensuado (JMS 29/10/2026).
 *
 * JMS: *«las retenciones de ganancias e iibb o ret de iva sufridas de las ventas deben reportarse en una solapa
 * aparte en el diario de ventas… con un segundo cheq de control contra pagos recibidos. Básicamente declarado
 * menos retenciones = cobro. Las retenciones están cargadas. El cheq dirá si faltaron.»*
 *
 * - **Retenciones:** `<empresa>.retenciones_recibidas` (Ganancias, IIBB, IVA, con su certificado). Las de la venta
 *   (`ret_iva`, `ret_iibb` de `comprobantes_venta`) valen sólo si la tabla no tiene ese impuesto para esa venta:
 *   así no se cuentan dos veces.
 * - **Cobros:** los movimientos del extracto y de los echeqs de terceros vinculados a la venta
 *   (`comprobante_venta_id`). Crédito menos débito.
 * - **Grupo de cobro:** dos liquidaciones cobradas juntas (`grupo_cobro_id`) se controlan juntas.
 *
 * 🔴 SÓLO LEE.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { traerTodo } from "@/lib/supabase-paginado"

export type TipoRetencion = "ganancias" | "iibb" | "iva"

export interface RetencionRecibida {
  ventaId: string
  tipo: TipoRetencion | string
  monto: number
  fecha: string | null
  certificado: string | null
}

export interface CobroDeVenta {
  ventaId: string
  fecha: string | null
  /** Crédito − débito del movimiento. */
  importe: number
  /** De qué cuenta salió («Galicia», «Echeqs de terceros»…). */
  origen: string
}

/** Lo leído. `null` = no se pudo leer (el Excel lo dice, no lo calla). */
export interface CobrosYRetenciones {
  retenciones: RetencionRecibida[] | null
  cobros: CobroDeVenta[] | null
  avisos: string[]
}

/** Las tablas con `comprobante_venta_id` de cada empresa: donde puede estar el cobro de una venta. */
export const TABLAS_DE_COBRO: Record<string, Array<{ schema: string; tabla: string; nombre: string }>> = {
  MSA: [
    { schema: "public", tabla: "msa_galicia", nombre: "Galicia" },
    { schema: "msa", tabla: "echeqs_terceros", nombre: "Echeqs de terceros" },
  ],
  PAM: [
    { schema: "public", tabla: "pam_galicia", nombre: "Galicia caja de ahorro" },
    { schema: "public", tabla: "pam_galicia_cc", nombre: "Galicia cta cte" },
  ],
  MA: [{ schema: "ma", tabla: "ma_galicia", nombre: "Galicia" }],
}

const n = (v: unknown) => Number(v ?? 0) || 0
const fecha = (v: unknown) => (v ? String(v).slice(0, 10) : null)

export const retencionDesde = (f: Record<string, unknown>): RetencionRecibida => ({
  ventaId: String(f.comprobante_venta_id ?? ""), tipo: String(f.tipo ?? "").toLowerCase(), monto: n(f.monto),
  fecha: fecha(f.fecha), certificado: f.nro_certificado ? String(f.nro_certificado) : null,
})

export const cobroDesde = (f: Record<string, unknown>, origen: string): CobroDeVenta => ({
  ventaId: String(f.comprobante_venta_id ?? ""), fecha: fecha(f.fecha), importe: n(f.creditos) - n(f.debitos), origen,
})

/** Lee las retenciones recibidas y los cobros vinculados a ventas de una empresa. */
export async function leerCobrosYRetenciones(sb: SupabaseClient, empresa: string, schema: string): Promise<CobrosYRetenciones> {
  const avisos: string[] = []
  const ret = await traerTodo((d, h) => sb.schema(schema).from("retenciones_recibidas")
    .select("comprobante_venta_id, tipo, monto, fecha, nro_certificado", { count: "exact" })
    .not("comprobante_venta_id", "is", null).order("id").range(d, h))
  if (ret.error) avisos.push(`No se pudieron leer las retenciones recibidas: ${ret.error.message}`)

  let cobros: CobroDeVenta[] | null = []
  for (const t of TABLAS_DE_COBRO[empresa] ?? []) {
    const r = await traerTodo((d, h) => sb.schema(t.schema).from(t.tabla)
      .select("comprobante_venta_id, fecha, creditos, debitos", { count: "exact" })
      .not("comprobante_venta_id", "is", null).order("id").range(d, h))
    if (r.error) { avisos.push(`No se pudieron leer los cobros de ${t.nombre}: ${r.error.message}`); cobros = null; break }
    cobros.push(...(r.data as Record<string, unknown>[]).map(f => cobroDesde(f, t.nombre)))
  }
  return {
    retenciones: ret.error ? null : (ret.data as Record<string, unknown>[]).map(retencionDesde),
    cobros, avisos,
  }
}
