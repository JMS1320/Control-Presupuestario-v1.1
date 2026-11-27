/**
 * 🤝 A-FEAT-1635 — LOS SALDOS INTERNOS entre las cuentas (PAM ↔ MSA ante todo, PAM y MSA con cada socio, y los socios entre sí), desde el
 * 31/12/2024 en CERO. Capa aparte, tanda sin supervisión del 21/11. SÓLO LEE la base.
 *
 * JMS 21/11: *«al 31/12/24 empezamos en interno cero… los retiros que haya hecho PAM de MSA se los tiene que devolver, y si MSA retiró, se lo
 * tiene que devolver… un saldo a fin de febrero del 26 y un saldo actual… el saldo que nos importa va a ser el interno… y todas las otras
 * cuentas entre sí también empezando de cero»*.
 *
 * Cómo se lee cada movimiento — las MISMAS reglas que la capa interna de la app (`lib/balance/capa-interna.ts`), aplicadas a la cuenta entera:
 *  · La marca que manda es la INTERNA; si está vacía, la contable (regla 1: «interno vacío = lo real es igual al contable»). Las del histórico
 *    salen de la nota («tu planilla: … Interno Z»), como en la app (`leerMovimientosDeLaCapa`).
 *  · CTA / DIST / RET / GASTO X: la plata que salió de la cuenta del titular fue a X → X le debe al titular (o al revés si entró).
 *  · Lo del mismo titular es «propio» (no es cuenta con nadie). Una actividad («IATF») queda en el titular.
 *  · LIB: va al pozo de Libertad (se reparte después: queda a la vista como su propia cuenta).
 *  · DESGLOSAR: el pago de una tarjeta no mueve nada (sus consumos traen su marca); un seguro se reparte por bien; si no se puede abrir, «sin resolver».
 *  · VER / X / AP sin dueño: «sin resolver», a la vista.
 *  · Una transferencia entre dos cuentas de la app se cuenta UNA vez, del lado de más arriba (MSA > PAM > MA > Cotitulares) — salvo que ese
 *    lado no tenga extracto cargado a esa fecha: ahí se cuenta del lado que sí está (si no, se perdería).
 *
 *     npx tsx scripts/cuentas-internas-desde-2025.mts [--hasta=2026-11-21] [--v=v1] [--json=archivo]
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { leerMovimientosDeLaCapa } from "../lib/balance/capa-interna-datos"
import { destinoDeCodigo, normalizarCodigo, PROPIO, type MovCapa } from "../lib/balance/capa-interna"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const DESDE = "2025-01-01", CORTE = "2026-02-28", HASTA = arg("hasta", new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })), VERSION = arg("v", "v1")
const CARPETA = join("..", "Control-Presupuestario-v1.1", "- Comunicacion JMS Claude - Archivos", "Balance", "Excels trabajando con claude", "Cuentas internas desde 2025", VERSION)
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
const T0 = Date.now()
const etapa = (q: string) => console.log(`[${new Date().toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} · +${Math.round((Date.now() - T0) / 1000)} s] ${q}`)
etapa(`arranque — desde ${DESDE}, corte ${CORTE}, hasta ${HASTA}`)

// ── 1 · cobertura: desde y hasta qué fecha hay extracto en cada cuenta (en pesos) ──
const cobertura: Array<{ cuenta: string; titular: string; desde: string | null; hasta: string | null; filas: number }> = []
for (const t of TABLAS_CON_VINCULO_ARCA) {
  if (t.enDolares) continue
  const q = () => (t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla))
  const [a, b, c] = await Promise.all([
    q().select("fecha").gte("fecha", DESDE).lte("fecha", HASTA).order("fecha", { ascending: true }).limit(1),
    q().select("fecha").gte("fecha", DESDE).lte("fecha", HASTA).order("fecha", { ascending: false }).limit(1),
    q().select("id", { count: "exact", head: true }).gte("fecha", DESDE).lte("fecha", HASTA),
  ])
  cobertura.push({ cuenta: t.cuenta ?? t.tabla, titular: String(t.titular ?? ""), desde: a.data?.[0]?.fecha?.slice(0, 10) ?? null, hasta: b.data?.[0]?.fecha?.slice(0, 10) ?? null, filas: c.count ?? 0 })
}
etapa("cobertura leída")
/** Desde cuándo hay extracto del titular (su cuenta principal en pesos: la que más filas tiene). */
const desdeDe = (titular: string) => {
  const cs = cobertura.filter(c => c.titular.toUpperCase() === titular.toUpperCase() && c.desde).sort((a, b) => b.filas - a.filas)
  return cs[0]?.desde ?? "9999-12-31"
}

