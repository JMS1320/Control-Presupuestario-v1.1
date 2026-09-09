/**
 * `npm run probar:recorrido` — la máquina del viaje. **No toca nada.**
 *
 * ## Qué se rompe acá, y no se nota
 * 🔴 **Que el «siguiente» te lleve a algo que ya resolviste.** Es el que hace sentir que el
 *    recorrido está roto, y con razón: uno acaba de arreglarlo y la app se lo vuelve a pedir.
 * 🔴 **Que el avance se desincronice.** Si el contador fuera propio, resolver algo desde otra
 *    pantalla lo dejaría contando de más — y el recorrido diría que falta lo que ya está.
 * 🔴 **Que el viaje se pierda al cambiar de solapa.** Es el motivo de que el estado viva en un
 *    módulo y no adentro del Presupuesto: la solapa se desmonta al navegar.
 */
const B = process.cwd().split("\\").join("/")
// `window` no existe en Node y la máquina publica eventos: se le da uno mínimo que los junta,
// para poder verificar QUE SE PIDIÓ IR, que es la mitad del comportamiento.
const eventos: { tipo: string; detalle?: unknown }[] = []
;(globalThis as any).window = {
  dispatchEvent: (e: { type: string; detail?: unknown }) => { eventos.push({ tipo: e.type, detalle: e.detail }); return true },
  addEventListener: () => {}, removeEventListener: () => {},
}
;(globalThis as any).CustomEvent = class { type: string; detail: unknown
  constructor(t: string, o?: { detail?: unknown }) { this.type = t; this.detail = o?.detail } }

const R = await import(`file:///${B}/lib/recorrido/recorrido.ts`)

const r: { ok: boolean; caso: string; detalle: string }[] = []
const chequear = (caso: string, ok: boolean, detalle: string) => r.push({ ok, caso, detalle })

const hueco = (clave: string, dominio: string, plata: number, estado = "abierto") => ({
  dominio, clave, que: clave, porque: "…", plata, estado,
  donde: { pantalla: "X" },
}) as never

const HUECOS = [
  hueco("hacienda:CUT", "hacienda", 180_000_000),
  hueco("template:t1", "templates", 1_300_000),
  hueco("cuenta:4.1.3", "cuentas", 900_000),
]

const abierto = (h: { estado: string }) => h.estado === "abierto"

// ── Arrancar ──────────────────────────────────────────────────────────────────────────────────
R.arrancar(HUECOS)
chequear("Arranca en el tablero, sin meterte en ninguno todavía",
  R.mirar().activo && R.mirar().indice === -1, `indice ${R.mirar().indice}`)

chequear("El avance arranca en cero y suma toda la plata",
  (() => { const a = R.avance(abierto)
    return a.hechos === 0 && a.total === 3 && a.faltaPlata === 182_200_000 })(),
  `${R.avance(abierto).hechos}/${R.avance(abierto).total} · falta ${R.avance(abierto).faltaPlata.toLocaleString("es-AR")}`)

// ── Siguiente, y que TE LLEVE ─────────────────────────────────────────────────────────────────
eventos.length = 0
R.siguiente(abierto)
chequear("«Siguiente» entra al primero", R.avance(abierto).posicion === 1, `paso ${R.avance(abierto).posicion}`)

chequear("🔗 Y pide ir a la sección que corresponde",
  eventos.some(e => e.tipo === R.EVENTO_IR && e.detalle === "presupuesto"),
  eventos.map(e => `${e.tipo}=${e.detalle}`).join(" · "))

eventos.length = 0
R.siguiente(abierto)
chequear("Un hueco de templates lleva a Egresos, no al Presupuesto",
  eventos.some(e => e.detalle === "egresos"), String(eventos.find(e => e.tipo === R.EVENTO_IR)?.detalle))

// ── 🔴 El que rompe la sensación de recorrido ─────────────────────────────────────────────────
{
  // Se resuelve el tercero MIENTRAS caminás — como pasaría al cargarlo desde otra pantalla.
  const resuelto = (clave: string) => HUECOS.map((h: never) =>
    (h as { clave: string }).clave === clave ? { ...(h as object), estado: "a_proposito", venceEl: "2027-01-01" } : h)
  R.refrescar(resuelto("cuenta:4.1.3") as never)
  R.siguiente(abierto)
  chequear("🔴 «Siguiente» SALTEA lo que ya se resolvió — no te lo vuelve a pedir",
    R.avance(abierto).hueco?.clave !== "cuenta:4.1.3", String(R.avance(abierto).hueco?.clave))

  // 🔴 El caso que encontró un defecto de diseño: caminar hasta el final salteando cosas.
  chequear("🔴 Y si no queda nada adelante, VUELVE AL PRINCIPIO en vez de decir que terminaste",
    R.avance(abierto).hueco?.clave === "hacienda:CUT" && !R.avance(abierto).terminado,
    `volvió a ${R.avance(abierto).hueco?.clave}`)

  chequear("El avance cuenta lo hecho sin contador propio: 1 de 3",
    (() => { const a = R.avance(abierto); return a.hechos === 1 && a.faltaPlata === 181_300_000 })(),
    `${R.avance(abierto).hechos} de ${R.avance(abierto).total} · falta ${R.avance(abierto).faltaPlata.toLocaleString("es-AR")}`)

  // Recién con TODOS resueltos se declara terminado.
  R.refrescar(HUECOS.map((h: never) => ({ ...(h as object), estado: "a_proposito", venceEl: "2027-01-01" })) as never)
  R.siguiente(abierto)
  chequear("Con todos resueltos SÍ termina, y no da vueltas en el vacío",
    R.avance(abierto).terminado === true && R.avance(abierto).hueco === null,
    `${R.avance(abierto).hechos} de ${R.avance(abierto).total}`)
}

// ── Refrescar sin perder dónde estabas ────────────────────────────────────────────────────────
{
  R.arrancar(HUECOS)
  R.siguiente(abierto); R.siguiente(abierto)
  const antes = R.avance(abierto).hueco
  R.refrescar([...HUECOS])
  chequear("Recalcular el tablero NO te mueve de lugar",
    R.avance(abierto).hueco?.clave === antes?.clave, String(R.avance(abierto).hueco?.clave))
}

// ── Volver al tablero ─────────────────────────────────────────────────────────────────────────
eventos.length = 0
R.alTablero()
chequear("Volver al tablero te lleva al Presupuesto",
  eventos.some(e => e.tipo === R.EVENTO_IR && e.detalle === "presupuesto"), "va")

chequear("🔴 Y avisa que hay que RECALCULAR — si no, el hueco resuelto seguiría ahí",
  eventos.some(e => e.tipo === R.EVENTO_VOLVI),
  eventos.map(e => e.tipo).join(" · "))

chequear("Volver no corta el viaje", R.mirar().activo === true && R.mirar().indice === -1, "sigue activo")

// ── Terminar ──────────────────────────────────────────────────────────────────────────────────
R.terminar()
chequear("Terminar apaga la barra", R.mirar().activo === false, "apagado")

chequear("Refrescar con el viaje apagado no lo revive (evita una barra fantasma)",
  (() => { R.refrescar(HUECOS); return R.mirar().activo === false })(), "sigue apagado")

for (const x of r) {
  console.log(`  ${x.ok ? "✓" : "✗"} ${x.caso}`)
  console.log(`      ${x.detalle}`)
}
const mal = r.filter(x => !x.ok).length
console.log(`\n${r.length - mal} de ${r.length} pasaron`)
process.exit(mal ? 1 : 0)
