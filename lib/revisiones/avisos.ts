/**
 * 📮 QUIÉN RECIBE QUÉ y las OBLIGACIONES DEL MES — A-FEAT-1449 tanda 3 (script 153).
 *
 * `public.avisos_destinatarios`: tipo de aviso → a quién va por defecto («Pasarle a…» lo propone).
 * `public.obligaciones_recurrentes`: lo que hay que hacer cada mes antes de un día → se crea sola la tarea (🚩) del mes
 * para quien recibe ese tipo de aviso (A-AUTO-02, el checklist con la alerta ANTES).
 * Lógica pura, probada en casos.
 */

export interface AvisoDestinatarios { tipo: string; nombre: string; destinatarios: string[] }
export interface ObligacionRecurrente { id: string; nombre: string; aviso_tipo: string; dia_mes: number; activa: boolean }

/** El tipo de aviso de una tarea que sale de un mail: según el tipo del mail («impuestos» → «mail_impuestos»). */
export const tipoAvisoDeMail = (tipoMail: string | null | undefined) => tipoMail ? `mail_${tipoMail}` : ""

/** Pura: a quién va por defecto un tipo de aviso (el primero de la lista), o "". */
export function destinatarioPorDefecto(avisos: AvisoDestinatarios[], tipo: string | null | undefined): string {
  return avisos.find(a => a.tipo === tipo)?.destinatarios?.[0] ?? ""
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

/**
 * Pura: las tareas del MES para las obligaciones activas (hoy = 'AAAA-MM-DD', hora argentina). Una por obligación y
 * mes (`registro_id` = `<id>:<AAAA-MM>`, único en la base); sin destinatario no se crea (se ve en la configuración).
 */
export function tareasDelMes(obligaciones: ObligacionRecurrente[], avisos: AvisoDestinatarios[], hoy: string) {
  const mes = hoy.slice(0, 7), nombreMes = MESES[Number(hoy.slice(5, 7)) - 1]
  return obligaciones.filter(o => o.activa).flatMap(o => {
    const para = destinatarioPorDefecto(avisos, o.aviso_tipo)
    if (!para) return []
    return [{
      origen: "obligacion" as const, tabla_ref: "obligaciones_recurrentes", registro_id: `${o.id}:${mes}`,
      descripcion_ref: `Obligación de ${nombreMes}: antes del ${o.dia_mes}`,
      motivo: `${o.nombre} — ${nombreMes}`, asignado_a: para, es_tarea: true,
      tarea_hasta: `${mes}-${String(o.dia_mes).padStart(2, "0")}`, creado_por: "app (obligación del mes)", estado: "abierta", tipo: "revisar",
    }]
  })
}

/** Pura: el link «💸 Pagar» — el Cash Flow con la cuota seleccionada (si se sabe) y la búsqueda puesta. */
export function linkPagar(p: { cuotaId?: string | null; buscar?: string | null }): string {
  const q = new URLSearchParams({ seccion: "cashflow" })
  if (p.cuotaId) q.set("cuota", p.cuotaId)
  if (p.buscar) q.set("buscar", p.buscar)
  return `/?${q.toString()}`
}

/** Pura: el id de la cuota de una tarea atada (`cuota_conciliada:<id>`), o null. */
export const cuotaDeTarea = (cierreAuto: string | null | undefined) => cierreAuto?.startsWith("cuota_conciliada:") ? cierreAuto.slice("cuota_conciliada:".length) : null