// ── 2 · los movimientos marcados de todas las cuentas ──
const { movs, tablasQueFallaron } = await leerMovimientosDeLaCapa(sb, DESDE, HASTA)
etapa(`movimientos marcados: ${movs.length}${tablasQueFallaron.length ? ` · ⚠️ no se pudieron leer: ${tablasQueFallaron.join(", ")}` : ""}`)

// ── 3 · cada movimiento a su cuenta interna ──
const RANGO: Record<string, number> = { MSA: 1, PAM: 2, MA: 3, COTITULARES: 4 }
type Asiento = { m: MovCapa; de: string; a: string; importe: number; marca: string; porque: string; parte?: string }
const asientos: Asiento[] = [], sinResolver: Array<{ m: MovCapa; porque: string }> = [], propios: Array<{ m: MovCapa; porque: string }> = [], espejos: Array<{ m: MovCapa; porque: string }> = []
const par = (x: string, y: string) => [x, y].sort().join(" ↔ ")
const terceros: Array<{ m: MovCapa; porque: string }> = []
/** Quiénes forman la matriz: las empresas, los socios, Libertad y los herederos que recibieron distribuciones de PAM (a confirmar). */
const SOCIOS_Y_EMPRESAS = new Set(["MSA", "PAM", "MA", "COTITULARES", "JMS", "AMS", "LIB", "MANU", "MECHI", "SOLE"])
for (const m of movs) {
  const marca = (m.interno || m.contable || "").trim()
  const origenMarca = m.interno ? "interno" : "contable (interno vacío)"
  const d = destinoDeCodigo(marca)
  const titular = m.titular.toUpperCase()
  const neto = r2(m.deb - m.cred)   // + = salió plata de la cuenta del titular
  if (!d) { propios.push({ m, porque: "sin marca" }); continue }
  if (d.tipo === "VER" || (d.tipo === "AP" && !d.quien)) { sinResolver.push({ m, porque: `«${marca}» no dice de quién es` }); continue }
  if (d.tipo === "DESGLOSAR") {
    if (m.esPagoTarjeta) { propios.push({ m, porque: "pago de tarjeta: lo abren sus consumos, cada uno con su marca" }); continue }
    const partes = (m.partesPoliza ?? []).filter(p => p.parte > 0)
    const suma = partes.reduce((t, p) => t + p.parte, 0)
    if (partes.length && Math.abs(suma - 1) < 0.001) {
      let resto = neto
      partes.forEach((p, i) => {
        const imp = i === partes.length - 1 ? r2(resto) : r2(neto * p.parte); resto -= imp
        const q = p.quien.toUpperCase()
        if (q === titular) return
        asientos.push({ m, de: titular, a: q, importe: imp, marca, porque: `seguro repartido por bien (${(p.parte * 100).toFixed(1)} %)`, parte: p.que })
      })
      continue
    }
    sinResolver.push({ m, porque: partes.length ? `el reparto de la póliza suma ${(suma * 100).toFixed(1)} %` : "«Desglosar» sin dato que lo abra" }); continue
  }
  if (d.tipo === "OTRO") { propios.push({ m, porque: `«${marca}»: actividad, queda en ${m.titular}` }); continue }
  /** Los números de las marcas viejas: «RET 1» / «AP 1» en la cuenta de PAM dicen «Retiro de MSA a PAM» / «Aporte PAM a MSA» → 1 = MSA
   *  (inferido de las descripciones; 2 = PAM y 3 = MA por el mismo orden — a confirmar con JMS). */
  const NUMERO: Record<string, string> = { "1": "MSA", "2": "PAM", "3": "MA" }
  const crudo = d.tipo === "LIB" ? "LIB" : d.quien.toUpperCase()
  const quien = NUMERO[crudo] ?? crudo
  if (!SOCIOS_Y_EMPRESAS.has(quien)) { terceros.push({ m, porque: `«${marca}»: ${quien} no es una empresa ni un socio — cuenta con un tercero, no va a esta matriz` }); continue }
  if (quien === titular) { propios.push({ m, porque: `«${marca}»: es del mismo titular` }); continue }
  // espejo: la transferencia entre dos cuentas de la app se cuenta del lado de más arriba, si ese lado tiene extracto a esa fecha
  // (vale también para RET / AP: un retiro o aporte entre dos cuentas de la app es la misma transferencia vista de los dos lados)
  if (d.tipo !== "LIB" && d.tipo !== "GASTO" && (RANGO[quien] ?? 99) < (RANGO[titular] ?? 99) && m.fecha >= desdeDe(quien)) {
    espejos.push({ m, porque: `se cuenta desde la cuenta de ${quien}` }); continue
  }
  asientos.push({ m, de: titular, a: quien, importe: neto, marca, porque: `${origenMarca} «${normalizarCodigo(marca)}»` })
}
etapa(`asientos: ${asientos.length} · propios ${propios.length} · espejos ${espejos.length} · terceros ${terceros.length} · sin resolver ${sinResolver.length}`)

