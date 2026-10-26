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

/** Una fila del plan con los dos nombres que puede traer (`categ` es el que se guarda en la factura). */
export interface FilaDelPlan extends CuentaDelPlan {
  cuenta_contable?: string | null
  tipo?: string | null
}

/**
 * 🛡️ **Los nombres de cuenta que puede llevar una FACTURA** — y por lo tanto su movimiento.
 *
 * Quedan afuera las cuentas **financieras sin número** (FCI, CAJA, Tarjetas MSA, CRED P, PLAZO FIJO,
 * INTER…): son clasificaciones de otro sistema (A-BUG-1225) y la propagación **nunca** las pisa —
 * pisar FCI con una cuenta de gasto infla el presupuesto con plata que sigue siendo de la empresa.
 * INTERESES sí entra: es financiera pero tiene número, una factura puede llevarla.
 */
export function nombresDeCuentasDeFactura(plan: readonly FilaDelPlan[]): string[] {
  return plan
    .filter(f => !(String(f.tipo ?? '').toLowerCase() === 'financiero' && nroTexto(f.nro_cuenta) === null))
    .flatMap(f => [f.categ, f.cuenta_contable ?? ''])
    .map(x => String(x ?? '').trim())
    .filter(Boolean)
}

/** El par que se guarda: siempre los dos juntos. `null` = la factura queda SIN cuenta. */
export interface ParDeCuenta {
  cuenta_contable: string
  nro_cuenta: string | null
}

export type ResultadoResolver =
  | { ok: true; cuenta: ParDeCuenta | null }
  | { ok: false; error: string }

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()
const nroTexto = (n: unknown) => (n === null || n === undefined || String(n).trim() === '' ? null : String(n).trim())

/**
 * 🔒 **A-BUG-1371 — el par sale del PLAN, nunca de lo que mandó la pantalla.**
 *
 * Regla del usuario 2026-10-25: *«siempre número y cuenta van juntos, eso debe ser riguroso; si no es
 * un fallo grave, porque son lo mismo»*. Entonces quien guarda no confía en el par que le llega: lo
 * busca en el plan y guarda **la fila del plan**. Lo que no se puede resolver sin adivinar se rechaza.
 *
 * - Sin número y sin nombre → `cuenta: null` (quitar la cuenta: los dos quedan vacíos).
 * - Con número → la fila de ese número; si además vino nombre, tiene que ser el de esa fila.
 * - Sólo nombre → la fila de ese nombre (por `categ`, o por `cuenta_contable` si no aparece).
 * - Un nombre o número que no está en el plan → error. Uno que está dos veces con números distintos → error.
 */
export function resolverCuentaDelPlan(
  plan: readonly FilaDelPlan[],
  entrada: { nro_cuenta?: string | number | null; cuenta_contable?: string | null },
): ResultadoResolver {
  const nro = nroTexto(entrada.nro_cuenta)
  const nombre = norm(entrada.cuenta_contable)
  if (!nro && !nombre) return { ok: true, cuenta: null }

  const deNombre = (f: FilaDelPlan) => norm(f.categ) === nombre || norm(f.cuenta_contable) === nombre
  const par = (f: FilaDelPlan): ParDeCuenta => ({ cuenta_contable: String(f.categ).trim(), nro_cuenta: nroTexto(f.nro_cuenta) })

  if (nro) {
    const conNro = plan.filter(f => nroTexto(f.nro_cuenta) === nro)
    if (conNro.length === 0) return { ok: false, error: `El número de cuenta ${nro} no está en el plan de cuentas` }
    if (nombre) {
      const f = conNro.find(deNombre)
      if (!f) return { ok: false, error: `El número ${nro} es de «${conNro[0].categ}», no de «${entrada.cuenta_contable}»` }
      return { ok: true, cuenta: par(f) }
    }
    if (conNro.length > 1) return { ok: false, error: `El número ${nro} está en ${conNro.length} cuentas del plan: elegila por nombre` }
    return { ok: true, cuenta: par(conNro[0]) }
  }

  let candidatas = plan.filter(f => norm(f.categ) === nombre)
  if (candidatas.length === 0) candidatas = plan.filter(f => norm(f.cuenta_contable) === nombre)
  if (candidatas.length === 0) return { ok: false, error: `«${entrada.cuenta_contable}» no está en el plan de cuentas` }
  const numeros = new Set(candidatas.map(f => nroTexto(f.nro_cuenta)))
  if (numeros.size > 1) return { ok: false, error: `«${entrada.cuenta_contable}» está en el plan con números distintos (${[...numeros].join(', ')}): elegila por número` }
  return { ok: true, cuenta: par(candidatas[0]) }
}

/** ¿El par guardado coincide con una fila del plan? Vacío en los dos también es coherente (sin cuenta). */
export function parCoincideConPlan(
  plan: readonly FilaDelPlan[],
  cuenta_contable: string | null | undefined,
  nro_cuenta: string | number | null | undefined,
): boolean {
  const nombre = norm(cuenta_contable)
  const nro = nroTexto(nro_cuenta)
  if (!nombre && !nro) return true
  if (!nombre) return false
  return plan.some(f => (norm(f.categ) === nombre || norm(f.cuenta_contable) === nombre) && nroTexto(f.nro_cuenta) === nro)
}
