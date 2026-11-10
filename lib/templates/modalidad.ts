/**
 * 🔁 **ANUAL o CUOTAS — el control de estructura de los templates** (A-FEAT-1582, JMS 09/11).
 *
 * Un vehículo o una partida se paga de UNA manera por año: el template «Anual» o el «Cuota». El otro existe, pero desactivado.
 * JMS: *«siempre un template activo y el otro desactivado. Si hay los dos activos o los dos desactivados es una incongruencia…
 * el que esté activado tiene cuotas; si no tiene es una incongruencia… lo desactivado no tenga pagos vinculados… si hay algo
 * conciliado pero sin ningún tipo de pago vinculado tiene que ir a inconsistencias»*. Y: *«no es un asunto de mostrar todo
 * para ver todo: es mostrar lo que tiene que estar»* → se ve sólo la modalidad activa; lo que no cierra salta como aviso.
 *
 * Una sola función para las dos salidas (§ Centralizar): la alerta de **Principal** (`components/alerta-modalidad-templates.tsx`)
 * y la solapa «Inconsistencias» del H para auditar.
 *
 * Las reglas de grupo (una sola activa, la activa con cuotas, la inactiva sin cuotas vivas) valen para la campaña EN CURSO y las
 * siguientes: una campaña cerrada (2025) queda con los dos templates inactivos y sus pagos en «anterior», y está bien. Las de pago
 * (conciliada sin pago, desactivada con pago) valen para cualquier año.
 */
import { TABLAS_CON_VINCULO_ARCA } from "@/lib/conciliacion/tablas-con-vinculo-arca"

export interface TemplateModalidad { id: string; nombre: string; grupo: string | null; anio: string | null; activo: boolean }
export interface CuotaModalidad { id: string; egresoId: string; estado: string; monto: number; fecha: string | null; grupoPagoId?: string | null }

export type TipoProblemaModalidad =
  | "dos_activas" | "ninguna_activa" | "activa_sin_cuotas" | "inactiva_con_cuota_viva" | "desactivada_con_pago" | "conciliada_sin_pago"
  | "conciliada_en_cero"

export interface ProblemaModalidad {
  tipo: TipoProblemaModalidad
  /** El título del tipo, en el lenguaje de la app. */
  titulo: string
  templateId: string
  template: string
  anio: string | null
  /** Las cuotas involucradas (vacío en los problemas de grupo). */
  cuotas: { id: string; fecha: string | null; monto: number; estado: string }[]
  /** Qué hacer, en una línea. */
  accion: string
}

export const TITULOS_MODALIDAD: Record<TipoProblemaModalidad, { titulo: string; accion: string }> = {
  dos_activas: { titulo: "ANUAL y CUOTAS activos a la vez", accion: "desactivar la modalidad que no se usa este año" },
  ninguna_activa: { titulo: "ni ANUAL ni CUOTAS activos", accion: "activar la modalidad que se usa este año" },
  activa_sin_cuotas: { titulo: "modalidad activa SIN cuotas", accion: "cargar las cuotas del año en el template activo" },
  inactiva_con_cuota_viva: { titulo: "template INACTIVO con cuotas vivas", accion: "desactivar esas cuotas (o activar el template si era el bueno)" },
  desactivada_con_pago: { titulo: "cuota DESACTIVADA con pago vinculado", accion: "revisar: si se pagó, la cuota no puede estar desactivada" },
  conciliada_sin_pago: { titulo: "cuota CONCILIADA con importe y sin ningún pago vinculado", accion: "revisar: conciliarla con su movimiento, o volverla a pendiente si no se pagó" },
  // ⚪ el mes en que no hubo nada que pagar (IIBB, SICORE, un retiro): se cerró «conciliado» en $ 0. No es plata, pero tampoco es
  // conciliado (no hay movimiento). ⚠️ cambió 10/11 (A-FEAT-1587): lo correcto ya no es «desactivado» (JMS: «desactivado no es una
  // referencia de lo que sucedió») sino el estado «Nada a pagar» — o, si se pagó, vincular el pago. Se lista aparte para que no tape a lo
  // que tiene importe.
  conciliada_en_cero: { titulo: "cuota en $ 0 marcada CONCILIADA sin pago", accion: "si ese mes correctamente no hubo nada que pagar, pasarla a «Nada a pagar»; si se pagó, vincular el pago" },
}

/** La modalidad por el nombre: «Imp Automotores Gol 2012 Anual» → anual. */
export function modalidadDe(nombre: string): "anual" | "cuota" | null {
  return /\banual\b/i.test(nombre) ? "anual" : /\bcuota\b/i.test(nombre) ? "cuota" : null
}

/**
 * Pura. `conPago` = los ids (de cuota o de grupo de pago) que tienen un movimiento vinculado en alguna cuenta.
 * `anioEnCurso` = el año de la campaña en curso (las reglas de grupo valen desde ahí).
 */