// ── 4 · los saldos por par, al corte y a hoy. Signo: desde el PRIMERO del par (orden alfabético): + = el segundo le debe al primero ──
type Saldo = { par: string; primero: string; segundo: string; alCorte: number; aHoy: number; n: number; nro: string }
const saldos = new Map<string, Saldo>()
let nro = 0
for (const a of asientos) {
  const k = par(a.de, a.a), [p1, p2] = k.split(" ↔ ")
  const s = saldos.get(k) ?? { par: k, primero: p1, segundo: p2, alCorte: 0, aHoy: 0, n: 0, nro: "" }
  // a.de pagó/entregó `importe` a favor de a.a → a.a le debe a a.de
  const v = a.de === p1 ? a.importe : -a.importe
  if (a.m.fecha <= CORTE) s.alCorte = r2(s.alCorte + v)
  s.aHoy = r2(s.aHoy + v); s.n++
  saldos.set(k, s)
}
const ordenPar = (k: string) => (k === "MSA ↔ PAM" ? "0" : k.includes("PAM") || k.includes("MSA") ? "1" + k : "2" + k)
const lista = [...saldos.values()].sort((a, b) => ordenPar(a.par).localeCompare(ordenPar(b.par)))
for (const s of lista) s.nro = `P${String(++nro).padStart(2, "0")}`
const lee = (s: Saldo, v: number) => Math.abs(v) < 0.005 ? "en cero" : v > 0 ? `${s.segundo} le debe a ${s.primero}` : `${s.primero} le debe a ${s.segundo}`

// ── 5 · Excel ──
const MONEDA = '#,##0.00;[Red]-#,##0.00;"-"'
const n = (v: number) => ({ t: "n", v, z: MONEDA })
const wb = XLSX.utils.book_new()
const filasR: unknown[][] = [[`SALDOS INTERNOS ENTRE LAS CUENTAS — desde el 31/12/2024 en cero · corte ${CORTE.split("-").reverse().join("/")} · hoy ${HASTA.split("-").reverse().join("/")} — ${VERSION} (A-FEAT-1635)`],
  ["Signo: desde el PRIMERO del par. + = el segundo le debe al primero · − = el primero le debe al segundo. Cada par tiene un Nro: filtrá «Nro» en «Detalle» para ver cómo se forma."],
  [], ["Nro", "Par", `Saldo al ${CORTE.split("-").reverse().join("/")}`, "Cómo se lee", `Saldo a hoy (${HASTA.split("-").reverse().join("/")})`, "Cómo se lee", "Movimientos", "Control: suma del detalle", "✓"]]
