/**
 * `npm run probar:informe` — el informe de boletas **contra nuestro registro**. No toca nada.
 *
 * ## Qué vigila, y por qué
 * El pedido del usuario (2026-09-08) cambió el eje del informe:
 *
 * > *«Que la app nos diga **en función de nuestro registro**, no mezcle cosas. MSA todas las
 * > partidas, complementario, **alerta si alguna no llegó o llegó alguna de más**. Ídem PAM, MA.
 * > Rápidamente ver si tenemos todo o falta algo. Luego viene: tales vinieron también para PAM.»*
 *
 * 🔴 **Lo que un informe así NO puede fallar es lo ausente.** Listar lo que llegó es fácil; el valor
 * está en decir **qué falta**, y eso sólo se puede hacer partiendo de la lista propia. Por eso el
 * caso más importante de este archivo es que **Quinta Roselló 1 y Tapera 3 aparezcan como faltantes**.
 *
 * Los datos son **la corrida real de las 12:25 del 08/09**: 26 boletas en 6 mails.
 */
const B = process.cwd().split("\\").join("/")
const { armarInforme } = await import(`file:///${B}/lib/arba/informe-boletas.ts`)

const r: { ok: boolean; caso: string; detalle: string }[] = []
const chequear = (caso: string, ok: boolean, detalle: string) => r.push({ ok, caso, detalle })
const m = (n: number | null | undefined) => n == null ? "—" : `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`

const RURAL = "Boleta por Mail - Vencimiento del Impuesto Inmobiliario Rural Cuota 3"
const COMPL = "Boleta por Mail - Vencimiento del Impuesto Inmobiliario Complementario Cuota 3"
const DEBITO = "Boleta por Mail - Aviso de débito  -  Vencimiento del Impuesto Inmobiliario Complementario Cuota 3"

/** Los 6 mails tal como llegaron. */
const TABLAS = [
  { asunto: COMPL, contribuyente: "20-04439022-2", filas: [{ objeto: "20-04439022-2", importe: 963879.90 }] },
  { asunto: RURAL, contribuyente: "30-61778601-6", filas: [
    { objeto: "099-015881-9", importe: 40934.10 }, { objeto: "099-010611-8", importe: 22394.70 },
    { objeto: "099-008368-1", importe: 76169.40 }, { objeto: "099-012766-2", importe: 22255.20 },
    { objeto: "099-015877-0", importe: 63458.50 }, { objeto: "099-015879-7", importe: 63458.80 },
    { objeto: "099-015880-0", importe: 65245.60 }, { objeto: "090-016369-0", importe: 2383380.20 },
  ] },
  { asunto: RURAL, contribuyente: "27-06682461-1", filas: [{ objeto: "038-040142-8", importe: 810725.20 }] },
  { asunto: RURAL, contribuyente: "30-61778601-6", filas: [
    { objeto: "099-015883-5", importe: 40934.10 }, { objeto: "099-015885-1", importe: 74842.80 },
  ] },
  { asunto: RURAL, contribuyente: "20-04439022-2", filas: [
    { objeto: "099-015879-7", importe: 63458.80 }, { objeto: "099-016666-8", importe: 527041.20 },
    { objeto: "099-025551-2", importe: 31850.00 }, { objeto: "099-025089-8", importe: 174933.80 },
    { objeto: "099-015877-0", importe: 63458.50 }, { objeto: "099-001274-1", importe: 510316.10 },
    { objeto: "099-015883-5", importe: 40934.10 }, { objeto: "099-006595-0", importe: 1362096.50 },
    { objeto: "099-001846-4", importe: 21012.70 }, { objeto: "099-015884-3", importe: 39224.50 },
    { objeto: "099-015881-9", importe: 40934.10 }, { objeto: "099-015885-1", importe: 74842.80 },
    { objeto: "099-015882-7", importe: 40550.90 },
  ] },
  { asunto: DEBITO, contribuyente: "30-61778601-6", filas: [{ objeto: "30-61778601-6", importe: 971114.20 }] },
]

