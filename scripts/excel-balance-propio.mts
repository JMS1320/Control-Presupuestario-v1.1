/**
 * 📸 EL BALANCE PROPIO EN EXCEL — con el modelo de la planilla de JMS (BAPU, solapa NOTAS) — A-FEAT-1190 (JMS 14/11: «tiene que ser un exportable»).
 *
 * Lee las fotos guardadas (versión JMS) del 30/06 de inicio y de cierre y arma:
 *   1. «Balance propio»: $ inicio · $ cierre · dif $ · US$ inicio · US$ cierre · dif US$ (cada punta con SU dólar), subtotal y CONTROL por rubro
 *      como en su planilla, y los totales (activo, activo corriente sin las vacas, pasivo corriente, A − P corriente, pasivo total, A − P total).
 *      Los FLUJOS del año (MEP, distribución de fondos) van sólo en el cierre (en el inicio, 0), como en su planilla.
 *   2. «Ganancia desglosada»: total − revalúo de las vacas − reinvertido en vacas − recría (fórmulas sobre la tabla de la cría por categoría).
 *   3. «Socios»: lo que se llevó cada socio en el año (saldo con MSA al inicio − al cierre).
 *   4. «Hacienda promedio junio»: los precios y de dónde salen.
 * Todo con FÓRMULAS. No escribe la base.
 *
 * Uso: npx tsx scripts/excel-balance-propio.mts [MSA] [2026] [junio.json] [socios.json]
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import XLSX from "xlsx-js-style"
import { createClient } from "@supabase/supabase-js"
import { RENGLONES, RUBROS } from "../lib/balance/balance-propio"
import { agregarHoja, vistasDe } from "../lib/balance/export-libro-diario"
import { aplicarVistas, MONEDA } from "../lib/balance/formato-excel"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DATOS = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude/Copias/programas/balance-propio-pagina"
// por defecto, los precios de junio (promedio-junio-hacienda.mts) y los socios (papel Cuentas de socios) guardados junto a los programas del balance
const [EMPRESA = "MSA", ANIO_TXT = "2026", JUNIO = join(DATOS, "junio-rango.json"), SOCIOS = join(DATOS, "socios.json")] = process.argv.slice(2)
const ANIO = Number(ANIO_TXT), CIERRE = `${ANIO}-06-30`, INICIO = `${ANIO - 1}-06-30`
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"

const { data: fotos } = await sb.from("balance_fotos").select("id, fecha_cierre, tc, tc_fuente").eq("empresa", EMPRESA).in("fecha_cierre", [INICIO, CIERRE]).order("fecha_cierre")
if (fotos?.length !== 2) throw new Error(`Faltan las fotos ${INICIO} y ${CIERRE} de ${EMPRESA}`)
const [fi, fc] = fotos
const leer = async (id: string) => { const { data } = await sb.from("balance_foto_valores").select("renglon, importe, detalle").eq("foto_id", id).eq("version", "jms"); return new Map<string, { importe: number; detalle: string }>(data.map((x: any) => [x.renglon, { importe: Number(x.importe), detalle: x.detalle ?? "" }])) }
const vi = await leer(fi.id), vc = await leer(fc.id)

const FLUJOS = new Set(["distribucion_fondos", "dolares_mep"])
const NO_CORRIENTE = new Set(["stock_cria", "equinos", "bienes_uso_neto"])
const n = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100) / 100)
const L = (c: string, r: number) => `${c}${r}`

// ── 1 · Balance propio (modelo BAPU) ────────────────────────────────────────────────────────────────────────────
// Columnas: A concepto · B $ inicio · C $ cierre · D dif $ · E US$ inicio · F US$ cierre · G dif US$ · H de dónde sale
const f1: unknown[][] = []
f1.push([`BALANCE PROPIO — ${EMPRESA} — determinación de ganancia según activo menos pasivo — ${INICIO.slice(8, 10)}/${INICIO.slice(5, 7)}/${INICIO.slice(0, 4)} → ${CIERRE.slice(8, 10)}/${CIERRE.slice(5, 7)}/${CIERRE.slice(0, 4)}`])
f1.push(["Modelo de tu planilla (BAPU, solapa NOTAS). Análisis económico propio: distinto de lo que se presenta al contador. Hacienda a promedio de junio menos 10 % de comercialización. Impuestos sin dato del cierre: neutros (mismos US$)."])
f1.push(["Dólar de cada punta (promedio de divisas BNA)", fi.tc, fc.tc, "", fi.tc_fuente, fc.tc_fuente])
const FILA_TC = f1.length // fila 3 (1-indexada)
f1.push([])
f1.push(["Concepto", `$ ${INICIO.slice(0, 4)}`, `$ ${CIERRE.slice(0, 4)}`, "Diferencia $", `US$ ${INICIO.slice(0, 4)}`, `US$ ${CIERRE.slice(0, 4)}`, "Diferencia US$", "De dónde sale el cierre"])
const subtot: Record<string, number> = {}
const filasAC: number[] = [], filasNC: number[] = []
for (const rb of RUBROS) {
  f1.push([`${rb.etiqueta.toUpperCase()} (${rb.lado}${rb.corriente ? ", corriente" : ", no corriente"})`])
  const desde = f1.length + 1
  for (const r of RENGLONES.filter(x => x.rubro === rb.id)) {
    const a = FLUJOS.has(r.id) ? 0 : vi.get(r.id)?.importe ?? null, b = vc.get(r.id)?.importe ?? null
    if (a == null && b == null) continue
    const fila = f1.length + 1
    f1.push([r.etiqueta, n(a ?? 0), n(b ?? 0),
      { t: "n", f: `${L("C", fila)}-${L("B", fila)}` }, { t: "n", f: `${L("B", fila)}/$B$${FILA_TC}` }, { t: "n", f: `${L("C", fila)}/$C$${FILA_TC}` }, { t: "n", f: `${L("F", fila)}-${L("E", fila)}` },
      (FLUJOS.has(r.id) && vi.get(r.id) ? `flujo del año: en el inicio va 0 (tu foto decía ${vi.get(r.id)!.importe.toLocaleString("es-AR")}) · ` : "") + (vc.get(r.id)?.detalle ?? "").replace(/^\[script \d+\] /, "")])
    if (rb.lado === "activo") (NO_CORRIENTE.has(r.id) ? filasNC : filasAC).push(fila)
  }
  const hasta = f1.length, fila = f1.length + 1
  const s = (c: string) => hasta >= desde ? { t: "n", f: `SUM(${c}${desde}:${c}${hasta})` } : 0
  f1.push([`Subtotal ${rb.etiqueta}`, s("B"), s("C"), s("D"), s("E"), s("F"), s("G"),
    { t: "n", f: `ROUND((C${fila}/$C$${FILA_TC}-B${fila}/$B$${FILA_TC})-G${fila},2)` }])
  subtot[rb.id] = fila
  f1.push([])
}
const sumaDe = (ids: string[], c: string) => ids.length ? ids.map(id => `${c}${subtot[id]}`).join("+") : "0"
const sumaFilas = (fs: number[], c: string) => fs.length ? fs.map(x => `${c}${x}`).join("+") : "0"
const ACT = RUBROS.filter(r => r.lado === "activo").map(r => r.id), PC = RUBROS.filter(r => r.lado === "pasivo" && r.corriente).map(r => r.id), PT = RUBROS.filter(r => r.lado === "pasivo").map(r => r.id)
const tot: Record<string, number> = {}
const totFila = (k: string, nombre: string, fn: (c: string) => string) => { const fila = f1.length + 1; tot[k] = fila; f1.push([nombre, ...["B", "C", "D", "E", "F", "G"].map(c => ({ t: "n", f: fn(c) }))]) }
totFila("act", "ACTIVO", c => sumaDe(ACT, c))
totFila("ac", "ACTIVO CORRIENTE (sin las vacas: son la fábrica)", c => sumaFilas(filasAC, c))
totFila("pc", "PASIVO CORRIENTE", c => sumaDe(PC, c))
totFila("apc", "ACTIVO CORRIENTE MENOS PASIVO CORRIENTE", c => `${c}${tot.ac}-${c}${tot.pc}`)
totFila("pt", "PASIVO TOTAL", c => sumaDe(PT, c))
totFila("apt", "ACTIVO MENOS PASIVO TOTAL", c => `${c}${tot.act}-${c}${tot.pt}`)
f1.push([])
f1.push(["GANANCIA CORRIENTE (diferencia en US$ de activo corriente − pasivo corriente)", "", "", "", "", "", { t: "n", f: `G${tot.apc}` }])
f1.push(["GANANCIA TOTAL (diferencia en US$ de activo − pasivo total)", "", "", "", "", "", { t: "n", f: `G${tot.apt}` }])
const FILA_GT = f1.length
const COLS1 = [{ ancho: 52 }, { ancho: 17, z: MONEDA }, { ancho: 17, z: MONEDA }, { ancho: 17, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 70 }]

// ── 4 · Hacienda (precios de junio) — se arma antes para que el desglose la referencie ─────────────────────────
const junio = JUNIO && existsSync(JUNIO) ? JSON.parse(readFileSync(JUNIO, "utf8")) : null
const CRIA = [["Vacas", "Vacas"], ["V1", "Vaquillonas 1ª parición"], ["CUT", "CUT"], ["Toros", "Toros"]] as const
const RECRIA = [["Toritos", "Toritos"], ["Vaq", "Vaquillonas"], ["Nov", "Novillitos / terneros"]] as const
const CAB: Record<number, Record<string, number>> = { 2025: { Vacas: 150, V1: 50, CUT: 2, Toros: 11, Toritos: 9, Vaq: 28, Nov: 71 }, 2026: { Vacas: 177, V1: 27, CUT: 8, Toros: 16, Toritos: 9, Vaq: 81, Nov: 96 } }
const f4: unknown[][] = [["HACIENDA — PROMEDIO DE JUNIO de cada año (análisis propio, distinto de lo presentado al contador)"],
  ["Precio por cabeza: promedio del mes de junio consultando el rango en Entre Surcos y Cañuelas, mismos criterios de la app. Sin el 10 % (se aplica abajo)."],
  ["Comercialización", 0.1], []]
const FILA_CZ = 3
f4.push(["Categoría", "Rodeo", `Cabezas ${ANIO - 1}`, `$ por cabeza ${ANIO - 1}`, `Cabezas ${ANIO}`, `$ por cabeza ${ANIO}`, `Valor ${ANIO - 1} (neto 10 %)`, `Valor ${ANIO} (neto 10 %)`, "Por precio US$", "Por cantidad US$", `Fuente ${ANIO}`])
const filaCat: Record<string, number> = {}
for (const [k, nom] of [...CRIA, ...RECRIA]) {
  const fila = f4.length + 1; filaCat[k] = fila
  const p0 = junio?.[ANIO - 1]?.porCabeza?.[k] ?? null, p1 = junio?.[ANIO]?.porCabeza?.[k] ?? null
  const tc0 = `'Balance propio'!$B$${FILA_TC}`, tc1 = `'Balance propio'!$C$${FILA_TC}`
  f4.push([nom, CRIA.some(x => x[0] === k) ? "cría (fábrica)" : "recría (producido)", CAB[ANIO - 1]?.[k] ?? null, n(p0), CAB[ANIO]?.[k] ?? null, n(p1),
    { t: "n", f: `C${fila}*D${fila}*(1-$B$${FILA_CZ})` }, { t: "n", f: `E${fila}*F${fila}*(1-$B$${FILA_CZ})` },
    { t: "n", f: `(F${fila}*(1-$B$${FILA_CZ})/${tc1}-D${fila}*(1-$B$${FILA_CZ})/${tc0})*E${fila}` },
    { t: "n", f: `(E${fila}-C${fila})*D${fila}*(1-$B$${FILA_CZ})/${tc0}` }, junio?.[ANIO]?.fuente?.[k] ?? ""])
}
const c0 = filaCat.Vacas, c1 = filaCat.Toros, r0 = filaCat.Toritos, r1 = filaCat.Nov
f4.push(["Total cría", "", { t: "n", f: `SUM(C${c0}:C${c1})` }, "", { t: "n", f: `SUM(E${c0}:E${c1})` }, "", { t: "n", f: `SUM(G${c0}:G${c1})` }, { t: "n", f: `SUM(H${c0}:H${c1})` }, { t: "n", f: `SUM(I${c0}:I${c1})` }, { t: "n", f: `SUM(J${c0}:J${c1})` }])
const FILA_TCRIA = f4.length
f4.push(["Total recría", "", { t: "n", f: `SUM(C${r0}:C${r1})` }, "", { t: "n", f: `SUM(E${r0}:E${r1})` }, "", { t: "n", f: `SUM(G${r0}:G${r1})` }, { t: "n", f: `SUM(H${r0}:H${r1})` }])
const FILA_TREC = f4.length
const COLS4 = [{ ancho: 24 }, { ancho: 18 }, { ancho: 10 }, { ancho: 15, z: MONEDA }, { ancho: 10 }, { ancho: 15, z: MONEDA }, { ancho: 17, z: MONEDA }, { ancho: 17, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 60 }]

// ── 2 · Ganancia desglosada ───────────────────────────────────────────────────────────────────────────────────
const H = "'Hacienda promedio junio'"
const rec = (() => { const r = RENGLONES.find(x => x.id === "stock_recria")!; return f1.findIndex(row => row[0] === r.etiqueta) + 1 })()
const f2: unknown[][] = [["CUÁNTO DE LA GANANCIA ES PLATA PARA DISTRIBUIR (US$)"],
  ["Las vacas y los toros son la fábrica: que suba su precio no es ganancia. Lo que se guardó en vacas es ganancia reinvertida. La recría es producido, pero hoy es un activo, no plata."], [],
  ["Ganancia total", { t: "n", f: `'Balance propio'!G${FILA_GT}` }, "activo − pasivo total, diferencia en US$"],
  ["− Suba del precio de las vacas y toros", { t: "n", f: `-${H}!I${FILA_TCRIA}` }, "revalúo de la fábrica: no es ganancia"],
  ["= Ganancia del ejercicio", { t: "n", f: "B4+B5" }],
  ["− Reinvertido en vacas (más cabezas)", { t: "n", f: `-${H}!J${FILA_TCRIA}` }, "terneras que se guardaron y pasaron a ser fábrica, al precio del inicio"],
  ["= Ganancia líquida", { t: "n", f: "B6+B7" }, "control: tiene que dar igual a la ganancia corriente →"],
  ["   control (líquida − corriente = 0)", { t: "n", f: `ROUND(B8-'Balance propio'!G${FILA_GT - 1},0)` }],
  ["− Recría", { t: "n", f: `-'Balance propio'!G${rec}` }, "producido que se puede vender, pero hoy es un activo"],
  ["= Ganancia líquida sin la recría", { t: "n", f: "B8+B10" }],
  [], ["Control de la cría: revalúo + reinvertido = variación del stock de cría en US$", { t: "n", f: `ROUND(${H}!I${FILA_TCRIA}+${H}!J${FILA_TCRIA}-'Balance propio'!G${f1.findIndex(row => row[0] === RENGLONES.find(x => x.id === "stock_cria")!.etiqueta) + 1},0)` }, "tiene que dar 0"]]
const COLS2 = [{ ancho: 58 }, { ancho: 16, z: MONEDA }, { ancho: 70 }]

// ── 3 · Socios ────────────────────────────────────────────────────────────────────────────────────────────────
const socios = SOCIOS && existsSync(SOCIOS) ? JSON.parse(readFileSync(SOCIOS, "utf8")) as { s: string; ini: number; cie: number; pagado: number }[] : []
const f3: unknown[][] = [["DISTRIBUCIÓN DE FONDOS, SOCIO POR SOCIO"], ["Saldo con MSA (negativo = el socio le debe a MSA). Lo que se llevó en el año (neto) = saldo al inicio − saldo al cierre. Fuente: papel Cuentas de socios."], [],
  ["Socio", `Saldo al ${INICIO}`, `Saldo al ${CIERRE}`, "Se llevó en el año (neto)", "en US$", "Pagos de MSA al socio (bruto)"]]
const s0 = f3.length + 1
for (const x of socios) { const fila = f3.length + 1; f3.push([x.s, x.ini, x.cie, { t: "n", f: `B${fila}-C${fila}` }, { t: "n", f: `D${fila}/'Balance propio'!$C$${FILA_TC}` }, x.pagado]) }
const s1 = f3.length
if (socios.length) {
  const dist = f1.findIndex(row => row[0] === RENGLONES.find(x => x.id === "distribucion_fondos")!.etiqueta) + 1
  f3.push(["Total", "", "", { t: "n", f: `SUM(D${s0}:D${s1})` }, { t: "n", f: `SUM(E${s0}:E${s1})` }, { t: "n", f: `SUM(F${s0}:F${s1})` }])
  f3.push(["Control: total − renglón «Distribución de fondos» del balance (tiene que dar 0)", "", "", { t: "n", f: `ROUND(D${f3.length}-'Balance propio'!C${dist},0)` }])
}
const COLS3 = [{ ancho: 30 }, { ancho: 17, z: MONEDA }, { ancho: 17, z: MONEDA }, { ancho: 19, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 19, z: MONEDA }]

// Una celda con fórmula necesita un valor para que se escriba; el valor real lo calcula `recalcular` abajo.
const conV = (fs: unknown[][]) => fs.map(r => r.map(c => (c && typeof c === "object" && "f" in (c as object) && !("v" in (c as object)) ? { ...(c as object), v: 0 } : c)))
const wb = XLSX.utils.book_new()
agregarHoja(wb as any, "Balance propio", conV(f1), COLS1 as any)
agregarHoja(wb as any, "Ganancia desglosada", conV(f2), COLS2 as any)
agregarHoja(wb as any, "Socios", conV(f3), COLS3 as any)
agregarHoja(wb as any, "Hacienda promedio junio", conV(f4), COLS4 as any)

/**
 * 🧮 Calcula cada fórmula (+ − * /, SUM de rango, ROUND, referencias entre solapas) y deja el resultado como valor de la celda: el libro abre
 * mostrando los números aunque Excel no recalcule, y el script puede controlar los resultados acá mismo.
 */
