/**
 * `npm run probar:arba-casar` — las DECISIONES sobre una boleta de ARBA. **No toca nada.**
 *
 * ## Por qué éste importa
 * 🔴 Acá se decide **si una boleta puede pisar el monto de una cuota del presupuesto**. La regla del
 * usuario es explícita —*«no reemplazar los templates, ya que yo debo ver y decidir»*— así que lo que
 * se prueba no es sólo que la cuenta dé: es que **nada se proponga solo cuando no corresponde**.
 *
 * El caso peligroso no es el que falla ruidosamente: es una cuota **ya conciliada** que se propone
 * tildada y pisa un pago que ya ocurrió.
 */
const B = process.cwd().split("\\").join("/")
const L = await import(`file:///${B}/lib/arba/casar-boleta.ts`)
const { decidirAplicar, controlDosCaminos, huellaBoleta, aMonto } = L

const r: { ok: boolean; caso: string; detalle: string }[] = []
const chequear = (caso: string, ok: boolean, detalle: string) => r.push({ ok, caso, detalle })

// Números reales: Casco cuota 1 = $1.198.244,20 en los dos lados (`KNOWLEDGE.md` § partidas).
const CASCO = 1198244.20
const PROY = { monto: 1050000, estado: "proyectado" }

// ── Cuándo se propone ─────────────────────────────────────────────────────────────────────────
chequear("Si difiere y está proyectada, se propone",
  decidirAplicar(PROY, CASCO, 1).aplicar === true, `${PROY.monto} vs ${CASCO}`)

chequear("Si ya coincide, no se propone nada (no hay qué cambiar)",
  decidirAplicar({ monto: CASCO, estado: "proyectado" }, CASCO, 1).aplicar === false, "coincide")

chequear("Un centavo de redondeo no dispara una propuesta (tolerancia $1)",
  decidirAplicar({ monto: CASCO + 0.4, estado: "proyectado" }, CASCO, 1).aplicar === false, "tolera")

// 🔴 El caso caro
const conc = decidirAplicar({ monto: 900000, estado: "conciliado" }, CASCO, 1)
chequear("🔴 Una cuota CONCILIADA no se propone nunca: ya se pagó por ese importe",
  conc.aplicar === false, `aplicar=${conc.aplicar}`)

chequear("Y avisa por qué, en vez de quedarse callada",
  /revisá antes de tocarla/.test(conc.problema ?? ""), conc.problema ?? "(sin aviso)")

chequear("Una conciliada que YA coincide no genera ni aviso (no hay nada raro)",
  decidirAplicar({ monto: CASCO, estado: "conciliado" }, CASCO, 1).problema === null, "sin ruido")

// ── Los que no se pueden decidir ──────────────────────────────────────────────────────────────
chequear("Una boleta ANUAL no corresponde a una cuota puntual",
  /anual/.test(decidirAplicar(PROY, CASCO, null).problema ?? ""), decidirAplicar(PROY, CASCO, null).problema ?? "")

chequear("Si el template no tiene esa cuota, lo dice con el número",
  /cuota 3/.test(decidirAplicar(null, CASCO, 3).problema ?? ""), decidirAplicar(null, CASCO, 3).problema ?? "")

chequear("Sin importe legible invita a escribirlo, no se planta",
  /escribilo a mano/.test(decidirAplicar(PROY, null, 1).problema ?? ""), decidirAplicar(PROY, null, 1).problema ?? "")

// ── 🔁 El mismo número por dos caminos ────────────────────────────────────────────────────────
chequear("Mail y PDF de acuerdo: cierra",
  controlDosCaminos(CASCO, CASCO).cierra === true && controlDosCaminos(CASCO, CASCO).estado === "coincide", "coincide")

const dif = controlDosCaminos(CASCO, 1100000)
chequear("🔴 Si NO coinciden, no cierra y dice cuánto",
  dif.estado === "difiere" && !dif.cierra && Math.abs((dif.diferencia ?? 0) - 98244.2) < 0.01, `${dif.diferencia}`)

chequear("Y no elige ninguno de los dos en silencio",
  /mirá cuál es el bueno/.test(dif.detalle), dif.detalle)

chequear("Una boleta subida a mano (sin mail) no se marca como error",
  controlDosCaminos(CASCO, null).estado === "sin_mail", controlDosCaminos(CASCO, null).detalle)

chequear("Si el PDF no dio importe pero el mail sí, se dice cuál falta",
  controlDosCaminos(null, CASCO).estado === "sin_pdf" && /el PDF no dio importe/.test(controlDosCaminos(null, CASCO).detalle), "sí")

chequear("Diferencia de un centavo entre mail y PDF: cierra igual",
  controlDosCaminos(CASCO, CASCO - 0.3).cierra === true, "tolera")

// ── 🐾 La huella ──────────────────────────────────────────────────────────────────────────────
const h1 = huellaBoleta({ importe: 1100000, partida: null }, { importe: CASCO, partida: "099-006595-0" })
chequear("Guarda las DOS puntas: lo leído y lo puesto",
  h1.importe?.leido === 1100000 && h1.importe?.puesto === CASCO, JSON.stringify(h1.importe))

chequear("Registra también la partida que el PDF no traía y aportó el mail",
  h1.partida?.leido === null && h1.partida?.puesto === "099-006595-0", JSON.stringify(h1.partida))

chequear("🔴 Lo que NO cambió no entra (si no, la huella es ruido y no se puede consultar)",
  Object.keys(huellaBoleta({ importe: CASCO }, { importe: CASCO })).length === 0, "vacía")

chequear("Medio centavo no es una corrección",
  Object.keys(huellaBoleta({ importe: CASCO }, { importe: CASCO + 0.004 })).length === 0, "vacía")

// ── El monto escrito a mano, en es-AR ─────────────────────────────────────────────────────────
chequear("Lee un monto tipeado a la argentina", aMonto("1.198.244,20") === CASCO, `${aMonto("1.198.244,20")}`)
chequear("Campo vacío significa «usá el del PDF», no cero", aMonto("") === null && aMonto("   ") === null, "null")
chequear("Un texto que no es número no se toma como 0", aMonto("mil pesos") === null, "null")

for (const x of r) {
  console.log(`  ${x.ok ? "✓" : "✗"} ${x.caso}`)
  console.log(`      ${x.detalle}`)
}
const mal = r.filter(x => !x.ok).length
console.log(`\n${r.length - mal} de ${r.length} pasaron`)
process.exit(mal ? 1 : 0)
