import { segmentosCurva, pesoEnFecha, tramosParaCosto, solapamientos, type TramoLote, type LoteCurva } from "../lib/productivo/tramos"
import { consumoMensual, type Actividad, type InsumoActividad } from "../lib/productivo/actividades"

let fallos = 0
const chk = (t: string, real: number, esp: number, tol = 0.01) => {
  const ok = Math.abs(real - esp) <= tol
  if (!ok) fallos++
  console.log(`${ok ? "OK  " : "FALLA"} ${t}: ${real.toFixed(2)} (esperado ${esp})`)
}

const acts: Actividad[] = [
  { id: "REC", empresa: "MSA", tipo: "recria", nombre: "Recría", ganancia_diaria_kg: 0.5, racion_pct_pv: 0.015, pct_mortandad: 0.01, notas: null, activo: true },
  { id: "ENG", empresa: "MSA", tipo: "engorde", nombre: "Engorde", ganancia_diaria_kg: 0.7, racion_pct_pv: 0.015, pct_mortandad: 0.01, notas: null, activo: true },
]
const insumos: InsumoActividad[] = ["REC", "ENG"].flatMap(id => ([
  { id: id + "m", actividad_id: id, orden: 1, concepto: "Maíz", modo: "pct_racion" as const, valor: 0.85, unidad: "kg", momento: "diario" as const, precio_unitario: 270, categoria_insumo_id: null, producto: null, notas: null },
  { id: id + "c", actividad_id: id, orden: 2, concepto: "Concentrado", modo: "pct_racion" as const, valor: 0.15, unidad: "kg", momento: "diario" as const, precio_unitario: 745, categoria_insumo_id: null, producto: null, notas: null },
]))

// Lote: 100 cab, 220 kg al 1/4. Recría 1/4→1/10 (183 d), engorde 1/10→1/1 (92 d).
const lote: LoteCurva = {
  cantidad: 100, peso_base_kg: 220, ganancia_diaria_kg: 0.3,
  fecha_disponible: "2026-04-01", fecha_peso: "2026-04-01", ganancia_override: false,
}
const tramos: TramoLote[] = [
  { id: "T1", lote_id: "L", actividad_id: "REC", orden: 1, fecha_desde: "2026-04-01", fecha_hasta: "2026-10-01", hectareas: null, notas: null },
  { id: "T2", lote_id: "L", actividad_id: "ENG", orden: 2, fecha_desde: "2026-10-01", fecha_hasta: "2027-01-01", hectareas: null, notas: null },
]

const segs = segmentosCurva(lote, tramos, acts, "2027-01-01")
console.log("\nsegmento              días  g/día   peso")
for (const s of segs) console.log(`  ${(s.actividad ?? "(sin actividad)").padEnd(18)} ${String(s.dias).padStart(4)}  ${s.ganancia_diaria_kg.toFixed(2)}   ${s.peso_inicio.toFixed(1)} → ${s.peso_fin.toFixed(1)}`)
console.log("")

// 1. La curva es QUEBRADA: 183 d a 0,5 y 92 d a 0,7
chk("segmentos", segs.length, 2)
chk("recría: 183 días", segs[0]!.dias, 183)
chk("peso al pasar a engorde", pesoEnFecha(lote, tramos, acts, "2026-10-01"), 220 + 183 * 0.5)
chk("peso final (quebrada)", pesoEnFecha(lote, tramos, acts, "2027-01-01"), 220 + 183 * 0.5 + 92 * 0.7)

// 2. Y NO es la recta que daba antes con la ganancia del lote
const recta = 220 + 275 * 0.3
console.log(`     recta vieja (0,3 kg/día del lote): ${recta} kg — la quebrada da ${pesoEnFecha(lote, tramos, acts, "2027-01-01").toFixed(1)} kg`)
chk("la quebrada NO coincide con la recta", pesoEnFecha(lote, tramos, acts, "2027-01-01") !== recta ? 1 : 0, 1)

// 3. Override manual: vuelve a la recta del lote
const conOverride = { ...lote, ganancia_override: true }
chk("override → recta del lote", pesoEnFecha(conOverride, tramos, acts, "2027-01-01"), recta)

// 4. Días sin tramo usan la ganancia del lote (fallback)
const soloRecria = [tramos[0]!]
chk("hueco tras el último tramo usa el lote", pesoEnFecha(lote, soloRecria, acts, "2027-01-01"), 220 + 183 * 0.5 + 92 * 0.3)

// 5. El engorde arranca con el peso REAL, no con el peso base
const costo = tramosParaCosto(lote, tramos, acts, insumos)
chk("peso inicial del tramo de engorde", costo[1]!.peso_inicial_kg, 220 + 183 * 0.5)
console.log(`     el engorde arranca en ${costo[1]!.peso_inicial_kg.toFixed(1)} kg, no en los 220 del lote`)

// 6. El costo total sale de los dos tramos encadenados
const total = costo.reduce((s, t) => s + consumoMensual(t).reduce((x, m) => x + m.costo_total, 0), 0)
console.log(`     costo de alimentación de los 2 tramos: $${Math.round(total).toLocaleString("es-AR")} (100 cab)`)
chk("hay costo en los dos tramos", costo.length, 2)

// 7. Solapamientos detectados
const pisados: TramoLote[] = [tramos[0]!, { ...tramos[1]!, fecha_desde: "2026-09-01" }]
chk("detecta tramos que se pisan", solapamientos(pisados).length, 1)
chk("no marca solapamiento si encajan", solapamientos(tramos).length, 0)

console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLAS`)
process.exit(fallos ? 1 : 0)
