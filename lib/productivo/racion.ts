// Motor de ración y margen de engorde — FUENTE ÚNICA.
//
// Vivía adentro de `components/analisis-productivo.tsx` (1.367 líneas). Se extrajo acá para
// que el Presupuesto calcule el costo de alimentación con LA MISMA fórmula que el análisis de
// engorde. Si cada uno tuviera la suya, en tres meses dan distinto y no se sabe cuál está bien.
// Mismo patrón que `lib/pagos/` y `lib/arrendamientos/calculo.ts`.
//
// El corazón es por CABEZA y por DÍA, y arranca del peso promedio del período:
//
//     ración kg/día = peso promedio × % del peso vivo
//     maíz kg/día   = ración × % maíz
//     kg del lote   = kg/día × días × cabezas
//     costo         = kg × precio
//
// Como el peso promedio y los días ya salen del lote (`peso_base_kg` + `ganancia_diaria_kg`),
// el presupuesto no necesita input nuevo para estimar el consumo: sólo los parámetros de la
// actividad. Ver `lib/productivo/actividades.ts`.

// ── Ración ────────────────────────────────────────────────────────────────────

/** Peso promedio del período: la ración se sirve sobre esto, no sobre el peso inicial. */
export function pesoPromedio(pesoInicial: number, pesoFinal: number): number {
  return (pesoInicial + pesoFinal) / 2
}

/** Peso al final de un tramo de `dias` con una ganancia diaria dada. */
export function pesoFinal(pesoInicial: number, dias: number, gananciaDiariaKg: number): number {
  return pesoInicial + dias * gananciaDiariaKg
}

/**
 * Kilos de ración por cabeza y por día.
 * `racionPctPv` va como FRACCIÓN (1,5 % → 0.015).
 */
export function racionDiariaKg(pesoProm: number, racionPctPv: number): number {
  return pesoProm * racionPctPv
}

// ── Motor completo de margen (el del análisis de engorde) ─────────────────────

/**
 * Inputs ya parseados. Los porcentajes van como FRACCIÓN (3 % → 0.03).
 * `conv` es la GANANCIA DIARIA en kg, no un índice de conversión alimenticia —
 * el label "conversión" de la pantalla es un nombre heredado. Es el mismo número
 * que `productivo.stock_lotes.ganancia_diaria_kg`.
 */
export interface CalcInputs {
  cant: number; d: number; conv: number; pIni: number
  desbEnt: number; desbSal: number; czEnt: number; czSal: number; mort: number
  precioCompra: number; precioVenta: number
  racionPV: number; maizPct: number; concPct: number; maizPrecio: number; concPrecio: number
}

export function calcular(i: CalcInputs) {
  const kgGanados = i.d * i.conv                     // H17
  const pFin = i.pIni + kgGanados                    // L16
  const pProm = (pFin + i.pIni) / 2                  // H18
  // Entrada
  const mermaKgEnt = i.pIni * i.desbEnt
  const pNetoEnt = i.pIni - mermaKgEnt               // C17
  const brutoEnt = pNetoEnt * i.precioCompra         // C19
  const mermaCzEnt = brutoEnt * i.czEnt
  const netoEnt = brutoEnt - mermaCzEnt              // C20 = C28
  // Salida
  const mermaKgMort = pFin * i.mort                  // mortandad sobre bruto vendido
  const pTrasMort = pFin - mermaKgMort               // saldo tras mortandad
  const mermaKgSal = pTrasMort * i.desbSal           // desbaste sobre el saldo
  const pNetoSal = pTrasMort - mermaKgSal            // L17
  const brutoSal = pNetoSal * i.precioVenta          // L19
  const mermaCzSal = brutoSal * i.czSal
  const czNetoSal = brutoSal - mermaCzSal            // L20
  // Ración
  const racKgDia = racionDiariaKg(pProm, i.racionPV) // H20
  const maizKgDia = racKgDia * i.maizPct             // H22
  const concKgDia = racKgDia * i.concPct             // H23
  const maizCosto = -i.maizPrecio * maizKgDia * i.d  // L22 (por cabeza)
  const concCosto = -concKgDia * i.d * i.concPrecio  // L23 (por cabeza)
  const costoRacion = maizCosto + concCosto          // L24
  const maizKgLote = maizKgDia * i.d * i.cant        // H24
  const concKgLote = concKgDia * i.d * i.cant        // H25
  // Resultado
  const netoSalida = czNetoSal + costoRacion         // L28
  const gananciaCab = netoSalida - netoEnt           // L30
  const gananciaTotal = gananciaCab * i.cant         // L31
  return {
    cant: i.cant, d: i.d, kgGanados, pFin, pProm,
    mermaKgEnt, pNetoEnt, brutoEnt, mermaCzEnt, netoEnt,
    mermaKgMort, pTrasMort, mermaKgSal, pNetoSal, brutoSal, mermaCzSal, czNetoSal,
    racKgDia, maizKgDia, concKgDia, maizCosto, concCosto, costoRacion, maizKgLote, concKgLote,
    netoSalida, gananciaCab, gananciaTotal,
  }
}

export type ResultadoCalculo = ReturnType<typeof calcular>
