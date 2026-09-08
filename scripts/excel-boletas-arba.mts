/**
 * Arma el Excel de **lo que hay que pagar** del inmobiliario, a partir de una corrida de boletas.
 *
 * `npm run excel:arba`
 *
 * ## De dónde salen los datos
 * Los **importes** son los que leyó la app del cuerpo de los mails de ARBA en la corrida del
 * **08/09/2026** — todavía no se guardan en ninguna tabla (eso es `A-FEAT-114`), así que van acá
 * escritos. Los **nombres y responsables** salen de `egresos_sin_factura`, que es el registro.
 *
 * ⚠️ **Cada partida aparece UNA vez, en la empresa dueña.** Cinco de MSA llegaron también en el
 * mail de PAM; contarlas dos veces inflaría el total en $283.628,30. La columna *«Vino en»* deja
 * el dato sin sumarlo dos veces.
 *
 * 🔴 Lo que **no llegó** y lo que **no tiene dueño** van en hojas propias: un total que no muestra
 * lo que falta se lee como si estuviera completo.
 */
import * as XLSX from "xlsx"
import fs from "node:fs"

interface Fila {
  empresa: string
  concepto: string
  partida: string | null
  importe: number | null
  /** En el mail de qué empresa llegó, cuando no fue la del dueño. */
  vinoEn?: string
  nota?: string
}

/** Lo que llegó, ya adjudicado a su dueño según `egresos_sin_factura.responsable`. */
const APAGAR: Fila[] = [
  // ── MSA ──────────────────────────────────────────────────────────────────────────────────────
  { empresa: "MSA", concepto: "Anexo", partida: "099-008368-1", importe: 76169.40 },
  { empresa: "MSA", concepto: "Cholo 1", partida: "099-010611-8", importe: 22394.70 },
  { empresa: "MSA", concepto: "Cholo 2", partida: "099-012766-2", importe: 22255.20 },
  { empresa: "MSA", concepto: "Porteria Nuevo", partida: "099-015877-0", importe: 63458.50, vinoEn: "PAM" },
  { empresa: "MSA", concepto: "Porteria Viejo", partida: "099-015879-7", importe: 63458.80, vinoEn: "PAM" },
  { empresa: "MSA", concepto: "Rojas", partida: "090-016369-0", importe: 2383380.20 },
  { empresa: "MSA", concepto: "Sanchez", partida: "099-015880-0", importe: 65245.60 },
  { empresa: "MSA", concepto: "Tango Parra 1", partida: "099-015883-5", importe: 40934.10, vinoEn: "PAM" },
  { empresa: "MSA", concepto: "Tango Parra 2", partida: "099-015885-1", importe: 74842.80, vinoEn: "PAM" },
  { empresa: "MSA", concepto: "Tango Prim Leboso", partida: "099-015881-9", importe: 40934.10, vinoEn: "PAM" },
  {
    empresa: "MSA", concepto: "Complementario", partida: null, importe: 971114.20,
    nota: "Llegó como AVISO DE DÉBITO — verificar si ya se debita solo antes de pagarlo",
  },
  // ── PAM ──────────────────────────────────────────────────────────────────────────────────────
  { empresa: "PAM", concepto: "Casco", partida: "099-006595-0", importe: 1362096.50 },
  { empresa: "PAM", concepto: "Entre Rios", partida: "099-025551-2", importe: 31850.00 },
  { empresa: "PAM", concepto: "Ombu", partida: "099-016666-8", importe: 527041.20 },
  { empresa: "PAM", concepto: "Quinta Rosello 2", partida: "099-001846-4", importe: 21012.70 },
  { empresa: "PAM", concepto: "Tapera 1", partida: "099-015882-7", importe: 40550.90 },
  { empresa: "PAM", concepto: "Tapera 2", partida: "099-015884-3", importe: 39224.50 },
  { empresa: "PAM", concepto: "Complementario", partida: null, importe: 963879.90 },
  // ── MA ───────────────────────────────────────────────────────────────────────────────────────
  { empresa: "MA", concepto: "Lima", partida: "038-040142-8", importe: 810725.20 },
]

/** 🔴 Lo que el registro espera y ARBA NO mandó. Sin esto, el total parece completo y no lo está. */
const NOLLEGARON: Fila[] = [
  { empresa: "PAM", concepto: "Tapera 3", partida: "099-015886-0", importe: null, nota: "No llegó en ningún mail — bajarla del sitio de ARBA o reclamarla" },
  { empresa: "PAM", concepto: "Quinta Rosello 1", partida: "099-001854-5", importe: null, nota: "No llegó en ningún mail — bajarla del sitio de ARBA o reclamarla" },
]

/** Llegaron y no están en el registro: no se pueden imputar a ninguna empresa. */
const SINDUENIO: Fila[] = [
  { empresa: "—", concepto: "(sin template)", partida: "099-001274-1", importe: 510316.10, vinoEn: "PAM", nota: "No hay template con esta partida — ¿de quién es?" },
  { empresa: "—", concepto: "El Relincho", partida: "099-025089-8", importe: 174933.80, vinoEn: "PAM", nota: "Sin template activo (A-DAT-26)" },
]

const CUOTA = "2026 · Cuota 3"
const totalDe = (fs2: Fila[]) => fs2.reduce((s, f) => s + (f.importe ?? 0), 0)

