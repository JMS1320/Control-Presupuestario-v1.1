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
  sueldos:    "components/tab-sueldos.tsx",   // A-BUG-1401: desde el 28/10 tiene botones con casilla
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

/**
 * Las cuentas del Extracto, leídas del código (A-FEAT-1336). Se lee el TEXTO del archivo y no se lo
 * importa: el hook arrastra el cliente de Supabase y React, que este control no necesita.
 */
const CUENTAS_EN_CODIGO = (() => {
  const src = readFileSync("hooks/useMotorConciliacion.ts", "utf8")
  const desde = src.indexOf("export const CUENTAS_BANCARIAS")
  const hasta = src.indexOf("\n]", desde)
  const ids = [...src.slice(desde, hasta).matchAll(/\bid:\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  // A-FEAT-1398: las 7 de dólares y Cotitulares viven en lib/dolares/cuentas.ts y CUENTAS_BANCARIAS las suma
  const dol = readFileSync("lib/dolares/cuentas.ts", "utf8")
  const d0 = dol.indexOf("export const CUENTAS_DOLARES_Y_COTITULARES")
  ids.push(...[...dol.slice(d0, dol.indexOf("\n]", d0)).matchAll(/\bid:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))
  return new Set(ids)
})()
const cuentasSinRegistrar = [...CUENTAS_EN_CODIGO].filter((id) => !RECURSOS.some((r) => r.id === `extracto.cuenta.${id}`))
if (cuentasSinRegistrar.length) {
  console.log(`  🚨 Extracto: ${cuentasSinRegistrar.length} cuenta(s) en CUENTAS_BANCARIAS SIN registrar → ${cuentasSinRegistrar.join(", ")}`)
  console.log(`       Un rol cerrado no las podría ver nunca. Agregalas en lib/auth/recursos.ts`)
  problemas++
}

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
  // Cada recurso se busca en SU archivo (A-FEAT-1322): las solapas de Facturas viven en
  // vista-facturas-arca.tsx, no en vista-egresos.tsx. Una `accion` (botón) se busca como
  // `puedeVer("<id>")`: así se verifica además que la pantalla pregunte por el permiso.
  const existe = (r: (typeof declarados)[number]) => {
    const sub = r.id.split(".").slice(1).join(".")
    // Una `cuenta` (A-FEAT-1336) existe si está en CUENTAS_BANCARIAS y la vista pregunta por cuentas.
    if (r.tipo === "cuenta") {
      return CUENTAS_EN_CODIGO.has(r.id.slice("extracto.cuenta.".length))
        && readFileSync(r.archivo, "utf8").includes("extracto.cuenta.")
    }
    // Una `funcionalidad` (solapa dentro de una ventana) además tiene que PREGUNTAR su permiso: hasta
    // A-BUG-1335 las 10 existían como solapas y ninguna pantalla las consultaba — destildarlas no sacaba nada.
    const pregunta = (src: string) => src.includes(`puedeVer('${r.id}')`) || src.includes(`puedeVer("${r.id}")`) || src.includes(`recurso="${r.id}"`) || src.includes(`seMuestra('${r.id}')`) || src.includes(`seMuestra("${r.id}")`)
    if (r.tipo === "funcionalidad") return pestanasEnCodigo(r.archivo).includes(sub) && pregunta(readFileSync(r.archivo, "utf8"))
    if (r.archivo === archivo && r.tipo !== "accion") return enCodigo.has(sub)
    const src = readFileSync(r.archivo, "utf8")
    // Desde A-FEAT-1334 también vale `<Permisable recurso="<id>">`, que pregunta lo mismo y además
    // pone el candado del modo permisos.
    if (r.tipo === "accion") return src.includes(`puedeVer('${r.id}')`) || src.includes(`puedeVer("${r.id}")`) || src.includes(`recurso="${r.id}"`) || src.includes(`seMuestra('${r.id}')`) || src.includes(`seMuestra("${r.id}")`)
    return pestanasEnCodigo(r.archivo).includes(sub)
  }
  const fantasmas = declarados.filter((r) => !existe(r)).map((r) => r.id.split(".").slice(1).join("."))

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