const desdeFilaDet = 5
for (const s of lista) {
  const fila = filasR.length + 1
  filasR.push([s.nro, s.par, n(s.alCorte), lee(s, s.alCorte), n(s.aHoy), lee(s, s.aHoy), s.n,
    { t: "n", f: `SUMIFS(Detalle!J:J,Detalle!A:A,A${fila})`, z: MONEDA }, { t: "s", f: `IF(ROUND(H${fila}-E${fila},2)=0,"✓","⚠️")` }])
}
void desdeFilaDet
filasR.push([], ["Lo que NO se pudo leer como cuenta (a la vista, no se adivina)"], ["", "Sin resolver", sinResolver.length, "", n(r2(sinResolver.reduce((t, x) => t + x.m.deb - x.m.cred, 0)))],
  ["", "Propios / pagos de tarjeta / actividades", propios.length], ["", "Transferencias contadas del otro lado (espejos)", espejos.length], ["", "Cuentas con terceros (no van)", terceros.length])
if (tablasQueFallaron.length) filasR.push([], [`⚠️ No se pudieron leer: ${tablasQueFallaron.join(", ")}`])
const wsR = XLSX.utils.aoa_to_sheet(filasR); wsR["!cols"] = [{ wch: 6 }, { wch: 26 }, { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 4 }]
XLSX.utils.book_append_sheet(wb, wsR, "Saldos")

const nroDe = (a: Asiento) => saldos.get(par(a.de, a.a))!.nro
const det = asientos.map(a => { const s = saldos.get(par(a.de, a.a))!; const v = a.de === s.primero ? a.importe : -a.importe
  return [nroDe(a), s.par, a.m.fecha, a.m.fecha <= CORTE ? "hasta el corte" : "después del corte", a.m.cuenta, a.m.titular, a.m.detalle || a.m.desc || "", a.marca, a.porque, v, a.m.contable, a.m.interno, `${a.de} → ${a.a}`] })
  .sort((x, y) => String(x[0]).localeCompare(String(y[0])) || String(x[2]).localeCompare(String(y[2])))
const wsD = XLSX.utils.aoa_to_sheet([["DETALLE — un renglón por movimiento, con el Nro del par al que suma"], [],
  ["Nro", "Par", "Fecha", "Tramo", "Cuenta", "Titular", "Detalle / descripción", "Marca que manda", "Por qué", "Importe (signo del par)", "Contable", "Interno", "Plata de → a"],
  ...det.map(r => r.map((v, i) => i === 9 ? n(v as number) : v))])
