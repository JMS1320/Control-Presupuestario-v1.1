/**
 * 🏦 Script 182 — CA Galicia MA, tanda 2 (A-FEAT-1526; respuestas de JMS 03/11 en esta terminal).
 *
 *     npx tsx scripts/182-ca-ma-tanda-2.mts              ← SIMULA
 *     npx tsx scripts/182-ca-ma-tanda-2.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * 1 · EXTRACCIONES PAGADAS EN EFECTIVO (JMS: «ok dejalo en eff»): el 27/11/25 ($ 2 M) contra Gamboa FC B 3937 y el 06/05/26
 *     ($ 1 M) contra Penino FC C 223 — el vínculo que propuso el motor se confirma (OK de la app: conciliado + nota + origen).
 * 2 · PROVINVEST (JMS: «retenciones de MA para cargar. Ganancias 1.476.557,28 e IIBB 984.371,52»): el crédito del 17/06/26
 *     ($ 22.148.359,20) cobra la FCE 00001-00000001 ($ 24.609.288) con las dos retenciones en `ma.retenciones_recibidas`
 *     (sin certificado todavía). La venta toma la cuenta «ARRENDAMIENTOS Venta», la misma que MSA usa con Provinvest.
 * 3 · LIBERTAD 2025 pagada por MA (JMS: «van al template de PAM sí»): ABL nov y dic, AySA dic y expensas nov → una cuota nueva
 *     en el template 2025 de PAM de cada uno (esos meses no tienen cuota), con la marca LIB. El papel de Libertad toma el mes
 *     como de PAM (socio hasta dic-25) y muestra que lo pagó MA.
 *
 * Deshacer: `182-…-deshacer.mts` restaura desde la foto y borra sólo las cuotas y retenciones creadas (ids en el «hecho»).
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { conciliarOrigenDelMovimiento } from "../lib/conciliacion/confirmar-origen"
import { imputacionParaElBanco, cerrarVentaSiSaldada } from "../lib/ventas/detalle-cobro-db"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"

const ESCRIBIR = process.argv.includes("--escribir")
const FOTO = "scripts/182-foto-antes.json", HECHO = "scripts/182-hecho.json"
const HUELLA = "[script 182] JMS 03/11"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ma = sb.schema("ma")
const n = (x: unknown) => Number(x) || 0
const r2 = (x: number) => Math.round(x * 100) / 100
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const mesDe = (f: string) => `${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`
const frenos: string[] = []

// ── Los casos, por id ────────────────────────────────────────────────────────────────────────────────────
const EFECTIVO = [
  { mov: "14fb9b90-ae63-4918-a56f-ef7765de741c", fc: "a1cfd021-690d-4515-9fc5-112907575b89", quien: "Gamboa FC B 3937" },
  { mov: "ee71dd50-4808-4ff7-b44e-c9a49ab5cd48", fc: "b97ca33a-caa9-4082-ab56-6ac4c6f58c78", quien: "Penino FC C 223" },
]
const PROV = { venta: "f2f68be8-e8ce-4035-a0ab-50a54d5e07f3", fecha: "2026-06-17", cobrado: 22148359.2, gan: 1476557.28, iibb: 984371.52, cuenta: "ARRENDAMIENTOS Venta" }
const LIBERTAD = [
  { mov: "dc69f53b-92bf-4775-a49f-86b520cb9a05", tpl: "de27c254-f8d2-45ad-a689-d33041a2c087" }, // ABL 07/11/25
  { mov: "95b508b4-5730-4efc-b7c1-e203f1721293", tpl: "de27c254-f8d2-45ad-a689-d33041a2c087" }, // ABL 17/12/25
  { mov: "51f35c60-a993-4c81-9a71-c4be03c2c335", tpl: "a3e4d09b-7853-49fa-9cf7-5e0704ea3657" }, // AySA 15/12/25
  { mov: "e77a1b15-06cc-403b-80e2-116aac0d6396", tpl: "68d7b742-962e-456b-8b76-2e235924b61a" }, // Expensas 10/11/25
]

// ── Lectura y controles ──────────────────────────────────────────────────────────────────────────────────
const { data: provMovs } = await ma.from("ma_galicia").select("*").eq("fecha", PROV.fecha).eq("creditos", PROV.cobrado)
if (provMovs?.length !== 1) frenos.push(`Provinvest: ${provMovs?.length ?? 0} créditos de $ ${PROV.cobrado} el ${PROV.fecha}`)
const provMov = provMovs?.[0]
const idsMov = [...EFECTIVO.map(e => e.mov), ...LIBERTAD.map(l => l.mov), ...(provMov ? [provMov.id] : [])]
const { data: movs } = await ma.from("ma_galicia").select("*").in("id", idsMov)
const mov = (id: string) => (movs ?? []).find((m: any) => m.id === id)
const { data: fcs } = await ma.from("comprobantes_arca").select("*").in("id", EFECTIVO.map(e => e.fc))
const { data: venta } = await ma.from("comprobantes_venta").select("*").eq("id", PROV.venta).single()
const { data: retPrev } = await ma.from("retenciones_recibidas").select("id").eq("comprobante_venta_id", PROV.venta)
const { data: tpls } = await sb.from("egresos_sin_factura").select("id,nombre_referencia,responsable,categ,año").in("id", [...new Set(LIBERTAD.map(l => l.tpl))])
const tpl = (id: string) => (tpls ?? []).find((t: any) => t.id === id)

// otros movimientos atados a las facturas del efectivo (no debería haber)
const fcVinc = new Map<string, number>()
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const { data } = await (t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)).select("comprobante_arca_id").in("comprobante_arca_id", EFECTIVO.map(e => e.fc))
  for (const x of data ?? []) fcVinc.set(x.comprobante_arca_id, (fcVinc.get(x.comprobante_arca_id) ?? 0) + 1)
}

console.log("1 · Extracciones pagadas en efectivo")
for (const e of EFECTIVO) {
  const m = mov(e.mov), f = (fcs ?? []).find((x: any) => x.id === e.fc)
  if (!m || m.estado !== "auditar" || m.comprobante_arca_id !== e.fc) frenos.push(`${e.quien}: el movimiento ya no está a auditar con esa factura`)
  if (!f || n(f.imp_total) !== n(m?.debitos)) frenos.push(`${e.quien}: el importe no coincide`)
  if ((fcVinc.get(e.fc) ?? 0) > 1) frenos.push(`${e.quien}: la factura está atada a otro movimiento también`)
  console.log(`   ${m?.fecha} extracción $ ${m?.debitos} ↔ ${e.quien} (${f?.fecha_emision}, $ ${f?.imp_total})`)
}

console.log("2 · Provinvest")
const ret = r2(PROV.gan + PROV.iibb)
const cierra = r2(PROV.cobrado + ret) === r2(n(venta?.imp_total))
if (!cierra) frenos.push(`Provinvest: cobrado + retenciones = ${r2(PROV.cobrado + ret)} ≠ factura ${venta?.imp_total}`)
if (venta?.estado !== "a cobrar") frenos.push(`Provinvest: la venta está «${venta?.estado}»`)
if (retPrev?.length) frenos.push(`Provinvest: la venta ya tiene ${retPrev.length} retenciones cargadas`)
if (provMov && (provMov.estado === "conciliado" || provMov.comprobante_venta_id)) frenos.push("Provinvest: el crédito ya está conciliado o atado")
console.log(`   FCE ${venta?.nro_comprobante} $ ${venta?.imp_total} = cobrado $ ${PROV.cobrado} + Ganancias $ ${PROV.gan} + IIBB $ ${PROV.iibb} → ${cierra ? "✓ cierra" : "✗ NO cierra"}`)
console.log(`   la venta toma la cuenta «${PROV.cuenta}» (hoy: ${venta?.cuenta_contable ?? "sin cuenta"})`)

console.log("3 · Libertad 2025 → template de PAM, una cuota nueva por movimiento, marca LIB")
for (const l of LIBERTAD) {
  const m = mov(l.mov), t = tpl(l.tpl)
  if (!t || t.responsable !== "PAM" || String(t.año) !== "2025") frenos.push(`Libertad: el template ${l.tpl} no es el 2025 de PAM`)
  if (!m || m.estado === "conciliado" || m.template_cuota_id || m.comprobante_arca_id) frenos.push(`Libertad: el movimiento ${m?.fecha} ya tiene vínculo`)
  const { data: delMes } = await sb.from("cuotas_egresos_sin_factura").select("id,estado").eq("egreso_id", l.tpl).gte("fecha_estimada", `${m?.fecha.slice(0, 7)}-01`).lte("fecha_estimada", `${m?.fecha.slice(0, 7)}-31`)
  if (delMes?.length) frenos.push(`Libertad: ${t?.nombre_referencia} ya tiene ${delMes.length} cuota(s) en ${m?.fecha.slice(0, 7)}`)
  console.log(`   ${m?.fecha} $ ${m?.debitos} → ${t?.nombre_referencia} PAM ${t?.año} (${t?.categ}) · ${mesDe(m?.fecha ?? "2025-01-01")}`)
}

if (frenos.length) { console.log("\n🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada)"); process.exit(0) }
if (existsSync(FOTO)) { console.log(`🛑 ${FOTO} ya existe`); process.exit(1) }
writeFileSync(FOTO, JSON.stringify({ tomada: new Date().toISOString(), "ma.ma_galicia": movs, "ma.comprobantes_arca": fcs, "ma.comprobantes_venta": [venta] }, null, 2))

// ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────
const hecho: { cuotas: string[]; retenciones: string[] } = { cuotas: [], retenciones: [] }
const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2))
guardar()
const nota = (m: any, txt: string) => [String(m.nota_operador || "").trim(), txt].filter(Boolean).join(" · ")
const avisos: string[] = []

// 1 · efectivo
for (const e of EFECTIVO) {
  const m = mov(e.mov)
  const { error } = await ma.from("ma_galicia").update({ estado: "conciliado", motivo_revision: null,
    nota_operador: nota(m, `OK ${HUELLA}: extracción pagada en efectivo a ${e.quien} · ${m.motivo_revision ?? ""}`.trim()) }).eq("id", m.id)
  if (error) throw error
  avisos.push(...(await conciliarOrigenDelMovimiento(sb as any, m)).avisos)
}

// 2 · Provinvest
{ const { data: cc } = await sb.from("cuentas_contables").select("nro_cuenta").eq("categ", PROV.cuenta).single()
  const { error } = await ma.from("comprobantes_venta").update({ cuenta_contable: PROV.cuenta, nro_cuenta: cc?.nro_cuenta ?? null }).eq("id", PROV.venta); if (error) throw error }
for (const [tipo, monto, cuenta] of [["ganancias", PROV.gan, "RETENCIONES DE GANANCIAS"], ["iibb", PROV.iibb, "RETENCIONES IIBB"]] as const) {
  const { data, error } = await ma.from("retenciones_recibidas").insert({ tipo, monto, cuenta_contable: cuenta, comprobante_venta_id: PROV.venta, cuit_cliente: venta.cuit_cliente,
    denominacion_cliente: venta.denominacion_cliente, fecha: PROV.fecha, nro_certificado: null,
    observaciones: `${HUELLA}: informada por JMS; con el cobro del ${PROV.fecha} cierra al centavo la FCE ${venta.nro_comprobante}. Falta el certificado.` }).select("id").single()
  if (error) throw error; hecho.retenciones.push(data.id); guardar()
}
{ const imp = await imputacionParaElBanco(sb as any, { cuenta_contable: PROV.cuenta })
  const { error } = await ma.from("ma_galicia").update({ comprobante_venta_id: PROV.venta, estado: "conciliado", motivo_revision: null, ...(imp ?? {}),
    detalle: provMov.detalle || `Cobro Provinvest FCE ${venta.nro_comprobante}`,
    nota_operador: nota(provMov, `${HUELLA}: cobro de la FCE ${venta.nro_comprobante} neto de retenciones (Ganancias $ ${PROV.gan} + IIBB $ ${PROV.iibb})`) }).eq("id", provMov.id)
  if (error) throw error }
const estadoVenta = await cerrarVentaSiSaldada(sb as any, PROV.venta, "ma")

// 3 · Libertad 2025
for (const l of LIBERTAD) {
  const m = mov(l.mov), t = tpl(l.tpl)
  const { data: cu, error } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: t.id, fecha_vencimiento: m.fecha, fecha_estimada: m.fecha, fecha_pago: m.fecha,
    monto: n(m.debitos), estado: "conciliado", detalle: `${t.nombre_referencia} — pagado por MA`, tipo_movimiento: "egreso", medio_pago: "banco", visible_contable: false }).select("id").single()
  if (error) throw error; hecho.cuotas.push(cu.id); guardar()
  const { error: e2 } = await ma.from("ma_galicia").update({ estado: "conciliado", categ: t.categ, nro_cuenta: null, detalle: m.detalle || t.nombre_referencia, template_id: t.id,
    template_cuota_id: cu.id, contable: "LIB", comprobantes_pagados: `${t.nombre_referencia} PAM - ${mesDe(m.fecha)}`, motivo_revision: null,
    nota_operador: nota(m, `${HUELLA}: Libertad 2025 al template de PAM, pagado por MA`) }).eq("id", m.id)
  if (e2) throw e2
}
console.log(`\n✅ Escrito: 2 extracciones confirmadas · Provinvest (venta → ${estadoVenta ?? "sin cambio de estado"}, ${hecho.retenciones.length} retenciones) · ${hecho.cuotas.length} cuotas de Libertad 2025`)
if (avisos.length) console.log("⚠️ Avisos:\n - " + avisos.join("\n - "))
