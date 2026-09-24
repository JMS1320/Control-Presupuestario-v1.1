/**
 * `npm run probar:canales` — comparar el negocio hecho contra los otros canales. **No toca nada.**
 *
 * ## El fixture es la venta REAL del 04/09
 * 10 cabezas a Arre Beef: **6.301 kg** pesados en el campo, **3.354 kg** de carne y
 * **$18.750.900** liquidados. Con eso el rinde real es **53,23 %** — y ahí está el punto del
 * pendiente: la tabla dice que el gordo rinde 58 %, así que comparar con la norma en vez de con lo
 * medido habría inflado el lado de Arrebeef casi un 9 %.
 *
 * ## Lo que se vigila
 * 🔴 **Que un canal incompleto no gane nunca.** Es la forma más fácil de que este comparador mienta:
 * al que le falta el flete siempre parece el mejor.
 * 🔴 **Que no se comparen dos haciendas distintas.** Si los canales no arrancan del mismo peso de
 * origen, no hay comparación posible — y un ganador ahí es peor que ningún ganador.
 */
const B = process.cwd().split("\\").join("/")
const L = await import(`file:///${B}/lib/ganaderia/comparar-canales.ts`)
const { canalReal, canalHipotetico, compararCanales, valorPresente, PLAZOS_POR_DEFECTO } = L

const r: { ok: boolean; caso: string; detalle: string }[] = []
const chequear = (caso: string, ok: boolean, detalle: string) => r.push({ ok, caso, detalle })
const n2 = (x: number | null | undefined) => x == null ? "—" : x.toLocaleString("es-AR", { maximumFractionDigits: 2 })

// ── La venta real ─────────────────────────────────────────────────────────────────────────────
const KG_CAMPO = 6301
const REAL = canalReal({
  nombre: "Arre Beef", kgVivoOrigen: KG_CAMPO, kgCarne: 3354,
  importeLiquidado: 18750900, flete: 0, plazoDias: PLAZOS_POR_DEFECTO.arrebeef,
})

chequear("El rinde real se DERIVA, no se supone (3.354 ÷ 6.301)",
  Math.abs((REAL.rinde ?? 0) - 0.5323) < 0.0001, `${((REAL.rinde ?? 0) * 100).toFixed(2)} %`)

chequear("🔑 Y NO es el 58 % de la tabla: comparar con la norma habría inflado este lado",
  Math.abs((REAL.rinde ?? 0) - 0.58) > 0.04, `medido ${((REAL.rinde ?? 0) * 100).toFixed(2)} % vs norma 58 %`)

chequear("El precio de la carne también se deriva del papel",
  Math.abs((REAL.precio ?? 0) - 5590.61) < 0.01, `$${n2(REAL.precio)} por kg de carne`)

chequear("Y el número comparable es $/kg VIVO de origen",
  Math.abs((REAL.porKgVivo ?? 0) - 2975.86) < 0.01, `$${n2(REAL.porKgVivo)} por kg vivo`)

// ── Los canales hipotéticos: a kilo vivo, SIN rinde ───────────────────────────────────────────
const CANUELAS = canalHipotetico({
  nombre: "Cañuelas", kgVivoOrigen: KG_CAMPO, precioVivo: 3100, pctDesbaste: 0.08,
  pctComision: 0.035, pctGastos: 0.0075, flete: 960000, plazoDias: PLAZOS_POR_DEFECTO.canuelas,
})
const MATARIFE = canalHipotetico({
  nombre: "Matarife zonal", kgVivoOrigen: KG_CAMPO, precioVivo: 2900, pctDesbaste: 0.02,
  flete: 0, plazoDias: PLAZOS_POR_DEFECTO.matarife,
})

chequear("🔑 Un canal a kilo vivo NO lleva rinde (regla: el rinde es sólo de Arrebeef)",
  CANUELAS.rinde === null && MATARIFE.rinde === null, "sin rinde")

chequear("Cañuelas: el desbaste sale de los kilos que se pagan",
  Math.abs(CANUELAS.kgQueSePagan - 5796.92) < 0.01, `${n2(CANUELAS.kgQueSePagan)} kg`)

// Bruto = 5.796,92 kg × $3.100 = $17.970.452. De ahí el 3,5 % y el 0,75 %, que son de DOS actores
// distintos —Sáenz Valiente y el propio frigorífico— y por eso se suman en vez de elegir el mayor.
chequear("La comisión y el gasto del destino se suman (son dos actores distintos)",
  Math.abs(CANUELAS.bruto - 17970452) < 1
  && Math.abs(CANUELAS.comision - 628965.82) < 0.01 && Math.abs(CANUELAS.gastos - 134778.39) < 0.01,
  `bruto ${n2(CANUELAS.bruto)} · comisión ${n2(CANUELAS.comision)} · gasto ${n2(CANUELAS.gastos)}`)

chequear("El matarife paga contra camión: plazo 0",
  MATARIFE.plazoDias === 0, `${MATARIFE.plazoDias} días`)

// ── La comparación ────────────────────────────────────────────────────────────────────────────
const c = compararCanales([CANUELAS, REAL, MATARIFE])

chequear("Ordena por lo que deja POR KILO VIVO, no por el bruto",
  c.canales.map((x: any) => x.nombre)[0] === c.mejor?.nombre
  && c.canales.every((x: any, i: number) => i === 0 || (x.porKgVivo ?? -1) <= (c.canales[i - 1].porKgVivo ?? -1)),
  c.canales.map((x: any) => `${x.nombre} $${n2(x.porKgVivo)}`).join(" · "))

chequear("Identifica cuál fue la venta que realmente se hizo",
  c.real?.nombre === "Arre Beef" && c.real?.origen === "real", `${c.real?.nombre}`)

