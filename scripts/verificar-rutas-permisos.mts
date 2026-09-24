/**
 * CONTROL DEL MAPEO RUTA → RECURSO — A-FEAT-169, etapa 4
 *
 * `lib/auth/rutas-recursos.ts` dice, para cada ruta que escribe, qué recurso la gobierna o por qué
 * no se pudo mapear. Como el mapeo es una declaración a mano, **envejece sola**: se agrega una
 * ruta que escribe y nadie la anota, y queda sin nivel de permiso sin que falle nada.
 *
 * Este control lee el mismo dato por el otro camino: busca en `app/api` qué rutas hacen
 * insert/update/upsert/delete y las compara con la lista.
 *
 *   npm run verificar:rutas
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { RUTAS_RECURSOS } from "../lib/auth/rutas-recursos"
import { RECURSOS } from "../lib/auth/recursos"

const RAIZ = "app/api"

function rutasQueEscriben(dir: string, prefijo = ""): string[] {
  const salida: string[] = []
  for (const e of readdirSync(dir)) {
    const ruta = join(dir, e)
    if (statSync(ruta).isDirectory()) {
      salida.push(...rutasQueEscriben(ruta, prefijo ? `${prefijo}/${e}` : e))
    } else if (e === "route.ts") {
      const src = readFileSync(ruta, "utf8")
      if (/\.(insert|update|upsert|delete)\(/.test(src)) salida.push(prefijo)
    }
  }
  return salida
}

const enCodigo = new Set(rutasQueEscriben(RAIZ))
const declaradas = new Set(RUTAS_RECURSOS.map((r) => r.ruta))
let problemas = 0

console.log("── Rutas que escriben vs. su recurso ──\n")

const sinDeclarar = [...enCodigo].filter((r) => !declaradas.has(r)).sort()
if (sinDeclarar.length) {
  console.log(`  🚨 ${sinDeclarar.length} ruta(s) que escriben y NO están en el mapeo:`)
  for (const r of sinDeclarar) console.log(`       ${r}`)
  console.log("       Agregalas en lib/auth/rutas-recursos.ts — con su recurso, o con el motivo")
  console.log("       de por qué no se puede mapear. Sin nivel de permiso no fallan: pasan.\n")
  problemas += sinDeclarar.length
}

const fantasmas = [...declaradas].filter((r) => !enCodigo.has(r)).sort()
if (fantasmas.length) {
  console.log(`  🚨 ${fantasmas.length} declarada(s) que ya no escriben (o no existen):`)
  for (const r of fantasmas) console.log(`       ${r}`)
  console.log("       Sacalas del mapeo: una línea que protege algo inexistente confunde.\n")
  problemas += fantasmas.length
}

// Que el recurso al que apunta una ruta exista de verdad.
const ids = new Set(RECURSOS.map((r) => r.id))
for (const m of RUTAS_RECURSOS) {
  if ("recurso" in m && !ids.has(m.recurso)) {
    console.log(`  🚨 ${m.ruta} apunta a «${m.recurso}», que no está en el registro de recursos.`)
    problemas++
  }
}

const mapeadas = RUTAS_RECURSOS.filter((r) => "recurso" in r).length
const sinMapear = RUTAS_RECURSOS.length - mapeadas
console.log(`  ${mapeadas} mapeada(s) con nivel de permiso · ${sinMapear} declarada(s) sin mapear, con su motivo`)
console.log(
  problemas === 0
    ? "\n✅ Control OK — toda ruta que escribe está declarada.\n   ⚠️ Recordá: esto sólo cubre app/api. Las 452 escrituras directas desde el navegador\n      las frena únicamente la RLS por recurso (etapa 5)."
    : `\n🔴 ${problemas} problema(s).`
)
process.exit(problemas === 0 ? 0 : 1)
