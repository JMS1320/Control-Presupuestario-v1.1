/**
 * `npm run probar:padron` — el detector de lo que falta en el presupuesto. **No toca nada.**
 *
 * ## Las tres maneras en que esto puede mentir
 * Un detector de ausencias es peligroso justamente porque **cuando falla, no se nota**:
 *
 * 🔴 **Falso negativo** — no ve un hueco que existe. El presupuesto sale más chico de lo que va a
 *    ser y todo lo demás cuadra. Es el peor.
 * 🔴 **Falso positivo** — inventa huecos donde no los hay. Enseña a ignorar el tablero, y a partir
 *    de ahí ya no sirve para nada aunque acierte.
 * 🔴 **El marcador que llega a cero solo** — si «a propósito» no vence, la primera tanda de marcas
 *    apaga el tablero para siempre y nadie se entera.
 */
const B = process.cwd().split("\\").join("/")
const P = await import(`file:///${B}/lib/presupuesto/padron.ts`)

const r: { ok: boolean; caso: string; detalle: string }[] = []
const chequear = (caso: string, ok: boolean, detalle: string) => r.push({ ok, caso, detalle })
const $ = (n: number | null) => n == null ? "—" : `$${n.toLocaleString("es-AR")}`
const HOY = new Date("2026-09-09T12:00:00")

// ── 🐄 Hacienda — el caso que nombró el usuario ───────────────────────────────────────────────
const hac = P.padronHacienda([
  { categoria: "Vacas CUT", existencia: 340, conVenta: 0, precioPorCabeza: 530_000 },
  { categoria: "Novillos", existencia: 120, conVenta: 120, precioPorCabeza: 900_000 },
  { categoria: "Vaquillonas", existencia: 80, conVenta: 20, precioPorCabeza: 700_000 },
  { categoria: "Toros", existencia: 3, conVenta: 3, precioPorCabeza: null },
])

chequear("🔴 Ve las 340 vacas CUT sin venta — el hueco que ninguna pantalla mostraba",
  hac.huecos.some((h: any) => h.que === "340 Vacas CUT"), hac.huecos.map((h: any) => h.que).join(" · "))

chequear("Y lo valoriza, para poder priorizarlo",
  hac.huecos.find((h: any) => /Vacas CUT/.test(h.que))?.plata === 180_200_000,
  $(hac.huecos.find((h: any) => /Vacas CUT/.test(h.que))?.plata))

chequear("🔴 Lo que SÍ está vendido no genera hueco (si no, el tablero es ruido)",
  !hac.huecos.some((h: any) => /Novillos|Toros/.test(h.que)), "novillos y toros afuera")

chequear("Una categoría vendida a MEDIAS deja hueco sólo por lo que falta",
  hac.huecos.find((h: any) => /Vaquillonas/.test(h.que))?.que === "60 Vaquillonas",
  hac.huecos.find((h: any) => /Vaquillonas/.test(h.que))?.que ?? "(no está)")

chequear("Dice POR QUÉ cree que falta, para poder discutirlo",
  /existen 340 y ninguna tiene venta/.test(hac.huecos.find((h: any) => /CUT/.test(h.que))?.porque ?? ""),
  hac.huecos.find((h: any) => /CUT/.test(h.que))?.porque ?? "")

// ── 📋 Templates — ¿el presupuesto PUEDE proyectarlo? ─────────────────────────────────────────
// ⚠️ Esta pregunta cambió el 2026-09-10 (A-FEAT-127). Antes era «¿están todas las cuotas?» y
//    estaba mal de raíz: `MODULO_TEMPLATES.md` § 13 decidió el 22/08 que **no se generan campañas
//    futuras para alimentar el presupuesto**, porque una cuota estimada lejana PISA la proyección
//    con un estimado peor y el resto del sistema la lee como compromiso firme. Faltar cuotas en
//    los meses lejanos es lo correcto y lo buscado.
const V24 = { meses: 24, desde: "2026-09", hasta: "2028-08" }
const tpl = P.padronTemplates([
  // El caso real que lo destapó: 2 cuotas cargadas, el resto proyectado. NO es un hueco.
  { id: "t1", nombre: "Retiro MA mensual", mesesSinPoderProyectar: 0, mesesDelPeriodo: 24, montoTipico: 4_000_000, responsable: "MA" },
  // Un template nuevo, sin una sola cuota nunca: el presupuesto no tiene de dónde sacar el número.
  { id: "t2", nombre: "Seguro galpón nuevo", mesesSinPoderProyectar: 24, mesesDelPeriodo: 24, montoTipico: null },
  // Uno al que le falta parte del período.
  { id: "t3", nombre: "Tasa vial", mesesSinPoderProyectar: 6, mesesDelPeriodo: 24, montoTipico: 150_000, responsable: "PAM", causa: "sin_historia" },
  // 🔴 El caso REAL medido el 2026-09-10: el vencimiento está cargado y el monto quedó en $0.
  //    Es hueco igual, pero se arregla distinto — y decirlo mal manda al usuario a crear una
  //    cuota que ya existe.
  { id: "t4", nombre: "Imp Automotores Gol 2012 Anual", mesesSinPoderProyectar: 24, mesesDelPeriodo: 24, montoTipico: null, causa: "sin_monto", cuotasCargadas: 1 },
], V24)

