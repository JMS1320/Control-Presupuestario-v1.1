/**
 * `npm run probar:cinta` — la cinta de diagnóstico. Lógica pura, **no toca nada**.
 *
 * ## Qué vigila
 * La cinta es lo que convierte una nota del usuario en algo diagnosticable a distancia, y **tiene
 * dos formas de fallar en silencio, las dos ya vistas**:
 *
 * - **Llenarse de ruido.** Las 4 capturas de la nota «Romaneo Error» traían **sólo** un warning de
 *   accesibilidad de Radix. La señal estaba tapada por algo que no ayuda nunca (`A-BUG-113`).
 * - **Perder el corte.** La cinta se **entrega y se corta**: si una captura se llevara eventos que
 *   ya entregó otra, la nota mostraría lo mismo dos veces y parecería que el error se repitió.
 *
 * ⚠️ **El filtro de ruido se prueba por firma exacta**, no por categoría: apagar «todos los
 * warnings» perdería los que sí importan, y ése es justo el error que no se puede cometer acá.
 */
const B = process.cwd().split("\\").join("/")
const M = await import(`file:///${B}/lib/cinta-diagnostico.ts`)

const r: { ok: boolean; caso: string; detalle: string }[] = []
const chequear = (caso: string, ok: boolean, detalle: string) => r.push({ ok, caso, detalle })

// ── anotarResultado: lo que la app DECLARA ────────────────────────────────────────────────────
M.anotarResultado("romaneo", "9 líneas · 18 medias · 8 pág")
let cinta = M.mirarCinta()
const ultimo = cinta[cinta.length - 1]

chequear("Registra lo que la app declara, aunque no haya fallado nada",
  ultimo?.tipo === "res" && ultimo.msg.includes("9 líneas"), `${ultimo?.tipo} · ${ultimo?.msg ?? "—"}`)

chequear("La etiqueta va en «dónde», para saber qué terminó",
  ultimo?.donde === "romaneo", String(ultimo?.donde))

// ── mirarCinta no consume: se mira, y recién al guardar se corta ──────────────────────────────
const antes = M.mirarCinta().length
const otra = M.mirarCinta().length
chequear("Mirar la cinta NO la consume (dos miradas ven lo mismo)", antes === otra, `${antes} y ${otra}`)

M.confirmarCorte(antes)
chequear("Después del corte, lo entregado no vuelve a aparecer",
  M.mirarCinta().length === 0, `${M.mirarCinta().length} eventos`)

M.anotarResultado("boletas-arba", "63 PDF · 27 con partida")
chequear("Lo que pasa DESPUÉS del corte sí entra",
  M.mirarCinta().length === 1, `${M.mirarCinta().length} evento`)

// ── El anillo se pisa solo ────────────────────────────────────────────────────────────────────
M.reiniciarCorte()
for (let i = 0; i < 80; i++) M.anotarResultado("carga", `evento ${i}`)
cinta = M.mirarCinta()
chequear("El anillo no crece sin límite (50 eventos)", cinta.length === 50, `${cinta.length} eventos`)
chequear("Se pisan los VIEJOS: queda lo último, que es lo que interesa",
  cinta[cinta.length - 1].msg === "evento 79", cinta[cinta.length - 1].msg)

// ── El recorte de mensajes largos ─────────────────────────────────────────────────────────────
M.confirmarCorte(M.mirarCinta().length)
M.anotarResultado("x", "z".repeat(1000))
chequear("Un mensaje kilométrico se recorta (no engorda cada captura)",
  M.mirarCinta()[0].msg.length <= 300, `${M.mirarCinta()[0].msg.length} caracteres`)

// ── El filtro de ruido, por FIRMA ─────────────────────────────────────────────────────────────
const RUIDO = "Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}."
const fuente = (await import("node:fs")).readFileSync(`${B}/lib/cinta-diagnostico.ts`, "utf8")
const mRuido = fuente.match(/const RUIDO: RegExp\[\] = \[([\s\S]*?)\]/)
const patrones: RegExp[] = mRuido
  ? [...mRuido[1].matchAll(/\/(.+?)\/([a-z]*)/g)].map(x => new RegExp(x[1], x[2]))
  : []

chequear("Hay una lista de ruido declarada", patrones.length > 0, `${patrones.length} patrón(es)`)
chequear("🔇 Filtra el warning de Radix que tapó las 4 capturas de la nota",
  patrones.some(p => p.test(RUIDO)), patrones.some(p => p.test(RUIDO)) ? "filtrado" : "pasa")

// Lo que NO se puede filtrar: errores reales que se parecen de lejos.
const REALES = [
  "Warning: Each child in a list should have a unique key prop.",
  "violates foreign key constraint anticipos_proveedores_factura_id_fkey",
  "permission denied for table cargas",
  "Missing required parameter: carpeta_drive_id",
]
const tapados = REALES.filter(e => patrones.some(p => p.test(e)))
chequear("🔴 NO se lleva puesto ningún error real (se filtra por firma, no por categoría)",
  tapados.length === 0, tapados.length ? `tapa: ${tapados.join(" | ")}` : "ninguno tapado")

for (const x of r) {
  console.log(`  ${x.ok ? "✓" : "✗"} ${x.caso}`)
  console.log(`      ${x.detalle}`)
}
const mal = r.filter(x => !x.ok).length
console.log(`\n${r.length - mal} de ${r.length} pasaron`)
process.exit(mal ? 1 : 0)
