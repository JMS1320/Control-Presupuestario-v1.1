/**
 * `npm run probar:romaneo` — la CADENA COMPLETA del romaneo, de punta a punta.
 *
 * PDF → cabezas → adjudicación por peso → grupos de precio → lo que iría a las ventas.
 * **No toca la base**: sólo lee el PDF del disco.
 *
 * ## Por qué existe además de `npm run probar`
 * Los casos de `lib/pruebas/casos.ts` prueban las funciones **por separado**, con datos escritos a
 * mano. Éste las prueba **encadenadas y contra el PDF real**, que es donde aparecen los defectos de
 * costura — los que ninguna función tiene sola.
 *
 * Encontró uno el 2026-09-06: el garrón 512 se iba al grupo de $5.800 debiendo ir al de $6.600,
 * porque para `VA C` hay dos líneas y el match se quedaba con la primera **en silencio**. Ninguna
 * prueba unitaria lo veía: cada función hacía bien su parte (A-BUG-118).
 *
 * ⚠️ Necesita el PDF en la carpeta de comunicación, que **no está en el repo**. Si no está, avisa
 * y sale sin fallar: es un diagnóstico, no una compuerta.
 */
import fs from "node:fs"
const B = process.cwd().split("\\").join("/")
const { parsearRomaneo } = await import(`file:///${B}/lib/ganaderia/parsear-romaneo.ts`)
const { adjudicarPorPeso, cabezasDeMedias, rindePorGrupo, factorDeCarga } =
  await import(`file:///${B}/lib/ganaderia/adjudicar-romaneo.ts`)

const PDF = `${B}/- Comunicacion JMS Claude - Archivos/- Romaneo.pdf`
if (!fs.existsSync(PDF)) {
  console.log(`No está el PDF de referencia:
  ${PDF}
Este diagnóstico necesita el romaneo real. Salteado.`)
  process.exit(0)
}
const buf = fs.readFileSync(PDF)
const rom = await parsearRomaneo(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))

const VACAS = [766, 562, 540, 522, 502, 478, 270].map((p, i) => ({ id: `v${i}`, caravana: `V${i}`, razon: null, peso_kg: p }))
const TOROS = [1035, 870, 756].map((p, i) => ({ id: `t${i}`, caravana: `T${i}`, razon: null, peso_kg: p }))
const CAMION = 6500
const f = factorDeCarga([...VACAS, ...TOROS], CAMION)

const n = (v: number) => v.toLocaleString("es-AR", { maximumFractionDigits: 2 })
const linea = (et: string, esp: string, obt: string, ok: boolean) =>
  console.log(`  ${ok ? "✓" : "✗"} ${et.padEnd(44)} ${obt.padStart(16)}${ok ? "" : `   (esperado ${esp})`}`)

console.log("\n═══ 1 · EL PDF ═══")
linea("líneas de liquidación", "9", String(rom.lineas.length), rom.lineas.length === 9)
linea("medias reses leídas", "20", String(rom.medias.length), rom.medias.length === 20)
linea("cabezas", "10", String(rom.cabezas), rom.cabezas === 10)
linea("total liquidado", "18750900", n(rom.total), Math.abs(rom.total - 18750900) < 1)
linea("kilos gancho", "3354", n(rom.kilos_gancho), rom.kilos_gancho === 3354)
linea("rinde impreso", "53.58", String(rom.rinde), rom.rinde === 53.58)
linea("medias sin precio", "0", String(rom.medias.filter((m: any) => m.precio_kg == null).length),
  rom.medias.filter((m: any) => m.precio_kg == null).length === 0)
console.log("  avisos:", rom.avisos.length ? rom.avisos.join(" | ") : "(ninguno)")

for (const corregir of [false, true]) {
  console.log(`\n═══ 2 · ${corregir ? "CON los garrones 509/512 corregidos" : "SIN corregir (como lo dejó el usuario)"} ═══`)
  let cab = cabezasDeMedias(rom.medias)
  // Igual que el modal: corregir el kilo vuelve a resolver el precio contra la linea de 1 cabeza.
  const reprecio = (c: any, kg: number) => {
    const l = rom.lineas.find((x: any) => x.tipo === c.tipo && x.clase === c.clase
      && x.contenido === c.contenido && x.cabezas === 1 && Math.abs(x.kg_faena - kg) <= 1)
    return { ...c, kg_gancho: kg, medias: 2, precio_kg: l ? l.precio_kg : c.precio_kg }
  }
  if (corregir) cab = cab.map((c: any) =>
    c.garron === "509" ? reprecio(c, 234) : c.garron === "512" ? reprecio(c, 373) : c)

  const incompletos = cab.filter((c: any) => c.medias !== 2).map((c: any) => c.garron)
  console.log(`  garrones incompletos: ${incompletos.join(", ") || "(ninguno)"}`)

  const pares = [
    ...adjudicarPorPeso(VACAS, cab.filter((c: any) => c.tipo === "VA"), f).pares,
    ...adjudicarPorPeso(TOROS, cab.filter((c: any) => c.tipo === "TO"), f).pares,
  ]
  const g = rindePorGrupo(pares)
  const vivo = g.reduce((s: number, x: any) => s + x.kg_vivo, 0)
  const gancho = g.reduce((s: number, x: any) => s + x.kg_gancho, 0)

  linea("grupos de precio", "5", String(g.length), g.length === 5)
  linea("suma del vivo (debe ser el camión)", "6500", n(Math.round(vivo)), Math.abs(vivo - CAMION) < 3)
  linea("suma del gancho", "3354", n(gancho), Math.abs(gancho - 3354) < 1)
  linea("grupos sin vivo", "0", String(g.filter((x: any) => !x.kg_vivo).length), g.filter((x: any) => !x.kg_vivo).length === 0)
  for (const x of g) {
    console.log(`      ${x.tipo} $${n(x.precio)}  ${x.cabezas} cab  ${n(x.kg_gancho)} kg carne  ${n(Math.round(x.kg_vivo))} kg vivo  rinde ${x.rinde}%`)
  }
}

console.log("\n═══ 3 · LO QUE IRÍA A LAS VENTAS ═══")
for (const t of ["VA", "TO"]) {
  const ls = rom.lineas.filter((l: any) => l.tipo === t)
  const kgc = ls.reduce((s: number, l: any) => s + l.kg_faena, 0)
  const imp = ls.reduce((s: number, l: any) => s + l.importe, 0)
  const esp = t === "VA" ? [1748, 10399700] : [1606, 8351200]
  linea(`${t} · kg carne`, String(esp[0]), n(kgc), kgc === esp[0])
  linea(`${t} · importe`, String(esp[1]), n(imp), Math.abs(imp - esp[1]) < 1)
}
