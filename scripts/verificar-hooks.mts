/**
 * 🪝 Control: ningún hook después de un `return` condicional, DENTRO del mismo componente.
 *
 * **Por qué existe** (A-BUG-1201, 2026-09-25): se agregó un `useMemo` **debajo** del `return`
 * temprano de un componente. React cuenta 8 hooks en una rama y 9 en la otra, y al cambiar de
 * cuenta la pantalla entera se cayó con *«rendered more hooks than during the previous render»*.
 *
 * 🧨 **`npm run type-check` y `npm run build` pasaron los dos.** No es un error de tipos ni de
 * compilación: sólo se ve ejecutando la pantalla, y la encontró el usuario.
 *
 * Heurística, no compilador: corta el archivo en componentes de nivel 0 y, dentro de cada uno,
 * mira si hay una llamada a hook (indentación 2) **después** de un `return` de esa misma
 * indentación. Avisa, no rompe.
 *
 *   npx tsx scripts/verificar-hooks.mts
 */
import { readFileSync, globSync } from "node:fs"

/**
 * Arranque de una función de nivel 0 — componente **o hook propio**.
 *
 * ⚠️ La primera versión sólo reconocía nombres con mayúscula y daba **10 falsos positivos**: los
 * hooks propios (`useRoles`, `useMultiCashFlowData`) no cortaban el bloque, así que sus hooks se
 * leían como «después del return» del componente anterior. Cualquier función de nivel 0 corta.
 */
const INICIO = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+\w+|const\s+\w+\s*[:=])/
const HOOK = /\buse[A-Z]\w*\s*\(/
const NIVEL_2 = /^ {2}\S/
const RETURN_2 = /^ {2}return[\s(;]/
const IF_RETURN_2 = /^ {2}if\s*\(.*\)\s*(?:\{\s*)?return\b/

const archivos = globSync("{components,app,hooks}/**/*.{tsx,ts}").sort()
let hallazgos = 0

for (const f of archivos) {
  const l = readFileSync(f, "utf8").split(/\r?\n/)
  // Dónde empieza cada componente de nivel 0
  const inicios: number[] = []
  l.forEach((x, i) => { if (INICIO.test(x)) inicios.push(i) })

  inicios.forEach((ini, k) => {
    const fin = inicios[k + 1] ?? l.length
    let ret = -1
    for (let i = ini + 1; i < fin; i++) {
      // `return` directo del cuerpo, o `if (…) return …` en una línea
      if (RETURN_2.test(l[i]) || IF_RETURN_2.test(l[i])) { ret = i; break }
      /**
       * ⚠️ **Y el caso que importa: el `if` de VARIAS líneas.**
       *
       * Así estaba escrito el que rompió la pantalla:
       *
       *     if (!esCajaDeAhorro) {
       *       return (…)
       *     }
       *
       * La primera versión de este control pedía el `return` en la misma línea del `if` y **no lo
       * vio** — se probó contra el archivo roto y dijo que estaba todo bien. Un control que no
       * falla con el código viejo aparenta cobertura, que es peor que no tenerla.
       */
      if (/^ {2}if\s*\(/.test(l[i])) {
        for (let j = i + 1; j < fin && !/^ {2}\}/.test(l[j]); j++) {
          if (/^ {4,}return[\s(;]/.test(l[j])) { ret = i; break }
        }
        if (ret >= 0) break
      }
    }
    if (ret < 0) return
    for (let i = ret + 1; i < fin; i++) {
      // sólo el cuerpo del componente, no lo que está anidado más adentro
      if (!NIVEL_2.test(l[i]) || !HOOK.test(l[i])) continue
      if (/^\s*(\*|\/\/)/.test(l[i])) continue
      console.log(`🪝 ${f}:${i + 1}  —  hook después del return de la línea ${ret + 1}`)
      console.log(`   ${l[i].trim().slice(0, 95)}`)
      hallazgos++
    }
  })
}

console.log(hallazgos === 0
  ? `✅ ${archivos.length} archivos · ningún hook después de un return`
  : `\n🔴 ${hallazgos} hook(s) después de un return — rompen la pantalla al cambiar de rama de render`)
