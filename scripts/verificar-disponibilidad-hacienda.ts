import { disponiblePorDiferencia, existenciasDePesada, existenciasDeCiclos } from "../lib/ganaderia/disponibilidad"

let fallos = 0
const chk = (t: string, real: number, esp: number, tol = 0.05) => {
  const ok = Math.abs(real - esp) <= tol
  if (!ok) fallos++
  console.log(`${ok ? "OK  " : "FALLA"} ${t}: ${real.toFixed(2)} (esperado ${esp})`)
}

// ── Datos reales de la BD ────────────────────────────────────────────────────
// 98 machos, promedio 245,54 · 64 hembras. Lote de los 55 más pesados a 275 kg.
const machos = Array.from({ length: 98 }, (_, i) => ({
  peso_kg: 245.54 + (i < 55 ? 29.68 : -37.96), sexo: "Macho", es_torito: false,
}))
const pesada = existenciasDePesada(
  [...machos, ...Array.from({ length: 64 }, () => ({ peso_kg: 192, sexo: "Hembra", es_torito: false }))],
  "2026-07", "stock de hoy",
)

const CICLO_2627 = "b37a0e24", CICLO_2728 = "50100830"
const ciclos = existenciasDeCiclos([
  { id: CICLO_2627, campania: "26/27", fecha_destete: "2027-03-01", terneros_venta: 93.5, terneras_venta: 26.5, peso_macho: 197.34, peso_hembra: 197.34 },
  { id: CICLO_2728, campania: "27/28", fecha_destete: "2028-03-01", terneros_venta: 110.5, terneras_venta: 78.5, peso_macho: 197.34, peso_hembra: 197.34 },
], "2026-07")

const lotes: any[] = [
  { id: "L1", categoria: "Ternero Recria", ciclo_id: null, cantidad: 55, peso_base_kg: 275, fecha_venta_estimada: "2026-08-04" },
  { id: "L2", categoria: "Ternero al Pie", ciclo_id: CICLO_2627, cantidad: 93.5, peso_base_kg: 197.34, fecha_venta_estimada: "2027-03-01" },
  { id: "L3", categoria: "Ternera al Pie", ciclo_id: CICLO_2627, cantidad: 26.5, peso_base_kg: 197.34, fecha_venta_estimada: "2027-03-01" },
]

const d = disponiblePorDiferencia([...pesada, ...ciclos], lotes as any, [])
console.log("\n--- disponible ---")
for (const x of d) console.log(`  ${x.mes}  ${x.categoria.padEnd(18)} ${x.cabezas.toFixed(1).padStart(6)} cab · ${x.peso_prom.toFixed(1)} kg prom  (${x.detalle})`)
console.log("")

const buscar = (cat: string, mes: string) => d.find(x => x.categoria === cat && x.mes === mes)

// 1. El saldo de machos baja de peso al vender los 55 más pesados
const m = buscar("Ternero Recria", "2026-07")!
chk("machos que quedan", m.cabezas, 43)
chk("promedio del saldo (NO 245,5)", m.peso_prom, 207.58, 0.5)

// 2. Las hembras no tienen venta: quedan todas
const h = buscar("Ternera Recria", "2026-07")!
chk("hembras que quedan", h.cabezas, 64)
chk("promedio hembras", h.peso_prom, 192)

// 3. Destete 26/27 totalmente vendido → no aparece
chk("destete 26/27 machos (vendido, no aparece)", buscar("Ternero al Pie", "2027-03") ? 1 : 0, 0)
chk("destete 26/27 hembras (vendido, no aparece)", buscar("Ternera al Pie", "2027-03") ? 1 : 0, 0)

// 4. Destete 27/28 sin venta → aparece entero
chk("destete 27/28 machos", buscar("Ternero al Pie", "2028-03")!.cabezas, 110.5)
chk("destete 27/28 hembras", buscar("Ternera al Pie", "2028-03")!.cabezas, 78.5)

// 5. El lote de un ciclo NO puede netear contra el stock de hoy
const soloStock = disponiblePorDiferencia(pesada, [lotes[1]] as any, [])
chk("lote del destete no toca el stock de hoy", soloStock.find(x => x.categoria === "Ternero Recria")!.cabezas, 98)


// ══ Vacas de refugo: son existencia disponible, no se veian ═════════════════
console.log("\n--- vacas de refugo ---")
const conDescarte = existenciasDeCiclos([
  { id: CICLO_2627, campania: "26/27", fecha_destete: "2027-03-01",
    terneros_venta: 93.5, terneras_venta: 26.5, peso_macho: 197.34, peso_hembra: 197.34,
    descarte: 32, peso_descarte: 450 },
], "2026-07")
const refugo = conDescarte.find(e => e.categoria === "Vaca CUT/Descarte")!
console.log(`     ${refugo.cabezas} cab x ${refugo.kg / refugo.cabezas} kg = ${refugo.kg.toLocaleString("es-AR")} kg`)
chk("el refugo aparece como existencia", refugo.cabezas, 32)
chk("con su peso propio", refugo.kg, 14400)

// Y NO comparte clave con las terneras: un lote de terneras no puede netear contra las vacas
const clavesDistintas = new Set(conDescarte.map(e => e.clave)).size
chk("cada tropa con su clave", clavesDistintas, 3)
const loteTerneras: any[] = [
  { id: "LT", categoria: "Ternera al Pie", ciclo_id: CICLO_2627, cantidad: 26.5,
    peso_base_kg: 197.34, fecha_venta_estimada: "2027-03-01" },
]
const d2 = disponiblePorDiferencia(conDescarte, loteTerneras as any, [])
chk("vender las terneras no toca el refugo",
  d2.find(x => x.categoria === "Vaca CUT/Descarte")!.cabezas, 32)
chk("y las terneras si quedan en cero (no aparecen)",
  d2.filter(x => x.categoria === "Ternera al Pie").length, 0)

console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLAS`)
process.exit(fallos ? 1 : 0)
