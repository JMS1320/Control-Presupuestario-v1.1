/**
 * 🏦 Script 185 — CA Galicia MA, tanda 5 (A-FEAT-1526; JMS 03/11: «ok con los pendientes de MA» y «el template de PAM de reintegros
 * lo debe tener MA porque le hacen los mismos reintegros. Copiá a MA el de PAM y que MA tenga el suyo para esos movimientos»).
 *
 *     npx tsx scripts/185-ca-ma-tanda-5.mts              ← SIMULA
 *     npx tsx scripts/185-ca-ma-tanda-5.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * 1 · Template «Promocion Galicia MA», copia del de PAM (`5da73b7e…`, misma categoría y agrupadora) → los 2 reintegros (ingreso).
 * 2 · Débito sin factura: IWorld ×2 y Guido Comercial → «Consumos MA»; Shell y Axion → «Combustibles MA».
 * 3 · Le facturan a MSA → contable «AP 3 MSA» (MA pagó algo de MSA = MA aportó a MSA), con la cuenta que el proveedor tiene en MSA:
 *     Bolig 19/01 $ 95.000 ↔ su factura de MSA del mismo día y monto (se ata y se concilia); Aduriz ×2 (INFORMATICA) y Leguizamón
 *     (GASTOS VARIOS ESTRUCTURA) sin factura que coincida.
 *
 * Deshacer: `185-…-deshacer.mts` restaura desde la foto y borra sólo el template y las cuotas creadas (`scripts/185-hecho.json`).
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { conciliarOrigenDelMovimiento } from "../lib/conciliacion/confirmar-origen"

const ESCRIBIR = process.argv.includes("--escribir")
const FOTO = "scripts/185-foto-antes.json", HECHO = "scripts/185-hecho.json"
const HUELLA = "[script 185] JMS 03/11"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ma = sb.schema("ma")
const n = (x: unknown) => Number(x) || 0
const $ = (x: number) => `$ ${(Math.round(x * 100) / 100).toLocaleString("es-AR")}`
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const mesDe = (f: string) => `${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`
const frenos: string[] = []

const { data: abiertos } = await ma.from("ma_galicia").select("*").eq("estado", "pendiente")
const movs = abiertos ?? []
const uno = (f: (m: any) => boolean, qué: string) => { const xs = movs.filter(f); if (xs.length !== 1) frenos.push(`${qué}: ${xs.length} encontrados`); return xs[0] }
const c = (m: any) => String(m.concepto ?? "")

// ── 1 · Promoción Galicia ────────────────────────────────────────────────────────────────────────────────
const { data: tplPam } = await sb.from("egresos_sin_factura").select("*").eq("id", "5da73b7e-db88-4078-a266-add1824df78f").single()
const { data: yaMa } = await sb.from("egresos_sin_factura").select("id").eq("responsable", "MA").ilike("nombre_referencia", "Promocion Galicia%")
if (yaMa?.length) frenos.push("MA ya tiene un template «Promocion Galicia»")
const promos = movs.filter((m: any) => n(m.creditos) > 0 && /PROMO|REINTEGRO PROMOCION/.test(m.descripcion))
// ── 2 · Consumos y combustibles ──────────────────────────────────────────────────────────────────────────
const { data: tplsMa } = await sb.from("egresos_sin_factura").select("id,nombre_referencia,categ").eq("responsable", "MA").in("nombre_referencia", ["Consumos MA", "Combustibles MA"])
const tplMa = (nm: string) => (tplsMa ?? []).find((t: any) => t.nombre_referencia === nm)
const aTpl: { m: any; t: string; quien: string }[] = [
  ...movs.filter((m: any) => /IWORLD SHOP|GUIDO COMERCIAL/.test(c(m))).map((m: any) => ({ m, t: "Consumos MA", quien: /IWORLD/.test(c(m)) ? "IWorld Shop" : "Guido Comercial" })),
  ...movs.filter((m: any) => /SHELL SARMIENTO|AXION LIMA/.test(c(m))).map((m: any) => ({ m, t: "Combustibles MA", quien: /SHELL/.test(c(m)) ? "Shell Sarmiento" : "Axion Lima" })),
]
if (aTpl.length !== 5) frenos.push(`consumos/combustibles: ${aTpl.length} en vez de 5`)
// ── 3 · AP 3 MSA ─────────────────────────────────────────────────────────────────────────────────────────
const bolig = uno((m: any) => /20282866618/.test(c(m)) && m.fecha === "2026-01-19" && n(m.debitos) === 95000, "Bolig 19/01")
const { data: fcBolig } = await sb.schema("msa").from("comprobantes_arca").select("*").eq("cuit", "20282866618").eq("fecha_emision", "2026-01-19").eq("imp_total", 95000)
if (fcBolig?.length !== 1) frenos.push(`Bolig: ${fcBolig?.length ?? 0} facturas de MSA del 19/01 por $ 95.000`)
const ap: { m: any; categ: string; quien: string }[] = [
  ...movs.filter((m: any) => /20263173326/.test(c(m))).map((m: any) => ({ m, categ: "INFORMATICA", quien: "Aduriz" })),
  ...movs.filter((m: any) => /27124882511/.test(c(m))).map((m: any) => ({ m, categ: "GASTOS VARIOS ESTRUCTURA", quien: "Leguizamón" })),
]
if (ap.length !== 3) frenos.push(`Aduriz/Leguizamón: ${ap.length} en vez de 3`)
for (const x of [...promos, ...aTpl.map(a => a.m), bolig, ...ap.map(a => a.m)].filter(Boolean))
  if (x.comprobante_arca_id || x.template_cuota_id) frenos.push(`${x.fecha} ${x.descripcion}: ya tiene vínculo`)

console.log(`1 · Template nuevo «Promocion Galicia MA» (copia de PAM: categ ${tplPam?.categ}, agrupadora ${tplPam?.cuenta_agrupadora ?? "—"}) ← ${promos.length} reintegros`)
for (const m of promos) console.log(`   ${m.fecha} +${$(n(m.creditos))} ${m.descripcion}`)
console.log(`2 · A template:`); for (const a of aTpl) console.log(`   ${a.m.fecha} ${$(n(a.m.debitos))} ${a.quien} → ${a.t}`)
console.log(`3 · AP 3 MSA:`)
console.log(`   ${bolig?.fecha} ${$(n(bolig?.debitos))} Bolig ↔ factura de MSA ${fcBolig?.[0]?.tipo_comprobante_desc} ${fcBolig?.[0]?.numero_desde} (${fcBolig?.[0]?.estado}, ${fcBolig?.[0]?.cuenta_contable})`)
for (const a of ap) console.log(`   ${a.m.fecha} ${$(n(a.m.debitos))} ${a.quien} · sin factura que coincida · ${a.categ}`)
for (const nm of ["Consumos MA", "Combustibles MA"]) if (!tplMa(nm)) frenos.push(`no está «${nm}»`)

if (frenos.length) { console.log("\n🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada)"); process.exit(0) }
if (existsSync(FOTO)) { console.log(`🛑 ${FOTO} ya existe`); process.exit(1) }
writeFileSync(FOTO, JSON.stringify({ tomada: new Date().toISOString(), "ma.ma_galicia": [...promos, ...aTpl.map(a => a.m), bolig, ...ap.map(a => a.m)], "msa.comprobantes_arca": fcBolig }, null, 2))

// ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────
const hecho: { template: string | null; cuotas: string[] } = { template: null, cuotas: [] }
const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2)); guardar()
const nota = (m: any, txt: string) => [String(m.nota_operador || "").trim(), txt].filter(Boolean).join(" · ")
const { id: _i, created_at: _c, updated_at: _u, ...base } = tplPam
const { data: nuevo, error: eT } = await sb.from("egresos_sin_factura").insert({ ...base, responsable: "MA", nombre_referencia: "Promocion Galicia MA",
  template_origen_id: tplPam.id, observaciones_template: `${HUELLA}: copia del de PAM — a MA le hacen los mismos reintegros` }).select("id,nombre_referencia,categ").single()
if (eT) throw eT; hecho.template = nuevo.id; guardar()
const aTemplate = async (m: any, t: any, detalle: string, txt: string) => {
  const ingreso = n(m.creditos) > 0
  const { data: cu, error } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: t.id, fecha_vencimiento: m.fecha, fecha_estimada: m.fecha, fecha_pago: m.fecha,
    monto: ingreso ? n(m.creditos) : n(m.debitos), estado: "conciliado", detalle, tipo_movimiento: ingreso ? "ingreso" : "egreso", medio_pago: "banco", visible_contable: false }).select("id").single()
  if (error) throw error; hecho.cuotas.push(cu.id); guardar()
  const { error: e2 } = await ma.from("ma_galicia").update({ estado: "conciliado", categ: t.categ, nro_cuenta: null, detalle: m.detalle || detalle, template_id: t.id, template_cuota_id: cu.id,
    comprobantes_pagados: `${t.nombre_referencia} - ${mesDe(m.fecha)}`, motivo_revision: null, nota_operador: nota(m, `${HUELLA}: ${txt}`) }).eq("id", m.id)
  if (e2) throw e2
}
for (const m of promos) await aTemplate(m, nuevo, "Promocion Galicia MA", "reintegro Galicia → su template de MA")
for (const a of aTpl) await aTemplate(a.m, tplMa(a.t), `${a.t} — ${a.quien}`, `débito sin factura → ${a.t}`)
const avisos: string[] = []
{ const f = fcBolig![0]
  const { error } = await ma.from("ma_galicia").update({ comprobante_arca_id: f.id, estado: "conciliado", categ: f.cuenta_contable, contable: "AP 3 MSA", motivo_revision: null,
    nota_operador: nota(bolig, `${HUELLA}: factura de MSA (Bolig, mismo día y monto) pagada por MA = aporte de MA a MSA`) }).eq("id", bolig.id)
  if (error) throw error
  avisos.push(...(await conciliarOrigenDelMovimiento(sb as any, { ...bolig, comprobante_arca_id: f.id })).avisos) }
for (const a of ap) {
  const { error } = await ma.from("ma_galicia").update({ estado: "conciliado", categ: a.categ, contable: "AP 3 MSA", motivo_revision: null,
    nota_operador: nota(a.m, `${HUELLA}: ${a.quien} le factura a MSA; pago de MA sin factura que coincida = aporte de MA a MSA`) }).eq("id", a.m.id)
  if (error) throw error
}
console.log(`\n✅ Escrito: template «Promocion Galicia MA» · ${hecho.cuotas.length} cuotas · Bolig atado · ${ap.length} AP 3 MSA sin factura`)
if (avisos.length) console.log("⚠️ Avisos:\n - " + avisos.join("\n - "))
