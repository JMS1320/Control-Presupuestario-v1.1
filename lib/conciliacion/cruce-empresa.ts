/**
 * 🔀 **Vincular un movimiento con algo de OTRA empresa, o de otro CUIT: nunca solo, siempre con
 * aviso** (A-BUG-1256).
 *
 * Regla del usuario 2026-10-14: *«para vincular cross company debe haber warning de por medio, nunca
 * algo automático o sin warning. Si difieren CUITs no debería suceder de forma automática tampoco»*.
 *
 * 🧨 El caso: dos **comisiones del banco** de MSA ($20.000 y $48.000) quedaron enganchadas a
 * facturas de **MA** sólo porque el importe coincidía. El motor admite a propósito que una cuenta
 * pague lo de otra empresa (es un retiro), y el último intento «por importe exacto» no miraba de
 * quién era la factura.
 *
 * Una sola regla para los dos caminos: el **motor** deja afuera lo que no puede vincular solo, y
 * la **asignación a mano** pregunta antes de guardar.
 */

/** ¿La fila es de otra empresa que la cuenta? Sólo si NINGUNA de sus empresas es la de la cuenta
 *  (un template MSA/PAM pagado desde MSA no es de otra). Sin empresa conocida, no opina. */
export function esDeOtraEmpresa(empresasFila: readonly string[] | null | undefined, empresaCuenta: string | null | undefined): boolean {
  const lista = (empresasFila ?? []).filter(Boolean)
  if (!empresaCuenta || lista.length === 0) return false
  return !lista.includes(empresaCuenta)
}

const digitos = (x: string | null | undefined) => (x ?? '').replace(/\D/g, '')

/** ¿El banco informa un CUIT y la fila tiene OTRO? Si alguno está en blanco, no opina. */
export function cuitDistinto(cuitBanco: string | null | undefined, cuitFila: string | null | undefined): boolean {
  const a = digitos(cuitBanco)
  const b = digitos(cuitFila)
  return !!a && !!b && a !== b
}

export interface FilaVinculable {
  empresas?: readonly string[] | null
  cuit_proveedor?: string | null
}

/** Lo que impide vincular SIN preguntar. Vacío = se puede vincular solo. */
export function motivosParaPreguntar(fila: FilaVinculable, empresaCuenta: string | null | undefined, cuitBanco: string | null | undefined): string[] {
  const motivos: string[] = []
  if (esDeOtraEmpresa(fila.empresas, empresaCuenta)) {
    motivos.push(`es de ${(fila.empresas ?? []).join('/')} y la cuenta es de ${empresaCuenta}: se registraría como retiro`)
  }
  if (cuitDistinto(cuitBanco, fila.cuit_proveedor)) {
    motivos.push(`el banco informa el CUIT ${digitos(cuitBanco)} y la factura/template es de ${digitos(fila.cuit_proveedor)}`)
  }
  return motivos
}

/** Para el motor: ¿puede vincularla sola? */
export const puedeVincularseSola = (fila: FilaVinculable, empresaCuenta: string | null | undefined, cuitBanco: string | null | undefined) =>
  motivosParaPreguntar(fila, empresaCuenta, cuitBanco).length === 0
