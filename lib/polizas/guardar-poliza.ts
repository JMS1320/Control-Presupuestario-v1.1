/**
 * 💾 Guardar una póliza leída en las tablas de `scripts/89` — A-FEAT-1309.
 *
 * Una sola función para la carga inicial (script) y para la app: si cada camino armara sus filas,
 * tarde o temprano la misma póliza quedaría guardada distinto según por dónde entró.
 *
 * ## Qué NO hace
 * - **No pisa un endoso ya guardado.** Si el endoso existe devuelve `ya-estaba`: ahí puede haber
 *   correcciones del usuario (la huella) y reprocesar el PDF las borraría. Para releerlo se pasa
 *   `reemplazar: true`, y aun así las `correcciones` se conservan.
 * - **No toca la factura ni los templates.** Sólo escribe en las tablas de pólizas.
 */
import type { PolizaLeida } from "./parsear-poliza"
import { controlarPoliza } from "./controlar-poliza"

export interface ExtrasEndoso {
  comprobante_arca_id?: string | null
  comprobante_schema?: string | null
  pdf_drive_url?: string | null
  archivo?: string | null
  procesado_por?: string | null
  empresa?: string
}

/** Pura: las filas que se guardan para una póliza leída. */
export function filasDeLaPoliza(p: PolizaLeida, x: ExtrasEndoso = {}) {
  const control = controlarPoliza(p)
  return {
    poliza: {
      empresa: x.empresa ?? "MSA",
      aseguradora: p.aseguradora ?? "DESCONOCIDA",
      poliza: p.poliza!,
      seccion: p.seccion,
      producto: p.producto,
      poliza_anterior: p.polizaAnterior,
      vigencia_desde: p.vigenciaDesde,
      vigencia_hasta: p.vigenciaHasta,
    },
    endoso: {
      endoso: p.endoso ?? 0,
      fecha_emision: p.fechaEmision,
      periodo_desde: p.periodoDesde,
      periodo_hasta: p.periodoHasta,
      total: p.total,
      es_nota_credito: p.esNotaCredito,
      conceptos: p.conceptos,
      frente: p.frente,
      consolidado: p.consolidado,
      comprobante_arca_id: x.comprobante_arca_id ?? null,
      comprobante_schema: x.comprobante_schema ?? null,
      pdf_drive_url: x.pdf_drive_url ?? null,
      archivo: x.archivo ?? null,
      lectura: p,
      controles: control.integridad,
      procesado_por: x.procesado_por ?? null,
    },
    cuotas: p.cuotasEndoso.map(c => ({ nro: c.nro, de: c.de, vencimiento: c.vencimiento, importe: c.importe })),
    bienes: [
      ...p.vehiculos.map(v => ({ tipo: "vehiculo", certificado: v.certificado, clave: v.patente, descripcion: v.descripcion ?? v.tipo, anio: v.anio, prima: v.prima, suma_asegurada: null, movimiento: null })),
      ...p.personas.map(x => ({ tipo: "persona", certificado: x.certificado, clave: x.documento.length === 11 ? x.documento.slice(2, 10) : x.documento, descripcion: x.nombre, anio: null, prima: null, suma_asegurada: x.sumaAsegurada, movimiento: x.movimiento })),
    ],
    frena: control.frena,
  }
}

