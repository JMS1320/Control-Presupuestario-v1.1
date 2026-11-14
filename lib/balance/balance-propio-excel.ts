/**
 * 📸 EL BALANCE PROPIO EN EXCEL — con el modelo de la planilla de JMS (BAPU, solapa NOTAS) — A-FEAT-1190 (JMS 14/11: «tiene que ser un
 * exportable»). Lo usan el script `scripts/excel-balance-propio.mts` y la app (Reportes → Balance): el MISMO libro por los dos caminos.
 *
 *   1. «Balance propio»: $ inicio · $ cierre · dif $ · US$ inicio · US$ cierre · dif US$ (cada punta con SU dólar), subtotal y CONTROL por rubro
 *      como en su planilla, y los totales (activo, activo corriente sin las vacas, pasivo corriente, A − P corriente, pasivo total, A − P total).
 *      Los FLUJOS del año (MEP, distribución de fondos) van sólo en el cierre (en el inicio, 0), como en su planilla.
 *   2. «Ganancia desglosada» (si viene la hacienda por categoría): total − revalúo de las vacas − reinvertido en vacas − recría.
 *   3. «Socios» (si viene): lo que se llevó cada socio en el año (saldo con MSA al inicio − al cierre).
 *   4. «Hacienda promedio junio» (si viene): cabezas, precio por cabeza de cada punta y de dónde sale.
 * Todo con FÓRMULAS, y calculadas (el libro abre con los números aunque Excel no recalcule). Pura: no lee la base.
 */
import XLSX from "xlsx-js-style"
import { RENGLONES, RUBROS } from "./balance-propio"
import { agregarHoja } from "./export-libro-diario"
import { MONEDA } from "./formato-excel"

/** Los renglones que en la planilla de JMS van SÓLO en la columna del cierre: son flujos del año, no saldos. */
export const FLUJOS_DEL_ANIO = new Set(["distribucion_fondos", "dolares_mep"])
/** JMS 14/11: las vacas y los toros son la FÁBRICA → activo NO corriente (la ganancia corriente no los incluye). */
export const ACTIVO_NO_CORRIENTE = new Set(["stock_cria", "equinos", "bienes_uso_neto"])

export interface PuntaBalancePropio { fecha: string; tc: number; tcFuente?: string | null; valores: Map<string, { importe: number; detalle?: string | null }> }
export interface CategoriaHacienda { nombre: string; rodeo: "cría" | "recría"; c0: number; p0: number | null; c1: number; p1: number | null; fuente?: string }
export interface SocioBalancePropio { s: string; ini: number; cie: number; pagado?: number }

/** 🧮 La ganancia con el modelo de su planilla (US$): corriente (sin las vacas) y total. Pura, para la pantalla y los casos. */
export function gananciaBapu(inicio: PuntaBalancePropio, cierre: PuntaBalancePropio) {
  const lado = Object.fromEntries(RUBROS.map(r => [r.id, r]))
  const T = { a: [0, 0], ac: [0, 0], pc: [0, 0], pt: [0, 0] }
  for (const r of RENGLONES) {
    const a = FLUJOS_DEL_ANIO.has(r.id) ? 0 : inicio.valores.get(r.id)?.importe ?? 0, b = cierre.valores.get(r.id)?.importe ?? 0
    const rb = lado[r.rubro]
    if (rb.lado === "activo") { T.a[0] += a; T.a[1] += b; if (!ACTIVO_NO_CORRIENTE.has(r.id)) { T.ac[0] += a; T.ac[1] += b } }
    else { T.pt[0] += a; T.pt[1] += b; if (rb.corriente) { T.pc[0] += a; T.pc[1] += b } }
  }
  const usd = (x: number[], y: number[]) => (x[1] - y[1]) / cierre.tc - (x[0] - y[0]) / inicio.tc
  return { corrienteUsd: usd(T.ac, T.pc), totalUsd: usd(T.a, T.pt), corrientePesos: (T.ac[1] - T.pc[1]) - (T.ac[0] - T.pc[0]), totalPesos: (T.a[1] - T.pt[1]) - (T.a[0] - T.pt[0]) }
}

