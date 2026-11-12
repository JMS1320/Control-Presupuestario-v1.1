/**
 * 🏦 IMPUESTOS BANCARIOS POR CUENTA — copia de trabajo (JMS 11/11: «preciso débitos y créditos pero agrupado por cuenta (cc, ca,
 * tarjeta, de un banco de otro)… la de dólares, si se pagó en dólares, expresarla en dólares y en pesos… hacéme una copia del excel
 * haciendo simplemente el desglose»).
 *
 * SÓLO LEE: la solapa «H · MSA · Imp Bancarios» del último «H para auditar» y, para lo pagado en dólares, los US$ y el TC guardados en
 * la cuota (BNA divisas vendedor del día del pago, script 194). Escribe un archivo NUEVO versionado; no toca el libro ni la base.
 * Control: el total del archivo = el TOTAL de la solapa del H.
 *
 *   npx tsx scripts/excel-imp-bancarios-por-cuenta.mts
 */
import XLSX from "xlsx-js-style"
import { readdirSync, readFileSync, existsSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { ladoImpuestoLey25413 } from "../lib/balance/grupos-templates"

const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude/"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const r2 = (n: number) => Math.round(n * 100) / 100
const MESES = ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]
const ROT = ["jul-25", "ago-25", "sep-25", "oct-25", "nov-25", "dic-25", "ene-26", "feb-26", "mar-26", "abr-26", "may-26", "jun-26"]
const ORDEN_CTA = ["Galicia CC $ MSA", "Santander CC $ MSA", "Provincia CC $ MSA", "Galicia CA US$ MSA", "VISA Business MSA"]
const TIPO_CTA: Record<string, string> = { "Galicia CC $ MSA": "Banco Galicia · Cuenta corriente en pesos", "Santander CC $ MSA": "Banco Santander · Cuenta corriente en pesos",
  "Provincia CC $ MSA": "Banco Provincia · Cuenta corriente en pesos", "Galicia CA US$ MSA": "Banco Galicia · Caja de ahorro en dólares", "VISA Business MSA": "Tarjeta VISA Business (Galicia)" }

// ── 1 · El último H para auditar
const vDe = (f: string) => Number(f.match(/ v(\d+)\.xlsx$/)?.[1] ?? 1)
const ultimo = readdirSync(CARPETA).filter(f => /^H para auditar MSA 25-26 \(2026-11-07\) v\d+\.xlsx$/.test(f)).sort((a, b) => vDe(a) - vDe(b)).at(-1)!
const rows: any[][] = XLSX.utils.sheet_to_json(XLSX.readFile(CARPETA + ultimo).Sheets["H · MSA · Imp Bancarios"], { header: 1 })
const hi = rows.findIndex(r => r && r[0] === "Nro" && r.includes("Marca")), H = rows[hi]
const col = (n: string) => { const i = H.indexOf(n); if (i < 0) throw new Error(`falta la columna ${n}`); return i }
const filaTotal = rows.find(r => r && r[1] === "TOTAL")!
const totalH = r2(Number(filaTotal.filter((x: unknown) => typeof x === "number").at(-1)))

// ── 2 · US$ y TC de las cuotas pagadas en dólares
const { data: usd, error } = await sb.from("cuotas_egresos_sin_factura").select("fecha_pago, monto, monto_usd, tipo_cambio, detalle")
  .not("monto_usd", "is", null).gte("fecha_pago", "2025-07-01").lte("fecha_pago", "2026-06-30")
if (error) throw error
const fechaIso = (x: number) => new Date(Math.round((x - 25569) * 864e5)).toISOString().slice(0, 10)
const serial = (iso: string) => Math.round(Date.parse(iso + "T00:00:00Z") / 864e5) + 25569
// JMS 12/11: pesos al BNA divisas COMPRADOR (la app guarda el vendedor; se muestran los dos). Mismo criterio de fecha que el script 194:
// la cotización del día del débito o, si ese día no hubo, la del último día hábil anterior.
const { data: cot, error: eCot } = await sb.from("cotizaciones").select("fecha, compra, venta").eq("serie", "dolar_bna_divisas").lte("fecha", "2026-06-30").order("fecha")
if (eCot) throw eCot
const tcDe = (f: string) => { let tc: any = null; for (const c of cot as any[]) { if (c.fecha <= f) { if (c.compra != null && c.venta != null) tc = c } else break } return tc }

