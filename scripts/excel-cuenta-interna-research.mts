/**
 * 🔎 Papel ANEXO — research de la CUENTA INTERNA (balance real por socio), ejercicio 25/26. SÓLO LEE. → A-FEAT-1288
 *
 *     npx tsx scripts/excel-cuenta-interna-research.mts
 *
 * JMS 14/11: «por contable se hace todo un estudio para ir a las cuentas y por interno se hace un estudio que tiene algunas
 * diferencias… las cuentas de contable van a contable y las cuentas de interno van al balance real» · «interno afecta a todas
 * las cuentas interempresa» · «en los históricos contable e interno quedó vacío, pero en las notas está» · «podés armar algún
 * papel anexo para dejar registrado tu research y simulaciones… propuesta… alternativas». Nada se escribe en la base.
 *
 * Solapas: Qué entendí · Inventario interno · Columna vs nota · Simulación por socio · Diferencias (movimiento por movimiento) ·
 * Alternativas de códigos · Control.
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { fechasReales } from "../lib/excel/fechas-reales"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"
import { agregarHoja } from "../lib/balance/export-libro-diario"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DESDE = "2025-07-01", HASTA = "2026-06-30", HOY = "2026-11-14"
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const r2 = (x: number) => Math.round(x * 100) / 100
const desde = (schema: string, tabla: string) => (schema === "public" ? sb.from(tabla) : sb.schema(schema).from(tabla))
async function todo(q: (d: number, h: number) => any): Promise<any[]> {
  const out: any[] = []
  for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break }
  return out
}

// ── La marca efectiva: la columna; si está vacía, lo que dice la nota del histórico («tu planilla: CATEG X · Contable Y · Interno Z»)
const deNota = (nota: string, campo: "Contable" | "Interno") => {
  const m = nota.match(/tu planilla:[^\n]*/i)?.[0] ?? ""
  return (m.match(new RegExp(`${campo} ([^·\\n»]+)`, "i"))?.[1] ?? "").trim()
}
const norm = (x: string) => x.toUpperCase().replace(/\s+/g, " ").replace(/^DI?STRI? /, "DIST ").replace(/^(\w+) CTA$/, "CTA $1").replace(/^CUENTA /, "CTA ").trim()

// ── De un código, a quién apunta y de qué tipo es
type Destino = { tipo: "CTA" | "DIST" | "RET" | "AP" | "LIB" | "GASTO" | "DESGLOSAR" | "VER" | "OTRO"; quien: string } | null
const QUIENES: Record<string, string> = { MA: "MA", MAMA: "MA", PAM: "PAM", JMS: "JMS", JOSE: "JMS", AMS: "AMS", ANDRES: "AMS", MSA: "MSA", COTITULARES: "COTITULARES", COTIT: "COTITULARES", MECHI: "MECHI", FLIA: "FLIA" }
function destino(codigo: string): Destino {
  const x = norm(codigo); if (!x) return null
  let r: RegExpMatchArray | null
  if ((r = x.match(/^(CTA|DIST|RET\s*[0-9I]*)\s+(\w+)/))) { const q = QUIENES[r[2]] ?? r[2]; return { tipo: r[1].startsWith("RET") ? "RET" : (r[1] as "CTA" | "DIST"), quien: q } }
  if (/^AP\b/.test(x)) return { tipo: "AP", quien: x.split(" ").at(-1)! }
  if (/^LIB/.test(x)) return { tipo: "LIB", quien: "LIB" }
  if (/^GASTO (\w+)/.test(x)) return { tipo: "GASTO", quien: x.split(" ")[1] }
  if (/^DESGLOS/.test(x)) return { tipo: "DESGLOSAR", quien: "a repartir" }
  if (/^(X|VER)$/.test(x)) return { tipo: "VER", quien: "?" }
  return { tipo: "OTRO", quien: x }
}
// MSA > PAM > MA > Cotitulares: una transferencia entre dos cuentas de la app se cuenta UNA vez, del lado de más arriba (esquema 06/11, punto 4)
const RANGO: Record<string, number> = { MSA: 1, PAM: 2, MA: 3, COTITULARES: 4 }
const esEspejo = (titular: string, d: Destino) => !!d && (d.tipo === "CTA" || d.tipo === "DIST") && (RANGO[d.quien] ?? 99) < (RANGO[titular.toUpperCase()] ?? 99)