chequear("Dice cuánto se ganó (o se dejó de ganar) contra el mejor rival",
  c.contraElMejor != null && c.contraElMejor.contra !== "Arre Beef",
  c.contraElMejor ? `${c.contraElMejor.diferencia > 0 ? "+" : ""}$${n2(c.contraElMejor.diferencia)} contra ${c.contraElMejor.contra}` : "—")

// ── 🔴 Los dos modos de mentir ────────────────────────────────────────────────────────────────
const SIN_PRECIO = canalHipotetico({ nombre: "Sin precio", kgVivoOrigen: KG_CAMPO, precioVivo: null, pctDesbaste: 0 })
const c2 = compararCanales([SIN_PRECIO, REAL])
chequear("🔴 Un canal al que le falta un dato NUNCA gana, y va al final",
  c2.mejor?.nombre === "Arre Beef" && c2.canales[c2.canales.length - 1].nombre === "Sin precio",
  `mejor: ${c2.mejor?.nombre}`)

chequear("Y dice qué le falta, en vez de mostrar un cero",
  /falta el precio/.test(SIN_PRECIO.faltantes[0] ?? "") && SIN_PRECIO.porKgVivo === null,
  SIN_PRECIO.faltantes[0] ?? "")

// 🔴 Dos haciendas distintas no se comparan
const OTRA = canalHipotetico({ nombre: "Otro peso", kgVivoOrigen: 6500, precioVivo: 3000, pctDesbaste: 0 })
const c3 = compararCanales([REAL, OTRA])
chequear("🔴 Si los canales no arrancan del mismo peso de origen, NO hay ganador",
  c3.mejor === null && c3.avisoVara != null, c3.avisoVara ?? "(sin aviso)")

chequear("Y el aviso dice los dos pesos, para poder arreglarlo",
  /6\.301/.test(c3.avisoVara ?? "") && /6\.500/.test(c3.avisoVara ?? ""), c3.avisoVara ?? "")

chequear("Con la vara rota tampoco se calcula la diferencia contra nadie",
  c3.contraElMejor === null, "null")

// ── El plazo ──────────────────────────────────────────────────────────────────────────────────
chequear("🔴 Con tasa 0 el plazo NO cambia ningún número (no se descuenta por mi cuenta)",
  valorPresente(1000000, 21, 0) === 1000000 && REAL.ingresaHoy === REAL.ingresa, "sin descontar")

chequear("Con una tasa puesta por el usuario, 21 días valen menos que contra camión",
  valorPresente(1000000, 21, 0.04) < 1000000 && valorPresente(1000000, 0, 0.04) === 1000000,
  `21 días al 4 % mensual → $${n2(valorPresente(1000000, 21, 0.04))}`)

chequear("Los plazos que dio el usuario están como default y son tres distintos",
  PLAZOS_POR_DEFECTO.arrebeef === 21 && PLAZOS_POR_DEFECTO.matarife === 0 && PLAZOS_POR_DEFECTO.canuelas === 21,
  `arrebeef ${PLAZOS_POR_DEFECTO.arrebeef} · matarife ${PLAZOS_POR_DEFECTO.matarife} · cañuelas ${PLAZOS_POR_DEFECTO.canuelas}`)

// Con tasa, el que cobra contra camión mejora su posición relativa: es justamente el efecto a ver.
{
  const conTasa = compararCanales([
    canalReal({ nombre: "Arre Beef", kgVivoOrigen: KG_CAMPO, kgCarne: 3354, importeLiquidado: 18750900, plazoDias: 21 }, 0.04),
    canalHipotetico({ nombre: "Matarife zonal", kgVivoOrigen: KG_CAMPO, precioVivo: 2900, pctDesbaste: 0.02, plazoDias: 0 }, 0.04),
  ])
  const sinTasa = compararCanales([REAL, MATARIFE])
  chequear("La tasa acerca al que cobra contra camión (por eso el plazo importa)",
    (conTasa.contraElMejor?.diferencia ?? 0) < (sinTasa.contraElMejor?.diferencia ?? 0),
    `sin tasa +$${n2(sinTasa.contraElMejor?.diferencia)} → con tasa +$${n2(conTasa.contraElMejor?.diferencia)}`)
}

console.log("\n── La comparación, con los números del 04/09 ──")
for (const x of c.canales) {
  console.log(`  ${x.nombre.padEnd(16)} $${n2(x.porKgVivo).padStart(10)} /kg vivo   ingresa $${n2(x.ingresaHoy).padStart(12)}`
    + `   ${x.rinde != null ? `rinde ${(x.rinde * 100).toFixed(2)} %` : `desbaste ${(x.pctDesbaste * 100).toFixed(2)} %`}`
    + (x.faltantes.length ? `   ⚠️ ${x.faltantes[0]}` : ""))
}
if (c.contraElMejor) {
  console.log(`\n  Contra ${c.contraElMejor.contra}: ${c.contraElMejor.diferencia > 0 ? "se ganó" : "se dejó de ganar"} `
    + `$${n2(Math.abs(c.contraElMejor.diferencia))} ($${n2(Math.abs(c.contraElMejor.porKgVivo))}/kg vivo)`)
}

console.log("")
for (const x of r) {
  console.log(`  ${x.ok ? "✓" : "✗"} ${x.caso}`)
  console.log(`      ${x.detalle}`)
}
const mal = r.filter(x => !x.ok).length
console.log(`\n${r.length - mal} de ${r.length} pasaron`)
console.log(`\n⚠️ Los precios de Cañuelas y del matarife son INVENTADOS para probar la cuenta.`)
console.log(`   Los de verdad los pone el usuario: «yo pongo precios según cómo yo creo que sucedería».`)
process.exit(mal ? 1 : 0)
