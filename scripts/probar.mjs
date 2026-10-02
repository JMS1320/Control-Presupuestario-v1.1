/**
 * `npm run probar` — corre los casos de `lib/pruebas/casos.ts` desde la consola.
 *
 * ## Para qué existe
 * Para que **Claude los corra antes de decir «terminé, probá»**. Hasta el 2026-09-06 lo único que
 * se corría era `type-check` y `build`, que sólo prueban que **compila**: los cuatro bugs de ese día
 * pasaron los dos y los encontró el usuario mirando la base. Ver `CLAUDE.md` § 🧪.
 *
 * Es el **mismo archivo** que usa el botón 🧪 Probar de la app: una sola fuente de casos, dos formas
 * de dispararla. Si divergieran, uno de los dos empezaría a mentir.
 *
 * ## El rodeo del alias
 * `casos.ts` importa con `@/lib/...`, que resuelve Next pero no Node. Se reescribe a una ruta de
 * archivo en una copia temporal y se importa eso. Es feo y está contenido acá: la alternativa era
 * ensuciar el código de la app con rutas relativas y extensiones sólo para que corra el runner.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { register } from "node:module"

const raiz = process.cwd()

/**
 * 🔗 Y para lo que importan las librerías ENTRE SÍ (2026-10-02): el rodeo de abajo reescribe sólo
 * los imports de `casos.ts`. Cuando una librería importa a otra (`lib/ventas/hacienda.ts` →
 * `lib/ganaderia/confirmar-venta.ts`, que comparte la cuenta del neto), Node no resolvía ni el
 * `@/` ni la ruta sin extensión, y el runner se caía antes de correr un solo caso. Este gancho de
 * resolución lo arregla para todos los niveles: `@/x` → `<raíz>/x`, y sin extensión → `.ts`.
 */
const gancho = `
import { pathToFileURL } from "node:url"
const raiz = ${JSON.stringify(pathToFileURL(raiz + "/").href)}
export async function resolve(spec, ctx, next) {
  const s = spec.startsWith("@/") ? new URL(spec.slice(2), raiz).href : spec
  try { return await next(s, ctx) } catch (e) {
    if (e?.code !== "ERR_MODULE_NOT_FOUND" || !(s.startsWith(".") || s.startsWith("file:"))) throw e
    return next(s + ".ts", ctx)
  }
}`
register("data:text/javascript," + encodeURIComponent(gancho))
const origen = path.join(raiz, "lib", "pruebas", "casos.ts")

if (!fs.existsSync(origen)) {
  console.error(`No existe ${origen}`)
  process.exit(1)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "probar-"))
const destino = path.join(tmp, "casos.ts")
fs.writeFileSync(
  destino,
  fs.readFileSync(origen, "utf8").replace(
    /from ["']@\/(.*?)["']/g,
    (_, rel) => `from "${pathToFileURL(path.join(raiz, rel + ".ts")).href}"`,
  ),
)

const { correrCasos } = await import(pathToFileURL(destino).href)
const r = correrCasos()
const mal = r.filter(x => !x.ok)

let grupo = ""
for (const x of r) {
  if (x.grupo !== grupo) { grupo = x.grupo; console.log(`\n── ${grupo} ──`) }
  console.log(`  ${x.ok ? "✓" : "✗"} ${x.caso}`)
  console.log(`      ${x.obtenido}`)
  if (!x.ok) console.log(`      esperado: ${x.esperado}`)
}

console.log(`\n${r.length - mal.length} de ${r.length} pasaron`)
fs.rmSync(tmp, { recursive: true, force: true })

// Sale con error para que sirva de compuerta: si algo falla, se ve sin leer la salida entera.
process.exit(mal.length ? 1 : 0)