type Mov = { tabla: string; cuenta: string; titular: string; usd: boolean; fecha: string; desc: string; detalle: string; deb: number; cred: number; categ: string
  cCol: string; iCol: string; cNota: string; iNota: string; c: string; i: string; nota: string; id: string }
const movs: Mov[] = []
const control: unknown[][] = [["Cuenta", "Tabla", "Titular", "Movimientos 25/26 (conteo directo)", "Leídos", "Con contable o interno (columna o nota)", "Estado"]]
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const c1 = await desde(t.schema, t.tabla).select("*", { count: "exact", head: true }).gte("fecha", DESDE).lte("fecha", HASTA)
  let filas: any[] = []
  try { filas = await todo((d, h) => desde(t.schema, t.tabla).select("*").gte("fecha", DESDE).lte("fecha", HASTA).order("id").range(d, h)) } catch (e: any) { control.push([t.cuenta, `${t.schema}.${t.tabla}`, t.titular, c1.count, 0, 0, `🔴 ${e.message}`]); continue }
  let marcados = 0
  for (const m of filas) {
    if (!("contable" in m) && !("interno" in m)) continue
    const nota = String(m.nota_operador ?? ""), cCol = String(m.contable ?? "").trim(), iCol = String(m.interno ?? "").trim()
    const cNota = deNota(nota, "Contable"), iNota = deNota(nota, "Interno")
    const c = cCol || cNota, i = iCol || iNota
    if (!c && !i) continue
    marcados++
    movs.push({ tabla: `${t.schema}.${t.tabla}`, cuenta: String(t.cuenta), titular: String(t.titular), usd: !!t.enDolares, fecha: String(m.fecha).slice(0, 10),
      desc: String(m.descripcion ?? "").slice(0, 70), detalle: String(m.detalle ?? "").trim().slice(0, 120), deb: r2(Number(m.debitos) || 0), cred: r2(Number(m.creditos) || 0),
      categ: String(m.categ ?? ""), cCol, iCol, cNota, iNota, c, i, nota: nota.slice(0, 200), id: String(m.id) })
  }
  control.push([t.cuenta, `${t.schema}.${t.tabla}`, t.titular, c1.count, filas.length, marcados, c1.count === filas.length ? "✅ leídos todos" : "🔴 no coinciden"])
}
movs.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.cuenta.localeCompare(b.cuenta))

// ── 1 · Inventario de lo INTERNO (cada código, por empresa de la cuenta)
const inv = new Map<string, { n: number; deb: number; cred: number; col: number; nota: number; conContable: Map<string, number> }>()
for (const m of movs.filter(m => m.i && !m.usd)) {
  const k = `${norm(m.i)}|${m.titular}`
  const x = inv.get(k) ?? { n: 0, deb: 0, cred: 0, col: 0, nota: 0, conContable: new Map() }; inv.set(k, x)
  x.n++; x.deb += m.deb; x.cred += m.cred; if (m.iCol) x.col++; else x.nota++
  const cc = m.c ? norm(m.c) : "(vacío)"; x.conContable.set(cc, (x.conContable.get(cc) ?? 0) + 1)
}
const fInv: unknown[][] = [["INVENTARIO DE LAS MARCAS INTERNAS — ejercicio 25/26, cuentas en pesos (columna Interno, o la nota del histórico si la columna está vacía)"], [],
  ["Código interno (unificada la escritura)", "Empresa de la cuenta", "Movimientos", "Salió (débito)", "Entró (crédito)", "De la columna", "De la nota del histórico", "Con qué contable venía", "Qué entiendo"]]
