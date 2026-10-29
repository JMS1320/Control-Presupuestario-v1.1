/**
 * 🏦 «PAGADO DESDE» — de qué cuenta salió la plata de un pago (A-FEAT-1321).
 *
 * Pedido del usuario 2026-10-23: *«a veces cuando hago un pago lo hago directamente de la cuenta de
 * MA y hoy no queda registrado… me demoro en la conciliación, entonces miro el banco de MSA y no
 * está pagado y puedo desconfiar»*.
 *
 * 🔑 **Se guarda en `medio_pago`, que ya existía y ya decía «de dónde sale»** — `banco` o una caja.
 * Sólo se le suman las cuentas bancarias puntuales:
 *
 * | `medio_pago`            | Qué significa                                   |
 * |-------------------------|-------------------------------------------------|
 * | `banco` (o vacío)       | el banco de la propia empresa — el default       |
 * | `msa_galicia`, `ma_galicia`, `pam_galicia`, `pam_galicia_cc` | esa cuenta, puntual (ej. MA paga algo de MSA) |
 * | `caja_general`, `caja_ams`, `caja_sigot` | esa caja (como siempre)        |
 *
 * Así no hace falta una columna nueva en las cuotas ni en las facturas de MSA y MA (ya tienen
 * `medio_pago`); sólo en las de PAM, que no la tenían (`scripts/95`). Y todo lo que pregunta
 * «¿es banco?» tiene que preguntarlo con `esBanco()`, no con `=== 'banco'`: una cuota pagada
 * desde MA Galicia **sigue siendo un pago por banco**.
 *
 * Las cuentas salen de `EXTRACTOS_DE_EMPRESA` (las mismas ids que `CUENTAS_BANCARIAS` del motor de
 * conciliación), para no tener una cuarta lista a mano.
 */
import { EXTRACTOS_DE_EMPRESA } from "@/lib/ventas/extractos-empresa"

export interface CuentaDePago { id: string; rotulo: string; empresa: string | null; tipo: 'banco' | 'caja' }

const ROTULO_BANCO: Record<string, string> = {
  msa_galicia: 'MSA Galicia',
  pam_galicia: 'PAM Galicia CA',
  pam_galicia_cc: 'PAM Galicia CC',
  ma_galicia: 'MA Galicia',
}

export const CUENTAS_BANCO: CuentaDePago[] = [
  ...Object.entries(EXTRACTOS_DE_EMPRESA).flatMap(([empresa, ext]) =>
    ext.map(e => ({ id: e.tabla, rotulo: ROTULO_BANCO[e.tabla] ?? e.tabla, empresa, tipo: 'banco' as const }))),
  // 💵 A-FEAT-1398: la CA en pesos de Cotitulares pagó una factura de MSA (28/10). Es «de otra empresa»: se marca.
  { id: 'cotitulares_ca_pesos', rotulo: 'Cotitulares CA Pesos', empresa: 'Cotitulares', tipo: 'banco' as const },
  // 🏦 A-FEAT-1386 (scripts/129): Santander y Provincia de MSA, en pesos
  { id: 'msa_santander', rotulo: 'MSA Santander', empresa: 'MSA', tipo: 'banco' as const },
  { id: 'msa_provincia', rotulo: 'MSA Provincia', empresa: 'MSA', tipo: 'banco' as const },
]

export const CAJAS: CuentaDePago[] = [
  { id: 'caja_general', rotulo: 'Caja General', empresa: null, tipo: 'caja' },
  { id: 'caja_ams', rotulo: 'Caja AMS', empresa: null, tipo: 'caja' },
  { id: 'caja_sigot', rotulo: 'Caja Sigot', empresa: null, tipo: 'caja' },
]

/** Las opciones del selector, en orden: el default, las cuentas de banco y las cajas. */
export const OPCIONES_PAGADO_DESDE: CuentaDePago[] = [
  { id: 'banco', rotulo: 'Banco de la propia empresa', empresa: null, tipo: 'banco' },
  ...CUENTAS_BANCO,
  ...CAJAS,
]

/** ¿El pago salió por banco? `banco`, vacío o una cuenta bancaria puntual. */
export function esBanco(medio: string | null | undefined): boolean {
  return !medio || medio === 'banco' || CUENTAS_BANCO.some(c => c.id === medio)
}

/**
 * ¿La fila pasa el filtro de medio de pago del Cash Flow? El filtro sigue teniendo las opciones de
 * siempre (`banco` y las cajas): «banco» incluye las cuentas puntuales.
 */
export function pasaFiltroMedio(medio: string | null | undefined, filtro: string | null | undefined): boolean {
  if (!filtro || filtro === 'todos') return true
  if (filtro === 'banco') return esBanco(medio)
  return (medio || 'banco') === filtro
}

/** La cuenta bancaria PUNTUAL de un pago, o null si es el banco propio o una caja. */
export function cuentaPuntual(medio: string | null | undefined): CuentaDePago | null {
  return CUENTAS_BANCO.find(c => c.id === medio) ?? null
}

/**
 * La marca que se muestra al lado de la empresa en el Cash Flow, o null si no hay nada que avisar.
 * Se avisa siempre que la cuenta es puntual; `deOtraEmpresa` dice si es de una empresa que NO es
 * ninguna de las de la fila — el caso que hace desconfiar al mirar el banco propio.
 */
export function marcaPagadoDesde(medio: string | null | undefined, empresasDeLaFila: string[]):
  { texto: string; deOtraEmpresa: boolean } | null {
  const c = cuentaPuntual(medio)
  if (!c) return null
  const propias = empresasDeLaFila.map(e => e.toUpperCase())
  return { texto: `desde ${c.rotulo}`, deOtraEmpresa: !!c.empresa && !propias.includes(c.empresa) }
}
