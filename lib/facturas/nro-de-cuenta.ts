/**
 * 🔗 LA CUENTA Y SU NÚMERO SON UNA SOLA COSA (A-BUG-1249).
 *
 * Regla del usuario, 2026-10-13: *«la cuenta y el nro son 1 sola cosa. Yo no hablo de las 2 porque
 * lo entiendo por sobreentendido»*. En una factura viven en dos columnas (`cuenta_contable` = el
 * nombre, `nro_cuenta` = el número del plan), y había caminos que escribían sólo el nombre: la
 * importación de ARCA (por regla de CUIT o eligiéndola en la vista previa) y la edición de la celda
 * en Cash Flow y en Facturas ARCA. **Medido ese día: 174 facturas con nombre y sin número.**
 *
 * Todo camino que escriba el nombre pasa por acá para escribir también el número.
 */

export interface CuentaDelPlan {
  categ: string
  nro_cuenta: string | number | null
}

/**
 * El número de cuenta del plan que corresponde a un nombre de cuenta.
 * `null` si el nombre está vacío, no está en el plan, o la cuenta no tiene número cargado.
 */
export function nroDeCuenta(nombre: string | null | undefined, plan: readonly CuentaDelPlan[]): string | null {
  const k = (nombre ?? '').trim().toLowerCase()
  if (!k) return null
  const cuenta = plan.find(c => (c.categ ?? '').trim().toLowerCase() === k)
  const nro = cuenta?.nro_cuenta
  return nro === null || nro === undefined || String(nro).trim() === '' ? null : String(nro)
}
