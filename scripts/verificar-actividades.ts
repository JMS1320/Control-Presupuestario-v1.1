import { consumoMensual, type Tramo, type Actividad, type InsumoActividad } from "../lib/productivo/actividades"

let fallos = 0
const chk = (t: string, real: number, esp: number, tol = 0.01) => {
  const ok = Math.abs(real - esp) <= tol
  if (!ok) fallos++
  console.log(`${ok ? "OK  " : "FALLA"} ${t}: ${real.toFixed(2)} (esperado ${esp})`)
}

const recria: Actividad = {
  id: "A1", empresa: "MSA", tipo: "recria", nombre: "Recría",
  ganancia_diaria_kg: 0.5, racion_pct_pv: 0.015, pct_mortandad: 0.01, notas: null, activo: true,
}
const ins = (o: Partial<InsumoActividad>): InsumoActividad => ({
  id: "I", actividad_id: "A1", orden: 0, concepto: "x", modo: "pct_racion", valor: 0, moneda: "ARS",
  unidad: "kg", momento: "diario", precio_unitario: 0, categoria_insumo_id: null,
  producto: null, notas: null, ...o,
})

// 200 cab, 220 kg, del 1/4 al 30/9 (183 días calendario, 182 de tramo [desde, hasta))
const t: Tramo = {
  actividad: recria,
  insumos: [
    ins({ concepto: "Maíz", modo: "pct_racion", valor: 0.85, precio_unitario: 270 }),
    ins({ concepto: "Concentrado", modo: "pct_racion", valor: 0.15, precio_unitario: 500 }),
    ins({ concepto: "Sanidad ingreso", modo: "unid_cabeza_evento", valor: 1, unidad: "dosis", momento: "inicio", precio_unitario: 1200 }),
    ins({ concepto: "Verdeo", modo: "monto_ha", valor: 180000, momento: "inicio" }),
  ],
  cabezas: 200, desde: "2026-04-01", hasta: "2026-09-30", peso_inicial_kg: 220, hectareas: 40,
}

const m = consumoMensual(t)
console.log("\nmes      días  peso prom   maíz kg      costo total")
for (const x of m) {
  const maiz = x.items.find(i => i.concepto === "Maíz")
  console.log(`${x.mes}   ${String(x.dias).padStart(3)}   ${x.peso_prom_kg.toFixed(1).padStart(6)}  ${(maiz?.cantidad ?? 0).toFixed(0).padStart(9)}   $${Math.round(x.costo_total).toLocaleString("es-AR").padStart(12)}`)
}
console.log("")

// 1. Los días cierran con el tramo
chk("días totales repartidos", m.reduce((s, x) => s + x.dias, 0), 182)

// 2. El peso sube mes a mes → el consumo diario también
const abr = m[0]!, sep = m[m.length - 1]!
chk("peso prom abril", abr.peso_prom_kg, 220 + 30 * 0.5 / 2, 0.6)
console.log(`     el peso promedio sube de ${abr.peso_prom_kg.toFixed(1)} kg a ${sep.peso_prom_kg.toFixed(1)} kg`)
const maizDiaAbr = abr.items.find(i => i.concepto === "Maíz")!.cantidad / abr.dias
const maizDiaSep = sep.items.find(i => i.concepto === "Maíz")!.cantidad / sep.dias
chk("el maíz por día CRECE con el peso", maizDiaSep > maizDiaAbr ? 1 : 0, 1)
console.log(`     maíz/día: ${maizDiaAbr.toFixed(1)} kg → ${maizDiaSep.toFixed(1)} kg (lote de 200)`)

// 3. Maíz total = ración media × 85% × días × cabezas
const pesoMedio = (220 + (220 + 182 * 0.5)) / 2
const maizEsperado = pesoMedio * 0.015 * 0.85 * 182 * 200
chk("maíz total del tramo", m.reduce((s, x) => s + (x.items.find(i => i.concepto === "Maíz")?.cantidad ?? 0), 0), maizEsperado, 60)

