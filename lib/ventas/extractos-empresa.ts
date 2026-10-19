/**
 * 🏦 Los extractos bancarios de cada empresa, para el circuito de COBROS — A-FEAT-24 (2026-10-14).
 *
 * El cobro de una venta es el crédito del banco atado a ella (`comprobante_venta_id`). Hasta hoy esa
 * columna existía sólo en `msa_galicia`; con `scripts/84` está también en los de PAM y MA. Los
 * nombres no siguen un patrón derivable (PAM tiene DOS cuentas, MA vive en el schema `ma`), así que
 * el mapa se declara.
 *
 * ⚠️ Es el mismo dato que `CUENTAS_BANCARIAS` (`hooks/useMotorConciliacion.ts`), filtrado a las
 * cuentas Galicia que reciben cobros. No se importa de ahí porque es un hook con dependencias de
 * pantalla; si se agrega una cuenta bancaria a una empresa, va en los dos lados.
 */

export interface Extracto { tabla: string; schema?: string }

export const EXTRACTOS_DE_EMPRESA: Record<string, Extracto[]> = {
  MSA: [{ tabla: 'msa_galicia' }],
  PAM: [{ tabla: 'pam_galicia' }, { tabla: 'pam_galicia_cc' }],
  MA: [{ tabla: 'ma_galicia', schema: 'ma' }],
}

/** Todos los extractos que tienen el vínculo con un comprobante de venta. */
export const TODOS_LOS_EXTRACTOS: Extracto[] = Object.values(EXTRACTOS_DE_EMPRESA).flat()

/** 'msa' → 'MSA'. El schema de `comprobantes_venta` ES la empresa. */
export const empresaDelSchema = (schema: string) => schema.toUpperCase()

export function extractosDelSchema(schema: string): Extracto[] {
  return EXTRACTOS_DE_EMPRESA[empresaDelSchema(schema)] || []
}

/** ¿Este extracto es de la empresa de ese schema? (la FK no deja atar un crédito de PAM a una venta de MSA). */
export function extractoEsDe(tabla: string, schema: string): boolean {
  return extractosDelSchema(schema).some(e => e.tabla === tabla)
}
