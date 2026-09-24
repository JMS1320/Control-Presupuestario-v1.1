/**
 * CONTROL DEL REGISTRO DE RECURSOS — A-FEAT-169
 *
 * `lib/auth/recursos.ts` declara qué se puede permisar dentro de cada sección. Pero las pestañas
 * viven sueltas en cada `vista-*.tsx`, así que la declaración **puede envejecer sin que nadie lo
 * note**: se agrega una pestaña nueva, nadie la registra, y queda sin permiso asignable. No falla
 * nada — simplemente esa parte de la app no se puede permisar, y eso se descubre tarde.
 *
 * Este control lee el MISMO dato por el otro camino: extrae los `TabsTrigger` del código y los
 * compara con el registro (§ 🧮 de CLAUDE.md — el mismo número por dos vías).
 *
 *   npm run verificar:recursos
 */
import { readFileSync } from "node:fs"
import { RECURSOS, SECCIONES, SIN_RECURSOS } from "../lib/auth/recursos"

/** Dónde vive la vista de cada sección. Lo que no está acá, no se controla (y se avisa). */
const VISTAS: Record<string, string> = {
  egresos:    "components/vista-egresos.tsx",
  extracto:   "components/vista-extracto-bancario.tsx",
  productivo: "components/vista-sector-productivo.tsx",
  cashflow:   "components/vista-cash-flow.tsx",
  ingresos:   "components/vista-ingresos.tsx",
}

/**
 * Los `value=` de los TabsTrigger.
 *
 * ⚠️ Sólo los **literales** (`value="hacienda"`). Los dinámicos (`value={e}`, `value={v.id}`) se
 * saltean a propósito: son pestañas que se generan en tiempo de ejecución —una por empresa, una
 * por vista— y su nombre no existe en el código. Un primer intento de este control las tomaba por
 * literales y reportaba una pestaña llamada «e» en Ingresos.
 */
function pestanasEnCodigo(archivo: string): string[] {
  const src = readFileSync(archivo, "utf8")
  const encontrados = [...src.matchAll(/<TabsTrigger[^>]*value="([^"]+)"/g)].map((m) => m[1])
  return [...new Set(encontrados)]
}

let problemas = 0

console.log("── Registro de recursos permisables ──\n")

for (const { id: seccion, etiqueta } of SECCIONES) {
  const declarados = RECURSOS.filter((r) => r.seccion === seccion)
  const archivo = VISTAS[seccion]

  if (!archivo) {
    const motivo = SIN_RECURSOS[seccion]
    if (declarados.length === 0 && motivo) {
      console.log(`  ○ ${etiqueta}: sin recursos — ${motivo.slice(0, 70)}…`)
    } else if (declarados.length > 0) {
      console.log(`  ⚠️  ${etiqueta}: declara ${declarados.length} recursos pero no sé qué archivo mirar.`)
      problemas++
    }
    continue
  }

  const enCodigo = new Set(pestanasEnCodigo(archivo))
  const enRegistro = new Set(declarados.map((r) => r.id.split(".").slice(1).join(".")))

  const sinRegistrar = [...enCodigo].filter((v) => !enRegistro.has(v))
  const fantasmas = [...enRegistro].filter((v) => !enCodigo.has(v))

  if (sinRegistrar.length === 0 && fantasmas.length === 0) {
    console.log(`  ✅ ${etiqueta}: ${enRegistro.size} recursos, todos existen en el código.`)
    continue
  }
  if (sinRegistrar.length) {
    console.log(`  🚨 ${etiqueta}: ${sinRegistrar.length} en el código SIN registrar → ${sinRegistrar.join(", ")}`)
    console.log(`       Quedan sin permiso asignable. Agregalas en lib/auth/recursos.ts`)
    problemas++
  }
  if (fantasmas.length) {
    console.log(`  🚨 ${etiqueta}: ${fantasmas.length} registradas que YA NO EXISTEN → ${fantasmas.join(", ")}`)
    console.log(`       Se pueden permisar pero no llevan a ningún lado. Sacalas del registro.`)
    problemas++
  }
}

// Las secciones sin archivo declarado tienen que tener su motivo escrito.
const sinMotivo = SECCIONES.filter(
  (s) => !VISTAS[s.id] && !SIN_RECURSOS[s.id] && RECURSOS.every((r) => r.seccion !== s.id)
)
if (sinMotivo.length) {
  console.log(`\n  🚨 Sin recursos y SIN motivo escrito: ${sinMotivo.map((s) => s.id).join(", ")}`)
  console.log("     Un hueco sin explicación no se distingue de un olvido (CLAUDE.md § Motivos).")
  problemas += sinMotivo.length
}

console.log(
  problemas === 0
    ? `\n✅ Control OK — ${RECURSOS.length} recursos declarados y ninguno desincronizado.`
    : `\n🔴 ${problemas} problema(s). El registro y el código no dicen lo mismo.`
)
process.exit(problemas === 0 ? 0 : 1)
