/**
 * 👥 QUIÉN PAGÓ CADA CUOTA, como Excel suelto (A-FEAT-1577 punto 13). SÓLO LEE. La lógica vive en scripts/quien-pago-cada-cuota.mts;
 * las mismas dos solapas van también dentro del prototipo de la 14.1 (scripts/prototipo-14-1-por-grupo.mts).
 *
 *     npx tsx scripts/excel-quien-pago-cada-cuota.mts
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { agregarHoja } from "../lib/balance/export-libro-diario"
import { fechasReales } from "../lib/excel/fechas-reales"
import { armarQuienPagoCadaCuota, SOLAPA_RESUMEN, SOLAPA_DETALLE, ANCHOS_RESUMEN, ANCHOS_DETALLE } from "./quien-pago-cada-cuota.mts"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const HOY = "2026-11-07", CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const q = await armarQuienPagoCadaCuota(sb)
const wb = XLSX.utils.book_new()
agregarHoja(wb, SOLAPA_RESUMEN, q.resumen, ANCHOS_RESUMEN as any)
agregarHoja(wb, SOLAPA_DETALLE, q.detalle, ANCHOS_DETALLE as any)
fechasReales(wb as any)
let p = join(CARPETA, `Quién pagó cada cuota 25-26 (${HOY}).xlsx`), v = 2
while (existsSync(p)) p = join(CARPETA, `Quién pagó cada cuota 25-26 (${HOY}) v${v++}.xlsx`)
XLSX.writeFile(wb, p)
console.log(q.log.join("\n")); console.log(`📄 ${p}`)
