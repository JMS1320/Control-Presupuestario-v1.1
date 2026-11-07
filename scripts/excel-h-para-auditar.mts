/**
 * 🔍 EL LIBRO H PARA AUDITAR, generado fuera de la app con los datos reales (A-FEAT-1579). SÓLO LEE.
 * Lee lo mismo que Papeles de balance (cuotas de templates, el plan, las pólizas, el banco de cada cuota y el extracto del ejercicio) y
 * arma el H con la opción `auditoria` — el mismo armado que baja el set desde la app. El papel de impuestos no sale acá (lo arma la app).
 *
 *     npx tsx scripts/excel-h-para-auditar.mts [MSA] [2026]
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { armarEjercicio, primerDiaDelEjercicio } from "../lib/balance/ejercicio"
import { desdeCuota, armarTemplatesDelEjercicio } from "../lib/balance/templates-libro"
import { leerMovimientosDeCuotas, vincularBanco, leerExtractoDelEjercicio, indiceDeDestinos } from "../lib/balance/movimientos-de-cuotas"
import { agregarLibroH } from "../lib/balance/export-libro-diario"
import { fechasReales } from "../lib/excel/fechas-reales"
import { auditarCuota } from "../lib/balance/auditoria-templates"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const EMPRESA = process.argv[2] ?? "MSA", ANIO = Number(process.argv[3] ?? 2026)
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
async function todo(q: (d: number, h: number) => any): Promise<any[]> { const out: any[] = []; for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break } return out }

const ej = armarEjercicio(ANIO, 6)
const filas = await todo((d, h) => sb.from("cuotas_egresos_sin_factura")
  .select("*, egreso:egresos_sin_factura(nombre_referencia, proveedor, nombre_quien_cobra, categ, centro_costo, responsable, codigo_contable, tipo, cuenta_agrupadora)")
  .gte("fecha_estimada", `${ANIO - 2}-01-01`).order("id").range(d, h))
const { data: planTipos } = await sb.from("cuentas_contables").select("categ, tipo, nro_cuenta, nombre_totalizadora")
const plan = planTipos ?? []
const tipoDeCateg = Object.fromEntries(plan.map((x: any) => [x.categ, x.tipo]))
const { data: conPoliza } = await sb.from("polizas_seguro").select("template_id").not("template_id", "is", null)
let cuotas = filas.map((f: any) => desdeCuota(f, tipoDeCateg as any))
const leido = await leerMovimientosDeCuotas(sb, cuotas)
cuotas = vincularBanco(cuotas, cuotas, leido.movimientos)
const ex = await leerExtractoDelEjercicio(sb, primerDiaDelEjercicio(ej), ej.fechaCierre)
const templates = armarTemplatesDelEjercicio(cuotas, ej, {
  empresa: EMPRESA, plan, templatesConPoliza: (conPoliza ?? []).map((p: any) => p.template_id).filter(Boolean),
  bancoSinLeer: leido.tablasQueFallaron, extracto: { movimientos: ex.movimientos, destinos: indiceDeDestinos(cuotas), tablasQueFallaron: ex.tablasQueFallaron },
} as any)
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const meses = ej.subdiarios.map((x: any) => ({ clave: `${x.anio}-${String(x.mes).padStart(2, "0")}`, rotulo: `${MES[x.mes - 1]}-${String(x.anio).slice(-2)}` }))

const wb = XLSX.utils.book_new()
agregarLibroH(wb as any, templates, ej.etiqueta, meses, null, { auditoria: true })
fechasReales(wb as any)
let p = join(CARPETA, `H para auditar ${EMPRESA} ${ej.etiqueta.replace("/", "-")} (2026-11-07).xlsx`), v = 2
while (existsSync(p)) p = join(CARPETA, `H para auditar ${EMPRESA} ${ej.etiqueta.replace("/", "-")} (2026-11-07) v${v++}.xlsx`)
XLSX.writeFile(wb, p)

// lo que dice, para el control a ojo
const a = templates.detalle.map((c: any) => ({ c, a: auditarCuota(c) }))
const cuenta = (re: RegExp) => a.filter(x => re.test(x.a.marca)).length
console.log(`cuotas ${a.length} · ✓ ${cuenta(/^✓/)} · 🔴 sin pagar ${cuenta(/SIN PAGAR/)} · 🟡 ${cuenta(/^🟡/)} · ⚪ ${cuenta(/^⚪/)} · ⚠️ código ${cuenta(/código esperado/)}`)
console.log(`con efecto (pagó otro): ${a.filter(x => x.a.efecto).length}`)
const ef = new Map<string, number>(); for (const x of a) if (x.a.efecto) ef.set(x.a.efecto, (ef.get(x.a.efecto) ?? 0) + 1)
for (const [k, n] of [...ef].sort((x, y) => y[1] - x[1])) console.log(`  ${n} × ${k}`)
console.log(`bancos sin leer: ${leido.tablasQueFallaron.join(", ") || "ninguno"} · solapas ${wb.SheetNames.length}`)
console.log(`📄 ${p}`)
