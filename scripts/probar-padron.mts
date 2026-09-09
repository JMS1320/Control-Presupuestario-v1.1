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

// ── 📋 Templates — el padrón lo declara el template mismo ─────────────────────────────────────
const tpl = P.padronTemplates([
  { id: "t1", nombre: "Inmobiliario Casco", cuotas: 4, cuotasCargadas: 3, montoTipico: 1_362_096, responsable: "PAM" },
  { id: "t2", nombre: "Inmobiliario Lima", cuotas: 4, cuotasCargadas: 4, montoTipico: 810_725, responsable: "MA" },
  { id: "t3", nombre: "Comisiones bancarias", cuotas: 0, cuotasCargadas: 2, montoTipico: 5_000 },
  { id: "t4", nombre: "Seguro flota", cuotas: 12, cuotasCargadas: 9, montoTipico: 200_000 },
])

chequear("Detecta el template al que le falta una cuota",
  tpl.huecos.some((h: any) => /Casco/.test(h.que)), tpl.huecos.map((h: any) => h.que).join(" · "))

chequear("Estima la plata por lo que FALTA, no por el total del año",
  tpl.huecos.find((h: any) => /Casco/.test(h.que))?.plata === 1_362_096,
  $(tpl.huecos.find((h: any) => /Casco/.test(h.que))?.plata))

chequear("Tres cuotas faltantes valen tres veces",
  tpl.huecos.find((h: any) => /Seguro/.test(h.que))?.plata === 600_000,
  $(tpl.huecos.find((h: any) => /Seguro/.test(h.que))?.plata))

chequear("🔴 Un gasto ABIERTO (sin cuotas fijas) no tiene padrón y NO es un hueco",
  !tpl.huecos.some((h: any) => /Comisiones/.test(h.que)), "queda afuera")

chequear("El completo no aparece", !tpl.huecos.some((h: any) => /Lima/.test(h.que)), "Lima afuera")

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
// 5 huecos: 2 de hacienda (CUT y vaquillonas) + 2 de templates (Casco y Seguro) + 1 de cuentas.
const m = P.marcador(todos, HOY)

chequear("Cuenta los abiertos y suma su plata",
  m.abiertos === 5 && m.plata === 180_200_000 + 42_000_000 + 1_362_096 + 600_000 + 4_000_000,
  `${m.abiertos} abiertos · ${$(m.plata)}`)

chequear("🔴 Con huecos abiertos, NO está cerrado", m.cerrado === false, "no cerrado")

// «A propósito» — la pieza sin la cual nunca llega a cero
{
  const conMarca = todos.map((h: any) => /CUT/.test(h.que)
    ? { ...h, estado: "a_proposito", venceEl: "2026-12-31", motivo: "se venden el año que viene" } : h)
  const m2 = P.marcador(conMarca, HOY)
  chequear("Marcar a propósito lo saca del marcador",
    m2.abiertos === 4 && m2.aProposito === 1, `${m2.abiertos} abiertos · ${m2.aProposito} a propósito`)
  chequear("Y le saca la plata: si no, el número nunca baja",
    m2.plata === m.plata - 180_200_000, $(m2.plata))
}

// 🔴 El vencimiento — lo que impide que el tablero se apague solo
{
  const vencida = todos.map((h: any) => /CUT/.test(h.que)
    ? { ...h, estado: "a_proposito", venceEl: "2026-06-30", motivo: "no se venden" } : h)
  const m3 = P.marcador(vencida, HOY)
  chequear("🔴 Una decisión VENCIDA vuelve a contar como abierta",
    m3.abiertos === 5 && m3.vencidos === 1, `${m3.abiertos} abiertos · ${m3.vencidos} vencido(s)`)
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