for (const [k, x] of [...inv].sort((a, b) => b[1].deb + b[1].cred - (a[1].deb + a[1].cred))) {
  const [cod, tit] = k.split("|"), d = destino(cod)
  const que = !d ? "" : d.tipo === "DIST" ? `en lo real es de ${d.quien}` : d.tipo === "GASTO" ? `en lo real es gasto de ${d.quien}` : d.tipo === "DESGLOSAR" ? "en lo real se reparte (a definir cómo)" : d.tipo === "VER" ? "para revisar" : d.tipo === "CTA" ? `cuenta corriente con ${d.quien}` : d.tipo === "RET" ? `retiro de ${d.quien} (código viejo)` : "a definir"
  fInv.push([cod, tit, x.n, r2(x.deb), r2(x.cred), x.col, x.nota, [...x.conContable].map(([c, n]) => `${c} (${n})`).join(" · "), que])
}
const enUsd = movs.filter(m => m.i && m.usd)
if (enUsd.length) fInv.push([], [`Además ${enUsd.length} movimiento(s) con marca interna en cuentas en DÓLARES (no sumados arriba): ` + [...new Set(enUsd.map(m => `${norm(m.i)} en ${m.cuenta}`))].join(" · ")])

// ── 2 · Columna vs nota (¿se pasaron todos los internos del histórico?)
const fCN: unknown[][] = [["COLUMNA vs NOTA — los movimientos del histórico tienen la marca de tu planilla en la nota. ¿Quedó también en la columna?"], [],
  ["Fecha", "Cuenta", "Descripción", "Débito", "Crédito", "Contable (columna)", "Contable (nota)", "Interno (columna)", "Interno (nota)", "Estado"]]
let cnI = { igual: 0, soloNota: 0, distinto: 0 }, cnC = { igual: 0, soloNota: 0, distinto: 0 }
for (const m of movs.filter(m => m.iNota || m.cNota)) {
  const ei = !m.iNota ? "" : !m.iCol ? "interno sólo en la nota" : norm(m.iCol) === norm(m.iNota) ? "" : "interno distinto"
  const ec = !m.cNota ? "" : !m.cCol ? "contable sólo en la nota" : norm(m.cCol) === norm(m.cNota) ? "" : "contable distinto"
  if (m.iNota) { if (!m.iCol) cnI.soloNota++; else if (ei) cnI.distinto++; else cnI.igual++ }
  if (m.cNota) { if (!m.cCol) cnC.soloNota++; else if (ec) cnC.distinto++; else cnC.igual++ }
  if (ei || ec) fCN.push([m.fecha, m.cuenta, m.desc, m.deb, m.cred, m.cCol, m.cNota, m.iCol, m.iNota, [ei, ec].filter(Boolean).join(" · ")])
}
fCN.splice(1, 0, [`Interno en la nota: ${cnI.igual + cnI.soloNota + cnI.distinto} → igual en la columna ${cnI.igual} · sólo en la nota ${cnI.soloNota} · distinto ${cnI.distinto}. Contable en la nota: ${cnC.igual + cnC.soloNota + cnC.distinto} → igual ${cnC.igual} · sólo en la nota ${cnC.soloNota} (el esquema del 07/11 deja vacío lo que no es de otro) · distinto ${cnC.distinto}. Abajo, sólo los que no coinciden.`])