interface Fila { cuenta: string; categoria: string; mes: string; fecha: number; pesos: number; pesosVend: number; usd: number | null; tc: number | null; fechaTc: string | null; compra: number | null; venta: number | null; concepto: string; desc: string; detalle: string; estado: string; marca: string }
const filas: Fila[] = []
let sinUsd = 0, tcDistinto = 0
for (const r of rows.slice(hi + 1)) {
  if (!r || typeof r[0] !== "number") continue
  const quien = String(r[col("Quién pagó")] ?? ""), cuenta = quien.includes("·") ? quien.split("·").at(-1)!.trim() : String(r[col("Banco / cuenta")] ?? "")
  const base = String(r[col("Cuenta de la cuota")] ?? ""), desc = String(r[col("Descripción del banco")] ?? "")
  const lado = ladoImpuestoLey25413(base, desc)
  const categoria = lado ? `Impuesto ley 25413 sobre los ${lado}` : base
  const pesos = r2((Number(r[col("Débito")]) || 0) - (Number(r[col("Crédito")]) || 0))
  const fecha = Number(r[col("Fecha")]), detalle = String(r[col("Detalle")] ?? "")
  let u: number | null = null, tc: number | null = null, fechaTc: string | null = null, compra: number | null = null, venta: number | null = null, pesosC = pesos
  if (/US\$/.test(cuenta)) {
    const m = (usd as any[]).find(q => q.fecha_pago === fechaIso(fecha) && Math.abs(Number(q.monto) - Math.abs(pesos)) < 0.01 && String(q.detalle).slice(0, 40) === detalle.slice(0, 40))
      ?? (usd as any[]).find(q => q.fecha_pago === fechaIso(fecha) && Math.abs(Number(q.monto) - Math.abs(pesos)) < 0.01)
    if (m) { u = r2(Math.sign(pesos) * Number(m.monto_usd)); tc = Number(m.tipo_cambio) } else sinUsd++
    const q = tcDe(fechaIso(fecha))
    if (q && u != null) { fechaTc = q.fecha; compra = Number(q.compra); venta = Number(q.venta); pesosC = r2(u * compra); if (Math.abs(venta - (tc ?? 0)) > 0.0001) tcDistinto++ }
  }
  filas.push({ cuenta, categoria, mes: String(r[col("Mes")]), fecha, pesos: pesosC, pesosVend: pesos, usd: u, tc, fechaTc, compra, venta, concepto: String(r[col("Concepto")] ?? ""), desc, detalle, estado: String(r[col("Estado")] ?? ""), marca: String(r[col("Marca")] ?? "") })
}

// ── 3 · Renglones del resumen: cuenta → categoría (débitos y créditos primero)
const ordCat = (c: string) => c.endsWith("débitos") ? "0" : c.endsWith("créditos") ? "1" : "2" + c
const cuentas = [...new Set(filas.map(f => f.cuenta))].sort((a, b) => (ORDEN_CTA.indexOf(a) + 1 || 99) - (ORDEN_CTA.indexOf(b) + 1 || 99))
const renglones: { nro: number; cuenta: string; categoria: string }[] = []
for (const c of cuentas) for (const cat of [...new Set(filas.filter(f => f.cuenta === c).map(f => f.categoria))].sort((a, b) => ordCat(a).localeCompare(ordCat(b))))
  renglones.push({ nro: renglones.length + 1, cuenta: c, categoria: cat })
const nroDe = (f: Fila) => renglones.find(x => x.cuenta === f.cuenta && x.categoria === f.categoria)!.nro