wsD["!autofilter"] = { ref: `A3:M${det.length + 3}` }; wsD["!cols"] = [6, 22, 11, 16, 22, 10, 50, 18, 34, 16, 16, 16, 16].map(w => ({ wch: w }))
XLSX.utils.book_append_sheet(wb, wsD, "Detalle")
const otra = (rot: string, xs: Array<{ m: MovCapa; porque: string }>) => {
  const ws = XLSX.utils.aoa_to_sheet([[rot], [], ["Fecha", "Cuenta", "Titular", "Detalle", "Contable", "Interno", "Débito", "Crédito", "Por qué"],
    ...xs.map(x => [x.m.fecha, x.m.cuenta, x.m.titular, x.m.detalle || x.m.desc || "", x.m.contable, x.m.interno, n(x.m.deb), n(x.m.cred), x.porque])])
  ws["!cols"] = [11, 22, 10, 50, 16, 16, 14, 14, 50].map(w => ({ wch: w })); return ws
}
XLSX.utils.book_append_sheet(wb, otra("SIN RESOLVER — la marca no dice de quién es: hay que decidirlo", sinResolver), "Sin resolver")
XLSX.utils.book_append_sheet(wb, otra("ESPEJOS — transferencias entre cuentas de la app, contadas desde el otro lado", espejos), "Espejos")
XLSX.utils.book_append_sheet(wb, otra("TERCEROS — marcas de una cuenta con alguien que no es empresa ni socio (no van a la matriz)", terceros), "Terceros")
XLSX.utils.book_append_sheet(wb, otra("PROPIOS — no son cuenta con nadie (del mismo titular, actividades, pagos de tarjeta)", propios), "Propios")
const wsC = XLSX.utils.aoa_to_sheet([["COBERTURA — desde y hasta qué fecha hay extracto de cada cuenta (en pesos) desde el 01/01/2025"], ["Si una cuenta arranca después del 01/01/2025, lo de antes NO está en la base: el saldo de sus pares queda incompleto en ese tramo."], [],
  ["Cuenta", "Titular", "Desde", "Hasta", "Movimientos", "¿Completa desde 01/01/2025?"],
  ...cobertura.map(c => [c.cuenta, c.titular, c.desde ?? "—", c.hasta ?? "—", c.filas, !c.desde ? "sin movimientos" : c.desde <= "2025-01-31" ? "✓" : `⚠️ falta desde 01/01/2025 hasta ${c.desde}`])])
wsC["!cols"] = [28, 12, 12, 12, 12, 44].map(w => ({ wch: w }))
XLSX.utils.book_append_sheet(wb, wsC, "Cobertura")
// control: todo movimiento marcado está en un lugar
const total = movs.length, ubicados = new Set([...asientos.map(a => a.m), ...sinResolver.map(x => x.m), ...propios.map(x => x.m), ...espejos.map(x => x.m), ...terceros.map(x => x.m)]).size
const wsK = XLSX.utils.aoa_to_sheet([["CONTROL"], [], ["Qué", "Valor", "✓"],
  ["Movimientos marcados leídos", total, ""], ["Ubicados (en un par, sin resolver, propio o espejo)", ubicados, ubicados === total ? "✓" : "⚠️"],
  ["Cada par: saldo = suma de su detalle", "ver solapa Saldos, columna ✓", ""]])
wsK["!cols"] = [{ wch: 60 }, { wch: 28 }, { wch: 4 }]
XLSX.utils.book_append_sheet(wb, wsK, "Control")
mkdirSync(CARPETA, { recursive: true })
const archivo = join(CARPETA, `Cuentas internas desde 2025 ${VERSION}.xlsx`)
XLSX.writeFile(wb, archivo, { cellStyles: true })
etapa(`Excel: ${archivo}`)
const JSON_OUT = arg("json", "")
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ desde: DESDE, corte: CORTE, hasta: HASTA, saldos: lista.map(s => ({ ...s, leeCorte: lee(s, s.alCorte), leeHoy: lee(s, s.aHoy) })),
  sinResolver: sinResolver.length, propios: propios.length, espejos: espejos.length, terceros: terceros.length, total, ubicados, cobertura, tablasQueFallaron,
  detalle: Object.fromEntries(lista.map(s => [s.nro, det.filter(r => r[0] === s.nro).map(r => [r[2], `${r[4]} · ${r[6]}`, r[9], `${r[7]} · ${r[12]}`])])),
  sinResolverDet: sinResolver.map(x => [x.m.fecha, `${x.m.cuenta} · ${x.m.detalle || x.m.desc || ""}`, r2(x.m.deb - x.m.cred), `${x.m.contable} / ${x.m.interno} · ${x.porque}`]) }))
console.log(JSON.stringify(lista.map(s => [s.nro, s.par, s.alCorte, s.aHoy, s.n])))
