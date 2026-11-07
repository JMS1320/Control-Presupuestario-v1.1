/**
 * 🏡 CONTROL — ¿el código contable de cada pago de un BIEN respeta de quién es el bien? (A-FEAT-1577 punto 12). SÓLO LEE, salvo con --sql.
 *
 *     npx tsx scripts/control-bienes-pam-a-ma.mts          → el Excel del control (✅ / 🔴 por pago)
 *     npx tsx scripts/control-bienes-pam-a-ma.mts --sql    → además: la FOTO de las filas a corregir (backup) y el script 231 con su deshacer
 *
 * La regla vive en `lib/balance/dueno-de-bienes.ts` (una sola, para el control y para la app): las partidas de PAM (inmobiliario, Red Vial)
 * y Posadas son de MA desde el 01/01/2026, salvo El Relincho y Quinta Rosello. Código esperado según quién pagó: el dueño → vacío ·
 * MSA → CTA <dueño> · PAM por MA → DIST MA · MA por PAM → CTA PAM. Un pago agrupado con bienes de dueños distintos queda «a decidir».
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"
import { duenoDelBien, codigoEsperado, type Empresa } from "../lib/balance/dueno-de-bienes"
import { agregarHoja } from "../lib/balance/export-libro-diario"
import { fechasReales } from "../lib/excel/fechas-reales"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const D = "2025-07-01", H = "2026-06-30", HOY = "2026-11-07"
const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
async function todo(q: (d: number, h: number) => any): Promise<any[]> { const out: any[] = []; for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break } return out }
const desde = (s: string, t: string) => (s === "public" ? sb.from(t) : sb.schema(s).from(t))
const dmy = (f: string) => f.slice(0, 10).split("-").reverse().join("/")

// los templates de cada cuota y de cada grupo de pago
const cuotas = await todo((d, h) => sb.from("cuotas_egresos_sin_factura").select("id, grupo_pago_id, egreso:egresos_sin_factura(nombre_referencia, responsable)").order("id").range(d, h))
const tplsDe = new Map<string, Array<{ nombre: string; responsable: string }>>()
for (const c of cuotas) {
  const t = { nombre: String(c.egreso?.nombre_referencia ?? ""), responsable: String(c.egreso?.responsable ?? "") }
  tplsDe.set(c.id, [...(tplsDe.get(c.id) ?? []), t])
  if (c.grupo_pago_id) tplsDe.set(c.grupo_pago_id, [...(tplsDe.get(c.grupo_pago_id) ?? []), t])
}

type Fila = { crudo: string | null; tabla: string; cuenta: string; id: string; fecha: string; imp: number; desc: string; detalle: string; tpls: string; pagador: Empresa; dueno: string; actual: string | null; esperado: string | null; estado: string }
const filas: Fila[] = []
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const pagador = String(t.titular).toUpperCase() as Empresa
  if (!["MSA", "PAM", "MA"].includes(pagador)) continue
  let movs: any[] = []
  try { movs = await todo((d, h) => desde(t.schema, t.tabla).select("id, fecha, debitos, creditos, descripcion, detalle, contable, template_cuota_id").gte("fecha", D).lte("fecha", H).not("template_cuota_id", "is", null).order("id").range(d, h)) }
  catch { continue }
  for (const m of movs) {
    const tpls = tplsDe.get(m.template_cuota_id) ?? []
    const duenos = [...new Set(tpls.map(x => duenoDelBien(x, String(m.fecha))).filter(Boolean))] as Empresa[]
    if (!duenos.length) continue                                                     // no es un bien que cambie de dueño
    const actual = String(m.contable ?? "").trim() || null
    const crudo: string | null = m.contable ?? null   // para el SQL: el valor TAL CUAL ('' no es null — pasó el 07/11)
    const base = { tabla: `${t.schema}.${t.tabla}`, cuenta: t.cuenta, id: String(m.id), fecha: String(m.fecha).slice(0, 10), imp: Number(m.debitos || 0) - Number(m.creditos || 0),
      desc: String(m.descripcion ?? ""), detalle: String(m.detalle ?? ""), crudo, tpls: [...new Set(tpls.map(x => `${x.nombre} (${x.responsable})`))].join(" + "), pagador, actual }
    if (duenos.length > 1 || tpls.some(x => duenoDelBien(x, String(m.fecha)) === null)) {
      filas.push({ ...base, dueno: duenos.join("/"), esperado: null, estado: "🟡 a decidir: el pago agrupa bienes de distintos dueños o cosas que no son bienes" }); continue
    }
    const esperado = codigoEsperado(pagador, duenos[0])
    const igual = (actual ?? "").toUpperCase() === (esperado ?? "").toUpperCase()
    filas.push({ ...base, dueno: duenos[0], esperado, estado: igual ? "✅" : "🔴 no respeta" })
  }
}
filas.sort((a, b) => a.estado.localeCompare(b.estado) || a.fecha.localeCompare(b.fecha))
const mal = filas.filter(f => f.estado.startsWith("🔴")), dudas = filas.filter(f => f.estado.startsWith("🟡"))

const hoja: unknown[][] = [["CONTROL — el código contable de cada pago de un BIEN respeta de quién es el bien (ejercicio 25/26)"],
  ["Regla (JMS 07/11): las partidas de PAM (inmobiliario, Red Vial) y Posadas son de MA desde el 01/01/2026, salvo El Relincho y Quinta Rosello. Lima, siempre MA. Libertad va aparte (LIB, 50/50). Sólo contable."],
  ["Código esperado según quién pagó: el dueño → vacío · MSA → CTA <dueño> · PAM por MA → DIST MA · MA por PAM → CTA PAM."],
  [`${filas.length} pagos de bienes · ✅ ${filas.length - mal.length - dudas.length} respetan · 🔴 ${mal.length} no respetan · 🟡 ${dudas.length} a decidir`], [],
  ["Estado", "Fecha", "Cuenta (quién pagó)", "Importe", "Template(s)", "Dueño del bien a esa fecha", "Código actual", "Código que corresponde", "Descripción", "Detalle", "Id"],
  ...filas.map(f => [f.estado, f.fecha, `${f.cuenta} (${f.pagador})`, Math.round(f.imp * 100) / 100, f.tpls, f.dueno, f.actual ?? "(vacío)", f.estado.startsWith("🟡") ? "a decidir" : f.esperado ?? "(vacío)", f.desc, f.detalle, `${f.tabla}:${f.id}`])]
const wb = XLSX.utils.book_new()
agregarHoja(wb, "Control bienes PAM a MA", hoja)
fechasReales(wb as any)
let p = join(CARPETA, `Control bienes PAM a MA (${HOY}).xlsx`), v = 2
while (existsSync(p)) p = join(CARPETA, `Control bienes PAM a MA (${HOY}) v${v++}.xlsx`)
XLSX.writeFile(wb, p)
console.log(`bienes ${filas.length} · ✅ ${filas.length - mal.length - dudas.length} · 🔴 ${mal.length} · 🟡 ${dudas.length}`)
for (const f of [...mal, ...dudas]) console.log(`  ${f.estado.slice(0, 2)} ${f.fecha} ${f.cuenta} ${f.imp} ${f.tpls.slice(0, 60)} · ${f.actual ?? "(vacío)"} → ${f.esperado ?? "?"}`)
console.log(`📄 ${p}`)

// ── --sql: la FOTO (backup) de las filas a corregir y el script 231 con su deshacer (sólo los 🔴; los 🟡 no se tocan)
if (process.argv.includes("--sql")) {
  const foto: Record<string, unknown[]> = {}
  for (const f of mal) {
    const [s, t] = f.tabla.split(".")
    const { data, error } = await desde(s, t).select("*").eq("id", f.id)
    if (error || !data?.length) throw new Error(`no se pudo leer ${f.tabla} ${f.id} para la foto: ${error?.message ?? "no está"}`)
    foto[f.tabla] = [...(foto[f.tabla] ?? []), data[0]]
  }
  if (existsSync("scripts/231-foto-antes.json")) throw new Error("ya hay una foto del 231: no se pisa el backup")
  writeFileSync("scripts/231-foto-antes.json", JSON.stringify({ tomada: new Date().toISOString(), filas: foto }, null, 1))
  const lit = (x: string | null) => (x == null ? "null" : `'${x.replace(/'/g, "''")}'`)
  const up = mal.map(f => `update ${f.tabla} set contable = ${lit(f.esperado)} where id = '${f.id}' and contable is not distinct from ${lit(f.crudo)};`)
  const down = mal.map(f => `update ${f.tabla} set contable = ${lit(f.crudo)} where id = '${f.id}' and contable is not distinct from ${lit(f.esperado)};`)
  writeFileSync("scripts/231-bienes-pam-a-ma.sql", `-- 231 · BIENES DE PAM A MA DESDE EL 01/01/2026, sólo CONTABLE (DATOS) — A-FEAT-1577 punto 12. OK JMS 07/11: «desde 1/1/26 es MA… hacé un backup antes».
-- Las partidas de PAM (inmobiliario, Red Vial) y Posadas son de MA desde el 01/01/2026, salvo El Relincho y Quinta Rosello: si pagó MSA, CTA PAM → CTA MA;
-- si pagó PAM, vacío → DIST MA. Regla: lib/balance/dueno-de-bienes.ts. Control: scripts/control-bienes-pam-a-ma.mts. Backup: scripts/231-foto-antes.json.
-- ${up.length} movimientos. Cada update exige que la columna siga diciendo lo leído. Deshacer: 231-bienes-pam-a-ma-deshacer.sql.
begin;
${up.join("\n")}
commit;
`)
  writeFileSync("scripts/231-bienes-pam-a-ma-deshacer.sql", `-- Deshace el 231 (cada movimiento vuelve a su contable anterior, sólo si todavía tiene el que puso el 231).\nbegin;\n${down.join("\n")}\ncommit;\n`)
  console.log(`📸 foto ${mal.length} filas → scripts/231-foto-antes.json · 📜 scripts/231-bienes-pam-a-ma.sql (${up.length})`)
}
