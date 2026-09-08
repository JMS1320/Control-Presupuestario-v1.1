/**
 * `npm run probar:informe` — el informe de boletas **en el idioma del usuario**. No toca nada.
 *
 * ## Por qué existe
 * Pedido textual (2026-09-08), después de recibir un informe que no le servía:
 * *«el informe a mí tiene que ser en mi lenguaje: encontró inmobiliario MSA, Tango 1, Tango 2,
 * Tango 3; tal no encontró; tantos duplicados»*.
 *
 * Lo que le había mostrado era **«8 bajada(s) · 4 link(s) que no dieron PDF»**. Eso no es un
 * informe, es un log: cuenta lo que hizo el programa, no lo que pasó con su plata.
 *
 * Los datos son **los mails reales del 08/09**, con los tres CUITs y las partidas que llegaron.
 */
const B = process.cwd().split("\\").join("/")
const { armarInforme } = await import(`file:///${B}/lib/arba/informe-boletas.ts`)

const r: { ok: boolean; caso: string; detalle: string }[] = []
const chequear = (caso: string, ok: boolean, detalle: string) => r.push({ ok, caso, detalle })

const RURAL = "Boleta por Mail - Vencimiento del Impuesto Inmobiliario Rural Cuota 3"
const COMPL = "Boleta por Mail - Vencimiento del Impuesto Inmobiliario Complementario Cuota 3"
const DEBITO = "Boleta por Mail - Aviso de débito  -  Vencimiento del Impuesto Inmobiliario Complementario Cuota 3"

// Los mails tal como llegaron el 08/09.
const TABLAS = [
  { asunto: COMPL, contribuyente: "20-04439022-2", filas: [{ objeto: "20-04439022-2", importe: 963879.90 }] },
  { asunto: RURAL, contribuyente: "30-61778601-6", filas: [
    { objeto: "099-015881-9", importe: 40934.10 },
    { objeto: "099-010611-8", importe: 22394.70 },
    { objeto: "090-016369-0", importe: 2383380.20 },
  ] },
  { asunto: RURAL, contribuyente: "27-06682461-1", filas: [{ objeto: "038-040142-8", importe: 810725.20 }] },
  { asunto: RURAL, contribuyente: "20-04439022-2", filas: [
    { objeto: "099-015881-9", importe: 40934.10 },   // ⚠️ la MISMA que le llegó a MSA
    { objeto: "099-006595-0", importe: 1362096.50 },
  ] },
  { asunto: DEBITO, contribuyente: "30-61778601-6", filas: [{ objeto: "30-61778601-6", importe: 971114.20 }] },
]

// Lo que la app sabe: partida → nombre del campo. `090-016369-0` a propósito NO está.
const NOMBRES: Record<string, string> = {
  "099-015881-9": "Tango 1",
  "099-010611-8": "Tango 2",
  "038-040142-8": "El Relincho",
  "099-006595-0": "Casco",
}

const inf = armarInforme(TABLAS, NOMBRES, { ya_estaban: [1], sin_tiempo: true, quedaron: 38, descuadres: [{ asunto: RURAL, detalle: "x" }] })

// ── Lo que el usuario quiere leer ─────────────────────────────────────────────────────────────
chequear("🗣️ Dice el NOMBRE DEL CAMPO, no la partida",
  inf.lineas.filter((l: any) => l.lote === "Tango 1").length === 2, // le llegó a MSA y a PAM
  inf.lineas.map((l: any) => l.lote ?? l.objeto).join(" · "))

chequear("Agrupa por EMPRESA con su nombre corto, no por CUIT",
  [...new Set(inf.lineas.map((l: any) => l.empresa))].sort().join(",") === "MA,MSA,PAM",
  [...new Set(inf.lineas.map((l: any) => l.empresa))].join(","))

chequear("Distingue Inmobiliario de Complementario, y el aviso de débito",
  [...new Set(inf.lineas.map((l: any) => l.que))].sort().join(" | "),
  "Complementario (aviso de débito) cuota 3 | Complementario cuota 3 | Inmobiliario cuota 3")

chequear("El complementario no inventa un campo: es de toda la empresa",
  inf.lineas.find((l: any) => l.objeto === "20-04439022-2")?.lote === "PAM (todo el CUIT)",
  String(inf.lineas.find((l: any) => l.objeto === "20-04439022-2")?.lote))

// 963.879,90 + 40.934,10 + 22.394,70 + 2.383.380,20 + 810.725,20 + 40.934,10 + 1.362.096,50 + 971.114,20
chequear("Suma la plata de todas las boletas",
  Math.abs(inf.total - 6595458.9) < 0.01, `$${inf.total.toLocaleString("es-AR")}`)

// ── 🔴 «Tal no encontró» ──────────────────────────────────────────────────────────────────────
chequear("🔴 Señala la partida que NO tiene campo asignado",
  inf.sinTemplate.length === 1 && inf.sinTemplate[0].objeto === "090-016369-0",
  inf.sinTemplate.map((l: any) => l.objeto).join(","))

chequear("Y esa NO se cuenta como si estuviera resuelta",
  inf.sinTemplate[0].lote === null, "sin campo")

// ── 🔴 «Tantos duplicados» ────────────────────────────────────────────────────────────────────
chequear("🔴 Detecta la partida que llegó dos veces, y dice a qué empresas",
  inf.repetidas.length === 1 && inf.repetidas[0].objeto === "099-015881-9"
  && inf.repetidas[0].empresas.sort().join(",") === "MSA,PAM",
  inf.repetidas.map((x: any) => `${x.objeto} → ${x.empresas.join(" y ")}`).join(" · "))

chequear("Una partida que llegó una sola vez NO figura como repetida",
  !inf.repetidas.some((x: any) => x.objeto === "099-006595-0"), "no figura")

// ── El pie: lo que hay que hacer ──────────────────────────────────────────────────────────────
chequear("Avisa que quedaron boletas sin bajar, y que se resuelve repitiendo",
  inf.pie.some((p: string) => /38/.test(p) && /sigue donde iba/.test(p)),
  inf.pie.find((p: string) => /38/.test(p)) ?? "(nada)")

chequear("Y menciona las que ya estaban y los descuadres",
  inf.pie.some((p: string) => /ya estaban/.test(p)) && inf.pie.some((p: string) => /no coincide/.test(p)),
  `${inf.pie.length} líneas de pie`)

chequear("Sin nada que informar, no inventa un informe",
  armarInforme([], {}).lineas.length === 0, "vacío")

console.log("\n── El informe, con los mails del 08/09 ──")
for (const clave of [...new Set(inf.lineas.map((l: any) => `${l.empresa}|${l.que}`))]) {
  const [emp, que] = String(clave).split("|")
  console.log(`\n  ${emp} · ${que}`)
  for (const l of inf.lineas.filter((x: any) => `${x.empresa}|${x.que}` === clave)) {
    console.log(`     ${(l.lote ?? `⚠ ${l.objeto} — sin campo asignado`).padEnd(38)} $${(l.importe ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`)
  }
}
console.log("")
for (const p of inf.pie) console.log(`  ${p}`)

console.log("")
for (const x of r) {
  console.log(`  ${x.ok ? "✓" : "✗"} ${x.caso}`)
  console.log(`      ${x.detalle}`)
}
const mal = r.filter(x => !x.ok).length
console.log(`\n${r.length - mal} de ${r.length} pasaron`)
process.exit(mal ? 1 : 0)
