#!/usr/bin/env node
/**
 * type-check:diff — compara los errores de tipos contra un baseline POR ARCHIVO.
 *
 * ## Por qué existe (2026-08-10)
 *
 * El baseline se venía usando comparando **el total**: 117 antes, 117 después → "no rompí nada".
 * Adentro de esos 117 estaban las causas de dos bugs de una misma sesión:
 *
 *   A-BUG-19  4 errores en vista-cash-flow.tsx  → pagos de sueldos que nunca se guardaban
 *   A-BUG-22  (silenciado con `as any`)         → SICORE propuesto a facturas C
 *
 * El problema no era falta de atención: **117 es un muro que nadie lee**. Pero
 * `vista-cash-flow.tsx` tenía 13, y trece líneas se leen en diez segundos.
 *
 * Por eso la unidad es el archivo, no el proyecto: hace que la frase "no rompí nada" sea
 * **verificable por el usuario en un comando**, en vez de una afirmación de Claude.
 *
 * ## Uso
 *   npm run type-check:diff       compara contra el baseline · sale con 1 si algún archivo empeoró
 *   npm run type-check:baseline   acepta el estado actual como nuevo baseline
 *
 * El baseline vive en `scripts/type-errors-baseline.json` y **va commiteado**: así el chequeo
 * corre igual en cualquier máquina y la diferencia se ve en el diff del commit.
 */

import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const BASELINE = path.join(AQUI, "type-errors-baseline.json")
const aceptar = process.argv.includes("--accept")

/** Corre tsc y devuelve un mapa `archivo → cantidad de errores`. */
function contarErrores() {
  let salida = ""
  try {
    // tsc sale con código ≠ 0 cuando hay errores: eso es lo normal acá, no una falla del script.
    salida = execSync("npx tsc --noEmit -p tsconfig.json", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  } catch (e) {
    salida = (e.stdout ?? "") + (e.stderr ?? "")
  }

  const porArchivo = {}
  for (const linea of salida.split(/\r?\n/)) {
    // Formato: ruta/archivo.tsx(120,5): error TS2322: ...
    const m = linea.match(/^(.+?)\((\d+),(\d+)\): error TS\d+/)
    if (!m) continue
    const archivo = m[1].replace(/\\/g, "/")
    porArchivo[archivo] = (porArchivo[archivo] ?? 0) + 1
  }
  return porArchivo
}

const actual = contarErrores()
const totalActual = Object.values(actual).reduce((a, b) => a + b, 0)

if (aceptar) {
  const contenido = {
    _comentario:
      "Errores de tipos por archivo. Generado por `npm run type-check:baseline`. " +
      "No editar a mano: se regenera. El motivo de que sea POR ARCHIVO está en scripts/type-check-diff.mjs",
    generado: new Date().toISOString().slice(0, 10),
    total: totalActual,
    archivos: Object.fromEntries(Object.entries(actual).sort((a, b) => b[1] - a[1])),
  }
  fs.writeFileSync(BASELINE, JSON.stringify(contenido, null, 2) + "\n", "utf8")
  console.log(`✅ Baseline actualizado: ${totalActual} errores en ${Object.keys(actual).length} archivo(s)`)
  console.log(`   ${path.relative(process.cwd(), BASELINE)}`)
  process.exit(0)
}

if (!fs.existsSync(BASELINE)) {
  console.error("No hay baseline todavía. Generalo con:  npm run type-check:baseline")
  process.exit(1)
}

const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"))
const previo = base.archivos ?? {}
const totalPrevio = Object.values(previo).reduce((a, b) => a + b, 0)

const archivos = [...new Set([...Object.keys(previo), ...Object.keys(actual)])].sort()
const peor = []
const mejor = []

for (const f of archivos) {
  const antes = previo[f] ?? 0
  const ahora = actual[f] ?? 0
  if (ahora > antes) peor.push({ f, antes, ahora })
  else if (ahora < antes) mejor.push({ f, antes, ahora })
}

const corto = (f) => f.replace(/^(components|hooks|lib|app|scripts|config)\//, "$1/")

console.log(`\ntype-check:diff — baseline del ${base.generado ?? "?"}`)
console.log(`total ${totalPrevio} → ${totalActual}\n`)

if (mejor.length > 0) {
  console.log("✓ Mejoraron:")
  for (const m of mejor) console.log(`   ${corto(m.f).padEnd(48)} ${m.antes} → ${m.ahora}  (${m.ahora - m.antes})`)
  console.log("")
}

if (peor.length === 0) {
  console.log("✅ Ningún archivo empeoró.")
  if (mejor.length > 0) {
    console.log("   Si los arreglos son intencionales, fijá el nuevo piso con:  npm run type-check:baseline")
  }
  process.exit(0)
}

console.log("❌ EMPEORARON — probablemente los causó el cambio en curso:")
for (const p of peor) console.log(`   ${corto(p.f).padEnd(48)} ${p.antes} → ${p.ahora}  (+${p.ahora - p.antes})`)
console.log("\nPara ver cuáles son:")
for (const p of peor.slice(0, 3)) console.log(`   npx tsc --noEmit -p tsconfig.json | grep "${path.basename(p.f)}"`)
console.log("")
process.exit(1)
