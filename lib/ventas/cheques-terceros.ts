/**
 * 🧾 **CHEQUES DE TERCEROS EN CARTERA** — A-FEAT-1229 (2026-10-02).
 *
 * Pedido del usuario: *«ese cheque nos debe figurar disponible y debemos poner que le endosamos a
 * quien realmente le endosamos y ahí quedaría todo hecho»*. Dos momentos, como en la realidad:
 *
 *   1. **Recibir** — el cheque del cliente entra como cobro (anticipo de cobro, `metodo_pago =
 *      'echeq'`) en estado **`en_cartera`**: está disponible.
 *   2. **Endosar** — se elige el PAGO al proveedor que se cancela con ese cheque. El cheque pasa a
 *      `endosado` y guarda `endosado_en_id`; el pago queda `metodo_pago = 'echeq'`, `estado_pago =
 *      'endosado'`. Ninguno de los dos se espera en el banco.
 *
 * Acá vive la lógica pura (estado, candidatos); la escritura, en `cheques-terceros-db.ts`.
 */

export type EstadoCheque = 'en_cartera' | 'endosado' | 'endosado_sin_destino' | 'depositado'

export const ETIQUETA_ESTADO_CHEQUE: Record<EstadoCheque, string> = {
  en_cartera: 'En cartera',
  endosado: 'Endosado',
  endosado_sin_destino: 'Endosado — falta decir a quién',
  depositado: 'Depositado',
}

/** El estado de un cheque recibido, leído de su fila. */
export function estadoCheque(a: { estado_pago?: string | null; endosado_en_id?: string | null }): EstadoCheque {
  if (a.estado_pago === 'en_cartera') return 'en_cartera'
  if (a.estado_pago === 'endosado') return a.endosado_en_id ? 'endosado' : 'endosado_sin_destino'
  return 'depositado'
}

/** ¿Hay algo que hacer con este cheque desde la cartera? (endosarlo, o decir a quién se endosó). */
export function chequePendienteDeEndoso(a: { estado_pago?: string | null; endosado_en_id?: string | null }): boolean {
  const e = estadoCheque(a)
  return e === 'en_cartera' || e === 'endosado_sin_destino'
}

export interface PagoCandidato {
  id: string
  nombre_proveedor: string | null
  monto: number | string
  fecha_pago: string | null
  descripcion?: string | null
}

/**
 * Los pagos a proveedores a los que se puede endosar un cheque, ordenados: primero los del MISMO
 * importe (es lo normal: el pago se registró por lo que valía el cheque), después por cercanía de
 * importe y, a igual distancia, por cercanía de fecha. Si hay búsqueda, filtra por nombre o detalle.
 */
export function candidatosEndoso(pagos: PagoCandidato[], cheque: { monto: number; fecha?: string | null }, busqueda = ''):
  (PagoCandidato & { exacto: boolean; diferencia: number })[] {
  const q = busqueda.trim().toLowerCase()
  const dias = (f: string | null | undefined) => (f && cheque.fecha ? Math.abs(new Date(f).getTime() - new Date(cheque.fecha).getTime()) / 86400000 : 9999)
  return pagos
    .filter(p => !q || `${p.nombre_proveedor || ''} ${p.descripcion || ''}`.toLowerCase().includes(q))
    .map(p => {
      const diferencia = Math.round(((Number(p.monto) || 0) - cheque.monto) * 100) / 100
      return { ...p, diferencia, exacto: Math.abs(diferencia) < 0.01 }
    })
    .sort((a, b) => (Math.abs(a.diferencia) - Math.abs(b.diferencia)) || (dias(a.fecha_pago) - dias(b.fecha_pago)))
}