export function armarLibroBalancePropio(d: { empresa: string; inicio: PuntaBalancePropio; cierre: PuntaBalancePropio; hacienda?: CategoriaHacienda[]; socios?: SocioBalancePropio[]; comercializacion?: number }): XLSX.WorkBook {
  const { empresa, inicio: fi, cierre: fc } = d
  const n = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100) / 100)
  const dmy = (s: string) => s.split("-").reverse().join("/")
  const anioI = fi.fecha.slice(0, 4), anioC = fc.fecha.slice(0, 4)

  // ── 1 · Balance propio — A concepto · B $ inicio · C $ cierre · D dif $ · E US$ inicio · F US$ cierre · G dif US$ · H de dónde sale
  const f1: unknown[][] = []
  f1.push([`BALANCE PROPIO — ${empresa} — determinación de ganancia según activo menos pasivo — ${dmy(fi.fecha)} → ${dmy(fc.fecha)}`])
  f1.push(["Modelo de tu planilla (BAPU, solapa NOTAS). Análisis económico propio: distinto de lo que se presenta al contador. Hacienda a promedio de junio menos 10 % de comercialización. Impuestos sin dato del cierre: neutros (mismos US$)."])
  f1.push(["Dólar de cada punta (promedio de divisas BNA)", fi.tc, fc.tc, "", fi.tcFuente ?? "", fc.tcFuente ?? ""])
  const FILA_TC = f1.length
  f1.push([])
  f1.push(["Concepto", `$ ${anioI}`, `$ ${anioC}`, "Diferencia $", `US$ ${anioI}`, `US$ ${anioC}`, "Diferencia US$", "De dónde sale el cierre"])
  const subtot: Record<string, number> = {}, filaDe: Record<string, number> = {}
  const filasAC: number[] = []
  for (const rb of RUBROS) {
    f1.push([`${rb.etiqueta.toUpperCase()} (${rb.lado}${rb.corriente ? ", corriente" : ", no corriente"})`])
    const desde = f1.length + 1
    for (const r of RENGLONES.filter(x => x.rubro === rb.id)) {
      const a = FLUJOS_DEL_ANIO.has(r.id) ? 0 : fi.valores.get(r.id)?.importe ?? null, b = fc.valores.get(r.id)?.importe ?? null
      if (a == null && b == null) continue
      const fila = f1.length + 1; filaDe[r.id] = fila
      f1.push([r.etiqueta, n(a ?? 0), n(b ?? 0), { t: "n", f: `C${fila}-B${fila}` }, { t: "n", f: `B${fila}/$B$${FILA_TC}` }, { t: "n", f: `C${fila}/$C$${FILA_TC}` }, { t: "n", f: `F${fila}-E${fila}` },
        (FLUJOS_DEL_ANIO.has(r.id) && fi.valores.get(r.id) ? `flujo del año: en el inicio va 0 (tu foto decía ${fi.valores.get(r.id)!.importe.toLocaleString("es-AR")}) · ` : "") + String(fc.valores.get(r.id)?.detalle ?? "").replace(/^\[script \d+\] /, "")])
      if (rb.lado === "activo" && !ACTIVO_NO_CORRIENTE.has(r.id)) filasAC.push(fila)
    }
    const hasta = f1.length, fila = f1.length + 1
    const s = (c: string) => (hasta >= desde ? { t: "n", f: `SUM(${c}${desde}:${c}${hasta})` } : 0)
    f1.push([`Subtotal ${rb.etiqueta}`, s("B"), s("C"), s("D"), s("E"), s("F"), s("G"), { t: "n", f: `ROUND((C${fila}/$C$${FILA_TC}-B${fila}/$B$${FILA_TC})-G${fila},2)` }])
    subtot[rb.id] = fila
    f1.push([])
  }
  const sumaDe = (ids: string[], c: string) => (ids.length ? ids.map(id => `${c}${subtot[id]}`).join("+") : "0")
  const sumaFilas = (fs: number[], c: string) => (fs.length ? fs.map(x => `${c}${x}`).join("+") : "0")
  const ACT = RUBROS.filter(r => r.lado === "activo").map(r => r.id), PC = RUBROS.filter(r => r.lado === "pasivo" && r.corriente).map(r => r.id), PT = RUBROS.filter(r => r.lado === "pasivo").map(r => r.id)
  const tot: Record<string, number> = {}
  const totFila = (k: string, nombre: string, fn: (c: string) => string) => { tot[k] = f1.length + 1; f1.push([nombre, ...["B", "C", "D", "E", "F", "G"].map(c => ({ t: "n", f: fn(c) }))]) }
  totFila("act", "ACTIVO", c => sumaDe(ACT, c))
  totFila("ac", "ACTIVO CORRIENTE (sin las vacas: son la fábrica)", c => sumaFilas(filasAC, c))
  totFila("pc", "PASIVO CORRIENTE", c => sumaDe(PC, c))
  totFila("apc", "ACTIVO CORRIENTE MENOS PASIVO CORRIENTE", c => `${c}${tot.ac}-${c}${tot.pc}`)
  totFila("pt", "PASIVO TOTAL", c => sumaDe(PT, c))
  totFila("apt", "ACTIVO MENOS PASIVO TOTAL", c => `${c}${tot.act}-${c}${tot.pt}`)
  f1.push([])
  f1.push(["GANANCIA CORRIENTE (diferencia en US$ de activo corriente − pasivo corriente)", "", "", "", "", "", { t: "n", f: `G${tot.apc}` }])
  const FILA_GC = f1.length
  f1.push(["GANANCIA TOTAL (diferencia en US$ de activo − pasivo total)", "", "", "", "", "", { t: "n", f: `G${tot.apt}` }])
  const FILA_GT = f1.length
  const COLS1 = [{ ancho: 52 }, { ancho: 17, z: MONEDA }, { ancho: 17, z: MONEDA }, { ancho: 17, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 70 }]

  // ── 4 · Hacienda (se arma antes: el desglose la referencia)
  const cz = d.comercializacion ?? 0.1
  const H = d.hacienda ?? []
  const f4: unknown[][] = [["HACIENDA — PROMEDIO DE JUNIO de cada año (análisis propio, distinto de lo presentado al contador)"],
    ["Precio por cabeza: promedio del mes de junio consultando el rango en Entre Surcos y Cañuelas, mismos criterios de la app. Sin el 10 % (se aplica abajo)."],
    ["Comercialización", cz], []]
  const FILA_CZ = 3
  f4.push(["Categoría", "Rodeo", `Cabezas ${anioI}`, `$ por cabeza ${anioI}`, `Cabezas ${anioC}`, `$ por cabeza ${anioC}`, `Valor ${anioI} (neto)`, `Valor ${anioC} (neto)`, "Por precio US$", "Por cantidad US$", `Fuente ${anioC}`])
  const tc0 = `'Balance propio'!$B$${FILA_TC}`, tc1 = `'Balance propio'!$C$${FILA_TC}`
  const filasCria: number[] = [], filasRecria: number[] = []
  for (const x of [...H.filter(h => h.rodeo === "cría"), ...H.filter(h => h.rodeo === "recría")]) {
    const fila = f4.length + 1; (x.rodeo === "cría" ? filasCria : filasRecria).push(fila)
    f4.push([x.nombre, x.rodeo === "cría" ? "cría (fábrica)" : "recría (producido)", x.c0, n(x.p0), x.c1, n(x.p1),
      { t: "n", f: `C${fila}*D${fila}*(1-$B$${FILA_CZ})` }, { t: "n", f: `E${fila}*F${fila}*(1-$B$${FILA_CZ})` },
      { t: "n", f: `(F${fila}*(1-$B$${FILA_CZ})/${tc1}-D${fila}*(1-$B$${FILA_CZ})/${tc0})*E${fila}` },
      { t: "n", f: `(E${fila}-C${fila})*D${fila}*(1-$B$${FILA_CZ})/${tc0}` }, x.fuente ?? ""])
  }
  const sumaCol = (fs: number[], c: string) => (fs.length ? { t: "n", f: fs.map(x => `${c}${x}`).join("+") } : 0)
  f4.push(["Total cría", "", sumaCol(filasCria, "C"), "", sumaCol(filasCria, "E"), "", sumaCol(filasCria, "G"), sumaCol(filasCria, "H"), sumaCol(filasCria, "I"), sumaCol(filasCria, "J")])
  const FILA_TCRIA = f4.length
  f4.push(["Total recría", "", sumaCol(filasRecria, "C"), "", sumaCol(filasRecria, "E"), "", sumaCol(filasRecria, "G"), sumaCol(filasRecria, "H")])
  const COLS4 = [{ ancho: 24 }, { ancho: 18 }, { ancho: 10 }, { ancho: 15, z: MONEDA }, { ancho: 10 }, { ancho: 15, z: MONEDA }, { ancho: 17, z: MONEDA }, { ancho: 17, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 60 }]

  // ── 2 · Ganancia desglosada
  const HJ = "'Hacienda promedio junio'"
  const fRec = filaDe.stock_recria, fCria = filaDe.stock_cria
  const f2: unknown[][] = [["CUÁNTO DE LA GANANCIA ES PLATA PARA DISTRIBUIR (US$)"],
    ["Las vacas y los toros son la fábrica: que suba su precio no es ganancia. Lo que se guardó en vacas es ganancia reinvertida. La recría es producido, pero hoy es un activo, no plata."], [],
    ["Ganancia total", { t: "n", f: `'Balance propio'!G${FILA_GT}` }, "activo − pasivo total, diferencia en US$"]]
  if (H.length) {
    f2.push(["− Suba del precio de las vacas y toros", { t: "n", f: `-${HJ}!I${FILA_TCRIA}` }, "revalúo de la fábrica: no es ganancia"],
      ["= Ganancia del ejercicio", { t: "n", f: "B4+B5" }],
      ["− Reinvertido en vacas (más cabezas)", { t: "n", f: `-${HJ}!J${FILA_TCRIA}` }, "terneras que se guardaron y pasaron a ser fábrica, al precio del inicio"],
      ["= Ganancia líquida", { t: "n", f: "B6+B7" }, "control: tiene que dar igual a la ganancia corriente"],
      ["   control (líquida − corriente = 0)", { t: "n", f: `ROUND(B8-'Balance propio'!G${FILA_GC},0)` }],
      ["− Recría", fRec ? { t: "n", f: `-'Balance propio'!G${fRec}` } : 0, "producido que se puede vender, pero hoy es un activo"],
      ["= Ganancia líquida sin la recría", { t: "n", f: "B8+B10" }], [],
      ["Control de la cría: revalúo + reinvertido = variación del stock de cría en US$", fCria ? { t: "n", f: `ROUND(${HJ}!I${FILA_TCRIA}+${HJ}!J${FILA_TCRIA}-'Balance propio'!G${fCria},0)` } : "", "tiene que dar 0"])
  } else f2.push([], ["⚠️ Falta la hacienda por categoría: el desglose sale cuando se bajan los papeles con «Traer stock y precios»."])
  const COLS2 = [{ ancho: 58 }, { ancho: 16, z: MONEDA }, { ancho: 70 }]

  // ── 3 · Socios
  const S = d.socios ?? []
  const f3: unknown[][] = [["DISTRIBUCIÓN DE FONDOS, SOCIO POR SOCIO"], ["Saldo con la empresa (negativo = el socio le debe). Lo que se llevó en el año (neto) = saldo al inicio − saldo al cierre."], [],
    ["Socio", `Saldo al ${dmy(fi.fecha)}`, `Saldo al ${dmy(fc.fecha)}`, "Se llevó en el año (neto)", "en US$", "Pagos al socio (bruto)"]]
  const s0 = f3.length + 1
  for (const x of S) { const fila = f3.length + 1; f3.push([x.s, x.ini, x.cie, { t: "n", f: `B${fila}-C${fila}` }, { t: "n", f: `D${fila}/'Balance propio'!$C$${FILA_TC}` }, x.pagado ?? ""]) }
  if (S.length) {
    const s1 = f3.length
    f3.push(["Total", "", "", { t: "n", f: `SUM(D${s0}:D${s1})` }, { t: "n", f: `SUM(E${s0}:E${s1})` }, { t: "n", f: `SUM(F${s0}:F${s1})` }])
    if (filaDe.distribucion_fondos) f3.push(["Control: total − renglón «Distribución de fondos» del balance (tiene que dar 0)", "", "", { t: "n", f: `ROUND(D${f3.length}-'Balance propio'!C${filaDe.distribucion_fondos},0)` }])
  } else f3.push(["(sin el detalle por socio en este armado)"])
  const COLS3 = [{ ancho: 30 }, { ancho: 17, z: MONEDA }, { ancho: 17, z: MONEDA }, { ancho: 19, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 19, z: MONEDA }]

  // Una celda con fórmula necesita un valor para que se escriba; el valor real lo calcula `recalcularFormulas`.
  const conV = (fs: unknown[][]) => fs.map(r => r.map(c => (c && typeof c === "object" && "f" in (c as object) && !("v" in (c as object)) ? { ...(c as object), v: 0 } : c)))
  const wb = XLSX.utils.book_new()
  agregarHoja(wb as any, "Balance propio", conV(f1), COLS1 as any)
  agregarHoja(wb as any, "Ganancia desglosada", conV(f2), COLS2 as any)
  agregarHoja(wb as any, "Socios", conV(f3), COLS3 as any)
  agregarHoja(wb as any, "Hacienda promedio junio", conV(f4), COLS4 as any)
  recalcularFormulas(wb)
  return wb
}

/**
 * 🧮 Calcula cada fórmula simple (+ − * /, SUM de rango, ROUND, referencias entre solapas) y la deja como valor de la celda: el libro abre
 * mostrando los números aunque Excel no recalcule, y quien lo arma puede controlar los resultados. Devuelve el lector de valores.
 */
export function recalcularFormulas(libro: XLSX.WorkBook): (hoja: string, ref: string) => number {
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
    const R = (x: number, dd: number) => Math.round(x * 10 ** dd) / 10 ** dd
    try { const r = Function("R", "return " + e)(R) as number; return Number.isFinite(r) ? r : 0 } catch { return 0 }
  }
  for (const hoja of libro.SheetNames) for (const [ref, c] of Object.entries(libro.Sheets[hoja])) if (!ref.startsWith("!") && (c as any)?.f) (c as any).v = val(hoja, ref)
  return val
}