// ── 4 · Estilos
const AZUL = "FF1F4E3D", GRIS = "FFEEF1F0", CELESTE = "FFDDEBF7", MON = "#,##0.00", BORDE = { top: { style: "thin", color: { rgb: "FFBFBFBF" } } }
const T = (v: string) => ({ t: "s", v, s: { font: { bold: true, sz: 13, color: { rgb: AZUL } } } })
const C = (v: string) => ({ t: "s", v, s: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, fill: { patternType: "solid", fgColor: { rgb: GRIS } } } })
const S = (v: string, b = false) => ({ t: "s", v, s: b ? { font: { bold: true } } : {} })
const SUB = (v: string) => ({ t: "s", v, s: { font: { bold: true, color: { rgb: AZUL } }, fill: { patternType: "solid", fgColor: { rgb: CELESTE } } } })
const USD = '"US$" #,##0.00'
const F = (f: string, v: number, b = false, z = MON) => ({ t: "n", f, v: r2(v), z, s: b ? { font: { bold: true }, border: BORDE } : {} })
const GRANDE = (v: string) => ({ t: "s", v, s: { font: { bold: true, sz: 12, color: { rgb: "FFFFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: AZUL } } } })
const L = (c: number, r: number) => XLSX.utils.encode_cell({ c, r })

// ── 5 · Detalle (solapa propia) — columnas fijas para las fórmulas
const DET = "Detalle", NDET = filas.length + 1
const TCH = "Tipos de cambio"
const det: any[][] = [["Nro", "Cuenta", "Tipo de cuenta", "Categoría", "Mes", "Fecha", "Importe $ (dólares al TC comprador)", "Importe US$", "Fecha de la cotización", "TC BNA divisas comprador", "TC BNA divisas vendedor",
  "$ al TC vendedor (como el libro H)", "Concepto (template)", "Descripción del banco", "Detalle", "Estado", "Marca"].map(C)]
const ordenadas = [...filas].sort((a, b) => nroDe(a) - nroDe(b) || a.fecha - b.fecha)
for (const f of ordenadas) {
  const r = det.length + 1, enUsd = f.usd != null && f.compra != null
  det.push([{ t: "n", v: nroDe(f) }, S(f.cuenta), S(TIPO_CTA[f.cuenta] ?? ""), S(f.categoria), S(f.mes), { t: "n", v: f.fecha, z: "dd/mm/yyyy" },
    enUsd ? { t: "n", f: `ROUND(H${r}*J${r},2)`, v: f.pesos, z: MON } : { t: "n", v: f.pesos, z: MON },
    f.usd == null ? S("") : { t: "n", v: f.usd, z: USD },
    enUsd ? { t: "n", v: serial(f.fechaTc!), z: "dd/mm/yyyy" } : S(""),
    enUsd ? { t: "n", f: `VLOOKUP(I${r},'${TCH}'!$A:$C,2,FALSE)`, v: f.compra, z: MON } : S(""),
    enUsd ? { t: "n", f: `VLOOKUP(I${r},'${TCH}'!$A:$C,3,FALSE)`, v: f.venta, z: MON } : S(""),
    enUsd ? { t: "n", f: `ROUND(H${r}*K${r},2)`, v: f.pesosVend, z: MON } : { t: "n", f: `G${r}`, v: f.pesosVend, z: MON },
    S(f.concepto), S(f.desc), S(f.detalle), S(f.estado), S(f.marca)])
}
// la solapa de cotizaciones: sólo los días usados
const dias = [...new Set(filas.filter(f => f.fechaTc).map(f => f.fechaTc!))].sort()
const tch: any[][] = [[T("TIPOS DE CAMBIO usados — dólar BNA divisas (Banco Nación), comprador y vendedor")],
  [S("Para cotejar con las cotizaciones históricas que publica el Banco Nación. Si el día del débito no hubo cotización (fin de semana o feriado), se usa la del último día hábil anterior.")], [],
  ["Fecha", "Comprador", "Vendedor", "Diferencia", "Débitos que la usan"].map(C)]
for (const d of dias) { const c = (cot as any[]).find(x => x.fecha === d), r = tch.length + 1
  tch.push([{ t: "n", v: serial(d), z: "dd/mm/yyyy" }, { t: "n", v: Number(c.compra), z: MON }, { t: "n", v: Number(c.venta), z: MON }, { t: "n", f: `C${r}-B${r}`, v: Number(c.venta) - Number(c.compra), z: MON },
    { t: "n", f: `COUNTIF(${DET}!$I:$I,A${r})`, v: filas.filter(f => f.fechaTc === d).length }]) }
const sumif = (colSuma: string, nro: string, mes?: string) => `SUMIFS(${DET}!$${colSuma}$2:$${colSuma}$${NDET},${DET}!$A$2:$A$${NDET},${nro}${mes ? `,${DET}!$E$2:$E$${NDET},"${mes}"` : ""})`

// ── 6 · Resumen: pesos por cuenta; abajo, la cuenta en dólares en US$
const res: any[][] = [[T(`IMPUESTOS BANCARIOS POR CUENTA — MSA — ejercicio 25/26 (copia de trabajo, desde ${ultimo})`)],
  [S("Débitos y créditos separados, agrupado por banco y tipo de cuenta. PESOS y DÓLARES NO SE MEZCLAN: 1 = cuentas en pesos · 2 = cuentas en dólares (en US$ y en $) · 3 = total en pesos. Cada celda es una fórmula sobre la solapa «Detalle»: filtrá ahí por Nro.")], []]
// JMS 12/11: en esta copia NO van los semestres (en general sí, y separados de los meses)
const ENC = ["Nro", "Cuenta", "Categoría", ...ROT, "Total"]
const bloque = (titulo: string, cuentasB: string[], colSuma: string, valor: (f: Fila) => number, z = MON, rotTotal = "TOTAL") => {
  res.push([SUB(titulo)]); res.push(ENC.map(C))
  const filasTotalCuenta: number[] = []
  for (const c of cuentasB) {
    const propios = renglones.filter(x => x.cuenta === c), ini = res.length
    for (const x of propios) {
      const r = res.length, de = filas.filter(f => nroDe(f) === x.nro), val = (m?: string) => de.filter(f => !m || f.mes === m).reduce((t, f) => t + valor(f), 0)
      res.push([{ t: "n", v: x.nro }, S(c), S(x.categoria),
        ...MESES.map(m => F(sumif(colSuma, L(0, r), m), val(m), false, z)), F(`SUM(${L(3, r)}:${L(14, r)})`, val(), false, z)])
    }
    const r = res.length; filasTotalCuenta.push(r)
    const tot = (j: number) => res.slice(ini, r).reduce((t, f) => t + Number(f[j].v), 0)
    if (cuentasB.length > 1) { res.push([S(""), S(`Total ${c}`, true), S(TIPO_CTA[c] ?? "", true), ...Array.from({ length: 13 }, (_, j) => F(`SUM(${L(j + 3, ini)}:${L(j + 3, r - 1)})`, tot(j + 3), true, z))]); res.push([]) }
    else filasTotalCuenta.pop()
  }
  const r = res.length
  if (cuentasB.length > 1) res.push([S(""), S(rotTotal, true), S(""), ...Array.from({ length: 13 }, (_, j) => F(filasTotalCuenta.map(k => L(j + 3, k)).join("+"), filasTotalCuenta.reduce((t, k) => t + Number(res[k][j + 3].v), 0), true, z))])
  else { const a = r - renglones.filter(x => x.cuenta === cuentasB[0]).length
    res.push([S(""), S(rotTotal, true), S(TIPO_CTA[cuentasB[0]] ?? "", true), ...Array.from({ length: 13 }, (_, j) => F(`SUM(${L(j + 3, a)}:${L(j + 3, r - 1)})`, res.slice(a, r).reduce((t, f) => t + Number(f[j + 3].v), 0), true, z))]) }
  res.push([]); return r
}
const ctasUsd = cuentas.filter(c => /US\$/.test(c)), ctasPesos = cuentas.filter(c => !ctasUsd.includes(c))

// 1 · CUENTAS EN PESOS
res.push([GRANDE("1 · CUENTAS EN PESOS — importes en pesos")]); res.push([])
const rPesos = bloque("Cuentas corrientes y tarjeta, en pesos", ctasPesos, "G", f => f.pesos, MON, "TOTAL CUENTAS EN PESOS ($)")

// 2 · CUENTAS EN DÓLARES
let rUsdPesos = -1
if (ctasUsd.length) {
  const du = filas.filter(f => ctasUsd.includes(f.cuenta)), tcs = du.map(f => f.tc!).filter(Boolean)
  const totU = r2(du.reduce((t, f) => t + (f.usd ?? 0), 0)), totP = r2(du.reduce((t, f) => t + f.pesos, 0))
  res.push([GRANDE(`2 · CUENTAS EN DÓLARES — ${ctasUsd.join(", ")} (${ctasUsd.map(c => TIPO_CTA[c]).join(", ")})`)])
  const cps = du.map(f => f.compra!).filter(Boolean), totPV = r2(du.reduce((t, f) => t + f.pesosVend, 0))
  const n2 = (x: number) => x.toLocaleString("es-AR", { minimumFractionDigits: 2 })
  res.push([S("CÓMO SE PASÓ A PESOS:", true)])
  res.push([S("· Cuenta: Banco Galicia, caja de ahorro en dólares de MSA. Cada débito se cruza con su extracto en US$ del ejercicio (jul-25 a jun-26).")])
  res.push([S("· El banco debita estos impuestos EN DÓLARES: ése es el dato original → cuadro 2.a, abajo.")])
  res.push([S("· Pasaje a pesos: cada débito × dólar BNA divisas COMPRADOR del día del débito (sin cotización ese día —fin de semana o feriado— se toma la del último día hábil anterior) → cuadro 2.b, abajo.")])
  res.push([S("· Para auditar: la solapa «Tipos de cambio» tiene la cotización BNA de cada día usado (comprador y vendedor); en «Detalle» cada débito trae la fecha de la cotización, los dos TC y los pesos como fórmula US$ × TC.")])
  res.push([S(`· ${du.length} débitos · US$ ${n2(totU)} → $ ${n2(totP)} al comprador (al vendedor serían $ ${n2(totPV)}) · TC comprador usados entre ${Math.min(...cps).toLocaleString("es-AR")} y ${Math.max(...cps).toLocaleString("es-AR")}. La fila «TC implícito» es pesos ÷ US$ del mes.`)])
  res.push([])
  const rU = bloque("2.a · EN DÓLARES (US$) — moneda de la cuenta", ctasUsd, "H", f => f.usd ?? 0, USD, "TOTAL EN US$")
  rUsdPesos = bloque("2.b · EN PESOS ($) — los mismos débitos × TC BNA divisas COMPRADOR del día", ctasUsd, "G", f => f.pesos, MON, "TOTAL EN PESOS ($)")
  res.push([S(""), S("TC implícito del mes ($ ÷ US$)"), S(""), ...Array.from({ length: 13 }, (_, j) => { const u = Number(res[rU][j + 3].v), p = Number(res[rUsdPesos][j + 3].v)
    return F(`IF(${L(j + 3, rU)}=0,"",${L(j + 3, rUsdPesos)}/${L(j + 3, rU)})`, u ? p / u : 0) })])
  res.push([])
}

// 3 · TOTAL GENERAL EN PESOS
res.push([GRANDE("3 · TOTAL GENERAL EN PESOS = 1 (cuentas en pesos) + 2.b (cuentas en dólares, pasadas a pesos)")])
const rTotal = res.length
res.push([S(""), S("TOTAL GENERAL ($)", true), S(""), ...Array.from({ length: 13 }, (_, j) => F(rUsdPesos >= 0 ? `${L(j + 3, rPesos)}+${L(j + 3, rUsdPesos)}` : `${L(j + 3, rPesos)}`,
  Number(res[rPesos][j + 3].v) + (rUsdPesos >= 0 ? Number(res[rUsdPesos][j + 3].v) : 0), true))])
res.push([])

// control
const totalArchivo = r2(filas.reduce((t, f) => t + f.pesos, 0)), totalVend = r2(filas.reduce((t, f) => t + f.pesosVend, 0)), ok = Math.abs(totalVend - totalH) < 0.01
res.push([SUB("CONTROL")])
const c0 = res.length
res.push([S(""), S("Total de este archivo (dólares al TC comprador)"), S(""), F(`${L(15, rTotal)}`, totalArchivo)])
res.push([S(""), S("Lo mismo con los dólares al TC vendedor (columna L del Detalle)"), S(""), F(`SUM(${DET}!L2:L${NDET})`, totalVend)])
res.push([S(""), S(`TOTAL de la solapa «H · MSA · Imp Bancarios» de ${ultimo} (usa el vendedor)`), S(""), { t: "n", v: totalH, z: MON }])
res.push([S(""), S("Diferencia al vendedor contra el libro H"), S(""), F(`${L(3, c0 + 1)}-${L(3, c0 + 2)}`, r2(totalVend - totalH)), S(ok ? "✓ cierra" : "⚠️ NO cierra", true)])
res.push([S(""), S("Efecto de usar el comprador en vez del vendedor"), S(""), F(`${L(3, c0)}-${L(3, c0 + 1)}`, r2(totalArchivo - totalVend))])
res.push([S(""), S("TC vendedor de la solapa «Tipos de cambio» = el usado en el libro H para cada débito (cantidad distintos)"), S(""), { t: "n", v: tcDistinto }, S(tcDistinto ? `⚠️ ${tcDistinto} distintos` : "✓ todos iguales", true)])
if (sinUsd) res.push([S(""), S(`⚠️ ${sinUsd} renglón(es) de la cuenta en dólares sin US$ encontrado: figuran en pesos y no en el cuadro en dólares`)])

// ── 7 · Libro
const wb = XLSX.utils.book_new()
const hoja = (aoa: any[][], anchos: number[], congelar: number, filtro?: string) => {
  const ws = XLSX.utils.aoa_to_sheet([[]]); aoa.forEach((f, r) => f.forEach((c, j) => { if (c) ws[L(j, r)] = c }))
  ws["!ref"] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: Math.max(...aoa.map(f => f.length)) - 1, r: aoa.length - 1 } })
  ws["!cols"] = anchos.map(w => ({ wch: w })); (ws as any)["!views"] = [{ state: "frozen", ySplit: congelar, xSplit: 3 }]
  if (filtro) ws["!autofilter"] = { ref: filtro }
  return ws
}
XLSX.utils.book_append_sheet(wb, hoja(res, [6, 24, 40, ...MESES.map(() => 13), 15], 5), "Por cuenta")
XLSX.utils.book_append_sheet(wb, hoja(det, [6, 22, 38, 36, 9, 11, 16, 12, 12, 12, 12, 16, 30, 40, 50, 12, 6], 1, `A1:Q${NDET}`), DET)
XLSX.utils.book_append_sheet(wb, hoja(tch, [12, 12, 12, 12, 12], 4, `A4:E${tch.length}`), TCH)
let v = 1; const nombre = () => `${CARPETA}Imp Bancarios por cuenta MSA 25-26 (2026-11-11) v${v}.xlsx`
while (existsSync(nombre())) v++
XLSX.writeFile(wb, nombre())
console.log(`📄 ${nombre()}\n   ${filas.length} renglones · ${renglones.length} líneas de resumen · cuentas: ${cuentas.join(" | ")}`)
console.log(`   total comprador ${totalArchivo} · vendedor ${totalVend} vs H ${totalH} → ${ok ? "✓" : "⚠️ NO cierra"} · USD sin TC: ${sinUsd} · TC distintos: ${tcDistinto} · días de cotización ${dias.length}`)
for (const c of cuentas) console.log(`   ${c}: ${r2(filas.filter(f => f.cuenta === c).reduce((t, f) => t + f.pesos, 0))}${/US\$/.test(c) ? ` · US$ ${r2(filas.filter(f => f.cuenta === c).reduce((t, f) => t + (f.usd ?? 0), 0))}` : ""}`)
for (const x of renglones.filter(x => /25413/.test(x.categoria))) console.log(`   ${x.nro} ${x.cuenta} · ${x.categoria}: ${r2(filas.filter(f => nroDe(f) === x.nro).reduce((t, f) => t + f.pesos, 0))}`)