/** Los templates ACTIVOS, con su `responsable` — tal como están en la base. */
const TEMPLATES = [
  ...[["Anexo", "099-008368-1"], ["Cholo 1", "099-010611-8"], ["Cholo 2", "099-012766-2"],
      ["Porteria Nuevo", "099-015877-0"], ["Porteria Viejo", "099-015879-7"], ["Rojas", "090-016369-0"],
      ["Sanchez", "099-015880-0"], ["Tango Parra 1", "099-015883-5"], ["Tango Parra 2", "099-015885-1"],
      ["Tango Prim Leboso", "099-015881-9"]]
    .map(([n, p]) => ({ nombre: `Inmobiliario Cuota ${n}`, partida: p, responsable: "MSA" })),
  ...[["Casco", "099-006595-0"], ["Entre Rios", "099-025551-2"], ["Ombu", "099-016666-8"],
      ["Quinta Rosello 1", "099-001854-5"], ["Quinta Rosello 2", "099-001846-4"],
      ["Tapera 1", "099-015882-7"], ["Tapera 2", "099-015884-3"], ["Tapera 3", "099-015886-0"]]
    .map(([n, p]) => ({ nombre: `Inmobiliario Cuota ${n}`, partida: p, responsable: "PAM" })),
  { nombre: "Inmobiliario Cuota Lima", partida: "038-040142-8", responsable: "MA" },
  { nombre: "Inmobiliario Complementario Cuota MSA", partida: null, responsable: "MSA", complementario: true },
  { nombre: "Inmobiliario Complementario Cuota PAM", partida: null, responsable: "PAM", complementario: true },
]

const inf = armarInforme(TABLAS, TEMPLATES, { ya_estaban: [1], sin_tiempo: true, quedaron: 18, descuadres: [{ asunto: DEBITO, detalle: "1 vs 6" }] })
const bloque = (e: string) => inf.bloques.find((b: any) => b.empresa === e)

// ── 🔴 Lo que falta: la razón de ser del informe ──────────────────────────────────────────────
chequear("🔴 Avisa que a PAM le faltan DOS boletas",
  bloque("PAM")?.faltan.length === 2, `faltan ${bloque("PAM")?.faltan.length}`)

chequear("🔴 Y dice CUÁLES: Quinta Roselló 1 y Tapera 3",
  bloque("PAM")?.faltan.map((f: any) => f.nombre).sort().join(" · ")
  === "Inmobiliario Cuota Quinta Rosello 1 · Inmobiliario Cuota Tapera 3",
  bloque("PAM")?.faltan.map((f: any) => f.nombre).join(" · "))

chequear("MSA está completo: 11 de 11 (10 partidas + el complementario)",
  bloque("MSA")?.completo === true && bloque("MSA")?.esperadas === 11,
  `${bloque("MSA")?.llegaron} de ${bloque("MSA")?.esperadas}`)

chequear("MA está completo: 1 de 1", bloque("MA")?.completo === true,
  `${bloque("MA")?.llegaron} de ${bloque("MA")?.esperadas}`)

chequear("El total de faltantes es el de todas las empresas juntas",
  inf.totalFaltan === 2, `${inf.totalFaltan}`)

// ── 🔴 Lo que llegó de MÁS ────────────────────────────────────────────────────────────────────
chequear("🔴 Señala las 2 que llegaron y NO están en nuestro registro",
  inf.deMas.length === 2 && inf.deMas.map((l: any) => l.objeto).sort().join(",") === "099-001274-1,099-025089-8",
  inf.deMas.map((l: any) => `${l.objeto} ${m(l.importe)}`).join(" · "))

chequear("Y dice en el mail de quién vinieron",
  inf.deMas.every((l: any) => l.vinoEn === "PAM"), inf.deMas.map((l: any) => l.vinoEn).join(","))

// ── 🔵 «Tales vinieron también para PAM» ──────────────────────────────────────────────────────
chequear("🔵 Las 5 cruzadas son de MSA y vinieron también en el mail de PAM",
  inf.cruzadas.length === 5 && inf.cruzadas.every((c: any) => c.duena === "MSA" && c.vinoEn.includes("PAM")),
  inf.cruzadas.map((c: any) => c.nombre.replace("Inmobiliario Cuota ", "")).join(" · "))

