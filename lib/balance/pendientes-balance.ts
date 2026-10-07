/**
 * 📌 **Pendientes a revisar de los papeles de trabajo** — A-FEAT-1258 (2026-10-07).
 *
 * Pedido del usuario: *«que cuando hago el export salga el pendiente de chequear; y cuando trabajo desde
 * la app con este export, poder agregar pendientes a esta sección; y que quede a la vista al estar
 * trabajando en esto desde la app»*. Viven en `public.balance_pendientes` (por empresa y año de cierre);
 * un pendiente no se borra: se **resuelve** con una nota, y queda la historia de qué se revisó.
 *
 * Esta parte es pura: arma la solapa del Excel.
 */

export interface PendienteBalance {
  id: string
  empresa: string
  anio_cierre: number
  texto: string
  estado: 'abierto' | 'resuelto'
  resolucion: string | null
  created_at: string
  resuelto_at: string | null
}

const dmy = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')

/** La solapa del export: primero los abiertos (es lo que hay que mirar), después los resueltos con su nota. */
export function hojaDePendientes(pendientes: PendienteBalance[], encabezado: string): unknown[][] {
  const abiertos = pendientes.filter(p => p.estado === 'abierto').sort((a, b) => a.created_at.localeCompare(b.created_at))
  const resueltos = pendientes.filter(p => p.estado === 'resuelto').sort((a, b) => (a.resuelto_at || '').localeCompare(b.resuelto_at || ''))
  const filas: unknown[][] = [
    [encabezado],
    [abiertos.length ? `${abiertos.length} pendiente(s) a revisar antes de dar el balance por cerrado` : '✓ Sin pendientes abiertos'],
    [],
    ['#', 'Pendiente', 'Anotado', 'Estado', 'Resolución', 'Resuelto'],
  ]
  ;[...abiertos, ...resueltos].forEach((p, i) => filas.push([
    i + 1, p.texto, dmy(p.created_at), p.estado === 'abierto' ? 'ABIERTO' : 'resuelto', p.resolucion || '', dmy(p.resuelto_at),
  ]))
  return filas
}
