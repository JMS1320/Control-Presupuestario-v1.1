import {
  calcularCuenta, sugerirModo, controlarPresupuesto, historiaUtil, esProduccion,
  type PuntoHistorico, type ConfigCuenta, type CeldaPresupuesto,
} from "../lib/presupuesto/modos"

let fallos = 0
const chk = (t: string, real: unknown, esp: unknown) => {
  const ok = JSON.stringify(real) === JSON.stringify(esp)
  if (!ok) fallos++
  console.log(`${ok ? "OK  " : "FALLA"} ${t}: ${JSON.stringify(real)} (esperado ${JSON.stringify(esp)})`)
}
const cerca = (t: string, real: number, esp: number, tol: number) => {
  const ok = Math.abs(real - esp) <= tol
  if (!ok) fallos++
  console.log(`${ok ? "OK  " : "FALLA"} ${t}: ${Math.round(real).toLocaleString("es-AR")} (esperado ~${Math.round(esp).toLocaleString("es-AR")})`)
}

// Hoy simulado: 30/7/2026 → julio está a medio facturar
const HOY = new Date(2026, 6, 30)
const p = (nro: string, anio: number, mes: number, monto: number, fc = 1, pv = 1): PuntoHistorico =>
  ({ nro_cuenta: nro, anio, mes, monto, facturas: fc, proveedores: pv })

// ── Datos REALES de MSA ──────────────────────────────────────────────────────
// ASESOR GANADERO: 1 proveedor, escalones crecientes
const asesor = [
  p("42314", 2025, 7, 1427800), p("42314", 2025, 8, 1563320), p("42314", 2025, 9, 1563320),
  p("42314", 2025, 10, 1563320), p("42314", 2025, 11, 1633795), p("42314", 2025, 12, 1633795),
  p("42314", 2026, 1, 1633795), p("42314", 2026, 2, 1633795), p("42314", 2026, 3, 1748193),
  p("42314", 2026, 4, 1896791), p("42314", 2026, 5, 1896791), p("42314", 2026, 6, 2067503),
  p("42314", 2026, 7, 2067503),
]
// INSUMOS VETERINARIOS: variable, con nota de crédito y meses sin factura
const veter = [
  p("42307", 2025, 7, 176273, 2, 1), p("42307", 2025, 8, 3018042, 5, 2),
  p("42307", 2025, 9, 1451340, 4, 2), p("42307", 2025, 10, -28358, 1, 1),
  p("42307", 2025, 11, 109736, 1, 1), p("42307", 2025, 12, 3110678, 6, 2),
  p("42307", 2026, 2, 1127371, 3, 1), p("42307", 2026, 3, 3303815, 7, 2),
  p("42307", 2026, 4, 1129153, 2, 1), p("42307", 2026, 5, 3275271, 6, 2),
  p("42307", 2026, 7, 331900, 1, 1),
]
const historia = [...asesor, ...veter]
const meses = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(2026, 6 + i, 1)
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 }
})
const ctx = { meses, inflacionMensual: 0, hoy: HOY }

console.log("--- el mes en curso no se usa ---")
chk("julio-26 queda afuera del histórico", historiaUtil(asesor, HOY).length, 12)
console.log("     (13 meses cargados, 12 utilizables: julio está a medio facturar)")

console.log("\n--- sugerencia automática ---")
const sAsesor = sugerirModo("42314", historia)
const sVeter = sugerirModo("42307", historia)
console.log(`     ASESOR GANADERO   → ${sAsesor.modo}  (${sAsesor.motivo})`)
console.log(`     INSUMOS VETERIN.  → ${sVeter.modo}  (${sVeter.motivo})`)
chk("asesor: propagar la última", sAsesor.modo, "ultima_fc")
chk("veterinarios: por cabeza (sigue al rodeo)", sVeter.modo, "por_cabeza")
chk("agroquímicos: excluida", sugerirModo("421113", historia).modo, "excluida")
chk("maíz: excluido (ya está en la ración)", sugerirModo("4230501", historia).modo, "excluida")
chk("motivo del maíz", esProduccion("4230501"), "Alimentación: ya entra como ración en Actividades y costos")
chk("veterinaria NO se excluye", esProduccion("42307"), null)

console.log("\n--- propagar la última factura ---")
const cAsesor = calcularCuenta({ nro_cuenta: "42314", modo: "ultima_fc" }, historia, ctx)
console.log(`     ${cAsesor[0]!.explicacion}`)
cerca("toma jun-26 (2.067.503), no jul-26 incompleto", cAsesor[0]!.monto, 2067503, 1)

console.log("\n--- promedio: los meses sin factura cuentan como cero ---")
const cProm = calcularCuenta({ nro_cuenta: "42307", modo: "promedio_n", meses_promedio: 6 }, historia, ctx)
console.log(`     ${cProm[0]!.explicacion}`)
// Ventana feb..jun 2026 (jun sin factura) = 1.127.371+3.303.815+1.129.153+3.275.271 = 8.835.610 / 6
cerca("promedio 6 meses divide por 6, no por 4", cProm[0]!.monto, 8835610 / 6, 1)
console.log(`     dividir por los 4 meses CON factura daría ${Math.round(8835610 / 4).toLocaleString("es-AR")} — 50 % de más`)

console.log("\n--- inflación ---")
const cInfl = calcularCuenta({ nro_cuenta: "42314", modo: "ultima_fc" }, historia,
  { ...ctx, inflacionMensual: 0.02 })
cerca("jul-26 = jun-26 + 2 %", cInfl[0]!.monto, 2067503 * 1.02, 1)
cerca("dic-26 = jun-26 + 2 % x 6", cInfl[5]!.monto, 2067503 * Math.pow(1.02, 6), 1)

console.log("\n--- por cabeza ---")
const cCab = calcularCuenta({
  nro_cuenta: "42307", modo: "por_cabeza", cabezas_referencia: 220, cabezas_proyectadas: 264,
}, historia, ctx)
console.log(`     ${cCab[0]!.explicacion}`)
chk("escala con las cabezas", Math.round(cCab[0]!.monto / (16673321 / 12 / 220 * 264)), 1)

console.log("\n--- estacional necesita 12 meses ---")
const cEst = calcularCuenta({ nro_cuenta: "42307", modo: "estacional" }, historia, ctx)
chk("avisa que faltan meses", cEst[0]!.monto, 0)
console.log(`     ${cEst[0]!.explicacion}`)

console.log("\n--- control: que no se escape nada grande ---")
const cfgs: Record<string, ConfigCuenta> = {
  "42314": { nro_cuenta: "42314", modo: "ultima_fc" },
  "42307": { nro_cuenta: "42307", modo: "manual", monto_manual: 0 },
}
const presu: Record<string, CeldaPresupuesto[]> = {
  "42314": calcularCuenta(cfgs["42314"]!, historia, ctx),
  "42307": calcularCuenta(cfgs["42307"]!, historia, ctx),
}
const ctrl = controlarPresupuesto(historia, presu, cfgs,
  { "42314": "ASESOR GANADERO", "42307": "INSUMOS VETERINARIOS" }, { hoy: HOY })
for (const a of ctrl.alertas) console.log(`     [${a.nivel}] ${a.titulo} — ${a.detalle}`)
chk("detecta la cuenta olvidada", ctrl.alertas.some(a => a.titulo.includes("INSUMOS VETERINARIOS")), true)
chk("y avisa que el total quedó bajo", ctrl.alertas.some(a => a.titulo.includes("por debajo")), true)

console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLAS`)
process.exit(fallos ? 1 : 0)
