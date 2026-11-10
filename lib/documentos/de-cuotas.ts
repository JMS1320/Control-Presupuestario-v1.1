/**
 * 📎 Los DOCUMENTOS y el PAGO de cada cuota de template, leídos de la base — una sola lectura para todas las pantallas
 * (§ Centralizar). La usan el 📎 del Cash Flow (A-FEAT-1576) y la vista agrupada de templates (A-FEAT-1583, JMS 09/11:
 * «que también muestre los elementos complementarios, creo que siempre va a ayudar»).
 *
 * La regla de qué documento es de qué cuota es la de «Lo que te vence» (`documentosDeCuotas`); el movimiento que pagó la cuota
 * sale de `leerMovimientosDeCuotas` (el mismo que usa el H para auditar: la cuota o su grupo de pago, en todas las cuentas).
 */
import { documentosDeCuotas, type DocumentoDeCuota } from "@/lib/vencimientos/de-la-persona"
import { leerMovimientosDeCuotas, type MovimientoDeCuota } from "@/lib/balance/movimientos-de-cuotas"
import type { CuotaTemplate } from "@/lib/balance/templates-libro"

/** Lo mínimo de supabase-js que hace falta. */
type Cliente = { from: (t: string) => any; schema: (s: string) => { from: (t: string) => any } }

/** Los documentos de estas cuotas: mails archivados con la cuota, boletas de ARBA y el comprobante de quien informó el pago. */
export async function leerDocumentosDeCuotas(cliente: Cliente, ids: string[]): Promise<Record<string, DocumentoDeCuota[]>> {
  if (!ids.length) return {}
  const trozos: string[][] = []
  for (let i = 0; i < ids.length; i += 200) trozos.push(ids.slice(i, i + 200))
  const [{ data: mails }, boletas, propuestas] = await Promise.all([
    cliente.from("mails_registro").select("asunto, vinculos").contains("vinculos", [{ tabla: "cuotas_egresos_sin_factura" }]),
    Promise.all(trozos.map(t => cliente.from("boletas_arba").select("cuota_id, archivo_url, archivo_nombre, impuesto").in("cuota_id", t))),
    Promise.all(trozos.map(t => cliente.from("propuestas_cambio").select("id, registro_id, estado, nombre:cambios->comprobante->>nombre")
      .eq("tabla", "cuotas_egresos_sin_factura").in("registro_id", t))),
  ]) as [{ data: unknown[] | null }, Array<{ data: unknown[] | null }>, Array<{ data: unknown[] | null }>]
  const conComprobante = propuestas.flatMap(r => (r.data ?? []) as { id: string; registro_id: string; estado: string; nombre: string | null }[])
    .map(p => ({ id: p.id, registro_id: p.registro_id, estado: p.estado, con_comprobante: p.nombre }))
  return documentosDeCuotas(ids, (mails ?? []) as Parameters<typeof documentosDeCuotas>[1],
    boletas.flatMap(r => (r.data ?? []) as Parameters<typeof documentosDeCuotas>[2]), conComprobante)
}

export interface ContextoDeCuota {
  /** Los movimientos que pagaron la cuota (o su grupo de pago): cuenta, fecha, comprobante, códigos, descripción del banco. */
  pagos: MovimientoDeCuota[]
  documentos: DocumentoDeCuota[]
}

/** El contexto de pago y los documentos de estas cuotas, por id de cuota. Las cuentas que no se pudieron leer vienen aparte. */
export async function leerContextoDeCuotas(cliente: Cliente, cuotas: { id: string; grupoPagoId?: string | null }[]):
  Promise<{ porCuota: Record<string, ContextoDeCuota>; cuentasQueFallaron: string[] }> {
  const [movs, docs] = await Promise.all([
    leerMovimientosDeCuotas(cliente as never, cuotas.map(c => ({ id: c.id, grupoPagoId: c.grupoPagoId ?? undefined })) as unknown as CuotaTemplate[]),
    leerDocumentosDeCuotas(cliente, cuotas.map(c => c.id)),
  ])
  const porCuota: Record<string, ContextoDeCuota> = {}
  for (const c of cuotas) {
    porCuota[c.id] = {
      pagos: movs.movimientos.filter(m => m.vinculo === c.id || (!!c.grupoPagoId && m.vinculo === c.grupoPagoId)),
      documentos: docs[c.id] ?? [],
    }
  }
  return { porCuota, cuentasQueFallaron: movs.tablasQueFallaron }
}
