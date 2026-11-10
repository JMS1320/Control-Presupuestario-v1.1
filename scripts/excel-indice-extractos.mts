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
for (const c of CUENTAS) {
  filas.push([{ t: "s", v: c, s: { font: { bold: true } } }, ...MESES.map(m => {
    const d = de(c, m)
    if (!d?.url) { faltan++; return { t: "s", v: "—", s: { alignment: { horizontal: "center" } } } }
    n++
    return { t: "s", v: "📄 abrir", l: { Target: d.url, Tooltip: d.nombre_archivo ?? "" }, s: { font: { color: { rgb: "FF0563C1" }, underline: true }, alignment: { horizontal: "center" } } }
  })])
}
filas.push([], [{ t: "s", v: `${n} extractos con link${faltan ? ` · ${faltan} sin link` : ""}.`, s: { font: { italic: true, sz: 9 } } }])
const ws = XLSX.utils.aoa_to_sheet(filas)
ws["!cols"] = [{ wch: 28 }, ...ROT.map(() => ({ wch: 9 }))]
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, "Extractos")
let p = join(CARPETA, "Extractos - índice para el contador (2026-11-11).xlsx"), v = 2
while (existsSync(p)) p = join(CARPETA, `Extractos - índice para el contador (2026-11-11) v${v++}.xlsx`)
XLSX.writeFile(wb, p)
console.log(`${n} con link · ${faltan} sin link\n📄 ${p}`)
