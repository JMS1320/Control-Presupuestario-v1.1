/**
 * 🏡 DE QUIÉN ES CADA BIEN, Y DESDE CUÁNDO — para el código CONTABLE (A-FEAT-1532 / A-FEAT-1577 punto 12).
 *
 * JMS 07/11: *«las partidas de PAM pasan a MA salvo El Relincho y Quinta Rosello. El resto de las partidas de PAM a MA, y Libertad y
 * Posadas también. Desde 1/1/26 es MA. Libertad igual va 50/50»* · *«Nazarenas es todo el campo de San Pedro»* · *«MA siempre tuvo Lima»* ·
 * *«todo lo que estamos haciendo es para contable solamente»* (el interno se ve aparte).
 *
 * Una sola regla, para el control y para la app: dado el template de un pago y su fecha, de quién es el bien; y dado quién pagó, qué código
 * contable le corresponde (esquema «CTA + quién»: KNOWLEDGE § Los códigos CONTABLE / INTERNO).
 */

/** El día en que los bienes de PAM pasan a MA (contable). */
export const CORTE_PAM_A_MA = "2026-01-01"

/** Lo que PAM conserva (JMS 07/11): no pasa a MA. */
const QUEDAN_EN_PAM = /relincho|rosell[oó]/i
/** Qué es un BIEN (no un gasto de la sucesión): las partidas —inmobiliario y Red Vial— y la cochera de Posadas (expensas, ABL). */
const ES_BIEN = /inmobiliario|red vial|posadas|fondo educativo/i   // el Fondo Educativo es parte del inmobiliario de ARBA (va en el mismo pago)
/** Libertad: su código es LIB (reparto 50/50 propio, PAM hasta el corte y MA desde el corte) — esta regla no lo toca. */
const ES_LIBERTAD = /libertad/i

export type Empresa = "MSA" | "PAM" | "MA"

/**
 * De quién es el bien del template a esa fecha. `null` = no es un bien de los que cambian de dueño (un gasto de la empresa, una comisión,
 * Libertad): esta regla no opina.
 */
export function duenoDelBien(template: { nombre: string; responsable: string }, fecha: string): Empresa | null {
  const n = template.nombre ?? ""
  if (ES_LIBERTAD.test(n) || !ES_BIEN.test(n)) return null
  const resp = String(template.responsable ?? "").split("/")[0].trim().toUpperCase() as Empresa
  if (resp !== "PAM") return resp === "MA" || resp === "MSA" ? resp : null
  if (QUEDAN_EN_PAM.test(n)) return "PAM"
  return fecha.slice(0, 10) >= CORTE_PAM_A_MA ? "MA" : "PAM"
}

/**
 * El código contable que corresponde según quién pagó y de quién es el bien: el dueño mismo → vacío (`null`); MSA → «CTA <dueño>»;
 * PAM pagando algo de MA → «DIST MA» (lo de PAM a MA es distribución, JMS 07/11); MA pagando algo de PAM → «CTA PAM».
 */
export function codigoEsperado(pagador: Empresa, dueno: Empresa): string | null {
  if (pagador === dueno) return null
  if (pagador === "MSA") return `CTA ${dueno}`
  if (pagador === "PAM" && dueno === "MA") return "DIST MA"
  return `CTA ${dueno}`
}
