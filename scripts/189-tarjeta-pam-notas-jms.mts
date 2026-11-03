/**
 * 💳 Script 189 — Tarjeta VISA PAM con las notas de JMS (A-FEAT-1526; JMS 03/11: «listo tarjeta visa pam, fijate mis notas» y
 * «1 a consumo, 2 ok, adelante»).
 *
 *     npx tsx scripts/189-tarjeta-pam-notas-jms.mts              ← SIMULA
 *     npx tsx scripts/189-tarjeta-pam-notas-jms.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * Lee la nota de cada renglón del Excel «Tarjeta VISA PAM - hoy y propuesta» y, para lo que sigue abierto en `pam.tarjeta_visa`:
 *   · «historico» y DirecTV («¿son las FC de MSA?» → no: las de MSA empiezan 22/12/25) → estado HISTÓRICO (PAM 2025 ya presentado).
 *   · «super», «consumo», «fc» (sin factura en ninguna empresa) → template «Consumos MA» de PAM 2025 (el de los consumos de la tarjeta).
 *   · «ACA PAM» → template «ACA» de PAM 2025.
 *   · «prosegur nuevo template de MA» → template NUEVO «Prosegur MA» (categ SEGURIDAD Y ALARMA), marca LIB.
 *   · «conciliar contra pago»: los «Su pago» de ene y feb-26 → `vincularPagoTarjeta` con su débito de la CA PAM; las 2
 *     «cancelación de deuda con saldo acreedor» (pasan a pesos el saldo en dólares) → conciliadas como informativas.
 *   · «ver» (transferencia de deuda en dólares 09/01/26) → informativa (JMS: «2 ok»).
 *
 * Deshacer: `189-…-deshacer.mts` restaura desde la foto y borra sólo lo creado (`scripts/189-hecho.json`).
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { vincularPagoTarjeta } from "../lib/conciliacion/vincular-pago-tarjeta"

const ESCRIBIR = process.argv.includes("--escribir")
const FOTO = "scripts/189-foto-antes.json", HECHO = "scripts/189-hecho.json"
const HUELLA = "[script 189] JMS 03/11 (Excel tarjeta PAM)"
const EXCEL = join("- Comunicacion JMS Claude - Archivos", "Balance", "Excels trabajando con claude", "Tarjeta VISA PAM - hoy y propuesta (2026-11-02).xlsx")
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const pam = sb.schema("pam")
const n = (x: unknown) => Number(String(x ?? "").replace(/,/g, "")) || 0
const r2 = (x: number) => Math.round(x * 100) / 100
const $ = (x: number) => `$ ${r2(x).toLocaleString("es-AR")}`
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const mesDe = (f: string) => `${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`
const frenos: string[] = []

// ── Notas ────────────────────────────────────────────────────────────────────────────────────────────────
const wb = XLSX.readFile(EXCEL, { cellDates: true })
const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets["Detalle"], { raw: true, defval: "" })
const iso = (v: any) => (v instanceof Date ? new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : String(v).slice(0, 10))
const clave = (f: string, d: string, a: number, b: number, c: number, e: number) => `${f}|${d.trim().toUpperCase()}|${r2(a)}|${r2(b)}|${r2(c)}|${r2(e)}`
const notas = new Map<string, string[]>()
for (const r of rows) {
  const nota = [r["JMS: OK / cambio"], r["JMS: nota"]].map(x => String(x ?? "").trim()).filter(Boolean).join(" · ").toLowerCase()
  if (!r["Fecha"] || !nota || nota === "conciliado") continue
  const k = clave(iso(r["Fecha"]), String(r["Descripción"]), n(r["Débitos $"]), n(r["Créditos $"]), n(r["Débitos US$"]), n(r["Créditos US$"]))
  notas.set(k, [...(notas.get(k) ?? []), nota])
}
const { data: abiertos } = await pam.from("tarjeta_visa").select("*").in("estado", ["pendiente", "auditar"])
const porClave = new Map<string, any[]>()
for (const m of abiertos ?? []) {
  const k = clave(m.fecha, m.descripcion, n(m.debitos), n(m.creditos), n(m.debitos_usd), n(m.creditos_usd))
  porClave.set(k, [...(porClave.get(k) ?? []), m])
}
type Que = "historico" | "consumo" | "aca" | "prosegur" | "supago" | "informativo"
const tipo = (nota: string, m: any): Que | null => {
  if (/directv/i.test(m.descripcion) || nota === "historico" || nota === "hisotirco") return "historico"
  if (/^(super|consumo|fc)$/.test(nota)) return "consumo"
  if (nota === "aca pam") return "aca"
  if (/prosegur/.test(nota)) return "prosegur"
  if (nota === "conciliar contra pago") return /^SU PAGO/.test(m.descripcion) ? "supago" : "informativo"
  if (nota === "ver" && /TRANSFERENCIA DEUDA/.test(m.descripcion)) return "informativo"
  return null
}
const acc: { m: any; q: Que; nota: string }[] = []
const sinCaso: string[] = []
for (const [k, ns] of notas) {
  const ms = porClave.get(k) ?? []
  if (!ms.length) continue // ya resuelto
  if (ms.length !== ns.length) { frenos.push(`${k}: ${ns.length} notas para ${ms.length} renglones abiertos`); continue }
  ms.forEach((m, i) => { const q = tipo(ns[i], m); if (q) acc.push({ m, q, nota: ns[i] }); else sinCaso.push(`${m.fecha} ${m.descripcion} «${ns[i]}»`) })
}
const abiertosSinNota = (abiertos ?? []).filter((m: any) => !acc.some(a => a.m.id === m.id))

// ── Templates y pagos ────────────────────────────────────────────────────────────────────────────────────
const { data: tps } = await sb.from("egresos_sin_factura").select("*").in("id", ["d2c1fbbe-8e85-4445-824e-eb590abf4fe2", "cedcd8ee-ce1f-410a-aebf-b39e150464bb"])
const CONS = (tps ?? []).find((t: any) => t.id === "d2c1fbbe-8e85-4445-824e-eb590abf4fe2"), ACA = (tps ?? []).find((t: any) => t.id === "cedcd8ee-ce1f-410a-aebf-b39e150464bb")
if (!CONS || !ACA) frenos.push("faltan los templates de consumos / ACA de PAM")
const { data: yaPros } = await sb.from("egresos_sin_factura").select("id").eq("nombre_referencia", "Prosegur MA")
if (yaPros?.length) frenos.push("ya existe «Prosegur MA»")
const PAGOS = [
  { fecha: "2026-01-12", monto: 450000, usd: 0, debito: "ff341112-b48b-4c1a-9d3a-83f7928ca0f2", nr: "VI00000000059218184", cierre: "2025-12-31" },
  { fecha: "2026-02-06", monto: 340063.12, usd: 0, debito: "f473be33-f1ef-4aeb-a576-71e12f689598", nr: "VI00000000061164172", cierre: "2026-01-29" },
  { fecha: "2026-02-06", monto: 0, usd: 4.32, debito: "db890f0f-44c5-4d45-82d7-0b6967bcec25", nr: "VI00000000061164172", cierre: "2026-01-29" },
]
const supagos = acc.filter(a => a.q === "supago")
const vinc = PAGOS.map(p => ({ p, m: supagos.find(a => a.m.fecha === p.fecha && r2(n(a.m.creditos)) === p.monto && r2(n(a.m.creditos_usd)) === p.usd)?.m }))
for (const v of vinc) if (!v.m) frenos.push(`no encuentro el «Su pago» del ${v.p.fecha} por ${v.p.monto || v.p.usd + " US$"}`)
if (supagos.length !== PAGOS.length) frenos.push(`«Su pago» a vincular: ${supagos.length} en vez de ${PAGOS.length}`)
const { data: debs } = await sb.from("pam_galicia").select("*").in("id", PAGOS.map(p => p.debito))
for (const p of PAGOS) { const d = (debs ?? []).find((x: any) => x.id === p.debito); if (!d || (p.monto && r2(n(d.debitos)) !== p.monto)) frenos.push(`débito del ${p.fecha} no coincide`) }

// ── Reporte ──────────────────────────────────────────────────────────────────────────────────────────────
const imp = (m: any) => n(m.debitos) ? $(n(m.debitos)) : n(m.creditos) ? "+" + $(n(m.creditos)) : `${n(m.debitos_usd) || "+" + n(m.creditos_usd)} US$`
for (const q of ["historico", "consumo", "aca", "prosegur", "supago", "informativo"] as Que[]) {
  const xs = acc.filter(a => a.q === q)
  console.log(`\n${q.toUpperCase()} · ${xs.length}`)
  for (const a of xs.slice(0, q === "historico" ? 6 : 99)) console.log(`   ${a.m.fecha} ${a.m.descripcion.slice(0, 40)} ${imp(a.m)} «${a.nota}»`)
  if (q === "historico" && xs.length > 6) console.log(`   … y ${xs.length - 6} más`)
}
console.log(`\nAbiertos hoy: ${(abiertos ?? []).length} · con acción: ${acc.length} · sin nota o sin caso: ${abiertosSinNota.length}`)
for (const m of abiertosSinNota) console.log(`   ⚠️ ${m.fecha} ${m.descripcion} ${imp(m)} (${m.estado})`)
for (const s of sinCaso) console.log(`   ⚠️ sin caso: ${s}`)
if (frenos.length) { console.log("\n🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada)"); process.exit(0) }
if (existsSync(FOTO)) { console.log(`🛑 ${FOTO} ya existe`); process.exit(1) }
writeFileSync(FOTO, JSON.stringify({ tomada: new Date().toISOString(), "pam.tarjeta_visa": acc.map(a => a.m), "public.pam_galicia": debs }, null, 2))

// ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────
const hecho: { templates: string[]; cuotas: string[] } = { templates: [], cuotas: [] }
const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2)); guardar()
const nota = (m: any, txt: string) => [String(m.nota_operador || "").trim(), `${HUELLA}: ${txt}`].filter(Boolean).join(" · ")
const aTemplate = async (m: any, t: any, txt: string, extra: Record<string, unknown> = {}) => {
  const { data: q, error } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: t.id, fecha_vencimiento: m.fecha, fecha_estimada: m.fecha, fecha_pago: m.fecha,
    monto: n(m.debitos), estado: "conciliado", detalle: `${t.nombre_referencia} — ${m.descripcion}`.slice(0, 250), tipo_movimiento: "egreso", medio_pago: "tarjeta", visible_contable: false }).select("id").single()
  if (error) throw error; hecho.cuotas.push(q.id); guardar()
  const { error: e2 } = await pam.from("tarjeta_visa").update({ estado: "conciliado", categ: t.categ, template_id: t.id, template_cuota_id: q.id, motivo_revision: null, ...extra,
    comprobantes_pagados: `${t.nombre_referencia} - ${mesDe(m.fecha)}`, nota_operador: nota(m, txt) }).eq("id", m.id)
  if (e2) throw e2
}
for (const a of acc.filter(a => a.q === "historico")) {
  const { error } = await pam.from("tarjeta_visa").update({ estado: "historico", motivo_revision: null,
    nota_operador: nota(a.m, /directv/i.test(a.m.descripcion) ? "DirecTV pagado por PAM antes de que factura MSA (22/12/25) → histórico" : `«${a.nota}»`) }).eq("id", a.m.id)
  if (error) throw error
}
for (const a of acc.filter(a => a.q === "consumo")) await aTemplate(a.m, CONS, `«${a.nota}» → consumo`)
for (const a of acc.filter(a => a.q === "aca")) await aTemplate(a.m, ACA, "«ACA PAM»")
for (const a of acc.filter(a => a.q === "prosegur")) {
  const { id: _i, created_at: _c, updated_at: _u, ...b } = CONS
  const { data: t, error } = await sb.from("egresos_sin_factura").insert({ ...b, nombre_referencia: "Prosegur MA", responsable: "MA", categ: "SEGURIDAD Y ALARMA", año: null,
    template_origen_id: null, observaciones_template: `${HUELLA}: «prosegur nuevo template de MA» (Prosegur es de Libertad, marca LIB)` }).select("*").single()
  if (error) throw error; hecho.templates.push(t.id); guardar()
  await aTemplate(a.m, t, "«prosegur nuevo template de MA»", { contable: "LIB" })
}
for (const v of vinc) await vincularPagoTarjeta(sb, { nr: v.p.nr, cierre: v.p.cierre, debito: { tabla: "public.pam_galicia", id: v.p.debito }, tarjeta: { tabla: "pam.tarjeta_visa" }, suPagoIds: [v.m.id] })
for (const v of vinc) { const { error } = await pam.from("tarjeta_visa").update({ nota_operador: nota(v.m, "«conciliar contra pago» → su débito de la CA PAM") }).eq("id", v.m.id); if (error) throw error }
for (const a of acc.filter(a => a.q === "informativo")) {
  const { error } = await pam.from("tarjeta_visa").update({ estado: "conciliado", categ: "Tarjetas PAM", motivo_revision: null, comprobantes_pagados: `Tarjeta VISA PAM - ${mesDe(a.m.fecha)}`,
    nota_operador: nota(a.m, "informativo: el banco pasa a pesos el saldo en dólares de la tarjeta (el gasto ya está en los consumos)") }).eq("id", a.m.id)
  if (error) throw error
}
console.log(`\n✅ Escrito: ${acc.filter(a => a.q === "historico").length} a histórico · ${hecho.cuotas.length} cuotas · ${hecho.templates.length} template · ${vinc.length} pagos vinculados · ${acc.filter(a => a.q === "informativo").length} informativos`)