// 4. Los puntuales caen UNA sola vez, en su mes
const mesesConSanidad = m.filter(x => x.items.some(i => i.concepto === "Sanidad ingreso"))
chk("sanidad aparece en 1 solo mes", mesesConSanidad.length, 1)
chk("sanidad en el primer mes", mesesConSanidad[0]!.mes === "2026-04" ? 1 : 0, 1)
chk("sanidad = 200 dosis", mesesConSanidad[0]!.items.find(i => i.concepto === "Sanidad ingreso")!.cantidad, 200)

// 5. El verdeo escala con hectáreas, NO con cabezas
const verdeo = m.flatMap(x => x.items).filter(i => i.concepto === "Verdeo")
chk("verdeo una sola vez", verdeo.length, 1)
chk("verdeo = 40 ha x 180.000", verdeo[0]!.costo, 7200000)


// ── Agrícola: USD/ha en el ciclo + cosecha como % de lo producido ────────────
console.log("\n--- soja: USD/ha en el ciclo + cosecha % de lo producido ---")
const soja: Actividad = {
  id: "A2", empresa: "MSA", tipo: "agricola", nombre: "Soja",
  ganancia_diaria_kg: 0, racion_pct_pv: 0, pct_mortandad: 0, notas: null, activo: true,
}
const tSoja: Tramo = {
  actividad: soja,
  insumos: [
    // "se gastan tantos dólares en el ciclo del cultivo"
    ins({ concepto: "Labores+insumos", modo: "monto_ha", valor: 450, momento: "ciclo", moneda: "USD" }),
    ins({ concepto: "Seguro", modo: "monto_ha", valor: 30000, momento: "inicio", moneda: "ARS" }),
    ins({ concepto: "Cosecha", modo: "pct_produccion", valor: 0.08, momento: "fin", moneda: "ARS" }),
  ],
  cabezas: 0, desde: "2026-10-01", hasta: "2027-04-01",
  peso_inicial_kg: 0, hectareas: 100,
  valor_produccion: 500_000_000,
  // TC presupuestado: solo dos puntos cargados, el resto se arrastra
  tiposCambio: [{ anio: 2026, mes: 10, valor: 1500 }, { anio: 2027, mes: 2, valor: 1700 }],
}
const ms = consumoMensual(tSoja)
console.log("mes        dias   del ciclo          en $         TC")
for (const x of ms) {
  const it = x.items.find(i => i.concepto === "Labores+insumos")
  console.log(`${x.mes}   ${String(x.dias).padStart(4)}   ${(it?.monto_origen ?? 0).toFixed(0).padStart(8)} US$   ${Math.round(it?.costo ?? 0).toLocaleString("es-AR").padStart(13)}   ${it?.tc ?? "-"}`)
}

chk("USD del ciclo repartidos (450 x 100 ha)", ms.reduce((s, m) => s + (m.items.find(i => i.concepto === "Labores+insumos")?.monto_origen ?? 0), 0), 45000, 1)
const tcs = new Set(ms.map(m => m.items.find(i => i.concepto === "Labores+insumos")?.tc))
chk("cada mes usa SU tc (arrastrado), no uno solo", tcs.size > 1 ? 1 : 0, 1)
const seg = ms.flatMap(m => m.items).filter(i => i.concepto === "Seguro")
chk("seguro una sola vez", seg.length, 1)
chk("seguro = 100 ha x 30.000", seg[0]!.costo, 3_000_000)
chk("seguro sin TC (es ARS)", seg[0]!.tc === null ? 1 : 0, 1)
const cos = ms.flatMap(m => m.items).filter(i => i.concepto === "Cosecha")
chk("cosecha una sola vez, al final", cos.length, 1)
chk("cosecha = 8 % de 500 M", cos[0]!.costo, 40_000_000)

console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLAS`)
process.exit(fallos ? 1 : 0)
