/**
 * 🏦 Script 186 — CA Galicia PAM: 5 templates nuevos de PAM para lo que toca a otros (A-FEAT-1526; JMS 03/11: «hacelos templates
 * nuevos de PAM» y «ok así, armá los 5 templates de PAM»).
 *
 *     npx tsx scripts/186-ca-pam-templates-sucesiones-arrendamientos.mts              ← SIMULA
 *     npx tsx scripts/186-ca-pam-templates-sucesiones-arrendamientos.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * Criterio de JMS para PAM: 2025 ya se presentó y PAM no sigue en 2026 → sólo se marca lo que importa al resto (MSA, MA, los
 * hermanos, Libertad); lo propio de PAM queda en histórico.
 *
 *   · Cuentas nuevas, tipo FINANCIERO (plata de las sucesiones que pasa por PAM, no es resultado de PAM): «SUC ERM»,
 *     «SUC ERM (SH)», «SUC PAM».
 *   · Templates nuevos de PAM (abiertos, bidireccionales, sin cuotas futuras): SUC ERM, SUC ERM (SH), SUC PAM (agrupadora
 *     «Sucesiones PAM») · ARR AGRIC NZ, ARR AGRIC MMM (categ «ARRENDAMIENTOS Venta», agrupadora «Arrendamientos PAM»).
 *   · Los movimientos que JMS marcó con esas notas en el Excel «CA Galicia PAM - hoy y propuesta» → una cuota conciliada cada uno.
 *     El movimiento SIGUE en histórico (como el script 176): sólo se le ata la cuota.
 *
 * Deshacer: `186-…-deshacer.mts` desata los movimientos y borra sólo cuotas, templates y cuentas creadas (`scripts/186-hecho.json`).
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const ESCRIBIR = process.argv.includes("--escribir")
const FOTO = "scripts/186-foto-antes.json", HECHO = "scripts/186-hecho.json"
const HUELLA = "[script 186] JMS 03/11 (Excel CA PAM)"
const EXCEL = join("- Comunicacion JMS Claude - Archivos", "Balance", "Excels trabajando con claude", "CA Galicia PAM - hoy y propuesta (2026-11-02).xlsx")
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const n = (x: unknown) => Number(String(x ?? "").replace(/,/g, "")) || 0
const r2 = (x: number) => Math.round(x * 100) / 100
const $ = (x: number) => `$ ${r2(x).toLocaleString("es-AR")}`
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const mesDe = (f: string) => `${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`
const frenos: string[] = []

const TEMPLATES = [
  { nota: "suc erm", nombre: "SUC ERM", categ: "SUC ERM", tipo: "financiero", agr: "Sucesiones PAM", cuentaNueva: true },
  { nota: "suc erm (sh)", nombre: "SUC ERM (SH)", categ: "SUC ERM (SH)", tipo: "financiero", agr: "Sucesiones PAM", cuentaNueva: true },
  { nota: "suc pam", nombre: "SUC PAM", categ: "SUC PAM", tipo: "financiero", agr: "Sucesiones PAM", cuentaNueva: true },
  { nota: "arr agric nz", nombre: "ARR AGRIC NZ", categ: "ARRENDAMIENTOS Venta", tipo: "ingreso", agr: "Arrendamientos PAM", cuentaNueva: false },
  { nota: "arr agric mmm", nombre: "ARR AGRIC MMM", categ: "ARRENDAMIENTOS Venta", tipo: "ingreso", agr: "Arrendamientos PAM", cuentaNueva: false },
]

// ── Las notas de JMS ─────────────────────────────────────────────────────────────────────────────────────
const wb = XLSX.readFile(EXCEL, { cellDates: true })
const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets["Detalle"], { raw: true, defval: "" })
const iso = (v: any) => (v instanceof Date ? new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : String(v).slice(0, 10))
const clave = (f: string, d: number, c: number, desc: string) => `${f}|${r2(d)}|${r2(c)}|${desc.trim().toUpperCase()}`
const notas = new Map<string, string[]>()
for (const r of rows) {
  const nota = String(r["JMS: nota"] ?? "").trim().toLowerCase()
  if (!r["Fecha"] || !TEMPLATES.some(t => t.nota === nota)) continue
  const k = clave(iso(r["Fecha"]), n(r["Débitos"]), n(r["Créditos"]), String(r["Descripción"]))
  notas.set(k, [...(notas.get(k) ?? []), nota])
}
const { data: movsTodos } = await sb.from("pam_galicia").select("*").is("template_cuota_id", null).is("comprobante_arca_id", null)
const porClave = new Map<string, any[]>()
for (const m of movsTodos ?? []) { const k = clave(m.fecha, n(m.debitos), n(m.creditos), m.descripcion); porClave.set(k, [...(porClave.get(k) ?? []), m]) }
const acciones: { m: any; t: typeof TEMPLATES[number] }[] = []
for (const [k, ns] of notas) {
  const ms = porClave.get(k) ?? []
  if (ms.length !== ns.length) { frenos.push(`${k}: ${ns.length} notas para ${ms.length} movimientos libres`); continue }
  ms.forEach((m, i) => acciones.push({ m, t: TEMPLATES.find(t => t.nota === ns[i])! }))
}
for (const a of acciones) if (a.m.estado !== "historico") frenos.push(`${a.m.fecha} ${a.m.descripcion}: está «${a.m.estado}», no en histórico`)

// ── Lo que ya existe ─────────────────────────────────────────────────────────────────────────────────────
const { data: ccYa } = await sb.from("cuentas_contables").select("categ,tipo").in("categ", TEMPLATES.map(t => t.categ))
for (const t of TEMPLATES) {
  const c = (ccYa ?? []).find((x: any) => x.categ === t.categ)
  if (t.cuentaNueva && c) frenos.push(`la cuenta «${t.categ}» ya existe`)
  if (!t.cuentaNueva && !c) frenos.push(`falta la cuenta «${t.categ}»`)
}
const { data: tplYa } = await sb.from("egresos_sin_factura").select("nombre_referencia").eq("responsable", "PAM").in("nombre_referencia", TEMPLATES.map(t => t.nombre))
if (tplYa?.length) frenos.push(`ya existen: ${tplYa.map((t: any) => t.nombre_referencia).join(", ")}`)
const { data: base } = await sb.from("egresos_sin_factura").select("*").eq("id", "ef0a78dc-e096-4d21-8777-0664c0e5349b").single() // Interbancarias PAM

console.log(`Notas en el Excel para los 5 templates: ${[...notas.values()].flat().length} · movimientos encontrados: ${acciones.length}`)
for (const t of TEMPLATES) {
  const xs = acciones.filter(a => a.t === t)
  console.log(`\n«${t.nombre}» (categ ${t.categ}${t.cuentaNueva ? " — cuenta NUEVA" : ""}, ${t.tipo}, agrupadora ${t.agr}) ← ${xs.length} movimientos · salen ${$(xs.reduce((s, a) => s + n(a.m.debitos), 0))} · entran ${$(xs.reduce((s, a) => s + n(a.m.creditos), 0))}`)
  for (const a of xs) console.log(`   ${a.m.fecha} ${n(a.m.debitos) ? "-" + $(n(a.m.debitos)) : "+" + $(n(a.m.creditos))} ${a.m.descripcion} · ${String(a.m.detalle ?? "").slice(0, 60)}`)
}
if (acciones.length !== 17) frenos.push(`se esperaban 17 movimientos y hay ${acciones.length}`)
if (frenos.length) { console.log("\n🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada)"); process.exit(0) }
if (existsSync(FOTO)) { console.log(`🛑 ${FOTO} ya existe`); process.exit(1) }
writeFileSync(FOTO, JSON.stringify({ tomada: new Date().toISOString(), "public.pam_galicia": acciones.map(a => a.m) }, null, 2))

// ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────
const hecho: { cuentas: string[]; templates: string[]; cuotas: string[] } = { cuentas: [], templates: [], cuotas: [] }
const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2)); guardar()
for (const t of TEMPLATES.filter(t => t.cuentaNueva)) {
  const { data, error } = await sb.from("cuentas_contables").insert({ categ: t.categ, cuenta_contable: t.categ, tipo: t.tipo, activo: true, imputable: true,
    nombre_totalizadora: t.agr.toUpperCase() }).select("id").single()
  if (error) throw error; hecho.cuentas.push(data.id); guardar()
}
const { id: _i, created_at: _c, updated_at: _u, template_master_id: _m, ...b } = base
const tplId = new Map<string, string>()
for (const t of TEMPLATES) {
  const { data, error } = await sb.from("egresos_sin_factura").insert({ ...b, nombre_referencia: t.nombre, categ: t.categ, tipo: t.tipo, cuenta_agrupadora: t.agr,
    template_master_id: base.template_master_id, cuit_quien_cobra: null, nombre_quien_cobra: null, activo: true,
    observaciones_template: `${HUELLA}: lo de PAM que importa al resto (2025 presentado; PAM no sigue en 2026)` }).select("id").single()
  if (error) throw error; hecho.templates.push(data.id); tplId.set(t.nombre, data.id); guardar()
}
for (const a of acciones) {
  const m = a.m, ingreso = n(m.creditos) > 0, id = tplId.get(a.t.nombre)!
  const { data: cu, error } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: id, fecha_vencimiento: m.fecha, fecha_estimada: m.fecha, fecha_pago: m.fecha,
    monto: ingreso ? n(m.creditos) : n(m.debitos), estado: "conciliado", detalle: `${a.t.nombre} — ${String(m.detalle ?? "").trim() || m.descripcion}`.slice(0, 250),
    tipo_movimiento: ingreso ? "ingreso" : "egreso", medio_pago: "banco", visible_contable: false }).select("id").single()
  if (error) throw error; hecho.cuotas.push(cu.id); guardar()
  const { error: e2 } = await sb.from("pam_galicia").update({ template_id: id, template_cuota_id: cu.id, comprobantes_pagados: `${a.t.nombre} - ${mesDe(m.fecha)}`,
    nota_operador: [String(m.nota_operador || "").trim(), `${HUELLA}: «${a.t.nota.toUpperCase()}» → template ${a.t.nombre} (sigue en histórico)`].filter(Boolean).join(" · ") })
    .eq("id", m.id).is("template_cuota_id", null)
  if (e2) throw e2
}
console.log(`\n✅ Escrito: ${hecho.cuentas.length} cuentas · ${hecho.templates.length} templates · ${hecho.cuotas.length} cuotas atadas`)