// ── 3 · Simulación por socio: CONTABLE vs REAL. Real = el interno si lo hay; si no, el contable.
// Desde el lado del socio: un DÉBITO en la cuenta de la empresa = el socio recibió (debe); un CRÉDITO = el socio puso (haber).
type Acum = { debe: number; haber: number; n: number }
const sim = new Map<string, { c: Acum; r: Acum }>()
const nueva = (): Acum => ({ debe: 0, haber: 0, n: 0 })
const sumar = (a: Acum, m: Mov) => { a.debe += m.deb; a.haber += m.cred; a.n++ }
const clave = (titular: string, d: Destino) => (!d || d.quien === titular.toUpperCase()) ? `${titular}|(propio de la empresa: sin código o a su nombre)` : (d.tipo === "CTA" || d.tipo === "DIST" || d.tipo === "RET" || d.tipo === "GASTO") ? `${titular}|${d.quien}` : `${titular}|${d.tipo === "LIB" ? "LIB (50/50 a repartir)" : d.tipo === "DESGLOSAR" ? "DESGLOSAR (a repartir)" : d.tipo === "VER" ? "VER / X (sin definir)" : d.tipo === "AP" ? `AP ${d.quien}` : `otro: ${d.quien}`}`
const difs: { m: Mov; kc: string | null; kr: string | null }[] = []
let espejos = 0
for (const m of movs.filter(m => !m.usd)) {
  const dc = destino(m.c), di = destino(m.i), dr = di ?? dc
  if (esEspejo(m.titular, dc)) { espejos++; continue }   // la otra punta (la cuenta de más arriba) ya lo cuenta, con su propio interno
  const kc = clave(m.titular, dc), kr = clave(m.titular, dr)
  if (kc === kr && !dc) continue
  if (kc) { const x = sim.get(kc) ?? { c: nueva(), r: nueva() }; sim.set(kc, x); sumar(x.c, m) }
  if (kr) { const x = sim.get(kr) ?? { c: nueva(), r: nueva() }; sim.set(kr, x); sumar(x.r, m) }
  if (kc !== kr) difs.push({ m, kc, kr })
}
const SUELDO_MA = 19_500_000   // 14.1 de MSA 25/26: «Facturas y sueldo» de Mercedes Areco = 13 sueldos (jul-25 → jun-26, con aguinaldo). Sólo contable (JMS 14/11).
const fSim: unknown[][] = [["SIMULACIÓN — lo que cada socio recibió (debe) y puso (haber) según los movimientos MARCADOS, CONTABLE contra REAL (real = interno si lo hay, si no el contable)"],
  ["Neto = debe − haber: positivo = el socio se llevó plata de esa empresa. Sólo movimientos marcados, en pesos, 25/26. Las dos puntas de una transferencia entre cuentas de la app se cuentan una vez (del lado de MSA > PAM > MA > Cotitulares)."],
  ["⚠️ No incluye las FACTURAS y SUELDOS (no son movimientos de banco): ver el ajuste de abajo. Es para ver DÓNDE el interno cambia el reparto, no el saldo final de cada cuenta (eso es la 14.1)."], [],
  ["Empresa que pagó / cobró", "Socio o destino", "CONTABLE debe", "CONTABLE haber", "CONTABLE neto", "Movs", "REAL debe", "REAL haber", "REAL neto", "Movs", "Diferencia (real − contable)"]]
const orden = (k: string) => { const [t, q] = k.split("|"); return (RANGO[t.toUpperCase()] ?? 9) * 100 + (["MA", "PAM", "JMS", "AMS", "COTITULARES", "MSA"].indexOf(q) + 1 || 50) }
let totDif = 0
for (const [k, x] of [...sim].sort((a, b) => orden(a[0]) - orden(b[0]))) {
  const [t, q] = k.split("|"), nc = r2(x.c.debe - x.c.haber), nr = r2(x.r.debe - x.r.haber); totDif += nr - nc
  fSim.push([t, q, r2(x.c.debe), r2(x.c.haber), nc, x.c.n, r2(x.r.debe), r2(x.r.haber), nr, x.r.n, r2(nr - nc)])
}
fSim.push([], ["Control: la suma de las diferencias tiene que ser 0 (el interno MUEVE plata entre destinos, no la crea)", "", "", "", "", "", "", "", "", "", r2(totDif)])
fSim.push([], ["AJUSTES QUE NO SON MOVIMIENTOS (JMS 14/11)"],
  ["MSA", "MA", "", SUELDO_MA, -SUELDO_MA, "", "", 0, 0, "", SUELDO_MA, "Sueldo de MA: en lo contable es haber (MSA se lo debe); en lo real NO existe — lo que cobró es dividendo. Fuente: 14.1, 13 sueldos."],
  ["MSA", "JMS / AMS", "", "", "", "", "", "", "", "", 0, "Facturas de honorarios de JMS y AMS: reales — quedan igual."],
  ["MSA / PAM", "MA", "", "", "", "", "", "", "", "", 0, "Facturas de arrendamiento de MA: reales — quedan igual."])
fSim.push([], [`Movimientos que se cuentan del otro lado (espejo de una transferencia entre cuentas de la app): ${espejos}.`])

// ── 4 · Diferencias movimiento por movimiento
const fDif: unknown[][] = [["DIFERENCIAS — cada movimiento donde el interno manda a otro lado que el contable (la ficha completa para decidir)"], [],
  ["Fecha", "Cuenta", "Empresa", "Descripción del banco", "Detalle", "CATEG", "Débito", "Crédito", "Contable", "Interno", "Contable → va a", "Real → va a", "De dónde salió la marca", "Nota"]]
