/**
 * `npm run probar:mag` — la ruta de precios del Mercado Agroganadero, contra el sitio real.
 *
 * Importa **la ruta que se despliega** (`app/api/precios-mag/route.ts`) y la llama como la llamaría
 * el navegador. **Sólo lee**: no toca la base ni escribe nada.
 *
 * ## Qué vigila, y por qué esas cosas
 * El riesgo de esta ruta no es que se rompa: es que **siga devolviendo algo plausible cuando el
 * mercado cambie la página**. Por eso los casos no miran «respondió 200» sino los números:
 *
 * - **La fila `Totales` del pie NO entra.** Es el mercado entero otra vez: sin filtrarla las cabezas
 *   daban **35.210 en vez de 17.605**, un número redondo y creíble que no dispara ninguna alarma.
 * - **`importe ÷ kilos = promedio`** en cada fila. Es el control que trae el propio papel.
 * - **`estado`** distingue *provisorios* de *definitivos*: comparar un negocio contra un provisorio y
 *   no volver a mirarlo es quedarse con un número que el mercado ya corrigió.
 * - **Un rango sin datos** (fin de semana) tiene que dar 404 **explicando**, no una lista vacía.
 *
 * ⚠️ **Necesita internet.** Si el sitio no responde, avisa y sale sin fallar: un test de red que
 * falla por la red manda a buscar el bug donde no está.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const B = process.cwd().split("\\").join("/")

// `next/server` no resuelve en Node plano (falta la extensión). Se copia la ruta a un temporal con
// el import resuelto, igual que hace `scripts/probar.mjs` con el alias `@/`. El rodeo está acá y no
// en el código de la app: ensuciar la ruta para que corra el runner sería pagar el precio al revés.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mag-"))
const destino = path.join(tmp, "route.ts")
fs.writeFileSync(
  destino,
  fs.readFileSync(`${B}/app/api/precios-mag/route.ts`, "utf8")
    .replace(/from ["']next\/server["']/g, `from "${pathToFileURL(`${B}/node_modules/next/server.js`).href}"`),
)
const { GET } = await import(pathToFileURL(destino).href)

const r: { ok: boolean; caso: string; detalle: string }[] = []
const chequear = (caso: string, ok: boolean, detalle: string) => r.push({ ok, caso, detalle })

const pedir = async (qs: string) => {
  const res = await GET(new Request(`http://local/api/precios-mag?${qs}`))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

// ── La semana que ya conocemos: 31/08 al 04/09 ────────────────────────────────────────────────
let base: Awaited<ReturnType<typeof pedir>>
try {
  base = await pedir("desde=2026-08-31&hasta=2026-09-04")
} catch (e) {
  console.log(`No se pudo llegar al Mercado Agroganadero: ${(e as Error).message}\nSalteado (necesita internet).`)
  process.exit(0)
}

if (base.status !== 200) {
  console.log(`El mercado respondió ${base.status}: ${base.json.error}\nSalteado — puede ser el sitio, no el código.`)
  process.exit(0)
}

const filas = base.json.filas as { categoria: string; promedio: number; importe: number; kilos: number; cabezas: number; familia: string }[]

chequear("Devuelve las 18 categorías", filas.length === 18, `${filas.length} filas`)

chequear("🔴 La fila «Totales» del pie NO entra (duplicaría el mercado)",
  !filas.some(f => /^totales?$/i.test(f.categoria)),
  filas.some(f => /^totales?$/i.test(f.categoria)) ? "¡entró!" : "no está")

const cabezas = filas.reduce((s, f) => s + f.cabezas, 0)
chequear("Las cabezas suman 17.605 (con Totales darían 35.210)",
  cabezas === 17605, `${cabezas.toLocaleString("es-AR")} cabezas`)

const descuadres = filas.filter(f => f.kilos > 0 && Math.abs(f.importe / f.kilos - f.promedio) > 1)
chequear("importe ÷ kilos = promedio, en TODAS las filas",
  descuadres.length === 0, descuadres.length ? descuadres.map(f => f.categoria).join(", ") : "0 descuadres")

chequear("Marca el estado de los precios", base.json.estado === "definitivos", String(base.json.estado))

const vacas = filas.filter(f => f.familia === "VACAS")
chequear("Separa familia y calidad (VACAS son 5 categorías)", vacas.length === 5, `${vacas.length} de VACAS`)

const conserva = filas.find(f => f.categoria === "VACAS Conserva Buena")
chequear("Lee el promedio de VACAS Conserva Buena", conserva?.promedio === 2524.231, String(conserva?.promedio))

const toros = filas.find(f => f.categoria === "TOROS Esp.")
chequear("Lee el promedio de TOROS Esp.", toros?.promedio === 3304.453, String(toros?.promedio))

chequear("Ninguna categoría viene vacía", filas.every(f => f.categoria.trim().length > 2), "todas con nombre")

// ── Los adversarios ───────────────────────────────────────────────────────────────────────────
const finde = await pedir("desde=2026-09-05&hasta=2026-09-06")
chequear("Un fin de semana da 404 EXPLICANDO, no una lista vacía",
  finde.status === 404 && /lunes a viernes/i.test(String(finde.json.error)),
  `${finde.status} · ${String(finde.json.error ?? "").slice(0, 60)}`)

const malaFecha = await pedir("desde=31-08-2026&hasta=04/09/2026")
chequear("Una fecha mal escrita da 400, no una pantalla rota",
  malaFecha.status === 400, `${malaFecha.status}`)

const sinFechas = await pedir("")
chequear("Sin fechas, 400 diciendo cuáles faltan",
  sinFechas.status === 400 && /desde/i.test(String(sinFechas.json.error)), `${sinFechas.status}`)

for (const x of r) {
  console.log(`  ${x.ok ? "✓" : "✗"} ${x.caso}`)
  console.log(`      ${x.detalle}`)
}
const mal = r.filter(x => !x.ok).length
console.log(`\n${r.length - mal} de ${r.length} pasaron`)
process.exit(mal ? 1 : 0)