export function problemasDeModalidad(templates: TemplateModalidad[], cuotas: CuotaModalidad[], conPago: Set<string>, anioEnCurso: number): ProblemaModalidad[] {
  const out: ProblemaModalidad[] = []
  const porTemplate = new Map<string, CuotaModalidad[]>()
  for (const c of cuotas) porTemplate.set(c.egresoId, [...(porTemplate.get(c.egresoId) ?? []), c])
  const tieneP = (c: CuotaModalidad) => conPago.has(c.id) || (!!c.grupoPagoId && conPago.has(c.grupoPagoId))
  const viva = (c: CuotaModalidad) => (c.estado || "").toLowerCase() !== "desactivado"
  const fila = (c: CuotaModalidad) => ({ id: c.id, fecha: c.fecha, monto: c.monto, estado: c.estado })
  const nuevo = (tipo: TipoProblemaModalidad, t: TemplateModalidad, cs: CuotaModalidad[] = []) =>
    out.push({ tipo, ...TITULOS_MODALIDAD[tipo], templateId: t.id, template: t.nombre, anio: t.anio, cuotas: cs.map(fila) })
  const enCurso = (t: TemplateModalidad) => Number(t.anio) >= anioEnCurso

  // 1 · De grupo: el mismo vehículo / partida y año, con las dos modalidades cargadas
  const grupos = new Map<string, TemplateModalidad[]>()
  for (const t of templates) {
    if (!t.grupo || !modalidadDe(t.nombre) || !enCurso(t)) continue
    const k = `${t.grupo}|${t.anio}`
    grupos.set(k, [...(grupos.get(k) ?? []), t])
  }
  for (const ts of grupos.values()) {
    const mods = new Set(ts.map(t => modalidadDe(t.nombre)))
    if (mods.size < 2) continue                                   // sólo una modalidad cargada: no hay par que controlar
    const activas = new Set(ts.filter(t => t.activo).map(t => modalidadDe(t.nombre)))
    const ref = ts.find(t => modalidadDe(t.nombre) === "anual") ?? ts[0]
    if (activas.size === 2) nuevo("dos_activas", ref)
    else if (activas.size === 0) nuevo("ninguna_activa", ref)
    for (const t of ts) {
      const cs = porTemplate.get(t.id) ?? []
      if (t.activo && !cs.some(viva)) nuevo("activa_sin_cuotas", t)
      if (!t.activo && activas.size === 1) {
        const vivas = cs.filter(viva)
        if (vivas.length) nuevo("inactiva_con_cuota_viva", t, vivas)
      }
    }
  }
  // 2 · De pago, para cualquier año
  for (const t of templates) {
    const cs = porTemplate.get(t.id) ?? []
    const desact = cs.filter(c => !viva(c) && tieneP(c))
    if (desact.length) nuevo("desactivada_con_pago", t, desact)
    const sinPago = cs.filter(c => (c.estado || "").toLowerCase() === "conciliado" && !tieneP(c))
    const conImporte = sinPago.filter(c => Math.abs(c.monto) >= 0.005)
    if (conImporte.length) nuevo("conciliada_sin_pago", t, conImporte)
    if (sinPago.length > conImporte.length) nuevo("conciliada_en_cero", t, sinPago.filter(c => Math.abs(c.monto) < 0.005))
  }
  const orden: TipoProblemaModalidad[] = ["dos_activas", "ninguna_activa", "activa_sin_cuotas", "inactiva_con_cuota_viva", "desactivada_con_pago", "conciliada_sin_pago", "conciliada_en_cero"]
  return out.sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo) || a.template.localeCompare(b.template))
}

// ── carga desde la base (la usan la alerta de Principal y el Excel) ─────────────────────────────────────────────────────────

/** Lo mínimo de supabase-js que hace falta (para no atarse al cliente del navegador ni al del server). */
export interface ClienteModalidad {
  from: (t: string) => any
  schema: (s: string) => { from: (t: string) => any }
}

const PAGINA = 1000
async function todas(q: () => any): Promise<any[]> {
  const out: any[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await q().range(desde, desde + PAGINA - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGINA) return out
  }
}

/** Los tipos GRAVES (errores de estructura o de plata): los que la alerta de Principal pone en rojo. */
export const GRAVES_MODALIDAD: TipoProblemaModalidad[] = ["dos_activas", "ninguna_activa", "activa_sin_cuotas", "inactiva_con_cuota_viva", "desactivada_con_pago", "conciliada_sin_pago"]

export interface ControlModalidad { problemas: ProblemaModalidad[]; tablasQueFallaron: string[] }

/** Lee templates, cuotas y los vínculos de pago de TODAS las cuentas, y corre el control. */
export async function cargarProblemasDeModalidad(cliente: ClienteModalidad, anioEnCurso: number): Promise<ControlModalidad> {
  const ts = await todas(() => cliente.from("egresos_sin_factura").select("id, nombre_referencia, grupo_impuesto_id, año, activo").order("id"))
  const cs = await todas(() => cliente.from("cuotas_egresos_sin_factura").select("id, egreso_id, estado, monto, fecha_estimada, grupo_pago_id").order("id"))
  const conPago = new Set<string>()
  const tablasQueFallaron: string[] = []
  for (const t of TABLAS_CON_VINCULO_ARCA) {
    try {
      const filas = await todas(() => (t.schema === "public" ? cliente.from(t.tabla) : cliente.schema(t.schema).from(t.tabla))
        .select("template_cuota_id").not("template_cuota_id", "is", null).order("template_cuota_id"))
      for (const f of filas) conPago.add(String(f.template_cuota_id))
    } catch { tablasQueFallaron.push(t.cuenta ?? `${t.schema}.${t.tabla}`) }
  }
  const problemas = problemasDeModalidad(
    ts.map(t => ({ id: t.id, nombre: t.nombre_referencia ?? "", grupo: t.grupo_impuesto_id ?? null, anio: t["año"] != null ? String(t["año"]) : null, activo: !!t.activo })),
    cs.map(c => ({ id: c.id, egresoId: c.egreso_id, estado: c.estado ?? "", monto: Number(c.monto) || 0, fecha: c.fecha_estimada ?? null, grupoPagoId: c.grupo_pago_id ?? null })),
    conPago, anioEnCurso)
  return { problemas, tablasQueFallaron }
}
