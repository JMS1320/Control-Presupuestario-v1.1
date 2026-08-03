// Sueldos para el presupuesto — el cálculo.
//
// Premisa que ordena todo, y la puso el usuario: **el presupuesto siempre representa la plantilla
// completa**. No se ajusta por altas ni bajas. De ahí se desprende que las cargas sociales NO
// pueden ser un % del bruto real (que sube y baja con la dotación): se carga un punto de arranque
// y se lo hace evolucionar igual que los sueldos.
//
// Lo que carga el usuario y lo que sale solo:
//
//   CARGA                                    SALE
//   sueldo total mensual (A+B)          →    el sueldo de cada mes, con IPC en escalones
//   francos promedio (días/mes)         →    los francos, APARTE del sueldo
//   premio: mes + múltiplo              →    ese pago, sobre el sueldo DE ESE MES
//   —                                   →    aguinaldo = 50 % del sueldo, en junio y diciembre
//   cargas sociales del 1er mes         →    las de los meses siguientes, +50 % en enero y julio
//
// El +50 % de SUSS cae en enero y julio y no en diciembre y junio: es **un mes después** del
// aguinaldo, porque las contribuciones del SAC se pagan al mes siguiente. Verificado en los datos
// reales: el template Cargas Sociales pasó de $1.763.175 en jun-26 a $2.495.548 en jul-26 (+41,5 %).

export interface EmpleadoPresupuesto {
  id: string
  nombre: string
  empresa: string | null
  /** Total mensual (A+B) que pone el usuario. NULL → se cae al período liquidado. */
  sueldo_presupuesto: number | null
  /** Días de franco por mes. El valor del día sale de sueldo/25, como en la liquidación. */
  francos_dias_promedio: number | null
  premio_mes: number | null
  premio_multiplo: number | null
}

export interface ParametrosSueldos {
  /** Cada cuántos meses se actualizan los sueldos. NULL o 0 = no se actualizan. */
  ipcEscalonMeses: number | null
  /** Inflación mensual a usar en el escalón (fracción: 0.02 = 2 %). */
  inflacionMensual: number
  /** Cargas sociales del primer mes proyectado. */
  sussBase: number | null
}

export interface Mes { anio: number; mes: number }

export interface LineaSueldo {
  clave: string
  sueldo: number
  francos: number
  premio: number
  aguinaldo: number
  total: number
  /** En castellano, para el tooltip: de dónde salió cada peso. */
  detalle: string
}

const clave = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}`
const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

/** El valor del día de franco. Mismo criterio que la liquidación: el sueldo dividido 25. */
export const valorFranco = (sueldo: number) => sueldo / 25

/**
 * Cuánto multiplica la inflación en el mes `i`, con actualizaciones ESCALONADAS.
 *
 * No se actualiza todos los meses: se actualiza cada N. Entre escalón y escalón el sueldo queda
 * quieto, que es lo que pasa en la realidad — las paritarias son saltos, no una curva.
 */
export function factorEscalon(i: number, p: ParametrosSueldos): number {
  const n = p.ipcEscalonMeses ?? 0
  if (n <= 0 || p.inflacionMensual <= 0) return 1
  const escalonesPasados = Math.floor(i / n)
  return Math.pow(1 + p.inflacionMensual, n * escalonesPasados)
}

/**
 * Los sueldos de un empleado, mes a mes.
 *
 * Si no tiene `sueldo_presupuesto` devuelve la lista vacía: NO devuelve ceros. La diferencia
 * importa — un cero es indistinguible de "no cargado", y así el que llama puede caer al período
 * liquidado en vez de mostrar un empleado que cuesta nada.
 */
export function proyectarEmpleado(
  e: EmpleadoPresupuesto,
  meses: Mes[],
  p: ParametrosSueldos,
): LineaSueldo[] {
  const base = e.sueldo_presupuesto
  if (base == null || base <= 0) return []

  return meses.map((m, i) => {
    const sueldo = base * factorEscalon(i, p)
    const dias = e.francos_dias_promedio ?? 0
    const francos = dias > 0 ? valorFranco(sueldo) * dias : 0

    // El premio se calcula sobre el sueldo DE ESE MES, no sobre el actual: si hubo aumento en
    // el medio, el premio lo toma. Es lo que pidió el usuario.
    const premio = e.premio_mes === m.mes && e.premio_multiplo
      ? sueldo * e.premio_multiplo
      : 0

    // Aguinaldo: 50 % del sueldo, en junio y diciembre. Sobre el TOTAL (A+B), no sobre el %A
    // —el usuario lo corrigió expresamente— así que es sueldo × 0,5 y nada más.
    const aguinaldo = (m.mes === 6 || m.mes === 12) ? sueldo * 0.5 : 0

    const partes = [`sueldo ${pesos(sueldo)}`]
    if (francos > 0) partes.push(`${dias} francos ${pesos(francos)}`)
    if (premio > 0) partes.push(`premio ×${e.premio_multiplo} ${pesos(premio)}`)
    if (aguinaldo > 0) partes.push(`aguinaldo ${pesos(aguinaldo)}`)

    return {
      clave: clave(m.anio, m.mes),
      sueldo, francos, premio, aguinaldo,
      total: sueldo + francos + premio + aguinaldo,
      detalle: partes.join(' + '),
    }
  })
}

/**
 * Cargas sociales (SUSS) mes a mes.
 *
 * Arranca del monto que carga el usuario, sube con el MISMO escalón que los sueldos, y lleva
 * **+50 % en enero y julio** — un mes después del aguinaldo.
 *
 * No se calcula como % del bruto a propósito: el bruto real cambia con altas y bajas, y el
 * presupuesto representa la plantilla completa. Un % lo haría bailar por razones que no son
 * presupuestarias.
 */
export function proyectarSuss(
  meses: Mes[],
  p: ParametrosSueldos,
): { clave: string; monto: number; detalle: string }[] {
  const base = p.sussBase
  if (base == null || base <= 0) return []

  return meses.map((m, i) => {
    const conIpc = base * factorEscalon(i, p)
    const saltoSac = m.mes === 1 || m.mes === 7
    const monto = saltoSac ? conIpc * 1.5 : conIpc
    return {
      clave: clave(m.anio, m.mes),
      monto,
      detalle: saltoSac
        ? `${pesos(conIpc)} + 50 % por las contribuciones del aguinaldo`
        : pesos(conIpc),
    }
  })
}

/** Lo que falta para que el presupuesto de sueldos sea confiable. Vacío = está completo. */
export function faltantesSueldos(
  empleados: EmpleadoPresupuesto[],
  p: ParametrosSueldos,
): string[] {
  const out: string[] = []
  const sinSueldo = empleados.filter(e => e.sueldo_presupuesto == null || e.sueldo_presupuesto <= 0)
  if (sinSueldo.length > 0) {
    out.push(
      `${sinSueldo.length} ${sinSueldo.length === 1 ? 'empleado sin sueldo' : 'empleados sin sueldo'} de presupuesto: ` +
      sinSueldo.map(e => e.nombre).join(', '))
  }
  if (p.sussBase == null || p.sussBase <= 0) out.push('falta la base de cargas sociales')
  if (!p.ipcEscalonMeses) out.push('falta definir cada cuántos meses se actualizan los sueldos')
  return out
}
