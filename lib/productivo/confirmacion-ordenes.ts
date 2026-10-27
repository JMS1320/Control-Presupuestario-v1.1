/**
 * «SE HIZO» Y «CONFIRMAR» EN LAS ÓRDENES — A-FEAT-1223 (2026-10-27).
 *
 * JMS: «el confirmar de él no sea el mismo que el mío… dos botones… hasta que no acepto yo no impacta nada» y
 * «si rechazo vuelve a planificada con el recuento de él guardado».
 *
 *   planificada ──✓ Se hizo (sin «Confirmar»)──▶ a_confirmar ──✓✓ Confirmar──▶ ejecutada (descuenta stock)
 *        ▲                                             │
 *        └──────────── Rechazar (con motivo; el recuento queda) ◀┘
 *   planificada ──✓ (con «Confirmar»)──▶ ejecutada   (el dueño, como siempre)
 *
 * Crear y editar una orden PLANIFICADA no mueve nada, así que no espera a nadie: lo único que espera el OK es
 * el paso que impacta. Por eso no hay propuestas encadenadas.
 */

export type EstadoOrden = "planificada" | "a_confirmar" | "ejecutada" | "eliminada"

export type PermisosOrden = {
  nueva: boolean; editar: boolean; seHizo: boolean; confirmar: boolean; borrar: boolean; descargar: boolean
}

/** Lo que pasa al apretar ✓ en una orden planificada. */
export function alMarcarHecha(p: Pick<PermisosOrden, "confirmar">): { estado: EstadoOrden; impactaStock: boolean } {
  return p.confirmar ? { estado: "ejecutada", impactaStock: true } : { estado: "a_confirmar", impactaStock: false }
}

/** Rechazar una orden a confirmar: vuelve a planificada; el recuento que cargó queda para que lo corrija. */
export function alRechazar(): { estado: EstadoOrden; conservaRecuento: boolean } {
  return { estado: "planificada", conservaRecuento: true }
}

/** Lo que todavía va a consumir insumos (Necesidad de compra): lo planificado y lo hecho sin confirmar. */
export const PENDIENTE_DE_CONSUMO: EstadoOrden[] = ["planificada", "a_confirmar"]

export type BotonesOrden = {
  editar: boolean
  /** ✓ en una planificada. `directo` = quien aprieta tiene «Confirmar»: ejecuta sin pasar por a_confirmar. */
  marcar: null | { texto: string; directo: boolean }
  confirmar: boolean
  rechazar: boolean
  borrar: boolean
  descargar: boolean
  ver: boolean
}

/** Qué botones ve cada uno en cada estado. */
export function botonesOrden(estado: string, p: PermisosOrden): BotonesOrden {
  const vivo = estado !== "eliminada"
  return {
    editar: estado === "planificada" && p.editar,
    marcar: estado === "planificada" && (p.seHizo || p.confirmar)
      ? (p.confirmar ? { texto: "Confirmar como ejecutada", directo: true } : { texto: "Se hizo (queda a confirmar)", directo: false })
      : null,
    confirmar: estado === "a_confirmar" && p.confirmar,
    rechazar: estado === "a_confirmar" && p.confirmar,
    borrar: vivo && p.borrar,
    descargar: vivo && p.descargar,
    ver: estado === "eliminada",
  }
}

export const ETIQUETA_ESTADO: Record<string, string> = {
  planificada: "planificada", a_confirmar: "a confirmar", ejecutada: "ejecutada", eliminada: "eliminada",
}
