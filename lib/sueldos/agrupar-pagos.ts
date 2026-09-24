/**
 * 👥 Los pagos de sueldos, AGRUPADOS POR EMPLEADO (A-FEAT-77).
 *
 * ## Qué resuelve
 * La lista de pagos del mes venía plana y ordenada por nombre: con 7 empleados y varios pagos cada
 * uno —anticipo, saldo, a veces un tercero— hay que barrer la tabla entera para ver lo de una
 * persona. Textual del usuario, **pedido dos veces** (18/08 y 28/08): *«sino es difícil encontrar
 * un dato específico. poder ver sólo del empleado que quiero»*.
 *
 * Y una precisión suya del 2026-09-11: **vienen cerrados y se abren apretando.** Colapsado por
 * default, no expandido — la lista tiene que caber de una mirada antes de decidir dónde entrar.
 *
 * ## Por qué es una función y no un `reduce` adentro del componente
 * Porque lo que decide si sirve es **el orden y los totales**, y eso se puede equivocar en
 * silencio: un total por empleado que no suma sus pagos no falla, sólo miente. Acá se prueba con
 * números escritos a mano (§ lib/sicore/minimo.ts, mismo motivo).
 */

export interface PagoAgrupable {
  id: string
  empleado_id: string
  monto: number
  empleado?: { nombre?: string | null } | null
}

export interface GrupoDePagos<T extends PagoAgrupable> {
  empleadoId: string
  nombre: string
  pagos: T[]
  /** La suma de los pagos del grupo. Es el número que se ve con el grupo cerrado. */
  total: number
  cantidad: number
}

/**
 * Agrupa por empleado, **conservando el orden de los pagos dentro de cada grupo** y ordenando los
 * grupos por nombre.
 *
 * ⚠️ Se agrupa por **`empleado_id`, no por nombre**: dos empleados pueden llamarse igual, y un
 * nombre puede venir vacío. Agrupar por texto junta lo que no va junto — y en una pantalla de
 * plata eso se ve como un total inflado, no como un error.
 */
export function agruparPagosPorEmpleado<T extends PagoAgrupable>(pagos: T[]): GrupoDePagos<T>[] {
  const porEmpleado = new Map<string, GrupoDePagos<T>>()

  for (const p of pagos) {
    const clave = p.empleado_id
    const existente = porEmpleado.get(clave)
    if (existente) {
      existente.pagos.push(p)
      existente.total = Math.round((existente.total + (p.monto || 0)) * 100) / 100
      existente.cantidad += 1
    } else {
      porEmpleado.set(clave, {
        empleadoId: clave,
        nombre: (p.empleado?.nombre ?? '').trim() || '(sin nombre)',
        pagos: [p],
        total: Math.round((p.monto || 0) * 100) / 100,
        cantidad: 1,
      })
    }
  }

  return [...porEmpleado.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}
