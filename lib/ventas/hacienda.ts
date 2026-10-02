/**
 * 🐂 **LA VENTA DE HACIENDA VISTA DESDE INGRESOS — y su liquidación.** A-BUG-1232 · A-FEAT-1225.
 *
 * La venta se carga en Productivo (`productivo.stock_ventas`) y la solapa Ventas de Ingresos no la
 * veía: miraba sólo el circuito de granos. Este archivo junta lo que Ingresos necesita saber de una
 * venta de hacienda, con **las mismas cuentas** que usa Productivo, para que el número de una
 * pantalla y el de la otra no puedan diferir.
 *
 * ## ⚠️ El desbaste se guarda como FRACCIÓN, no como porcentaje
 * `stock_ventas.pct_desbaste = 0.03` quiere decir 3 %. Así lo usan `lib/presupuesto/margen.ts` y
 * `lib/ganaderia/ciclo.ts` (`kg * (1 - pct_desbaste)`). Tratarlo como 3 (porcentaje) daría kilos
 * negativos sin avisar.
 *
 * ## 🔑 El neto de la venta se LEE, no se recalcula
 * `monto_neto` es lo que Productivo guardó al cerrar la venta (kilos desbastados × precio, menos CZ
 * y flete — `netoDeVenta()` en `lib/ganaderia/confirmar-venta.ts`). Recalcularlo acá sería una
 * segunda versión de la misma cuenta: el día que Productivo cambie la suya, las dos dejan de
 * coincidir y nadie se entera (§ ♻️ de `CLAUDE.md`).
 */

/** Kilos que se venden después del desbaste. `pctDesbaste` es FRACCIÓN (0.03 = 3 %). */
export function kgNetosDeVenta(kgTotales: number | null | undefined, pctDesbaste: number | null | undefined): number {
  const kg = Number(kgTotales) || 0
  const d = Number(pctDesbaste) || 0
  return kg * (1 - d)
}

/** Peso promedio por cabeza. Sin cabezas, cero (no se divide por cero ni se inventa). */
export function promedioKg(kg: number | null | undefined, cabezas: number | null | undefined): number {
  const c = Number(cabezas) || 0
  return c > 0 ? (Number(kg) || 0) / c : 0
}

/**
 * La categoría productiva de una venta. Una venta **con lote** la toma del lote; una **suelta**, de
 * su `categoria_id`. Mirar sólo `categoria_id` hace parecer «sin categoría» a las ventas por lote —
 * pasó el 2026-10-01 con los 55 de Pedro Genta, que son *Ternero Recría* por su lote.
 */
export function categoriaDeVenta(categoriaDelLote: string | null | undefined, categoriaDirecta: string | null | undefined): string | null {
  return (categoriaDelLote || categoriaDirecta || '').trim() || null
}
