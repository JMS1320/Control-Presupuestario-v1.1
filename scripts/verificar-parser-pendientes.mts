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

// ── 4. Los A-TEST abiertos, ¿tienen su PROCESO? ─────────────────────────────
//
// 🧪 **A-FEAT-129 — el test viaja con el proceso.** Un `A-TEST` sin marca `@pantalla/proceso` no
// aparece en el modal donde se corre ese proceso, así que **sólo se puede probar si alguien se
// acuerda de abrir `PENDIENTES.md`** — que es exactamente lo que la feature vino a evitar.
//
// Pedido del usuario 2026-09-11: *«siempre dejarlo anotado en la app así voy testeando en procesos
// reales»*. **«Siempre» no es una intención: es esto.** Sin el control, la marca se pone las
// primeras semanas y después se olvida, y nadie se entera hasta que el cartel deja de avisar.
//
// ⚠️ **Avisa, no rompe.** Hay tests que no cuelgan de un proceso concreto (auditorías, revisiones
// de datos) y forzarlos a inventar uno sería peor: una marca puesta para callar al control manda
// el aviso a la pantalla equivocada.
// ⚠️ **Sólo se cuentan los que el USUARIO corre en una pantalla.** Quedan afuera:
//   · los `npm run probar*` — los corre Claude, no tienen pantalla donde aparecer;
//   · los que no tienen ni marca de pantalla — son de GAS, API o de la base, no de la app.
// La primera versión de este control listaba **98** metiendo a los dos grupos, y un control que
// grita de más enseña a ignorarlo: la lista deja de leerse justo cuando tiene algo importante.
const cerradoTest = (p: { estado: string }) => ['✅', '⚰️', '⏸️'].some(e => (p.estado || '').includes(e))
const esSuiteAutomatica = (p: { titulo: string; detalle: string | null }) =>
  /npm run /i.test(`${p.titulo} ${p.detalle ?? ''}`)

const testsSinProceso = r.pendientes.filter(p =>
  /^A-TEST-/i.test(p.id) && !cerradoTest(p)
  && p.procesos.length === 0
  && p.pantallas.length > 0        // si no dice dónde, no hay dónde mostrarlo
  && !esSuiteAutomatica(p))

if (testsSinProceso.length > 0) {
  console.log(`\n⚠️  ${testsSinProceso.length} A-TEST abierto(s) SIN marca de proceso — no le van a aparecer al usuario donde se prueban:`)
  testsSinProceso.slice(0, 20).forEach(p =>
    console.log(`  ${p.estado} ${p.id.padEnd(11)} ${p.pantallas.length ? '@' + p.pantallas.join(' @') : '(sin pantalla)'} · ${p.titulo.slice(0, 80)}`))
  if (testsSinProceso.length > 20) console.log(`  … y ${testsSinProceso.length - 20} más`)
  console.log('  → agregarles `@pantalla/proceso` (ej. `@sueldos/pago`, `@cashflow/sicore`)')
} else {
  console.log('\n✅ Todos los A-TEST abiertos tienen su proceso: le van a aparecer al usuario donde se prueban.')
}

if (fallo) process.exit(1)
console.log('✅ Control OK.\n')
