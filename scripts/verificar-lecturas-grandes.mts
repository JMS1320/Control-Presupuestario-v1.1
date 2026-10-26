/**
 * ✂️ VIGÍA DEL CORTE DE 1.000 FILAS (A-BUG-1379, 2026-10-26). Sólo lee el código; no toca la base.
 *
 * La base (PostgREST) entrega como máximo 1.000 filas por pedido, SIN AVISAR, y `.range(0, 9999)` /
 * `.limit(5000)` NO lo evitan (medido: 1.000 de 1.892). Este script lista:
 *   1. lecturas de las tablas grandes o que crecen que NO están dentro de `traerTodo` / `traerHasta` /
 *      un bucle de `.range(desde…)`;
 *   2. `.range(0, N)` o `.limit(N)` con N > 1.000 (dan menos de lo que parecen).
 * Avisa y no frena: hay lecturas legítimas (de a una fila, con filtro que asegura pocas). Revisar cada una.
 *
 * Uso:  npx tsx scripts/verificar-lecturas-grandes.mts
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const TABLAS = ["cuotas_egresos_sin_factura", "msa_galicia", "cotizaciones", "pesadas_terneros", "comprobantes_arca"]
const CARPETAS = ["app", "components", "hooks", "lib"]
const SEGURO = /\.in\(\s*['"]id['"]|traerTodo|traerHasta|juntarTandas|\.range\(\s*desde|\.range\(\s*d\s*,|\.maybeSingle\(|\.single\(|\.eq\(\s*['"]id['"]|\.limit\(\s*1\s*\)|head:\s*true/

function archivos(dir: string): string[] {
  const out: string[] = []
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n.startsWith(".")) continue
    const p = join(dir, n)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...archivos(p))
    else if (/\.(ts|tsx|mts)$/.test(n) && !p.includes("pruebas")) out.push(p)
  }
  return out
}

const hallazgos: string[] = []
for (const dir of CARPETAS) {
  for (const f of archivos(dir)) {
    const lineas = readFileSync(f, "utf8").split(/\r?\n/)
    lineas.forEach((l, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) return   // comentarios
      // 2 · límites engañosos
      const m = l.match(/\.(range)\(\s*0\s*,\s*(\d+)\s*\)|\.limit\(\s*(\d+)\s*\)/)
      if (m) {
        const n = Number(m[2] ?? m[3])
        if (n > 1000) hallazgos.push(`${f}:${i + 1}  límite ${n} > 1.000 (la base igual corta en 1.000)  ·  ${l.trim().slice(0, 110)}`)
      }
      // 1 · lecturas de tablas grandes fuera de tandas
      for (const t of TABLAS) {
        if (!new RegExp(`\\.from\\(\\s*['"\`]${t}['"\`]`).test(l)) continue
        const ventana = lineas.slice(Math.max(0, i - 3), i + 12).join("\n")
        if (!/\.select\(/.test(ventana)) continue                       // escritura, no lectura
        if (/\.(update|insert|upsert|delete)\(/.test(lineas.slice(i, i + 4).join("\n"))) continue
        if (SEGURO.test(ventana)) continue
        hallazgos.push(`${f}:${i + 1}  lectura de ${t} sin tandas  ·  ${l.trim().slice(0, 110)}`)
      }
    })
  }
}

console.log(`✂️ Lecturas que podrían cortarse en 1.000 filas: ${hallazgos.length}`)
for (const h of hallazgos) console.log("  ⚠️ " + h)
console.log("\nRevisar cada una: si la tabla (con su filtro) puede pasar de 1.000, usar traerTodo / traerHasta de lib/supabase-paginado.ts.")
