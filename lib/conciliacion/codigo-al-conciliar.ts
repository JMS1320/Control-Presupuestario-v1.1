/**
 * 🏡 El código CONTABLE de un pago de un BIEN, al conciliar (A-FEAT-1577 punto 12 — JMS 07/11: «sí, que la conciliación ponga el código con
 * la regla»). Una sola función para los 4 caminos que vinculan un template: el motor (1ª y 2ª pasada) y la asignación a mano del extracto
 * (template y grupo de pago).
 *
 * Si TODOS los templates del pago son bienes del mismo dueño a esa fecha (`duenoDelBien`), el código sale de la regla de bienes según quién
 * pagó (`codigoEsperado`: el dueño → vacío · MSA → CTA <dueño> · PAM por MA → DIST MA). Si no —no es un bien, o el pago mezcla dueños—,
 * `aplica: false` y manda la regla de siempre (`reglas_contable_interno`). Lo escrito a mano por el usuario manda sobre las dos: eso lo
 * resuelve cada camino, como ya lo hacía.
 */
import { duenoDelBien, codigoEsperado, type Empresa } from "@/lib/balance/dueno-de-bienes"

export interface TemplateDelPago { nombre: string; responsable: string }

export function codigoPorBien(pagador: string | null | undefined, fecha: string | null | undefined, templates: TemplateDelPago[]):
  { aplica: boolean; contable: string | null } {
  const pag = String(pagador ?? "").toUpperCase() as Empresa
  if (!["MSA", "PAM", "MA"].includes(pag) || !fecha || !templates.length) return { aplica: false, contable: null }
  const duenos = templates.map(t => duenoDelBien(t, String(fecha)))
  if (duenos.some(d => d === null)) return { aplica: false, contable: null }
  const unicos = [...new Set(duenos)] as Empresa[]
  if (unicos.length !== 1) return { aplica: false, contable: null }
  return { aplica: true, contable: codigoEsperado(pag, unicos[0]) }
}

type Cliente = { from: (t: string) => any }

/** Los templates (nombre y responsable) de un template suelto o de todas las cuotas de un grupo de pago. Si falla, lista vacía (manda la regla de siempre). */
export async function templatesDelPago(sb: Cliente, o: { egresoId?: string | null; grupoPagoId?: string | null }): Promise<TemplateDelPago[]> {
  try {
    if (o.grupoPagoId) {
      const { data } = await sb.from("cuotas_egresos_sin_factura").select("egreso:egresos_sin_factura(nombre_referencia, responsable)").eq("grupo_pago_id", o.grupoPagoId)
      const ts = ((data ?? []) as Array<{ egreso: { nombre_referencia?: string | null; responsable?: string | null } | null }>)
        .map(c => ({ nombre: String(c.egreso?.nombre_referencia ?? ""), responsable: String(c.egreso?.responsable ?? "") })).filter(t => t.nombre)
      if (ts.length) return ts
    }
    if (o.egresoId) {
      const { data } = await sb.from("egresos_sin_factura").select("nombre_referencia, responsable").eq("id", o.egresoId).maybeSingle()
      if (data) return [{ nombre: String(data.nombre_referencia ?? ""), responsable: String(data.responsable ?? "") }]
    }
  } catch { /* sin templates: manda la regla de siempre */ }
  return []
}
