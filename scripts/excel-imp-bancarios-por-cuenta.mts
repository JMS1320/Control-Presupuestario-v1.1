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

interface Fila { cuenta: string; categoria: string; mes: string; fecha: number; pesos: number; usd: number | null; tc: number | null; concepto: string; desc: string; detalle: string; estado: string; marca: string }
const filas: Fila[] = []
let sinUsd = 0
for (const r of rows.slice(hi + 1)) {
  if (!r || typeof r[0] !== "number") continue
  const quien = String(r[col("Quién pagó")] ?? ""), cuenta = quien.includes("·") ? quien.split("·").at(-1)!.trim() : String(r[col("Banco / cuenta")] ?? "")
  const base = String(r[col("Cuenta de la cuota")] ?? ""), desc = String(r[col("Descripción del banco")] ?? "")
  const lado = ladoImpuestoLey25413(base, desc)
  const categoria = lado ? `Impuesto ley 25413 sobre los ${lado}` : base
  const pesos = r2((Number(r[col("Débito")]) || 0) - (Number(r[col("Crédito")]) || 0))
  const fecha = Number(r[col("Fecha")]), detalle = String(r[col("Detalle")] ?? "")
  let u: number | null = null, tc: number | null = null
  if (/US\$/.test(cuenta)) {
    const m = (usd as any[]).find(q => q.fecha_pago === fechaIso(fecha) && Math.abs(Number(q.monto) - Math.abs(pesos)) < 0.01 && String(q.detalle).slice(0, 40) === detalle.slice(0, 40))
      ?? (usd as any[]).find(q => q.fecha_pago === fechaIso(fecha) && Math.abs(Number(q.monto) - Math.abs(pesos)) < 0.01)
    if (m) { u = r2(Math.sign(pesos) * Number(m.monto_usd)); tc = Number(m.tipo_cambio) } else sinUsd++
  }
  filas.push({ cuenta, categoria, mes: String(r[col("Mes")]), fecha, pesos, usd: u, tc, concepto: String(r[col("Concepto")] ?? ""), desc, detalle, estado: String(r[col("Estado")] ?? ""), marca: String(r[col("Marca")] ?? "") })
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
const F = (f: string, v: number, b = false) => ({ t: "n", f, v: r2(v), z: MON, s: b ? { font: { bold: true }, border: BORDE } : {} })
const L = (c: number, r: number) => XLSX.utils.encode_cell({ c, r })

// ── 5 · Detalle (solapa propia) — columnas fijas para las fórmulas
const DET = "Detalle", NDET = filas.length + 1
const det: any[][] = [["Nro", "Cuenta", "Tipo de cuenta", "Categoría", "Mes", "Fecha", "Importe $", "Importe US$", "TC (BNA divisas vendedor)", "Concepto (template)", "Descripción del banco", "Detalle", "Estado", "Marca"].map(C)]
const ordenadas = [...filas].sort((a, b) => nroDe(a) - nroDe(b) || a.fecha - b.fecha)
for (const f of ordenadas) det.push([{ t: "n", v: nroDe(f) }, S(f.cuenta), S(TIPO_CTA[f.cuenta] ?? ""), S(f.categoria), S(f.mes), { t: "n", v: f.fecha, z: "dd/mm/yyyy" },
  { t: "n", v: f.pesos, z: MON }, f.usd == null ? S("") : { t: "n", v: f.usd, z: MON }, f.tc == null ? S("") : { t: "n", v: f.tc, z: MON },
  S(f.concepto), S(f.desc), S(f.detalle), S(f.estado), S(f.marca)])
const sumif = (colSuma: string, nro: string, mes?: string) => `SUMIFS(${DET}!$${colSuma}$2:$${colSuma}$${NDET},${DET}!$A$2:$A$${NDET},${nro}${mes ? `,${DET}!$E$2:$E$${NDET},"${mes}"` : ""})`

// ── 6 · Resumen: pesos por cuenta; abajo, la cuenta en dólares en US$
const res: any[][] = [[T(`IMPUESTOS BANCARIOS POR CUENTA — MSA — ejercicio 25/26 (copia de trabajo, desde ${ultimo})`)],
  [S("Débitos y créditos separados, agrupado por banco y tipo de cuenta. Cada celda es una fórmula sobre la solapa «Detalle»: filtrá ahí por Nro para ver cómo se compone.")], []]
// JMS 12/11: en esta copia NO van los semestres (en general sí, y separados de los meses)
const ENC = ["Nro", "Cuenta", "Categoría", ...ROT, "Total"]
const bloque = (titulo: string, cuentasB: string[], colSuma: string, valor: (f: Fila) => number) => {
  res.push([SUB(titulo)]); res.push(ENC.map(C))
  const filasTotalCuenta: number[] = []
  for (const c of cuentasB) {
    const propios = renglones.filter(x => x.cuenta === c), ini = res.length
    for (const x of propios) {
      const r = res.length, de = filas.filter(f => nroDe(f) === x.nro), val = (m?: string) => de.filter(f => !m || f.mes === m).reduce((t, f) => t + valor(f), 0)
      res.push([{ t: "n", v: x.nro }, S(c), S(x.categoria),
        ...MESES.map(m => F(sumif(colSuma, L(0, r), m), val(m))), F(`SUM(${L(3, r)}:${L(14, r)})`, val())])
    }
    const r = res.length; filasTotalCuenta.push(r)
    const tot = (j: number) => res.slice(ini, r).reduce((t, f) => t + Number(f[j].v), 0)
    res.push([S(""), S(`Total ${c}`, true), S(TIPO_CTA[c] ?? "", true), ...Array.from({ length: 13 }, (_, j) => F(`SUM(${L(j + 3, ini)}:${L(j + 3, r - 1)})`, tot(j + 3), true))])
    res.push([])
  }
  const r = res.length
  res.push([S(""), S("TOTAL", true), S(""), ...Array.from({ length: 13 }, (_, j) => F(filasTotalCuenta.map(k => L(j + 3, k)).join("+"), filasTotalCuenta.reduce((t, k) => t + Number(res[k][j + 3].v), 0), true))])
  res.push([]); return r
}
const rTotal = bloque("EN PESOS — todas las cuentas (lo pagado en dólares, pasado a pesos al BNA divisas vendedor del día del pago)", cuentas, "G", f => f.pesos)
const ctasUsd = cuentas.filter(c => /US\$/.test(c))
if (ctasUsd.length) bloque("EN DÓLARES — lo pagado desde la cuenta en dólares, en US$ (los mismos renglones de arriba)", ctasUsd, "H", f => f.usd ?? 0)

// control
const totalArchivo = r2(filas.reduce((t, f) => t + f.pesos, 0)), ok = Math.abs(totalArchivo - totalH) < 0.01
res.push([SUB("CONTROL")])
res.push([S(""), S(`Total de este archivo`), S(""), F(`${L(15, rTotal)}`, totalArchivo)])
res.push([S(""), S(`TOTAL de la solapa «H · MSA · Imp Bancarios» de ${ultimo}`), S(""), { t: "n", v: totalH, z: MON }])
res.push([S(""), S("Diferencia"), S(""), F(`${L(3, res.length - 2)}-${L(3, res.length - 1)}`, r2(totalArchivo - totalH)), S(ok ? "✓ cierra" : "⚠️ NO cierra", true)])
if (sinUsd) res.push([S(""), S(`⚠️ ${sinUsd} renglón(es) de la cuenta en dólares sin US$ encontrado en la cuota: figuran en pesos y no en el bloque en dólares`)])

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
XLSX.utils.book_append_sheet(wb, hoja(det, [6, 22, 38, 36, 9, 11, 14, 12, 12, 30, 40, 50, 12, 6], 1, `A1:N${NDET}`), DET)
let v = 1; const nombre = () => `${CARPETA}Imp Bancarios por cuenta MSA 25-26 (2026-11-11) v${v}.xlsx`
while (existsSync(nombre())) v++
XLSX.writeFile(wb, nombre())
console.log(`📄 ${nombre()}\n   ${filas.length} renglones · ${renglones.length} líneas de resumen · cuentas: ${cuentas.join(" | ")}`)
console.log(`   total ${totalArchivo} vs H ${totalH} → ${ok ? "✓" : "⚠️ NO cierra"} · USD sin TC: ${sinUsd}`)
for (const c of cuentas) console.log(`   ${c}: ${r2(filas.filter(f => f.cuenta === c).reduce((t, f) => t + f.pesos, 0))}${/US\$/.test(c) ? ` · US$ ${r2(filas.filter(f => f.cuenta === c).reduce((t, f) => t + (f.usd ?? 0), 0))}` : ""}`)
for (const x of renglones.filter(x => /25413/.test(x.categoria))) console.log(`   ${x.nro} ${x.cuenta} · ${x.categoria}: ${r2(filas.filter(f => nroDe(f) === x.nro).reduce((t, f) => t + f.pesos, 0))}`)
