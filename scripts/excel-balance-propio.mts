/**
 * 📸 EL BALANCE PROPIO EN EXCEL desde la base — A-FEAT-1190. Arma el MISMO libro que la app (`lib/balance/balance-propio-excel.ts`):
 * lee las fotos guardadas (versión JMS) del 30/06 de inicio y de cierre, y le suma la hacienda por categoría (promedio de junio,
 * `promedio-junio-hacienda.mts`) y los socios (papel Cuentas de socios), guardados junto a los programas del balance. No escribe la base.
 *
 * Uso: npx tsx scripts/excel-balance-propio.mts [MSA] [2026] [junio.json] [socios.json]
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import XLSX from "xlsx-js-style"
import { createClient } from "@supabase/supabase-js"
import { RUBROS } from "../lib/balance/balance-propio"
import { vistasDe } from "../lib/balance/export-libro-diario"
import { aplicarVistas } from "../lib/balance/formato-excel"
import { armarLibroBalancePropio, recalcularFormulas, type CategoriaHacienda } from "../lib/balance/balance-propio-excel"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DATOS = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude/Copias/programas/balance-propio-pagina"
const [EMPRESA = "MSA", ANIO_TXT = "2026", JUNIO = join(DATOS, "junio-rango.json"), SOCIOS = join(DATOS, "socios.json")] = process.argv.slice(2)
const ANIO = Number(ANIO_TXT), CIERRE = `${ANIO}-06-30`, INICIO = `${ANIO - 1}-06-30`
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"

const { data: fotos } = await sb.from("balance_fotos").select("id, fecha_cierre, tc, tc_fuente").eq("empresa", EMPRESA).in("fecha_cierre", [INICIO, CIERRE]).order("fecha_cierre")
if (fotos?.length !== 2) throw new Error(`Faltan las fotos ${INICIO} y ${CIERRE} de ${EMPRESA}`)
const punta = async (f: any) => { const { data } = await sb.from("balance_foto_valores").select("renglon, importe, detalle").eq("foto_id", f.id).eq("version", "jms"); return { fecha: f.fecha_cierre, tc: Number(f.tc), tcFuente: f.tc_fuente, valores: new Map<string, { importe: number; detalle: string }>(data.map((x: any) => [x.renglon, { importe: Number(x.importe), detalle: x.detalle ?? "" }])) } }
const [inicio, cierre] = [await punta(fotos[0]), await punta(fotos[1])]

const junio = existsSync(JUNIO) ? JSON.parse(readFileSync(JUNIO, "utf8")) : null
const CAB: Record<number, Record<string, number>> = { 2025: { Vacas: 150, V1: 50, CUT: 2, Toros: 11, Toritos: 9, Vaq: 28, Nov: 71 }, 2026: { Vacas: 177, V1: 27, CUT: 8, Toros: 16, Toritos: 9, Vaq: 81, Nov: 96 } }
const NOMBRES: [string, string, "cría" | "recría"][] = [["Vacas", "Vacas", "cría"], ["V1", "Vaquillonas 1ª parición", "cría"], ["CUT", "CUT", "cría"], ["Toros", "Toros", "cría"], ["Toritos", "Toritos", "recría"], ["Vaq", "Vaquillonas", "recría"], ["Nov", "Novillitos / terneros", "recría"]]
const hacienda: CategoriaHacienda[] = junio ? NOMBRES.map(([k, nombre, rodeo]) => ({ nombre, rodeo, c0: CAB[ANIO - 1]?.[k] ?? 0, p0: junio[ANIO - 1]?.porCabeza?.[k] ?? null, c1: CAB[ANIO]?.[k] ?? 0, p1: junio[ANIO]?.porCabeza?.[k] ?? null, fuente: junio[ANIO]?.fuente?.[k] })) : []
const socios = existsSync(SOCIOS) ? JSON.parse(readFileSync(SOCIOS, "utf8")) : []

const wb = armarLibroBalancePropio({ empresa: EMPRESA, inicio, cierre, hacienda, socios })
const valor = recalcularFormulas(wb)
const fila = (hoja: string, texto: string) => { const s = wb.Sheets[hoja]; const r = XLSX.utils.decode_range(s["!ref"]!); for (let i = r.s.r; i <= r.e.r; i++) { const c = (s as any)[XLSX.utils.encode_cell({ r: i, c: 0 })]; if (c && String(c.v).startsWith(texto)) return i + 1 } return 0 }
const fmtN = (x: number) => Math.round(x).toLocaleString("es-AR")
console.log(`Ganancia US$: corriente ${fmtN(valor("Balance propio", "G" + fila("Balance propio", "GANANCIA CORRIENTE")))} · total ${fmtN(valor("Balance propio", "G" + fila("Balance propio", "GANANCIA TOTAL")))}`)
for (const t of ["− Suba", "= Ganancia del ejercicio", "− Reinvertido", "= Ganancia líquida", "   control", "− Recría", "= Ganancia líquida sin", "Control de la cría"]) console.log(`   ${t.padEnd(26)} ${fmtN(valor("Ganancia desglosada", "B" + fila("Ganancia desglosada", t)))}`)
const malos = RUBROS.map(r => fila("Balance propio", `Subtotal ${r.etiqueta}`)).filter(i => i && Math.abs(valor("Balance propio", "H" + i)) > 0.01)
console.log(`   controles por rubro: ${malos.length ? "⚠ " + malos.join(", ") : "✓ todos 0"} · socios: control ${fmtN(valor("Socios", "D" + fila("Socios", "Control")))}`)

const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
let p = join(CARPETA, `Balance propio ${EMPRESA} ${String(ANIO - 1).slice(2)}-${String(ANIO).slice(2)} (${hoy}) v1.xlsx`), v = 2
while (existsSync(p)) p = join(CARPETA, `Balance propio ${EMPRESA} ${String(ANIO - 1).slice(2)}-${String(ANIO).slice(2)} (${hoy}) v${v++}.xlsx`)
if (process.argv.includes("--guardar")) { writeFileSync(p, await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistasDe(wb as any))); console.log(`📄 ${p}`) }
else console.log("(sin --guardar: sólo el control, no escribe el Excel)")
