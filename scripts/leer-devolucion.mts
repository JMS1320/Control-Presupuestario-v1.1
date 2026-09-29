/**
 * 📩 Lee un Excel que el usuario DEVUELVE con sus comentarios — A-FEAT-1184.
 *
 * ## Por qué existe
 * El circuito que acordamos el 2026-09-29: la app genera el papel, él lo baja, **escribe notas en
 * las celdas** y lo devuelve. Esto lee esas notas.
 *
 * 🧨 **Y nació de un descuido mío**: `leer-papeles-balance.mts` no pedía `cellComments`, así que
 * **16 notas suyas en los papeles originales estuvieron ahí todo el tiempo y nunca las leí** — las
 * que explican justamente lo «artesanal» que él avisó que iba a haber (*«en senasa 29»*, *«pongo
 * neto gravado de la DDJJ IVA»*, *«en cuota 2 descontaré el equivalente a 3/5»*).
 *
 * 📌 **Lee NOTAS** (las del triangulito rojo), que es lo que él usa. Los *comentarios en hilo* de
 * Excel nuevo se guardan aparte (`xl/threadedComments/`) y **no** salen por acá: si algún día una
 * nota no aparece, es por eso y hay que decirlo, no suponer que no había nada.
 *
 * ⚠️ **Sólo lee.**
 *
 *     npx tsx scripts/leer-devolucion.mts "<parte del nombre>"      → notas + hojas
 *     npx tsx scripts/leer-devolucion.mts "<parte>" --todo          → además vuelca cada hoja
 */
import * as XLSX from "xlsx"
import { readdirSync, statSync, readFileSync } from "node:fs"
import { join } from "node:path"

const RAIZ = "- Comunicacion JMS Claude - Archivos"
const filtro = (process.argv[2] ?? "").toLowerCase()
const todo = process.argv.includes("--todo")

function archivos(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const ruta = join(dir, e)
    if (statSync(ruta).isDirectory()) { out.push(...archivos(ruta)); continue }
    if (/\.xlsx?$/i.test(e) && !e.startsWith("~$")) out.push(ruta)
  }
  return out
}

const texto = (c: XLSX.CellObject | undefined) => {
  if (!c) return ""
  if (c.t === "n" && typeof c.v === "number") {
    return Number.isInteger(c.v) ? String(c.v) : c.v.toFixed(2)
  }
  return String(c.w ?? c.v ?? "").trim()
}

for (const ruta of archivos(RAIZ)) {
  if (filtro && !ruta.toLowerCase().includes(filtro)) continue

  const wb = XLSX.read(readFileSync(ruta), { cellComments: true, cellDates: true, cellNF: true })
  console.log("\n" + "═".repeat(100))
  console.log(`📩 ${ruta}`)
  console.log(`   hojas: ${wb.SheetNames.join(" · ")}`)
  console.log("═".repeat(100))

  let total = 0
  for (const hoja of wb.SheetNames) {
    const h = wb.Sheets[hoja]
    if (!h || !h["!ref"]) continue

    // Las NOTAS primero: es lo que vino a buscar.
    const notas: string[] = []
    for (const dir of Object.keys(h)) {
      if (dir.startsWith("!")) continue
      const c = (h[dir] as XLSX.CellObject).c
      if (!Array.isArray(c) || c.length === 0) continue
      total += c.length
      // Se muestra el VALOR de la celda junto a la nota: una nota sin su número no dice nada.
      const valor = texto(h[dir] as XLSX.CellObject)
      for (const n of c) {
        const autor = (n.a ?? "").replace(/:$/, "")
        const txt = String(n.t ?? "").replace(/^[^:]*:\s*/, "").replace(/\s+/g, " ").trim()
        notas.push(`   💬 ${dir}${valor ? ` [${valor}]` : ""} — ${txt}${autor ? `  (${autor})` : ""}`)
      }
    }
    if (notas.length > 0) {
      console.log(`\n── ${hoja} · ${notas.length} nota(s)`)
      notas.forEach(n => console.log(n))
    }

    if (todo) {
      const r = XLSX.utils.decode_range(h["!ref"])
      console.log(`\n── ${hoja} (contenido)`)
      for (let fila = r.s.r; fila <= r.e.r; fila++) {
        const partes: string[] = []
        for (let col = r.s.c; col <= r.e.c; col++) {
          const t = texto(h[XLSX.utils.encode_cell({ r: fila, c: col })] as XLSX.CellObject)
          if (t) partes.push(`${XLSX.utils.encode_col(col)}=${t.slice(0, 400)}`)
        }
        if (partes.length) console.log(`${String(fila + 1).padStart(4)} | ${partes.join(" | ")}`)
      }
    }
  }
  console.log(`\n   TOTAL de notas en el archivo: ${total}`)
}