for (const { m, kc, kr } of difs) fDif.push([m.fecha, m.cuenta, m.titular, m.desc, m.detalle, m.categ, m.deb, m.cred, m.c, m.i, kc?.split("|")[1] ?? "(nada)", kr?.split("|")[1] ?? "(nada)", m.iCol ? "columna" : "nota del histórico", m.nota])

// ── 5 · Qué entendí + alternativas
const fQue: unknown[][] = [["CUENTA INTERNA — QUÉ ENTENDÍ (para que lo corrijas)"], [],
  ["1", "Dos estudios paralelos que van a cuentas: el CONTABLE (lo que va al contador: la 14.1 «Cuentas con socios») y el INTERNO (lo real: va al balance real de cada socio)."],
  ["2", "El interno se escribe sólo cuando lo real difiere del contable. Interno vacío = lo real es igual al contable."],
  ["3", "Lo real de cada socio = sus movimientos contables + los que tienen interno a su nombre, cada uno una sola vez. El interno MUEVE plata entre cuentas (de un socio a otro, o de un gasto de la empresa a un socio): no la crea."],
  ["4", "Real y no-dividendo: lo que MA le factura a MSA (arrendamiento) ES real. Los sueldos de JMS y AMS son reales. El sueldo de MA es SÓLO contable: en lo real lo que cobró es dividendo."],
  ["5", "El interno afecta a TODAS las cuentas interempresa: también cuando paga PAM o paga MA, no sólo MSA."],
  ["6", "Casos ya definidos: Tiguan (contable vacío → real MA) · Libertad (contable 50/50 → real 100 % MA) · bienes de PAM a MA (contable PAM hasta 2025 / MA desde 2026; real PAM hasta feb-26 / MA desde mar-26)."],
  ["7", "Ejercicio 25/26. Los porcentajes para igualar entre socios, después."], [],
  ["LO QUE ENCONTRÉ"], ["", `Movimientos con marca contable o interna (columna o nota), en todas las cuentas: ${movs.length}. Con marca interna: ${movs.filter(m => m.i).length}.`],
  ["", `Internos del histórico (nota): ${cnI.igual + cnI.soloNota + cnI.distinto}; ya están en la columna ${cnI.igual}, sólo en la nota ${cnI.soloNota}, distintos ${cnI.distinto} (solapa «Columna vs nota»).`],
  ["", `Movimientos donde el interno manda a otro lado que el contable: ${difs.length} (solapa «Diferencias»).`]]
const fHal: unknown[][] = [["HALLAZGOS Y PROPUESTA (research 14/11, sólo lectura)"], [],
  ["H1", "Los internos del histórico NO se perdieron: los 100 que estaban en la nota ya están también en la columna. (Los contables sí difieren: 230 sólo en la nota y 35 distintos, por el esquema del 07/11 — es lo esperado.)"],
  ["H2", "El interno mueve plata, no la crea: la simulación cierra en 0 (control). Donde más mueve: MSA → MA +19,8 M (Libertad al 100 %, Tiguan, gastos sin código que son de MA); PAM → MA +7,0 M; PAM → AMS +1,3 M (Omint)."],
  ["H3", "«DESGLOSAR» es lo grande y lo único que hoy no se puede asignar: ≈ $ 82,5 M en lo real (MSA 55,9 · MA 19,9 · PAM 6,7). Son 4 tipos, y los 4 se pueden abrir con datos que YA están en la app:"],
  ["", "  · pagos de SUELDO de JMS y AMS que juntan sueldo + anticipo/retiro ($ 34,1 M, contable CTA JMS / CTA AMS) → abrir contra Sueldos (lo que es sueldo, real; el resto, retiro)."],
  ["", "  · pagos de TARJETA (MA $ 19,9 M, MSA $ 8,7 M, PAM) → abrir por los consumos del resumen, cada uno con su marca."],
  ["", "  · SEGUROS (flota y estructura, $ 5,2 M) → abrir por póliza y bien con los responsables de cada póliza (ya cargados)."],
  ["", "  · un preocupacional ($ 0,7 M) → es de MSA (dos empleados)."],
  ["H4", "Sueldo de MA ($ 19,5 M en la 14.1): sale de lo real (es dividendo). JMS y AMS: sus facturas y sueldos quedan."],
  ["H5", "Marcas que no son de socio: «IATF» (pajuelas, $ 1,66 M) es una actividad, no un dueño · «GASTO MSA» (Orbith Chalet, $ 0,97 M, contable CTA MA) = en lo real lo absorbe MSA · «VER» ($ 1,0 M) para que decidas."],
  ["H6", "Las dos puntas de una transferencia entre cuentas de la app (48) se cuentan una vez, del lado de MSA > PAM > MA > Cotitulares; el interno que vale es el de esa punta."], [],
  ["PROPUESTA"], ["P1", "Alternativa A de códigos (solapa «Alternativas»): el interno dice sólo de quién es en lo real; vacío = igual al contable."],
  ["P2", "«Desglosar» lo abre el sistema (tarjeta → consumos · sueldo → Sueldos · seguro → pólizas) en vez de dejarlo como marca; lo que no pueda abrir, te lo lista."],
  ["P3", "Con eso, la CUENTA REAL de cada socio = la 14.1 ± las diferencias del interno − el sueldo de MA. Primer entregable: la 14.1 «real» al lado de la contable, mismo formato."]]
