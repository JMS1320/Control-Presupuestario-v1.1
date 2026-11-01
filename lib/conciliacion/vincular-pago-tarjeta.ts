/**
 * 💳 **VINCULAR EL PAGO DE UN RESUMEN DE TARJETA — una sola función** (A-DEC-1002; centralizada 01/11/2026 para la
 * tanda del recorrido, A-FEAT-1491).
 *
 * El débito de la cuenta corriente queda con el `nro_resumen` del resumen que paga (y su rótulo en
 * `comprobantes_pagados` si no tenía), y el «SU PAGO» del resumen siguiente se concilia contra ese débito: misma
 * categoría que el débito, «Pago desde cuenta corriente» y el mismo rótulo.
 *
 * Antes vivía adentro del Extracto. La usan ahora el botón «Vincular pago» del Extracto y la tanda del recorrido: si
 * fueran dos copias, la misma vinculación quedaría distinta según por dónde se hizo.
 */
import { etiquetaResumenTarjeta } from "@/lib/conciliacion/pool-tarjeta"

/** Lo que hace falta para vincular un pago: el resumen que se paga, su débito y los «SU PAGO» del resumen siguiente. */
export interface PagoAVincular {
  nr: string
  cierre: string
  /** `schema.tabla` de la cuenta corriente y el id del débito. */
  debito: { tabla: string; id: string }
  /** `schema.tabla` de la tarjeta y los ids de los «SU PAGO». */
  tarjeta: { tabla: string }
  suPagoIds: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any
const cliDe = (sb: Cliente, tablaCompleta: string) => {
  const [sch, tabla] = tablaCompleta.includes(".") ? tablaCompleta.split(".") : ["public", tablaCompleta]
  return { db: sch && sch !== "public" ? sb.schema(sch) : sb, tabla }
}

/**
 * Escribe la vinculación. Devuelve lo que escribió en el «SU PAGO» (para refrescar la pantalla). Sólo concilia los
 * «SU PAGO» que siguen pendientes: nunca pisa uno ya conciliado.
 */
export async function vincularPagoTarjeta(sb: Cliente, p: PagoAVincular): Promise<Record<string, unknown>> {
  const etiqueta = etiquetaResumenTarjeta(p.cierre) ?? `Resumen tarjeta ${p.nr}`
  const cc = cliDe(sb, p.debito.tabla)
  const { data: actual, error: e0 } = await cc.db.from(cc.tabla).select("comprobantes_pagados, categ").eq("id", p.debito.id).maybeSingle()
  if (e0) throw new Error(e0.message)
  const { error } = await cc.db.from(cc.tabla)
    .update({ nro_resumen: p.nr, ...(actual?.comprobantes_pagados ? {} : { comprobantes_pagados: etiqueta }) })
    .eq("id", p.debito.id)
  if (error) throw new Error(error.message)
  const upd = { estado: "conciliado", categ: actual?.categ || null, proveedor_nombre: "Pago desde cuenta corriente", comprobantes_pagados: etiqueta, detalle: null }
  if (p.suPagoIds.length) {
    const tj = cliDe(sb, p.tarjeta.tabla)
    const { error: e2 } = await tj.db.from(tj.tabla).update(upd).in("id", p.suPagoIds).neq("estado", "conciliado")
    if (e2) throw new Error(e2.message)
  }
  return upd
}
