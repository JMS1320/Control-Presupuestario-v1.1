/**
 * 🌾 Arrendamientos — cómo se NUMERAN las cuotas y cuánto está VENDIDO, a simple vista.
 *
 * A-FEAT-1643 (nota 🌙 JMS 12/11): *«el tema de nros de cuota está mal. Son 3 cuotas para Sanpa y 2 para Ceibos
 * (Provinvest); el resto son partes de la cuota o una cuota que se va vendiendo de a poco»*. En la base cada parte
 * es una fila con su propio `numero_cuota` (1..n). Medido el 22/11: en Rojas (Sanpa) 26/27 hay 5 filas en 3 FECHAS
 * de cobro, y en Nazarenas (Provinvest) 3 filas en 2 fechas — justo lo que dice JMS. Entonces la CUOTA es la fecha de
 * cobro, y las filas que comparten fecha son sus partes (A, B…). Sólo cambia cómo se muestra: la base no se toca.
 *
 * A-FEAT-1642 (nota 🌙 JMS 12/11): *«ver rápidamente cuánto ya vendí, cuánto no vendí, qué tan expuesto o no estoy»*.
 */

export interface CuotaParaNumerar { id: string; numero_cuota: number; fecha_cobro_estimada: string }
export interface NumeroCuota {
  /** 1, 2, 3… por fecha de cobro */
  nro: number
  /** «A», «B»… si la cuota tiene más de una parte; null si es una sola */
  parte: string | null
  /** cuántas cuotas (fechas) tiene el contrato */
  de: number
  /** «2» o «2B» */
  etiqueta: string
}

export function numerarCuotas(cuotas: readonly CuotaParaNumerar[]): Record<string, NumeroCuota> {
  const fechas = [...new Set(cuotas.map(q => q.fecha_cobro_estimada))].sort()
  const out: Record<string, NumeroCuota> = {}
  fechas.forEach((f, i) => {
    const partes = cuotas.filter(q => q.fecha_cobro_estimada === f).sort((a, b) => a.numero_cuota - b.numero_cuota)
    partes.forEach((q, j) => {
      const parte = partes.length > 1 ? String.fromCharCode(65 + j) : null
      out[q.id] = { nro: i + 1, parte, de: fechas.length, etiqueta: `${i + 1}${parte ?? ""}` }
    })
  })
  return out
}

export interface VentaParaPosicion { tons: number; modo: "matba" | "pizarra"; tc: number | null }
export interface Posicion {
  total: number
  /** vendido con el precio en pesos ya cerrado (pizarra, o dólar ya pesificado) */
  enPesos: number
  /** vendido en dólares que todavía no se pesificó */
  enDolaresSinPesificar: number
  /** lo que falta vender */
  sinVender: number
}

/**
 * La posición de un conjunto de cuotas: toneladas totales y cómo se reparten. Cierra siempre:
 * `enPesos + enDolaresSinPesificar + sinVender = total` (si se vendió de más, `sinVender` queda en 0 y se
 * informa el exceso en el total vendido).
 */
export function posicionDe(
  tonsPorCuota: readonly { tons: number; ventas: readonly VentaParaPosicion[] }[],
): Posicion {
  let total = 0, enPesos = 0, enDolares = 0, sinVender = 0
  for (const q of tonsPorCuota) {
    total += q.tons
    let vendida = 0
    for (const v of q.ventas) {
      const t = Number(v.tons) || 0
      vendida += t
      if (v.modo === "pizarra" || (v.tc != null && Number(v.tc) > 0)) enPesos += t
      else enDolares += t
    }
    sinVender += Math.max(0, q.tons - vendida)
  }
  return { total, enPesos, enDolaresSinPesificar: enDolares, sinVender }
}
