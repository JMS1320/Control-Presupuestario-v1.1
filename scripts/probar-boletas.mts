/**
 * `npm run probar:boletas` — el parser de boletas de ARBA contra los PDFs reales.
 *
 * Lee **todas** las boletas de la carpeta de comunicación y verifica que salgan partida, cuota,
 * importe y vencimiento. **No toca la base**: sólo lee archivos.
 *
 * ## Por qué hace falta
 * Estas boletas traen el texto como **glyph IDs de una fuente subseteada** y hay que decodificarlo
 * con el CMap `/ToUnicode` **siguiendo los `Tf`** del contenido. Es la técnica más frágil de todo lo
 * que se escribió: si ARBA cambia cómo genera el PDF, deja de leer **sin tirar un error**.
 *
 * Y el modo de falla ya se vio en el romaneo: devolver vacío en silencio. Por eso acá el criterio no
 * es «no explotó» sino **cuántas leyó bien**.
 *
 * ⚠️ Necesita los PDFs de la carpeta de comunicación, que **no están en el repo**. Si no están,
 * avisa y sale sin fallar: es un diagnóstico, no una compuerta.
 */
import fs from "node:fs"
import path from "node:path"

const B = process.cwd().split("\\").join("/")
const DIR = `${B}/- Comunicacion JMS Claude - Archivos/boletas inmobiliario`

if (!fs.existsSync(DIR)) {
  console.log(`No está la carpeta de boletas:\n  ${DIR}\nEste diagnóstico necesita los PDFs reales. Salteado.`)
  process.exit(0)
}

const { parsearBoletaArba } = await import(`file:///${B}/lib/arba/parsear-boleta.ts`)

function pdfs(dir: string, acc: string[] = []): string[] {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n)
    if (fs.statSync(p).isDirectory()) pdfs(p, acc)
    else if (/\.pdf$/i.test(n)) acc.push(p)
  }
  return acc
}

/** Casos con el valor esperado a mano: si éstos fallan, el parser dejó de leer. */
const ESPERADO: Record<string, { partida: string; importe: number }> = {
  "2026 - Inmob - Cuota 1 + Anual - Casco.pdf": { partida: "099-006595-0", importe: 1198244.2 },
  "2026 - Inmob - Cuota 1 + Anual - Rojas.pdf": { partida: "090-016369-0", importe: 2096673.6 },
  "2026 - Inmob - Cuota 1 + Anual - Ombu.pdf": { partida: "099-016666-8", importe: 463641.3 },
}

const archivos = pdfs(DIR).sort()
let conPartida = 0, conImporte = 0, mudos = 0, fallanEsperados = 0

console.log(`\n═══ ${archivos.length} boletas ═══\n`)
for (const f of archivos) {
  const buf = fs.readFileSync(f)
  const b = await parsearBoletaArba(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const nombre = path.basename(f)

  if (b.partida) conPartida++
  if (b.importe != null) conImporte++
  if (!b.texto.trim()) { mudos++; console.log(`  ✗ ${nombre}\n      el PDF no devolvió texto`) }

  const esp = ESPERADO[nombre]
  if (esp) {
    const okP = b.partida === esp.partida
    const okI = b.importe != null && Math.abs(b.importe - esp.importe) < 1
    if (!okP || !okI) {
      fallanEsperados++
      console.log(`  ✗ ${nombre}`)
      if (!okP) console.log(`      partida esperada ${esp.partida} · leída ${b.partida}`)
      if (!okI) console.log(`      importe esperado ${esp.importe} · leído ${b.importe}`)
    } else {
      console.log(`  ✓ ${nombre}\n      ${b.partida} · cuota ${b.cuota} · $${b.importe?.toLocaleString("es-AR")} · vence ${b.vencimiento}`)
    }
  }
}

console.log(`\n── Resumen ──`)
console.log(`  con partida     ${conPartida} de ${archivos.length}`)
console.log(`  con importe     ${conImporte} de ${archivos.length}`)
console.log(`  sin texto       ${mudos}`)
console.log(`  casos con valor esperado que fallan: ${fallanEsperados} de ${Object.keys(ESPERADO).length}`)

// 📌 No todas las boletas TIENEN partida: los comprobantes de pago y el complementario no la traen.
// Por eso el criterio de falla es sólo (a) que un PDF no devuelva texto —ahí se rompió la técnica— o
// (b) que falle un caso con valor esperado a mano.
if (mudos > 0) console.log(`\n⚠️ ${mudos} PDF(s) no devolvieron texto: la lectura de glifos puede haberse roto.`)
process.exit(fallanEsperados > 0 || mudos > 0 ? 1 : 0)
