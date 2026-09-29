/**
 * 📒 Lector de los PAPELES DE TRABAJO del balance — A-FEAT-09.
 *
 * Lee los Excel que el usuario dejó en `- Comunicacion JMS Claude - Archivos/Balance/` y produce
 * un **digesto**: hojas, tamaño, primeras filas y —lo que más importa— **las FÓRMULAS**.
 *
 * 🔑 **Por qué las fórmulas y no sólo los valores.** El valor dice *cuánto*; la fórmula dice
 * *de dónde sale*. `=SUMA(Hoja2!D:D)-E15` es la definición del concepto contable, y es justo lo
 * que hay que trasladar a la app. Sin eso, el estudio sería copiar números sin entenderlos.
 *
 * 📌 **Las fórmulas se agrupan por PATRÓN**, no una por una: se reemplazan los números de fila por
 * `#`, así `=D5*E5`, `=D6*E6`… colapsan en `=D#*E#` con su cantidad. Un papel de 4.000 celdas se
 * lee en 20 patrones.
 *
 * ⚠️ **Sólo lee.** No escribe nada, ni en la BD ni en los archivos.
 *
 *     npx tsx scripts/leer-papeles-balance.mts            → el digesto de todos
 *     npx tsx scripts/leer-papeles-balance.mts "BANCOS"   → sólo los que matcheen
 */
import * as XLSX from "xlsx"
import { readdirSync, statSync, readFileSync } from "node:fs"
import { join } from "node:path"

// ⚠️ El build ESM de `xlsx` no trae `readFile` (depende de `fs`): se lee el buffer a mano y se
// usa `XLSX.read`. Es el mismo resultado y no ata el script a cómo esté empaquetada la librería.

const RAIZ = "- Comunicacion JMS Claude - Archivos/Balance"
const filtro = (process.argv[2] ?? "").toLowerCase()

/** Todos los archivos de Excel bajo la carpeta, con su subcarpeta. */
function archivos(dir: string, base = ""): { ruta: string; carpeta: string; nombre: string }[] {
  const out: { ruta: string; carpeta: string; nombre: string }[] = []
  for (const e of readdirSync(dir)) {
    const ruta = join(dir, e)
    if (statSync(ruta).isDirectory()) { out.push(...archivos(ruta, e)); continue }
    if (!/\.(xlsx|xls|xlsm)$/i.test(e)) continue
    if (e.startsWith("~$")) continue          // temporales de Excel abierto
    out.push({ ruta, carpeta: base, nombre: e })
  }
  return out
}

/** `=D5*E5` → `=D#*E#`, para poder agrupar. */
const patron = (f: string) => f.replace(/(\$?[A-Z]{1,3}\$?)\d+/g, "$1#")

const celdaTexto = (c: XLSX.CellObject | undefined) => {
  if (!c) return ""
  if (c.t === "n" && typeof c.v === "number") {
    return Number.isInteger(c.v) ? String(c.v) : c.v.toFixed(2)
  }
  return String(c.w ?? c.v ?? "").trim()
}

for (const { ruta, carpeta, nombre } of archivos(RAIZ)) {
  if (filtro && !nombre.toLowerCase().includes(filtro)) continue

  console.log("\n" + "═".repeat(100))
  console.log(`📄 ${carpeta ? carpeta + " / " : ""}${nombre}`)
  console.log("═".repeat(100))

  let wb: XLSX.WorkBook
  try {
    // `cellFormula` es la clave: sin esto sólo vienen los valores.
    // `cellComments` se agregó el 2026-09-29: sin esto, **16 notas del usuario estuvieron ahí
    // todo el tiempo y nunca se leyeron** — justo las que explican lo «artesanal» que él avisó
    // que iba a haber. Un lector que no pide un dato es indistinguible de un dato que no está.
    wb = XLSX.read(readFileSync(ruta), { cellFormula: true, cellDates: true, cellNF: true, cellComments: true })
  } catch (e) {
    console.log(`   ⚠️ no se pudo abrir: ${(e as Error).message}`)
    continue
  }

  for (const hoja of wb.SheetNames) {
    const ws = wb.Sheets[hoja]
    if (!ws || !ws["!ref"]) { console.log(`\n── ${hoja}: (vacía)`); continue }
    const rango = XLSX.utils.decode_range(ws["!ref"])
    const filas = rango.e.r + 1, cols = rango.e.c + 1

    const formulas = new Map<string, number>()
    const externos = new Set<string>()
    let conDato = 0
    for (let r = rango.s.r; r <= rango.e.r; r++) {
      for (let c = rango.s.c; c <= rango.e.c; c++) {
        const cel = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined
        if (!cel) continue
        conDato++
        if (!cel.f) continue
        const f = "=" + cel.f
        formulas.set(patron(f), (formulas.get(patron(f)) ?? 0) + 1)
        // Vínculos a OTROS archivos: son el punto ciego, hay que declararlos
        const ext = f.match(/\[[^\]]+\]/g)
        ext?.forEach(x => externos.add(x))
      }
    }

    console.log(`\n── ${hoja}  ·  ${filas} filas × ${cols} col  ·  ${conDato} celdas con dato  ·  ${formulas.size} patrón(es) de fórmula`)

    // Las primeras filas: ahí están los títulos y se entiende la estructura
    const hasta = Math.min(rango.e.r, rango.s.r + 14)
    for (let r = rango.s.r; r <= hasta; r++) {
      const celdas: string[] = []
      for (let c = rango.s.c; c <= Math.min(rango.e.c, rango.s.c + 11); c++) {
        const t = celdaTexto(ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject)
        if (t) celdas.push(`${XLSX.utils.encode_col(c)}${r + 1}=${t.slice(0, 34)}`)
      }
      if (celdas.length) console.log(`   ${celdas.join(" | ")}`)
    }

    if (formulas.size > 0) {
      console.log(`   ── fórmulas (patrón × veces) ──`)
      for (const [f, n] of [...formulas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
        console.log(`   ${String(n).padStart(4)}×  ${f.slice(0, 140)}`)
      }
      if (formulas.size > 25) console.log(`   … y ${formulas.size - 25} patrón(es) más`)
    }
    if (externos.size > 0) {
      console.log(`   ⚠️ VÍNCULOS A OTROS ARCHIVOS: ${[...externos].join(" ")}`)
    }
  }
}
