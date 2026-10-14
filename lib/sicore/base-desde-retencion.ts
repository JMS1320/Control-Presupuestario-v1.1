/**
 * 🐞 A-BUG-1284 (2026-10-14) — la base y el mínimo de una retención que quedó anotada en el anticipo
 * pero sin registrar en SICORE. Se reconstruyen desde lo guardado, en este orden:
 *   1. si (neto − mínimo del régimen) × alícuota da la retención → ése fue el cálculo (primera del período);
 *   2. si neto × alícuota da la retención → no se restó mínimo (retención adicional);
 *   3. si no, se deduce: base = retención ÷ alícuota, mínimo = neto − base (y se dice que es deducido).
 * Caso BRIKI: neto 11.570.247,93, Bienes 2 % con mínimo 224.000 → (11.570.247,93 − 224.000) × 2 % =
 * 226.924,96 ✓ → base 11.346.247,93, mínimo 224.000 (deducirlo daba 223.999,93).
 */
export function baseDesdeRetencion(neto: number, retencion: number, alicuota: number, minimoRegimen: number):
  { base: number; minimo: number; deducido: boolean } {
  const r2 = (n: number) => Math.round(n * 100) / 100
  if (neto > minimoRegimen && Math.abs(r2((neto - minimoRegimen) * alicuota) - r2(retencion)) < 0.011) {
    return { base: r2(neto - minimoRegimen), minimo: minimoRegimen, deducido: false }
  }
  if (Math.abs(r2(neto * alicuota) - r2(retencion)) < 0.011) return { base: r2(neto), minimo: 0, deducido: false }
  const base = alicuota > 0 ? r2(retencion / alicuota) : 0
  return { base, minimo: Math.max(0, r2(neto - base)), deducido: true }
}
