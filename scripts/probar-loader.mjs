/**
 * Resolvedor del alias `@/` para `npm run probar` — A-OP-21.
 *
 * ## Por qué existe
 * `@/lib/...` lo resuelve Next, no Node. Hasta el 2026-09-28 el runner lo arreglaba **reescribiendo
 * el texto de `casos.ts`** en una copia temporal. Eso funcionaba mientras los casos sólo importaran
 * módulos que **no usaran el alias entre sí** — y dejó de funcionar en cuanto un módulo de `lib/`
 * importó a otro con `@/`: el reemplazo era de **un solo nivel**.
 *
 * 🧨 **Y el modo de falla era el peor posible**: la suite **entera** dejaba de correr con un
 * `ERR_MODULE_NOT_FOUND`, no un caso en rojo. O sea que un import perfectamente normal en la app
 * apagaba los 274 casos de golpe. La salida obvia —poner rutas relativas con `.ts` en el código de
 * la app— es justo lo que el runner viejo decía que no quería: *«ensuciar el código de la app sólo
 * para que corra el runner»*. Tenía razón; el arreglo va acá.
 *
 * ## Qué hace
 * Resuelve `@/loquesea` contra la raíz del proyecto y le agrega `.ts` si hace falta. Funciona a
 * **cualquier profundidad**, porque es un hook del cargador y no un reemplazo de texto.
 */
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const raiz = process.cwd()

/** `@/lib/x` → `<raiz>/lib/x.ts` (o `/index.ts`, o tal cual si ya trae extensión). */
function resolverAlias(rel) {
  const base = path.join(raiz, rel)
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return pathToFileURL(cand).href
  }
  // Si no existe, se devuelve igual: que falle con el nombre real y no con uno inventado.
  return pathToFileURL(`${base}.ts`).href
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    return { url: resolverAlias(specifier.slice(2)), shortCircuit: true }
  }
  // Import relativo SIN extensión entre archivos TypeScript: Node lo exige, TS no lo permite
  // escribir. Se completa acá, por el mismo motivo que el alias.
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier)) {
    const desde = context.parentURL?.startsWith("file:") ? new URL(context.parentURL) : null
    if (desde) {
      const abs = path.resolve(path.dirname(desde.pathname.replace(/^\/([A-Za-z]:)/, "$1")), specifier)
      for (const cand of [`${abs}.ts`, `${abs}.tsx`, path.join(abs, "index.ts")]) {
        if (fs.existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true }
      }
    }
  }
  return next(specifier, context)
}
