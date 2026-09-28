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
 * ## El rodeo del alias — reescrito 2026-09-28 (A-OP-21)
 * `casos.ts` importa con `@/lib/...`, que resuelve Next pero no Node.
 *
 * Antes se arreglaba **reescribiendo el texto** de `casos.ts` en una copia temporal. Eso resolvía
 * **un solo nivel**: el día que un módulo de `lib/` importó a otro con `@/`, la suite **entera**
 * murió con `ERR_MODULE_NOT_FOUND` — no un caso en rojo, los 274 apagados de golpe por un import
 * perfectamente normal.
 *
 * Ahora se registra un **hook del cargador** (`probar-loader.mjs`) que resuelve el alias a
 * cualquier profundidad. El código de la app no se ensucia, que era el temor original.
 */
import fs from "node:fs"
import path from "node:path"
import { register } from "node:module"
import { pathToFileURL } from "node:url"

const raiz = process.cwd()
const origen = path.join(raiz, "lib", "pruebas", "casos.ts")

if (!fs.existsSync(origen)) {
  console.error(`No existe ${origen}`)
  process.exit(1)
}

// El hook resuelve `@/...` a cualquier profundidad, así que se importa el archivo REAL: no hay
// copia temporal ni reescritura de texto, y lo que corre es exactamente lo que está en el repo.
register("./probar-loader.mjs", import.meta.url)

const { correrCasos } = await import(pathToFileURL(origen).href)
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

// Sale con error para que sirva de compuerta: si algo falla, se ve sin leer la salida entera.
process.exit(mal.length ? 1 : 0)
