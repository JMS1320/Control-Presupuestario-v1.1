/**
 * `npm run probar:export` — el Excel del presupuesto. **No toca nada.**
 *
 * ## Por qué existe
 * Un export se rompe de la peor manera: **el archivo se genera igual**. No hay excepción, no hay
 * error — sale un `.xlsx` que abre y está mal. Por eso acá no se mira que «no tire error»: se
 * **vuelve a leer el archivo** y se verifica lo que tiene adentro.
 *
 * Cubre lo que el usuario pidió el 2026-09-09 y lo que él mismo encontró mal:
 * 🔴 que los INGRESOS vayan **fila por fila** (fijado · presupuestado · disponible), no colapsados
 *    en un renglón — *«en el export veo Ingresos y en el presupuesto veo Nazarenas fijado…»*;
 * 🔴 que cada fila lleve **la regla** con la que se llena;
 * 🔴 que las filas de detalle queden **agrupadas** para poder colapsarlas desde Excel.
 */
import XLSX from "xlsx-js-style"

const B = process.cwd().split("\\").join("/")
const L = await import(`file:///${B}/lib/presupuesto/export.ts`)

const r: { ok: boolean; caso: string; detalle: string }[] = []
const chequear = (caso: string, ok: boolean, detalle: string) => r.push({ ok, caso, detalle })

const meses = [
  { anio: 2026, mes: 9, label: "sep-26" },
  { anio: 2026, mes: 10, label: "oct-26" },
]
const M = (a: number, b: number) => ({ "2026-09": a, "2026-10": b })

const datos = {
  empresa: "MSA", campana: "26/27", meses,
  ingresos: [
    { titulo: "Arrendamientos agrícolas", filas: [
      { concepto: "Nazarenas", montos: {}, regla: "" },
      { concepto: "fijado", montos: M(1_200_000, 0), nivel: 1, regla: "Precio cerrado, con factura — plata comprometida" },
      { concepto: "presupuestado", montos: M(0, 3_400_000), nivel: 1, regla: "Toneladas sin fijar × Matba de la posición × tipo de cambio", confianza: "media" },
      { concepto: "disponible a fijar", montos: M(0, 900_000), nivel: 1, regla: "Toneladas cuya fecha de cobro ya pasó sin fijar" },
    ] },
    { titulo: "Venta de hacienda", filas: [
      { concepto: "Vacas CUT", montos: M(0, 18_750_900), regla: "Lote con fecha de venta, valorizado en el mes de cobro" },
    ] },
  ],
  egresos: [
    { titulo: "Impuestos", filas: [
      { concepto: "Inmobiliario Casco", montos: M(1_362_096, 1_362_096), regla: "Las cuotas que declara el template" },
      { concepto: "Combustibles", montos: M(890_000, -915_000), regla: "Promedio últimos N meses", confianza: "media" },
    ] },
  ],
  inversiones: { titulo: "Inversiones", sumaAlTotal: false, filas: [
    { concepto: "Corral nuevo", montos: M(0, 4_000_000), regla: "Inversión cargada a mano (no suma al total)" },
  ] },
  saldoInicial: 5_000_000,
  origenSaldo: "último conciliado al 31/08/2026",
  advertencias: ["“Gasoil” está sin terminar: esa cuenta quedó en cero"],
  catalogo: [
    { familia: "Templates", clave: "declaradas", etiqueta: "Las cuotas que declara el template", cuando: "…", usos: 1 },
    { familia: "Templates", clave: "manual", etiqueta: "Monto fijo a mano", cuando: "…", usos: 0 },
    { familia: "Cuentas contables", clave: "por_cabeza", etiqueta: "Por cabeza", cuando: "…", usos: 0 },
  ],
}

// ── La tabla, antes de escribir el archivo ────────────────────────────────────────────────────
const tabla = L.armarTabla(datos)
const conceptos = tabla.map((f: any) => String(f.celdas[1]).trim())

chequear("🔴 Los INGRESOS van fila por fila, no colapsados en «Total de ingresos»",
  conceptos.includes("fijado") && conceptos.includes("presupuestado") && conceptos.includes("disponible a fijar"),
  conceptos.slice(0, 6).join(" · "))

chequear("Las tres capas del arrendamiento NO se suman entre sí en una fila",
  !conceptos.some((c: string) => /Total de ingresos/.test(c)), "no aparece")

// Toda fila tiene algo en la primera columna: su regla, o un «—» que dice que no tiene.
// El vacío no vale: una celda en blanco se lee como «me olvidé», no como «no aplica».
{
  const detalle = tabla.filter((f: any) => !f.titulo && !f.fuerte)
  const vacias = detalle.filter((f: any) => String(f.celdas[0] ?? "").trim() === "")
  chequear("Ninguna fila queda con la primera columna en blanco",
    vacias.length === 0,
    vacias.length ? `en blanco: ${vacias.map((f: any) => f.celdas[1]).join(", ")}` : `${detalle.length} filas, todas dicen algo`)

  chequear("Y las que sí tienen regla, la tienen completa",
    detalle.filter((f: any) => String(f.celdas[0]) !== "—").every((f: any) => String(f.celdas[0]).length > 10),
    `${detalle.filter((f: any) => String(f.celdas[0]) !== "—").length} con regla`)
}

chequear("Un subtotal NO inventa una regla propia",
  tabla.some((f: any) => String(f.celdas[0]) === "suma de las filas de arriba"), "dice de dónde sale")

