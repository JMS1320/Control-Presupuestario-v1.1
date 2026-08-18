/**
 * Control del parser de PENDIENTES.md — se corre con `npx tsx scripts/verificar-parser-pendientes.mts`
 *
 * No es un test unitario: es el control que pide P-37 etapa 1. Corre el parser contra el archivo
 * REAL y falla (exit 1) si quedó alguna fila sin leer. El panel no puede mostrar 160 de 166 sin
 * que nadie se entere.
 */
import { readFileSync } from 'node:fs'
import { parsePendientes, contarPorGrupo } from '../lib/pendientes/parse'

const md = readFileSync('PENDIENTES.md', 'utf8')
const r = parsePendientes(md)
const porGrupo = contarPorGrupo(r.pendientes)

console.log(`\nDetectadas ${r.totalDetectadas} filas que empiezan con un ID`)
console.log(`  parseadas    ${r.pendientes.length}`)
console.log(`  ignoradas    ${r.ignoradas.length}  (mencionan un ID dentro de un dossier)`)
console.log(`  NO parseadas ${r.noParseadas.length}  ← esto es la alarma\n`)
console.log('Por grupo:', porGrupo, '\n')

console.log('Muestra (3 de cada grupo):')
for (const g of ['urgente', 'secundario', 'test', 'hecho'] as const) {
  r.pendientes.filter(p => p.grupo === g).slice(0, 3).forEach(p => {
    console.log(`  [${g}] ${p.id} · ${p.estado} · ${(p.prioridad ?? p.tipo ?? '—')} · ${p.titulo.slice(0, 62)}`)
  })
}

if (r.noParseadas.length > 0) {
  console.log('\n⚠️  NO PARSEADAS:')
  r.noParseadas.forEach(f => console.log(`  L${f.linea}: ${f.motivo}\n      ${f.texto.slice(0, 110)}`))
  process.exit(1)
}
console.log('\n✅ 0 filas perdidas.')