chequear("🔴 Un template con cuotas viejas y el resto PROYECTADO no es un hueco",
  !tpl.huecos.some((h: any) => /Retiro MA/.test(h.que)),
  "faltar cuotas lejanas es lo correcto — MODULO_TEMPLATES § 13")

chequear("🔴 Sí lo es el que NO SE PUEDE proyectar por falta de historia",
  tpl.huecos.some((h: any) => /Seguro galpón/.test(h.que)),
  tpl.huecos.map((h: any) => h.que).join(" · "))

chequear("La pregunta del dominio cambió: ya no habla de cuotas",
  tpl.pregunta === "¿Hay algún gasto que el presupuesto no pueda proyectar?", tpl.pregunta)

chequear("🔴 Sin historia NO se inventa la plata: se declara que no se pudo valorizar",
  tpl.huecos.find((h: any) => /Seguro galpón/.test(h.que))?.plata === null,
  "plata = " + String(tpl.huecos.find((h: any) => /Seguro galpón/.test(h.que))?.plata))

chequear("Con monto típico sí la estima, y por los meses que faltan",
  tpl.huecos.find((h: any) => /Tasa vial/.test(h.que))?.plata === 900_000,
  $(tpl.huecos.find((h: any) => /Tasa vial/.test(h.que))?.plata))

chequear("🗣️ El porqué dice CUÁNTOS meses y de QUÉ ventana (A-BUG-133)",
  /6 de los 24 meses de sep 26 – ago 28/.test(
    tpl.huecos.find((h: any) => /Tasa vial/.test(h.que))?.porque ?? ""),
  tpl.huecos.find((h: any) => /Tasa vial/.test(h.que))?.porque ?? "")

chequear("🔴 «Falta el monto» y «falta la cuota» NO se dicen igual: la acción es distinta",
  /1 cuota\(s\) cargada\(s\) pero todas en \$0/.test(
    tpl.huecos.find((h: any) => /Gol 2012/.test(h.que))?.porque ?? ""),
  tpl.huecos.find((h: any) => /Gol 2012/.test(h.que))?.porque ?? "")

chequear("Y el que no tiene ninguna dice que no tiene ninguna",
  /no tiene ninguna cuota cargada/.test(
    tpl.huecos.find((h: any) => /Seguro galpón/.test(h.que))?.porque ?? ""),
  tpl.huecos.find((h: any) => /Seguro galpón/.test(h.que))?.porque ?? "")

// ── 💸 Cuentas — el hueco más silencioso ──────────────────────────────────────────────────────
const cta = P.padronCuentas([
  { nro: "4.1.3", nombre: "Gasoil", gastoAnterior: 4_000_000, presupuestado: 0, excluida: false },
  { nro: "4.1.4", nombre: "Repuestos", gastoAnterior: 900_000, presupuestado: 950_000, excluida: false },
  { nro: "4.2.1", nombre: "Sanidad", gastoAnterior: 2_000_000, presupuestado: 0, excluida: true },
  { nro: "4.9.9", nombre: "Varios", gastoAnterior: 1_200, presupuestado: 0, excluida: false },
], 10_000)

chequear("Ve la cuenta que gastó el año pasado y hoy está en cero",
  cta.huecos.some((h: any) => /Gasoil/.test(h.que)), cta.huecos.map((h: any) => h.que).join(" · "))

chequear("🔴 Una cuenta EXCLUIDA a propósito no es un hueco (ya entra por otro lado)",
  !cta.huecos.some((h: any) => /Sanidad/.test(h.que)), "Sanidad afuera")

chequear("Y lo insignificante no ensucia el tablero",
  !cta.huecos.some((h: any) => /Varios/.test(h.que)), "$1.200 no entra")

// ── 🎯 El marcador ────────────────────────────────────────────────────────────────────────────
const todos = [...hac.huecos, ...tpl.huecos, ...cta.huecos]
// 6 huecos: 2 de hacienda (CUT y vaquillonas) + 3 de templates + 1 de cuentas.
// 🔑 Uno de los de templates (Seguro galpón) va SIN PLATA a propósito: sin historia no hay de
//    dónde estimarla. Por eso este caso también prueba que el marcador **no lo cuenta como cero**.
const m = P.marcador(todos, HOY)

