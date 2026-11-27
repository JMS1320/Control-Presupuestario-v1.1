/**
 * 🏢 **El presupuesto de CADA EMPRESA con SU estructura** — A-FEAT-1666 (JMS 26/11/2026).
 *
 * El presupuesto existe para **MSA y MA** («PAM no va a tener presupuesto»). No es la pantalla de MSA con otro filtro: cada empresa
 * muestra los bloques que tiene de verdad (MODULO_PRESUPUESTO § 🏢). Todo lo que cambia de una empresa a otra vive ACÁ, en un solo
 * lugar (CLAUDE.md § ♻️), para que la pantalla no reparta «if MA» por todos lados.
 *
 * Lo que dijo JMS para MA (26/11):
 *  · «tiene que regirse por lo interno… como el dashboard por responsable»: sus templates y sus gastos de Libertad.
 *  · arrendamientos: los suyos **y los de PAM** («MA cobra los contratos propios y también los de PAM… cuando se renueven van a ser
 *    contratos de MA»).
 *  · «no tiene hacienda, no tiene costos de producción, no tiene plan anual, no tiene recetas».
 *  · la **caja es gasto** («MA no tiene un detalle de caja: lo que saca para caja es lo que gasta»), sólo en el presupuesto; la
 *    **tarjeta NO** («se desglosa en consumo, servicios… si metemos tarjeta como gasto, vamos a duplicar»).
 */
import type { TipoCuenta } from './templates'

export type EmpresaPresupuesto = 'MSA' | 'MA'
export const EMPRESAS_PRESUPUESTO: EmpresaPresupuesto[] = ['MSA', 'MA']

/** Las empresas que nombra un responsable («PAM/MA/Duhau» → PAM, MA, DUHAU). */
export function empresasDelTexto(texto: string | null | undefined): string[] {
  return String(texto ?? '').toUpperCase().split(/[\/,;+\s]+/).map(s => s.trim()).filter(Boolean)
}

/**
 * ¿Un template (por su responsable) o un empleado (por su empresa) va en el presupuesto de esta empresa?
 * MSA: lo que nombra a MSA (o el viejo «ambas»), como siempre. MA: lo que nombra a MA **y no a MSA** — lo compartido con MSA lo
 * sigue llevando MSA, así no se cuenta en las dos grillas.
 */
export function esDeLaEmpresa(texto: string | null | undefined, empresa: EmpresaPresupuesto): boolean {
  const t = empresasDelTexto(texto)
  if (empresa === 'MSA') return t.includes('MSA') || t.includes('AMBAS')
  return t.includes('MA') && !t.includes('MSA')
}

/** De qué empresas son los contratos de arrendamiento que presupuesta cada una. */
export function empresasDeContratos(empresa: EmpresaPresupuesto): string[] {
  return empresa === 'MA' ? ['MA', 'PAM'] : ['MSA']
}

/** La cuenta del banco de la que sale el saldo de arranque (y el `medio_pago` que cuenta como «salió del banco»). */
export function cuentaBancoPropia(empresa: EmpresaPresupuesto): { schema: 'public' | 'ma'; tabla: string } {
  return empresa === 'MA' ? { schema: 'ma', tabla: 'ma_galicia' } : { schema: 'public', tabla: 'msa_galicia' }
}

/** Qué bloques tiene la grilla de cada empresa. Lo que no tiene no aparece (en vez de aparecer vacío). */
export function bloquesDeEmpresa(empresa: EmpresaPresupuesto) {
  const msa = empresa === 'MSA'
  return {
    hacienda: msa,
    costosProduccion: msa,
    /** La historia por cuenta contable sale de las facturas de MSA (`presupuesto_historia_cuentas` no tiene empresa). */
    cuentasContables: msa,
  }
}

/**
 * El tipo con que un template entra AL PRESUPUESTO de esta empresa. Normalmente el del template; en MA la **caja** es gasto
 * (no hay detalle de caja: lo que saca es lo que gasta). No cambia el template: el Dashboard sigue viéndolo como lo tiene.
 */
export function tipoEnPresupuesto(empresa: EmpresaPresupuesto, categ: string | null | undefined, tipo: TipoCuenta | null | undefined): TipoCuenta | null {
  if (empresa === 'MA' && String(categ ?? '').trim().toUpperCase() === 'CAJA') return 'egreso'
  return tipo ?? null
}
