// Control de `lib/conciliacion/columnas-extracto`: los casos reales de sueldos que ya están
// cargados. Correr después de tocar la convención de columnas (PENDIENTES § A-FEAT-31).
//   npx tsx scripts/verificar-columnas-extracto.mts
import { comprobanteDeSueldo, especificacionDeSueldo } from '../lib/conciliacion/columnas-extracto'
const casos: [string, string|null][] = [
  ['Anticipo May 2026 - Lucresia', 'Lucresia'],
  ['Anticipo May 2026 - Galicia', 'Galicia'],
  ['Anticipo May 2026 - Santander', 'Santander'],
  ['Anticipo Mar 2026', null],
  ['Pago Saldo Abr 2026', null],
  ['Pago Francos', 'Pago Francos'],
  ['Compras en Supermercado', 'Compras en Supermercado'],
  ['Formalmente un anticipo de sueldo pero es eq a sus francos de Junio.', 'Formalmente un anticipo de sueldo pero es eq a sus francos de Junio.'],
]
let fallos = 0
for (const [inp, esp] of casos) {
  const r = especificacionDeSueldo(inp)
  const ok = r === esp
  if (!ok) fallos++
  console.log(`${ok ? 'OK ' : 'MAL'}  "${inp}" -> ${JSON.stringify(r)}${ok ? '' : `  (esperaba ${JSON.stringify(esp)})`}`)
}
console.log('---')
console.log('anticipo Mar 2026 ->', comprobanteDeSueldo('anticipo', 3, 2026))
console.log('sueldo   May 2026 ->', comprobanteDeSueldo('sueldo', 5, 2026))
console.log('sin tipo Jun 2026 ->', comprobanteDeSueldo(null, 6, 2026))
console.log('sin periodo       ->', comprobanteDeSueldo('anticipo', null, null))
process.exit(fallos)
