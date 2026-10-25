/**
 * 🔀 **Vincular un movimiento con algo de OTRA empresa, o de otro CUIT: nunca solo, siempre con
 * aviso** (A-BUG-1256).
 *
 * Regla del usuario 2026-10-14: *«para vincular cross company debe haber warning de por medio, nunca
 * algo automático o sin warning. Si difieren CUITs no debería suceder de forma automática tampoco»*.
 * ⚠️ Precisada el mismo día: *«los templates sí se pueden conciliar cross company; lo que me refería
 * es a las facturas… las cosas que no coinciden en CUIT nunca deben conciliarse salvo que yo lo
 * fuerce»*. O sea: **otra empresa** frena sólo a las **facturas**; **otro CUIT** frena a todo.
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
  /** `ARCA` = factura. Sólo a las facturas las frena ser de otra empresa; un template no. */
  origen?: string | null
  empresas?: readonly string[] | null
  cuit_proveedor?: string | null
}

/** Lo que impide vincular SIN preguntar. Vacío = se puede vincular solo. */
export function motivosParaPreguntar(fila: FilaVinculable, empresaCuenta: string | null | undefined, cuitBanco: string | null | undefined): string[] {
  const motivos: string[] = []
  if ((fila.origen ?? 'ARCA') === 'ARCA' && esDeOtraEmpresa(fila.empresas, empresaCuenta)) {
    motivos.push(`la factura es de ${(fila.empresas ?? []).join('/')} y la cuenta es de ${empresaCuenta}: se registraría como retiro`)
  }
  if (cuitDistinto(cuitBanco, fila.cuit_proveedor)) {
    motivos.push(`el banco informa el CUIT ${digitos(cuitBanco)} y la factura/template es de ${digitos(fila.cuit_proveedor)}`)
  }
  return motivos
}

/** Para el motor: ¿puede vincularla sola? */
export const puedeVincularseSola = (fila: FilaVinculable, empresaCuenta: string | null | undefined, cuitBanco: string | null | undefined) =>
  motivosParaPreguntar(fila, empresaCuenta, cuitBanco).length === 0

/**
 * 🔀 **A-FEAT-1370 — la factura de OTRA empresa se PROPONE a auditar, no queda sin conciliar.**
 *
 * Pedido del usuario 2026-10-25: *«respecto a fc cross compañía estaría bueno que quede en audit en
 * vez de sin conciliar… si coincide monto, fecha parecida, o fecha no tan parecida pero hay
 * coincidencia de CUIT»*. Caso: la tarjeta de MA paga DirecTV, combustible y la VTV facturados a MSA.
 *
 * Lo que NO cambia de A-BUG-1256: **nunca se concilia sola** (siempre `auditar`, con el motivo de
 * que se registraría como retiro) y **otro CUIT frena igual**. Se busca sólo después de que el motor
 * no encontró nada de la propia empresa.
 *
 * Cuándo propone (importe igual, hasta $1 de diferencia, y **un solo candidato**):
 * - el **CUIT del banco coincide** con el de la factura y la fecha está a ≤ `DIAS_CON_CUIT`; o
 * - sin CUIT que la respalde, la fecha está dentro de la tolerancia (5 días).
 * Con dos candidatas no elige ninguna: elegir sería adivinar.
 */
export const DIAS_CON_CUIT = 45

export interface CandidatoOtraEmpresa extends FilaVinculable {
  id: string | number
  debitos?: number | null
  creditos?: number | null
  fecha_estimada?: string | null
}

export interface MovimientoOtraEmpresa {
  debitos?: number | null
  creditos?: number | null
  fecha?: string | null
}

const diasEntre = (a?: string | null, b?: string | null): number | null => {
  if (!a || !b) return null
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : null
}

export function buscarFacturaDeOtraEmpresa<T extends CandidatoOtraEmpresa>(
  mov: MovimientoOtraEmpresa,
  pool: readonly T[],
  empresaCuenta: string | null | undefined,
  cuitBanco: string | null | undefined,
  toleranciaDias = 5,
): { candidato: T; motivo: string } | null {
  const debito = Number(mov.debitos) || 0
  const credito = Number(mov.creditos) || 0
  const importe = debito > 0 ? debito : credito
  if (!(importe > 0) || !empresaCuenta) return null
  const ladoDebito = debito > 0
  const cuitB = digitos(cuitBanco)

  const elegibles = pool
    .filter(f => (f.origen ?? 'ARCA') === 'ARCA' && esDeOtraEmpresa(f.empresas, empresaCuenta) && !cuitDistinto(cuitBanco, f.cuit_proveedor))
    .map(f => ({
      f,
      dif: Math.abs((Number(ladoDebito ? f.debitos : f.creditos) || 0) - importe),
      dias: diasEntre(mov.fecha, f.fecha_estimada),
      cuitIgual: !!cuitB && digitos(f.cuit_proveedor) === cuitB,
    }))
    .filter(x => x.dif <= 1.005)

  const cerca = (x: { dias: number | null }) => x.dias !== null && x.dias <= toleranciaDias
  const conCuit = elegibles.filter(x => x.cuitIgual && (x.dias === null || x.dias <= DIAS_CON_CUIT))
  let elegido: (typeof elegibles)[number] | null = null
  if (conCuit.length === 1) elegido = conCuit[0]
  else if (conCuit.length > 1) { const c = conCuit.filter(cerca); elegido = c.length === 1 ? c[0] : null }
  else { const c = elegibles.filter(cerca); elegido = c.length === 1 ? c[0] : null }
  if (!elegido) return null

  const de = (elegido.f.empresas ?? []).join('/')
  const partes = [
    `Factura de ${de} y la cuenta es de ${empresaCuenta}: si la confirmás se registra como retiro`,
    elegido.dif < 0.005 ? 'importe exacto' : `importe a $${elegido.dif.toFixed(2).replace('.', ',')}`,
    elegido.dias === null ? 'sin fecha' : elegido.dias === 0 ? 'misma fecha' : `fecha a ${elegido.dias} días`,
  ]
  if (elegido.cuitIgual) partes.push('el CUIT del banco coincide')
  return { candidato: elegido.f, motivo: partes.join(' · ') }
}
