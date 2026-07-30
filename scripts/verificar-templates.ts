import { proyectarTemplate, avisoFaltaGenerar, type TemplateInfo, type CuotaMes, type CeldaTemplate } from "../lib/presupuesto/templates"

let fallos = 0
const chk = (t: string, real: unknown, esp: unknown) => {
  const ok = JSON.stringify(real) === JSON.stringify(esp)
  if (!ok) fallos++
  console.log(`${ok ? "OK  " : "FALLA"} ${t}: ${JSON.stringify(real)} (esperado ${JSON.stringify(esp)})`)
}

// IPC como lo cargó el usuario: escalones
const ipc = [
  { anio: 2026, mes: 7, valor: 2.0 },
  { anio: 2026, mes: 12, valor: 1.5 },
  { anio: 2027, mes: 6, valor: 1.0 },
]
const meses = Array.from({ length: 18 }, (_, i) => {
  const d = new Date(2026, 6 + i, 1)   // jul-26 → dic-27
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 }
})
const q = (mes: string, monto: number): CuotaMes => ({ egreso_id: "T", mes, monto })

// ── 1. ANUAL en cuotas: Inmobiliario paga feb, abr, jun, ago, oct
const inmob: TemplateInfo = { id: "T", nombre: "Inmobiliario Cuota Rojas", periodicidad: "anual", aplica_generacion: null }
const histInmob = [
  q("2026-02", 100000), q("2026-04", 100000), q("2026-06", 100000),
  q("2026-08", 110000), q("2026-10", 110000),
]
const cInmob = proyectarTemplate(inmob, histInmob, meses, { ipc })
const conMonto = cInmob.filter(c => c.monto > 0)
console.log("\n--- impuesto anual en cuotas (feb/abr/jun/ago/oct) ---")
for (const c of cInmob.filter(c => c.monto > 0 || c.origen === "cuota")) {
  console.log(`  ${c.mes}  ${Math.round(c.monto).toLocaleString("es-AR").padStart(9)}  ${c.origen}`)
}
chk("no inventa pagos en meses que no paga", cInmob.filter(c => c.mes.endsWith("-03") && c.monto > 0).length, 0)
chk("sep-26 tampoco", cInmob.find(c => c.mes === "2026-09")!.monto, 0)
chk("ago y oct 26 son cuota cargada",
  [cInmob.find(c => c.mes === "2026-08")!.origen, cInmob.find(c => c.mes === "2026-10")!.origen], ["cuota", "cuota"])
chk("2027 se proyecta sólo en sus 5 meses",
  cInmob.filter(c => c.mes.startsWith("2027") && c.monto > 0).length, 5)
chk("feb-27 sale del feb-26 + IPC",
  Math.round(cInmob.find(c => c.mes === "2027-02")!.monto) > 100000, true)
console.log(`     feb-27 = ${Math.round(cInmob.find(c => c.mes === "2027-02")!.monto).toLocaleString("es-AR")} (feb-26 fue 100.000)`)

// ── 2. MENSUAL: sí se proyecta todos los meses
const cargas: TemplateInfo = { id: "T", nombre: "Cargas Sociales", periodicidad: "bianual", aplica_generacion: true }
const histCargas = Array.from({ length: 6 }, (_, i) => q(`2026-0${i + 1}`, 500000 + i * 20000))
const cCargas = proyectarTemplate(cargas, histCargas, meses, { ipc })
console.log("\n--- mensual (Cargas Sociales, aplica_generacion = true) ---")
chk("se proyecta todos los meses", cCargas.filter(c => c.monto > 0).length, 18)
chk("y marca que falta generar la campaña", cCargas[0]!.faltaGenerar, true)
console.log(`     jul-26 = ${Math.round(cCargas[0]!.monto).toLocaleString("es-AR")} · ${cCargas[0]!.explicacion}`)

// ── 3. La cuota cargada MANDA sobre la proyección
const conCuota = proyectarTemplate(cargas, [...histCargas, q("2026-09", 999999)], meses, { ipc })
chk("donde hay cuota, manda la cuota", conCuota.find(c => c.mes === "2026-09")!.monto, 999999)
chk("y no se marca como pendiente", conCuota.find(c => c.mes === "2026-09")!.faltaGenerar, false)

// ── 4. Sin historia no inventa nada
const nuevo = proyectarTemplate({ id: "T", nombre: "Nuevo", periodicidad: null, aplica_generacion: null }, [], meses, { ipc })
chk("sin cuotas no proyecta", nuevo.filter(c => c.monto !== 0).length, 0)

// ── 5. El aviso junta sólo los de carga manual
const aviso = avisoFaltaGenerar({
  cargas: { info: cargas, celdas: cCargas },
  inmob: { info: inmob, celdas: cInmob },
})
chk("el aviso cuenta sólo Cargas Sociales", aviso.templates, 1)
chk("y lo nombra", aviso.nombres, ["Cargas Sociales"])
console.log(`     aviso: ${aviso.templates} template, ${aviso.meses.length} meses, $${Math.round(aviso.monto).toLocaleString("es-AR")}`)

console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLAS`)
process.exit(fallos ? 1 : 0)
