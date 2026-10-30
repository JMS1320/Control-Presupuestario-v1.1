/**
 * 💸 **A-BUG-1431 — cambiar el «a pagar» de un GRUPO reparte el total, no lo copia.**
 *
 * Nota de JMS 30/10, sobre Red Vial Rojas MSA: *«al modificar monto a pagar del grupo asigna a todas
 * sus componentes. Debe preguntar y proponer cómo repartir»*.
 *
 * 🐞 Lo que pasaba: el Cash Flow mandaba el total nuevo como `monto` (o `monto_a_abonar`) **de cada
 * miembro**. Un grupo de 2 cuotas al que se le ponía $ 3 M quedaba en $ 6 M.
 *
 * 🔑 La propuesta es **proporcional a lo que hoy tiene cada miembro** (si todos están en cero, en
 * partes iguales). Es el default: el usuario puede pisar cualquier renglón — § Default del dato real.
 * Los centavos que deja el redondeo van al miembro más grande, para que la suma dé **exacto**.
 */

export interface MiembroGrupo {
  id: string
  /** Lo que tiene hoy (en pesos). */
  actual: number
}

const aCentavos = (n: number) => Math.round((Number(n) || 0) * 100)

/** Propone cuánto le toca a cada miembro para que el grupo sume `nuevoTotal`. */
export function proponerReparto(miembros: MiembroGrupo[], nuevoTotal: number): Record<string, number> {
  const res: Record<string, number> = {}
  if (miembros.length === 0) return res
  const total = aCentavos(nuevoTotal)
  const base = miembros.map(m => Math.max(0, aCentavos(m.actual)))
  const sumaBase = base.reduce((s, x) => s + x, 0)
  const partes = miembros.map((_, i) =>
    sumaBase > 0 ? Math.floor((total * base[i]) / sumaBase) : Math.floor(total / miembros.length))
  // El resto de centavos va al miembro más grande (o al primero, si todos son iguales).
  const resto = total - partes.reduce((s, x) => s + x, 0)
  let mayor = 0
  base.forEach((b, i) => { if (b > base[mayor]) mayor = i })
  partes[mayor] += resto
  miembros.forEach((m, i) => { res[m.id] = partes[i] / 100 })
  return res
}

/**
 * El control del reparto: lo que suman los renglones contra el total que pidió el usuario.
 * Es integridad (el reparto se contradice con el total), así que si no cierra **no se guarda**.
 */
export function controlReparto(reparto: Record<string, number>, nuevoTotal: number): { suma: number; diferencia: number; cierra: boolean } {
  const suma = Object.values(reparto).reduce((s, x) => s + aCentavos(x), 0)
  const diferencia = (aCentavos(nuevoTotal) - suma) / 100
  return { suma: suma / 100, diferencia, cierra: Math.abs(diferencia) < 0.005 }
}
