/**
 * 🔗 ÍNDICE DE EXTRACTOS para el contador (JMS 11/11: «¿cómo le podríamos mandar un archivo con los links y que él pueda ir al que quiera?»).
 * SÓLO LEE `public.documentos_respaldo` (el archivo digital de los extractos, con su link al Drive). Una fila por cuenta, una columna por mes;
 * cada celda abre el PDF. Los links funcionan si la carpeta del Drive está compartida con su mail (modo lector).
 *
 *     npx tsx scripts/excel-indice-extractos.mts
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
// las que van al contador ahora (JMS 11/11: bancos, cuenta en dólares y FCI; las cajas y las tarjetas, después)
const CUENTAS = ["BANCO GALICIA (cta cte)", "BANCO SANTANDER", "BANCO PROVINCIA", "MSA Cuenta Corriente USD", "FCI FIMA Premium A"]
const MESES = ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]
const ROT = ["jul-25", "ago-25", "sep-25", "oct-25", "nov-25", "dic-25", "ene-26", "feb-26", "mar-26", "abr-26", "may-26", "jun-26"]

const { data, error } = await sb.from("documentos_respaldo").select("empresa, cuenta, periodo, tipo, url, nombre_archivo").eq("empresa", "MSA").in("cuenta", CUENTAS)
if (error) throw new Error(error.message)
const de = (c: string, m: string) => (data ?? []).find((x: any) => x.cuenta === c && x.periodo === m)
const ENC = (v: string) => ({ t: "s", v, s: { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "FFB7DEE8" } }, alignment: { horizontal: "center" }, border: { bottom: { style: "thin", color: { rgb: "FFA6A6A6" } } } } })
const filas: unknown[][] = [[{ t: "s", v: "EXTRACTOS — MARTINEZ SOBRADO AGRO SRL — ejercicio 25/26", s: { font: { bold: true, sz: 14 } } }],
  [{ t: "s", v: "Tocá el mes para abrir el extracto (PDF en Google Drive). El de junio 2026 es el respaldo del saldo al cierre.", s: { font: { italic: true } } }], [],
  [ENC("Cuenta"), ...ROT.map(ENC)]]
let n = 0, faltan = 0
const linkDe = (c: string, m: string) => { const d = de(c, m)
  if (!d?.url) { faltan++; return { t: "s", v: "—", s: { alignment: { horizontal: "center" } } } }
  n++; return { t: "s", v: "📄 abrir", l: { Target: d.url, Tooltip: d.nombre_archivo ?? "" }, s: { font: { color: { rgb: "FF0563C1" }, underline: true }, alignment: { horizontal: "center" } } } }
const nota = (v: string) => ({ t: "s", v, s: { font: { italic: true, sz: 9, color: { rgb: v.startsWith("sin") || v.startsWith("sólo") ? "FF7F7F7F" : "FF000000" } }, alignment: { horizontal: "center", wrapText: true } } })
const mesDe = (f: unknown) => String(f ?? "").slice(0, 7)
const filasBanco: Array<[string, (m: string) => string]> = []
const esMantB = (m: any) => /comisi|iva|imp\. ?deb|ley 25413|percep|ing\. ?brutos|iibb|sellos|intereses|impuesto|debitos \/ creditos|mantenim/i.test(`${m.descripcion} ${m.categ}`)
const TABLA_BANCO: Record<string, [string, string]> = { "BANCO GALICIA (cta cte)": ["public", "msa_galicia"], "BANCO SANTANDER": ["msa", "santander"], "BANCO PROVINCIA": ["msa", "provincia"] }
for (const c of CUENTAS.filter(x => /^BANCO/.test(x))) {
  const [sc, tb] = TABLA_BANCO[c]
  const movs: any[] = []
  for (let d = 0; ; d += 1000) { const q = sc === "public" ? sb.from(tb) : sb.schema(sc).from(tb); const { data } = await q.select("fecha, descripcion, categ, debitos, creditos").gte("fecha", "2025-07-01").lte("fecha", "2026-06-30").order("fecha").range(d, d + 999); movs.push(...(data ?? [])); if (!data || data.length < 1000) break }
  const enMes = (m: string) => { const xs = movs.filter(x => String(x.fecha).slice(0, 7) === m && (Number(x.debitos) || Number(x.creditos)))
    return !xs.length ? "sin movimientos" : xs.every(esMantB) ? "sólo mantenimiento" : `${xs.filter(x => !esMantB(x)).length} mov. + mantenimiento` }
  filasBanco.push([c, enMes])
}
for (const [c, enMes] of filasBanco) {
  filas.push([{ t: "s", v: c, s: { font: { bold: true } } }, ...MESES.map(m => {
    const d = de(c, m)
    if (!d?.url) { faltan++; return { t: "s", v: "—", s: { alignment: { horizontal: "center" } } } }
    n++
    return { t: "s", v: "📄 abrir", l: { Target: d.url, Tooltip: d.nombre_archivo ?? "" }, s: { font: { color: { rgb: "FF0563C1" }, underline: true }, alignment: { horizontal: "center" } } }
  })])
  filas.push([{ t: "s", v: "   en el mes", s: { font: { italic: true } } }, ...MESES.map(m => nota(enMes(m)))])
}
// 💵 JMS 11/11: «la cuenta en dólares también la podés dejar aparte, y donde es sin movimientos le ponés sin movimientos o sólo movimientos de
// mantenimiento… lo mismo en inversiones: si hubiera meses sin movimientos, él sabe que ahí no va a ir a ver nada»
const usd = ((await sb.schema("msa").from("cc_usd").select("fecha, descripcion, categ, debitos, creditos").gte("fecha", "2025-07-01").lte("fecha", "2026-06-30")).data ?? []) as any[]
const esMant = (m: any) => /comisi|iva|imp\. ?deb|ley 25413|percep|ing\. ?brutos|debitos \/ creditos/i.test(`${m.descripcion} ${m.categ}`)
filas.push([], [{ t: "s", v: "CUENTA EN DÓLARES (US$)", s: { font: { bold: true } } }], [ENC("Cuenta"), ...ROT.map(ENC)])
filas.push([{ t: "s", v: "MSA Cuenta Corriente USD", s: { font: { bold: true } } }, ...MESES.map(m => linkDe("MSA Cuenta Corriente USD", m))])
filas.push([{ t: "s", v: "   en el mes", s: { font: { italic: true } } }, ...MESES.map(m => { const xs = usd.filter(x => mesDe(x.fecha) === m && (Number(x.debitos) || Number(x.creditos)))
  return nota(!xs.length ? "sin movimientos" : xs.every(esMant) ? "sólo mantenimiento" : `${xs.filter(x => !esMant(x)).length} mov. + mantenimiento`) })])
const fci = ((await sb.from("msa_galicia").select("fecha, debitos, creditos, descripcion").gte("fecha", "2025-07-01").lte("fecha", "2026-06-30").ilike("descripcion", "%fima%")).data ?? []) as any[]
filas.push([], [{ t: "s", v: "FONDO COMÚN DE INVERSIÓN (FIMA Premium A)", s: { font: { bold: true } } }], [ENC("Fondo"), ...ROT.map(ENC)])
filas.push([{ t: "s", v: "FCI FIMA Premium A", s: { font: { bold: true } } }, ...MESES.map(m => linkDe("FCI FIMA Premium A", m))])
filas.push([{ t: "s", v: "   en el mes", s: { font: { italic: true } } }, ...MESES.map(m => { const xs = fci.filter(x => mesDe(x.fecha) === m)
  const sus = xs.filter(x => Number(x.debitos) > 0).length, res = xs.filter(x => Number(x.creditos) > 0).length
  return nota(!xs.length ? "sin movimientos" : [sus ? `${sus} suscr.` : "", res ? `${res} resc.` : ""].filter(Boolean).join(" · ")) })])
// 💳 JMS 11/11: «las tarjetas en unos renglones abajo con el monto de la tarjeta, que no se preocupe si hay tarjetas en cero». Cada resumen con
// su link y el TOTAL del resumen (el renglón «RESUMEN» de la tarjeta: los 12 cierres del ejercicio, en orden, uno por mes)
const TARJETAS: Array<{ cuenta: string; rotulo: string; tabla?: string; leido?: Array<[string, number]> }> = [{ cuenta: "Tarjeta VISA Business MSA", rotulo: "VISA Business MSA", tabla: "tarjeta_visa_business" },
  // la VISA Rural no está cargada en el sistema: cierre y «TOTAL A PAGAR» leídos de cada resumen (PDF), 11/11
  { cuenta: "Tarjeta VISA Rural MSA", rotulo: "VISA Rural MSA", leido: [["2025-07-24", 0], ["2025-08-21", 605], ["2025-09-25", 645.71], ["2025-10-23", 704.25], ["2025-11-20", 1345.91], ["2025-12-24", 1405.46],
    ["2026-01-22", 1469.03], ["2026-02-19", 1526.73], ["2026-03-19", 1588.83], ["2026-04-23", 1644.99], ["2026-05-21", 2297.84], ["2026-06-25", 2374.02]] }]
const { data: tj } = await sb.from("documentos_respaldo").select("cuenta, periodo, url, nombre_archivo").in("cuenta", TARJETAS.map(t => t.cuenta))
filas.push([], [{ t: "s", v: "TARJETAS — el resumen de cada mes y su total (un total en $ 0 es un mes sin consumos)", s: { font: { bold: true } } }], [ENC("Tarjeta"), ...ROT.map(ENC)])
for (const t of TARJETAS) {
  const res = t.leido ? t.leido.map(([fecha, debitos]) => ({ fecha, debitos })) : ((await sb.schema("msa").from(t.tabla!).select("fecha, debitos").ilike("descripcion", "RESUMEN%").gte("fecha", "2025-07-01").lte("fecha", "2026-07-31").order("fecha")).data ?? []) as any[]
  filas.push([{ t: "s", v: t.rotulo, s: { font: { bold: true } } }, ...MESES.map(m => { const d = (tj ?? []).find((x: any) => x.cuenta === t.cuenta && x.periodo === m)
    if (!d?.url) { faltan++; return { t: "s", v: "—", s: { alignment: { horizontal: "center" } } } }
    n++; return { t: "s", v: "📄 abrir", l: { Target: d.url, Tooltip: d.nombre_archivo ?? "" }, s: { font: { color: { rgb: "FF0563C1" }, underline: true }, alignment: { horizontal: "center" } } } })])
  filas.push([{ t: "s", v: "   total del resumen $", s: { font: { italic: true } } }, ...MESES.map((_, j) => res[j] ? { t: "n", v: Math.round(Number(res[j].debitos) * 100) / 100, z: "#,##0.00", s: { alignment: { horizontal: "right" } } } : "")])
  filas.push([{ t: "s", v: "   cierre del resumen", s: { font: { italic: true, sz: 9 } } }, ...MESES.map((_, j) => res[j] ? { t: "s", v: String(res[j].fecha).slice(0, 10).split("-").reverse().join("/"), s: { font: { sz: 9 }, alignment: { horizontal: "center" } } } : "")])
}
filas.push([{ t: "s", v: "ⓘ VISA Rural: casi sin uso — el cargo anual, intereses e IVA; no se paga desde julio 2025, por eso el total crece (al cierre debe $ 2.374,02).", s: { font: { italic: true, sz: 9 } } }])
filas.push([], [{ t: "s", v: `${n} documentos con link${faltan ? ` · ${faltan} sin link` : ""}.`, s: { font: { italic: true, sz: 9 } } }])
const ws = XLSX.utils.aoa_to_sheet(filas)
ws["!cols"] = [{ wch: 28 }, ...ROT.map(() => ({ wch: 13 }))]
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, "Extractos")
let p = join(CARPETA, "Extractos - índice para el contador (2026-11-11).xlsx"), v = 2
while (existsSync(p)) p = join(CARPETA, `Extractos - índice para el contador (2026-11-11) v${v++}.xlsx`)
XLSX.writeFile(wb, p)
console.log(`${n} con link · ${faltan} sin link\n📄 ${p}`)
