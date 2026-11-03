/**
 * 🏦 Script 184 — CA Galicia MA, tanda 4 (A-FEAT-1526; JMS 03/11: «pinturería ok», «Esposito y Magister ok» — Peiro «= que Esposito,
 * son 2 corralones», CUIT sin nombre «dejalo como consumo», «adelante»).
 *
 *     npx tsx scripts/184-ca-ma-tanda-4.mts              ← SIMULA
 *     npx tsx scripts/184-ca-ma-tanda-4.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * 1 · Centro Pinturerías 28/04 ↔ COLORMAC tique B 23765 (mismo día, mismo importe) → OK + cuenta «Pintura, materiales y herramientas».
 * 2 · Farmacia Magister 25/06 ↔ De Nevares FC B 10048 ($ 65.000) → OK (la factura ya trae su cuenta, si la tiene).
 * 3 · Mario J Peiro 18/05 ↔ su factura de MSA → OK con contable «AP 3 MSA» (MA pagó algo de MSA = MA aportó a MSA), como el 179.
 *     La cuenta de la factura de MSA no se toca (ya tiene la suya).
 * 4 · Los pagos a CUIT que no le facturan a ninguna de las 3 empresas → «Consumos MA», una cuota por movimiento (como el 181).
 *
 * Deshacer: `184-…-deshacer.mts` restaura desde la foto y borra sólo las cuotas creadas (`scripts/184-hecho.json`).
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { conciliarOrigenDelMovimiento } from "../lib/conciliacion/confirmar-origen"
import { asignarCuentaAFacturas } from "../lib/conciliacion/asignar-cuenta"
import { TABLAS_CON_VINCULO_ARCA } from "../lib/conciliacion/tablas-con-vinculo-arca"

const ESCRIBIR = process.argv.includes("--escribir")
const FOTO = "scripts/184-foto-antes.json", HECHO = "scripts/184-hecho.json"
const HUELLA = "[script 184] JMS 03/11"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ma = sb.schema("ma")
const n = (x: unknown) => Number(x) || 0
const r2 = (x: number) => Math.round(x * 100) / 100
const $ = (x: number) => `$ ${r2(x).toLocaleString("es-AR")}`
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const mesDe = (f: string) => `${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`
const frenos: string[] = []

const { data: abiertos } = await ma.from("ma_galicia").select("*").neq("estado", "conciliado")
const movs = (abiertos ?? []).map((m: any) => ({ ...m, cuit: (String(m.concepto ?? "").match(/\d{11}/) ?? [""])[0] }))
const uno = <T,>(xs: T[], qué: string): T | undefined => { if (xs.length !== 1) frenos.push(`${qué}: ${xs.length} encontrados`); return xs[0] }

// ── 1-3 · a auditar ──────────────────────────────────────────────────────────────────────────────────────
const pint = uno(movs.filter((m: any) => m.estado === "auditar" && m.fecha === "2026-04-28" && /CENTRO PINTURERIAS/.test(m.concepto ?? "")), "Centro Pinturerías")
const mag = uno(movs.filter((m: any) => m.estado === "auditar" && m.fecha === "2026-06-25" && /FARMACIA MAGISTER/.test(m.concepto ?? "")), "Farmacia Magister")
const peiro = uno(movs.filter((m: any) => m.estado === "auditar" && m.cuit === "30645598039"), "Mario J Peiro")
const { data: fcMa } = await ma.from("comprobantes_arca").select("*").in("id", [pint?.comprobante_arca_id, mag?.comprobante_arca_id].filter(Boolean))
const { data: fcMsa } = await sb.schema("msa").from("comprobantes_arca").select("*").eq("id", peiro?.comprobante_arca_id ?? "00000000-0000-0000-0000-000000000000")
const fPint = (fcMa ?? []).find((f: any) => f.id === pint?.comprobante_arca_id), fMag = (fcMa ?? []).find((f: any) => f.id === mag?.comprobante_arca_id), fPeiro = fcMsa?.[0]
for (const [qué, m, f] of [["Centro Pinturerías", pint, fPint], ["Magister", mag, fMag], ["Peiro", peiro, fPeiro]] as const) {
  if (!f) frenos.push(`${qué}: no está su factura`)
  else if (r2(n(f.imp_total)) !== r2(n(m?.debitos))) frenos.push(`${qué}: importe distinto`)
  console.log(`${qué}: ${m?.fecha} ${$(n(m?.debitos))} ↔ ${f?.denominacion_emisor} ${f?.tipo_comprobante_desc} ${f?.numero_desde} (${f?.fecha_emision}) · cuenta ${f?.cuenta_contable ?? "—"}`)
}

// ── 4 · CUIT que no facturan a nadie → Consumos MA ───────────────────────────────────────────────────────
const cand = movs.filter((m: any) => m.estado === "pendiente" && m.cuit && n(m.debitos) > 0 && !m.comprobante_arca_id && !m.template_cuota_id && !m.comprobante_venta_id)
const cuits = [...new Set(cand.map((m: any) => m.cuit))]
const conFactura = new Set<string>()
for (const s of ["ma", "msa", "pam"]) {
  const { data } = await sb.schema(s).from("comprobantes_arca").select("cuit").in("cuit", cuits)
  for (const x of data ?? []) conFactura.add(x.cuit)
}
const { data: cartera } = await sb.from("proveedores").select("cuit,razon_social").in("cuit", cuits)
const nombre = new Map((cartera ?? []).map((p: any) => [p.cuit, p.razon_social]))
const consumo = cand.filter((m: any) => !conFactura.has(m.cuit) && !/^0+/.test(m.cuit) && m.cuit !== "27066824611")
const porCuit = new Map<string, any[]>()
for (const m of consumo) porCuit.set(m.cuit, [...(porCuit.get(m.cuit) ?? []), m])
console.log(`\n4 · Consumos MA: ${consumo.length} pagos a ${porCuit.size} CUIT sin factura en ninguna empresa · ${$(consumo.reduce((t: number, m: any) => t + n(m.debitos), 0))}`)
for (const [c, ms] of [...porCuit].sort((a, b) => b[1].reduce((t, m) => t + n(m.debitos), 0) - a[1].reduce((t, m) => t + n(m.debitos), 0)))
  console.log(`   ${c} ${nombre.get(c) ?? ""} · ${ms.length} pagos · ${$(ms.reduce((t, m) => t + n(m.debitos), 0))}`)
const quedan = cand.filter((m: any) => conFactura.has(m.cuit))
console.log(`   (no entran — le facturan a alguna empresa: ${[...new Set(quedan.map((m: any) => `${m.cuit} ${nombre.get(m.cuit) ?? ""}`.trim()))].join(" · ")})`)
const { data: tpl } = await sb.from("egresos_sin_factura").select("id,nombre_referencia,categ").eq("responsable", "MA").eq("nombre_referencia", "Consumos MA").single()
if (!tpl) frenos.push("no está el template «Consumos MA»")

if (frenos.length) { console.log("\n🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada)"); process.exit(0) }
if (existsSync(FOTO)) { console.log(`🛑 ${FOTO} ya existe`); process.exit(1) }
const idsFc = [fPint.id, fMag.id]
const prop: Record<string, any[]> = {}
for (const t of TABLAS_CON_VINCULO_ARCA) {
  const { data } = await (t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)).select("*").in("comprobante_arca_id", [fPint.id])
  if (data?.length) prop[`${t.schema}.${t.tabla}`] = data
}
writeFileSync(FOTO, JSON.stringify({ tomada: new Date().toISOString(), "ma.ma_galicia": [pint, mag, peiro, ...consumo].map(({ cuit, ...m }: any) => m),
  "ma.comprobantes_arca": fcMa, "msa.comprobantes_arca": fcMsa, propagacion: prop }, null, 2))

// ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────
const hecho: { cuotas: string[] } = { cuotas: [] }
const guardar = () => writeFileSync(HECHO, JSON.stringify(hecho, null, 2)); guardar()
const nota = (m: any, txt: string) => [String(m.nota_operador || "").trim(), txt].filter(Boolean).join(" · ")
const avisos: string[] = []
for (const [m, txt, extra] of [[pint, "Centro Pinturerías = COLORMAC (mismo día y monto)", {}], [mag, "Farmacia Magister contra su factura", {}],
  [peiro, "Mario J Peiro (corralón): factura de MSA pagada por MA = aporte de MA a MSA", { contable: "AP 3 MSA" }]] as const) {
  const { error } = await ma.from("ma_galicia").update({ estado: "conciliado", motivo_revision: null, ...extra,
    nota_operador: nota(m, `OK ${HUELLA}: ${txt} · ${m.motivo_revision ?? ""}`.trim()) }).eq("id", m.id)
  if (error) throw error
  avisos.push(...(await conciliarOrigenDelMovimiento(sb as any, m)).avisos)
}
const rP = await asignarCuentaAFacturas(sb as any, "MA", [fPint.id], { cuenta_contable: "Pintura, materiales y herramientas" })
for (const m of consumo) {
  const quien = nombre.get(m.cuit) ?? `CUIT ${m.cuit}`
  const { data: cu, error } = await sb.from("cuotas_egresos_sin_factura").insert({ egreso_id: tpl.id, fecha_vencimiento: m.fecha, fecha_estimada: m.fecha, fecha_pago: m.fecha,
    monto: n(m.debitos), estado: "conciliado", detalle: `Consumos MA — ${quien}`, tipo_movimiento: "egreso", medio_pago: "banco", visible_contable: false }).select("id").single()
  if (error) throw error; hecho.cuotas.push(cu.id); guardar()
  const { error: e2 } = await ma.from("ma_galicia").update({ estado: "conciliado", categ: tpl.categ, nro_cuenta: null, detalle: m.detalle || `Consumos MA — ${quien}`, template_id: tpl.id,
    template_cuota_id: cu.id, comprobantes_pagados: `Consumos MA - ${mesDe(m.fecha)}`, motivo_revision: null,
    nota_operador: nota(m, `${HUELLA}: CUIT sin factura en ninguna empresa → consumo («dejalo como consumo»)`) }).eq("id", m.id)
  if (e2) throw e2
}
console.log(`\n✅ Escrito: 3 confirmados (Peiro con AP 3 MSA) · cuenta Pintura en COLORMAC (${rP.propagacion.propagados} mov.) · ${hecho.cuotas.length} pagos a Consumos MA`)
if (avisos.length) console.log("⚠️ Avisos:\n - " + avisos.join("\n - "))