const fAlt: unknown[][] = [["ALTERNATIVAS — qué códigos quedan en el INTERNO con el esquema nuevo (sin borrar nada de lo que hay)"], [],
  ["Alternativa", "Cómo es", "A favor", "En contra"],
  ["A (recomendada) · «de quién es en lo real»", "El interno dice SÓLO el dueño real: «DIST MA», «DIST PAM», «GASTO MSA». Vacío = igual al contable. Lo que hoy dice CTA / RET / DESGLOSAR / VER se lee y se propone pasarlo a esta forma (con tu OK, script con deshacer).", "Es como ya lo usás (la mayoría de las marcas son DIST MA). Una sola pregunta por movimiento: ¿de quién es puertas adentro?", "«Desglosar» (gasto compartido) necesita un reparto: hay que decir los % o los montos."],
  ["B · espejo del contable", "El interno usa el mismo vocabulario que el contable («CTA + quién»), y DIST sólo para la distribución decidida.", "Una sola lógica para los dos estudios; el mismo código de la app arma las dos cuentas.", "Pierde la diferencia entre «es de MA» y «es cuenta con MA», que es justo lo que separa lo real."],
  ["C · el sistema lo deduce", "No se escribe interno: el sistema lo saca de reglas (el bien es de MA → MA; Libertad → MA; sueldo de MA → dividendo) y sólo se marca a mano la excepción.", "Casi cero carga manual hacia adelante; usa el «dueño del bien» que ya existe.", "Hay que escribir y mantener las reglas; lo que no tenga regla queda igual al contable sin avisar si nadie lo marca."]]

// ── El libro
const wb = XLSX.utils.book_new()
agregarHoja(wb, "Qué entendí", fQue); agregarHoja(wb, "Hallazgos y propuesta", fHal); agregarHoja(wb, "Simulación por socio", fSim); agregarHoja(wb, "Diferencias", fDif)
agregarHoja(wb, "Inventario interno", fInv); agregarHoja(wb, "Columna vs nota", fCN); agregarHoja(wb, "Alternativas", fAlt); agregarHoja(wb, "Control", control)
fechasReales(wb)
let nombre = `Cuenta interna - research 25-26 (${HOY}).xlsx`; for (let v = 2; existsSync(join(CARPETA, nombre)); v++) nombre = `Cuenta interna - research 25-26 (${HOY}) v${v}.xlsx`
XLSX.writeFile(wb, join(CARPETA, nombre))
console.log("Escrito:", nombre)
console.log("movs", movs.length, "con interno", movs.filter(m => m.i).length, "difs", difs.length, "espejos", espejos, "control dif", r2(totDif))
console.log("nota interno", cnI, "nota contable", cnC)
for (const r of fSim.slice(5)) console.log(JSON.stringify(r))
for (const r of fInv.slice(3, 40)) console.log(JSON.stringify(r).slice(0, 260))
