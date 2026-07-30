/**
 * Parseo de números tipeados por el usuario, tolerante a las dos escrituras.
 *
 * El problema: en es-AR el punto es separador de MILES ("5.700" = cinco mil setecientos)
 * pero mucha gente tipea el punto como DECIMAL ("0.5"). Y encima la app formatea con
 * `toLocaleString("es-AR")`, que mete puntos de miles — así que un valor mostrado
 * "7.000,00" vuelve a entrar al parser y hay que entenderlo.
 *
 * Ya rompió dos veces:
 *   · porcentajes: "0.85" → se borraba el punto → 85 → /100 → 0,85 de casualidad,
 *     pero "0.105" daba 1,05 (IVA 105%).
 *   · precios: se mostraba "5.700,00", se re-parseaba y daba 5,7.
 *
 * Reglas, en orden:
 *   1. Hay coma  → la coma es el decimal y los puntos son miles. "7.000,50" → 7000.5
 *   2. Empieza con "0."  → el punto es decimal. "0.105" → 0.105
 *   3. El último grupo tras un punto tiene 3 dígitos → eran miles. "5.700" → 5700
 *   4. Si no, el punto es decimal. "5.75" → 5.75
 */
export function parseNumeroAR(valor: unknown): number {
  const txt = String(valor ?? '').trim().replace(/[\s$]/g, '')
  if (!txt) return 0

  let limpio: string

  if (txt.includes(',')) {
    limpio = txt.replace(/\./g, '').replace(',', '.')
  } else if (/^-?0\./.test(txt)) {
    limpio = txt
  } else if (/\.\d{3}$/.test(txt) || /\.\d{3}\./.test(txt)) {
    limpio = txt.replace(/\./g, '')
  } else {
    limpio = txt
  }

  const n = parseFloat(limpio)
  return Number.isFinite(n) ? n : 0
}

/** Número → texto es-AR con 2 decimales. Inverso de `parseNumeroAR`. */
export function fmtNumeroAR(n: number | null | undefined, dec = 2): string {
  if (n == null || !Number.isFinite(Number(n))) return ''
  return Number(n).toLocaleString('es-AR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

/** Porcentaje escrito en % → fracción. "10,5" → 0.105 · "80" → 0.8 */
export function parsePorcentajeAR(valor: unknown): number {
  return parseNumeroAR(valor) / 100
}