function recalcular(libro: XLSX.WorkBook): (hoja: string, ref: string) => number {
  const cache = new Map<string, number>()
  const val = (hoja: string, ref: string): number => {
    ref = ref.replace(/\$/g, ""); const k = hoja + "!" + ref
    if (cache.has(k)) return cache.get(k)!
    cache.set(k, 0)
    const c = (libro.Sheets[hoja] as any)?.[ref]
    const v = c ? (c.f ? evalF(hoja, c.f) : typeof c.v === "number" ? c.v : 0) : 0
    cache.set(k, v); return v
  }
  const evalF = (hoja: string, f: string): number => {
    let e = f.replace(/SUM\(((?:'[^']+'|[A-Za-z_]+)!)?\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)\)/g, (_m, sh, c1, r1, c2, r2) => {
      const h = sh ? sh.slice(0, -1).replace(/^'|'$/g, "") : hoja; let s = 0
      for (let c = XLSX.utils.decode_col(c1); c <= XLSX.utils.decode_col(c2); c++) for (let r = +r1; r <= +r2; r++) s += val(h, XLSX.utils.encode_col(c) + r)
      return "(" + s + ")"
    })
    e = e.replace(/ROUND\(/g, "R(").replace(/(?:('[^']+'|[A-Za-z_]+)!)?(\$?[A-Z]{1,2}\$?\d+)/g, (_m, sh, ref) => "(" + val(sh ? sh.replace(/^'|'$/g, "") : hoja, ref) + ")")
    const R = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d
    const r = Function("R", "return " + e)(R) as number
    return Number.isFinite(r) ? r : 0
  }
  for (const hoja of libro.SheetNames) for (const [ref, c] of Object.entries(libro.Sheets[hoja])) if (!ref.startsWith("!") && (c as any)?.f) (c as any).v = val(hoja, ref)
  return val
}
const valor = recalcular(wb)
const fila = (hoja: string, texto: string) => { const s = wb.Sheets[hoja]; const r = XLSX.utils.decode_range(s["!ref"]!); for (let i = r.s.r; i <= r.e.r; i++) { const c = (s as any)[XLSX.utils.encode_cell({ r: i, c: 0 })]; if (c && String(c.v).startsWith(texto)) return i + 1 } return 0 }
const fmtN = (x: number) => Math.round(x).toLocaleString("es-AR")
console.log(`Ganancia US$: corriente ${fmtN(valor("Balance propio", "G" + fila("Balance propio", "GANANCIA CORRIENTE")))} · total ${fmtN(valor("Balance propio", "G" + fila("Balance propio", "GANANCIA TOTAL")))}`)
for (const t of ["− Suba", "= Ganancia del ejercicio", "− Reinvertido", "= Ganancia líquida", "   control", "− Recría", "= Ganancia líquida sin", "Control de la cría"]) console.log(`   ${t.padEnd(26)} ${fmtN(valor("Ganancia desglosada", "B" + fila("Ganancia desglosada", t)))}`)
const malos = RUBROS.map(r => fila("Balance propio", `Subtotal ${r.etiqueta}`)).filter(i => i && Math.abs(valor("Balance propio", "H" + i)) > 0.01)
console.log(`   controles por rubro: ${malos.length ? "⚠ " + malos.join(", ") : "✓ todos 0"} · socios: control ${fmtN(valor("Socios", "D" + fila("Socios", "Control")))}`)
const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
let p = join(CARPETA, `Balance propio ${EMPRESA} ${String(ANIO - 1).slice(2)}-${String(ANIO).slice(2)} (${hoy}) v1.xlsx`), v = 2
while (existsSync(p)) p = join(CARPETA, `Balance propio ${EMPRESA} ${String(ANIO - 1).slice(2)}-${String(ANIO).slice(2)} (${hoy}) v${v++}.xlsx`)
writeFileSync(p, await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistasDe(wb as any)))
console.log(`📄 ${p}`)