/** Lo mínimo del cliente de supabase-js que se usa (sirve el del navegador y el de servicio). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = { from: (t: string) => any }

export type ResultadoGuardar =
  | { estado: "guardado" | "reemplazado"; poliza_id: string; endoso_id: string }
  | { estado: "ya-estaba"; poliza_id: string; endoso_id: string }
  | { estado: "no-se-guarda"; motivo: string }

export async function guardarPoliza(sb: Cliente, p: PolizaLeida, x: ExtrasEndoso = {}, opciones: { reemplazar?: boolean } = {}): Promise<ResultadoGuardar> {
  if (!p.poliza) return { estado: "no-se-guarda", motivo: "No se leyó el número de póliza." }
  const f = filasDeLaPoliza(p, x)
  // 🛑 Integridad: si la póliza no cierra consigo misma no se guarda (el papel se contradice o se leyó mal).
  if (f.frena) return { estado: "no-se-guarda", motivo: "La póliza no cierra consigo misma: " + f.endoso.controles.filter(c => !c.ok).map(c => `${c.que} (${c.detalle})`).join("; ") }

  // 1 · La póliza: se crea una vez; lo que falte (vigencia, anterior) se completa, no se pisa.
  const { data: existentes, error: e1 } = await sb.from("polizas_seguro").select("*").eq("aseguradora", f.poliza.aseguradora).eq("poliza", f.poliza.poliza)
  if (e1) throw new Error("polizas_seguro: " + e1.message)
  let polizaId: string
  if (existentes?.length) {
    const actual = existentes[0]
    polizaId = actual.id
    const completar: Record<string, unknown> = {}
    for (const k of ["seccion", "producto", "poliza_anterior", "vigencia_desde", "vigencia_hasta"] as const) {
      if (actual[k] == null && f.poliza[k] != null) completar[k] = f.poliza[k]
    }
    // La vigencia de la póliza es la del endoso 0 (el que la emite); los otros endosos traen la suya.
    if (p.endoso === 0 && f.poliza.vigencia_desde) { completar.vigencia_desde = f.poliza.vigencia_desde; completar.vigencia_hasta = f.poliza.vigencia_hasta }
    if (Object.keys(completar).length) {
      const { error } = await sb.from("polizas_seguro").update({ ...completar, updated_at: new Date().toISOString() }).eq("id", polizaId)
      if (error) throw new Error("polizas_seguro (completar): " + error.message)
    }
  } else {
    const { data, error } = await sb.from("polizas_seguro").insert(f.poliza).select("id").single()
    if (error) throw new Error("polizas_seguro: " + error.message)
    polizaId = data.id
  }

  // 2 · El endoso.
  const { data: ya, error: e2 } = await sb.from("polizas_endosos").select("id").eq("poliza_id", polizaId).eq("endoso", f.endoso.endoso)
  if (e2) throw new Error("polizas_endosos: " + e2.message)
  let endosoId: string
  let estado: "guardado" | "reemplazado" = "guardado"
  if (ya?.length) {
    endosoId = ya[0].id
    if (!opciones.reemplazar) return { estado: "ya-estaba", poliza_id: polizaId, endoso_id: endosoId }
    // Se relee el papel, pero las correcciones del usuario NO se tocan (no van en el update).
    const { error } = await sb.from("polizas_endosos").update({ ...f.endoso, updated_at: new Date().toISOString() }).eq("id", endosoId)
    if (error) throw new Error("polizas_endosos (reemplazar): " + error.message)
    for (const t of ["polizas_cuotas", "polizas_bienes"]) {
      const { error: ed } = await sb.from(t).delete().eq("endoso_id", endosoId)
      if (ed) throw new Error(`${t} (reemplazar): ` + ed.message)
    }
    estado = "reemplazado"
  } else {
    const { data, error } = await sb.from("polizas_endosos").insert({ ...f.endoso, poliza_id: polizaId }).select("id").single()
    if (error) throw new Error("polizas_endosos: " + error.message)
    endosoId = data.id
  }

  // 3 · Cuotas y bienes del endoso (derivados de la lectura).
  if (f.cuotas.length) {
    const { error } = await sb.from("polizas_cuotas").insert(f.cuotas.map(c => ({ ...c, endoso_id: endosoId })))
    if (error) throw new Error("polizas_cuotas: " + error.message)
  }
  if (f.bienes.length) {
    const { error } = await sb.from("polizas_bienes").insert(f.bienes.map(b => ({ ...b, endoso_id: endosoId })))
    if (error) throw new Error("polizas_bienes: " + error.message)
  }
  return { estado, poliza_id: polizaId, endoso_id: endosoId }
}