// ── Hoja 1 · A PAGAR, por empresa y con subtotales ──────────────────────────────────────────────
const filas: (string | number | null)[][] = [
  ["INMOBILIARIO " + CUOTA + " — A PAGAR"],
  [],
  ["Empresa", "Concepto", "Partida", "Importe", "Vino en el mail de", "Observación"],
]
for (const emp of ["MSA", "PAM", "MA"]) {
  const delEmp = APAGAR.filter(f => f.empresa === emp)
  for (const f of delEmp) {
    filas.push([f.empresa, f.concepto, f.partida ?? "(sin partida)", f.importe, f.vinoEn ?? "", f.nota ?? ""])
  }
  const faltan = NOLLEGARON.filter(f => f.empresa === emp).length
  filas.push(["", `TOTAL ${emp}`, `${delEmp.length} boleta(s)`, totalDe(delEmp), "",
    faltan ? `⚠️ INCOMPLETO: faltan ${faltan} que ARBA no mandó (ver hoja «No llegaron»)` : ""])
  filas.push([])
}
filas.push(["", "TOTAL GENERAL", `${APAGAR.length} boleta(s)`, totalDe(APAGAR), "",
  "No incluye las 2 sin dueño ni las 2 que no llegaron"])

const wb = XLSX.utils.book_new()
const h1 = XLSX.utils.aoa_to_sheet(filas)
h1["!cols"] = [{ wch: 9 }, { wch: 22 }, { wch: 15 }, { wch: 16 }, { wch: 18 }, { wch: 62 }]
XLSX.utils.book_append_sheet(wb, h1, "A pagar")

// ── Hoja 2 · NO LLEGARON ────────────────────────────────────────────────────────────────────────
const h2 = XLSX.utils.aoa_to_sheet([
  ["NO LLEGARON — el registro las espera y ARBA no las mandó"],
  [],
  ["Empresa", "Concepto", "Partida", "Qué hacer"],
  ...NOLLEGARON.map(f => [f.empresa, f.concepto, f.partida, f.nota ?? ""]),
])
h2["!cols"] = [{ wch: 9 }, { wch: 22 }, { wch: 15 }, { wch: 62 }]
XLSX.utils.book_append_sheet(wb, h2, "No llegaron")

// ── Hoja 3 · SIN DUEÑO ──────────────────────────────────────────────────────────────────────────
const h3 = XLSX.utils.aoa_to_sheet([
  ["LLEGARON Y NO ESTÁN EN EL REGISTRO — no se pueden imputar"],
  [],
  ["Concepto", "Partida", "Importe", "Vino en el mail de", "Observación"],
  ...SINDUENIO.map(f => [f.concepto, f.partida, f.importe, f.vinoEn ?? "", f.nota ?? ""]),
  [],
  ["TOTAL", "", totalDe(SINDUENIO), "", ""],
])
h3["!cols"] = [{ wch: 22 }, { wch: 15 }, { wch: 16 }, { wch: 18 }, { wch: 52 }]
XLSX.utils.book_append_sheet(wb, h3, "Sin dueño")

// ── Hoja 4 · el control, para que el número se pueda verificar ──────────────────────────────────
const dup = APAGAR.filter(f => f.vinoEn)
const h4 = XLSX.utils.aoa_to_sheet([
  ["CÓMO SE ARMÓ ESTE NÚMERO"],
  [],
  ["Boletas que llegaron en los mails", 26],
  ["  − de las que son propias y se pagan", APAGAR.length],
  ["  − duplicadas (llegaron dos veces, se cuentan UNA)", dup.length],
  ["  − que no están en el registro", SINDUENIO.length],
  [],
  ["Las duplicadas, y por cuánto:", ""],
  ...dup.map(f => [`  ${f.concepto} (de ${f.empresa}, vino también en ${f.vinoEn})`, f.importe]),
  ["  Total de lo que se habría contado de más", totalDe(dup)],
  [],
  ["TOTAL A PAGAR (sin repetidas)", totalDe(APAGAR)],
  ["Más lo que llegó sin dueño", totalDe(SINDUENIO)],
  ["Total de todo lo que llegó", totalDe(APAGAR) + totalDe(SINDUENIO) + totalDe(dup)],
  [],
  ["Fuente: importes leídos del cuerpo de los mails de ARBA, corrida del 08/09/2026."],
  ["Nombres y responsables: egresos_sin_factura (templates activos)."],
])
h4["!cols"] = [{ wch: 56 }, { wch: 18 }]
XLSX.utils.book_append_sheet(wb, h4, "Control")

// Formato de moneda en las columnas de importe.
for (const [hoja, cols] of [[h1, ["D"]], [h3, ["C"]], [h4, ["B"]]] as const) {
  for (const ref of Object.keys(hoja)) {
    if (ref.startsWith("!")) continue
    if (cols.includes(ref.replace(/\d+/g, "")) && typeof hoja[ref].v === "number") {
      hoja[ref].z = '#,##0.00'
    }
  }
}

const destino = process.argv[2]
  || `${process.cwd()}/- Comunicacion JMS Claude - Archivos/Inmobiliario 2026 - Cuota 3 - a pagar.xlsx`
XLSX.writeFile(wb, destino)

console.log(`✓ ${destino}\n`)
for (const emp of ["MSA", "PAM", "MA"]) {
  const d = APAGAR.filter(f => f.empresa === emp)
  const falta = NOLLEGARON.filter(f => f.empresa === emp).length
  console.log(`  ${emp.padEnd(4)} ${String(d.length).padStart(2)} boleta(s)   $${totalDe(d).toLocaleString("es-AR", { minimumFractionDigits: 2 }).padStart(14)}`
    + (falta ? `   ⚠️ faltan ${falta}` : ""))
}
console.log(`  ${"".padEnd(4)} ${String(APAGAR.length).padStart(2)} en total    $${totalDe(APAGAR).toLocaleString("es-AR", { minimumFractionDigits: 2 }).padStart(14)}`)
console.log(`\n  Sin dueño (hoja aparte): $${totalDe(SINDUENIO).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`)
console.log(`  Verificación: ${fs.existsSync(destino) ? "el archivo existe" : "✗ NO SE ESCRIBIÓ"}`)
