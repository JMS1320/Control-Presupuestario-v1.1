/**
 * 🗓️ **Planilla de asistencia — el cálculo de los francos trabajados** (A-FEAT-1259, 2026-10-09).
 *
 * La regla, en palabras del usuario: *«F = 1 franco tomado, 1/2 = medio día trabajado… los sábados es medio
 * franco, lo que no suma ni resta, y el domingo entero. Si un mes tiene 4 sáb y 4 dom se debería haber tomado
 * medio sábado y un domingo por semana = 6 francos en total. Si se tomó más descuenta, si se tomó menos suma…
 * los feriados son como domingos»*.
 *
 * Cada día tiene un **esperado** de trabajo y se compara con lo **marcado**:
 *
 * | Día                 | esperado | P (presente) | ½ (medio día) | F (franco) |
 * |---------------------|----------|--------------|---------------|------------|
 * | lunes a viernes     | 1        | 0            | −½            | −1         |
 * | sábado              | ½        | +½           | 0             | −½         |
 * | domingo / feriado   | 0        | +1           | +½            | 0          |
 *
 * **Francos trabajados = Σ (trabajado − esperado)**, que es lo mismo que *francos que le correspondían − francos
 * que se tomó*. V (vacaciones) y L (licencia) **no suman ni restan**: el día queda fuera de las dos cuentas.
 * Un día sin marcar tampoco cuenta, y deja el mes **incompleto** (no se pasa al sueldo hasta completarlo).
 * Los días fuera del contrato (alta o baja a mitad de mes) no existen para la planilla.
 *
 * Es lógica pura: sin base, con sus casos en `lib/pruebas/casos.ts`.
 */

export type Marca = "P" | "F" | "M" | "V" | "L"

/** Las marcas en el orden en que se ofrecen, con lo que se ve en la celda. «M» se muestra «½». */
export const MARCAS: { marca: Marca; etiqueta: string; titulo: string }[] = [
  { marca: "P", etiqueta: "P", titulo: "Presente" },
  { marca: "F", etiqueta: "F", titulo: "Franco tomado (día libre entero)" },
  { marca: "M", etiqueta: "½", titulo: "Medio día trabajado" },
  { marca: "V", etiqueta: "V", titulo: "Vacaciones (no suma ni resta)" },
  { marca: "L", etiqueta: "L", titulo: "Licencia / enfermedad (no suma ni resta)" },
]
export const etiquetaMarca = (m: Marca | null | undefined) => MARCAS.find(x => x.marca === m)?.etiqueta ?? ""

/** Lo que vale trabajado cada marca. V y L no tienen valor: quedan fuera de la cuenta. */
const TRABAJADO: Partial<Record<Marca, number>> = { P: 1, M: 0.5, F: 0 }

export type TipoDia = "habil" | "sabado" | "domingo" | "feriado"

const dosD = (n: number) => String(n).padStart(2, "0")
/** Los días del mes como `YYYY-MM-DD`. Calendario puro (UTC): no depende de la hora del navegador. */
export function diasDelMes(anio: number, mes: number): string[] {
  const n = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  return Array.from({ length: n }, (_, i) => `${anio}-${dosD(mes)}-${dosD(i + 1)}`)
}
const diaSemana = (fecha: string) => new Date(fecha + "T00:00:00Z").getUTCDay()   // 0 domingo … 6 sábado

/** Un feriado que cuenta pesa más que el día de la semana: un sábado feriado es como un domingo. */
export function tipoDia(fecha: string, feriados: Set<string>): TipoDia {
  if (feriados.has(fecha)) return "feriado"
  const d = diaSemana(fecha)
  return d === 0 ? "domingo" : d === 6 ? "sabado" : "habil"
}
export function esperadoDelDia(fecha: string, feriados: Set<string>): number {
  const t = tipoDia(fecha, feriados)
  return t === "habil" ? 1 : t === "sabado" ? 0.5 : 0
}

export interface Contrato { fecha_ingreso?: string | null; fecha_egreso?: string | null }
export const enContrato = (fecha: string, c: Contrato) =>
  (!c.fecha_ingreso || fecha >= c.fecha_ingreso) && (!c.fecha_egreso || fecha <= c.fecha_egreso)

export interface ResumenMes {
  /** Días del mes dentro del contrato. */
  dias: number
  /** Días del contrato todavía vacíos. Con alguno, el mes está incompleto. */
  sinMarcar: number
  completo: boolean
  /** Francos que le correspondían (Σ 1 − esperado, sin contar V/L ni vacíos). */
  corresponden: number
  /** Francos que se tomó (Σ 1 − trabajado, igual universo). */
  tomados: number
  /** = corresponden − tomados. **Lo que va al sueldo**: negativo resta. */
  francosTrabajados: number
  /** Σ trabajado (P = 1, ½ = 0,5), cualquier día de la semana: **lo que va al sueldo de los que cobran por jornal**
   *  (valor del día × días). Para ellos los francos no se usan. */
  diasTrabajados: number
  vacaciones: number
  licencias: number
}

export function resumirMes(anio: number, mes: number, marcas: Record<string, Marca | undefined>,
                           feriados: Set<string>, contrato: Contrato = {}): ResumenMes {
  const r: ResumenMes = { dias: 0, sinMarcar: 0, completo: true, corresponden: 0, tomados: 0, francosTrabajados: 0,
                          diasTrabajados: 0, vacaciones: 0, licencias: 0 }
  for (const f of diasDelMes(anio, mes)) {
    if (!enContrato(f, contrato)) continue
    r.dias++
    const m = marcas[f]
    if (!m) { r.sinMarcar++; continue }
    if (m === "V") { r.vacaciones++; continue }
    if (m === "L") { r.licencias++; continue }
    const trabajado = TRABAJADO[m]!, esperado = esperadoDelDia(f, feriados)
    r.corresponden += 1 - esperado
    r.tomados += 1 - trabajado
    r.diasTrabajados += trabajado
  }
  r.completo = r.sinMarcar === 0
  r.francosTrabajados = r.corresponden - r.tomados
  return r
}

/**
 * «Llenar con P» (o «Llenar con F», el caso al revés: se marcan los días que vino y el resto es franco).
 * Pone la marca en los días VACÍOS del contrato; lo ya marcado no se toca. Devuelve SÓLO lo nuevo.
 */
export function llenarCon(anio: number, mes: number, marcas: Record<string, Marca | undefined>,
                          contrato: Contrato = {}, marca: Marca = "P"): Record<string, Marca> {
  const nuevas: Record<string, Marca> = {}
  for (const f of diasDelMes(anio, mes)) if (enContrato(f, contrato) && !marcas[f]) nuevas[f] = marca
  return nuevas
}
export const llenarConPresente = (anio: number, mes: number, marcas: Record<string, Marca | undefined>, contrato: Contrato = {}) =>
  llenarCon(anio, mes, marcas, contrato, "P")

/** Número de francos en es-AR, sin ceros de más: 6 · 2,5 · −1. */
export const fmtFrancos = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
