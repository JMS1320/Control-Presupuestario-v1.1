/**
 * 💳 Script 179 — A-FEAT-1526: TARJETA VISA MA, lo que quedó después del 178, conciliado «a mano según lo que hablamos»
 * (JMS 02/11: «concilia a mano lo que falta según lo que hemos hablado»).
 *
 *     npx tsx scripts/179-tarjeta-ma-lo-que-falta.mts              ← SIMULA
 *     npx tsx scripts/179-tarjeta-ma-lo-que-falta.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * Lo que se habló y se aplica:
 *   • ACCIONAR (1) (JMS: «primero la factura; si no hay, el template de su tipo; si después llega la factura, se cambia»):
 *       supermercados → «Supermercados MA» (SUPERMERCADOS Y CARNICERIA) · combustible → «Combustibles MA» (COMBUSTIBLES Y
 *       LUBRICANTES) · VTV → «Mantenimiento autos MA» (AUTOMOTORES REP Y MANTENIMIENTO, «como la cuenta de MSA») ·
 *       Sodimac/Easy/Pinturerías/Prestigio → «Pintura, materiales y herramientas MA» (cuenta NUEVA, JMS la nombró).
 *       Antes de ir a template, se busca una factura de MA del mismo importe (±$ 1, −15/+60 días): si está, va a la factura.
 *       Los templates se crean igual que «Consumos MA» (abierto, año 2026, agrupadora «Gastos Personales MA») y cada
 *       movimiento lleva SU cuota, como hace el motor (una cuota por movimiento, «Template — Comercio»).
 *   • JOCKEY sep-26 → una cuota nueva en su template «Jockey Club» (sus cuotas llegan hasta ago-26).
 *   • DIRECTV ×10 y la nafta de Cerrito 07/12 (facturas de MSA, a auditar) → OK con contable «AP 3 MSA» (JMS: «si MA paga
 *       algo de MSA, MA aportó a MSA»; el rótulo sigue el patrón de «RET 3 MA»). La DirecTV de nov-25 no tiene factura:
 *       queda pendiente (JMS: «debe coincidir, si no queda pendiente»).
 *   • MASCOTAS: cuenta NUEVA (sin agrupadora, como «Consumos»), a las facturas de Mascotillas, Huellitas y Mimados.
 *   ✋ Las cuentas nuevas quedan SIN agrupadora: dónde van lo decide JMS después (C3).
 *
 * Deshacer: `179-…-deshacer.mts` borra SÓLO las cuentas, templates y cuotas que creó (ids en `scripts/179-hecho.json`)
 * y restaura los movimientos y facturas desde `scripts/179-foto-antes.json`.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { conciliarOrigenDelMovimiento } from "../lib/conciliacion/confirmar-origen"
import { asignarCuentaAFacturas } from "../lib/conciliacion/asignar-cuenta"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"

const ESCRIBIR = process.argv.includes("--escribir")
const FOTO = "scripts/179-foto-antes.json", HECHO = "scripts/179-hecho.json"
const HUELLA = "[script 179] JMS 02/11"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ma = sb.schema("ma")
const n = (x: unknown) => Number(x) || 0
const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const mesDe = (f: string) => `${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`
const titulo = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
const comercio = (d: string) => titulo(d.replace(/\s*\d{3,}.*$/, "").replace(/^(MERPAGO\*|DLO\*)/i, "").trim()).slice(0, 30)
const frenos: string[] = []

// ── Qué va a dónde ───────────────────────────────────────────────────────────────────────────────────────
const CUENTAS_NUEVAS = ["Pintura, materiales y herramientas", "Mascotas"]
const GRUPOS: { tpl: string; categ: string; re: RegExp }[] = [
  { tpl: "Supermercados MA", categ: "SUPERMERCADOS Y CARNICERIA", re: /^(DISCO|DIS\.COM|CENCOSUD|DIA TIENDA|JUMBO)/i },
  { tpl: "Combustibles MA", categ: "COMBUSTIBLES Y LUBRICANTES", re: /^(EST DE SERVICIO CERRITO|AXION|PARADOR SAN PEDRO)/i },
  { tpl: "Mantenimiento autos MA", categ: "AUTOMOTORES REP Y MANTENIMIENTO", re: /^VTV/i },
  { tpl: "Pintura, materiales y herramientas MA", categ: "Pintura, materiales y herramientas", re: /^(SODIMAC|EASY|CENTRO PINTURERIAS|PRESTIGIO)/i },
]

// ── Lectura ──────────────────────────────────────────────────────────────────────────────────────────────
const { data: tj } = await ma.from("tarjeta_visa").select("*").in("estado", ["pendiente", "auditar"]).order("fecha")
const abiertos = (tj ?? []) as any[]
const { data: plan } = await sb.from("cuentas_contables").select("categ, cuenta_contable, nro_cuenta, tipo")
const enPlan = (c: string) => (plan ?? []).find((p: any) => p.categ === c)
for (const c of CUENTAS_NUEVAS) if (enPlan(c)) frenos.push(`la cuenta «${c}» ya existe: ¿ya se corrió?`)
for (const g of GRUPOS) if (!CUENTAS_NUEVAS.includes(g.categ) && !enPlan(g.categ)) frenos.push(`la cuenta «${g.categ}» no está en el plan`)
const { data: tplsExist } = await sb.from("egresos_sin_factura").select("id,nombre_referencia,responsable").in("nombre_referencia", [...GRUPOS.map(g => g.tpl), "Jockey Club", "Consumos MA"])
for (const g of GRUPOS) if ((tplsExist ?? []).some((t: any) => t.nombre_referencia === g.tpl)) frenos.push(`el template «${g.tpl}» ya existe`)
const modelo = (tplsExist ?? []).find((t: any) => t.nombre_referencia === "Consumos MA" && t.responsable === "MA")
const jockeyTpl = (tplsExist ?? []).find((t: any) => t.nombre_referencia === "Jockey Club" && t.responsable === "MA")
const { data: modeloRow } = await sb.from("egresos_sin_factura").select("*").eq("id", modelo?.id).single()
const { data: jockeyRow } = jockeyTpl ? await sb.from("egresos_sin_factura").select("categ").eq("id", jockeyTpl.id).single() : { data: null }
const { data: fcMA } = await ma.from("comprobantes_arca").select("id,denominacion_emisor,fecha_emision,imp_total,cuenta_contable")
const fcUsadas = new Set<string>()
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const { data } = await (t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)).select("comprobante_arca_id").not("comprobante_arca_id", "is", null)
  for (const x of data ?? []) fcUsadas.add(x.comprobante_arca_id)
}

// ── Plan ─────────────────────────────────────────────────────────────────────────────────────────────────
interface ATemplate { mov: any; grupo: typeof GRUPOS[number] }
const aTemplate: ATemplate[] = [], aFactura: { mov: any; fc: any }[] = []
for (const m of abiertos.filter(m => m.estado === "pendiente" && !m.comprobante_arca_id)) {
  const g = GRUPOS.find(g => g.re.test(m.descripcion)); if (!g) continue
  const fc = (fcMA ?? []).find((c: any) => !fcUsadas.has(c.id) && Math.abs(n(c.imp_total) - n(m.debitos)) <= 1 && dias(m.fecha, c.fecha_emision) >= -15 && dias(m.fecha, c.fecha_emision) <= 60)
  if (fc) { fcUsadas.add(fc.id); aFactura.push({ mov: m, fc }) } else aTemplate.push({ mov: m, grupo: g })
}
const jockey = abiertos.find(m => /^JOCKEY/i.test(m.descripcion) && m.estado === "pendiente")
if (jockey && !jockeyTpl) frenos.push("no encontré el template Jockey Club de MA")
const aporte = abiertos.filter(m => m.estado === "auditar" && m.comprobante_arca_id && /Factura de MSA/.test(m.motivo_revision ?? ""))
const { data: fcMasc } = await ma.from("comprobantes_arca").select("id").in("id",
  (await ma.from("tarjeta_visa").select("comprobante_arca_id").or("descripcion.ilike.MERPAGO*MASCOTILLAS%,descripcion.ilike.MERPAGO*HUELLITAS%,descripcion.ilike.MIMADOS%").not("comprobante_arca_id", "is", null)).data!.map((x: any) => x.comprobante_arca_id))
const resto = abiertos.filter(m => !aTemplate.some(a => a.mov.id === m.id) && !aFactura.some(a => a.mov.id === m.id) && m.id !== jockey?.id && !aporte.some(a => a.id === m.id))

console.log(`Cuentas nuevas: ${CUENTAS_NUEVAS.join(" · ")} (sin agrupadora)`)
for (const g of GRUPOS) { const xs = aTemplate.filter(a => a.grupo === g); console.log(`Template «${g.tpl}» (${g.categ}): ${xs.length} movimientos · $ ${xs.reduce((t, a) => t + n(a.mov.debitos), 0).toFixed(2)}`) }
console.log(`Contra factura de MA (encontrada antes de ir a template): ${aFactura.length}${aFactura.map(a => `\n   ${a.mov.fecha} ${a.mov.descripcion} ${a.mov.debitos} → ${a.fc.denominacion_emisor} ${a.fc.fecha_emision}`).join("")}`)
console.log(`Jockey ${jockey?.fecha ?? "—"} → cuota nueva en «Jockey Club»`)
console.log(`AP 3 MSA (factura de MSA pagada por MA): ${aporte.length} · ${aporte.map(a => a.descripcion.split(" ")[0]).join(", ")}`)
console.log(`Cuenta Mascotas a ${(fcMasc ?? []).length} facturas`)
console.log(`Queda sin tocar: ${resto.length}${resto.map(r => `\n   ${r.fecha} ${r.descripcion} ${r.debitos} (${r.estado})`).join("")}`)

// ── Foto ─────────────────────────────────────────────────────────────────────────────────────────────────
const idsFc = [...aFactura.map(a => a.fc.id), ...aporte.map(a => a.comprobante_arca_id), ...(fcMasc ?? []).map((f: any) => f.id)]
const fotoFc: Record<string, any[]> = {}
for (const s of ["ma", "msa"]) fotoFc[`${s}.comprobantes_arca`] = (await sb.schema(s).from("comprobantes_arca").select("*").in("id", idsFc)).data ?? []
const prop: Record<string, any[]> = {}
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const { data } = await (t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)).select("*").in("comprobante_arca_id", (fcMasc ?? []).map((f: any) => f.id))
  if (data?.length) prop[`${t.schema}.${t.tabla}`] = data
}
const tocados = [...aTemplate.map(a => a.mov), ...aFactura.map(a => a.mov), ...aporte, jockey].filter(Boolean)
if (frenos.length) { console.log("\n🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada)"); process.exit(0) }
if (existsSync(FOTO)) { console.log(`🛑 ${FOTO} ya existe`); process.exit(1) }
writeFileSync(FOTO, JSON.stringify({ tomada: new Date().toISOString(), "ma.tarjeta_visa": tocados, ...fotoFc, propagacion: prop }, null, 2))

// ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────
const hecho: { cuentas: string[]; templates: string[]; cuotas: string[] } = { cuentas: [], templates: [], cuotas: [] }
const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2))
for (const c of CUENTAS_NUEVAS) {
  const { data, error } = await sb.from("cuentas_contables").insert({ categ: c, cuenta_contable: c, tipo: "egreso", activo: true, imputable: true }).select("id").single()
  if (error) throw error; hecho.cuentas.push(data.id); guardar()
}
const { id: _i, created_at: _c, updated_at: _u, ...base } = modeloRow as any
const tplId = new Map<string, string>()
for (const g of GRUPOS) {
  const { data, error } = await sb.from("egresos_sin_factura").insert({ ...base, nombre_referencia: g.tpl, categ: g.categ, template_origen_id: null,
    observaciones_template: `${HUELLA}: accionar (1) — sin factura va acá; si llega la factura, se cambia` }).select("id").single()
  if (error) throw error; tplId.set(g.tpl, data.id); hecho.templates.push(data.id); guardar()
}
const nroDe = (c: string) => enPlan(c)?.nro_cuenta ?? null
const atar = async (m: any, egresoId: string, nombreTpl: string, categ: string) => {
  const det = `${nombreTpl} — ${comercio(m.descripcion)}`
  const { data: cu, error } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: egresoId, fecha_vencimiento: m.fecha, fecha_estimada: m.fecha, fecha_pago: m.fecha,
    monto: n(m.debitos), estado: "conciliado", detalle: det, tipo_movimiento: "egreso", medio_pago: "banco", visible_contable: false }).select("id").single()
  if (error) throw error; hecho.cuotas.push(cu.id); guardar()
  const { error: e2 } = await ma.from("tarjeta_visa").update({ estado: "conciliado", categ, nro_cuenta: nroDe(categ), detalle: m.detalle || det, template_id: egresoId, template_cuota_id: cu.id,
    comprobantes_pagados: `${nombreTpl} - ${mesDe(m.fecha)}`, motivo_revision: null, nota_operador: [String(m.nota_operador || "").trim(), HUELLA].filter(Boolean).join(" · ") }).eq("id", m.id)
  if (e2) throw e2
}
for (const a of aTemplate) await atar(a.mov, tplId.get(a.grupo.tpl)!, a.grupo.tpl, a.grupo.categ)
if (jockey) await atar(jockey, jockeyTpl.id, "Jockey Club", (jockeyRow as any)?.categ ?? "Consumos")
const avisos: string[] = []
for (const a of aFactura) {
  const { error } = await ma.from("tarjeta_visa").update({ estado: "conciliado", comprobante_arca_id: a.fc.id, motivo_revision: null, nota_operador: [String(a.mov.nota_operador || "").trim(), `${HUELLA}: contra su factura`].filter(Boolean).join(" · ") }).eq("id", a.mov.id)
  if (error) throw error
  avisos.push(...(await conciliarOrigenDelMovimiento(sb as any, { ...a.mov, comprobante_arca_id: a.fc.id })).avisos)
}
for (const m of aporte) {
  const huella = `OK ${HUELLA} · aporte de MA a MSA · ${m.motivo_revision ?? ""}`
  const { error } = await ma.from("tarjeta_visa").update({ estado: "conciliado", contable: "AP 3 MSA", motivo_revision: null, nota_operador: [String(m.nota_operador || "").trim(), huella].filter(Boolean).join(" · ") }).eq("id", m.id)
  if (error) throw error
  avisos.push(...(await conciliarOrigenDelMovimiento(sb as any, m)).avisos)
}
const rM = (fcMasc ?? []).length ? await asignarCuentaAFacturas(sb as any, "MA", (fcMasc ?? []).map((f: any) => f.id), { cuenta_contable: "Mascotas" }) : null
console.log(`\n✅ Escrito: ${hecho.cuentas.length} cuentas · ${hecho.templates.length} templates · ${hecho.cuotas.length} cuotas · ${aFactura.length} contra factura · ${aporte.length} AP 3 MSA · Mascotas: ${rM?.actualizados ?? 0} facturas, ${rM?.propagacion.propagados ?? 0} movimientos`)
if (avisos.length) console.log("⚠️ Avisos:\n - " + avisos.join("\n - "))
