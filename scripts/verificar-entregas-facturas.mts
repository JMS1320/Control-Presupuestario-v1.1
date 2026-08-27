/**
 * Control de `lib/productivo/entregas-facturas.ts` con el caso LONGO, que es el que obliga a
 * que el vínculo sea muchos a muchos.
 *
 *     FC 13/07 por 25,0 t  →  se entregaron 20,1 t el 24/06
 *     FC 14/08 por 20,1 t  →  se entregaron 25,0 t el 24/07
 *
 * Las 4,9 t de diferencia son un anticipo con su propio precio. Si esto da bien, el modelo
 * soporta el peor caso que tenemos documentado.
 *
 *     npx tsx scripts/verificar-entregas-facturas.mts
 */

import { conciliarEntregasFacturas, entregasParaConsumo,
  type EntregaInsumo, type FacturaCompra, type Vinculo } from "../lib/productivo/entregas-facturas"

const n = (x: number) => x.toLocaleString("es-AR", { maximumFractionDigits: 2 })
const pesos = (x: number) => `$${Math.round(x).toLocaleString("es-AR")}`

const ENTREGAS: EntregaInsumo[] = [
  { id: "e1", fecha: "2026-06-24", cantidad: 20100, proveedor: "Longo", costoUnitarioManual: null },
  { id: "e2", fecha: "2026-07-24", cantidad: 25000, proveedor: "Longo", costoUnitarioManual: null },
]

const FACTURAS: FacturaCompra[] = [
  { id: "f1", fecha: "2026-07-13", proveedor: "Longo", numero: "0001-00000001", neto: 6687500, total: 6687500 },
  { id: "f2", fecha: "2026-08-14", proveedor: "Longo", numero: "0001-00000002", neto: 5367705, total: 5367705 },
]

// La FC 13/07 (25 t a $267,50/kg) cubre las 20,1 entregadas + 4,9 de anticipo que se aplican
// a la entrega siguiente. La FC 14/08 (20,1 t a $267,05) cubre el resto de la segunda.
const VINCULOS: Vinculo[] = [
  { id: "v1", movimientoId: "e1", facturaId: "f1", cantidad: 20100, precioUnitario: 267.5 },
  { id: "v2", movimientoId: "e2", facturaId: "f1", cantidad: 4900, precioUnitario: 267.5 },
  { id: "v3", movimientoId: "e2", facturaId: "f2", cantidad: 20100, precioUnitario: 267.05 },
]

const c = conciliarEntregasFacturas(ENTREGAS, FACTURAS, VINCULOS)

console.log("\n=== ENTREGAS ===")
for (const e of c.entregas) {
  console.log(`\n  ${e.entrega.fecha}  ${n(e.entrega.cantidad)} kg`)
  for (const v of e.vinculos) {
    console.log(`    ← FC ${v.factura?.numero ?? v.facturaId} (${v.factura?.fecha}): `
      + `${n(v.cantidad)} kg a ${pesos(v.precioUnitario ?? 0)}/kg`)
  }
  console.log(`    precio de la entrega: ${e.precioUnitario == null ? "—" : pesos(e.precioUnitario) + "/kg"}`
    + `  (${e.origenPrecio})`)
  for (const f of e.faltantes) console.log(`    ⚠️  ${f}`)
}

console.log("\n=== FACTURAS ===")
for (const f of c.facturas) {
  console.log(`  FC ${f.factura.numero} ${f.factura.fecha}  neto ${pesos(f.factura.neto)}`)
  console.log(`    aplicado a entregas: ${n(f.cantidadAplicada)} kg = ${pesos(f.montoAplicado)}`
    + (f.anticipo != null && Math.abs(f.anticipo) > 1 ? `  · sin entregar ${pesos(f.anticipo)}` : "  ✓ aplicada entera"))
}

console.log("\n=== CONTROLES ===")
let ok = true
for (const ctl of c.controles) {
  if (!ctl.cierra) ok = false
  console.log(`  ${ctl.cierra ? "✓" : "✗"} ${ctl.nombre.padEnd(30)} ${ctl.detalle}`)
}

console.log("\n=== LO QUE VE consumo.ts ===")
for (const e of entregasParaConsumo(c)) {
  console.log(`  ${e.fecha}  ${n(e.cantidad)} kg a ${e.precioUnitario == null ? "—" : pesos(e.precioUnitario)}/kg`)
}

console.log(ok ? "\n✅ El caso Longo cierra.\n" : "\n❌ NO cierra.\n")
process.exit(ok ? 0 : 1)