chequear("El saldo acumulado no suma meses en la columna TOTAL (no significaría nada)",
  (() => { const f = tabla.find((x: any) => String(x.celdas[1]) === "SALDO ACUMULADO")
    return f && f.celdas[f.celdas.length - 1] === f.celdas[f.celdas.length - 2] })(),
  "lleva el último saldo, no la suma")

chequear("Las inversiones se muestran pero NO entran al total de egresos",
  (() => { const e = tabla.find((x: any) => String(x.celdas[1]) === "TOTAL EGRESOS")
    return e && Number(e.celdas[2]) === 1_362_096 + 890_000 })(),
  "el corral no está en el total")

// ── El archivo, ya escrito y vuelto a leer ────────────────────────────────────────────────────
// Se intercepta la escritura: en Node no hay `document` para disparar la descarga.
const escrito: { buf: ArrayBuffer } = { buf: new ArrayBuffer(0) }
const origBlob = globalThis.Blob
;(globalThis as any).Blob = class { constructor(partes: any[]) { escrito.buf = partes[0] } }
;(globalThis as any).URL = { createObjectURL: () => "x", revokeObjectURL: () => {} }
;(globalThis as any).document = {
  createElement: () => ({ href: "", download: "", click: () => {}, remove: () => {} }),
  body: { appendChild: () => {}, removeChild: () => {} },
}
L.exportarExcel(datos, "prueba")
;(globalThis as any).Blob = origBlob

const wb = XLSX.read(new Uint8Array(escrito.buf as ArrayBuffer), { type: "array", cellStyles: true })

chequear("El archivo tiene las hojas esperadas",
  wb.SheetNames.includes("Resumen") && wb.SheetNames.includes("La tabla") && wb.SheetNames.includes("Modos de llenado"),
  wb.SheetNames.join(" · "))

const h = wb.Sheets["La tabla"]

chequear("El encabezado dice «Cómo se llena» en la primera columna",
  h["A5"]?.v === "Cómo se llena", String(h["A5"]?.v))

chequear("🔽 Las filas de detalle quedan AGRUPADAS (colapsables desde Excel)",
  (h["!rows"] ?? []).some((x: any) => x?.level === 1),
  `${(h["!rows"] ?? []).filter((x: any) => x?.level === 1).length} filas en nivel 1`)

chequear("Los títulos de bloque y los totales NO se agrupan (si no, se esconderían solos)",
  (() => { const rows = (h["!rows"] ?? []) as any[]
    const iTot = tabla.findIndex((f: any) => String(f.celdas[1]) === "TOTAL EGRESOS")
    return rows[5 + iTot]?.level !== 1 })(), "quedan en nivel 0")

chequear("Las columnas tienen ancho medido, no fijo ni desbordado",
  (() => { const c = (h["!cols"] ?? []) as any[]
    return c.length > 2 && c.every(x => x.wch >= 11 && x.wch <= 40) })(),
  ((h["!cols"] ?? []) as any[]).map(c => c.wch).join(" · "))

// 🔬 **Los estilos se verifican leyendo el XML de adentro del `.xlsx`, no releyendo con la
// librería.** `xlsx-js-style` los ESCRIBE pero no los devuelve al leer: un test que confirmara el
// round-trip estaría probando la librería y no nuestro archivo — y daría rojo con el export sano,
// que es la peor clase de test.
const fs2 = await import("node:fs")
const { execSync } = await import("node:child_process")
fs2.writeFileSync(".tmp-export.xlsx", Buffer.from(escrito.buf as ArrayBuffer))
let xml = ""
try { xml = execSync("unzip -p .tmp-export.xlsx xl/styles.xml", { encoding: "utf8", maxBuffer: 8e6 }) }
catch { xml = "" }
finally { try { fs2.unlinkSync(".tmp-export.xlsx") } catch { /* ya no está */ } }

if (!xml) {
  console.log("  ⚠️ No se pudo abrir el .xlsx para mirar los estilos (¿falta `unzip`?). Salteados.")
} else {
  chequear("🎨 Los números llevan el formato de la app (miles, negativo en rojo)",
    xml.includes("#,##0;[Red]-#,##0"), xml.includes("#,##0;[Red]-#,##0") ? "está en styles.xml" : "no está")

  const negritas = (xml.match(/<b\/>/g) ?? []).length
  chequear("Hay NEGRITA en el archivo", negritas > 0, `${negritas} fuentes en negrita`)

  const fondos = [...xml.matchAll(/fgColor rgb="FF([0-9A-F]{6})"/g)].map(m => m[1])
  const claro = (h6: string) => parseInt(h6.slice(0, 2), 16) > 200 && parseInt(h6.slice(2, 4), 16) > 200
  chequear("🎨 Hay fondos y son CLAROS — salvo el encabezado, que va oscuro a propósito",
    fondos.length >= 3 && fondos.filter(claro).length >= fondos.length - 2,
    fondos.map(f => "#" + f).join(" · ") || "(ninguno)")
}

// El catálogo: lo importante es que muestre los que NADIE usa.
const cat = XLSX.utils.sheet_to_json(wb.Sheets["Modos de llenado"], { header: 1 }) as any[][]
chequear("🔴 El catálogo destaca los modos que nadie usa",
  cat.some(f => String(f[0] ?? "").startsWith("NUNCA USADOS")),
  cat.find(f => String(f[0] ?? "").startsWith("NUNCA USADOS"))?.[0] ?? "(no aparece)")

for (const x of r) {
  console.log(`  ${x.ok ? "✓" : "✗"} ${x.caso}`)
  console.log(`      ${x.detalle}`)
}
const mal = r.filter(x => !x.ok).length
console.log(`\n${r.length - mal} de ${r.length} pasaron`)
process.exit(mal ? 1 : 0)
