/**
 * 🔍 **EL LIBRO H PARA AUDITAR — quién pagó cada cuota y qué efecto tiene** (A-FEAT-1579, JMS 07/11).
 *
 * JMS: *«lo que tengo que hacer es auditar… ver que cada cosa tenga sus pagos… quién lo pagó y si es retiro o aporte es secundario a
 * se pagó»* · *«es la tabla que ya tenemos en el reporte templates integral, sería agregarle más columnas»*. Acordado: una base, dos
 * salidas (el H del contador no cambia); la cuota pagada va por su fecha de pago y la impaga queda a la vista, resaltada.
 *
 * Por cuota: **Quién pagó** (la empresa de la cuenta del movimiento) · **Código contable** del movimiento · **Efecto** en palabras
 * («retiro de MA pagado por MSA») · **Marca** de auditoría. De quién es el gasto: el dueño del bien a esa fecha si es un bien que cambió
 * de dueño (`duenoDelBien`), si no el responsable del template. Pura.
 */
import type { CuotaTemplate } from "./templates-libro"
import { duenoDelBien, codigoEsperado, type Empresa } from "./dueno-de-bienes"
import { cuotaSinPago } from "./grupos-templates"

export interface AuditoriaDeCuota {
  quienPago: string
  codigo: string
  efecto: string
  marca: string
}

const EMPRESAS = new Set(["MSA", "PAM", "MA"])
const primero = (r: string) => (r || "").split("/")[0].trim().toUpperCase()

/** De quién es el gasto de la cuota: el dueño del bien a esa fecha, o el responsable del template. */
export function duenoDelGasto(c: CuotaTemplate): string {
  return duenoDelBien({ nombre: c.concepto, responsable: c.responsable }, c.fecha ?? "") ?? primero(c.responsable)
}

/** El efecto en palabras de que `pagador` pague un gasto de `dueno`. Vacío = lo pagó el dueño (no hay efecto). */
export function efectoEntre(pagador: string, dueno: string): string {
  if (!pagador || !dueno || pagador === dueno) return ""
  if (pagador === "MSA") return `retiro de ${dueno} pagado por MSA`
  if (dueno === "MSA") return `aporte de ${pagador} (pagó un gasto de MSA)`
  if (pagador === "PAM" && dueno === "MA") return "distribución de PAM a MA"
  return `${pagador} pagó por ${dueno}`
}

/** El efecto que dice un código contable puesto por quien pagó: «CTA MA» pagado por MSA = retiro de MA; «DIST X» = distribución a X. */
export function efectoDelCodigo(pagador: string, codigo: string): string {
  const m = codigo.trim().match(/^(CTA|CUENTA|DIST|RET)\s+(.+)$/i)
  if (!m) return /^FLIA\b/i.test(codigo) ? "gasto de la familia (FLIA)" : `código ${codigo}`
  const quien = m[2].trim().toUpperCase()
  if (/^DIST$/i.test(m[1])) return `distribución de ${pagador} a ${quien}`
  return pagador === "MSA" ? `retiro de ${quien} pagado por MSA` : `${pagador} pagó por cuenta de ${quien}`
}

export function auditarCuota(c: CuotaTemplate): AuditoriaDeCuota {
  const sinPago = cuotaSinPago(c)
  const b = c.banco
  const pagadores = (b?.titular ?? "").split(" + ").map(s => s.trim().toUpperCase()).filter(Boolean)
  const quienPago = sinPago ? "" : pagadores.length ? pagadores.join(" + ") + (b?.cuenta ? ` · ${b.cuenta}` : "") : ""
  const codigo = (b?.contable ?? "").trim()
  const dueno = duenoDelGasto(c)
  let efecto = "", aviso = ""
  if (!sinPago && pagadores.length === 1) {
    efecto = efectoEntre(pagadores[0], dueno)
    if (/^LIB\b/i.test(codigo)) efecto = "Libertad (LIB): reparto propio"
    // lo pagó el dueño y el movimiento tiene código: es un retiro o una distribución en sí (el template «Retiro MA mensual»):
    // el efecto lo dice el código, y no hay nada que avisar
    else if (!efecto && codigo) efecto = efectoDelCodigo(pagadores[0], codigo)
    else if (EMPRESAS.has(pagadores[0]) && EMPRESAS.has(dueno)) {
      const esperado = codigoEsperado(pagadores[0] as Empresa, dueno as Empresa) ?? ""
      if (esperado.toUpperCase() !== codigo.toUpperCase()) aviso = ` · ⚠️ código esperado: ${esperado || "(vacío)"}`
    }
  } else if (pagadores.length > 1) efecto = "pagada desde varias cuentas: ver una por una"

  let marca: string
  if (sinPago) marca = Math.abs(c.monto) < 0.005 ? "⚪ en $ 0 (no se pagó nada)" : "🔴 SIN PAGAR"
  else if (b && !b.cuenta) marca = "🟡 marcada pagada, sin movimiento en el banco"
  else if (b?.motivo) marca = `🟡 ${b.motivo}`
  else marca = b ? "✓" : ""
  return { quienPago, codigo, efecto, marca: marca + aviso }
}
