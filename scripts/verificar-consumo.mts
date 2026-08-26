/**
 * Control de `lib/productivo/consumo.ts` contra los datos REALES de la recría 2026.
 *
 * No es un test unitario con números inventados: corre el lib sobre las mismas entregas y
 * mediciones que validamos en la maqueta de Excel (§ A-FEAT-43) y verifica que las tres
 * identidades cierren. Si el lib se toca y esto se pone en rojo, el lib está mal.
 *
 *     npx tsx scripts/verificar-consumo.mts
 */

import {
  calcularConsumo, pctPesoVivoReal, kiloDia,
  type Medicion, type Entrega, type GrupoConsumidor,
} from "../lib/productivo/consumo"

const n = (x: number) => x.toLocaleString("es-AR", { maximumFractionDigits: 2 })
const pesos = (x: number) => `$${Math.round(x).toLocaleString("es-AR")}`

// ── Los datos reales (los mismos de scripts/maqueta-costo-recria.mts) ─────────

const ENTREGAS: Entrega[] = [
  { fecha: "2026-03-16", cantidad: 1740, precioUnitario: 193, detalle: "Arroyo Tala 1,74 t" },
  { fecha: "2026-05-06", cantidad: 7300, precioUnitario: 262, detalle: "Arroyo Tala 7,3 t — acá arranca la ración" },
  { fecha: "2026-06-02", cantidad: 7560, precioUnitario: 254, detalle: "Arroyo Tala 7,56 t" },
  { fecha: "2026-06-17", cantidad: 5960, precioUnitario: 238.35282, detalle: "Pereyra 5,96 t" },
  { fecha: "2026-06-24", cantidad: 20100, precioUnitario: 267.5, detalle: "Longo 1er flete" },
  { fecha: "2026-07-24", cantidad: 25000, precioUnitario: (20.1 * 267050 + 4.9 * 267500) / 25 / 1000, detalle: "Longo 2do flete" },
]

const MEDICIONES: Medicion[] = [
  { fecha: "2026-03-16", cantidad: 0, notas: "arranque: stock cero al destete" },
  { fecha: "2026-06-24", cantidad: 0, notas: "al recibir el 1er flete de Longo, stock ≈ 0" },
  { fecha: "2026-07-24", cantidad: 0, notas: "al recibir el 2do flete de Longo, stock ≈ 0" },
  { fecha: "2026-08-24", cantidad: 4000 + 1800, notas: "medición del 24/08" },
]

/**
 * Los grupos que comieron. Kilo-día simplificado a modo de control del REPARTO —
 * lo que se verifica acá es que las participaciones sumen 1 y que el reparto no mueva el
 * total, no la exactitud de la curva de peso (eso es de la maqueta).
 */
const PESO_PROM = { vendidos: 250, machos: 255, hembras: 215 }
const CAB = { vendidos: 55, machos: 48, hembras: 82 }
const VENTA = "2026-08-04"

const gruposDe = (desde: string, hasta: string): GrupoConsumidor[] => {
  const corte = hasta > VENTA ? VENTA : hasta
  return [
    { id: "vendidos", nombre: "55 vendidos", kiloDia: kiloDia([{ desde, hasta: corte, cabezas: CAB.vendidos, pesoPromedioKg: PESO_PROM.vendidos }]) },
    { id: "machos", nombre: "Machos que quedan", kiloDia: kiloDia([{ desde, hasta, cabezas: CAB.machos, pesoPromedioKg: PESO_PROM.machos }]) },
    { id: "hembras", nombre: "Hembras que quedan", kiloDia: kiloDia([{ desde, hasta, cabezas: CAB.hembras, pesoPromedioKg: PESO_PROM.hembras }]) },
  ].filter(g => g.kiloDia > 0)
}

// ── Corrida ───────────────────────────────────────────────────────────────────

const r = calcularConsumo(MEDICIONES, ENTREGAS, gruposDe)

console.log("\n=== TRAMOS ===")
for (const t of r.tramos) {
  console.log(`\n${t.desde} → ${t.hasta}  (${t.dias} días)`)
  console.log(`  había ${n(t.saldoInicial)} + entró ${n(t.cantidadEntregada)} − quedó ${n(t.saldoFinal)} = ${n(t.consumo)} kg`)
  console.log(`  precio del tramo: ${t.precioUnitario == null ? "—" : pesos(t.precioUnitario) + "/kg"}`
    + `   costo: ${t.costo == null ? "—" : pesos(t.costo)}`)
  for (const g of t.reparto) {
    console.log(`    · ${g.nombre.padEnd(22)} ${(g.participacion * 100).toFixed(1).padStart(5)} %`
      + `  ${n(g.cantidad).padStart(10)} kg  ${g.costo == null ? "—" : pesos(g.costo)}`)
  }
  const suma = t.reparto.reduce((s, g) => s + g.participacion, 0)
  console.log(`    participaciones suman ${suma.toFixed(6)} ${Math.abs(suma - 1) < 1e-9 ? "✓" : "✗"}`)
  for (const f of t.faltantes) console.log(`    ⚠️  ${f}`)
}

console.log("\n=== TOTALES ===")
console.log(`  comprado   ${n(r.compradoTotal).padStart(12)} kg`)
console.log(`  consumido  ${n(r.consumoTotal).padStart(12)} kg`)
console.log(`  remanente  ${n(r.remanente).padStart(12)} kg   (activo, no es costo de nadie)`)
console.log(`  costo      ${r.costoTotal == null ? "—" : pesos(r.costoTotal)}`)

const kdTotal = gruposDe(MEDICIONES[0]!.fecha, MEDICIONES[MEDICIONES.length - 1]!.fecha)
  .reduce((s, g) => s + g.kiloDia, 0)
const pct = pctPesoVivoReal(r.consumoTotal, kdTotal)
console.log(`  % del peso vivo REAL: ${pct == null ? "—" : (pct * 100).toFixed(2) + " %"}`
  + `   (la actividad tiene cargado 1,50 % para proyectar)`)

console.log("\n=== CONTROLES ===")
let ok = true
for (const c of r.controles) {
  if (!c.cierra) ok = false
  console.log(`  ${c.cierra ? "✓" : "✗"} ${c.nombre.padEnd(30)} `
    + `${n(c.izquierda).padStart(12)} vs ${n(c.derecha).padStart(12)}`
    + `  dif ${n(c.diferencia)}`)
  console.log(`      ${c.detalle}`)
}

if (r.faltantes.length > 0) {
  console.log("\n=== FALTANTES ===")
  for (const f of r.faltantes) console.log(`  ⚠️  ${f}`)
}

console.log(ok ? "\n✅ Los 3 controles cierran.\n" : "\n❌ HAY CONTROLES QUE NO CIERRAN.\n")
process.exit(ok ? 0 : 1)
