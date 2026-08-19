/**
 * Pone la marca `@pantalla` en un pendiente de PENDIENTES.md, sin editar la tabla a mano.
 *
 *   npx tsx scripts/marcar-pendiente.mts A-BUG-30 extracto cashflow
 *   npx tsx scripts/marcar-pendiente.mts A-BUG-30 --quitar   # lo vuelve a "sin ubicar"
 *   npx tsx scripts/marcar-pendiente.mts --sin-ubicar        # lista los que faltan etiquetar
 *   npx tsx scripts/marcar-pendiente.mts --pantallas         # las 12 solapas válidas
 *
 * ── Para qué es, en serio ────────────────────────────────────────────────────
 * NO es una herramienta anti-tipeo: una marca mal escrita ya la agarra
 * `verificar-parser-pendientes.mts` en segundos, y el ítem no se pierde (cae a "sin ubicar").
 *
 * Es para poder etiquetar **en volumen sin miedo**: el índice tiene 16 tablas con 10 formas de
 * encabezado distintas, así que agregar la marca a mano es contar pipes y rezar. Acá se dice el ID
 * y las pantallas, y el resto lo resuelve el script.
 *
 * No reordena, no reformatea, no toca ninguna otra línea: sólo inserta la marca en la fila del ID.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parsePendientes, faltaUbicar, PANTALLAS, MARCA_GENERAL } from '../lib/pendientes/parse'

const ARCHIVO = 'PENDIENTES.md'
const args = process.argv.slice(2)

/** `@general` es marca válida sin ser pantalla: "revisado, no va a ninguna en particular". */
const VALIDAS: readonly string[] = [...PANTALLAS, MARCA_GENERAL]
const listaPantallas = () => VALIDAS.map(s => '@' + s).join(' · ')

if (args.length === 0 || args[0] === '--pantallas') {
  console.log(`\nPantallas válidas:\n  ${listaPantallas()}\n`)
  console.log('Uso:  npx tsx scripts/marcar-pendiente.mts <ID> <pantalla> [pantalla…]')
  console.log('      npx tsx scripts/marcar-pendiente.mts --sin-ubicar\n')
  process.exit(args.length === 0 ? 1 : 0)
}

const md = readFileSync(ARCHIVO, 'utf8')

if (args[0] === '--sin-ubicar') {
  const { pendientes } = parsePendientes(md)
  // La cola real: sin revisar. Excluye `@general` y las secciones C/D, que ya tienen su lugar.
  const sin = pendientes.filter(faltaUbicar)
  console.log(`\n${sin.length} pendientes sin ubicar (los "hechos" no se cuentan):\n`)
  sin.forEach(p => console.log(`  ${p.id.padEnd(12)} ${p.grupo.padEnd(11)} ${p.titulo.slice(0, 70)}`))
  console.log(`\nPara marcar:  npx tsx scripts/marcar-pendiente.mts ${sin[0]?.id ?? 'ID'} <pantalla>\n`)
  process.exit(0)
}

// ── Marcar ──────────────────────────────────────────────────────────────────
const [id, ...marcasCrudas] = args
// `--quitar` existe porque marcar mal es MÁS grave que no marcar: un pendiente en la pantalla
// equivocada se busca donde corresponde y no aparece. Tiene que poder deshacerse en un comando.
const quitar = marcasCrudas.includes('--quitar')
const marcas = quitar ? [] : marcasCrudas.map(m => m.replace(/^@/, '').toLowerCase())

if (marcas.length === 0 && !quitar) {
  console.error(`\n❌ Falta la pantalla. Válidas: ${listaPantallas()}\n`)
  process.exit(1)
}

const invalidas = marcas.filter(m => !VALIDAS.includes(m))
if (invalidas.length > 0) {
  console.error(`\n❌ No son pantallas: ${invalidas.map(m => '@' + m).join(' ')}`)
  console.error(`   Válidas: ${listaPantallas()}\n`)
  process.exit(1)
}

// El ID tiene que existir en el índice — si no, se estaría marcando algo que el panel no muestra.
const { pendientes } = parsePendientes(md)
const encontrado = pendientes.filter(p => p.id === id)
if (encontrado.length === 0) {
  console.error(`\n❌ No hay ningún pendiente con ID "${id}" en el índice de ${ARCHIVO}.\n`)
  process.exit(1)
}

const lineas = md.split(/\r?\n/)
const marcaTexto = '`' + marcas.map(m => '@' + m).join(' ') + '`'
const tocadas: number[] = []

for (const p of encontrado) {
  const i = p.linea - 1
  let l = lineas[i]
  // Si ya tenía marcas, se reemplazan (marcar de nuevo = corregir, no acumular).
  l = l.replace(/`?@[a-z]+(\/[a-z0-9-]+)?`?/gi, (m, _s, pos: number) => {
    // Ojo con los mails del texto: sólo se saca si el @ no viene pegado a una palabra.
    const previo = l[pos - 1]
    return previo && /[\w.@-]/.test(previo) ? m : ''
  }).replace(/\s+\|/g, ' |').replace(/\s{2,}/g, ' ')
  if (quitar) {
    lineas[i] = l.replace(/\s+\|$/, ' |')
  } else {
    const idx = l.lastIndexOf('|')
    lineas[i] = l.slice(0, idx).replace(/\s+$/, '') + ` ${marcaTexto} ` + l.slice(idx)
  }
  tocadas.push(p.linea)
}

writeFileSync(ARCHIVO, lineas.join('\n'))
const queHizo = quitar ? 'sin ubicar (se muestra en todas)' : marcas.map(m => '@' + m).join(' ')
console.log(`\n✅ ${id} → ${queHizo}   (línea${tocadas.length > 1 ? 's' : ''} ${tocadas.join(', ')})`)
console.log('   Verificá con:  npx tsx scripts/verificar-parser-pendientes.mts\n')