chequear("Cuenta los abiertos y suma su plata",
  m.abiertos === 6 && m.plata === 180_200_000 + 42_000_000 + 900_000 + 4_000_000,
  `${m.abiertos} abiertos · ${$(m.plata)} · ${m.sinValorizar} sin valorizar`)

chequear("🔴 Los huecos sin valorizar se cuentan como HUECOS pero no como $0",
  m.abiertos === 6 && m.sinValorizar === 2,
  `${m.sinValorizar} sin poder valorizar — el total de plata es un piso, no la cifra completa`)

chequear("🔴 Con huecos abiertos, NO está cerrado", m.cerrado === false, "no cerrado")

// «A propósito» — la pieza sin la cual nunca llega a cero
{
  const conMarca = todos.map((h: any) => /CUT/.test(h.que)
    ? { ...h, estado: "a_proposito", venceEl: "2026-12-31", motivo: "se venden el año que viene" } : h)
  const m2 = P.marcador(conMarca, HOY)
  chequear("Marcar a propósito lo saca del marcador",
    m2.abiertos === 5 && m2.aProposito === 1, `${m2.abiertos} abiertos · ${m2.aProposito} a propósito`)
  chequear("Y le saca la plata: si no, el número nunca baja",
    m2.plata === m.plata - 180_200_000, $(m2.plata))
}

// 🔴 El vencimiento — lo que impide que el tablero se apague solo
{
  const vencida = todos.map((h: any) => /CUT/.test(h.que)
    ? { ...h, estado: "a_proposito", venceEl: "2026-06-30", motivo: "no se venden" } : h)
  const m3 = P.marcador(vencida, HOY)
  chequear("🔴 Una decisión VENCIDA vuelve a contar como abierta",
    m3.abiertos === 6 && m3.vencidos === 1, `${m3.abiertos} abiertos · ${m3.vencidos} vencido(s)`)
  chequear("Un «a propósito» SIN fecha se toma por vencido: una marca eterna es un olvido con permiso",
    P.marcador([{ ...todos[0], estado: "a_proposito", venceEl: null }], HOY).abiertos === 1, "cuenta igual")
}

chequear("«Todavía no» no cuenta como error — no depende del usuario",
  (() => { const x = P.marcador([{ ...todos[0], estado: "todavia_no" }], HOY)
    return x.abiertos === 0 && x.todaviaNo === 1 && x.cerrado === true })(), "no es error")

chequear("🔴 Un hueco sin valorizar NO se cuenta como cero: se dice cuántos son",
  (() => { const x = P.marcador([{ ...todos[0], plata: null }], HOY)
    return x.abiertos === 1 && x.plata === 0 && x.sinValorizar === 1 })(),
  "el total de plata es un piso, no la cifra completa")

// ── El orden: primero lo que más mueve ────────────────────────────────────────────────────────
const orden = P.porPrioridad(todos, HOY)
chequear("Ordena por plata: primero las vacas CUT",
  /CUT/.test(orden[0].que), `${orden[0].que} — ${$(orden[0].plata)}`)

chequear("Los que no se pudieron valorizar van al final, pero NO se esconden",
  (() => { const con = [...todos, { ...todos[0], clave: "x", que: "Sin monto", plata: null }]
    const o = P.porPrioridad(con, HOY)
    return o[o.length - 1].que === "Sin monto" && o.length === con.length })(), "último, pero está")

// ── El tablero completo ───────────────────────────────────────────────────────────────────────
const t = P.tablero([hac, tpl, cta], HOY)
chequear("El tablero junta los tres dominios y cada uno lleva su marcador",
  t.padrones.length === 3 && t.padrones.every((p: any) => p.marcador),
  t.padrones.map((p: any) => `${p.dominio}: ${p.marcador.abiertos}`).join(" · "))

chequear("Cada dominio se nombra con LA PREGUNTA, no con el módulo",
  t.padrones.every((p: any) => p.pregunta.includes("¿")),
  t.padrones.map((p: any) => p.pregunta).join(" | ").slice(0, 90) + "…")

console.log("\n── El tablero, con datos de ejemplo ──\n")
console.log(`  ${m.abiertos} huecos abiertos · ${$(m.plata)} sin cubrir`
  + (m.sinValorizar ? ` · ${m.sinValorizar} sin valorizar` : ""))
for (const h of orden.slice(0, 6)) {
  console.log(`     ${$(h.plata).padStart(14)}  ${h.que.padEnd(26)} ${h.porque}`)
}

console.log("")
for (const x of r) {
  console.log(`  ${x.ok ? "✓" : "✗"} ${x.caso}`)
  console.log(`      ${x.detalle}`)
}
const mal = r.filter(x => !x.ok).length
console.log(`\n${r.length - mal} de ${r.length} pasaron`)
process.exit(mal ? 1 : 0)
