import * as XLSX from "xlsx"
import { normalizarCaravana, categoriaDeTernero, CATEGORIAS_TERNERO } from "../lib/productivo/caravanas"

let fallos = 0
const chk = (t: string, real: unknown, esp: unknown) => {
  const ok = real === esp
  if (!ok) fallos++
  console.log(`${ok ? "OK  " : "FALLA"} ${t}: ${JSON.stringify(real)} (esperado ${JSON.stringify(esp)})`)
}

// ── Normalización: saca el espacio, conserva el cero
chk("saca el espacio", normalizarCaravana("032 010012326481"), "032010012326481")
chk("conserva el cero inicial", normalizarCaravana("032 010012326481").startsWith("0"), true)
chk("sin espacio queda igual", normalizarCaravana("032010012326481"), "032010012326481")
chk("caravana corta sin prefijo", normalizarCaravana("724"), "724")
chk("espacios de más", normalizarCaravana("  032   0100123  "), "0320100123")
chk("null", normalizarCaravana(null), "")

// ── Categoría: es_torito significa cosas distintas según el sexo
chk("macho sin marcar", categoriaDeTernero("Macho", false), "Ternero Recria")
chk("macho marcado", categoriaDeTernero("Macho", true), "Torito")
chk("hembra sin marcar", categoriaDeTernero("Hembra", false), "Ternera Recria")
chk("hembra marcada NO es torito", categoriaDeTernero("Hembra", true), "Ternera Reposicion")
chk("son 4 categorías", CATEGORIAS_TERNERO.length, 4)

// ── El cero sobrevive al viaje por Excel (lo que realmente importa)
const filas = [
  { "Caravana Oficial": normalizarCaravana("032 010012326481"), "Caravana Interna": "128" },
  { "Caravana Oficial": normalizarCaravana("032 010012326486"), "Caravana Interna": "130" },
]
const ws = XLSX.utils.json_to_sheet(filas)
for (const col of ["A", "B"]) {
  for (let f = 2; f <= filas.length + 1; f++) {
    const c = ws[`${col}${f}`]
    if (c) { c.t = "s"; c.z = "@" }
  }
}
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, "Ternero Recria (2)")

const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
const leido = XLSX.read(buf, { type: "buffer" })
const hoja = leido.Sheets[leido.SheetNames[0]!]!
const valores = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja)

console.log("\nlo que quedó en el archivo:")
for (const v of valores) console.log("  ", JSON.stringify(v))

chk("celda es texto (t:'s')", hoja["A2"]!.t, "s")
chk("el cero llegó al archivo", valores[0]!["Caravana Oficial"], "032010012326481")
chk("y NO se volvió número", typeof valores[0]!["Caravana Oficial"], "string")
chk("nombre de solapa <= 31 chars", leido.SheetNames[0]!.length <= 31, true)

console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLAS`)
process.exit(fallos ? 1 : 0)
