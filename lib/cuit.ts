// Validación de CUIT/CUIL por dígito verificador (módulo 11).
//
// Existe porque un CUIT mal tipeado no se nota: parece un número correcto, entra en la BD y
// después ROMPE LOS MATCHES EN SILENCIO. Caso testigo (2026-08-18): el contrato de arrendamiento
// de Rojas tenía `30712200662` y la factura de ARCA `30712200622` — un dígito de diferencia. La
// alerta de "facturas de venta sin vincular" matchea por CUIT, así que ofrecía la factura
// equivocada y la correcta no aparecía nunca. El verificador dice cuál de los dos es el bueno:
// `...662` da 5 y termina en 2 → inválido; `...622` da 2 → válido.

/** Sólo los dígitos: acepta `30-71220062-2`, `30712200622`, `30.712.200.622`. */
export function soloDigitosCuit(cuit: string | null | undefined): string {
  return String(cuit ?? '').replace(/\D/g, '')
}

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

/**
 * ¿El CUIT es formalmente válido? (11 dígitos + dígito verificador correcto)
 *
 * No dice que exista en ARCA: dice que no está mal tipeado. Un CUIT inválido es SIEMPRE un error
 * de carga, así que detectarlo es barato y certero.
 */
export function esCuitValido(cuit: string | null | undefined): boolean {
  const d = soloDigitosCuit(cuit)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false      // 00000000000, 11111111111…

  const suma = PESOS.reduce((acc, p, i) => acc + p * Number(d[i]), 0)
  const resto = suma % 11
  const esperado = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto
  return esperado === Number(d[10])
}

/** `30712200622` → `30-71220062-2`. Devuelve el original si no son 11 dígitos. */
export function formatearCuit(cuit: string | null | undefined): string {
  const d = soloDigitosCuit(cuit)
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : String(cuit ?? '')
}

/** Iguales mirando sólo los dígitos (tolera guiones y puntos de un lado u otro). */
export function mismoCuit(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = soloDigitosCuit(a)
  return da.length > 0 && da === soloDigitosCuit(b)
}
