/**
 * 🔔 A-FEAT-1566 — las boletas de ARBA que FALTAN se vuelven una TAREA (alerta antes, control después).
 *
 * JMS 05/11: *«warning faltan 2 boletas sería interesante… desde que se tiene la 1ra el warning va para las que
 * faltan»* → «sí, exacto». Hasta acá el «Faltan N» vivía sólo adentro del panel de ARBA: si no se abría, nadie se
 * enteraba. Apenas llega la primera boleta de una cuota, ya se sabe que llegaron las demás; las que no, son una tarea
 * para quien recibe los vencimientos de impuestos, con fecha unos días ANTES del vencimiento. Se cierra sola cuando ya
 * no falta ninguna — porque llegó la boleta o porque la cuota se pagó.
 *
 * Pura: la usa `app/api/arba/boletas-faltan` (que lee la base y escribe la tarea). Caso en `npm run probar`.
 */

export interface TemplateFalta { id: string; nombre: string; responsable: string | null }
export interface CuotaFalta { egresoId: string; estado: string; vencimiento: string | null }

/** Una cuota que ya no se espera (pagada, conciliada, desactivada, de un año anterior) no cuenta como faltante. */
const YA_NO_SE_ESPERA = new Set(["pagado", "conciliado", "desactivado", "anterior"])

/** Días de margen antes del vencimiento: una alerta el día del vencimiento no es una alerta, es un acta. */
export const MARGEN_DIAS = 3

const menosDias = (iso: string, d: number) => {
  const t = new Date(iso + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() - d)
  return t.toISOString().slice(0, 10)
}

export function boletasQueFaltan(templates: TemplateFalta[], cuotas: CuotaFalta[], llegaron: Set<string>) {
  const cuotaDe = new Map(cuotas.map(c => [c.egresoId, c]))
  return templates
    .filter(t => !llegaron.has(t.id))
    .map(t => ({ ...t, cuota: cuotaDe.get(t.id) ?? null }))
    .filter(t => t.cuota && !YA_NO_SE_ESPERA.has(t.cuota.estado))
    .sort((a, b) => (a.responsable ?? "").localeCompare(b.responsable ?? "") || a.nombre.localeCompare(b.nombre))
}

/** La tarea (o null si no falta ninguna). El campo, sin el prefijo «Inmobiliario Cuota». */
/** `vencimientoBoletas`: el que traen las boletas que SÍ llegaron (el real); manda sobre el del template, que puede estar viejo. */
export function tareaBoletasFaltan(p: { anio: number; cuota: string; faltan: ReturnType<typeof boletasQueFaltan>; hoy: string; vencimientoBoletas?: string | null }) {
  if (!p.faltan.length) return null
  const campo = (n: string) => n.replace(/^Inmobiliario\s+(Complementario\s+)?(Cuota|Anual)\s+/i, (_m, comp) => comp ? "Complementario " : "").trim()
  const lista = p.faltan.map(f => `${campo(f.nombre)}${f.responsable ? ` (${f.responsable})` : ""}`).join(", ")
  const vencs = p.faltan.map(f => f.cuota?.vencimiento).filter((v): v is string => !!v).sort()
  const venc = p.vencimientoBoletas || (vencs[0] ?? null)
  const hasta = venc ? (menosDias(venc, MARGEN_DIAS) < p.hoy ? p.hoy : menosDias(venc, MARGEN_DIAS)) : p.hoy
  const fecha = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  return {
    registro_id: `arba:${p.anio}-C${p.cuota}`,
    motivo: `${p.faltan.length === 1 ? "Falta la boleta" : `Faltan ${p.faltan.length} boletas`} de ARBA de la cuota ${p.cuota}: ${lista}` + (venc ? ` — vence ${fecha(venc)}` : ""),
    tarea_hasta: hasta,
  }
}
