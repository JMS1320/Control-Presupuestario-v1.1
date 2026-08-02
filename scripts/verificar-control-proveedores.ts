import { analizarProveedores, resumenCartera, type FacturaMes, type PuntoIpc } from "../lib/proveedores/control-subas"

let fallos = 0
const chk = (t: string, real: unknown, esp: unknown) => {
  const ok = JSON.stringify(real) === JSON.stringify(esp)
  if (!ok) fallos++
  console.log(`${ok ? "OK  " : "FALLA"} ${t}: ${JSON.stringify(real)} (esperado ${JSON.stringify(esp)})`)
}
const HOY = new Date(2026, 6, 30)   // 30/7/2026 → julio no cerró

const serie = (cuit: string, prov: string, montos: number[], desde = 12, fc = 1): FacturaMes[] =>
  montos.map((monto, i) => {
    const d = new Date(2025, desde - 1 + i, 1)
    return { cuit, proveedor: prov, anio: d.getFullYear(), mes: d.getMonth() + 1, monto, facturas: fc }
  })

// IPC 3 % mensual, dic-2025 → jun-2026
const ipc: PuntoIpc[] = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(2025, 11 + i, 1)
  return { anio: d.getFullYear(), mes: d.getMonth() + 1, variacion: 0.03 }
})

// Casos REALES de MSA
const facturas = [
  // Massaglia (asesor ganadero): escalones, +27 % en 7 pasos
  ...serie("20123456789", "MASSAGLIA ALDO ENRIQUE",
    [1633795, 1633795, 1633795, 1748193, 1896791, 1896791, 2067503]),
  // La Mercure (contable): +93 %, muy por encima del IPC
  ...serie("30111111111", "LA MERCURE S.R.L.",
    [1312600, 1312600, 1500000, 1800000, 2100000, 2400000, 2528000]),
  // Medicus: +23 %, en línea
  ...serie("30222222222", "MEDICUS",
    [724939, 750000, 780000, 810000, 840000, 865000, 889215]),
  // Autopistas: sube y BAJA todo el tiempo → es consumo, no precio
  ...serie("30333333333", "AUTOPISTAS URBANAS S. A.",
    [26984, 70098, 31000, 55000, 28000, 62000, 33000]),
]

const r = analizarProveedores(facturas, ipc, { ventanaMeses: 12, hoy: HOY })
console.log("\nproveedor                    meses  primero      ultimo       suba     IPC     brecha   situacion")
for (const a of r) {
  console.log(
    `${a.proveedor.slice(0, 26).padEnd(28)} ${String(a.mesesConFactura).padStart(3)}  ` +
    `${Math.round(a.primerMonto).toLocaleString("es-AR").padStart(10)}  ${Math.round(a.ultimoMonto).toLocaleString("es-AR").padStart(10)}  ` +
    `${(a.subaTotal * 100).toFixed(0).padStart(5)}%  ${a.ipcAcumulado == null ? "  n/d" : (a.ipcAcumulado * 100).toFixed(0).padStart(5) + "%"}  ` +
    `${a.brecha == null ? "   n/d" : (a.brecha * 100).toFixed(0).padStart(6)}   ${a.semaforo}`)
}
console.log("")

const de = (n: string) => r.find(a => a.proveedor.startsWith(n))!

// 1. El mes en curso (julio) no entra: la última punta es junio
chk("julio no entra (no cerró)", de("MASSAGLIA").ultimoMes, "2026-06")

// 2. IPC acumulado dic→jun = 1.03^6 − 1 = 19,4 %
chk("IPC acumulado del período", Math.round(de("MEDICUS").ipcAcumulado! * 1000) / 10, 19.4)

// 3. Medicus subió 22,7 % contra 19,4 % de IPC → en línea (tolerancia 5 puntos)
chk("Medicus en línea con el IPC", de("MEDICUS").semaforo, "ok")

// 4. La Mercure subió 93 % contra 19,4 % → alerta
chk("La Mercure muy por encima", de("LA MERCURE").semaforo, "alerta")
chk("brecha de La Mercure ~73 puntos", Math.round(de("LA MERCURE").brecha! * 100), 73)

// 5. Massaglia +27 % → por encima pero no escandaloso
chk("Massaglia por encima", de("MASSAGLIA").semaforo, "atencion")

// 6. Autopistas: baja seguido → NO se compara con el IPC aunque el número sea grande
const auto = de("AUTOPISTAS")
chk("Autopistas detectado como consumo", auto.esPrecio, false)
chk("y no se lo marca como aumento", auto.semaforo, "volumen")
console.log(`     bajó ${auto.bajas} de ${auto.mesesConFactura} meses: es volumen, no precio`)

// 7. Sin IPC no se inventa una comparación
const sinIpc = analizarProveedores(facturas, [], { ventanaMeses: 12, hoy: HOY })
chk("sin IPC no compara", sinIpc.find(a => a.proveedor.startsWith("MEDICUS"))!.semaforo, "sin_ipc")
chk("pero igual mide la suba", Math.round(sinIpc.find(a => a.proveedor.startsWith("MEDICUS"))!.subaTotal * 100), 23)

// 8. El IPC se carga en ESCALONES y se arrastra: no hace falta repetir el mismo
//    número doce veces. Con sólo dic cargado, el resto hereda ese 3 %.
const ipcEscalon: PuntoIpc[] = [{ anio: 2025, mes: 12, variacion: 0.03 }]
chk("un solo punto se arrastra a todo el tramo",
  Math.round(analizarProveedores(facturas, ipcEscalon, { ventanaMeses: 12, hoy: HOY })
    .find(a => a.proveedor.startsWith("MEDICUS"))!.ipcAcumulado! * 1000) / 10, 19.4)

// Dos escalones: 3 % hasta marzo, 1 % de abril en adelante
const dosEscalones: PuntoIpc[] = [
  { anio: 2025, mes: 12, variacion: 0.03 },
  { anio: 2026, mes: 4, variacion: 0.01 },
]
const acum2 = analizarProveedores(facturas, dosEscalones, { ventanaMeses: 12, hoy: HOY })
  .find(a => a.proveedor.startsWith("MEDICUS"))!.ipcAcumulado!
chk("dos escalones: 3 % x3 + 1 % x3", Math.round(acum2 * 1000) / 10,
  Math.round((Math.pow(1.03, 3) * Math.pow(1.01, 3) - 1) * 1000) / 10)

// 8b. Si NO hay nada que arrastrar en el tramo, no se inventa la comparación
const ipcFuturo: PuntoIpc[] = [{ anio: 2027, mes: 1, variacion: 0.03 }]
chk("IPC posterior al tramo igual resuelve (toma el primero)",
  analizarProveedores(facturas, ipcFuturo, { ventanaMeses: 12, hoy: HOY })
    .find(a => a.proveedor.startsWith("MEDICUS"))!.ipcAcumulado != null, true)
chk("sin ningún punto, null",
  analizarProveedores(facturas, [], { ventanaMeses: 12, hoy: HOY })
    .find(a => a.proveedor.startsWith("MEDICUS"))!.ipcAcumulado, null)

// 9. Resumen
const res = resumenCartera(r)
chk("3 de precio, 1 por consumo", [res.dePrecio, res.porVolumen], [3, 1])
chk("2 por encima del IPC", res.porEncima, 2)

console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLAS`)
process.exit(fallos ? 1 : 0)