chequear("Quinta Roselló 2 es de PAM y vino en su propio mail: NO es cruzada",
  !inf.cruzadas.some((c: any) => /Rosello 2/.test(c.nombre)), "no figura")

// ── El complementario, que no tiene partida ───────────────────────────────────────────────────
chequear("El complementario se resuelve por el CUIT del mail, no por partida",
  bloque("MSA")?.filas.find((f: any) => f.complementario !== undefined || /Complementario/.test(f.nombre))?.llego === true,
  "MSA lo recibió")

chequear("🔴 El complementario de PAM NO se confunde con el de MSA",
  Math.abs((bloque("PAM")?.filas.find((f: any) => /Complementario/.test(f.nombre))?.importe ?? 0) - 963879.90) < 0.01
  && Math.abs((bloque("MSA")?.filas.find((f: any) => /Complementario/.test(f.nombre))?.importe ?? 0) - 971114.20) < 0.01,
  `PAM ${m(bloque("PAM")?.filas.find((f: any) => /Complementario/.test(f.nombre))?.importe)} · MSA ${m(bloque("MSA")?.filas.find((f: any) => /Complementario/.test(f.nombre))?.importe)}`)

// ── Nada se pierde ────────────────────────────────────────────────────────────────────────────
{
  // Las 26 que llegaron se reparten en tres cajas y no hay una cuarta: un template satisfecho
  // (19), la SEGUNDA copia de uno que vino duplicado (5), o algo que no es nuestro (2).
  const satisfechos = inf.bloques.reduce((s: number, b: any) => s + b.llegaron, 0)
  const copiasExtra = inf.bloques.reduce((s: number, b: any) =>
    s + b.filas.filter((f: any) => f.duplicadaEn.length > 1).length, 0)
  chequear("🔴 Las 26 que llegaron están todas contadas: ninguna se pierde en el camino",
    satisfechos + copiasExtra + inf.deMas.length === 26,
    `${satisfechos} templates + ${copiasExtra} copias duplicadas + ${inf.deMas.length} de más`)
}

chequear("Sin templates no inventa un informe", armarInforme(TABLAS, []).bloques.length === 0, "vacío")

chequear("Sin mails, TODAS figuran como faltantes (no dice «todo bien»)",
  armarInforme([], TEMPLATES).totalFaltan === 21, `${armarInforme([], TEMPLATES).totalFaltan} faltantes`)

// ── La foto ───────────────────────────────────────────────────────────────────────────────────
console.log("\n══ EL INFORME, con la corrida real de las 12:25 ══")
console.log(inf.totalFaltan === 0 ? "\n  ✓ Están todas" : `\n  ⚠ Faltan ${inf.totalFaltan} boleta(s)`)
for (const b of inf.bloques) {
  console.log(`\n  ${b.completo ? "✓" : "⚠"} ${b.empresa} — ${b.llegaron} de ${b.esperadas}${" ".repeat(6)}${m(b.total)}`)
  for (const f of b.filas) {
    const marca = f.llego ? "  " : "✗ "
    const nota = f.vinoEnOtra ? `   ← vino en el mail de ${f.vinoEnOtra}`
      : f.duplicadaEn.length > 1 ? `   ← duplicada (${f.duplicadaEn.join(" y ")})` : ""
    console.log(`     ${marca}${f.nombre.replace("Inmobiliario ", "").padEnd(28)} ${(f.llego ? m(f.importe) : "NO LLEGÓ").padStart(14)}${nota}`)
  }
}
if (inf.deMas.length) {
  console.log(`\n  ⚠ Llegaron ${inf.deMas.length} que no están en nuestro registro:`)
  for (const l of inf.deMas) console.log(`     ${l.objeto}   ${m(l.importe)}   (mail de ${l.vinoEn})`)
}
if (inf.cruzadas.length) {
  console.log(`\n  🔵 Vinieron también en el mail de otra empresa:`)
  for (const c of inf.cruzadas) console.log(`     ${c.nombre.replace("Inmobiliario Cuota ", "")} (de ${c.duena}) → también en ${c.vinoEn.join(" y ")}`)
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
