/**
 * CONTROL del índice de PENDIENTES.md — `npx tsx scripts/verificar-parser-pendientes.mts`
 *
 * No es un test unitario: es el control que exige `CLAUDE.md` § *Todo desarrollo termina con su
 * control*. Corre sobre el archivo REAL y **sale 1** si algo no cierra, así que no depende de que
 * alguien lo mire.
 *
 * Verifica tres cosas, de menor a mayor gravedad:
 *   1. Que no haya filas del índice sin poder leer.
 *   2. Que no haya marcas `@pantalla` mal escritas (el único camino por el que un pendiente
 *      podría no mostrarse en ningún lado).
 *   3. 🔒 EL INVARIANTE: **todo pendiente aparece en al menos una pantalla.**
 */
import { readFileSync } from 'node:fs'
import { parsePendientes, contarPorGrupo, pantallasDe, faltaUbicar, PANTALLAS } from '../lib/pendientes/parse'

const r = parsePendientes(readFileSync('PENDIENTES.md', 'utf8'))
let fallo = false

console.log(`\nDetectadas ${r.totalDetectadas} filas que empiezan con un ID`)
console.log(`  parseadas    ${r.pendientes.length}`)
console.log(`  ignoradas    ${r.ignoradas.length}  (mencionan un ID dentro de un dossier)`)
console.log(`  NO parseadas ${r.noParseadas.length}`)
console.log('\nPor grupo:', contarPorGrupo(r.pendientes))

// ── Cobertura por pantalla ──────────────────────────────────────────────────
// "Sin revisar" ≠ "sin pantalla": `@general` y las secciones C/D ya tienen su lugar.
const sinRevisar = r.pendientes.filter(faltaUbicar)
const conPantalla = r.pendientes.filter(p => p.pantallas.length > 0).length
const generales = r.pendientes.filter(p => p.esGeneral).length
const porPantalla = Object.fromEntries(PANTALLAS.map(s => [s, 0])) as Record<string, number>
r.pendientes.forEach(p => p.pantallas.forEach(s => { porPantalla[s]++ }))

console.log(`\nCon pantalla: ${conPantalla} · @general: ${generales} · SIN REVISAR: ${sinRevisar.length}`)
console.log('Por pantalla (sólo los marcados):')
Object.entries(porPantalla).filter(([, n]) => n > 0)
  .sort((a, b) => b[1] - a[1])
  .forEach(([s, n]) => console.log(`  @${s.padEnd(13)} ${n}`))

// ── 0. IDs duplicados ───────────────────────────────────────────────────────
// El ID es la identidad del pendiente: dos filas con el mismo ID son dos cosas distintas que se
// pisan. El ancla del dossier apunta a una sola, así que la otra queda sin detalle — y al hablar
// ("mirá el P-37") nadie sabe de cuál. Pasó de verdad: se crearon P-35/36/37 sobre IDs existentes
// y el control no lo vio porque no lo chequeaba.
const porId = new Map<string, number[]>()
r.pendientes.forEach(p => porId.set(p.id, [...(porId.get(p.id) ?? []), p.linea]))
const duplicados = [...porId.entries()].filter(([, ls]) => ls.length > 1)
if (duplicados.length > 0) {
  fallo = true
  console.log('\n🚨 IDs DUPLICADOS — dos pendientes distintos con el mismo nombre:')
  duplicados.forEach(([id, ls]) => console.log(`  ${id} → líneas ${ls.join(', ')}`))
}

// ── 1. Filas ilegibles ──────────────────────────────────────────────────────
if (r.noParseadas.length > 0) {
  fallo = true
  console.log('\n🚨 FILAS DEL ÍNDICE QUE NO SE PUDIERON LEER:')
  r.noParseadas.forEach(f => console.log(`  L${f.linea}: ${f.motivo}\n      ${f.texto.slice(0, 110)}`))
}

// ── 2. Marcas mal escritas ──────────────────────────────────────────────────
if (r.marcasDesconocidas.length > 0) {
  fallo = true
  console.log('\n🚨 MARCAS QUE NO SON NINGUNA DE LAS 12 SOLAPAS (¿tipeo?):')
  r.marcasDesconocidas.forEach(m => console.log(`  @${m.marca} → ${m.ids.join(', ')}`))
  console.log(`  Válidas: ${PANTALLAS.map(s => '@' + s).join(' ')}`)
}

// ── 3. El invariante ────────────────────────────────────────────────────────
const invisibles = r.pendientes.filter(p => pantallasDe(p).length === 0)
if (invisibles.length > 0) {
  fallo = true
  console.log('\n🚨 PENDIENTES QUE NO SE MUESTRAN EN NINGUNA PANTALLA:')
  invisibles.forEach(p => console.log(`  ${p.id} (L${p.linea})`))
} else {
  console.log(`\n✅ Los ${r.pendientes.length} pendientes se muestran en alguna pantalla`
    + (sinRevisar.length ? ` (${sinRevisar.length} sin revisar → aparecen en todas).` : '.'))
}

if (fallo) process.exit(1)
console.log('✅ Control OK.\n')
